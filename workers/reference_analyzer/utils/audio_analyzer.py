"""Audio analysis for the reference video.

Combines:
- Whisper (medium) for language + speech vs music vs silence segmentation
- Librosa for tempo (BPM), beat timestamps, onset events
- Heuristic music type detection (lofi / cinematic / electronic / pop / rock / ambient)
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import List, Optional
import numpy as np

from common.config import get_settings
from common.frames import extract_audio


@dataclass
class AudioFeatures:
    has_speech: bool = False
    has_music: bool = False
    language: str = "en"
    tempo_bpm: float = 0.0
    beat_timestamps: List[float] = field(default_factory=list)
    onset_timestamps: List[float] = field(default_factory=list)
    music_type: str = "none"
    speech_segments: List[dict] = field(default_factory=list)
    duration: float = 0.0


# ----------------- Whisper -----------------

def _run_whisper(audio_path: str) -> dict:
    """Returns dict with language, segments, has_speech.

    Whisper is loaded lazily so the rest of the worker can start without it.
    Prefers faster-whisper (CTranslate2, CUDA) on a GPU host; falls back to
    openai-whisper when CTranslate2 isn't installed.
    """
    s = get_settings()
    model_size = s.whisper_model or "medium"
    if not model_size or model_size == "none":
        return {"language": "en", "segments": [], "has_speech": False}

    from common.gpu import should_use_gpu, device_string
    use_gpu, reason = should_use_gpu("whisper")

    # Try faster-whisper first when GPU is available
    if use_gpu:
        try:
            from faster_whisper import WhisperModel  # type: ignore
            device = device_string("whisper")            # "cuda:0" or "cpu"
            compute_type = "float16" if device.startswith("cuda") else "int8"
            model = WhisperModel(model_size, device=device, compute_type=compute_type)
            segments_iter, info = model.transcribe(
                audio_path,
                language=None,
                task="transcribe",
                word_timestamps=False,
                vad_filter=True,
            )
            segs = []
            for seg in segments_iter:
                segs.append({
                    "start": float(seg.start),
                    "end": float(seg.end),
                    "text": (seg.text or "").strip(),
                })
            return {
                "language": info.language or "en",
                "segments": segs,
                "has_speech": any(s["text"] for s in segs),
                "engine": "faster-whisper",
                "device": device,
            }
        except Exception as e:  # pragma: no cover
            # Fall through to openai-whisper
            pass

    # openai-whisper fallback (CPU)
    try:
        import whisper  # type: ignore
    except Exception as e:  # pragma: no cover - optional dep
        return {"language": "en", "segments": [], "has_speech": False, "error": str(e)}

    model = whisper.load_model(model_size)
    result = model.transcribe(
        audio_path,
        language=None,
        task="transcribe",
        word_timestamps=False,
        fp16=False,
        verbose=False,
    )
    segs = result.get("segments", []) or []
    return {
        "language": result.get("language", "en") or "en",
        "segments": [
            {
                "start": float(seg.get("start", 0.0)),
                "end": float(seg.get("end", 0.0)),
                "text": (seg.get("text") or "").strip(),
            }
            for seg in segs
        ],
        "has_speech": any((seg.get("text") or "").strip() for seg in segs),
        "engine": "openai-whisper",
    }


# ----------------- Librosa -----------------

def _run_librosa(audio_path: str) -> dict:
    import librosa  # type: ignore

    y, sr = librosa.load(audio_path, sr=44100, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)

    if y.size == 0:
        return {
            "tempo": 0.0,
            "beats": [],
            "onsets": [],
            "spectral_centroid": 0.0,
            "rms": 0.0,
            "duration": 0.0,
        }

    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, tightness=100)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()

    onset_frames = librosa.onset.onset_detect(y=y, sr=sr)
    onset_times = librosa.frames_to_time(onset_frames, sr=sr).tolist()

    centroid = float(librosa.feature.spectral_centroid(y=y, sr=sr).mean())
    rms = float(librosa.feature.rms(y=y).mean())

    return {
        "tempo": float(tempo) if not isinstance(tempo, np.ndarray) else float(tempo[0]),
        "beats": [round(t, 3) for t in beat_times],
        "onsets": [round(t, 3) for t in onset_times],
        "spectral_centroid": centroid,
        "rms": rms,
        "duration": float(duration),
    }


# ----------------- Music type classifier -----------------

def _classify_music(spectral_centroid: float, tempo: float, rms: float) -> str:
    """Cheap heuristic music-type classifier. Real models would use CLAP / PANN."""
    if rms < 0.02 and tempo < 60:
        return "ambient"
    if tempo < 80 and spectral_centroid < 1500:
        return "lofi"
    if tempo > 120 and spectral_centroid > 2500:
        return "electronic"
    if 90 <= tempo <= 120 and spectral_centroid > 2000:
        return "pop"
    if tempo > 110 and spectral_centroid > 1800 and rms > 0.08:
        return "rock"
    if spectral_centroid > 2000 and 80 <= tempo <= 130:
        return "cinematic"
    return "none"


# ----------------- Public API -----------------

def analyze_audio(video_path: str, work_dir: str) -> AudioFeatures:
    """Run whisper + librosa on a video, return structured features."""
    os.makedirs(work_dir, exist_ok=True)
    audio_path = extract_audio(video_path, work_dir)
    feat = AudioFeatures()

    try:
        wr = _run_whisper(audio_path)
        feat.language = wr.get("language", "en") or "en"
        feat.has_speech = bool(wr.get("has_speech"))
        feat.speech_segments = wr.get("segments", [])
    except Exception:
        # Whisper is optional — keep going
        pass

    try:
        lr = _run_librosa(audio_path)
        feat.tempo_bpm = float(lr.get("tempo", 0.0))
        feat.beat_timestamps = lr.get("beats", [])
        feat.onset_timestamps = lr.get("onsets", [])
        feat.duration = float(lr.get("duration", 0.0))
        if not feat.has_speech and lr.get("rms", 0.0) > 0.02:
            feat.has_music = True
        elif lr.get("rms", 0.0) > 0.05 and not feat.has_speech:
            feat.has_music = True
        feat.music_type = _classify_music(
            lr.get("spectral_centroid", 0.0),
            feat.tempo_bpm,
            lr.get("rms", 0.0),
        )
    except Exception:
        pass
    return feat


def audio_to_blueprint_hints(features: AudioFeatures) -> dict:
    return {
        "has_speech": features.has_speech,
        "has_music": features.has_music,
        "language": features.language,
        "tempo_bpm": features.tempo_bpm,
        "music_type": features.music_type,
        "beat_count": len(features.beat_timestamps),
        "speech_segments": features.speech_segments[:20],
        "beat_timestamps": features.beat_timestamps[:80],
    }
