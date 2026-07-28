import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { AddDiagnosticCodeDto } from './dto/add-diagnostic-code.dto';
import { CreateDiagnosticSessionDto } from './dto/create-diagnostic-session.dto';
import { DiagnosticsService } from './diagnostics.service';

@Controller('diagnostics')
@UseGuards(PermissionsGuard)
export class DiagnosticsController {
  constructor(private readonly diagnostics: DiagnosticsService) {}

  @Post('sessions')
  @RequirePermissions('diagnostics.manage')
  createSession(@Body() dto: CreateDiagnosticSessionDto) {
    return this.diagnostics.createSession(dto);
  }

  @Patch('sessions/:id/complete')
  @RequirePermissions('diagnostics.manage')
  completeSession(@Param('id') id: string) {
    return this.diagnostics.completeSession(id);
  }

  @Patch('sessions/:id/procedure')
  @RequirePermissions('diagnostics.manage')
  recordProcedure(@Param('id') id: string, @Body('steps') steps: string[]) {
    return this.diagnostics.recordProcedure(id, steps);
  }

  @Post('sessions/:id/codes')
  @RequirePermissions('diagnostics.manage')
  addCode(@Param('id') id: string, @Body() dto: AddDiagnosticCodeDto) {
    return this.diagnostics.addCode(id, dto);
  }

  @Post('sessions/:id/symptoms')
  @RequirePermissions('diagnostics.manage')
  addSymptom(@Param('id') id: string, @Body() body: { description: string; reportedBy?: 'TECHNICIAN' | 'CUSTOMER' }) {
    return this.diagnostics.addSymptom(id, body.description, body.reportedBy);
  }

  @Post('sessions/:id/suspected-causes')
  @RequirePermissions('diagnostics.manage')
  addSuspectedCause(@Param('id') id: string, @Body() body: { description: string; diagnosticCodeId?: string }) {
    return this.diagnostics.addSuspectedCause(id, body.description, body.diagnosticCodeId);
  }

  @Patch('suspected-causes/:id/confirm')
  @RequirePermissions('diagnostics.manage')
  confirmCause(@Param('id') id: string, @Body('confirmedById') confirmedById?: string) {
    return this.diagnostics.confirmCause(id, confirmedById);
  }

  @Post('sessions/:id/attachments')
  @RequirePermissions('diagnostics.manage')
  addAttachment(@Param('id') id: string, @Body() body: { url: string; kind: string }) {
    return this.diagnostics.addAttachment(id, body.url, body.kind);
  }

  @Get('jobs/:jobId/sessions')
  @RequirePermissions('diagnostics.read')
  listSessionsForJob(@Param('jobId') jobId: string) {
    return this.diagnostics.listSessionsForJob(jobId);
  }

  @Get('vehicles/:vehicleId/code-history')
  @RequirePermissions('diagnostics.read')
  listCodeHistoryForVehicle(@Param('vehicleId') vehicleId: string) {
    return this.diagnostics.listCodeHistoryForVehicle(vehicleId);
  }
}
