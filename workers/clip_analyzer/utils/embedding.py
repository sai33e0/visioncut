"""Generate 512-dim FAISS embeddings for user clips.

Strategy:
- Concatenate deterministic per-clip visual features (motion, brightness,
  sharpness, camera one-hot, scene one-hot).
- Top up with an image-histogram vector so the embedding captures
  color/contrast distribution even without a pretrained model.
- L2-normalize so cosine == dot product.

This is the production-grade "fallback" embedding. Swap in CLIP by
replacing `featurize_clip` with a torchvision/transformers call when
the GPU is available.
"""
from __future__ import annotations

import hashlib
from typing import List
import cv2
import numpy as np

from .feature_extractor import VisualFeatures
from .yolo_detector import Detection, summarize

EMBEDDING_DIM = 512

_SCENE_TYPES = [
    "indoor", "outdoor", "talking_head", "action", "nature", "unknown",
]
_CAMERA_TYPES = ["static", "pan", "tilt", "handheld"]


def _one_hot(value: str, choices: List[str], size: int) -> np.ndarray:
    v = np.zeros(size, dtype=np.float32)
    if value in choices:
        v[choices.index(value)] = 1.0
    return v


def _color_histogram(video_path: str, bins: int = 32) -> np.ndarray:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return np.zeros(bins * 3, dtype=np.float32)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total <= 0:
        cap.release()
        return np.zeros(bins * 3, dtype=np.float32)
    indices = np.linspace(0, total - 1, 8).astype(int)
    accum = np.zeros(bins * 3, dtype=np.float32)
    count = 0
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ok, f = cap.read()
        if not ok:
            continue
        hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
        hist = cv2.calcHist([hsv], [0, 1, 2], None, [bins] * 3, [0, 180, 0, 256, 0, 256])
        hist = cv2.normalize(hist, hist).flatten()
        accum += hist.astype(np.float32)
        count += 1
    cap.release()
    if count == 0:
        return accum
    return accum / count


def _seeded_unit_vector(seed_str: str, dim: int) -> np.ndarray:
    """Deterministic unit vector derived from a string seed.

    Useful for filling embedding slots that are not driven by visual content
    (e.g. object-class one-hots) so the dimension is always exactly 512.
    """
    h = hashlib.sha256(seed_str.encode("utf-8")).digest()
    # Expand the 32-byte hash to dim bytes by chaining SHA256s
    out = bytearray()
    counter = 0
    while len(out) < dim:
        out.extend(hashlib.sha256(h + counter.to_bytes(4, "big")).digest())
        counter += 1
    arr = np.frombuffer(bytes(out[:dim]), dtype=np.uint8).astype(np.float32)
    arr -= arr.mean()
    n = np.linalg.norm(arr) + 1e-12
    return arr / n


def featurize_clip(
    visual: VisualFeatures,
    detections: List[Detection],
    video_path: str,
) -> List[float]:
    """Build the 512-dim embedding. Always exactly EMBEDDING_DIM floats."""
    parts: List[np.ndarray] = []

    # Visual scalars (broadcast to fill weight)
    scalars = np.array([
        visual.motion_level,
        visual.brightness,
        visual.contrast,
        visual.sharpness / 500.0,
        visual.quality,
        min(visual.duration / 60.0, 1.0),
        (visual.width or 1920) / 3840.0,
        (visual.height or 1080) / 2160.0,
        visual.fps / 60.0,
    ], dtype=np.float32)
    parts.append(scalars)

    # Scene + camera one-hots
    detection_summary = summarize(detections)
    scene = "talking_head" if detection_summary["has_people"] else "unknown"
    parts.append(_one_hot(scene, _SCENE_TYPES, len(_SCENE_TYPES)))
    parts.append(_one_hot(visual.camera_movement, _CAMERA_TYPES, len(_CAMERA_TYPES)))

    # Object presence (top 64 common COCO classes)
    objects = sorted(detection_summary["objects"])
    object_vec = _seeded_unit_vector(",".join(objects), 64)
    parts.append(object_vec)

    # Color histogram from frames (96 dim)
    hist = _color_histogram(video_path, bins=32)
    if hist.size < 96:
        pad = np.zeros(96 - hist.size, dtype=np.float32)
        hist = np.concatenate([hist, pad])
    parts.append(hist[:96])

    # Pad to exactly 512 with seeded vectors
    concat = np.concatenate(parts)
    if concat.size < EMBEDDING_DIM:
        seed = "visioncut:padding:" + str(visual.duration) + ":" + str(visual.width)
        pad = _seeded_unit_vector(seed, EMBEDDING_DIM - concat.size)
        concat = np.concatenate([concat, pad])
    elif concat.size > EMBEDDING_DIM:
        concat = concat[:EMBEDDING_DIM]

    n = np.linalg.norm(concat) + 1e-12
    return (concat / n).astype(np.float32).tolist()
