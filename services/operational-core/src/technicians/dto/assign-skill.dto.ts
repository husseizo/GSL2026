import { TechnicianSpecialization } from '@prisma/client';
import { IsEnum, IsInt, Max, Min } from 'class-validator';

export class AssignSkillDto {
  @IsEnum(TechnicianSpecialization)
  specialization!: TechnicianSpecialization;

  @IsInt()
  @Min(1)
  @Max(5)
  proficiency!: number;
}
