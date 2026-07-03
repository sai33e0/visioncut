import { IsString, IsUrl, IsUUID } from "class-validator";

export class StartAnalysisDto {
  @IsUUID()
  projectId: string;

  @IsUrl({ require_tld: false })
  referenceUrl: string;
}
