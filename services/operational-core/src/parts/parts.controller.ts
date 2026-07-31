import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { MatchCandidateStatus } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { CreatePartDto } from './dto/create-part.dto';
import { ReviewMatchCandidateDto } from './dto/review-match-candidate.dto';
import { PartMatcherService } from './matching/part-matcher.service';
import { PartsService } from './parts.service';

// Platform Remediation PEP-3 (WP-3.2, see
// docs/governance/DGX3_PLATFORM_REMEDIATION_TECHNICAL_SPECIFICATION_1.md
// §4, PRTS-003): migrated from RolesGuard/@Roles (direct x-user-role
// header read, never consulting a verified actor) to
// PermissionsGuard/@RequirePermissions. Each permission below is an exact
// match to that endpoint's pre-migration @Roles(...) list — no role
// gains or loses access. The two GET endpoints below remain undecorated
// (open today) — tightening them is an explicit, separate, out-of-scope
// future decision (Technical Specification §5).
@Controller('parts')
@UseGuards(PermissionsGuard)
export class PartsController {
  constructor(
    private readonly parts: PartsService,
    private readonly matcher: PartMatcherService,
  ) {}

  @Post()
  @RequirePermissions('parts.create')
  create(@Body() dto: CreatePartDto) {
    return this.parts.create(dto);
  }

  @Get()
  list(@Query('category') category?: string, @Query('brand') brand?: string) {
    return this.parts.list({ category, brand });
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const part = await this.parts.findById(id);
    if (!part) {
      throw new NotFoundException(`Part ${id} not found`);
    }
    return part;
  }

  // --- Merge-review queue: proposals only, never auto-merged. ---

  @Post('match-candidates/run')
  @RequirePermissions('parts.matchCandidates.manage')
  async runMatching() {
    const ruleBased = await this.matcher.runRuleBasedMatching();
    const similarity = await this.matcher.runSimilarityMatching();
    return { ruleBasedCandidates: ruleBased, similarityCandidates: similarity };
  }

  @Get('match-candidates')
  @RequirePermissions('parts.matchCandidates.manage')
  listMatchCandidates(@Query('status') status?: MatchCandidateStatus) {
    return this.matcher.listCandidates(status);
  }

  @Patch('match-candidates/:id/review')
  @RequirePermissions('parts.matchCandidates.manage')
  reviewMatchCandidate(@Param('id') id: string, @Body() dto: ReviewMatchCandidateDto) {
    return this.matcher.reviewCandidate(id, dto.status, dto.reviewedById);
  }
}
