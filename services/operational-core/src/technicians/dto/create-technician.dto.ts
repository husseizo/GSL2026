import { IsString } from 'class-validator';

export class CreateTechnicianDto {
  @IsString()
  employeeCode!: string;

  @IsString()
  name!: string;

  @IsString()
  branchId!: string;
}
