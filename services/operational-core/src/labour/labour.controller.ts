import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { CreateLabourOperationDto } from './dto/create-labour-operation.dto';
import { LabourService } from './labour.service';
import { TechnicianTimeLogService } from './technician-time-log.service';

@Controller('labour')
@UseGuards(PermissionsGuard)
export class LabourController {
  constructor(
    private readonly labour: LabourService,
    private readonly timeLogs: TechnicianTimeLogService,
  ) {}

  @Post('categories')
  @RequirePermissions('labour.manage')
  createCategory(@Body('name') name: string) {
    return this.labour.createCategory(name);
  }

  @Post('operations')
  @RequirePermissions('labour.manage')
  createOperation(@Body() dto: CreateLabourOperationDto) {
    return this.labour.createOperation(dto);
  }

  @Get('operations')
  @RequirePermissions('labour.read')
  listOperations() {
    return this.labour.listOperations();
  }

  @Post('rates')
  @RequirePermissions('labour.manage')
  setRate(@Body() body: { labourOperationId?: string; branchId?: string; hourlyRate: number }) {
    return this.labour.setRate(body);
  }

  @Post('time-logs/start')
  @RequirePermissions('labour.manage')
  startTimeLog(@Body() body: { jobId: string; technicianId: string; labourOperationId?: string }) {
    return this.timeLogs.start(body);
  }

  @Post('time-logs/:id/pause')
  @RequirePermissions('labour.manage')
  pauseTimeLog(@Param('id') id: string) {
    return this.timeLogs.pause(id);
  }

  @Post('time-logs/:id/resume')
  @RequirePermissions('labour.manage')
  resumeTimeLog(@Param('id') id: string) {
    return this.timeLogs.resume(id);
  }

  @Post('time-logs/:id/end')
  @RequirePermissions('labour.manage')
  endTimeLog(@Param('id') id: string, @Body('isOvertime') isOvertime?: boolean) {
    return this.timeLogs.end(id, isOvertime);
  }

  @Get('time-logs/by-job/:jobId')
  @RequirePermissions('labour.read')
  listForJob(@Param('jobId') jobId: string) {
    return this.timeLogs.listForJob(jobId);
  }
}
