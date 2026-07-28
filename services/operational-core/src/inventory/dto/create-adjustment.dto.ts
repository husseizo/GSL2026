import { AdjustmentDirection, ItemType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateAdjustmentDto {
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

  @IsEnum(AdjustmentDirection)
  direction!: AdjustmentDirection;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  requestedById?: string;
}
