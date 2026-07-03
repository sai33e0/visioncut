import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { UuidValidationPipe } from "../common/pipes/uuid.pipe";
import { ProjectsService } from "./projects.service";
import { CreateProjectDto } from "./dto/create-project.dto";

@Controller("projects")
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.projects.listForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateProjectDto) {
    return this.projects.create(user.id, dto);
  }

  @Get(":id")
  async get(@CurrentUser() user: { id: string }, @Param("id", UuidValidationPipe) id: string) {
    const project = await this.projects.getForUser(user.id, id);
    if (!project) throw new NotFoundException("Project not found");
    return project;
  }

  @Delete(":id")
  async remove(@CurrentUser() user: { id: string }, @Param("id", UuidValidationPipe) id: string) {
    await this.projects.deleteForUser(user.id, id);
    return { ok: true };
  }
}
