"""Style engine worker.

Endpoints:
- POST /styles/vectorize         : blueprint -> 256-dim style vector
- POST /styles/save              : persist a style from a project
- POST /styles/apply             : load a style's blueprint template
- POST /styles/match             : find top-k similar styles for a blueprint
- GET  /styles/user/:user_id     : list a user's styles
- GET  /styles/public            : list public styles
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
from common.db import Database
from common.embeddings import cosine_search
from common.logging import configure_logging, get_logger, log_gpu_profile
from common.models import HealthResponse

from .models.schema import (
    ApplyStyleRequest,
    ApplyStyleResponse,
    MatchStylesRequest,
    MatchStylesResponse,
    SaveStyleRequest,
    SaveStyleResponse,
    StyleHit,
    StyleVectorRequest,
    StyleVectorResponse,
)
from .utils.style_vectorizer import blueprint_template, vectorize


configure_logging()
logger = get_logger("style_engine")
app = FastAPI(title="VisionCut Style Engine", version="1.0.0")

_api_client: Optional[APIClient] = None


@app.on_event("startup")
async def _startup() -> None:
    global _api_client
    await Database.init()
    _api_client = APIClient()
    if get_settings().sentry_dsn:
        import sentry_sdk
        sentry_sdk.init(dsn=get_settings().sentry_dsn, traces_sample_rate=0.1)
    log_gpu_profile("style_engine")


@app.on_event("shutdown")
async def _shutdown() -> None:
    if _api_client is not None:
        await _api_client.aclose()
    await Database.close()


# ----------------- routes -----------------

@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="style_engine")


@app.post("/styles/vectorize", response_model=StyleVectorResponse)
async def vectorize_blueprint(req: StyleVectorRequest) -> StyleVectorResponse:
    v = vectorize(req.blueprint)
    return StyleVectorResponse(style_vector=v, dim=len(v))


@app.post("/styles/save", response_model=SaveStyleResponse)
async def save_style(req: SaveStyleRequest) -> SaveStyleResponse:
    async with Database.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT blueprint FROM projects WHERE id = $1 AND user_id = $2",
            req.project_id, req.user_id,
        )
    if not row or not row["blueprint"]:
        raise HTTPException(status_code=404, detail="project blueprint not found")
    blueprint = row["blueprint"]
    style_vec = vectorize(blueprint)
    template = blueprint_template(blueprint)
    content_type = req.content_type or blueprint.get("content_type", "general")
    style_id = str(uuid.uuid4())
    async with Database.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO styles
              (id, user_id, name, content_type, pace, transitions, audio_components,
               blueprint_template, style_vector, is_public, usage_count, created_at)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::vector, $10, 0, NOW())
            """,
            style_id, req.user_id, req.name, content_type, blueprint.get("pace", "medium"),
            json.dumps(template.get("transitions", [])),
            json.dumps(template.get("audio", {})),
            json.dumps(template),
            style_vec, bool(req.is_public),
        )
    return SaveStyleResponse(style_id=style_id, style_vector=style_vec)


@app.post("/styles/apply", response_model=ApplyStyleResponse)
async def apply_style(req: ApplyStyleRequest) -> ApplyStyleResponse:
    async with Database.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT blueprint_template, user_id FROM styles WHERE id = $1", req.style_id
        )
    if not row:
        raise HTTPException(status_code=404, detail="style not found")
    template = row["blueprint_template"] or {}
    # Persist as the new project's blueprint (overrides any existing reference)
    async with Database.acquire() as conn:
        await conn.execute(
            "UPDATE projects SET blueprint = blueprint || $2::jsonb, status = 'analyzing', updated_at = NOW() WHERE id = $1",
            req.project_id, json.dumps(template),
        )
        await conn.execute(
            "UPDATE styles SET usage_count = usage_count + 1 WHERE id = $1",
            req.style_id,
        )
    if _api_client is not None:
        await _api_client.progress(req.project_id, "Style applied", 50)
    return ApplyStyleResponse(project_id=req.project_id, blueprint=template)


@app.post("/styles/match", response_model=MatchStylesResponse)
async def match_styles(req: MatchStylesRequest) -> MatchStylesResponse:
    q = vectorize(req.blueprint)
    scope_filter = "user_id = $1 OR is_public = true"
    async with Database.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT id, name, content_type, style_vector FROM styles WHERE {scope_filter}",
            req.user_id,
        )
    if not rows:
        return MatchStylesResponse(hits=[])
    import numpy as np
    vectors = []
    valid = []
    for r in rows:
        v = r["style_vector"]
        if v is None:
            continue
        vectors.append(np.asarray(v, dtype=np.float32))
        valid.append((str(r["id"]), r["name"], r["content_type"]))
    if not vectors:
        return MatchStylesResponse(hits=[])
    matrix = np.vstack(vectors)
    sims, idx = cosine_search(np.asarray(q, dtype=np.float32), matrix, k=min(req.top_k, len(valid)))
    hits = []
    for s, i in zip(sims, idx):
        sid, name, ctype = valid[int(i)]
        hits.append(StyleHit(style_id=sid, name=name, similarity=round(float(s) * 100, 2), content_type=ctype))
    return MatchStylesResponse(hits=hits)


@app.get("/styles/user/{user_id}")
async def list_user_styles(user_id: str) -> List[dict]:
    async with Database.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, name, content_type, pace, is_public, usage_count, created_at "
            "FROM styles WHERE user_id = $1 ORDER BY created_at DESC",
            user_id,
        )
    return [dict(r) for r in rows]


@app.get("/styles/public")
async def list_public_styles(limit: int = 50) -> List[dict]:
    async with Database.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, name, content_type, pace, usage_count, created_at "
            "FROM styles WHERE is_public = true ORDER BY usage_count DESC LIMIT $1",
            limit,
        )
    return [dict(r) for r in rows]


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8005"))
    uvicorn.run("style_engine.main:app", host="0.0.0.0", port=port, reload=False)
