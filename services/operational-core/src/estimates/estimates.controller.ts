import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { CreateEstimateDto, EstimateLineDto } from './dto/create-estimate.dto';
import { RespondApprovalDto } from './dto/respond-approval.dto';
import { EstimatesService } from './estimates.service';

@Controller('estimates')
@UseGuards(PermissionsGuard)
export class EstimatesController {
  constructor(private readonly estimates: EstimatesService) {}

  @Post()
  @RequirePermissions('estimate.manage')
  create(@Body() dto: CreateEstimateDto) {
    return this.estimates.create(dto);
  }

  @Get(':id')
  @RequirePermissions('estimate.read')
  findById(@Param('id') id: string) {
    return this.estimates.findById(id);
  }

  @Get('by-job/:jobId')
  @RequirePermissions('estimate.read')
  listForJob(@Param('jobId') jobId: string) {
    return this.estimates.listForJob(jobId);
  }

  @Post(':id/revise')
  @RequirePermissions('estimate.manage')
  revise(@Param('id') id: string, @Body() body: { lines: EstimateLineDto[]; reason?: string; createdById?: string }) {
    return this.estimates.revise(id, body.lines, body.reason, body.createdById);
  }

  @Post(':id/send-for-approval')
  @RequirePermissions('estimate.manage')
  sendForApproval(@Param('id') id: string) {
    return this.estimates.sendForApproval(id);
  }

  @Patch('approval-requests/:id/respond')
  @RequirePermissions('estimate.approve')
  respond(@Param('id') id: string, @Body() dto: RespondApprovalDto) {
    return this.estimates.respond(id, dto);
  }

  @Post(':id/convert-to-invoice')
  @RequirePermissions('estimate.manage')
  convertToInvoice(@Param('id') id: string, @Body() body: { branchId?: string; warehouseId?: string; documentNumber?: string }) {
    return this.estimates.convertToInvoice(id, body);
  }
}
