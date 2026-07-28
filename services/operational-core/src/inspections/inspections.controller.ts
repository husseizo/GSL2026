import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { CreateInspectionTemplateDto } from './dto/create-inspection-template.dto';
import { RecordInspectionResultDto } from './dto/record-inspection-result.dto';
import { InspectionsService } from './inspections.service';

@Controller('inspections')
@UseGuards(PermissionsGuard)
export class InspectionsController {
  constructor(private readonly inspections: InspectionsService) {}

  @Post('templates')
  @RequirePermissions('inspection.manage')
  createTemplate(@Body() dto: CreateInspectionTemplateDto) {
    return this.inspections.createTemplate(dto);
  }

  @Get('templates')
  @RequirePermissions('inspection.read')
  listTemplates() {
    return this.inspections.listTemplates();
  }

  @Post('jobs/:jobId/results')
  @RequirePermissions('inspection.manage')
  recordResult(@Param('jobId') jobId: string, @Body() dto: RecordInspectionResultDto) {
    return this.inspections.recordResult(jobId, dto);
  }

  @Post('results/:resultId/photos')
  @RequirePermissions('inspection.manage')
  addPhoto(@Param('resultId') resultId: string, @Body('url') url: string) {
    return this.inspections.addPhoto(resultId, url);
  }

  @Get('jobs/:jobId/results')
  @RequirePermissions('inspection.read')
  listResultsForJob(@Param('jobId') jobId: string) {
    return this.inspections.listResultsForJob(jobId);
  }

  @Get('jobs/:jobId/failed')
  @RequirePermissions('inspection.read')
  listFailedForJob(@Param('jobId') jobId: string) {
    return this.inspections.listFailedForJob(jobId);
  }
}
