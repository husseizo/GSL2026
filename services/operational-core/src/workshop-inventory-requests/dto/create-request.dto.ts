import { ItemType, WorkshopRequestType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateWorkshopInventoryRequestDto {
  @IsOptional()
  @IsString()
  jobId?: string;

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

  @IsEnum(WorkshopRequestType)
  requestType!: WorkshopRequestType;

  @IsOptional()
  @IsString()
  requestedById?: string;
}
