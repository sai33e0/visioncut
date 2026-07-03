"""OpenCV-based visual analysis for the reference video.

Produces:
- cut_timestamps  : seconds where hard cuts occur
- motion_level    : float 0-1 (overall)
- camera_movement : pan / tilt / handheld / static
- effects         : list of detected visual effect names
- color_grade     : warm/cool/neutral heuristic
- duration        : total video length in seconds

The output is the "ground-truth" signal the Gemini prompt only augments.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Tuple
import cv2
import numpy as np

from common.frames import probe_duration, shot_segments


@dataclass
class VisualFeatures:
    duration: float = 0.0
    fps: float = 30.0
    cut_timestamps: List[float] = field(default_factory=list)
    motion_level: float = 0.0
    camera_movement: str = "static"
    color_grade: str = "neutral"
    effects: List[str] = field(default_factory=list)
    avg_brightness: float = 0.0
    contrast: float = 0.0


_CUT_THRESHOLD = 30.0
_SAMPLE_FRAMES = 64


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


def _detect_motion(prev_gray: np.ndarray, gray: np.ndarray) -> Tuple[float, float, float]:
    """Returns (mean_flow, pan_x, pan_y) estimated by optical flow."""
    flow = cv2.calcOpticalFlowFarneback(
        prev_gray, gray, None, 0.5, 3, 15, 3, 5, 1.2, 0
    )
    fx = flow[..., 0]
    fy = flow[..., 1]
    mag = np.sqrt(fx * fx + fy * fy)
    return float(mag.mean()), float(np.median(fx)), float(np.median(fy))


def _classify_camera(mean_dx: float, mean_dy: float, motion: float) -> str:
    if motion < 1.5:
        return "static"
    if abs(mean_dx) > 1.2 and abs(mean_dx) > abs(mean_dy) * 1.5:
        return "pan"
    if abs(mean_dy) > 1.2 and abs(mean_dy) > abs(mean_dx) * 1.5:
        return "tilt"
    if motion > 6.0:
        return "handheld"
    return "static"


def _color_grade(frames: List[np.ndarray]) -> Tuple[str, float, float]:
    if not frames:
        return "neutral", 0.0, 0.0
    means = []
    contrasts = []
    for f in frames:
        hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
        means.append(hsv.mean(axis=(0, 1)))
        gray = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        contrasts.append(float(gray.std()))
    avg = np.mean(means, axis=0)
    h_mean, s_mean, _v_mean = avg
    brightness = float(_v_mean / 255.0)
    contrast = float(np.mean(contrasts) / 128.0)
    if h_mean < 15 or h_mean > 165:
        grade = "warm"  # red-ish hues dominate
    elif 80 < h_mean < 130:
        grade = "cool"  # green/blue dominate
    elif contrast < 0.45:
        grade = "muted"
    elif s_mean > 140 and contrast > 0.6:
        grade = "vibrant"
    else:
        grade = "neutral"
    return grade, brightness, contrast


def _detect_effects(frames: List[np.ndarray]) -> List[str]:
    """Cheap effect heuristics from frame sequence.

    Real models would use a CNN; for the prototype we use signal-based proxies.
    """
    effects: set = set()
    if len(frames) < 4:
        return []
    center = frames[len(frames) // 2]
    h, w = center.shape[:2]
    # zoom: center frame is significantly more cropped than edge frame
    edge = frames[0]
    center_var = float(cv2.Laplacian(cv2.cvtColor(center, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var())
    edge_var = float(cv2.Laplacian(cv2.cvtColor(edge, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var())
    if center_var > edge_var * 1.4:
        effects.add("zoom")
    # flash: a near-white frame
    bright = [float(f.mean()) for f in frames]
    if max(bright) > 235:
        effects.add("flash")
    # blur: low-variance frame
    vars_ = [float(cv2.Laplacian(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()) for f in frames]
    if min(vars_) < 25:
        effects.add("blur")
    return sorted(effects)


def analyze_visual(video_path: str) -> VisualFeatures:
    """Top-level entry: produce the deterministic feature vector for a video."""
    feat = VisualFeatures()
    try:
        feat.duration = probe_duration(video_path)
    except Exception:
        feat.duration = 0.0

    cap = cv2.VideoCapture(video_path)
    if cap.isOpened():
        feat.fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    cap.release()

    # Cuts via frame differencing (workers.common.frames.shot_segments)
    segments = shot_segments(video_path, threshold=_CUT_THRESHOLD)
    for start, end in segments:
        feat.cut_timestamps.append(round(end, 3))
    # dedupe consecutive cuts < 0.2s apart
    deduped: List[float] = []
    for t in feat.cut_timestamps:
        if not deduped or t - deduped[-1] > 0.2:
            deduped.append(t)
    feat.cut_timestamps = deduped

    # Motion & camera from sampled frames
    frames = _sample_frames(video_path, _SAMPLE_FRAMES)
    if len(frames) >= 2:
        motions = []
        dxs, dys = [], []
        for a, b in zip(frames, frames[1:]):
            ga = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY)
            gb = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)
            ga = cv2.resize(ga, (320, 180))
            gb = cv2.resize(gb, (320, 180))
            mag, dx, dy = _detect_motion(ga, gb)
            motions.append(mag)
            dxs.append(dx)
            dys.append(dy)
        feat.motion_level = float(np.clip(np.mean(motions) / 10.0, 0.0, 1.0))
        feat.camera_movement = _classify_camera(float(np.mean(dxs)), float(np.mean(dys)), float(np.mean(motions)))

    # Color & effects
    grade, brightness, contrast = _color_grade(frames)
    feat.color_grade = grade
    feat.avg_brightness = brightness
    feat.contrast = contrast
    feat.effects = _detect_effects(frames)
    return feat


def visual_to_blueprint_hints(features: VisualFeatures) -> dict:
    """Convert VisualFeatures to partial BlueprintModel dict for Gemini to merge."""
    return {
        "duration": features.duration,
        "total_cuts": max(1, len(features.cut_timestamps)),
        "avg_clip_duration": round(
            features.duration / max(1, len(features.cut_timestamps) + 1), 3
        ),
        "camera_movement": features.camera_movement,
        "motion_level": round(features.motion_level, 3),
        "color_grade_hint": features.color_grade,
        "visual_effects": features.effects,
        "cut_timestamps": features.cut_timestamps[:50],
    }
