import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { BenchmarkApprovalStatus, BenchmarkCaseStatus, BenchmarkCategory } from '@prisma/client';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { BenchmarkRegistryService, CreateBenchmarkInput } from './benchmark-registry.service';

@Controller('ai/benchmarks')
@UseGuards(PermissionsGuard)
export class BenchmarkRegistryController {
  constructor(private readonly registry: BenchmarkRegistryService) {}

  @Get()
  @RequirePermissions('ai.evaluations.read')
  list(@Query('category') category?: BenchmarkCategory, @Query('approvalStatus') approvalStatus?: BenchmarkApprovalStatus) {
    return this.registry.listBenchmarks({ category, approvalStatus });
  }

  @Get(':key/latest')
  @RequirePermissions('ai.evaluations.read')
  latest(@Param('key') key: string) {
    return this.registry.getLatestVersion(key);
  }

  @Get(':benchmarkId/cases')
  @RequirePermissions('ai.evaluations.read')
  cases(@Param('benchmarkId') benchmarkId: string, @Query('status') status?: BenchmarkCaseStatus) {
    return this.registry.listCases(benchmarkId, { status });
  }

  @Post()
  @RequirePermissions('ai.evaluations.manage')
  create(@Body() body: CreateBenchmarkInput) {
    return this.registry.createBenchmark(body);
  }

  @Post(':key/new-version')
  @RequirePermissions('ai.evaluations.manage')
  newVersion(@Param('key') key: string, @Body() updates: Partial<Omit<CreateBenchmarkInput, 'key'>>) {
    return this.registry.createNewVersion(key, updates);
  }

  @Post(':benchmarkId/approve')
  @RequirePermissions('ai.evaluations.manage')
  approve(@Param('benchmarkId') benchmarkId: string, @Body() body: { reviewerId?: string }) {
    return this.registry.approve(benchmarkId, body.reviewerId);
  }

  @Post(':benchmarkId/reject')
  @RequirePermissions('ai.evaluations.manage')
  reject(@Param('benchmarkId') benchmarkId: string, @Body() body: { reviewerId?: string }) {
    return this.registry.reject(benchmarkId, body.reviewerId);
  }

  @Post(':benchmarkId/freeze-gold')
  @RequirePermissions('ai.evaluations.manage')
  freezeGold(@Param('benchmarkId') benchmarkId: string) {
    return this.registry.freezeAsGold(benchmarkId);
  }

  @Get(':benchmarkId/verify-checksum')
  @RequirePermissions('ai.evaluations.read')
  verifyChecksum(@Param('benchmarkId') benchmarkId: string) {
    return this.registry.verifyChecksum(benchmarkId);
  }
}
