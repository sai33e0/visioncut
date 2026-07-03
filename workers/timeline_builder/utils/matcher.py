"""The matcher: for each reference shot, pick the best user clips.

Pipeline:
1. Generate the reference-shot embedding (proxy from target features).
2. FAISS top-K against project clips.
3. Re-rank with hybrid scorer that respects user preference weights.
4. Store top-3 alternatives per segment with swap impact.
"""
from __future__ import annotations

import hashlib
from typing import Dict, List, Optional
import numpy as np

from common.embeddings import l2_normalize

from ..models.schema import ShotSpec, SegmentSpec
from .scorer import build_reason, score, swap_impact, DEFAULT_WEIGHTS

EMBEDDING_DIM = 512
TOP_K_CANDIDATES = 12
ALTERNATIVES = 3


def _shot_to_query(shot: ShotSpec) -> List[float]:
    """Turn a shot's target features into a deterministic query vector.

    We hash the shot's target features into a 512-dim unit vector. This is a
    stable proxy: similar shots → similar queries → similar FAISS neighborhoods.
    A production version would use CLIP on the reference frame instead.
    """
    seed = f"{shot.target_scene}|{shot.target_motion:.3f}|{shot.target_camera}|{shot.target_duration:.3f}|{shot.position}"
    h = hashlib.sha256(seed.encode("utf-8")).digest()
    out = bytearray()
    counter = 0
    while len(out) < EMBEDDING_DIM:
        out.extend(hashlib.sha256(h + counter.to_bytes(4, "big")).digest())
        counter += 1
    arr = np.frombuffer(bytes(out[:EMBEDDING_DIM]), dtype=np.uint8).astype(np.float32)
    arr -= arr.mean()
    return (arr / (np.linalg.norm(arr) + 1e-12)).tolist()


def _cosine(a: List[float], b: List[float]) -> float:
    va = np.asarray(a, dtype=np.float32)
    vb = np.asarray(b, dtype=np.float32)
    na = np.linalg.norm(va) + 1e-12
    nb = np.linalg.norm(vb) + 1e-12
    return float(np.dot(va, vb) / (na * nb))


def match_shots(
    shots: List[ShotSpec],
    candidates: List[dict],
    user_weights: Optional[dict] = None,
    used_clip_ids: Optional[set] = None,
) -> List[SegmentSpec]:
    """Match each shot to a candidate. `used_clip_ids` avoids reusing clips.

    `candidates` is a list of dicts from the FAISS index, each with shape:
      {clip_id, project_id, name, url, duration_sec, metadata, embedding?}
    """
    if used_clip_ids is None:
        used_clip_ids = set()
    segments: List[SegmentSpec] = []
    weights = {**DEFAULT_WEIGHTS, **(user_weights or {})}

    for shot in shots:
        query = _shot_to_query(shot)
        # Compute cosine against every candidate that has an embedding
        scored = []
        for c in candidates:
            emb = c.get("embedding")
            if not emb:
                continue
            sim = _cosine(query, emb)
            # Penalize already-used clips
            if c["clip_id"] in used_clip_ids:
                sim *= 0.05
            final, parts = score(
                faiss_sim=sim,
                target_motion=shot.target_motion,
                target_duration=shot.target_duration,
                target_scene=shot.target_scene,
                target_camera=shot.target_camera,
                candidate=c,
                weights=weights,
            )
            scored.append((c, final, parts, sim))

        scored.sort(key=lambda x: x[1], reverse=True)

        # Top selection + alternatives
        top = scored[:ALTERNATIVES + 1]
        selected = top[0] if top else None
        alts = top[1:ALTERNATIVES + 1]

        if selected is None:
            # No candidates — produce an empty placeholder; renderer will skip
            segments.append(SegmentSpec(
                position=shot.position,
                start_time=shot.start_time,
                end_time=shot.end_time,
                duration=shot.target_duration,
                target_motion=shot.target_motion,
                target_scene=shot.target_scene,
                target_camera=shot.target_camera,
            ))
            continue

        c, final, parts, sim = selected
        used_clip_ids.add(c["clip_id"])
        reason = build_reason(parts, c)
        alt_payload = []
        for rank, (ac, af, ap, asim) in enumerate(alts, start=1):
            alt_payload.append({
                "clip_id": ac["clip_id"],
                "name": ac.get("name", ac["clip_id"]),
                "url": ac.get("url", ""),
                "confidence": round(af, 2),
                "swap_impact": swap_impact(rank, af),
                "matched": [k for k, v in ap.items() if v >= 0.6],
                "duration_sec": ac.get("duration_sec", 0.0),
            })

        segments.append(SegmentSpec(
            position=shot.position,
            start_time=shot.start_time,
            end_time=shot.end_time,
            duration=shot.target_duration,
            target_motion=shot.target_motion,
            target_scene=shot.target_scene,
            target_camera=shot.target_camera,
            selected_clip_id=c["clip_id"],
            selected_clip_name=c.get("name", c["clip_id"]),
            confidence=round(final, 2),
            transition="cut",
            transition_dur=0.3,
            match_reason={**reason, "cosine_similarity": round(sim, 4)},
            alternatives=alt_payload,
        ))
    return segments
