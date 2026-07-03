# VisionCut AI — Backend (NestJS)

NestJS 10 + Prisma + Bull (Redis) + Supabase + Sentry.

## Scripts

```bash
npm run start:dev   # watch mode on :3001
npm run start:prod
npm run build
npm run test
npm run test:e2e
npm run prisma:generate
npm run prisma:push
npm run prisma:studio
```

## Module map

| Path                       | Responsibility                            |
| -------------------------- | ----------------------------------------- |
| `auth/`                    | JWT register/login/refresh, guards        |
| `projects/`                | CRUD, ownership, status transitions       |
| `uploads/`                 | Chunked uploads, R2 (with local fallback) |
| `analysis/`                | Bull job dispatch + WebSocket progress    |
| `timeline/`                | Read timeline, explain, alternatives, swap|
| `styles/`                  | Style library CRUD + apply                |
| `feedback/`                | Thumbs up/down + preference retrieval     |
| `analytics/`               | Summary, transitions, history             |
| `render/`                  | Render job dispatch + status              |
| `quality/`                 | Quality report retrieval                  |
| `websocket/`               | AnalysisGateway for live progress         |
| `storage/`                 | R2 / local-FS abstraction                 |
| `queue/`                   | Bull queue wrappers per worker            |
| `health/`                  | `/health` deep check                      |
| `prisma/`                  | PrismaClient service                      |
