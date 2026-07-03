"""HTTP client to talk back to the NestJS API."""
from __future__ import annotations

import os
from typing import Any, Optional
import httpx

from .config import get_settings


class APIError(RuntimeError):
    pass


class APIClient:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._client = httpx.AsyncClient(
            base_url=self._settings.api_url,
            timeout=httpx.Timeout(60.0, read=600.0),
            headers={"X-Worker-Token": self._settings.worker_token},
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def progress(self, project_id: str, step: str, percent: int, detail: Optional[str] = None) -> None:
        await self._post("/api/analysis/internal/progress", {
            "projectId": project_id, "step": step, "percent": percent, "detail": detail,
        })

    async def log(self, project_id: str, message: str, level: str = "info") -> None:
        # No dedicated log endpoint yet — log to stdout only.
        import structlog
        structlog.get_logger("worker").info("log", project_id=project_id, level=level, message=message)

    async def blueprint(self, project_id: str, blueprint: dict) -> None:
        await self._post("/api/analysis/internal/blueprint", {"projectId": project_id, "blueprint": blueprint})

    async def timeline(self, project_id: str, timeline: dict) -> None:
        await self._post("/api/analysis/internal/timeline", {"projectId": project_id, "timeline": timeline})

    async def render_complete(self, project_id: str, key: str, quality_score: float) -> None:
        # Hits an internal endpoint in the render service.
        await self._post("/api/render/internal/complete", {
            "projectId": project_id, "key": key, "qualityScore": quality_score,
        })

    async def render_failed(self, project_id: str, error: str) -> None:
        await self._post("/api/render/internal/failed", {"projectId": project_id, "error": error})

    async def _post(self, path: str, payload: dict) -> dict:
        try:
            r = await self._client.post(path, json=payload)
            r.raise_for_status()
            return r.json() if r.content else {}
        except httpx.HTTPError as e:
            raise APIError(f"{path} failed: {e}") from e
