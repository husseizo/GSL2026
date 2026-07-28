import { GarageJobLineType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddJobLineDto {
  @IsEnum(GarageJobLineType)
  lineType!: GarageJobLineType;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  partId?: string;

  @IsOptional()
  @IsString()
  lubricantProductId?: string;

  @IsOptional()
  @IsString()
  labourOperationId?: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsNumber()
  unitCost?: number;
}
