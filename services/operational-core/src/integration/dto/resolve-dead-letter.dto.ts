import { IsString } from 'class-validator';

export class ResolveDeadLetterDto {
  @IsString()
  resolvedById!: string;

  @IsString()
  resolution!: string;
}
