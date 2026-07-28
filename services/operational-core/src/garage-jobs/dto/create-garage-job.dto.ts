import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateGarageJobDto {
  @IsString()
  vehicleId!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  receptionId?: string;

  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  supervisorId?: string;

  @IsOptional()
  @IsBoolean()
  isWarranty?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  mileageAtCheckIn?: number;
}
