// DGX Prototype 1.7.1 — real "Evaluation Results" screen backend (spec §21
// screen 11). Thin read wrapper over the existing, real BenchmarkRun table
// (DGX 1.6) — zero new evaluation logic, never rebuilds the Evaluation
// Framework.
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { BenchmarkCategory } from '@prisma/client';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('knowledge/evaluation-results')
@UseGuards(PermissionsGuard)
export class EvaluationResultsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('knowledgeRetrieval.query')
  list(@Query('category') category?: BenchmarkCategory) {
    return this.prisma.benchmarkRun.findMany({
      where: category ? { benchmark: { category } } : { benchmark: { category: 'KNOWLEDGE' } },
      include: { benchmark: true },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
  }

  @Get(':id')
  @RequirePermissions('knowledgeRetrieval.query')
  getById(@Param('id') id: string) {
    return this.prisma.benchmarkRun.findUniqueOrThrow({ where: { id }, include: { benchmark: true } });
  }
}
