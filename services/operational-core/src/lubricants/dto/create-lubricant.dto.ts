import { LubricantCategory } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateLubricantDto {
  @IsOptional()
  @IsString()
  internalCode?: string;

  @IsString()
  brand!: string;

  @IsString()
  productName!: string;

  @IsEnum(LubricantCategory)
  category!: LubricantCategory;

  @IsOptional()
  @IsString()
  viscosity?: string;

  @IsOptional()
  @IsNumber()
  packageSize?: number;

  @IsOptional()
  @IsString()
  packageUnit?: string;

  @IsOptional()
  @IsString()
  apiClassification?: string;

  @IsOptional()
  @IsString()
  aceaClassification?: string;

  @IsOptional()
  @IsNumber()
  currentCost?: number;

  @IsOptional()
  @IsNumber()
  defaultSellingPrice?: number;
}
