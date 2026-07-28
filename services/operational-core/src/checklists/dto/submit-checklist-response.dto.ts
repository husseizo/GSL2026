import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ChecklistItemStatus } from '@prisma/client';

export class ChecklistResponseItemDto {
  @IsString()
  templateItemId!: string;

  @IsEnum(ChecklistItemStatus)
  status!: ChecklistItemStatus;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}

export class SubmitChecklistResponseDto {
  @IsString()
  templateId!: string;

  @IsString()
  entityType!: string;

  @IsString()
  entityId!: string;

  @IsOptional()
  @IsString()
  completedById?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ChecklistResponseItemDto)
  items!: ChecklistResponseItemDto[];
}
