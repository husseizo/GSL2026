import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ForecastTargetType } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { ForecastingService } from './forecasting.service';

@Controller('ai/forecast')
@UseGuards(PermissionsGuard)
export class ForecastingController {
  constructor(private readonly forecasting: ForecastingService) {}

  @Post()
  @RequirePermissions('ai.forecast.generate')
  generate(@Body() body: { targetType: ForecastTargetType; targetId?: string; windowDays: number }) {
    return this.forecasting.generate(body.targetType, body.targetId, body.windowDays);
  }

  @Get()
  @RequirePermissions('ai.forecast.read')
  list(
    @Query('targetType') targetType?: ForecastTargetType,
    @Query('targetId') targetId?: string,
    @Query('chosenAsBest') chosenAsBest?: string,
  ) {
    return this.forecasting.list({
      targetType,
      targetId,
      chosenAsBest: chosenAsBest === undefined ? undefined : chosenAsBest === 'true',
    });
  }
}
