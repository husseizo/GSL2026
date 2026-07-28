import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GarageJobStatus } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { AddJobLineDto } from './dto/add-job-line.dto';
import { CreateGarageJobDto } from './dto/create-garage-job.dto';
import { TransitionJobDto } from './dto/transition-job.dto';
import { GarageJobsService } from './garage-jobs.service';

@Controller('garage-jobs')
@UseGuards(PermissionsGuard)
export class GarageJobsController {
  constructor(private readonly jobs: GarageJobsService) {}

  @Post()
  @RequirePermissions('jobcard.manage')
  create(@Body() dto: CreateGarageJobDto) {
    return this.jobs.create(dto);
  }

  @Get()
  @RequirePermissions('jobcard.read')
  list(@Query('vehicleId') vehicleId?: string, @Query('branchId') branchId?: string, @Query('status') status?: GarageJobStatus) {
    return this.jobs.list({ vehicleId, branchId, status });
  }

  @Get(':id')
  @RequirePermissions('jobcard.read')
  findById(@Param('id') id: string) {
    return this.jobs.findById(id);
  }

  @Patch(':id/transition')
  @RequirePermissions('jobcard.transition')
  transition(@Param('id') id: string, @Body() dto: TransitionJobDto) {
    return this.jobs.transition(id, dto);
  }

  @Post(':id/lines')
  @RequirePermissions('jobcard.manage')
  addLine(@Param('id') id: string, @Body() dto: AddJobLineDto) {
    return this.jobs.addLine(id, dto);
  }

  @Get(':id/lines')
  @RequirePermissions('jobcard.read')
  listLines(@Param('id') id: string) {
    return this.jobs.listLines(id);
  }

  @Post(':id/assignments')
  @RequirePermissions('jobcard.manage')
  assignTechnician(
    @Param('id') id: string,
    @Body() body: { technicianId: string; role?: 'TECHNICIAN' | 'SUPERVISOR'; assignedById?: string },
  ) {
    return this.jobs.assignTechnician(id, body.technicianId, body.role ?? 'TECHNICIAN', body.assignedById);
  }
}
