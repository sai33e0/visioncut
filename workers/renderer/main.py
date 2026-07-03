"""Renderer worker.

Pulls a timeline + reference from the DB, runs the FFmpeg pipeline,
computes a perceptual quality score, and uploads the result to R2.
"""
from __future__ import annotations

import json
import os
import shutil
import tempfile
import uuid
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from common.api import APIClient
from common.config import get_settings
from common.db import Database
from common.logging import configure_logging, get_logger, log_gpu_profile
from common.models import HealthResponse

from .utils.ffmpeg_pipeline import render_timeline
from .utils.quality_scorer import full_quality_report


configure_logging()
logger = get_logger("renderer")
app = FastAPI(title="VisionCut Renderer", version="1.0.0")

_api_client: Optional[APIClient] = None


@app.on_event("startup")
async def _startup() -> None:
    global _api_client
    await Database.init()
    _api_client = APIClient()
    if get_settings().sentry_dsn:
        import sentry_sdk
        sentry_sdk.init(dsn=get_settings().sentry_dsn, traces_sample_rate=0.1)
    log_gpu_profile("renderer")


@app.on_event("shutdown")
async def _shutdown() -> None:
    if _api_client is not None:
        await _api_client.aclose()
    await Database.close()


# ----------------- helpers -----------------

async def _upload_to_r2(local_path: str, key: str) -> str:
    """Upload a file to the backend's /uploads/asset route (which writes to R2)."""
    s = get_settings()
    with open(local_path, "rb") as f:
        files = {"file": (os.path.basename(local_path), f, "video/mp4")}
        data = {"key": key, "type": "render"}
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, read=600.0)) as client:
            r = await client.post(
                f"{s.api_url}/uploads/asset",
                files=files,
                data=data,
                headers={"X-Worker-Token": s.worker_token},
            )
            r.raise_for_status()
            body = r.json()
    return body.get("url", f"{s.storage_public_base}/{key}")


async def _load_project_state(project_id: str) -> dict:
    async with Database.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, timeline, blueprint, reference_url FROM projects WHERE id = $1",
            project_id,
        )
    if not row:
        raise FileNotFoundError(f"project {project_id} not found")
    return dict(row) if row else {}


async def _load_reference_local(reference_url: str, work_dir: str) -> Optional[str]:
    if not reference_url:
        return None
    s = get_settings()
    if reference_url.startswith("/") or reference_url.startswith(s.storage_root):
        out = os.path.join(work_dir, "reference.mp4")
        if os.path.exists(reference_url):
            shutil.copy(reference_url, out)
            return out
    out = os.path.join(work_dir, "reference.mp4")
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, read=600.0)) as client:
            async with client.stream("GET", reference_url) as r:
                r.raise_for_status()
                with open(out, "wb") as f:
                    async for chunk in r.aiter_bytes():
                        f.write(chunk)
        return out
    except Exception as e:
        logger.warning("reference_download_failed", error=str(e))
        return None


# ----------------- routes -----------------

class RenderRequest(BaseModel):
    project_id: str
    audio_url: Optional[str] = None


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="renderer")


@app.post("/render")
async def render(req: RenderRequest) -> dict:
    work_dir = os.path.join(get_settings().storage_root, "tmp", str(uuid.uuid4()))
    os.makedirs(work_dir, exist_ok=True)
    try:
        if _api_client is not None:
            await _api_client.progress(req.project_id, "Loading project", 78)
        state = await _load_project_state(req.project_id)
        timeline = state.get("timeline")
        if not timeline:
            raise HTTPException(status_code=404, detail="timeline not found for project")
        # Attach clip_url to each segment so ffmpeg can fetch them
        await _populate_clip_urls(req.project_id, timeline.get("segments", []))

        if _api_client is not None:
            await _api_client.progress(req.project_id, "Rendering video", 85)
        out_path = os.path.join(work_dir, "output.mp4")
        render_meta = render_timeline(
            timeline=timeline,
            out_path=out_path,
            work_dir=work_dir,
            audio_path=req.audio_url,
        )

        if _api_client is not None:
            await _api_client.progress(req.project_id, "Scoring quality", 92)
        reference_local = await _load_reference_local(state.get("reference_url", ""), work_dir)
        report = full_quality_report(
            reference_path=reference_local,
            output_path=out_path,
            reference_blueprint=state.get("blueprint"),
            output_blueprint=None,
        )

        if _api_client is not None:
            await _api_client.progress(req.project_id, "Uploading result", 96)
        r2_key = f"renders/{req.project_id}/{uuid.uuid4()}.mp4"
        try:
            r2_url = await _upload_to_r2(out_path, r2_key)
        except Exception as e:
            logger.warning("r2_upload_failed", error=str(e))
            r2_url = f"{get_settings().storage_public_base}/{r2_key}"

        # Persist final result
        async with Database.acquire() as conn:
            await conn.execute(
                "UPDATE projects SET render_url = $2, quality_score = $3, status = 'done', updated_at = NOW() WHERE id = $1",
                req.project_id, r2_url, report["overall"],
            )
            await conn.execute(
                "INSERT INTO analytics_events (id, user_id, project_id, event_type, payload) "
                "SELECT gen_random_uuid(), user_id, id, 'render_done', $2::jsonb FROM projects WHERE id = $1",
                req.project_id,
                json.dumps({"quality_score": report["overall"], "duration": render_meta["duration"]}),
            )

        if _api_client is not None:
            await _api_client.render_complete(req.project_id, r2_key, report["overall"])
            await _api_client.progress(req.project_id, "Done", 100)

        return {
            "ok": True,
            "project_id": req.project_id,
            "render_url": r2_url,
            "duration": render_meta["duration"],
            "gpu": render_meta["gpu"],
            "quality": report,
        }
    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("render_failed", project_id=req.project_id, error=str(e))
        async with Database.acquire() as conn:
            await conn.execute(
                "UPDATE projects SET status = 'failed', error = $2, updated_at = NOW() WHERE id = $1",
                req.project_id, str(e),
            )
        if _api_client is not None:
            await _api_client.render_failed(req.project_id, str(e))
            await _api_client.progress(req.project_id, f"Render failed: {e}", -1)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


async def _populate_clip_urls(project_id: str, segments: list) -> None:
    """Attach `clip_url` to each segment by looking up the project's clips."""
    if not segments:
        return
    needed = {s.get("selected_clip_id") for s in segments if s.get("selected_clip_id")}
    if not needed:
        return
    async with Database.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, url FROM clips WHERE project_id = $1 AND id = ANY($2::uuid[])",
            project_id, list(needed),
        )
    url_map = {str(r["id"]): r["url"] for r in rows}
    for s in segments:
        cid = s.get("selected_clip_id")
        if cid and cid in url_map:
            s["clip_url"] = url_map[cid]


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8004"))
    uvicorn.run("renderer.main:app", host="0.0.0.0", port=port, reload=False)
