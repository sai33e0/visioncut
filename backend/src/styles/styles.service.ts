import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateStyleDto } from "./dto/create-style.dto";
import { AnalysisGateway } from "../websocket/analysis.gateway";
import { WorkerClient } from "../common/clients/worker.client";

@Injectable()
export class StylesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AnalysisGateway,
    private readonly workers: WorkerClient
  ) {}

  listForUser(userId: string) {
    return this.prisma.style.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  publicList(contentType?: string) {
    return this.prisma.style.findMany({
      where: { isPublic: true, ...(contentType ? { contentType } : {}) },
      orderBy: { usageCount: "desc" },
      take: 50,
    });
  }

  async get(userId: string, id: string) {
    return this.prisma.style.findFirst({
      where: { id, OR: [{ userId }, { isPublic: true }] },
    });
  }

  /** Save a style. If blueprint isn't provided, derive it from the project. */
  async create(userId: string, dto: CreateStyleDto) {
    let blueprint = dto.blueprintTemplate;
    if (!blueprint && dto.projectId) {
      const project = await this.prisma.project.findFirst({ where: { id: dto.projectId, userId } });
      if (!project?.blueprint) {
        throw new BadRequestException("Project has no blueprint yet or is not yours");
      }
      blueprint = project.blueprint;
    }
    if (!blueprint) {
      throw new BadRequestException("Provide blueprintTemplate or a projectId");
    }

    // Vectorize via the Python style engine
    let styleVector: number[] | undefined = dto.styleVector;
    if (!styleVector || styleVector.length === 0) {
      try {
        const res = await this.workers.vectorizeBlueprint(blueprint);
        styleVector = res?.style_vector;
      } catch (e: any) {
        // Non-fatal: store without vector, the worker can re-vectorize later
      }
    }

    const style = await this.prisma.style.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        contentType: dto.contentType ?? blueprint?.content_type ?? null,
        pace: dto.pace ?? blueprint?.pace ?? null,
        transitions: dto.transitions ?? blueprint?.transitions ?? null,
        audioComponents: dto.audioComponents ?? blueprint?.audio ?? null,
        blueprintTemplate: blueprint,
        styleVector: styleVector as any,
        isPublic: dto.isPublic ?? false,
      },
    });
    await this.prisma.analyticsEvent.create({
      data: { userId, projectId: dto.projectId, eventType: "style_saved", payload: { styleId: style.id } as any },
    });
    return style;
  }

  async remove(userId: string, id: string) {
    const s = await this.prisma.style.findFirst({ where: { id, userId } });
    if (!s) throw new NotFoundException("Style not found");
    await this.prisma.style.delete({ where: { id } });
  }

  /** Use the Python matcher to find similar styles for a project. */
  async matchingForProject(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw new NotFoundException("Project not found");
    if (!project.blueprint) {
      // No blueprint yet — fall back to recent user/public styles by usage
      return this.prisma.style.findMany({
        where: { OR: [{ userId }, { isPublic: true }] },
        orderBy: { usageCount: "desc" },
        take: 20,
      });
    }
    try {
      const res = await this.workers.matchStyles(userId, project.blueprint, 10);
      if (res?.hits?.length) {
        // Hydrate hits with names from DB
        const ids = res.hits.map((h: any) => h.style_id);
        const styles = await this.prisma.style.findMany({ where: { id: { in: ids } } });
        const byId = new Map(styles.map((s) => [s.id, s]));
        return res.hits
          .map((h: any) => {
            const s = byId.get(h.style_id);
            return s ? { ...s, similarity: h.similarity } : null;
          })
          .filter(Boolean);
      }
    } catch (e: any) {
      // fall through to DB fallback
    }
    return this.prisma.style.findMany({
      where: { OR: [{ userId }, { isPublic: true }] },
      orderBy: { usageCount: "desc" },
      take: 20,
    });
  }

  /** Apply a saved style: copies blueprint + style vector to the project. */
  async apply(userId: string, styleId: string, projectId: string) {
    const style = await this.prisma.style.findFirst({
      where: { id: styleId, OR: [{ userId }, { isPublic: true }] },
    });
    if (!style) throw new NotFoundException("Style not found");

    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw new NotFoundException("Project not found");

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        blueprint: (style.blueprintTemplate as any) ?? undefined,
        styleVector: (style.styleVector as any) ?? undefined,
        status: "analyzing",
        progress: 50,
        currentStep: "Style applied — building timeline",
      } as any,
    });
    await this.prisma.style.update({ where: { id: styleId }, data: { usageCount: { increment: 1 } } });
    await this.prisma.analyticsEvent.create({
      data: { userId, projectId, eventType: "style_applied", payload: { styleId } as any },
    });
    this.gateway.emitLog(projectId, `Style applied: ${style.name}`);

    // Trigger a build on the timeline worker — they have the blueprint now
    try {
      await this.workers.buildTimelineFromProject(projectId, userId);
      this.gateway.emitProgress(projectId, "Style applied", 75);
    } catch (e: any) {
      this.gateway.emitLog(projectId, `Style build failed: ${e?.message ?? e}`, "error");
    }

    return { ok: true, styleId, projectId };
  }
}
