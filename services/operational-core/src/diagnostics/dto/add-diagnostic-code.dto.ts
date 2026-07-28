import { DiagnosticCodeSource } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class AddDiagnosticCodeDto {
  @IsString()
  code!: string;

  @IsEnum(DiagnosticCodeSource)
  source!: DiagnosticCodeSource;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  freezeFrame?: Record<string, unknown>;
}
