import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { QualityResult } from '@prisma/client';

export class QualityIssueDto {
  @IsString()
  category!: string;

  @IsString()
  description!: string;
}

export class CreateQualityInspectionDto {
  @IsString()
  jobId!: string;

  @IsOptional()
  @IsString()
  inspectorId?: string;

  @IsEnum(QualityResult)
  result!: QualityResult;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => QualityIssueDto)
  issues?: QualityIssueDto[];
}
