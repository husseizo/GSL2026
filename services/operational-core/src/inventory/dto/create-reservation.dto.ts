import { ItemType } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateReservationDto {
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

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
