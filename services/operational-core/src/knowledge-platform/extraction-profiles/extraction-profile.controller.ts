import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { ExtractionProfileService, ExtractionProfileFieldRules } from './extraction-profile.service';

@Controller('knowledge/extraction-profiles')
@UseGuards(PermissionsGuard)
export class ExtractionProfileController {
  constructor(private readonly profiles: ExtractionProfileService) {}

  @Get(':documentType')
  @RequirePermissions('knowledgeSource.read')
  getActive(@Param('documentType') documentType: string) {
    return this.profiles.getActiveProfile(documentType);
  }

  @Get(':documentType/versions')
  @RequirePermissions('knowledgeSource.read')
  listVersions(@Param('documentType') documentType: string) {
    return this.profiles.listVersions(documentType);
  }

  @Post(':documentType')
  @RequirePermissions('knowledgeSource.manage')
  create(@Param('documentType') documentType: string, @Body() fieldRules: ExtractionProfileFieldRules) {
    return this.profiles.createProfile(documentType, fieldRules);
  }
}
