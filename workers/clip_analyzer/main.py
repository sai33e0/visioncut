"""Clip analyzer worker.

Endpoints:
- POST /analyze            : analyze one clip (visual + YOLO + embedding)
- POST /analyze-batch      : analyze many clips
- POST /search             : FAISS top-k for a project
- POST /index/from-db      : rebuild in-memory index from DB embeddings
- GET  /health
"""
from __future__ import annotations

import asyncio
import os
import shutil
import tempfile
import uuid
from typing import List, Optional

import httpx
from fastapi import FastAPI, HTTPException

from common.api import APIClient
from common.config import get_settings
from common.db import Database, update_clip_embedding, update_clip_metadata
from common.logging import configure_logging, get_logger, log_gpu_profile
from common.models import HealthResponse
from pydantic import BaseModel

from .models.schema import (
    AnalyzeClipRequest,
    ClipFeatures,
    SearchRequest,
    SearchResult,
)
from .utils.embedding import featurize_clip
from .utils.faiss_index import get_index
from .utils.feature_extractor import VisualFeatures, extract_visual_features
from .utils.yolo_detector import classify_scene, detect_objects, summarize

configure_logging()
logger = get_logger("clip_analyzer")
app = FastAPI(title="VisionCut Clip Analyzer", version="1.0.0")

_api_client: Optional[APIClient] = None
_yolo_lock = asyncio.Lock()  # YOLO inference is GIL-released but we still want one batch at a time


@app.on_event("startup")
async def _startup() -> None:
    global _api_client
    await Database.init()
    _api_client = APIClient()
    if get_settings().sentry_dsn:
        import sentry_sdk
        sentry_sdk.init(dsn=get_settings().sentry_dsn, traces_sample_rate=0.1)
    log_gpu_profile("clip_analyzer")


@app.on_event("shutdown")
async def _shutdown() -> None:
    if _api_client is not None:
        await _api_client.aclose()
    await Database.close()


# ----------------- helpers -----------------

async def _download_to_temp(url: str, work_dir: str) -> str:
    s = get_settings()
    if url.startswith("/") or url.startswith(s.storage_root):
        out = os.path.join(work_dir, "clip.mp4")
        shutil.copy(url, out)
        return out
    out = os.path.join(work_dir, "clip.mp4")
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, read=600.0)) as client:
        async with client.stream("GET", url) as r:
            r.raise_for_status()
            with open(out, "wb") as f:
                async for chunk in r.aiter_bytes():
                    f.write(chunk)
    return out


async def _analyze_single(req: AnalyzeClipRequest) -> ClipFeatures:
    work_dir = os.path.join(get_settings().storage_root, "tmp", str(uuid.uuid4()))
    os.makedirs(work_dir, exist_ok=True)
    try:
        video_path = await _download_to_temp(req.url, work_dir)

        loop = asyncio.get_event_loop()
        visual: VisualFeatures = await loop.run_in_executor(None, extract_visual_features, video_path)
        async with _yolo_lock:
            detections = await loop.run_in_executor(None, detect_objects, video_path)
        scene = classify_scene(detections)
        summary = summarize(detections)
        embedding = featurize_clip(visual, detections, video_path) if req.precompute_embedding else []

        # Quality score 0-1
        quality = visual.quality

        meta = {
            "duration_sec": round(visual.duration, 3),
            "fps": round(visual.fps, 2),
            "width": visual.width,
            "height": visual.height,
            "scene_type": scene,
            "objects": summary["objects"],
            "has_people": summary["has_people"],
            "has_face": summary["has_face"],
            "motion_level": round(visual.motion_level, 4),
            "camera_movement": visual.camera_movement,
            "brightness": round(visual.brightness, 4),
            "contrast": round(visual.contrast, 4),
            "sharpness": round(visual.sharpness, 2),
            "quality": round(quality, 4),
        }
        await update_clip_metadata(req.clip_id, meta)
        if embedding:
            await update_clip_embedding(req.clip_id, embedding)
            get_index().add(
                req.clip_id,
                embedding,
                {
                    "project_id": req.project_id,
                    "name": req.clip_id,
                    "url": req.url,
                    "duration_sec": meta["duration_sec"],
                    "metadata": meta,
                },
            )
        return ClipFeatures(
            clip_id=req.clip_id,
            project_id=req.project_id,
            **meta,
            embedding=embedding,
        )
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


# ----------------- routes -----------------

@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="clip_analyzer")


@app.post("/analyze", response_model=ClipFeatures)
async def analyze_clip(req: AnalyzeClipRequest) -> ClipFeatures:
    try:
        return await _analyze_single(req)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("clip_analyze_failed", clip_id=req.clip_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


class BatchRequest(BaseModel):
    clips: List[AnalyzeClipRequest]


@app.post("/analyze-batch")
async def analyze_batch(req: BatchRequest) -> List[ClipFeatures]:
    """Process multiple clips concurrently."""
    sem = asyncio.Semaphore(3)

    async def _one(r: AnalyzeClipRequest) -> Optional[ClipFeatures]:
        async with sem:
            try:
                return await _analyze_single(r)
            except Exception as e:
                logger.warning("batch_item_failed", clip_id=r.clip_id, error=str(e))
                return None

    results = await asyncio.gather(*[_one(r) for r in req.clips])
    return [r for r in results if r is not None]


@app.post("/search", response_model=List[SearchResult])
async def search(req: SearchRequest) -> List[SearchResult]:
    if len(req.query_embedding) != 512:
        raise HTTPException(status_code=400, detail="query_embedding must be 512-dim")
    raw = get_index().search(req.query_embedding, k=req.k, project_id=req.project_id)
    out: List[SearchResult] = []
    for meta, score in raw:
        out.append(SearchResult(
            clip_id=meta["clip_id"],
            name=meta.get("name", meta["clip_id"]),
            url=meta.get("url", ""),
            score=round(score * 100, 2),
            duration_sec=meta.get("duration_sec", 0.0),
            metadata=meta.get("metadata", {}),
        ))
    return out


@app.post("/index/snapshot")
async def snapshot() -> dict:
    get_index().snapshot()
    return {"ok": True, "size": get_index().size}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8002"))
    uvicorn.run("clip_analyzer.main:app", host="0.0.0.0", port=port, reload=False)
