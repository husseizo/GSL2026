import { IsIn, IsOptional, IsString } from 'class-validator';

export const CUSTOMER_VEHICLE_RELATIONSHIPS = ['OWNER', 'DRIVER', 'FLEET_MANAGER'] as const;

export class LinkVehicleDto {
  @IsString()
  vehicleId!: string;

  @IsOptional()
  @IsIn(CUSTOMER_VEHICLE_RELATIONSHIPS)
  relationship?: (typeof CUSTOMER_VEHICLE_RELATIONSHIPS)[number];
}
