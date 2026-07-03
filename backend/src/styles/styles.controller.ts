import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { UuidValidationPipe } from "../common/pipes/uuid.pipe";
import { StylesService } from "./styles.service";
import { CreateStyleDto } from "./dto/create-style.dto";

@Controller("styles")
@UseGuards(JwtAuthGuard)
export class StylesController {
  constructor(private readonly styles: StylesService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.styles.listForUser(user.id);
  }

  @Get("public")
  public(@Query("contentType") contentType?: string) {
    return this.styles.publicList(contentType);
  }

  @Get("matching/:projectId")
  matching(
    @CurrentUser() user: { id: string },
    @Param("projectId", UuidValidationPipe) projectId: string
  ) {
    return this.styles.matchingForProject(user.id, projectId);
  }

  @Get(":id")
  async get(
    @CurrentUser() user: { id: string },
    @Param("id", UuidValidationPipe) id: string
  ) {
    const s = await this.styles.get(user.id, id);
    if (!s) throw new NotFoundException("Style not found");
    return s;
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateStyleDto) {
    return this.styles.create(user.id, dto);
  }

  @Post(":id/apply")
  async apply(
    @CurrentUser() user: { id: string },
    @Param("id", UuidValidationPipe) id: string,
    @Body() body: { projectId: string }
  ) {
    const style = await this.styles.get(user.id, id);
    if (!style) throw new NotFoundException("Style not found");
    return this.styles.apply(user.id, id, body.projectId);
  }

  @Delete(":id")
  async remove(
    @CurrentUser() user: { id: string },
    @Param("id", UuidValidationPipe) id: string
  ) {
    await this.styles.remove(user.id, id);
    return { ok: true };
  }
}
