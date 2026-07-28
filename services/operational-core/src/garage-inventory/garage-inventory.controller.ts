import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { ReservePartDto } from './dto/reserve-part.dto';
import { GarageInventoryService } from './garage-inventory.service';

@Controller('garage-inventory')
@UseGuards(PermissionsGuard)
export class GarageInventoryController {
  constructor(private readonly garageInventory: GarageInventoryService) {}

  @Post('jobs/:jobId/reserve')
  @RequirePermissions('inventory.adjust')
  reservePart(@Param('jobId') jobId: string, @Body() dto: ReservePartDto) {
    return this.garageInventory.reservePart(jobId, dto);
  }

  @Patch('lines/:jobLineId/issue')
  @RequirePermissions('inventory.adjust')
  issue(@Param('jobLineId') jobLineId: string) {
    return this.garageInventory.issue(jobLineId);
  }

  @Patch('lines/:jobLineId/return')
  @RequirePermissions('inventory.adjust')
  returnUnused(@Param('jobLineId') jobLineId: string, @Body() body: { quantity: number; reason?: string }) {
    return this.garageInventory.returnUnused(jobLineId, body.quantity, body.reason);
  }

  @Patch('lines/:jobLineId/release')
  @RequirePermissions('inventory.adjust')
  releaseReservation(@Param('jobLineId') jobLineId: string, @Body('reason') reason?: string) {
    return this.garageInventory.releaseReservation(jobLineId, reason);
  }
}
