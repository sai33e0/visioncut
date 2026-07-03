import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { Project, ProjectStatus } from "@prisma/client";

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { clips: true, segments: true } } },
    });
  }

  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    if (user.credits <= 0 && user.plan === "free") {
      throw new Error("No credits remaining. Upgrade to Pro for unlimited projects.");
    }

    const project = await this.prisma.project.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        status: ProjectStatus.uploading,
        referenceUrl: dto.referenceUrl,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: user.plan === "free" ? 1 : 0 } },
    });

    await this.recordEvent(userId, project.id, "project_created", { name: dto.name });
    return project;
  }

  async getForUser(userId: string, id: string) {
    return this.prisma.project.findFirst({
      where: { id, userId },
      include: {
        clips: { orderBy: { createdAt: "asc" } },
        segments: { orderBy: { position: "asc" } },
      },
    });
  }

  async deleteForUser(userId: string, id: string) {
    const project = await this.prisma.project.findFirst({ where: { id, userId } });
    if (!project) throw new NotFoundException("Project not found");
    await this.prisma.project.delete({ where: { id } });
  }

  async setStatus(projectId: string, status: ProjectStatus, error?: string) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: { status, errorMessage: error ?? null },
    });
  }

  async setProgress(projectId: string, progress: number, currentStep?: string) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: { progress, currentStep: currentStep ?? null },
    });
  }

  async setBlueprint(projectId: string, blueprint: any) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: { blueprint: blueprint as any },
    });
  }

  async setTimeline(projectId: string, timeline: any, qualityScore?: number) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: { timeline: timeline as any, qualityScore: qualityScore ?? null },
    });
  }

  private recordEvent(userId: string, projectId: string, type: any, payload: any) {
    return this.prisma.analyticsEvent.create({
      data: { userId, projectId, eventType: type, payload: payload as any },
    });
  }
}
