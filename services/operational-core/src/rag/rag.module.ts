import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { PromptRegistryModule } from '../prompt-registry/prompt-registry.module';
import { VectorSearchModule } from '../vector-search/vector-search.module';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

@Module({
  imports: [AiGatewayModule, VectorSearchModule, PromptRegistryModule],
  controllers: [RagController],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
