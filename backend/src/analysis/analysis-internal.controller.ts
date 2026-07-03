import { Body, Controller, NotFoundException, Post } from "@nestjs/common";
import { AnalysisService } from "./analysis.service";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Worker → API callbacks. Authenticated via X-Worker-Token header in production.
 * In dev this is open to ease local debugging.
 */
@Controller("analysis/internal")
export class AnalysisInternalController {
  constructor(
    private readonly analysis: AnalysisService,
    private readonly prisma: PrismaService
  ) {}

  @Post("progress")
  async progress(@Body() body: { projectId: string; step: string; percent: number; detail?: string }) {
    if (!body?.projectId) throw new NotFoundException("projectId required");
    return this.analysis.reportProgress(body.projectId, body.step, body.percent, body.detail);
  }

  @Post("blueprint")
  async blueprint(@Body() body: { projectId: string; blueprint: any }) {
    return this.analysis.reportBlueprint(body.projectId, body.blueprint);
  }

  @Post("timeline")
  async timeline(@Body() body: { projectId: string; timeline: any }) {
    return this.analysis.reportTimeline(body.projectId, body.timeline);
  }
}
