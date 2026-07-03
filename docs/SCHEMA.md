# Database Schema

## Engines

- **PostgreSQL 16** with the **pgvector** extension
- Prisma for typed access; raw SQL for vector columns and HNSW indexes

## Tables

| Table                | Purpose                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `users`              | Account, plan, credits                                                  |
| `projects`           | One edit per row; stores blueprint + timeline JSON; status FSM          |
| `clips`              | Reference video + user raw clips; 512-dim FAISS + 256-dim style vector |
| `timeline_segments`  | Ordered segments; selected clip + top-3 alternatives + match reasons    |
| `styles`             | Saved reusable editing styles; 256-dim style vector                     |
| `feedback`           | Per-segment thumbs up/down                                              |
| `user_preferences`   | Per-user feature weights used to bias FAISS search                      |
| `analytics_events`   | Append-only event log for the analytics dashboard                       |

## Vector columns

- `clips.embedding vector(512)` — produced by the clip_analyzer worker
- `clips.style_vector vector(256)` — produced by the style_engine for reference clips
- `styles.style_vector vector(256)` — produced when a user saves a style

Each has a HNSW cosine index added in `supabase/migrations/0001_init.sql`.

## Useful queries

```sql
-- Top 5 user clips similar to a reference embedding
SELECT id, name, 1 - (embedding <=> $1) AS similarity
FROM clips
WHERE project_id = $2 AND type = 'user'
ORDER BY embedding <=> $1
LIMIT 5;

-- All public styles ordered by usage
SELECT id, name, content_type, usage_count
FROM styles
WHERE is_public = true
ORDER BY usage_count DESC
LIMIT 20;
```

## Migrations

```bash
# Generate from schema.prisma
npx prisma migrate dev --name init

# Apply pgvector-only changes
psql $DATABASE_URL -f supabase/migrations/0001_init.sql

# Reseed
npx prisma db seed
```
