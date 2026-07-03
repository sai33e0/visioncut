"""Frame extraction utilities shared across workers."""
from __future__ import annotations

import os
import tempfile
import subprocess
from pathlib import Path
from typing import List, Tuple

import cv2  # type: ignore
import numpy as np

from .config import get_settings
from .gpu import should_use_gpu


def probe_duration(video_path: str) -> float:
    """Return video duration in seconds using ffprobe."""
    s = get_settings()
    out = subprocess.check_output(
        [
            s.ffprobe_path,
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            video_path,
        ],
        text=True,
    ).strip()
    return float(out)


def extract_keyframes(video_path: str, n: int = 8) -> List[np.ndarray]:
    """Uniformly sample n keyframes from a video as BGR numpy arrays.

    Uses NVDEC via ffmpeg when the input is a hardware-friendly codec, then
    decodes through OpenCV's normal VideoCapture. For N=8 the savings are
    marginal so we keep it simple.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total <= 0:
        cap.release()
        return []
    indices = np.linspace(0, total - 1, n).astype(int)
    frames: List[np.ndarray] = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ok, frame = cap.read()
        if ok:
            frames.append(frame)
    cap.release()
    return frames


def save_thumbnails(frames: List[np.ndarray], out_dir: str, base_name: str = "frame") -> List[str]:
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    paths: List[str] = []
    for i, f in enumerate(frames):
        p = os.path.join(out_dir, f"{base_name}_{i:03d}.jpg")
        cv2.imwrite(p, f, [cv2.IMWRITE_JPEG_QUALITY, 85])
        paths.append(p)
    return paths


def extract_audio(video_path: str, out_dir: str) -> str:
    """Extract mono 16kHz wav via ffmpeg for Whisper / librosa."""
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    out_path = os.path.join(out_dir, "audio.wav")
    s = get_settings()
    cmd = [
        s.ffmpeg_path, "-y", "-i", video_path,
        "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", out_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return out_path


def _resize_gray(gray: np.ndarray, size: Tuple[int, int]) -> np.ndarray:
    """GPU-accelerated resize when OpenCV CUDA is available."""
    use_gpu, _ = should_use_gpu("opencv")
    if use_gpu:
        try:
            gpu_src = cv2.cuda_GpuMat()
            gpu_src.upload(gray)
            gpu_dst = cv2.cuda.resize(gpu_src, size, interpolation=cv2.INTER_AREA)
            return gpu_dst.download()
        except Exception:
            pass
    return cv2.resize(gray, size)


def _absdiff_mean(a: np.ndarray, b: np.ndarray) -> float:
    """Mean absolute difference. GPU fast-path via cv2.cuda.absdiff."""
    use_gpu, _ = should_use_gpu("opencv")
    if use_gpu:
        try:
            ga = cv2.cuda_GpuMat(); ga.upload(a)
            gb = cv2.cuda_GpuMat(); gb.upload(b)
            diff = cv2.cuda.absdiff(ga, gb)
            arr = diff.download()
            return float(np.mean(arr))
        except Exception:
            pass
    return float(np.mean(cv2.absdiff(a, b)))


def shot_segments(video_path: str, threshold: float = 30.0) -> List[Tuple[float, float]]:
    """Detect hard cuts via inter-frame difference. Returns (start, end) in seconds."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    prev = None
    segments: List[Tuple[float, float]] = []
    start = 0.0
    idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = _resize_gray(gray, (320, 180))
        if prev is not None:
            diff = _absdiff_mean(gray, prev)
            if diff > threshold:
                t = idx / fps
                segments.append((start, t))
                start = t
        prev = gray
        idx += 1
    cap.release()
    end = idx / fps
    segments.append((start, end))
    return segments

