import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { WorkerTokenGuard } from "../common/guards/worker-token.guard";
import { RenderService } from "./render.service";

/**
 * Worker → API callbacks for the renderer. Protected by WorkerTokenGuard.
 */
@Controller("render/internal")
@UseGuards(WorkerTokenGuard)
export class RenderInternalController {
  constructor(private readonly render: RenderService) {}

  @Post("complete")
  async complete(@Body() body: { projectId: string; key: string; qualityScore: number }) {
    return this.render.reportComplete(body.projectId, body.key, body.qualityScore);
  }

  @Post("failed")
  async failed(@Body() body: { projectId: string; error: string }) {
    return this.render.reportFailed(body.projectId, body.error);
  }
}
