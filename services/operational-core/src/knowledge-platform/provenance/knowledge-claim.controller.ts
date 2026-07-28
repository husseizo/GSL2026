// DGX Prototype 1.7.1 — real "Candidate Claims Review" screen backend
// (spec §21 screen 5). Thin wrapper over the existing, unmodified
// KnowledgeClaimService — zero new claim-extraction logic.
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ClaimVerificationStatus } from '@prisma/client';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { KnowledgeClaimService } from './knowledge-claim.service';

@Controller('knowledge/claims')
@UseGuards(PermissionsGuard)
export class KnowledgeClaimController {
  constructor(private readonly claims: KnowledgeClaimService) {}

  @Get('by-item/:itemId')
  @RequirePermissions('knowledgeItem.read')
  listByItem(@Param('itemId') itemId: string, @Query('verificationStatus') verificationStatus?: ClaimVerificationStatus) {
    return this.claims.listByItem(itemId, { verificationStatus });
  }

  @Post(':id/verify')
  @RequirePermissions('knowledgeItem.approve')
  verify(@Param('id') id: string, @Body() body: { verifierId: string; status: ClaimVerificationStatus; actorRole?: string }) {
    return this.claims.verifyClaim(id, body.verifierId, body.status, body.actorRole);
  }
}
