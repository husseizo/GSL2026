import { Module } from '@nestjs/common';
import { PartMatcherService } from './matching/part-matcher.service';
import { SIMILARITY_SCORER } from './matching/similarity-scorer.token';
import { TokenOverlapSimilarityScorer } from './matching/similarity-scorer';
import { PartsController } from './parts.controller';
import { PartsService } from './parts.service';

@Module({
  controllers: [PartsController],
  providers: [
    PartsService,
    PartMatcherService,
    { provide: SIMILARITY_SCORER, useClass: TokenOverlapSimilarityScorer },
  ],
  exports: [PartsService, PartMatcherService],
})
export class PartsModule {}
