import { ItemType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class ReservePartDto {
  @IsEnum(ItemType)
  itemType!: ItemType;

  @IsOptional()
  @IsString()
  partId?: string;

  @IsOptional()
  @IsString()
  lubricantProductId?: string;

  @IsString()
  warehouseId!: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsString()
  description!: string;

  @IsOptional()
  @IsNumber()
  unitPrice?: number;
}
