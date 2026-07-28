import { Module } from '@nestjs/common';
import { IntegrationModule } from '../integration/integration.module';
import { AppEventsController } from './app-events.controller';
import { AppEventsService } from './app-events.service';

@Module({
  imports: [IntegrationModule],
  controllers: [AppEventsController],
  providers: [AppEventsService],
  exports: [AppEventsService],
})
export class AppEventsModule {}
