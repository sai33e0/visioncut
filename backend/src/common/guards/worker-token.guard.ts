import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Guards /api/*/internal/* endpoints. The Python workers send an
 * `X-Worker-Token` header that must match WORKER_TOKEN. If WORKER_TOKEN
 * is unset, the guard falls back to JWT auth (developer convenience).
 */
@Injectable()
export class WorkerTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const expected = this.config.get<string>("WORKER_TOKEN");
    if (!expected) {
      // Dev fallback: no worker token configured → accept anything.
      return true;
    }
    const got = req.headers["x-worker-token"];
    if (got !== expected) {
      throw new UnauthorizedException("Invalid worker token");
    }
    return true;
  }
}
