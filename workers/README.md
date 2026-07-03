# VisionCut AI — Python Workers

Six independent FastAPI services, one per concern. Each runs on its own port and
talks to the NestJS backend via REST + Redis (Bull) jobs.

| Service              | Port | Responsibility                                                  |
| -------------------- | ---- | --------------------------------------------------------------- |
| `reference_analyzer` | 8001 | Gemini reference video analysis, Whisper, Librosa, OpenCV       |
| `clip_analyzer`      | 8002 | YOLO + OpenCV per-clip features, FAISS embeddings               |
| `timeline_builder`   | 8003 | Reference shot → top-K clip matching, segment + alternatives   |
| `renderer`           | 8004 | FFmpeg render pipeline, SSIM perceptual quality scoring        |
| `style_engine`       | 8005 | Vectorize blueprints, save/load, similarity search              |
| `feedback_engine`    | 8006 | Aggregate thumbs, update per-user feature weights              |

## Run all (local)

```bash
cd workers
bash scripts/run_all.sh
```

## Run one

```bash
cd workers/reference_analyzer
uvicorn main:app --reload --port 8001
```

## Common modules

- `common/db.py` — asyncpg + pgvector client
- `common/redis_client.py` — Bull-compatible Redis client
- `common/models/` — Pydantic v2 DTOs shared with the API
- `common/utils/` — logging, retry, frame extraction, FAISS helpers
