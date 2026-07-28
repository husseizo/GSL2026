import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { QualityResult } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { CreateQualityInspectionDto } from './dto/create-quality-inspection.dto';
import { QualityControlService } from './quality-control.service';

@Controller('quality-control')
@UseGuards(PermissionsGuard)
export class QualityControlController {
  constructor(private readonly qc: QualityControlService) {}

  @Post('inspections')
  @RequirePermissions('qc.manage')
  createInspection(@Body() dto: CreateQualityInspectionDto) {
    return this.qc.createInspection(dto);
  }

  @Patch('issues/:id/resolve')
  @RequirePermissions('qc.manage')
  resolveIssue(@Param('id') id: string) {
    return this.qc.resolveIssue(id);
  }

  @Post('road-tests')
  @RequirePermissions('qc.manage')
  createRoadTest(@Body() body: { jobId: string; driverId?: string; distanceKm?: number; result: QualityResult; notes?: string }) {
    return this.qc.createRoadTest(body);
  }

  @Post('jobs/:jobId/approval')
  @RequirePermissions('qc.manage')
  createApproval(@Param('jobId') jobId: string, @Body() body: { approvedById?: string; note?: string }) {
    return this.qc.createApproval(jobId, body.approvedById, body.note);
  }

  @Get('jobs/:jobId')
  @RequirePermissions('qc.read')
  listForJob(@Param('jobId') jobId: string) {
    return this.qc.listForJob(jobId);
  }
}
