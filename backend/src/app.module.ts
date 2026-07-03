import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CacheModule } from "@nestjs/cache-manager";
import { BullModule } from "@nestjs/bull";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { redisStore } from "cache-manager-redis-store";

import { CommonModule } from "./common/common.module";
import { AuthModule } from "./auth/auth.module";
import { ProjectsModule } from "./projects/projects.module";
import { UploadsModule } from "./uploads/uploads.module";
import { AnalysisModule } from "./analysis/analysis.module";
import { TimelineModule } from "./timeline/timeline.module";
import { StylesModule } from "./styles/styles.module";
import { FeedbackModule } from "./feedback/feedback.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { RenderModule } from "./render/render.module";
import { QualityModule } from "./quality/quality.module";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { StorageModule } from "./storage/storage.module";
import { QueueModule } from "./queue/queue.module";
import { WebSocketModule } from "./websocket/websocket.module";
import { configValidationSchema } from "./config/config.validation";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: configValidationSchema,
    }),

    EventEmitterModule.forRoot({
      // Set to true to silence the "no listeners" warning during dev
      wildcard: false,
      delimiter: ".",
      maxListeners: 32,
    }),

    // Redis cache (graceful fallback to in-memory if REDIS_URL is missing)
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
        const url = process.env.REDIS_URL;
        if (!url) {
          return { ttl: 5_000 };
        }
        const store = await redisStore({ url, ttl: 5_000 });
        return { store: store as any, ttl: 5_000 };
      },
    }),

    BullModule.forRootAsync({
      useFactory: () => {
        const url = process.env.REDIS_URL;
        if (!url) {
          return { redis: { host: "127.0.0.1", port: 6379 } };
        }
        const u = new URL(url);
        return { redis: { host: u.hostname, port: Number(u.port || 6379) } };
      },
    }),

    ThrottlerModule.forRoot([
      { name: "short", ttl: 1_000, limit: 5 },
      { name: "medium", ttl: 60_000, limit: 100 },
      { name: "long", ttl: 3_600_000, limit: 500 },
    ]),

    PrismaModule,
    StorageModule,
    CommonModule,            // WorkerClient + HttpModule (global)
    QueueModule,
    WebSocketModule,
    HealthModule,
    AuthModule,
    ProjectsModule,
    UploadsModule,
    AnalysisModule,
    TimelineModule,
    StylesModule,
    FeedbackModule,
    AnalyticsModule,
    RenderModule,
    QualityModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
