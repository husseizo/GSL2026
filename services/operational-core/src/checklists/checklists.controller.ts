import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ChecklistCategory } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { ChecklistsService } from './checklists.service';
import { CreateChecklistTemplateDto } from './dto/create-checklist-template.dto';
import { SubmitChecklistResponseDto } from './dto/submit-checklist-response.dto';

@Controller('checklists')
@UseGuards(PermissionsGuard)
export class ChecklistsController {
  constructor(private readonly checklists: ChecklistsService) {}

  @Post('templates')
  @RequirePermissions('jobcard.manage')
  createTemplate(@Body() dto: CreateChecklistTemplateDto) {
    return this.checklists.createTemplate(dto);
  }

  @Get('templates')
  @RequirePermissions('jobcard.read')
  listTemplates(@Query('category') category?: ChecklistCategory) {
    return this.checklists.listTemplates(category);
  }

  @Post('responses')
  @RequirePermissions('jobcard.manage')
  submitResponse(@Body() dto: SubmitChecklistResponseDto) {
    return this.checklists.submitResponse(dto);
  }

  @Get('responses')
  @RequirePermissions('jobcard.read')
  listResponsesForEntity(@Query('entityType') entityType: string, @Query('entityId') entityId: string) {
    return this.checklists.listResponsesForEntity(entityType, entityId);
  }
}
