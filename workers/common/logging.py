"""Structured logging shared by every worker."""
from __future__ import annotations

import logging
import sys
from typing import Iterable

import structlog

from .gpu import should_use_gpu


def configure_logging(level: str = "info") -> None:
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, level.upper(), logging.INFO),
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.dev.ConsoleRenderer(colors=False),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, level.upper(), logging.INFO)
        ),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)


_KINDS: tuple[str, ...] = ("ffmpeg", "opencv", "whisper", "yolo", "faiss")


def log_gpu_profile(service: str, kinds: Iterable[str] = _KINDS) -> None:
    """Print a single line summarizing the GPU profile of this worker.

    Example:
        gpu_profile ffmpeg=gpu opencv=cpu whisper=cpu yolo=cpu faiss=cpu
    """
    logger = get_logger("gpu_profile")
    parts = []
    for kind in kinds:
        try:
            on, reason = should_use_gpu(kind)
        except Exception as e:  # pragma: no cover - defensive
            parts.append(f"{kind}=error({e})")
            continue
        parts.append(f"{kind}={'gpu' if on else 'cpu'}")
    line = f"gpu_profile service={service} " + " ".join(parts)
    logger.info(line)
