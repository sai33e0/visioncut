"""Timeline builder worker.

Takes a blueprint + candidate clips + user preferences, returns a Timeline
that the renderer can execute.
"""
from __future__ import annotations

import os
import uuid
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from common.api import APIClient
from common.config import get_settings
from common.db import Database, fetch_user_clips, fetch_user_weights, save_timeline
from common.logging import configure_logging, get_logger, log_gpu_profile
from common.models import HealthResponse

from .models.schema import BuildRequest, BuildResponse, SegmentSpec
from .utils.matcher import match_shots
from .utils.shots import build_shots


configure_logging()
logger = get_logger("timeline_builder")
app = FastAPI(title="VisionCut Timeline Builder", version="1.0.0")

_api_client: Optional[APIClient] = None


@app.on_event("startup")
async def _startup() -> None:
    global _api_client
    await Database.init()
    _api_client = APIClient()
    if get_settings().sentry_dsn:
        import sentry_sdk
        sentry_sdk.init(dsn=get_settings().sentry_dsn, traces_sample_rate=0.1)
    log_gpu_profile("timeline_builder")


@app.on_event("shutdown")
async def _shutdown() -> None:
    if _api_client is not None:
        await _api_client.aclose()
    await Database.close()


class BuildFromProjectRequest(BaseModel):
    project_id: str
    user_id: str


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="timeline_builder")


@app.post("/build", response_model=BuildResponse)
async def build(req: BuildRequest) -> BuildResponse:
    """Build a timeline from an explicit blueprint + candidate clips."""
    shots = req.cuts or build_shots(req.blueprint)
    weights = await fetch_user_weights(req.user_id)

    # Pull candidate clips for the project
    rows = await fetch_user_clips(req.project_id)
    candidates = [dict(r) for r in rows]
    segments = match_shots(shots, candidates, user_weights=weights)
    total_dur = sum(s.duration for s in segments)
    quality = _timeline_quality(segments, len(candidates))
    return BuildResponse(
        project_id=req.project_id,
        segments=segments,
        duration=round(total_dur, 3),
        quality_score=quality,
    )


@app.post("/build-from-project", response_model=BuildResponse)
async def build_from_project(req: BuildFromProjectRequest) -> BuildResponse:
    """Load blueprint from DB, build shots, fetch clips, match, persist."""
    blueprint = await _load_blueprint(req.project_id)
    if not blueprint:
        raise HTTPException(status_code=404, detail="blueprint not found")
    shots = build_shots(blueprint)
    weights = await fetch_user_weights(req.user_id)
    rows = await fetch_user_clips(req.project_id)
    candidates = [dict(r) for r in rows]
    segments = match_shots(shots, candidates, user_weights=weights)
    total_dur = sum(s.duration for s in segments)
    quality = _timeline_quality(segments, len(candidates))

    timeline_dict = {
        "project_id": req.project_id,
        "segments": [s.model_dump() for s in segments],
        "duration": round(total_dur, 3),
        "quality_score": quality,
    }
    await save_timeline(req.project_id, timeline_dict, quality_score=quality)
    if _api_client is not None:
        await _api_client.timeline(req.project_id, timeline_dict)
        await _api_client.progress(req.project_id, "Timeline built", 75)

    return BuildResponse(
        project_id=req.project_id,
        segments=segments,
        duration=round(total_dur, 3),
        quality_score=quality,
    )


class SwapRequest(BaseModel):
    project_id: str
    segment_position: int
    new_clip_id: str
    user_id: str


@app.post("/swap")
async def swap(req: SwapRequest) -> dict:
    """Replace the selected clip on a single segment, recompute confidence."""
    blueprint = await _load_blueprint(req.project_id)
    if not blueprint:
        raise HTTPException(status_code=404, detail="blueprint not found")
    timeline = blueprint.get("timeline") or {}
    segments = timeline.get("segments", []) or []
    target = next((s for s in segments if s.get("position") == req.segment_position), None)
    if not target:
        raise HTTPException(status_code=404, detail="segment not found")

    rows = await fetch_user_clips(req.project_id)
    new_clip = next((dict(r) for r in rows if r["id"] == req.new_clip_id), None)
    if not new_clip:
        raise HTTPException(status_code=404, detail="new clip not found in project")

    weights = await fetch_user_weights(req.user_id)
    from .utils.scorer import score, build_reason
    from .utils.matcher import _shot_to_query, _cosine
    from .models.schema import ShotSpec

    shot = ShotSpec(
        position=target["position"],
        start_time=target["start_time"],
        end_time=target["end_time"],
        target_duration=target.get("duration") or (target["end_time"] - target["start_time"]),
        target_motion=target.get("target_motion", 0.5),
        target_scene=target.get("target_scene", "unknown"),
        target_camera=target.get("target_camera", "static"),
    )
    query = _shot_to_query(shot)
    new_clip_meta = {"duration_sec": new_clip.get("duration_sec", 0.0), "metadata": new_clip.get("metadata") or {}}
    # Build the dict shape scorer expects
    cand = {
        "clip_id": new_clip["id"],
        "name": new_clip.get("name", new_clip["id"]),
        "duration_sec": new_clip.get("duration_sec", 0.0),
        "metadata": new_clip.get("metadata") or {},
    }
    emb = (new_clip.get("embedding") or None)
    sim = _cosine(query, emb) if emb else 0.5
    final, parts = score(
        faiss_sim=sim,
        target_motion=shot.target_motion,
        target_duration=shot.target_duration,
        target_scene=shot.target_scene,
        target_camera=shot.target_camera,
        candidate=cand,
        weights=weights,
    )
    reason = build_reason(parts, cand)
    target["selected_clip_id"] = cand["clip_id"]
    target["selected_clip_name"] = cand["name"]
    target["confidence"] = round(final, 2)
    target["match_reason"] = {**reason, "cosine_similarity": round(sim, 4)}
    timeline["segments"] = segments
    await save_timeline(req.project_id, timeline)
    return {"ok": True, "segment": target}


# ----------------- helpers -----------------

async def _load_blueprint(project_id: str) -> dict:
    async with Database.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT blueprint, timeline FROM projects WHERE id = $1", project_id
        )
    if not row:
        return {}
    bp = row["blueprint"] or {}
    if row["timeline"]:
        bp = {**bp, "timeline": row["timeline"]}
    return bp


def _timeline_quality(segments: List[SegmentSpec], n_candidates: int) -> Optional[float]:
    if not segments:
        return None
    avg_conf = sum(s.confidence for s in segments) / len(segments)
    # Boost a bit if we had many candidates to pick from (better matching diversity)
    diversity_bonus = min(0.05, n_candidates / 200.0)
    return round(min(100.0, avg_conf + diversity_bonus), 2)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8003"))
    uvicorn.run("timeline_builder.main:app", host="0.0.0.0", port=port, reload=False)
