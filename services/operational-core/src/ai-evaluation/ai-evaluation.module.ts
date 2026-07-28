import { Module } from '@nestjs/common';
import { RagModule } from '../rag/rag.module';
import { AiEvaluationController } from './ai-evaluation.controller';
import { AiEvaluationService } from './ai-evaluation.service';

@Module({
  imports: [RagModule],
  controllers: [AiEvaluationController],
  providers: [AiEvaluationService],
  exports: [AiEvaluationService],
})
export class AiEvaluationModule {}
