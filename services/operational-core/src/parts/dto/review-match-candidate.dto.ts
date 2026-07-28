import { MatchCandidateStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewMatchCandidateDto {
  @IsIn([MatchCandidateStatus.APPROVED, MatchCandidateStatus.REJECTED])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  reviewedById?: string;
}
