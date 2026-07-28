import { MatchCandidateStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export class ReviewAlternativeDto {
  @IsIn([MatchCandidateStatus.APPROVED, MatchCandidateStatus.REJECTED])
  status!: 'APPROVED' | 'REJECTED';
}
