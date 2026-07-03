# VisionCut AI

> Upload a reference video and your raw footage. The system understands the editing style, identifies required assets, explains every decision, learns your preferences over time, and automatically recreates a similar edit using only your media.

[![Node](https://img.shields.io/badge/Node-%E2%89%A520-green)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.11%2B-blue)](https://python.org)
[![License](https://img.shields.io/badge/license-MIT-purple)](LICENSE)

## Architecture at a glance

```
                ┌──────────────────────┐
                │  Next.js (Vercel)    │  UI + dashboards
                └──────────┬───────────┘
                           │ REST + WebSocket
                ┌──────────▼───────────┐
                │   NestJS API         │  Auth, projects, jobs
                └──────┬───────┬───────┘
                       │       │
              ┌────────▼─┐  ┌───▼────┐
              │  Redis   │  │  R2    │  cache + storage
              └────────┬─┘  └────────┘
                       │
   ┌───────────┬───────┼───────┬────────────┬────────────┐
   ▼           ▼       ▼       ▼            ▼            ▼
reference  clip       timeline  renderer   style       feedback
analyzer   analyzer   builder                engine      engine
(Gemini +  (YOLO +    (FAISS +  (FFmpeg)   (pgvector)  (weights)
 Whisper)   OpenCV)    hybrid)
```

## 19 modules (everything wired up)

| #   | Module                          | Lives in              |
| --- | ------------------------------- | --------------------- |
| 01  | Project Creation                | `backend`, `frontend` |
| 02  | Reference Intelligence Engine   | `workers/reference_*` |
| 03  | Blueprint Engine                | `workers/reference_*` |
| 04  | Asset Requirement Engine        | `backend`             |
| 05  | Gap Analysis Engine             | `backend`             |
| 06  | Asset Recommendation Engine     | `backend`             |
| 07  | User Asset Upload               | `backend`, `frontend` |
| 08  | Clip Intelligence Engine        | `workers/clip_*`      |
| 09  | Similarity Matching Engine      | `workers/clip_*`      |
| 10  | Explainable Decision Engine     | `backend`, `frontend` |
| 11  | Timeline Builder                | `workers/timeline_*`  |
| 12  | Asset Placement Engine          | `workers/timeline_*`  |
| 13  | Transparent Live Editing        | `frontend` (WS log)   |
| 14  | Explain Button                  | `frontend`            |
| 15  | Rendering Engine                | `workers/renderer`    |
| 16  | Quality Engine (perceptual)     | `workers/renderer`    |
| 17  | Style Library                   | `backend`, `frontend` |
| 18  | Feedback Loop Engine            | `workers/feedback_*`  |
| 19  | Analytics Dashboard             | `backend`, `frontend` |

## Quickstart (local, no Docker)

```bash
# 1. Clone and configure
cp .env.example .env

# 2. Install everything
npm run setup

# 3. Start postgres + redis (Docker)
docker compose up -d postgres redis

# 4. Push schema
npm run db:push

# 5. Launch everything in parallel
npm run dev                 # frontend (3000) + backend (3001)
npm run dev:workers         # python workers (8001-8006)
```

Open <http://localhost:3000>. The backend health check is at <http://localhost:3001/health>.

## Quickstart (full Docker)

```bash
docker compose up -d
docker compose logs -f
```

## Documentation

- [Module map](docs/MODULES.md)
- [API reference](docs/API.md)
- [Database schema](docs/SCHEMA.md)
- [Deployment guide](docs/DEPLOY.md)

## License

MIT
# visioncut
