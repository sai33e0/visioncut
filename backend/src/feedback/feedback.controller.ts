import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { FeedbackService } from "./feedback.service";
import { SubmitFeedbackDto } from "./dto/submit-feedback.dto";

@Controller("feedback")
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post()
  async submit(@CurrentUser() user: { id: string }, @Body() dto: SubmitFeedbackDto) {
    return this.feedback.record(user.id, dto);
  }

  @Get("preferences")
  preferences(@CurrentUser() user: { id: string }) {
    return this.feedback.preferencesFor(user.id);
  }
}
