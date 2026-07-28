import { WarehouseType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  branchId!: string;

  @IsOptional()
  @IsEnum(WarehouseType)
  warehouseType?: WarehouseType;

  @IsOptional()
  @IsBoolean()
  isSellable?: boolean;

  @IsOptional()
  @IsBoolean()
  isServiceWarehouse?: boolean;

  @IsOptional()
  @IsBoolean()
  isTransitWarehouse?: boolean;

  @IsOptional()
  @IsBoolean()
  isQuarantineWarehouse?: boolean;
}
