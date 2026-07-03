import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { UuidValidationPipe } from "../common/pipes/uuid.pipe";
import { TimelineService } from "./timeline.service";

@Controller("timeline")
@UseGuards(JwtAuthGuard)
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get(":projectId")
  async get(
    @CurrentUser() user: { id: string },
    @Param("projectId", UuidValidationPipe) projectId: string
  ) {
    return this.timeline.getForUser(user.id, projectId);
  }

  @Get(":projectId/segment/:segmentId/explain")
  async explain(
    @CurrentUser() user: { id: string },
    @Param("projectId", UuidValidationPipe) projectId: string,
    @Param("segmentId", UuidValidationPipe) segmentId: string
  ) {
    const seg = await this.timeline.getSegment(user.id, projectId, segmentId);
    if (!seg) throw new NotFoundException("Segment not found");
    return this.timeline.explain(seg);
  }

  @Get(":projectId/segment/:segmentId/alternatives")
  async alternatives(
    @CurrentUser() user: { id: string },
    @Param("projectId", UuidValidationPipe) projectId: string,
    @Param("segmentId", UuidValidationPipe) segmentId: string
  ) {
    const seg = await this.timeline.getSegment(user.id, projectId, segmentId);
    if (!seg) throw new NotFoundException("Segment not found");
    return this.timeline.alternativesFor(seg);
  }

  @Put(":projectId/segment/:segmentId/swap")
  async swap(
    @CurrentUser() user: { id: string },
    @Param("projectId", UuidValidationPipe) projectId: string,
    @Param("segmentId", UuidValidationPipe) segmentId: string,
    @Body() body: { newClipId: string }
  ) {
    if (!body?.newClipId) throw new BadRequestException("newClipId required");
    return this.timeline.swap(user.id, projectId, segmentId, body.newClipId);
  }

  @Post(":projectId/build")
  async build(
    @CurrentUser() user: { id: string },
    @Param("projectId", UuidValidationPipe) projectId: string
  ) {
    // Hand off to the Python timeline builder synchronously via WorkerClient.
    // The orchestrator does this automatically after a blueprint arrives;
    // this endpoint is a manual "rebuild" button.
    await this.timeline.rebuild(user.id, projectId);
    return { ok: true, status: "queued" };
  }
}
