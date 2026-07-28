import { Module } from '@nestjs/common';
import { PromptRegistryController } from './prompt-registry.controller';
import { PromptRegistryService } from './prompt-registry.service';

@Module({
  controllers: [PromptRegistryController],
  providers: [PromptRegistryService],
  exports: [PromptRegistryService],
})
export class PromptRegistryModule {}
