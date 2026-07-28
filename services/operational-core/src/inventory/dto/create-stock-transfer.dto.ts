import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsNumber, IsOptional, IsPositive, IsString, ValidateNested } from 'class-validator';
import { ItemType } from '@prisma/client';

export class StockTransferLineDto {
  @IsEnum(ItemType)
  itemType!: ItemType;

  @IsOptional()
  @IsString()
  partId?: string;

  @IsOptional()
  @IsString()
  lubricantProductId?: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;
}

export class CreateStockTransferDto {
  @IsString()
  transferNumber!: string;

  @IsString()
  sourceWarehouseId!: string;

  @IsString()
  destinationWarehouseId!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => StockTransferLineDto)
  lines!: StockTransferLineDto[];
}
