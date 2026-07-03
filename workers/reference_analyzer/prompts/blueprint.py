"""Gemini prompts used by the reference analyzer.

The single most important prompt. Returns strict JSON the worker validates
against the Blueprint pydantic model. If validation fails we re-run with
a more deterministic "fix" prompt before giving up.
"""
from __future__ import annotations

BLUEPRINT_PROMPT = """You are a professional video editor with 10+ years of experience.
Analyze the provided reference video and return ONLY valid JSON (no markdown, no prose).

The JSON MUST match this schema exactly:

{{
  "content_type": one of [travel_reel, vlog, documentary, podcast, educational,
                          gaming, motivational, wedding, fitness, advertisement,
                          movie_edit, youtube, general],
  "language": ISO 639-1 code (e.g. "en", "es", "hi", "ja"),
  "pace": one of [very_fast, fast, medium, slow, very_slow],
  "total_cuts": integer >= 0,
  "avg_clip_duration": float (seconds, > 0),
  "transitions": [
    {{
      "type": "cut" | "fade" | "zoom" | "flash" | "blur" | "slide" | "wipe" | "spin" | "shake",
      "frequency": integer >= 1,
      "timestamps": [float seconds]
    }}
  ],
  "audio": {{
    "has_music": boolean,
    "music_type": "lofi" | "cinematic" | "pop" | "electronic" | "rock" | "ambient" | "classical" | "none",
    "has_voiceover": boolean,
    "has_dialogue": boolean,
    "has_sfx": boolean,
    "beat_sync": boolean,
    "tempo_bpm": float
  }},
  "visual_effects": [string],
  "color_grade": "warm" | "cool" | "neutral" | "cinematic" | "muted" | "vibrant",
  "required_clip_types": [string],   // e.g. ["drone", "talking_head", "b_roll", "action"]
  "confidence": float between 0 and 1
}}

Rules:
- "total_cuts" is the number of cuts/transitions in the video.
- "avg_clip_duration" = total_duration / total_cuts (rounded to 2 decimals).
- Only include transition types you actually see; do not invent frequencies.
- "confidence" reflects how certain you are in the analysis (low for ambiguous footage).
- Return the JSON object only.
"""


FIX_PROMPT = """Your previous response did not match the required schema.
Re-emit a corrected JSON object that strictly satisfies this schema. Do not add commentary.

{schema}

Previous invalid output:
{previous}
"""


def render_blueprint_prompt() -> str:
    return BLUEPRINT_PROMPT


def render_fix_prompt(previous: str, schema_hint: str) -> str:
    return FIX_PROMPT.format(schema=schema_hint, previous=previous)