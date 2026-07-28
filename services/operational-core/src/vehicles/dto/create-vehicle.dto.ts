import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateVehicleDto {
  @IsOptional()
  @IsString()
  vin?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsString()
  brand!: string;

  @IsString()
  model!: string;

  @IsOptional()
  @IsString()
  variant?: string;

  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  modelYear?: number;

  @IsOptional()
  @IsString()
  engineCode?: string;

  @IsOptional()
  @IsString()
  engineFamily?: string;

  @IsOptional()
  @IsString()
  transmissionCode?: string;

  @IsOptional()
  @IsString()
  fuelType?: string;

  @IsOptional()
  @IsString()
  decodeSource?: string;
}
