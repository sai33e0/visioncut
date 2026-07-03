"""Update user preference weights from thumbs-up/down feedback.

Algorithm:
- For each feedback, identify which features (motion, scene, camera, etc.)
  the selected clip scored highly on.
- For thumbs-up: nudge each "high-scoring" feature up, low-scoring features down.
- For thumbs-down: opposite direction.
- Step size decays with total feedback (so a 1000-feedback user is harder to
  drift than a 10-feedback user).
- Weights are renormalized after each update so the scorer output stays in 0-100.
"""
from __future__ import annotations

import math
from typing import Dict, List, Optional

from clip_analyzer.utils.faiss_index import get_index

DEFAULT_WEIGHTS = {
    "faiss_similarity": 0.30,
    "motion_match": 0.25,
    "duration_match": 0.15,
    "scene_type_match": 0.15,
    "camera_match": 0.10,
    "quality_score": 0.05,
}

FEATURE_TO_KEY = {
    "embedding_similarity": "faiss_similarity",
    "motion": "motion_match",
    "duration": "duration_match",
    "scene": "scene_type_match",
    "camera_movement": "camera_match",
    "visual_quality": "quality_score",
}


def _decay_step(total_feedback: int) -> float:
    """Smaller step as feedback accumulates."""
    return 0.05 / max(1.0, math.log2(2 + total_feedback))


def _renormalize(weights: Dict[str, float]) -> Dict[str, float]:
    s = sum(max(0.01, v) for v in weights.values())
    return {k: max(0.01, v) / s for k, v in weights.items()}


def aggregate_updates(
    current_weights: Dict[str, float],
    feedback: List[dict],
    total_feedback_before: int,
) -> Dict[str, float]:
    """Pure function: given current weights + a batch of feedback, return new weights.

    `feedback` items:
      {rating: +1|-1, matched: [feature_name, ...], not_matched: [...]}
    """
    weights = {**DEFAULT_WEIGHTS, **current_weights}
    step = _decay_step(total_feedback_before)
    for fb in feedback:
        sign = 1 if fb.get("rating") == 1 else -1
        for feat in fb.get("matched", []) or []:
            key = FEATURE_TO_KEY.get(feat)
            if key:
                weights[key] = max(0.01, weights[key] + sign * step)
        for feat in fb.get("not_matched", []) or []:
            key = FEATURE_TO_KEY.get(feat)
            if key:
                weights[key] = max(0.01, weights[key] - sign * step)
    return _renormalize(weights)


def estimate_accuracy(feedback: List[dict]) -> float:
    """Crude personalization accuracy estimate.

    In production, you'd measure: of N most recent feedback items, what % of
    selections the user kept vs. swapped out. We approximate that by assuming
    thumbs-up = "selection kept".
    """
    if not feedback:
        return 0.0
    up = sum(1 for f in feedback if f.get("rating") == 1)
    return round(up / max(1, len(feedback)) * 100, 2)


def personalized_query(
    query: List[float],
    weights: Dict[str, float],
) -> List[float]:
    """Apply weights as a diagonal scaling of the query vector.

    For L2-normalized embeddings this isn't a perfect personalization, but
    it shifts the cosine geometry in the direction the user prefers.
    """
    if len(weights) != 6:
        return query
    faiss_w = weights.get("faiss_similarity", DEFAULT_WEIGHTS["faiss_similarity"])
    boost = 1.0 + 4.0 * (faiss_w - DEFAULT_WEIGHTS["faiss_similarity"])
    return [v * boost for v in query]
