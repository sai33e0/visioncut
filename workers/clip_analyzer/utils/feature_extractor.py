"""Per-clip feature extraction: motion, brightness, sharpness, camera, quality.

Pure OpenCV / numpy — no model downloads required for unit tests.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Tuple
import cv2
import numpy as np

from common.frames import probe_duration


@dataclass
class VisualFeatures:
    duration: float = 0.0
    fps: float = 30.0
    width: int = 0
    height: int = 0
    motion_level: float = 0.0
    camera_movement: str = "static"
    brightness: float = 0.0
    contrast: float = 0.0
    sharpness: float = 0.0
    quality: float = 0.0


_SAMPLE_FRAMES = 32


def _sample_frames(video_path: str, n: int) -> List[np.ndarray]:
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
        ok, f = cap.read()
        if ok:
            frames.append(f)
    cap.release()
    return frames


def _optical_flow_stats(prev_gray: np.ndarray, gray: np.ndarray) -> Tuple[float, float, float]:
    flow = cv2.calcOpticalFlowFarneback(
        prev_gray, gray, None, 0.5, 3, 15, 3, 5, 1.2, 0
    )
    mag = np.sqrt(flow[..., 0] ** 2 + flow[..., 1] ** 2)
    return float(mag.mean()), float(np.median(flow[..., 0])), float(np.median(flow[..., 1]))


def _camera_class(motion: float, dx: float, dy: float) -> str:
    if motion < 1.5:
        return "static"
    if abs(dx) > 1.0 and abs(dx) > abs(dy) * 1.5:
        return "pan"
    if abs(dy) > 1.0 and abs(dy) > abs(dx) * 1.5:
        return "tilt"
    if motion > 6.0:
        return "handheld"
    return "static"


def extract_visual_features(video_path: str) -> VisualFeatures:
    feat = VisualFeatures()
    try:
        feat.duration = probe_duration(video_path)
    except Exception:
        feat.duration = 0.0

    cap = cv2.VideoCapture(video_path)
    if cap.isOpened():
        feat.fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        feat.width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        feat.height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()

    frames = _sample_frames(video_path, _SAMPLE_FRAMES)
    if not frames:
        return feat

    # Brightness/contrast/sharpness aggregates
    grays = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in frames]
    feat.brightness = float(np.mean([g.mean() for g in grays]) / 255.0)
    feat.contrast = float(np.mean([g.std() for g in grays]) / 128.0)
    feat.sharpness = float(np.mean([
        cv2.Laplacian(g, cv2.CV_64F).var() for g in grays
    ]))
    # quality 0-1: weighted combination
    feat.quality = float(np.clip(
        0.5 * feat.sharpness / 500.0
        + 0.3 * feat.contrast
        + 0.2 * (1.0 - abs(feat.brightness - 0.5) * 2),  # prefer mid-bright
        0.0, 1.0,
    ))

    # Motion + camera
    if len(grays) >= 2:
        small = [cv2.resize(g, (320, 180)) for g in grays]
        motions, dxs, dys = [], [], []
        for a, b in zip(small, small[1:]):
            mag, dx, dy = _optical_flow_stats(a, b)
            motions.append(mag)
            dxs.append(dx)
            dys.append(dy)
        feat.motion_level = float(np.clip(np.mean(motions) / 10.0, 0.0, 1.0))
        feat.camera_movement = _camera_class(
            float(np.mean(motions)),
            float(np.mean(dxs)),
            float(np.mean(dys)),
        )
    return feat
