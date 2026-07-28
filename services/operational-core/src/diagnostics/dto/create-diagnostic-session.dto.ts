import { IsOptional, IsString } from 'class-validator';

export class CreateDiagnosticSessionDto {
  @IsString()
  jobId!: string;

  @IsOptional()
  @IsString()
  technicianId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
