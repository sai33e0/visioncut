import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

export interface ProgressPayload {
  step: string;
  percent: number;
  detail?: string;
  timestamp?: number;
}

@WebSocketGateway({
  cors: { origin: process.env.APP_URL ?? "http://localhost:3000", credentials: true },
})
export class AnalysisGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(AnalysisGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected ${client.id}`);
  }
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected ${client.id}`);
  }

  @SubscribeMessage("join")
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() projectId: string) {
    client.join(projectId);
    return { joined: projectId };
  }

  emitProgress(projectId: string, step: string, percent: number, detail?: string) {
    const payload: ProgressPayload = { step, percent, detail, timestamp: Date.now() };
    this.server.to(projectId).emit("progress", payload);
  }

  emitLog(projectId: string, message: string, level: "info" | "warn" | "error" = "info") {
    this.server.to(projectId).emit("log", { message, level, timestamp: Date.now() });
  }
}
