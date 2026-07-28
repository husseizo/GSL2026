import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { CreateReceptionDto } from './dto/create-reception.dto';
import { ReceptionService } from './reception.service';

@Controller('reception')
@UseGuards(PermissionsGuard)
export class ReceptionController {
  constructor(private readonly reception: ReceptionService) {}

  @Post()
  @RequirePermissions('reception.manage')
  create(@Body() dto: CreateReceptionDto) {
    return this.reception.create(dto);
  }

  @Get()
  @RequirePermissions('reception.read')
  list(@Query('vehicleId') vehicleId?: string, @Query('branchId') branchId?: string) {
    return this.reception.list({ vehicleId, branchId });
  }

  @Get(':id')
  @RequirePermissions('reception.read')
  findById(@Param('id') id: string) {
    return this.reception.findById(id);
  }

  @Post(':id/photos')
  @RequirePermissions('reception.manage')
  addPhoto(@Param('id') id: string, @Body() body: { url: string; caption?: string }) {
    return this.reception.addPhoto(id, body.url, body.caption);
  }

  @Patch('accessories/:accessoryId/return')
  @RequirePermissions('reception.manage')
  returnAccessory(@Param('accessoryId') accessoryId: string) {
    return this.reception.returnAccessory(accessoryId);
  }
}
