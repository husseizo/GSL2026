import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PartNumberType } from '@prisma/client';

export class AlternateNumberDto {
  @IsString()
  number!: string;

  @IsEnum(PartNumberType)
  type!: PartNumberType;
}

export class CreatePartDto {
  @IsOptional()
  @IsString()
  internalItemCode?: string;

  @IsString()
  oemNumber!: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsString()
  productName!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AlternateNumberDto)
  alternateNumbers?: AlternateNumberDto[];
}
