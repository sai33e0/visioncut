# Marker file so `python -m workers` works.
from .gpu import should_use_gpu  # noqa: F401
from .logging import get_logger, configure_logging  # noqa: F401


def log_gpu_profile(service: str) -> None:
    """Print one line per heavy stack indicating GPU/CPU mode.

    Called from each worker's startup so it's obvious from the logs which
    accelerator paths are active.
    """
    log = get_logger(f"{service}.boot")
    profile = {
        "ffmpeg": should_use_gpu("ffmpeg"),
        "opencv": should_use_gpu("opencv"),
        "whisper": should_use_gpu("whisper"),
        "yolo": should_use_gpu("yolo"),
        "faiss": should_use_gpu("faiss"),
    }
    log.info(
        "gpu_profile",
        **{k: "gpu" if v[0] else "cpu" for k, v in profile.items()},
    )
