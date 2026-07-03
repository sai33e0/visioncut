-- =====================================================
-- VisionCut AI — Full schema migration
-- Idempotent: safe to run on top of an existing database.
-- All tables, types, indexes, and triggers in one place so a fresh
-- database can be brought up with:
--   psql $DATABASE_URL -f supabase/migrations/0002_full_schema.sql
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------- ENUMS ----------
DO $$ BEGIN
  CREATE TYPE "Plan" AS ENUM ('free', 'pro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectStatus" AS ENUM (
    'uploading', 'analyzing', 'building', 'rendering', 'done', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ClipType" AS ENUM ('reference', 'user', 'music', 'sfx', 'voiceover');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FeedbackRating" AS ENUM ('up', 'down');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AnalyticsEventType" AS ENUM (
    'project_created', 'project_analyzed', 'timeline_built',
    'render_started', 'render_done', 'render_failed',
    'feedback_given', 'style_saved', 'style_applied'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- USERS ----------
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name  text,
  avatar_url    text,
  plan          "Plan" NOT NULL DEFAULT 'free',
  credits       integer NOT NULL DEFAULT 2,
  email_verified boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ---------- USER PREFERENCES ----------
CREATE TABLE IF NOT EXISTS user_preferences (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  preferred_transitions jsonb,
  preferred_pace        text,
  preferred_content_types jsonb,
  feature_weights       jsonb,
  total_feedback        integer NOT NULL DEFAULT 0,
  updated_at            timestamptz NOT NULL DEFAULT NOW()
);

-- ---------- PROJECTS ----------
CREATE TABLE IF NOT EXISTS projects (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           text NOT NULL,
  description    text,
  status         "ProjectStatus" NOT NULL DEFAULT 'uploading',
  reference_url  text,
  blueprint      jsonb,
  timeline       jsonb,
  quality_score  double precision,
  error_message  text,
  progress       integer NOT NULL DEFAULT 0,
  current_step   text,
  style_vector   vector(256),
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  updated_at     timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects (user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_user_created ON projects (user_id, created_at DESC);

-- ---------- CLIPS ----------
CREATE TABLE IF NOT EXISTS clips (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name          text NOT NULL,
  url           text NOT NULL,
  type          "ClipType" NOT NULL DEFAULT 'user',
  duration_sec  double precision,
  size_bytes    bigint,
  mime_type     text,
  scene_type    text,
  motion_level  double precision,
  camera_move   text,
  quality       double precision,
  lighting      text,
  objects       jsonb,
  faces         integer,
  metadata      jsonb,
  embedding     vector(512),
  style_vector  vector(256),
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clips_project_id ON clips (project_id);
CREATE INDEX IF NOT EXISTS idx_clips_project_type ON clips (project_id, type);

-- ---------- TIMELINE SEGMENTS ----------
CREATE TABLE IF NOT EXISTS timeline_segments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position        integer NOT NULL,
  start_time      double precision NOT NULL,
  end_time        double precision NOT NULL,
  clip_id         uuid REFERENCES clips(id) ON DELETE SET NULL,
  transition      text,
  transition_dur  double precision NOT NULL DEFAULT 0.3,
  confidence      double precision NOT NULL DEFAULT 0,
  match_reason    jsonb,
  alternatives    jsonb,
  render_path     text,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_timeline_segments_project_position
  ON timeline_segments (project_id, position);

-- ---------- STYLES ----------
CREATE TABLE IF NOT EXISTS styles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               text NOT NULL,
  description        text,
  content_type       text,
  pace               text,
  transitions        jsonb,
  audio_components   jsonb,
  blueprint_template jsonb,
  style_vector       vector(256),
  is_public          boolean NOT NULL DEFAULT false,
  usage_count        integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  updated_at         timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_styles_user_id ON styles (user_id);
CREATE INDEX IF NOT EXISTS idx_styles_content_type ON styles (content_type);

-- ---------- FEEDBACK ----------
CREATE TABLE IF NOT EXISTS feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  segment_id  uuid REFERENCES timeline_segments(id) ON DELETE SET NULL,
  clip_id     uuid REFERENCES clips(id) ON DELETE SET NULL,
  rating      "FeedbackRating" NOT NULL,
  comment     text,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_project_id ON feedback (project_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_clip ON feedback (user_id, clip_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_created ON feedback (user_id, created_at DESC);

-- ---------- ANALYTICS EVENTS ----------
CREATE TABLE IF NOT EXISTS analytics_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  event_type "AnalyticsEventType" NOT NULL,
  payload    jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analytics_user_created
  ON analytics_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type_created
  ON analytics_events (event_type, created_at DESC);

-- ---------- VECTOR INDEXES (HNSW) ----------
-- These power the FAISS-equivalent cosine search in Postgres.
CREATE INDEX IF NOT EXISTS clips_embedding_hnsw
  ON clips USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS clips_style_vector_hnsw
  ON clips USING hnsw (style_vector vector_cosine_ops);
CREATE INDEX IF NOT EXISTS styles_style_vector_hnsw
  ON styles USING hnsw (style_vector vector_cosine_ops);
CREATE INDEX IF NOT EXISTS projects_style_vector_hnsw
  ON projects USING hnsw (style_vector vector_cosine_ops);

-- ---------- TRIGGERS ----------
-- Auto-update `updated_at` on every UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_clips_updated_at
    BEFORE UPDATE ON clips
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_styles_updated_at
    BEFORE UPDATE ON styles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_user_prefs_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- AUTO-CREATE USER PREFERENCES ON USER INSERT ----------
-- A new user gets a default preferences row so the timeline builder always
-- has weights to read.
CREATE OR REPLACE FUNCTION create_default_preferences()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_preferences (user_id, feature_weights)
  VALUES (
    NEW.id,
    jsonb_build_object(
      'faiss_similarity', 0.30,
      'motion_match', 0.25,
      'duration_match', 0.15,
      'scene_type_match', 0.15,
      'camera_match', 0.10,
      'quality_score', 0.05
    )
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_default_prefs ON users;
CREATE TRIGGER trg_create_default_prefs
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_default_preferences();

-- ---------- GRANTS ----------
-- Supabase roles for row-level access. Safe no-op on plain postgres.
DO $$ BEGIN
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Final config
ALTER DATABASE postgres SET timezone TO 'UTC';
