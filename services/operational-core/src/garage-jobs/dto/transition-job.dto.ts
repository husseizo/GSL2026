import { GarageJobStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class TransitionJobDto {
  @IsEnum(GarageJobStatus)
  newStatus!: GarageJobStatus;

  @IsOptional()
  @IsString()
  changedById?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;
}
