import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { UuidValidationPipe } from "../common/pipes/uuid.pipe";
import { PrismaService } from "../prisma/prisma.service";
import { RenderService } from "./render.service";
import { IStorageService, STORAGE_SERVICE } from "../storage/storage.interface";

@Controller("render")
@UseGuards(JwtAuthGuard)
export class RenderController {
  constructor(
    private readonly render: RenderService,
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService
  ) {}

  @Post(":projectId/start")
  async start(
    @CurrentUser() user: { id: string },
    @Param("projectId", UuidValidationPipe) projectId: string
  ) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId: user.id } });
    if (!project) throw new NotFoundException("Project not found");
    if (!project.timeline) throw new BadRequestException("Timeline not built yet");
    return this.render.start(user.id, projectId);
  }

  @Get(":projectId/status")
  status(
    @CurrentUser() user: { id: string },
    @Param("projectId", UuidValidationPipe) projectId: string
  ) {
    return this.render.status(user.id, projectId);
  }

  @Get(":projectId/download")
  async download(
    @CurrentUser() user: { id: string },
    @Param("projectId", UuidValidationPipe) projectId: string,
    @Res() res: Response
  ) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId: user.id } });
    if (!project) throw new NotFoundException("Project not found");
    const segments = await this.prisma.timelineSegment.findMany({ where: { projectId }, orderBy: { position: "asc" } });
    const last = segments[segments.length - 1];
    const key = last?.renderPath;
    if (!key) throw new NotFoundException("Render not ready");

    const stream = await this.storage.get(key);
    if (!stream) throw new NotFoundException("Render file missing");
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${project.name}.mp4"`);
    stream.pipe(res);
  }
}
