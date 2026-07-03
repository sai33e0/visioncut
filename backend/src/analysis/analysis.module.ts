import { Module } from "@nestjs/common";
import { AnalysisController } from "./analysis.controller";
import { AnalysisService } from "./analysis.service";
import { AnalysisInternalController } from "./analysis-internal.controller";
import { AnalysisOrchestrator } from "./orchestrator.service";
import { CommonModule } from "../common/common.module";

@Module({
  imports: [CommonModule],
  controllers: [AnalysisController, AnalysisInternalController],
  providers: [AnalysisService, AnalysisOrchestrator],
  exports: [AnalysisService],
})
export class AnalysisModule {}
