"""Thin Gemini client used by the reference analyzer.

We send the actual video to Gemini 1.5 Pro (multimodal) along with the
deterministic visual + audio hints so the model can confirm/refine them.

If Gemini is unavailable, we fall back to a pure deterministic blueprint
built from the hints (good enough for CI / dev).
"""
from __future__ import annotations

import json
import re
import os
from typing import Optional
from tenacity import retry, stop_after_attempt, wait_exponential

from common.config import get_settings
from common.logging import get_logger

from ..models.schema import BlueprintModel
from ..prompts.blueprint import render_blueprint_prompt, render_fix_prompt

logger = get_logger("reference_analyzer.gemini")


# ----------------- JSON extraction -----------------

_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json(text: str) -> Optional[dict]:
    """Tolerate Gemini returning ```json ...``` or extra prose."""
    if not text:
        return None
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        try:
            return json.loads(fence.group(1))
        except json.JSONDecodeError:
            pass
    match = _JSON_RE.search(text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None


# ----------------- Gemini call -----------------

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def _call_gemini(video_path: str, hints: dict) -> str:
    s = get_settings()
    if not s.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY not set")
    import google.generativeai as genai  # type: ignore

    genai.configure(api_key=s.gemini_api_key)
    model = genai.GenerativeModel("gemini-1.5-pro")

    # Upload the video file
    uploaded = genai.upload_file(video_path, mime_type="video/mp4")
    # Wait for it to finish processing (ACTIVE → ready)
    while uploaded.state.name == "PROCESSING":
        import time
        time.sleep(2)
        uploaded = genai.get_file(uploaded.name)

    prompt = render_blueprint_prompt() + "\n\nDeterministic hints from local analysis:\n" + json.dumps(hints, indent=2)
    response = model.generate_content(
        [uploaded, prompt],
        generation_config={"response_mime_type": "application/json", "temperature": 0.1},
    )
    return response.text or ""


# ----------------- Public API -----------------

def generate_blueprint(video_path: str, visual_hints: dict, audio_hints: dict) -> BlueprintModel:
    """Use Gemini when possible, else fall back to deterministic merge."""
    hints = {"visual": visual_hints, "audio": audio_hints}
    raw_text: Optional[str] = None
    used_fallback = False

    if get_settings().gemini_api_key:
        try:
            raw_text = _call_gemini(video_path, hints)
        except Exception as e:
            logger.warning("gemini_call_failed", error=str(e))

    parsed = _extract_json(raw_text) if raw_text else None

    if parsed is None:
        used_fallback = True
        parsed = _deterministic_blueprint(visual_hints, audio_hints)
    else:
        # Validate, attempt fix once
        try:
            bp = BlueprintModel.model_validate(parsed)
            return bp
        except Exception as e:
            logger.warning("blueprint_validation_failed", error=str(e))
            try:
                fix_text = _call_gemini(video_path, {"hints": hints, "previous": raw_text, "error": str(e)})
                fix_parsed = _extract_json(fix_text)
                if fix_parsed:
                    bp = BlueprintModel.model_validate(fix_parsed)
                    return bp
            except Exception:
                pass
            parsed = _deterministic_blueprint(visual_hints, audio_hints)

    if used_fallback:
        logger.info("using_deterministic_blueprint")

    # Final validation
    return BlueprintModel.model_validate(parsed)


def _deterministic_blueprint(visual: dict, audio: dict) -> dict:
    """Pure-deterministic blueprint when Gemini is unavailable."""
    total_cuts = int(visual.get("total_cuts", 0))
    duration = float(visual.get("duration", 0.0))
    avg_clip = float(visual.get("avg_clip_duration", 0.0)) or (duration / max(1, total_cuts + 1))

    # Pace from cuts/duration
    if duration > 0 and total_cuts > 0:
        cuts_per_min = total_cuts / (duration / 60.0)
    else:
        cuts_per_min = 0
    if cuts_per_min > 60:
        pace = "very_fast"
    elif cuts_per_min > 35:
        pace = "fast"
    elif cuts_per_min > 15:
        pace = "medium"
    elif cuts_per_min > 5:
        pace = "slow"
    else:
        pace = "very_slow"

    return {
        "content_type": "general",
        "language": audio.get("language", "en") or "en",
        "pace": pace,
        "total_cuts": total_cuts,
        "avg_clip_duration": round(avg_clip, 3),
        "transitions": [
            {"type": "cut", "frequency": max(1, total_cuts), "timestamps": visual.get("cut_timestamps", [])[:30]}
        ],
        "audio": {
            "has_music": bool(audio.get("has_music")),
            "music_type": audio.get("music_type", "none"),
            "has_voiceover": bool(audio.get("has_speech")),
            "has_dialogue": bool(audio.get("has_speech")),
            "has_sfx": False,
            "beat_sync": audio.get("tempo_bpm", 0) > 0,
            "tempo_bpm": float(audio.get("tempo_bpm", 0)),
        },
        "visual_effects": visual.get("visual_effects", []),
        "color_grade": visual.get("color_grade_hint", "neutral"),
        "required_clip_types": [],
        "confidence": 0.55,
    }
