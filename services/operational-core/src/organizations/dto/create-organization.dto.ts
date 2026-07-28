import { IsString } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;
}
