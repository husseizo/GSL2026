import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { getRequestActor } from '../common/permissions/request-actor';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { VectorSearchFilter } from '../vector-search/vector-index.provider';
import { VectorSearchService } from '../vector-search/vector-search.service';
import { RagService } from './rag.service';

@Controller('ai')
@UseGuards(PermissionsGuard)
export class RagController {
  constructor(
    private readonly rag: RagService,
    private readonly vectorSearch: VectorSearchService,
    private readonly aiGateway: AiGatewayService,
  ) {}

  @Post('chat')
  @RequirePermissions('ai.chat')
  async chat(@Body() body: { question: string; filter?: VectorSearchFilter; correlationId?: string }, @Req() req: Request) {
    const actor = getRequestActor(req);
    return this.rag.answer(body.question, body.filter, actor.userId, body.correlationId);
  }

  // Pure retrieval, no generation — for callers that just want to see what
  // evidence exists (or check retrieval quality) without spending an LLM call.
  @Post('search')
  @RequirePermissions('ai.chat')
  async search(@Body() body: { query: string; topK?: number; filter?: VectorSearchFilter; mode?: 'semantic' | 'keyword' | 'hybrid' }, @Req() req: Request) {
    const actor = getRequestActor(req);
    const topK = body.topK ?? 5;

    if (body.mode === 'keyword') {
      return this.vectorSearch.keywordSearch(body.query, topK, body.filter);
    }

    const embedResult = await this.aiGateway.embed({ text: body.query, actorId: actor.userId });
    if (!embedResult.available || !embedResult.embedding) {
      return { available: false, hits: [], errorMessage: embedResult.errorMessage };
    }

    if (body.mode === 'semantic') {
      return this.vectorSearch.semanticSearch(embedResult.embedding, topK, body.filter);
    }

    return this.vectorSearch.hybridSearch(body.query, embedResult.embedding, topK, body.filter);
  }
}
