/**
 * Shared TypeScript types mirroring the backend DTOs and Prisma models.
 */

export type Plan = "free" | "pro";
export type ProjectStatus =
  | "uploading"
  | "analyzing"
  | "building"
  | "rendering"
  | "done"
  | "failed";
export type ClipType = "reference" | "user" | "music" | "sfx" | "voiceover";
export type FeedbackRating = "up" | "down";

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  plan: Plan;
  credits: number;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  referenceUrl: string | null;
  blueprint: Blueprint | null;
  timeline: Timeline | null;
  qualityScore: number | null;
  errorMessage: string | null;
  progress: number;
  currentStep: string | null;
  createdAt: string;
  updatedAt: string;
  clips?: Clip[];
  _count?: { clips: number; segments: number };
}

export interface Clip {
  id: string;
  projectId: string;
  name: string;
  url: string;
  type: ClipType;
  durationSec: number | null;
  sizeBytes: number | null;
  mimeType: string | null;
  sceneType: string | null;
  motionLevel: number | null;
  cameraMove: string | null;
  quality: number | null;
  metadata: ClipMetadata | null;
  createdAt: string;
}

export interface ClipMetadata {
  scene_type?: string;
  objects?: string[];
  has_people?: boolean;
  has_face?: boolean;
  motion_level?: number;
  camera_movement?: string;
  brightness?: number;
  contrast?: number;
  sharpness?: number;
  quality?: number;
  duration_sec?: number;
  fps?: number;
  width?: number;
  height?: number;
}

export interface Blueprint {
  content_type: string;
  language: string;
  pace: "very_fast" | "fast" | "medium" | "slow" | "very_slow";
  total_cuts: number;
  avg_clip_duration: number;
  transitions: Array<{ type: string; frequency: number; timestamps: number[] }>;
  audio: {
    has_music: boolean;
    music_type: string;
    has_voiceover: boolean;
    has_dialogue: boolean;
    has_sfx: boolean;
    beat_sync: boolean;
    tempo_bpm: number;
  };
  visual_effects: string[];
  color_grade: string;
  required_clip_types: string[];
  confidence: number;
}

export interface SegmentAlternative {
  clip_id: string;
  name: string;
  url?: string;
  confidence: number;
  swap_impact: "low" | "medium" | "high";
  matched?: string[];
  duration_sec?: number;
}

export interface Segment {
  id: string;
  projectId: string;
  position: number;
  startTime: number;
  endTime: number;
  clipId: string | null;
  transition: string | null;
  transitionDur: number;
  confidence: number;
  matchReason: SegmentReason | null;
  alternatives: SegmentAlternative[];
  renderPath: string | null;
}

export interface SegmentReason {
  matched: string[];
  not_matched: string[];
  raw_scores?: Record<string, number>;
  duration_sec?: number;
  scene_type?: string;
  camera_movement?: string;
  cosine_similarity?: number;
}

export interface Timeline {
  projectId: string;
  status: ProjectStatus;
  progress: number;
  segments: Segment[];
}

export interface Style {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  contentType: string | null;
  pace: string | null;
  isPublic: boolean;
  usageCount: number;
  createdAt: string;
  similarity?: number;
}

export interface ProjectHistoryEntry {
  id: string;
  name: string;
  status: ProjectStatus;
  qualityScore: number | null;
  createdAt: string;
  _count: { clips: number; segments: number };
}

export interface AnalyticsSummary {
  projectsCompleted: number;
  avgQualityScore: number | null;
  totalClipsProcessed: number;
  totalEvents: number;
  bestStyle: string | null;
}

export interface TransitionStat {
  name: string;
  count: number;
}

export interface QualityOverTimeEntry {
  projectId: string;
  name: string;
  quality: number;
  createdAt: string;
}

export interface ContentMix {
  contentTypes: { name: string; count: number }[];
  paces: { name: string; count: number }[];
}

export interface FeedbackAccuracy {
  total: number;
  up: number;
  down: number;
  accuracy: number | null;
}

export interface FeedbackPreferences {
  preferences: Record<string, unknown>;
  weights: Record<string, number> | null;
  stats: FeedbackAccuracy;
  accuracy_estimate: number | null;
}

export interface QualityReport {
  projectId: string;
  pacingMatch: number;
  transitionMatch: number;
  audioMatch: number | null;
  perceptualMatch: number | null;
  overall: number;
  segmentCount: number;
  confidenceAvg: number;
}

export interface ProgressEvent {
  step: string;
  percent: number;
  detail?: string;
  timestamp: number;
}

export interface LogEvent {
  message: string;
  level: "info" | "warn" | "error";
  timestamp: number;
}

export interface GapAnalysisItem {
  type: "music" | "voiceover" | "sfx" | "clip";
  required: boolean;
  reason: string;
  suggestion?: string;
}

export interface UploadProgress {
  fileName: string;
  progress: number;
  done: boolean;
  error?: string;
}
