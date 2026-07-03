# VisionCut AI — Integration Guide

Everything you need to wire real third-party services into the running app.

---

## 1. Database — Supabase / PostgreSQL + pgvector

The Prisma schema in `backend/prisma/schema.prisma` and the SQL file `supabase/migrations/0002_full_schema.sql` are interchangeable. Pick one:

**Option A — Supabase (recommended for prod)**
1. Create a Supabase project, copy the connection string into `.env`:
   ```
   DATABASE_URL=postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:6543/postgres
   DIRECT_URL=postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```
2. From repo root: `make db-sql` (runs `scripts/migrate.js` and applies all SQL files).
3. `cd backend && npx prisma db push` — Prisma creates the same tables, migrations add the HNSW indexes.
4. `cd backend && npx prisma db seed` — creates `demo@visioncut.ai / demo1234`.

**Option B — Local Postgres via Docker**
```
docker compose up -d postgres
make db-sql-reset      # drops public schema + reapplies SQL
cd backend && npx prisma db push && npx prisma db seed
```

**Verify**
```
curl http://localhost:3001/api/health    # services.database should be true
```

---

## 2. Redis (Bull job queue + cache)

Required for `@nestjs/bull` and `@nestjs/cache-manager`.

```
REDIS_URL=redis://localhost:6379
```

Local:
```
docker compose up -d redis
```

Hosted: Upstash, Redis Cloud, or any managed Redis. Paste the URL into `.env`. If `REDIS_URL` is empty the app falls back to in-memory cache + a stub Bull config (single-process only).

---

## 3. Cloudflare R2 (object storage)

Backend has a clean abstraction (`storage/storage.interface.ts`) with two impls:
- `R2StorageService` (prod) — S3-compatible client pointed at Cloudflare R2.
- `LocalStorageService` (dev) — writes to `./storage/`, served via `/api/uploads/asset`.

**R2 setup**
1. Cloudflare dashboard → R2 → Create bucket (`visioncut-media`).
2. R2 → Manage R2 API Tokens → Create token with `Object Read & Write` on the bucket.
3. R2 → bucket → Settings → Public access → enable a public dev domain (or your own).
4. Fill `.env`:
   ```
   R2_ACCOUNT_ID=<cloudflare account id>
   R2_ACCESS_KEY_ID=<token access key>
   R2_SECRET_ACCESS_KEY=<token secret>
   R2_BUCKET=visioncut-media
   R2_PUBLIC_URL=https://media.your-domain.com
   ```
5. Restart the backend. The factory in `storage/storage.module.ts` auto-picks R2 when those 3 vars are set.

**Test a presign**
```
curl -X POST http://localhost:3001/api/uploads/presign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"kind":"reference","projectId":"<uuid>","filename":"ref.mp4","contentType":"video/mp4"}'
```

---

## 4. Google Gemini (reference analyzer)

The Python `reference_analyzer` sends the video + deterministic hints to Gemini 1.5 Pro and parses the JSON blueprint.

```
GEMINI_API_KEY=<your-key>
```

In Google AI Studio → API keys → Create key. Free tier is enough for the prototype.

If `GEMINI_API_KEY` is unset the worker falls back to a deterministic blueprint (OpenCV cues only) — useful in CI.

---

## 5. JWT secret

The backend signs auth tokens with this. **Must be ≥ 16 chars in dev, ≥ 32 in prod.**
```
JWT_SECRET=replace-with-32-char-random-string
JWT_EXPIRES_IN=7d
```

Generate one:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 6. Worker token (NestJS ↔ Python auth)

Both directions of the worker bridge authenticate with a shared token in `X-Worker-Token`:
```
WORKER_TOKEN=replace-with-8+-char-shared-secret
```

The Python `common/api.py` reads it from `WORKER_TOKEN` env. If unset, both sides fall back to "accept anything" — fine for local dev, **never** leave it unset in prod.

---

## 7. Sentry (observability)

```
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
```

The backend initializes Sentry on boot if `SENTRY_DSN` is set (`backend/src/main.ts:15`). Python workers do the same in their `startup` event.

---

## 8. GPU (RTX 3050) wiring

Per-worker env knobs (default = auto-detect on the host):
```
USE_GPU_OPENCV=true
USE_GPU_WHISPER=true
USE_GPU_YOLO=true
USE_GPU_FAISS=true
RENDER_USE_GPU=true
CUDA_DEVICE=0
```

**One-time host setup**
1. Install NVIDIA driver (≥ 535) + CUDA 12.1 runtime.
2. `pip install torch==2.5.0+cu121 torchvision==0.20.0+cu121 --index-url https://download.pytorch.org/whl/cu121`
3. `pip install ultralytics` (auto-detects CUDA).
4. `pip install faster-whisper==1.0.3` for the CTranslate2 path.
5. `pip install faiss-gpu==1.7.2.post1` for GPU FAISS. (Can't ship in `requirements.txt` because it links CUDA libs.)
6. Rebuild ffmpeg with `--enable-nvenc --enable-cuda` or use `jrottenberg/ffmpeg:6.1-nvidia`.

**Boot-time verification**
Every worker prints a one-liner:
```
gpu_profile ffmpeg=gpu opencv=gpu whisper=gpu yolo=gpu faiss=gpu
```

---

## 9. Cloudinary / Supabase Storage (alternative to R2)

If you prefer Supabase Storage:
- Create a `visioncut-media` bucket (public read).
- Set `R2_*` to empty so the factory picks `LocalStorageService`, then write a new `SupabaseStorageService` that implements `IStorageService`. Drop it in `storage/`, swap the factory in `storage.module.ts`.

---

## 10. Email (password reset, etc.)

Not implemented yet. Plan: add `@nestjs-modules/mailer` + a SES/Resend transport, and a `PasswordResetToken` Prisma model. Hook the `/auth/forgot` and `/auth/reset` routes. Out of scope for the current build.

---

## 11. Stripe (paid plan / credit top-up)

Not implemented yet. Plan: add `Plan` upgrades via Stripe Checkout, listen for `checkout.session.completed` webhook in `billing/` module, bump `users.credits` and `users.plan` accordingly. The `Plan` enum and `credits` column are already in place.

---

## Running everything

```
cp .env.example .env             # fill in keys
make db-sql                      # apply SQL migrations
cd backend && npx prisma db push && npx prisma db seed && cd ..
make dev                         # concurrently: frontend (3000) + backend (3001)
make dev-workers                 # all 6 Python workers
make health                      # pings /api/health on every service
```

Login with `demo@visioncut.ai / demo1234` and you're in.

---

## Service URLs (defaults)

| Service            | Local URL                          |
|--------------------|------------------------------------|
| Frontend (Next)    | http://localhost:3000              |
| Backend (NestJS)   | http://localhost:3001              |
| WebSocket          | ws://localhost:3001 (same port)    |
| Reference analyzer | http://localhost:8001              |
| Clip analyzer      | http://localhost:8002              |
| Timeline builder   | http://localhost:8003              |
| Renderer           | http://localhost:8004              |
| Style engine       | http://localhost:8005              |
| Feedback engine    | http://localhost:8006              |
| Postgres           | localhost:54322 (in container)     |
| Redis              | localhost:6379                     |
| R2 dev fallback    | ./storage/  → http://localhost:3001/media/<key> |
