import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  name?: string;

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
