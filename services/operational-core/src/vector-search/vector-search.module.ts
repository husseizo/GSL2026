import { Module } from '@nestjs/common';
import { PostgresArrayVectorIndexProvider } from './postgres-array-vector-index.provider';
import { VECTOR_INDEX_PROVIDER } from './vector-index.provider';
import { VectorSearchService } from './vector-search.service';

@Module({
  providers: [
    VectorSearchService,
    { provide: VECTOR_INDEX_PROVIDER, useClass: PostgresArrayVectorIndexProvider },
  ],
  exports: [VectorSearchService],
})
export class VectorSearchModule {}
