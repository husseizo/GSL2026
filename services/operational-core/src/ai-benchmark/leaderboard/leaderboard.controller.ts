import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { BenchmarkCategory } from '@prisma/client';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { LeaderboardService } from './leaderboard.service';

@Controller('ai/leaderboard')
@UseGuards(PermissionsGuard)
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  @RequirePermissions('ai.evaluations.read')
  full(@Query('limit') limit?: string) {
    return this.leaderboard.getFullLeaderboard(limit ? Number(limit) : undefined);
  }

  @Get(':category')
  @RequirePermissions('ai.evaluations.read')
  byCategory(@Param('category') category: BenchmarkCategory, @Query('limit') limit?: string) {
    return this.leaderboard.getCategoryLeaderboard(category, limit ? Number(limit) : undefined);
  }
}
