import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FeedbackRating, ProjectStatus } from "@prisma/client";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string) {
    const [projects, avgQuality, totalClips, totalEvents, bestStyle] = await Promise.all([
      this.prisma.project.findMany({
        where: { userId, status: ProjectStatus.done },
        select: { qualityScore: true, createdAt: true, name: true, id: true },
      }),
      this.prisma.project.aggregate({
        where: { userId, status: ProjectStatus.done, qualityScore: { not: null } },
        _avg: { qualityScore: true },
      }),
      this.prisma.clip.count({ where: { project: { userId } } }),
      this.prisma.analyticsEvent.count({ where: { userId } }),
      this.prisma.style.findFirst({
        where: { userId },
        orderBy: { usageCount: "desc" },
        select: { name: true, usageCount: true },
      }),
    ]);

    return {
      projectsCompleted: projects.length,
      avgQualityScore: avgQuality._avg.qualityScore ?? null,
      totalClipsProcessed: totalClips,
      totalEvents,
      bestStyle: bestStyle?.name ?? null,
    };
  }

  async transitions(userId: string) {
    const segments = await this.prisma.timelineSegment.findMany({
      where: { project: { userId } },
      select: { transition: true },
    });
    const counts: Record<string, number> = {};
    for (const s of segments) {
      if (!s.transition) continue;
      counts[s.transition] = (counts[s.transition] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  async projectHistory(userId: string, limit: number) {
    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        status: true,
        qualityScore: true,
        createdAt: true,
        _count: { select: { clips: true, segments: true } },
      },
    });
  }

  async feedbackAccuracy(userId: string) {
    const aggregates = await this.prisma.feedback.groupBy({
      by: ["rating"],
      where: { userId },
      _count: { _all: true },
    });
    const total = aggregates.reduce((s, a) => s + a._count._all, 0);
    const up = aggregates.find((a) => a.rating === FeedbackRating.up)?._count._all ?? 0;
    return {
      total,
      up,
      down: total - up,
      accuracy: total === 0 ? null : Math.round((up / total) * 100),
    };
  }

  /**
   * Quality improvement over time — one data point per completed project,
   * oldest first. Used by the dashboard line chart.
   */
  async qualityOverTime(userId: string) {
    const rows = await this.prisma.project.findMany({
      where: { userId, status: ProjectStatus.done, qualityScore: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, qualityScore: true, createdAt: true },
    });
    return rows.map((r) => ({
      projectId: r.id,
      name: r.name,
      quality: r.qualityScore,
      createdAt: r.createdAt,
    }));
  }

  /** Most used content types / pace combos from project blueprints. */
  async contentMix(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: { userId },
      select: { blueprint: true },
    });
    const counts: Record<string, number> = {};
    const pace: Record<string, number> = {};
    for (const p of projects) {
      const bp: any = p.blueprint ?? {};
      if (bp) {
        const ct = bp.content_type ?? "general";
        counts[ct] = (counts[ct] ?? 0) + 1;
        const pc = bp.pace ?? "medium";
        pace[pc] = (pace[pc] ?? 0) + 1;
      }
    }
    return {
      contentTypes: Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      paces: Object.entries(pace)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    };
  }
}
