"""Async database access — asyncpg + pgvector helper."""
from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, List, Optional
import asyncpg

from .config import get_settings


class Database:
    _pool: Optional[asyncpg.Pool] = None

    @classmethod
    async def init(cls) -> None:
        if cls._pool is not None:
            return
        s = get_settings()
        cls._pool = await asyncpg.create_pool(s.database_url, min_size=1, max_size=10, init=_init_conn)

    @classmethod
    async def close(cls) -> None:
        if cls._pool is not None:
            await cls._pool.close()
            cls._pool = None

    @classmethod
    @asynccontextmanager
    async def acquire(cls) -> AsyncIterator[asyncpg.Connection]:
        if cls._pool is None:
            await cls.init()
        assert cls._pool is not None
        async with cls._pool.acquire() as conn:
            yield conn


async def _init_conn(conn: asyncpg.Connection) -> None:
    """Register the pgvector type codec on each connection."""
    await conn.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )
    # pgvector — register a codec so we can read/write vector columns as Python lists.
    try:
        import pgvector  # type: ignore

        await pgvector.asyncpg.register_vector(conn)
    except Exception:
        # pgvector may not be installed in unit tests; ignore.
        pass


# ---------- Convenience queries used by all workers ----------

async def update_clip_embedding(clip_id: str, embedding: List[float], style_vector: Optional[List[float]] = None) -> None:
    async with Database.acquire() as conn:
        if style_vector is not None:
            await conn.execute(
                "UPDATE clips SET embedding = $2::vector, style_vector = $3::vector, updated_at = NOW() WHERE id = $1",
                clip_id, embedding, style_vector,
            )
        else:
            await conn.execute(
                "UPDATE clips SET embedding = $2::vector, updated_at = NOW() WHERE id = $1",
                clip_id, embedding,
            )


async def update_clip_metadata(clip_id: str, metadata: dict[str, Any]) -> None:
    async with Database.acquire() as conn:
        await conn.execute(
            "UPDATE clips SET metadata = metadata || $2::jsonb, updated_at = NOW() WHERE id = $1",
            clip_id, json.dumps(metadata),
        )


async def save_blueprint(project_id: str, blueprint: dict) -> None:
    async with Database.acquire() as conn:
        await conn.execute(
            "UPDATE projects SET blueprint = $2::jsonb, updated_at = NOW() WHERE id = $1",
            project_id, json.dumps(blueprint),
        )


async def save_timeline(project_id: str, timeline: dict, quality_score: Optional[float] = None) -> None:
    """Persist a timeline both as the project JSONB blob and as per-segment rows.

    The NestJS layer reads /api/timeline/:projectId/segment/:id/explain from
    the `timeline_segments` table, so the JSONB blob alone is not enough —
    we need to mirror each segment so the segmentId-based endpoints resolve.
    """
    segments = (timeline or {}).get("segments", []) or []
    async with Database.acquire() as conn:
        async with conn.transaction():
            # Wipe and re-insert: the timeline is the source of truth and a
            # rebuild can change clip assignments / alternatives wholesale.
            await conn.execute(
                "DELETE FROM timeline_segments WHERE project_id = $1", project_id
            )
            for seg in segments:
                # Pull the selected clip_id if it's a valid UUID, else leave NULL
                raw_clip_id = seg.get("selected_clip_id") or seg.get("clipId")
                clip_id = None
                if raw_clip_id:
                    try:
                        import uuid as _uuid
                        _uuid.UUID(str(raw_clip_id))
                        clip_id = str(raw_clip_id)
                    except (ValueError, AttributeError, TypeError):
                        clip_id = None
                await conn.execute(
                    """
                    INSERT INTO timeline_segments
                      (id, project_id, position, start_time, end_time, clip_id,
                       transition, transition_dur, confidence, match_reason, alternatives)
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::uuid, $6, $7, $8, $9::jsonb, $10::jsonb)
                    """,
                    project_id,
                    int(seg.get("position", 0)),
                    float(seg.get("start_time", seg.get("startTime", 0.0))),
                    float(seg.get("end_time", seg.get("endTime", 0.0))),
                    clip_id,
                    seg.get("transition") or "cut",
                    float(seg.get("transition_dur", seg.get("transitionDur", 0.3))),
                    float(seg.get("confidence", 0.0)) / 100.0,  # stored as 0-1
                    json.dumps(seg.get("match_reason", seg.get("matchReason", {}))),
                    json.dumps(seg.get("alternatives", [])),
                )
            if quality_score is not None:
                await conn.execute(
                    "UPDATE projects SET timeline = $2::jsonb, quality_score = $3, status = 'building', updated_at = NOW() WHERE id = $1",
                    project_id, json.dumps(timeline), quality_score,
                )
            else:
                await conn.execute(
                    "UPDATE projects SET timeline = $2::jsonb, status = 'building', updated_at = NOW() WHERE id = $1",
                    project_id, json.dumps(timeline),
                )


async def fetch_user_clips(project_id: str) -> List[dict]:
    async with Database.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, name, url, duration_sec, type FROM clips WHERE project_id = $1 AND type IN ('user', 'reference') ORDER BY created_at",
            project_id,
        )
        return [dict(r) for r in rows]


async def fetch_user_weights(user_id: str) -> dict:
    async with Database.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT preferred_transitions, preferred_pace, preferred_content_types, feature_weights FROM user_preferences WHERE user_id = $1",
            user_id,
        )
        if not row:
            return {
                "faiss_similarity": 0.30,
                "motion_match": 0.25,
                "duration_match": 0.15,
                "scene_type_match": 0.15,
                "camera_match": 0.10,
                "quality_score": 0.05,
            }
        return (row["feature_weights"] or {})


async def save_user_weights(user_id: str, weights: dict) -> None:
    async with Database.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO user_preferences (id, user_id, feature_weights, updated_at)
            VALUES (gen_random_uuid(), $1, $2::jsonb, NOW())
            ON CONFLICT (user_id) DO UPDATE
              SET feature_weights = EXCLUDED.feature_weights,
                  total_feedback = user_preferences.total_feedback + 1,
                  updated_at = NOW()
            """,
            user_id, json.dumps(weights),
        )
