import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "../prisma/prisma.service";
import { WorkerClient } from "../common/clients/worker.client";
import { AnalysisGateway } from "../websocket/analysis.gateway";
import { ProjectStatus } from "@prisma/client";

/**
 * Cross-module event bus glue. Listens for analysis milestones and kicks
 * off the next stage. Uses @nestjs/event-emitter so the analysis service
 * can stay decoupled from the timeline builder.
 */
@Injectable()
export class AnalysisOrchestrator {
  private readonly logger = new Logger(AnalysisOrchestrator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workers: WorkerClient,
    private readonly gateway: AnalysisGateway
  ) {}

  /** Fired when the Python reference analyzer reports a blueprint. */
  @OnEvent("analysis.blueprint.ready", { async: true })
  async onBlueprintReady(payload: { projectId: string }) {
    const { projectId } = payload;
    try {
      const project = await this.prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return;
      // Skip if a style template already gave us a blueprint
      if (!project.blueprint) {
        this.logger.warn(`blueprint ready but missing for ${projectId} — likely worker wrote only to internal endpoint`);
        return;
      }

      // Kick off clip analysis in parallel for all clips attached to the project
      const clips = await this.prisma.clip.findMany({
        where: { projectId, type: "user" },
        select: { id: true, url: true },
      });
      if (clips.length > 0) {
        await this.workers.analyzeClipsBatch(
          clips.map((c) => ({ clipId: c.id, projectId, url: c.url, precomputeEmbedding: true }))
        );
      }

      // Once we have the blueprint, enqueue timeline build
      this.gateway.emitProgress(projectId, "Building timeline", 60);
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.building, progress: 60, currentStep: "Building timeline" },
      });
      const built = await this.workers.buildTimelineFromProject(projectId, project.userId);
      this.gateway.emitProgress(projectId, "Timeline ready", 75);
      this.logger.log(`timeline built for ${projectId} (quality=${built?.quality_score ?? "?"})`);
    } catch (e: any) {
      this.logger.error(`orchestrator failed for ${projectId}: ${e?.message ?? e}`);
      this.gateway.emitLog(projectId, `Orchestrator error: ${e?.message ?? e}`, "error");
    }
  }

  /** Fired when the timeline builder reports a new timeline. */
  @OnEvent("analysis.timeline.ready", { async: true })
  async onTimelineReady(payload: { projectId: string }) {
    const { projectId } = payload;
    try {
      const project = await this.prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return;
      this.gateway.emitProgress(projectId, "Rendering", 80);
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.rendering, progress: 80, currentStep: "Rendering" },
      });
      await this.workers.renderProject(projectId);
    } catch (e: any) {
      this.logger.error(`auto-render failed for ${projectId}: ${e?.message ?? e}`);
      this.gateway.emitLog(projectId, `Render error: ${e?.message ?? e}`, "error");
    }
  }
}
