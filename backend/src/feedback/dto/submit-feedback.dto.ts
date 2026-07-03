import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";

export class SubmitFeedbackDto {
  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsUUID()
  segmentId?: string;

  @IsOptional()
  @IsUUID()
  clipId?: string;

  @IsIn(["up", "down"])
  rating: "up" | "down";

  @IsOptional()
  @IsString()
  comment?: string;
}
