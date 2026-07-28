import { IsIn, IsOptional, IsString } from 'class-validator';

export const LUBRICANT_ALTERNATIVE_TYPES = ['EXACT_APPROVED', 'COMPATIBLE', 'WORKSHOP_PREFERRED', 'BUDGET'] as const;

export class ProposeAlternativeDto {
  @IsString()
  alternativeId!: string;

  @IsIn(LUBRICANT_ALTERNATIVE_TYPES)
  alternativeType!: (typeof LUBRICANT_ALTERNATIVE_TYPES)[number];

  @IsOptional()
  @IsString()
  rationale?: string;
}
