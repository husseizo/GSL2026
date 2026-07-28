import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { MatchCandidateStatus, Role } from '@prisma/client';
import { Roles } from '../common/rbac/roles.decorator';
import { RolesGuard } from '../common/rbac/roles.guard';
import { CreatePartDto } from './dto/create-part.dto';
import { ReviewMatchCandidateDto } from './dto/review-match-candidate.dto';
import { PartMatcherService } from './matching/part-matcher.service';
import { PartsService } from './parts.service';

@Controller('parts')
@UseGuards(RolesGuard)
export class PartsController {
  constructor(
    private readonly parts: PartsService,
    private readonly matcher: PartMatcherService,
  ) {}

  @Post()
  @Roles(Role.SYSTEM_ADMINISTRATOR, Role.PARTS_MANAGER, Role.STOREKEEPER)
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
  @Roles(Role.SYSTEM_ADMINISTRATOR, Role.PARTS_MANAGER)
  async runMatching() {
    const ruleBased = await this.matcher.runRuleBasedMatching();
    const similarity = await this.matcher.runSimilarityMatching();
    return { ruleBasedCandidates: ruleBased, similarityCandidates: similarity };
  }

  @Get('match-candidates')
  @Roles(Role.SYSTEM_ADMINISTRATOR, Role.PARTS_MANAGER)
  listMatchCandidates(@Query('status') status?: MatchCandidateStatus) {
    return this.matcher.listCandidates(status);
  }

  @Patch('match-candidates/:id/review')
  @Roles(Role.SYSTEM_ADMINISTRATOR, Role.PARTS_MANAGER)
  reviewMatchCandidate(@Param('id') id: string, @Body() dto: ReviewMatchCandidateDto) {
    return this.matcher.reviewCandidate(id, dto.status, dto.reviewedById);
  }
}
