import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AnalyticsService } from "./analytics.service";

@Controller("analytics")
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("summary")
  summary(@CurrentUser() user: { id: string }) {
    return this.analytics.summary(user.id);
  }

  @Get("transitions")
  transitions(@CurrentUser() user: { id: string }) {
    return this.analytics.transitions(user.id);
  }

  @Get("projects")
  projects(
    @CurrentUser() user: { id: string },
    @Query("limit") limit?: string
  ) {
    return this.analytics.projectHistory(user.id, Number(limit ?? 50));
  }

  @Get("feedback-accuracy")
  feedbackAccuracy(@CurrentUser() user: { id: string }) {
    return this.analytics.feedbackAccuracy(user.id);
  }

  @Get("quality-over-time")
  qualityOverTime(@CurrentUser() user: { id: string }) {
    return this.analytics.qualityOverTime(user.id);
  }

  @Get("content-mix")
  contentMix(@CurrentUser() user: { id: string }) {
    return this.analytics.contentMix(user.id);
  }
}
