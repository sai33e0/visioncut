import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class QualityService {
  constructor(private readonly prisma: PrismaService) {}

  async report(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { segments: { orderBy: { position: "asc" } } },
    });
    if (!project) return null;

    const segments = project.segments;
    const transitions = new Set(segments.map((s) => s.transition).filter(Boolean));
    const avgConfidence = segments.length
      ? segments.reduce((s, x) => s + x.confidence, 0) / segments.length
      : 0;

    return {
      projectId,
      pacingMatch: project.qualityScore ?? Math.round(avgConfidence * 100),
      transitionMatch: Math.min(100, transitions.size * 20),
      audioMatch: null as number | null,
      perceptualMatch: null as number | null,
      overall: project.qualityScore ?? Math.round(avgConfidence * 100),
      segmentCount: segments.length,
      confidenceAvg: Math.round(avgConfidence * 100),
    };
  }
}
