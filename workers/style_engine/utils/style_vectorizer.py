"""Convert a blueprint to/from a 256-dim style vector and back.

Layout (concatenated in this order):
- 16 dim  : one-hot content_type
- 1 dim   : pace (mapped 0-1 from very_slow..very_fast)
- 1 dim   : avg_clip_duration / 10 (clipped 0-1)
- 1 dim   : total_cuts / 200 (clipped 0-1)
- 8 dim   : multi-hot transition types
- 8 dim   : multi-hot visual_effects
- 1 dim   : color_grade one-hot index / max
- 1 dim   : has_music
- 1 dim   : has_voiceover
- 1 dim   : beat_sync
- 1 dim   : tempo_bpm / 200
- 1 dim   : confidence
- remaining: hash-padded to reach 256

We always emit exactly 256 floats, l2-normalized.
"""
from __future__ import annotations

import hashlib
from typing import List
import numpy as np


CONTENT_TYPES = [
    "travel_reel", "vlog", "documentary", "podcast", "educational",
    "gaming", "motivational", "wedding", "fitness", "advertisement",
    "movie_edit", "youtube", "general",
]
PACE_TO_FLOAT = {
    "very_slow": 0.0, "slow": 0.25, "medium": 0.5, "fast": 0.75, "very_fast": 1.0,
}
TRANSITION_TYPES = ["cut", "fade", "zoom", "flash", "blur", "slide", "wipe", "spin", "shake", "shake_2"]
VISUAL_EFFECTS = ["zoom", "flash", "blur", "shake", "color_shift", "lens_flare", "vignette", "slow_motion"]
COLOR_GRADES = ["warm", "cool", "neutral", "cinematic", "muted", "vibrant"]

DIM = 256


def _one_hot(value, choices, size):
    v = np.zeros(size, dtype=np.float32)
    if value in choices:
        v[choices.index(value)] = 1.0
    return v


def _multi_hot(values, choices, size):
    v = np.zeros(size, dtype=np.float32)
    for val in values or []:
        if val in choices:
            v[choices.index(val)] = 1.0
    return v


def _seeded_pad(seed: str, n: int) -> np.ndarray:
    h = hashlib.sha256(seed.encode("utf-8")).digest()
    out = bytearray()
    counter = 0
    while len(out) < n:
        out.extend(hashlib.sha256(h + counter.to_bytes(4, "big")).digest())
        counter += 1
    arr = np.frombuffer(bytes(out[:n]), dtype=np.uint8).astype(np.float32)
    arr -= arr.mean()
    nrm = np.linalg.norm(arr) + 1e-12
    return arr / nrm


def vectorize(blueprint: dict) -> List[float]:
    audio = blueprint.get("audio", {}) or {}
    transitions = blueprint.get("transitions", []) or []
    transition_types = sorted({t.get("type") for t in transitions if t.get("type")})
    effects = blueprint.get("visual_effects", []) or []
    grade = blueprint.get("color_grade", "neutral")

    parts = [
        _one_hot(blueprint.get("content_type", "general"), CONTENT_TYPES, len(CONTENT_TYPES)),
        np.array([PACE_TO_FLOAT.get(blueprint.get("pace", "medium"), 0.5)], dtype=np.float32),
        np.array([min(1.0, float(blueprint.get("avg_clip_duration", 0.0)) / 10.0)], dtype=np.float32),
        np.array([min(1.0, float(blueprint.get("total_cuts", 0)) / 200.0)], dtype=np.float32),
        _multi_hot(transition_types, TRANSITION_TYPES, len(TRANSITION_TYPES)),
        _multi_hot(effects, VISUAL_EFFECTS, len(VISUAL_EFFECTS)),
        np.array([COLOR_GRADES.index(grade) / max(1, len(COLOR_GRADES) - 1) if grade in COLOR_GRADES else 0.5], dtype=np.float32),
        np.array([1.0 if audio.get("has_music") else 0.0], dtype=np.float32),
        np.array([1.0 if audio.get("has_voiceover") else 0.0], dtype=np.float32),
        np.array([1.0 if audio.get("beat_sync") else 0.0], dtype=np.float32),
        np.array([min(1.0, float(audio.get("tempo_bpm", 0) or 0) / 200.0)], dtype=np.float32),
        np.array([float(blueprint.get("confidence", 0.0))], dtype=np.float32),
    ]
    concat = np.concatenate(parts)
    if concat.size < DIM:
        seed = "visioncut:style:" + str(blueprint.get("content_type", "general"))
        concat = np.concatenate([concat, _seeded_pad(seed, DIM - concat.size)])
    elif concat.size > DIM:
        concat = concat[:DIM]
    n = np.linalg.norm(concat) + 1e-12
    return (concat / n).astype(np.float32).tolist()


def blueprint_template(blueprint: dict) -> dict:
    """Return the subset of a blueprint that's reusable as a template.

    Strips project-specific fields (timestamps, exact cut counts) and keeps
    the structural style.
    """
    audio = blueprint.get("audio", {}) or {}
    transitions = blueprint.get("transitions", []) or []
    transition_types = sorted({t.get("type") for t in transitions if t.get("type")})
    return {
        "content_type": blueprint.get("content_type", "general"),
        "language": blueprint.get("language", "en"),
        "pace": blueprint.get("pace", "medium"),
        "transitions": [{"type": t, "frequency": 0, "timestamps": []} for t in transition_types],
        "audio": {
            "has_music": bool(audio.get("has_music")),
            "music_type": audio.get("music_type", "none"),
            "has_voiceover": bool(audio.get("has_voiceover")),
            "has_dialogue": bool(audio.get("has_dialogue")),
            "has_sfx": bool(audio.get("has_sfx")),
            "beat_sync": bool(audio.get("beat_sync")),
        },
        "visual_effects": blueprint.get("visual_effects", []) or [],
        "color_grade": blueprint.get("color_grade", "neutral"),
        "required_clip_types": blueprint.get("required_clip_types", []) or [],
        "avg_clip_duration": blueprint.get("avg_clip_duration", 2.0),
    }
