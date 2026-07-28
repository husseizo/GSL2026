import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { PromptRegistryService, PublishVersionParams } from './prompt-registry.service';

@Controller('ai/prompts')
@UseGuards(PermissionsGuard)
export class PromptRegistryController {
  constructor(private readonly prompts: PromptRegistryService) {}

  @Get()
  @RequirePermissions('ai.prompts.read')
  listTemplates() {
    return this.prompts.listTemplates();
  }

  @Post()
  @RequirePermissions('ai.prompts.manage')
  createTemplate(@Body() body: { name: string; purpose: string }) {
    return this.prompts.createTemplate(body.name, body.purpose);
  }

  @Get(':name/versions')
  @RequirePermissions('ai.prompts.read')
  listVersions(@Param('name') name: string) {
    return this.prompts.listVersions(name);
  }

  @Get(':name/active')
  @RequirePermissions('ai.prompts.read')
  getActiveVersion(@Param('name') name: string) {
    return this.prompts.getActiveVersion(name);
  }

  @Post(':name/versions')
  @RequirePermissions('ai.prompts.manage')
  publishVersion(@Param('name') name: string, @Body() body: PublishVersionParams) {
    return this.prompts.publishVersion(name, body);
  }
}
