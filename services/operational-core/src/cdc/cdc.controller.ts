import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { CdcService, CdcSourceConfig } from './cdc.service';

@ApiTags('cdc')
@Controller('cdc')
@UseGuards(PermissionsGuard)
export class CdcController {
  constructor(private readonly cdc: CdcService) {}

  @Post('sources/start')
  @RequirePermissions('integration.manage')
  start(@Body() config: CdcSourceConfig) {
    return this.cdc.startReplication(config);
  }

  @Post('sources/:sourceName/stop')
  @RequirePermissions('integration.manage')
  stop(@Param('sourceName') sourceName: string) {
    return this.cdc.stopReplication(sourceName);
  }

  @Get('sources/:sourceName/events')
  @RequirePermissions('integration.manage')
  events(@Param('sourceName') sourceName: string, @Query('limit') limit?: string) {
    return this.cdc.listEvents(sourceName, limit ? Number(limit) : undefined);
  }

  @Get('sources/:sourceName/checkpoint')
  @RequirePermissions('integration.manage')
  checkpoint(@Param('sourceName') sourceName: string) {
    return this.cdc.getCheckpoint(sourceName);
  }

  @Get('sources/:sourceName/conflicts')
  @RequirePermissions('integration.manage')
  conflicts(@Param('sourceName') sourceName: string) {
    return this.cdc.listConflicts(sourceName);
  }
}
