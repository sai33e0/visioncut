import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ProjectStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AnalysisGateway } from "../websocket/analysis.gateway";
import { WorkerClient } from "../common/clients/worker.client";

/**
 * Orchestrates the analysis pipeline by calling the Python workers directly.
 * The Bull queues declared in QueueModule remain available for future
 * non-real-time jobs (e.g. batch re-renders) but the user-facing flow
 * goes straight to the workers so progress is visible via WebSocket.
 */
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AnalysisGateway,
    private readonly events: EventEmitter2,
    private readonly workers: WorkerClient
  ) {}

  async start(userId: string, projectId: string, referenceUrl: string, clipIds: string[]) {
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.analyzing, progress: 5, currentStep: "Queued" },
    });
    this.gateway.emitProgress(projectId, "Queued", 5);
    await this.recordEvent(userId, projectId, "project_analyzed", { referenceUrl, clipCount: clipIds.length });

    // Fire the reference analyzer. The Python worker emits its own progress
    // through /api/analysis/internal/progress, then calls
    // /api/analysis/internal/blueprint to deliver the result. The orchestrator
    // listens for `analysis.blueprint.ready` to fan out clip analysis + timeline.
    try {
      await this.workers.analyzeReference(projectId, referenceUrl);
    } catch (e: any) {
      this.logger.error(`reference analyzer failed for ${projectId}: ${e?.message ?? e}`);
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.failed, errorMessage: e?.message ?? "Reference analyzer failed" },
      });
      this.gateway.emitProgress(projectId, `Reference analysis failed: ${e?.message ?? e}`, -1);
    }

    return { ok: true, status: "analyzing" };
  }

  async status(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) return { status: "unknown", progress: 0 };
    return {
      status: project.status,
      progress: project.progress,
      currentStep: project.currentStep,
      error: project.errorMessage,
    };
  }

  async blueprint(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) return null;
    return project.blueprint;
  }

  /**
   * Called by Python workers when each stage completes.
   * The worker hits /api/analysis/internal/progress with {projectId, step, percent}.
   */
  async reportProgress(projectId: string, step: string, percent: number, detail?: string) {
    this.gateway.emitProgress(projectId, step, percent, detail);
    await this.prisma.project.update({
      where: { id: projectId },
      data: { progress: Math.min(99, percent), currentStep: step },
    });
    this.gateway.emitLog(projectId, `${step} ${percent ? `(${percent}%)` : ""}`.trim());
  }

  async reportBlueprint(projectId: string, blueprint: any) {
    await this.prisma.project.update({
      where: { id: projectId },
      data: { blueprint: blueprint as any },
    });
    this.gateway.emitLog(projectId, "Blueprint ready");
    this.events.emit("analysis.blueprint.ready", { projectId });
  }

  async reportTimeline(projectId: string, timeline: any) {
    await this.prisma.project.update({
      where: { id: projectId },
      data: { timeline: timeline as any, status: ProjectStatus.building },
    });
    this.gateway.emitLog(projectId, "Timeline built");
    this.events.emit("analysis.timeline.ready", { projectId });
  }

  private recordEvent(userId: string, projectId: string, type: any, payload: any) {
    return this.prisma.analyticsEvent.create({
      data: { userId, projectId, eventType: type, payload: payload as any },
    });
  }
}
