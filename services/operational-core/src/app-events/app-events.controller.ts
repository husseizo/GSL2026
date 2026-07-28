import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AppEventType } from '@prisma/client';
import { PaginationQueryDto } from '../common/pagination/pagination.dto';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { AppEventsService } from './app-events.service';
import { IngestEventBatchDto } from './dto/ingest-event.dto';

@Controller('app-events')
@UseGuards(PermissionsGuard)
export class AppEventsController {
  constructor(private readonly appEvents: AppEventsService) {}

  @Post('ingest')
  @RequirePermissions('logs.import')
  ingest(@Body('sourceApplication') sourceApplication: string, @Body() dto: IngestEventBatchDto) {
    return this.appEvents.ingestBatch(sourceApplication, dto.events);
  }

  @Get()
  @RequirePermissions('logs.read')
  search(@Query() query: PaginationQueryDto, @Query('eventType') eventType?: AppEventType, @Query('sessionId') sessionId?: string) {
    return this.appEvents.search({ ...query, eventType, sessionId });
  }

  @Get('failed')
  @RequirePermissions('logs.read')
  listFailed() {
    return this.appEvents.listFailed();
  }

  @Get('zero-result-searches')
  @RequirePermissions('logs.read')
  listZeroResultSearches(@Query() query: PaginationQueryDto) {
    return this.appEvents.listZeroResultSearches(query);
  }

  @Get('out-of-stock-interactions')
  @RequirePermissions('logs.read')
  listOutOfStockInteractions(@Query() query: PaginationQueryDto) {
    return this.appEvents.listOutOfStockInteractions(query);
  }
}
