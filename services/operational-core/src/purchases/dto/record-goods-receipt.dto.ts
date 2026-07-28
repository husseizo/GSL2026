import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsNumber, IsOptional, IsPositive, IsString, ValidateNested } from 'class-validator';

export class GoodsReceiptLineDto {
  @IsOptional()
  @IsString()
  purchaseDocumentLineId?: string;

  @IsOptional()
  @IsString()
  partId?: string;

  @IsOptional()
  @IsString()
  lubricantProductId?: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsNumber()
  unitCost!: number;

  @IsOptional()
  @IsString()
  batchNumber?: string;
}

export class RecordGoodsReceiptDto {
  @IsString()
  receiptNumber!: string;

  @IsString()
  warehouseId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptLineDto)
  lines!: GoodsReceiptLineDto[];
}
