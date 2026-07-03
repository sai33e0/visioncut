"""FFmpeg render pipeline.

Builds an ffmpeg command from a Timeline, then executes it.

Supports GPU (nvenc) when RENDER_USE_GPU=true, else libx264.
Transitions are implemented as cross-fade xfade filters.
"""
from __future__ import annotations

import os
import shlex
import shutil
import subprocess
import tempfile
from typing import List, Optional, Tuple

from common.config import get_settings
from common.logging import get_logger

logger = get_logger("renderer.ffmpeg")


def _has_nvenc() -> bool:
    """True if ffmpeg was built with NVENC support."""
    from common.gpu import ffmpeg_nvenc_available
    return ffmpeg_nvenc_available()


def _build_encoder() -> Tuple[List[str], dict]:
    """Return ([encoder_args], {gpu: bool}).

    GPU path uses h264_nvenc on the RTX 3050. CPU fallback is libx264 with
    veryfast preset for short renders.
    """
    s = get_settings()
    from common.gpu import should_use_gpu
    use_gpu, reason = should_use_gpu("ffmpeg")
    if use_gpu:
        # Use -hwaccel cuda to keep the decode/encode pipeline on the GPU.
        # If input is on disk, ffmpeg handles the host->device transfer for us.
        return [
            "-c:v", "h264_nvenc",
            "-preset", "fast",
            "-rc", "vbr",
            "-cq", str(s.render_crf),
            "-b:v", "0",
        ], {"gpu": True, "reason": reason}
    if s.render_use_gpu:
        logger.warning("ffmpeg_gpu_unavailable", reason=reason)
    return [
        "-c:v", "libx264",
        "-preset", s.render_preset,
        "-crf", str(s.render_crf),
    ], {"gpu": False, "reason": reason or "libx264"}


def probe_duration(video_path: str) -> float:
    s = get_settings()
    out = subprocess.check_output(
        [s.ffprobe_path, "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", video_path],
        text=True,
    ).strip()
    return float(out)


def _ensure_local(media_url: str, work_dir: str) -> str:
    """Copy a media file (local path or http url) into work_dir."""
    s = get_settings()
    if media_url.startswith("/") or media_url.startswith(s.storage_root):
        out = os.path.join(work_dir, os.path.basename(media_url))
        shutil.copy(media_url, out)
        return out
    # http(s) download
    import httpx
    out = os.path.join(work_dir, os.path.basename(media_url.split("?")[0]) or "media.mp4")
    with httpx.Client(timeout=120.0) as client:
        with client.stream("GET", media_url) as r:
            r.raise_for_status()
            with open(out, "wb") as f:
                for chunk in r.iter_bytes():
                    f.write(chunk)
    return out


def _trim_filter(dur: float) -> str:
    return f"trim=end={dur:.3f},setpts=PTS-STARTPTS"


def _scale_filter(width: int = 1280, height: int = 720) -> str:
    return f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1"


def _fade_filter(direction: str, dur: float, offset: float) -> str:
    if direction == "in":
        return f"fade=t=in:st=0:d={dur:.3f}"
    return f"fade=t=out:st={offset:.3f}:d={dur:.3f}"


def render_timeline(
    timeline: dict,
    out_path: str,
    work_dir: Optional[str] = None,
    audio_path: Optional[str] = None,
) -> dict:
    """Render a timeline to a single mp4.

    `timeline` is the dict shape stored in projects.timeline JSONB:
      { segments: [...], duration: float, quality_score: float }

    Returns a dict with {path, duration, gpu}.
    """
    s = get_settings()
    work_dir = work_dir or tempfile.mkdtemp(prefix="visioncut-render-")
    os.makedirs(work_dir, exist_ok=True)

    segments = timeline.get("segments", []) or []
    if not segments:
        raise ValueError("timeline has no segments")

    # Phase 1: trim each segment to its target duration
    clip_inputs: List[str] = []
    filter_parts: List[str] = []
    cumulative = 0.0

    for i, seg in enumerate(segments):
        clip_id = seg.get("selected_clip_id")
        if not clip_id:
            continue
        # Clip URL convention: stored in `clips` table; here we accept a
        # `clip_url` field on the segment, or fall back to a constructed path.
        url = seg.get("clip_url") or f"{s.storage_public_base}/clips/{clip_id}.mp4"
        local = _ensure_local(url, work_dir)
        clip_inputs.append(local)

        target_dur = float(seg.get("duration") or (seg["end_time"] - seg["start_time"]) or 0)
        if target_dur <= 0:
            continue
        trim = _trim_filter(target_dur)
        scale = _scale_filter()
        filter_parts.append(f"[{i}:v]{trim},{scale}[v{i}]")
        cumulative += target_dur

    if not clip_inputs:
        raise ValueError("no segments had selected clips")

    # Phase 2: chain the trimmed clips with optional xfade transitions
    n = len(clip_inputs)
    if n == 1:
        last_label = "v0"
    else:
        chain = []
        cur = "[v0]"
        for i in range(1, n):
            offset = sum(
                float(seg.get("duration") or (seg["end_time"] - seg["start_time"]) or 0)
                for seg in segments[:i]
            ) - 0.3
            offset = max(0.0, offset)
            out_label = f"vx{i}" if i < n - 1 else "vout"
            chain.append(f"{cur}[v{i}]xfade=transition=fade:duration=0.3:offset={offset:.3f}[{out_label}]")
            cur = f"[{out_label}]"
        filter_parts.extend(chain)
        last_label = "vout"

    # Phase 3: optional audio
    audio_inputs = []
    if audio_path:
        local_audio = _ensure_local(audio_path, work_dir)
        audio_inputs = ["-i", local_audio]
        filter_parts.append(f"[{n}:a]aresample=44100,asetpts=PTS-STARTPTS[aout]")

    # Phase 4: assemble
    enc_args, meta = _build_encoder()
    cmd: List[str] = [s.ffmpeg_path, "-y"]
    # When GPU is selected, ask ffmpeg to keep frames on the GPU between filters
    if meta.get("gpu"):
        cmd += ["-hwaccel", "cuda", "-hwaccel_output_format", "cuda"]
    for c in clip_inputs:
        cmd += ["-i", c]
    cmd += audio_inputs
    cmd += ["-filter_complex", ";".join(filter_parts)]
    cmd += ["-map", f"[{last_label}]"]
    if audio_path:
        cmd += ["-map", "[aout]"]
    cmd += ["-r", "30"]
    cmd += enc_args
    cmd += ["-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out_path]

    logger.info("ffmpeg_cmd", cmd=" ".join(shlex.quote(p) for p in cmd))
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        logger.error("ffmpeg_failed", stderr=proc.stderr[-2000:])
        raise RuntimeError(f"ffmpeg failed: {proc.stderr[-500:]}")

    if not os.path.exists(out_path):
        raise RuntimeError("ffmpeg reported success but output not found")

    final_dur = probe_duration(out_path)
    return {"path": out_path, "duration": final_dur, "gpu": meta["gpu"]}
