import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LubricantCategory, MatchCandidateStatus } from '@prisma/client';
import { PaginationQueryDto } from '../common/pagination/pagination.dto';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { CreateLubricantDto } from './dto/create-lubricant.dto';
import { ProposeAlternativeDto } from './dto/propose-alternative.dto';
import { ReviewAlternativeDto } from './dto/review-alternative.dto';
import { LubricantsService } from './lubricants.service';

@Controller('lubricants')
@UseGuards(PermissionsGuard)
export class LubricantsController {
  constructor(private readonly lubricants: LubricantsService) {}

  @Post()
  @RequirePermissions('lubricants.manage')
  create(@Body() dto: CreateLubricantDto) {
    return this.lubricants.create(dto);
  }

  @Get()
  @RequirePermissions('lubricants.read')
  search(@Query() query: PaginationQueryDto, @Query('category') category?: LubricantCategory) {
    return this.lubricants.search({ ...query, category });
  }

  @Get(':id')
  @RequirePermissions('lubricants.read')
  findById(@Param('id') id: string) {
    return this.lubricants.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('lubricants.manage')
  update(@Param('id') id: string, @Body() dto: Partial<CreateLubricantDto>) {
    return this.lubricants.update(id, dto);
  }

  @Get(':id/approvals')
  @RequirePermissions('lubricants.read')
  listApprovals(@Param('id') id: string) {
    return this.lubricants.listApprovals(id);
  }

  @Get(':id/compatibility')
  @RequirePermissions('lubricants.read')
  listCompatibility(@Param('id') id: string) {
    return this.lubricants.listCompatibility(id);
  }

  @Post(':id/alternatives')
  @RequirePermissions('lubricants.manage')
  proposeAlternative(@Param('id') id: string, @Body() dto: ProposeAlternativeDto) {
    return this.lubricants.proposeAlternative(id, dto);
  }

  @Get(':id/alternatives')
  @RequirePermissions('lubricants.read')
  listAlternatives(@Param('id') id: string, @Query('status') status?: MatchCandidateStatus) {
    return this.lubricants.listAlternatives(id, status);
  }

  @Patch('alternatives/:alternativeRecordId/review')
  @RequirePermissions('lubricants.manage')
  reviewAlternative(@Param('alternativeRecordId') alternativeRecordId: string, @Body() dto: ReviewAlternativeDto) {
    return this.lubricants.reviewAlternative(alternativeRecordId, dto.status);
  }
}
