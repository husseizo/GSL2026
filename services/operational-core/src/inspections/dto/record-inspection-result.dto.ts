import { InspectionFinding, InspectionSeverityLevel } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class RecordInspectionResultDto {
  @IsString()
  itemId!: string;

  @IsEnum(InspectionFinding)
  finding!: InspectionFinding;

  @IsOptional()
  @IsEnum(InspectionSeverityLevel)
  severity?: InspectionSeverityLevel;

  @IsOptional()
  @IsString()
  recommendedAction?: string;

  @IsOptional()
  @IsNumber()
  estimatedLabourHours?: number;

  @IsOptional()
  @IsString()
  requiredPartId?: string;

  @IsOptional()
  @IsString()
  requiredLubricantId?: string;

  @IsOptional()
  @IsBoolean()
  safetyWarning?: boolean;

  @IsOptional()
  @IsString()
  inspectedById?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
