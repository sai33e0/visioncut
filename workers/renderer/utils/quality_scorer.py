"""Perceptual quality scoring for the rendered output.

SSIM is the production-grade proxy for visual similarity to a reference.
We also report:
- pacing_match     : how close the output's avg cut duration is to the reference
- transition_match : % of expected transition types present
- audio_match      : peak-volume differential vs reference audio
- perceptual_match : SSIM on sampled frames
- overall          : weighted mean
"""
from __future__ import annotations

import os
import subprocess
from typing import List, Optional, Tuple
import cv2
import numpy as np

from common.config import get_settings
from common.frames import extract_keyframes

try:
    from skimage.metrics import structural_similarity as ssim
    _HAS_SSIM = True
except Exception:  # pragma: no cover
    _HAS_SSIM = False


SAMPLE_FRAMES = 12


def _extract_frames(video_path: str, n: int) -> List[np.ndarray]:
    return extract_keyframes(video_path, n)


def _save_frames(frames: List[np.ndarray], out_dir: str) -> List[str]:
    os.makedirs(out_dir, exist_ok=True)
    paths = []
    for i, f in enumerate(frames):
        p = os.path.join(out_dir, f"f{i:03d}.jpg")
        cv2.imwrite(p, f, [cv2.IMWRITE_JPEG_QUALITY, 90])
        paths.append(p)
    return paths


def perceptual_ssim(reference_path: str, output_path: str) -> float:
    """Average SSIM over sampled frames. Returns 0-100."""
    if not _HAS_SSIM:
        return 0.0
    ref = _extract_frames(reference_path, SAMPLE_FRAMES)
    out = _extract_frames(output_path, SAMPLE_FRAMES)
    n = min(len(ref), len(out))
    if n == 0:
        return 0.0
    scores = []
    for i in range(n):
        a = cv2.cvtColor(ref[i], cv2.COLOR_BGR2GRAY)
        b = cv2.cvtColor(out[i], cv2.COLOR_BGR2GRAY)
        a = cv2.resize(a, (640, 360))
        b = cv2.resize(b, (640, 360))
        s, _ = ssim(a, b, full=True)
        scores.append(s)
    return float(round(np.mean(scores) * 100, 2))


def pacing_match(reference_path: str, output_path: str) -> float:
    """0-100 score: how close the output's avg-cut-duration is to the reference."""
    from common.frames import shot_segments
    s = get_settings()
    ref_dur = _safe_duration(reference_path)
    out_dur = _safe_duration(output_path)
    ref_segs = shot_segments(reference_path)
    out_segs = shot_segments(output_path)
    if not ref_segs or not out_segs or ref_dur == 0:
        return 0.0
    ref_avg = ref_dur / max(1, len(ref_segs))
    out_avg = out_dur / max(1, len(out_segs))
    if ref_avg == 0:
        return 0.0
    ratio = min(out_avg, ref_avg) / max(out_avg, ref_avg)
    return round(ratio * 100, 2)


def transition_match(reference_blueprint: dict, output_blueprint: dict) -> float:
    """0-100 score: % of reference transition types that appear in output."""
    ref_types = {t.get("type") for t in reference_blueprint.get("transitions", [])}
    out_types = {t.get("type") for t in output_blueprint.get("transitions", [])}
    if not ref_types:
        return 100.0
    overlap = ref_types & out_types
    return round(len(overlap) / len(ref_types) * 100, 2)


def audio_match(reference_path: str, output_path: str) -> float:
    """0-100 score: 100 - normalized RMS difference."""
    try:
        import librosa  # type: ignore
        ref, _ = librosa.load(reference_path, sr=22050, mono=True)
        out, _ = librosa.load(output_path, sr=22050, mono=True)
        if ref.size == 0 or out.size == 0:
            return 0.0
        ref_rms = float(np.sqrt(np.mean(ref ** 2)))
        out_rms = float(np.sqrt(np.mean(out ** 2)))
        if ref_rms == 0:
            return 0.0
        ratio = min(ref_rms, out_rms) / max(ref_rms, out_rms)
        return round(ratio * 100, 2)
    except Exception:
        return 0.0


def _safe_duration(path: str) -> float:
    s = get_settings()
    try:
        out = subprocess.check_output(
            [s.ffprobe_path, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            text=True,
        ).strip()
        return float(out)
    except Exception:
        return 0.0


def full_quality_report(
    reference_path: Optional[str],
    output_path: str,
    reference_blueprint: Optional[dict] = None,
    output_blueprint: Optional[dict] = None,
) -> dict:
    parts = {
        "pacing_match": 0.0,
        "transition_match": 0.0,
        "audio_match": 0.0,
        "perceptual_match": 0.0,
    }
    if reference_path:
        parts["pacing_match"] = pacing_match(reference_path, output_path)
        parts["perceptual_match"] = perceptual_ssim(reference_path, output_path)
        try:
            parts["audio_match"] = audio_match(reference_path, output_path)
        except Exception:
            parts["audio_match"] = 0.0
    if reference_blueprint and output_blueprint:
        parts["transition_match"] = transition_match(reference_blueprint, output_blueprint)

    weights = {"pacing_match": 0.20, "transition_match": 0.20,
               "audio_match": 0.20, "perceptual_match": 0.40}
    overall = sum(parts[k] * w for k, w in weights.items())
    return {**parts, "overall": round(overall, 2)}
