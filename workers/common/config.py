"""Shared configuration loader for all workers."""
from __future__ import annotations

import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Core
    api_url: str = "http://localhost:3001"
    worker_token: str = "dev-worker-token"

    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:54322/postgres"

    # Queue
    redis_url: str = "redis://localhost:6379"

    # AI providers
    gemini_api_key: str = ""
    openai_api_key: str = ""
    whisper_model: str = "medium"

    # Storage
    storage_root: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage"))
    storage_public_base: str = "http://localhost:3001/media"

    # Render
    ffmpeg_path: str = "ffmpeg"
    ffprobe_path: str = "ffprobe"
    render_use_gpu: bool = False
    render_preset: str = "veryfast"
    render_crf: int = 23

    # GPU acceleration
    use_gpu_opencv: bool = False       # OpenCV CUDA kernels
    use_gpu_whisper: bool = False      # faster-whisper on CUDA
    use_gpu_yolo: bool = False         # ultralytics on CUDA
    use_gpu_faiss: bool = False        # faiss-gpu
    cuda_device: int = 0               # which GPU index

    # Logging
    log_level: str = "info"

    # Sentry
    sentry_dsn: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
