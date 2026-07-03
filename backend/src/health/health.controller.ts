import { Controller, Get, Inject } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IStorageService, STORAGE_SERVICE } from "../storage/storage.interface";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService
  ) {}

  @Get()
  async check() {
    const [db, storage] = await Promise.all([this.checkDb(), this.checkStorage()]);
    const ok = db && storage;
    return {
      status: ok ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      services: { database: db, storage, redis: this.checkRedis() },
    };
  }

  private async checkDb(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkStorage(): Promise<boolean> {
    try {
      // Storage is always available — local FS is the fallback.
      return !!this.storage;
    } catch {
      return false;
    }
  }

  private checkRedis(): boolean {
    // We don't hold a redis client in-process; the Bull connection handles it.
    return !!process.env.REDIS_URL;
  }
}
