import { Injectable, Logger } from "@nestjs/common";
import { ProjectStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AnalysisGateway } from "../websocket/analysis.gateway";

@Injectable()
export class RenderService {
  private readonly logger = new Logger(RenderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AnalysisGateway
  ) {}

  async start(userId: string, projectId: string) {
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.rendering, progress: 80, currentStep: "Render queued" },
    });
    this.gateway.emitProgress(projectId, "Render queued", 80);
    await this.prisma.analyticsEvent.create({
      data: { userId, projectId, eventType: "render_started" },
    });
    return { ok: true, status: "rendering" };
  }

  async status(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) return { status: "unknown" };
    return { status: project.status, progress: project.progress, error: project.errorMessage };
  }

  async reportComplete(projectId: string, key: string, qualityScore: number) {
    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.done,
        progress: 100,
        currentStep: "Done",
        qualityScore,
      },
    });
    const last = await this.prisma.timelineSegment.findFirst({
      where: { projectId },
      orderBy: { position: "desc" },
    });
    if (last) {
      await this.prisma.timelineSegment.update({
        where: { id: last.id },
        data: { renderPath: key },
      });
    }
    this.gateway.emitProgress(projectId, "Done", 100);
  }

  async reportFailed(projectId: string, error: string) {
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.failed, errorMessage: error },
    });
    this.gateway.emitLog(projectId, `Render failed: ${error}`, "error");
  }
}
