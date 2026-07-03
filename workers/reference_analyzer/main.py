"""Reference analyzer worker.

HTTP entry point: POST /analyze -> visual + audio + gemini -> Blueprint
"""
from __future__ import annotations

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
from common.db import Database, save_blueprint
from common.logging import configure_logging, get_logger, log_gpu_profile
from common.models import HealthResponse

from .models.schema import AnalyzeRequest, AnalyzeResponse, BlueprintModel
from .utils.audio_analyzer import analyze_audio, audio_to_blueprint_hints
from .utils.gemini_client import generate_blueprint
from .utils.visual_analyzer import analyze_visual, visual_to_blueprint_hints


configure_logging()
logger = get_logger("reference_analyzer")
app = FastAPI(title="VisionCut Reference Analyzer", version="1.0.0")

_api_client: Optional[APIClient] = None


@app.on_event("startup")
async def _startup() -> None:
    global _api_client
    await Database.init()
    _api_client = APIClient()
    if get_settings().sentry_dsn:
        import sentry_sdk
        sentry_sdk.init(dsn=get_settings().sentry_dsn, traces_sample_rate=0.1)
    log_gpu_profile("reference_analyzer")


@app.on_event("shutdown")
async def _shutdown() -> None:
    if _api_client is not None:
        await _api_client.aclose()
    await Database.close()


# ----------------- Helpers -----------------

async def _download_to_temp(url: str, work_dir: str) -> str:
    """Pull a remote file into work_dir. Falls back to local-path copy for tests."""
    s = get_settings()
    if url.startswith("/") or url.startswith(s.storage_root):
        local = url
        if not os.path.exists(local):
            raise FileNotFoundError(local)
        out = os.path.join(work_dir, "reference.mp4")
        shutil.copy(local, out)
        return out

    out = os.path.join(work_dir, "reference.mp4")
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, read=600.0)) as client:
        async with client.stream("GET", url) as r:
            r.raise_for_status()
            with open(out, "wb") as f:
                async for chunk in r.aiter_bytes():
                    f.write(chunk)
    return out


# ----------------- Routes -----------------

@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="reference_analyzer")


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    """Full reference analysis pipeline."""
    work_dir = os.path.join(get_settings().storage_root, "tmp", str(uuid.uuid4()))
    os.makedirs(work_dir, exist_ok=True)
    try:
        await _api_client.progress(req.project_id, "Downloading reference video", 5) if _api_client else None
        video_path = await _download_to_temp(req.reference_url, work_dir)
        logger.info("reference_downloaded", path=video_path, project_id=req.project_id)

        await _api_client.progress(req.project_id, "Analyzing visuals", 15) if _api_client else None
        visual = analyze_visual(video_path)
        v_hints = visual_to_blueprint_hints(visual)
        logger.info("visual_features", **v_hints)

        await _api_client.progress(req.project_id, "Analyzing audio", 30) if _api_client else None
        audio = analyze_audio(video_path, work_dir)
        a_hints = audio_to_blueprint_hints(audio)
        logger.info("audio_features", **a_hints)

        await _api_client.progress(req.project_id, "Synthesizing blueprint", 40) if _api_client else None
        blueprint: BlueprintModel = generate_blueprint(video_path, v_hints, a_hints)

        await _api_client.progress(req.project_id, "Saving blueprint", 45) if _api_client else None
        await save_blueprint(req.project_id, blueprint.to_wire())
        if _api_client is not None:
            await _api_client.blueprint(req.project_id, blueprint.to_wire())
            await _api_client.progress(req.project_id, "Blueprint ready", 50)

        return AnalyzeResponse(project_id=req.project_id, blueprint=blueprint, cached=False)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=f"reference not found: {e}")
    except Exception as e:
        logger.exception("analyze_failed", project_id=req.project_id, error=str(e))
        if _api_client is not None:
            await _api_client.progress(req.project_id, f"Analysis failed: {e}", -1)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


# Convenience: blueprint-only endpoint for direct integration tests
class BlueprintOnlyRequest(BaseModel):
    visual: dict
    audio: dict


@app.post("/blueprint/from-hints")
async def blueprint_from_hints(req: BlueprintOnlyRequest) -> dict:
    """Skip video processing — useful for tests and the style engine."""
    parsed = generate_blueprint.__wrapped__ if hasattr(generate_blueprint, "__wrapped__") else None  # type: ignore
    # Reuse deterministic path; if Gemini is configured it will be tried first.
    bp = generate_blueprint("__none__", req.visual, req.audio)
    return bp.to_wire()


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8001"))
    uvicorn.run("reference_analyzer.main:app", host="0.0.0.0", port=port, reload=False)
