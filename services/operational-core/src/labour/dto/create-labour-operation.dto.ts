import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateLabourOperationDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsNumber()
  standardHours!: number;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
