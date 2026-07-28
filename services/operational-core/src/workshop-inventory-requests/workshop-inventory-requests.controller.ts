import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { WorkshopRequestStatus } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { CreateWorkshopInventoryRequestDto } from './dto/create-request.dto';
import { WorkshopInventoryRequestsService } from './workshop-inventory-requests.service';

@Controller('workshop-inventory-requests')
@UseGuards(PermissionsGuard)
export class WorkshopInventoryRequestsController {
  constructor(private readonly requests: WorkshopInventoryRequestsService) {}

  @Post()
  @RequirePermissions('inventory.adjust')
  create(@Body() dto: CreateWorkshopInventoryRequestDto) {
    return this.requests.create(dto);
  }

  @Get()
  @RequirePermissions('inventory.read')
  list(@Query('status') status?: WorkshopRequestStatus, @Query('jobId') jobId?: string) {
    return this.requests.list({ status, jobId });
  }

  @Patch(':id/link-to-recommendations')
  @RequirePermissions('recommendations.generate')
  linkToRecommendations(@Param('id') id: string) {
    return this.requests.linkToRecommendations(id);
  }

  @Patch(':id/fulfilled')
  @RequirePermissions('inventory.adjust')
  markFulfilled(@Param('id') id: string) {
    return this.requests.markFulfilled(id);
  }
}
