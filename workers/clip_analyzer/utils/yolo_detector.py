"""YOLO-based scene / object detection for clip analysis.

Lazy-loads the model on first call. Falls back to a deterministic stub
when torch / ultralytics are unavailable (CI / dev) so the rest of the
pipeline can still be tested.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List
import os
import cv2
import numpy as np

from common.logging import get_logger

logger = get_logger("clip_analyzer.yolo")


@dataclass
class Detection:
    cls: str
    confidence: float
    bbox: tuple  # (x1, y1, x2, y2)


_PERSON = "person"
_FACE_HINT_CLASSES = {"person"}
_INDOOR_HINTS = {"chair", "tv", "laptop", "mouse", "keyboard", "book", "cup", "bottle"}
_OUTDOOR_HINTS = {"tree", "car", "truck", "traffic light", "stop sign", "bench", "boat"}
_NATURE_HINTS = {"tree", "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra"}


# COCO scene label mapping used by YOLOv8 by default
DEFAULT_MODEL = os.environ.get("YOLO_MODEL", "yolov8m.pt")
CONFIDENCE_THRESHOLD = 0.5

_model = None
_model_load_attempted = False


def _get_model():
    global _model, _model_load_attempted
    if _model is not None or _model_load_attempted:
        return _model
    _model_load_attempted = True
    try:
        from ultralytics import YOLO  # type: ignore
        from common.gpu import device_string, should_use_gpu
        device = device_string("yolo")
        use_gpu, reason = should_use_gpu("yolo")
        _model = YOLO(DEFAULT_MODEL)
        # Warm the model on the chosen device so the first inference call
        # doesn't pay the CUDA init cost.
        try:
            import numpy as _np
            _model.predict(_np.zeros((64, 64, 3), dtype=_np.uint8), device=device, verbose=False)
            logger.info("yolo_ready", device=device, gpu=use_gpu, reason=reason)
        except Exception as e:
            logger.warning("yolo_warmup_failed", device=device, error=str(e))
    except Exception as e:  # pragma: no cover
        logger.warning("yolo_unavailable", error=str(e))
        _model = None
    return _model


def detect_objects(video_path: str, sample_frames: int = 8) -> List[Detection]:
    """Run YOLO on sampled frames; aggregate detections across the clip."""
    model = _get_model()
    if model is None:
        return _stub_detections(video_path)

    from common.gpu import device_string
    device = device_string("yolo")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total <= 0:
        cap.release()
        return []
    indices = np.linspace(0, total - 1, sample_frames).astype(int)

    out: List[Detection] = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ok, frame = cap.read()
        if not ok:
            continue
        try:
            results = model(frame, conf=CONFIDENCE_THRESHOLD, device=device, verbose=False)
        except Exception as e:
            logger.warning("yolo_frame_failed", error=str(e))
            continue
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls)
                cls_name = model.names.get(cls_id, str(cls_id))
                out.append(Detection(
                    cls=cls_name,
                    confidence=float(box.conf),
                    bbox=tuple(float(v) for v in box.xyxy[0].tolist()),
                ))
    cap.release()
    return out


def _stub_detections(video_path: str) -> List[Detection]:
    """Deterministic stand-in so the pipeline works without torch installed.

    We probe the video for color statistics and assign a plausible label set.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total <= 0:
        cap.release()
        return []
    indices = np.linspace(0, total - 1, 4).astype(int)
    classes_seen: List[str] = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ok, frame = cap.read()
        if not ok:
            continue
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        h_mean = float(hsv[:, :, 0].mean())
        s_mean = float(hsv[:, :, 1].mean())
        if s_mean < 60 and h_mean > 80 and h_mean < 140:
            classes_seen.append("tree")
        elif s_mean < 80:
            classes_seen.append("person")
        else:
            classes_seen.append("car")
    cap.release()
    return [Detection(cls=c, confidence=0.6, bbox=(0, 0, 100, 100)) for c in classes_seen]


# ----------------- Scene classification -----------------

def classify_scene(detections: List[Detection]) -> str:
    """Return the dominant scene type given a list of detections."""
    if not detections:
        return "unknown"
    cls_set = {d.cls for d in detections}
    has_person = _PERSON in cls_set
    indoor = cls_set & _INDOOR_HINTS
    outdoor = cls_set & _OUTDOOR_HINTS
    nature = cls_set & _NATURE_HINTS

    if has_person and len(indoor) >= 1 and len(indoor) > len(outdoor):
        return "indoor"
    if has_person and len(nature) >= 1 and len(nature) > len(indoor):
        return "nature"
    if has_person and len(outdoor) >= 1:
        return "outdoor"
    if has_person:
        return "talking_head"
    if len(nature) >= 2 and len(nature) > len(indoor | outdoor):
        return "nature"
    if len(indoor) >= 2:
        return "indoor"
    if len(outdoor) >= 2:
        return "outdoor"
    return "action"


def summarize(detections: List[Detection]) -> dict:
    return {
        "objects": sorted({d.cls for d in detections}),
        "has_people": any(d.cls == _PERSON for d in detections),
        "has_face": any(d.cls in _FACE_HINT_CLASSES for d in detections),
    }
