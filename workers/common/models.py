"""Pydantic models shared by all workers."""
from __future__ import annotations

from typing import Any, List, Optional
from pydantic import BaseModel, Field


class ProgressEvent(BaseModel):
    projectId: str
    step: str
    percent: int
    detail: Optional[str] = None


class Blueprint(BaseModel):
    content_type: str = "general"
    language: str = "en"
    pace: str = "medium"
    total_cuts: int = 0
    avg_clip_duration: float = 0.0
    transitions: List[dict] = Field(default_factory=list)
    audio: dict = Field(default_factory=dict)
    visual_effects: List[str] = Field(default_factory=list)
    color_grade: str = "neutral"
    required_clip_types: List[str] = Field(default_factory=list)
    confidence: float = 0.0


class Segment(BaseModel):
    position: int
    start_time: float
    end_time: float
    clip_id: Optional[str] = None
    transition: Optional[str] = None
    transition_dur: float = 0.3
    confidence: float = 0.0
    match_reason: dict = Field(default_factory=dict)
    alternatives: List[dict] = Field(default_factory=list)


class Timeline(BaseModel):
    segments: List[Segment]
    duration: float = 0.0
    quality_score: Optional[float] = None


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str = "1.0.0"
