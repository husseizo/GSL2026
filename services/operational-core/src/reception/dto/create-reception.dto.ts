import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { ReceptionFuelLevel } from '@prisma/client';

export class VehicleConditionDto {
  @IsString()
  area!: string;

  @IsString()
  condition!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ComplaintDto {
  @IsString()
  description!: string;
}

export class AccessoryDto {
  @IsString()
  description!: string;
}

export class CreateReceptionDto {
  @IsString()
  vehicleId!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  receivedById?: string;

  @IsOptional()
  @IsString()
  driverName?: string;

  @IsInt()
  @Min(0)
  mileage!: number;

  @IsOptional()
  @IsEnum(ReceptionFuelLevel)
  fuelLevel?: ReceptionFuelLevel;

  @IsOptional()
  @IsNumber()
  batteryVoltage?: number;

  @IsOptional()
  @IsDateString()
  expectedCompletionAt?: string;

  @IsOptional()
  @IsString()
  receptionNotes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VehicleConditionDto)
  conditions?: VehicleConditionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComplaintDto)
  complaints?: ComplaintDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccessoryDto)
  accessories?: AccessoryDto[];
}
