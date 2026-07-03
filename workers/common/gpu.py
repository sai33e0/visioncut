"""GPU detection + light wrappers.

When the host has a CUDA-capable GPU (RTX 3050 in the dev box) we want to:
- OpenCV: use cv2.cuda when available for resize / absdiff
- Whisper: prefer faster-whisper (CTranslate2) on CUDA over openai-whisper
- YOLO: ultralytics auto-detects CUDA when torch.cuda.is_available()
- FAISS: faiss-gpu when importable, else faiss-cpu
- FFmpeg: NVENC encoder is selected by the renderer

Each flag can be force-on/off via env. The default is "auto-detect" and only
turn GPU on if the relevant lib has CUDA compiled in.
"""
from __future__ import annotations

import os
import shutil
import subprocess
from functools import lru_cache
from typing import Tuple

from .config import get_settings
from .logging import get_logger

logger = get_logger("common.gpu")


@lru_cache(maxsize=1)
def nvidia_smi_available() -> bool:
    """True if `nvidia-smi` is on PATH and lists at least one GPU."""
    if not shutil.which("nvidia-smi"):
        return False
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "-L"], text=True, stderr=subprocess.DEVNULL, timeout=2
        )
        return "GPU" in out or "RTX" in out or "GeForce" in out
    except Exception:
        return False


@lru_cache(maxsize=1)
def opencv_cuda_available() -> bool:
    try:
        import cv2  # type: ignore
        return bool(getattr(cv2, "cuda", None)) and cv2.cuda.getCudaEnabledDeviceCount() > 0
    except Exception:
        return False


@lru_cache(maxsize=1)
def torch_cuda_available() -> bool:
    try:
        import torch  # type: ignore
        return bool(torch.cuda.is_available())
    except Exception:
        return False


@lru_cache(maxsize=1)
def faiss_gpu_available() -> bool:
    try:
        import faiss  # type: ignore
        # faiss-gpu exposes StandardGpuResources; faiss-cpu does not
        return hasattr(faiss, "StandardGpuResources")
    except Exception:
        return False


@lru_cache(maxsize=1)
def ffmpeg_nvenc_available() -> bool:
    try:
        out = subprocess.check_output(
            ["ffmpeg", "-hide_banner", "-encoders"], text=True, stderr=subprocess.DEVNULL, timeout=5
        )
        return "h264_nvenc" in out
    except Exception:
        return False


def should_use_gpu(kind: str) -> Tuple[bool, str]:
    """Return (use_gpu, reason). kind ∈ {opencv, whisper, yolo, faiss, ffmpeg}.

    Honors env flag overrides but defaults to "use if available".
    """
    s = get_settings()
    if kind == "opencv":
        forced = s.use_gpu_opencv
        ok = opencv_cuda_available()
        if forced and not ok:
            return False, "USE_GPU_OPENCV=true but OpenCV CUDA unavailable"
        if not forced and not ok:
            return False, "no_opencv_cuda"
        if not nvidia_smi_available():
            return False, "no_nvidia_smi"
        return True, "opencv_cuda"
    if kind == "whisper":
        forced = s.use_gpu_whisper
        ok = torch_cuda_available()
        if forced and not ok:
            return False, "USE_GPU_WHISPER=true but torch CUDA unavailable"
        if not forced and not ok:
            return False, "no_torch_cuda"
        if not nvidia_smi_available():
            return False, "no_nvidia_smi"
        return True, "faster_whisper_cuda"
    if kind == "yolo":
        forced = s.use_gpu_yolo
        ok = torch_cuda_available()
        if forced and not ok:
            return False, "USE_GPU_YOLO=true but torch CUDA unavailable"
        if not forced and not ok:
            return False, "no_torch_cuda"
        if not nvidia_smi_available():
            return False, "no_nvidia_smi"
        return True, "ultralytics_cuda"
    if kind == "faiss":
        forced = s.use_gpu_faiss
        ok = faiss_gpu_available()
        if forced and not ok:
            return False, "USE_GPU_FAISS=true but faiss-gpu not installed"
        if not forced and not ok:
            return False, "faiss_cpu"
        if not nvidia_smi_available():
            return False, "no_nvidia_smi"
        return True, "faiss_gpu"
    if kind == "ffmpeg":
        forced = s.render_use_gpu
        ok = ffmpeg_nvenc_available()
        if forced and not ok:
            return False, "RENDER_USE_GPU=true but h264_nvenc missing"
        if not forced and not ok:
            return False, "libx264"
        if not nvidia_smi_available():
            return False, "no_nvidia_smi"
        return True, "h264_nvenc"
    return False, "unknown_kind"


def device_string(kind: str) -> str:
    """Return a string suitable for `device=` arg of ultralytics/whisper/etc."""
    use, _ = should_use_gpu(kind)
    if not use:
        return "cpu"
    s = get_settings()
    return f"cuda:{s.cuda_device}"
