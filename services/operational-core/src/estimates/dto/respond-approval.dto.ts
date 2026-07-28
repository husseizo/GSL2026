import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApprovalDecision } from '@prisma/client';

export class LineDecisionDto {
  @IsString()
  estimateLineId!: string;

  @IsEnum(ApprovalDecision)
  decision!: ApprovalDecision;
}

export class RespondApprovalDto {
  @IsOptional()
  @IsString()
  respondedByName?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  actorId?: string;

  // Per-line decisions support partial approval. If omitted, `overallDecision`
  // applies to every line.
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => LineDecisionDto)
  lineDecisions?: LineDecisionDto[];

  @IsOptional()
  @IsEnum(ApprovalDecision)
  overallDecision?: ApprovalDecision;
}
