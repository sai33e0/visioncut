"""Decompose a blueprint into shot specs.

The blueprint carries:
- total_cuts
- avg_clip_duration
- transitions[] with timestamps

We expand this into per-shot specs the matcher consumes.
"""
from __future__ import annotations

from typing import List

from ..models.schema import ShotSpec


def build_shots(blueprint: dict) -> List[ShotSpec]:
    transitions = blueprint.get("transitions", []) or []
    timestamps: List[float] = []
    for t in transitions:
        for ts in t.get("timestamps", []) or []:
            timestamps.append(float(ts))
    timestamps = sorted(set(round(t, 3) for t in timestamps))

    total_cuts = int(blueprint.get("total_cuts", 0))
    avg_dur = float(blueprint.get("avg_clip_duration", 0.0))

    # If we have timestamps, segment by them; else fall back to equal slices
    if not timestamps and total_cuts > 0:
        total_dur = max(avg_dur * (total_cuts + 1), avg_dur or 0.0)
        step = (total_dur or (total_cuts * avg_dur)) / max(1, total_cuts + 1)
        timestamps = [round(step * i, 3) for i in range(1, total_cuts + 1)]

    targets_motion = _motion_curve(blueprint)
    targets_scene = blueprint.get("required_clip_types", []) or []
    targets_camera = blueprint.get("camera_movement", "static")

    boundaries = [0.0] + timestamps
    shots: List[ShotSpec] = []
    for i in range(len(boundaries)):
        start = boundaries[i]
        end = boundaries[i + 1] if i + 1 < len(boundaries) else (boundaries[-1] + avg_dur)
        if end <= start:
            end = start + max(avg_dur, 0.5)
        shots.append(ShotSpec(
            position=i,
            start_time=round(start, 3),
            end_time=round(end, 3),
            target_duration=round(end - start, 3),
            target_motion=targets_motion[i % len(targets_motion)] if targets_motion else 0.5,
            target_scene=targets_scene[i % len(targets_scene)] if targets_scene else "unknown",
            target_camera=targets_camera if isinstance(targets_camera, str) else "static",
        ))
    return shots


def _motion_curve(blueprint: dict) -> List[float]:
    """Map pace → per-shot motion intensity."""
    pace = blueprint.get("pace", "medium")
    pace_to_motion = {
        "very_fast": 0.9,
        "fast": 0.7,
        "medium": 0.5,
        "slow": 0.3,
        "very_slow": 0.15,
    }
    base = pace_to_motion.get(pace, 0.5)
    return [base, base * 0.7, base * 1.1, base * 0.5]
