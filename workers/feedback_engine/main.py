"""Feedback engine worker.

Endpoints:
- POST /feedback                    : record a single thumbs up/down
- POST /feedback/batch              : record many at once, then recompute
- GET  /preferences/:user_id        : current weights + accuracy
- POST /preferences/search          : personalized FAISS top-k
- POST /preferences/reset           : reset to defaults
- GET  /health
"""
from __future__ import annotations

import json
import os
import uuid
from typing import List, Optional

from fastapi import FastAPI, HTTPException

from common.api import APIClient
from common.config import get_settings
from common.db import Database, save_user_weights
from common.logging import configure_logging, get_logger, log_gpu_profile
from common.models import HealthResponse

from .models.schema import (
    FeedbackBatchIn,
    FeedbackIn,
    PersonalizedSearchHit,
    PersonalizedSearchRequest,
    PreferencesResponse,
    PreferenceWeights,
)
from .utils.preference_updater import (
    DEFAULT_WEIGHTS,
    aggregate_updates,
    estimate_accuracy,
    personalized_query,
)


configure_logging()
logger = get_logger("feedback_engine")
app = FastAPI(title="VisionCut Feedback Engine", version="1.0.0")

_api_client: Optional[APIClient] = None


@app.on_event("startup")
async def _startup() -> None:
    global _api_client
    await Database.init()
    _api_client = APIClient()
    if get_settings().sentry_dsn:
        import sentry_sdk
        sentry_sdk.init(dsn=get_settings().sentry_dsn, traces_sample_rate=0.1)
    log_gpu_profile("feedback_engine")


@app.on_event("shutdown")
async def _shutdown() -> None:
    if _api_client is not None:
        await _api_client.aclose()
    await Database.close()


# ----------------- helpers -----------------

async def _get_user_state(user_id: str) -> dict:
    async with Database.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT feature_weights, total_feedback FROM user_preferences WHERE user_id = $1",
            user_id,
        )
    if not row:
        return {"feature_weights": dict(DEFAULT_WEIGHTS), "total_feedback": 0}
    return {
        "feature_weights": {**DEFAULT_WEIGHTS, **(row["feature_weights"] or {})},
        "total_feedback": int(row["total_feedback"] or 0),
    }


async def _record_feedback_row(item: FeedbackIn) -> dict:
    """Insert into feedback table and return the matched/not_matched list
    for the clip if we can find one.
    """
    matched: List[str] = []
    not_matched: List[str] = []
    if item.clip_id:
        async with Database.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT metadata FROM clips WHERE id = $1", item.clip_id
            )
        meta = (row["metadata"] or {}) if row else {}
        # Translate clip metadata into a matched/not_matched list
        motion = float(meta.get("motion_level", 0.0) or 0.0)
        scene = meta.get("scene_type", "unknown")
        if motion > 0.4:
            matched.append("motion")
        else:
            not_matched.append("motion")
        if scene and scene != "unknown":
            matched.append("scene")
        else:
            not_matched.append("scene")
        if float(meta.get("quality", 0.0) or 0.0) > 0.4:
            matched.append("visual_quality")
        else:
            not_matched.append("visual_quality")
        if meta.get("camera_movement") and meta.get("camera_movement") != "static":
            matched.append("camera_movement")

    feedback_id = str(uuid.uuid4())
    async with Database.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO feedback
              (id, user_id, project_id, segment_id, clip_id, rating, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()))
            """,
            feedback_id, item.user_id, item.project_id, item.segment_position, item.clip_id,
            item.rating, item.created_at,
        )
        await conn.execute(
            """
            INSERT INTO analytics_events (id, user_id, project_id, event_type, payload)
            VALUES (gen_random_uuid(), $1, $2, 'feedback_given', $3::jsonb)
            """,
            item.user_id, item.project_id, json.dumps({"rating": item.rating, "clip_id": item.clip_id}),
        )
    return {"matched": matched, "not_matched": not_matched, "rating": item.rating}


# ----------------- routes -----------------

@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="feedback_engine")


@app.post("/feedback")
async def record_feedback(item: FeedbackIn) -> dict:
    if item.rating not in (1, -1):
        raise HTTPException(status_code=400, detail="rating must be 1 or -1")
    fb = await _record_feedback_row(item)

    state = await _get_user_state(item.user_id)
    new_weights = aggregate_updates(
        current_weights=state["feature_weights"],
        feedback=[fb],
        total_feedback_before=state["total_feedback"],
    )
    await save_user_weights(item.user_id, new_weights)
    return {"ok": True, "weights": new_weights}


@app.post("/feedback/batch")
async def record_batch(batch: FeedbackBatchIn) -> dict:
    if not batch.items:
        raise HTTPException(status_code=400, detail="empty batch")
    user_id = batch.items[0].user_id
    for it in batch.items:
        if it.user_id != user_id:
            raise HTTPException(status_code=400, detail="all items must share a user_id")
    state = await _get_user_state(user_id)
    enriched = []
    for it in batch.items:
        enriched.append(await _record_feedback_row(it))
    new_weights = aggregate_updates(
        current_weights=state["feature_weights"],
        feedback=enriched,
        total_feedback_before=state["total_feedback"],
    )
    await save_user_weights(user_id, new_weights)
    return {
        "ok": True,
        "weights": new_weights,
        "processed": len(enriched),
        "accuracy_estimate": estimate_accuracy(enriched),
    }


@app.get("/preferences/{user_id}", response_model=PreferencesResponse)
async def get_preferences(user_id: str) -> PreferencesResponse:
    state = await _get_user_state(user_id)
    async with Database.acquire() as conn:
        recent = await conn.fetch(
            "SELECT rating FROM feedback WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100",
            user_id,
        )
    accuracy = estimate_accuracy([dict(r) for r in recent])
    return PreferencesResponse(
        user_id=user_id,
        weights=PreferenceWeights(**state["feature_weights"]),
        total_feedback=state["total_feedback"],
        accuracy_estimate=accuracy,
    )


@app.post("/preferences/reset/{user_id}")
async def reset_preferences(user_id: str) -> dict:
    await save_user_weights(user_id, dict(DEFAULT_WEIGHTS))
    return {"ok": True, "weights": dict(DEFAULT_WEIGHTS)}


@app.post("/preferences/search", response_model=List[PersonalizedSearchHit])
async def personalized_search(req: PersonalizedSearchRequest) -> List[PersonalizedSearchHit]:
    if len(req.query_embedding) != 512:
        raise HTTPException(status_code=400, detail="query_embedding must be 512-dim")
    state = await _get_user_state(req.user_id)
    boosted = personalized_query(req.query_embedding, state["feature_weights"])

    # Use the in-process FAISS index from the clip_analyzer module
    try:
        from clip_analyzer.utils.faiss_index import get_index
        idx = get_index()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"index unavailable: {e}")

    raw = idx.search(boosted, k=req.k, project_id=req.project_id)
    return [
        PersonalizedSearchHit(
            clip_id=meta["clip_id"],
            name=meta.get("name", meta["clip_id"]),
            score=round(score * 100, 2),
            duration_sec=meta.get("duration_sec", 0.0),
        )
        for meta, score in raw
    ]


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8006"))
    uvicorn.run("feedback_engine.main:app", host="0.0.0.0", port=port, reload=False)
