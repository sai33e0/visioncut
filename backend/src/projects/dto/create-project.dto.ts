import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

export class CreateProjectDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  referenceUrl?: string;
}
