import { Controller, Get, NotFoundException, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { UuidValidationPipe } from "../common/pipes/uuid.pipe";
import { QualityService } from "./quality.service";

@Controller("quality")
@UseGuards(JwtAuthGuard)
export class QualityController {
  constructor(private readonly quality: QualityService) {}

  @Get(":projectId/score")
  async score(
    @CurrentUser() user: { id: string },
    @Param("projectId", UuidValidationPipe) projectId: string
  ) {
    const report = await this.quality.report(user.id, projectId);
    if (!report) throw new NotFoundException("Project not found");
    return report;
  }
}
