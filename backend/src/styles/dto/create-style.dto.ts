import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateStyleDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  pace?: string;

  @IsOptional()
  @IsArray()
  transitions?: any[];

  @IsOptional()
  audioComponents?: any;

  @IsOptional()
  blueprintTemplate?: any;

  @IsOptional()
  @IsArray()
  styleVector?: number[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  /**
   * If provided and blueprintTemplate is omitted, the service will use the
   * project's blueprint as the template (and the Python worker to vectorize).
   */
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
