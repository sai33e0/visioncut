import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AnalysisService } from "../analysis/analysis.service";
import { ProjectStatus, TimelineSegment } from "@prisma/client";
import { WorkerClient } from "../common/clients/worker.client";

@Injectable()
export class TimelineService {
  private readonly logger = new Logger(TimelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analysis: AnalysisService,
    private readonly workers: WorkerClient
  ) {}

  async getForUser(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { segments: { orderBy: { position: "asc" }, include: {} } },
    });
    if (!project) throw new NotFoundException("Project not found");
    return {
      projectId: project.id,
      status: project.status,
      progress: project.progress,
      segments: project.segments,
    };
  }

  async getSegment(userId: string, projectId: string, segmentId: string) {
    const seg = await this.prisma.timelineSegment.findFirst({
      where: { id: segmentId, project: { id: projectId, userId } },
    });
    return seg;
  }

  async explain(seg: TimelineSegment) {
    const reason = (seg.matchReason as any) ?? {};
    const selectedClip = seg.clipId
      ? await this.prisma.clip.findUnique({ where: { id: seg.clipId } })
      : null;

    return {
      segmentId: seg.id,
      position: seg.position,
      startTime: seg.startTime,
      endTime: seg.endTime,
      selectedClip: selectedClip
        ? {
            clipId: selectedClip.id,
            name: selectedClip.name,
            confidence: Math.round(seg.confidence * 100),
            matched: reason.matched ?? [],
            notMatched: reason.notMatched ?? [],
          }
        : null,
      transition: seg.transition,
      reason,
    };
  }

  async alternativesFor(seg: TimelineSegment) {
    return (seg.alternatives as any[]) ?? [];
  }

  async swap(userId: string, projectId: string, segmentId: string, newClipId: string) {
    const seg = await this.getSegment(userId, projectId, segmentId);
    if (!seg) throw new NotFoundException("Segment not found");

    const newClip = await this.prisma.clip.findFirst({
      where: { id: newClipId, projectId },
    });
    if (!newClip) throw new NotFoundException("New clip not in this project");

    const alts = ((seg.alternatives as any[]) ?? []).map((a) =>
      a.clipId === newClipId ? { ...a, wasSelected: true } : a
    );

    return this.prisma.timelineSegment.update({
      where: { id: seg.id },
      data: { clipId: newClip.id, alternatives: alts as any },
    });
  }

  /** Manual re-build trigger. The Python timeline builder rewrites the
   *  timeline_segments table and emits `analysis.timeline.ready` which
   *  fires the orchestrator's auto-render.
   */
  async rebuild(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw new NotFoundException("Project not found");
    if (!project.blueprint) throw new NotFoundException("Project has no blueprint yet");

    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.building, progress: 60, currentStep: "Rebuilding timeline" },
    });
    try {
      await this.workers.buildTimelineFromProject(projectId, userId);
    } catch (e: any) {
      this.logger.error(`rebuild failed for ${projectId}: ${e?.message ?? e}`);
      throw new NotFoundException(`Timeline build failed: ${e?.message ?? e}`);
    }
  }
}
