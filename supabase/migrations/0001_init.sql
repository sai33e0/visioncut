-- =====================================================
-- VisionCut AI — Database initial migration
-- Run after `prisma db push` for any pgvector-only setup
-- (Prisma does not own vector columns; this file does.)
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- Helper: HNSW index for fast approximate nearest neighbour on FAISS-style vectors.
CREATE INDEX IF NOT EXISTS clips_embedding_hnsw
  ON clips USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS clips_style_vector_hnsw
  ON clips USING hnsw (style_vector vector_cosine_ops);

CREATE INDEX IF NOT EXISTS styles_style_vector_hnsw
  ON styles USING hnsw (style_vector vector_cosine_ops);

-- Useful for analytics time-series queries
CREATE INDEX IF NOT EXISTS analytics_events_user_created
  ON analytics_events (user_id, created_at DESC);

-- Helpful composite indexes
CREATE INDEX IF NOT EXISTS timeline_segments_project_position
  ON timeline_segments (project_id, position);

CREATE INDEX IF NOT EXISTS feedback_user_clip
  ON feedback (user_id, clip_id);

-- Reasonable defaults
ALTER DATABASE postgres SET timezone TO 'UTC';
