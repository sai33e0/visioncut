import { Global, Module } from "@nestjs/common";
import { AnalysisGateway } from "./analysis.gateway";

@Global()
@Module({
  providers: [AnalysisGateway],
  exports: [AnalysisGateway],
})
export class WebSocketModule {}
