import { Module } from "@nestjs/common";
import { RenderController } from "./render.controller";
import { RenderService } from "./render.service";
import { RenderInternalController } from "./render-internal.controller";
import { CommonModule } from "../common/common.module";

@Module({
  imports: [CommonModule],
  controllers: [RenderController, RenderInternalController],
  providers: [RenderService],
  exports: [RenderService],
})
export class RenderModule {}
