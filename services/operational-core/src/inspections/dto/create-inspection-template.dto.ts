import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsString, ValidateNested } from 'class-validator';

export class InspectionItemDto {
  @IsString()
  label!: string;
}

export class InspectionSectionDto {
  @IsString()
  name!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => InspectionItemDto)
  items!: InspectionItemDto[];
}

export class CreateInspectionTemplateDto {
  @IsString()
  name!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => InspectionSectionDto)
  sections!: InspectionSectionDto[];
}
