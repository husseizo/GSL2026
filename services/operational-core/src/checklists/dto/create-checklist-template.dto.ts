import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ChecklistCategory } from '@prisma/client';

export class ChecklistTemplateItemDto {
  @IsString()
  label!: string;

  @IsOptional()
  @IsBoolean()
  requiresPhoto?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresNote?: boolean;
}

export class CreateChecklistTemplateDto {
  @IsString()
  name!: string;

  @IsEnum(ChecklistCategory)
  category!: ChecklistCategory;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ChecklistTemplateItemDto)
  items!: ChecklistTemplateItemDto[];
}
