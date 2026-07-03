import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SubmitFeedbackDto } from "./dto/submit-feedback.dto";
import { FeedbackRating } from "@prisma/client";
import { WorkerClient } from "../common/clients/worker.client";

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workers: WorkerClient
  ) {}

  /** Record feedback, then push to the Python feedback_engine for weight updates. */
  async record(userId: string, dto: SubmitFeedbackDto) {
    const project = await this.prisma.project.findFirst({ where: { id: dto.projectId, userId } });
    if (!project) throw new NotFoundException("Project not found");

    const fb = await this.prisma.feedback.create({
      data: {
        userId,
        projectId: dto.projectId,
        segmentId: dto.segmentId,
        clipId: dto.clipId,
        rating: dto.rating as FeedbackRating,
        comment: dto.comment,
      },
    });

    // Fire-and-forget: the Python engine will update feature_weights
    this.workers
      .recordFeedback({
        userId,
        projectId: dto.projectId,
        segmentPosition: undefined,
        clipId: dto.clipId,
        rating: dto.rating === "up" ? 1 : -1,
      })
      .catch(() => undefined);

    return fb;
  }

  /** Local preferences + accuracy, with the Python engine as the source of truth for weights. */
  async preferencesFor(userId: string) {
    const local =
      (await this.prisma.userPreference.findUnique({ where: { userId } })) ??
      (await this.prisma.userPreference.create({ data: { userId } }));

    const aggregates = await this.prisma.feedback.groupBy({
      by: ["rating"],
      where: { userId },
      _count: { _all: true },
    });
    const total = aggregates.reduce((s, a) => s + a._count._all, 0);
    const up = aggregates.find((a) => a.rating === FeedbackRating.up)?._count._all ?? 0;

    let workerPrefs: any = null;
    try {
      workerPrefs = await this.workers.getPreferences(userId);
    } catch {
      // worker offline — fall back to local feature_weights
    }

    return {
      preferences: local,
      weights: workerPrefs?.weights ?? local.featureWeights ?? null,
      stats: {
        total,
        up,
        down: total - up,
        accuracy: total === 0 ? null : Math.round((up / total) * 100),
      },
      accuracy_estimate: workerPrefs?.accuracy_estimate ?? null,
    };
  }
}
