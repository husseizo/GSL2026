import { IsEmail, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  supplierCode!: string;

  @IsString()
  legalName!: string;

  @IsString()
  displayName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsInt()
  defaultLeadTimeDays?: number;
}
