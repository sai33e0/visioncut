import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { UuidValidationPipe } from "../common/pipes/uuid.pipe";
import { PrismaService } from "../prisma/prisma.service";
import { AnalysisService } from "./analysis.service";

@Controller("analysis")
@UseGuards(JwtAuthGuard)
export class AnalysisController {
  constructor(
    private readonly analysis: AnalysisService,
    private readonly prisma: PrismaService
  ) {}

  @Post(":projectId/start")
  async start(
    @CurrentUser() user: { id: string },
    @Param("projectId", UuidValidationPipe) projectId: string
  ) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId: user.id } });
    if (!project) throw new NotFoundException("Project not found");
    if (!project.referenceUrl) throw new BadRequestException("Reference video not uploaded yet");

    const clips = await this.prisma.clip.findMany({ where: { projectId } });
    if (clips.length < 1) throw new BadRequestException("Upload at least one user clip");

    return this.analysis.start(user.id, projectId, project.referenceUrl, clips.map((c) => c.id));
  }

  @Get(":projectId/status")
  status(
    @CurrentUser() user: { id: string },
    @Param("projectId", UuidValidationPipe) projectId: string
  ) {
    return this.analysis.status(user.id, projectId);
  }

  @Get(":projectId/blueprint")
  blueprint(
    @CurrentUser() user: { id: string },
    @Param("projectId", UuidValidationPipe) projectId: string
  ) {
    return this.analysis.blueprint(user.id, projectId);
  }
}
