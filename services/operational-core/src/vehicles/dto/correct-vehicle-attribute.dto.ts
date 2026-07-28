import { DecodeConfidence } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

// Whitelist of fields that can go through the correction workflow — deliberately
// excludes identity fields like `id`/`vin` uniqueness handling, which need their
// own merge/re-key flow rather than a plain attribute correction.
export const CORRECTABLE_VEHICLE_FIELDS = [
  'registrationNumber',
  'brand',
  'model',
  'variant',
  'modelYear',
  'engineCode',
  'engineFamily',
  'transmissionCode',
  'fuelType',
  'driveType',
  'bodyType',
  'marketSpec',
] as const;

export type CorrectableVehicleField = (typeof CORRECTABLE_VEHICLE_FIELDS)[number];

export class CorrectVehicleAttributeDto {
  @IsIn(CORRECTABLE_VEHICLE_FIELDS)
  field!: CorrectableVehicleField;

  @IsString()
  newValue!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsEnum(DecodeConfidence)
  confidence?: DecodeConfidence;

  @IsOptional()
  @IsString()
  changedById?: string;
}
