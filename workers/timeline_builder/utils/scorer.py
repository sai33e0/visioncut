"""Hybrid scoring for matching a reference shot to a user clip.

Combines:
- FAISS cosine similarity (30%)
- motion match       (25%)
- duration match     (15%)
- scene-type match   (15%)
- camera match       (10%)
- quality            (5%)

User preference weights (from feedback_engine) can override the defaults.
"""
from __future__ import annotations

from typing import Optional

from common.embeddings import l2_normalize
import numpy as np

DEFAULT_WEIGHTS = {
    "faiss_similarity": 0.30,
    "motion_match": 0.25,
    "duration_match": 0.15,
    "scene_type_match": 0.15,
    "camera_match": 0.10,
    "quality_score": 0.05,
}


def _clamp01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))


def _motion_score(target: float, candidate: float) -> float:
    if not candidate:
        return 0.0
    return _clamp01(1.0 - abs(target - candidate))


def _duration_score(target: float, candidate: float) -> float:
    if not target or not candidate:
        return 0.0
    ratio = min(candidate, target) / max(candidate, target)
    return _clamp01(ratio)


def _scene_score(target: str, candidate_meta: dict) -> float:
    if not target or target == "unknown":
        return 0.6
    cand = candidate_meta.get("scene_type", "unknown")
    if cand == target:
        return 1.0
    if cand == "unknown":
        return 0.4
    return 0.2


def _camera_score(target: str, candidate: str) -> float:
    if not target or target == "static":
        return 0.7
    return 1.0 if target == candidate else 0.4


def _quality_score(candidate_meta: dict) -> float:
    return _clamp01(float(candidate_meta.get("quality", 0.0) or 0.0))


def score(
    faiss_sim: float,
    target_motion: float,
    target_duration: float,
    target_scene: str,
    target_camera: str,
    candidate: dict,
    weights: Optional[dict] = None,
) -> float:
    """Return a 0-100 score for the candidate against a target shot."""
    w = {**DEFAULT_WEIGHTS, **(weights or {})}
    # Normalize the weights so the sum is 1
    s = sum(w.values()) or 1.0
    w = {k: v / s for k, v in w.items()}

    meta = candidate.get("metadata") or {}
    parts = {
        "faiss_similarity": _clamp01(faiss_sim),
        "motion_match": _motion_score(target_motion, float(meta.get("motion_level", 0.0))),
        "duration_match": _duration_score(target_duration, float(candidate.get("duration_sec", 0.0))),
        "scene_type_match": _scene_score(target_scene, meta),
        "camera_match": _camera_score(target_camera, meta.get("camera_movement", "static")),
        "quality_score": _quality_score(meta),
    }
    return sum(parts[k] * w[k] for k in w) * 100.0, parts


def build_reason(parts: dict, candidate: dict) -> dict:
    matched = []
    not_matched = []
    feature_to_label = {
        "faiss_similarity": "embedding_similarity",
        "motion_match": "motion",
        "duration_match": "duration",
        "scene_type_match": "scene",
        "camera_match": "camera_movement",
        "quality_score": "visual_quality",
    }
    for k, v in parts.items():
        if v >= 0.6:
            matched.append(feature_to_label[k])
        elif v < 0.4:
            not_matched.append(feature_to_label[k])
    return {
        "matched": matched,
        "not_matched": not_matched,
        "raw_scores": {k: round(v, 3) for k, v in parts.items()},
        "duration_sec": candidate.get("duration_sec", 0.0),
        "scene_type": (candidate.get("metadata") or {}).get("scene_type", "unknown"),
        "camera_movement": (candidate.get("metadata") or {}).get("camera_movement", "static"),
    }


def swap_impact(rank: int, score: float) -> str:
    """How disruptive is swapping to this alternative."""
    if rank == 0 and score >= 80:
        return "low"
    if score >= 70:
        return "medium"
    return "high"
