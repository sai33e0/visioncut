import { Global, Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { WorkerClient } from "./clients/worker.client";

@Global()
@Module({
  imports: [HttpModule.register({ timeout: 60_000, maxRedirects: 0 })],
  providers: [WorkerClient],
  exports: [WorkerClient, HttpModule],
})
export class CommonModule {}
