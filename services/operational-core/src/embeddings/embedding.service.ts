import { Injectable, Logger } from '@nestjs/common';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { PrismaService } from '../prisma/prisma.service';
import { checksumOf, chunkText } from './chunking';

export interface EmbedDocumentResult {
  chunksCreated: number;
  chunksSkippedDuplicate: number;
  chunksFailed: number;
}

// Chunk -> checksum-dedup -> embed -> store. The only place KnowledgeChunk
// rows are written. "Do not embed duplicated records" is enforced by
// checking the (documentId, checksum) unique key before ever calling the
// (comparatively expensive) embedding model — a re-ingested unchanged
// document costs one query per chunk, not one embedding call per chunk. See
// docs/architecture/dgx-platform.md.
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
  ) {}

  async embedDocumentContent(documentId: string, content: string, actorId?: string): Promise<EmbedDocumentResult> {
    const chunks = chunkText(content);
    let chunksCreated = 0;
    let chunksSkippedDuplicate = 0;
    let chunksFailed = 0;

    for (let i = 0; i < chunks.length; i++) {
      const text = chunks[i];
      const checksum = checksumOf(text);

      const existing = await this.prisma.knowledgeChunk.findUnique({
        where: { documentId_checksum: { documentId, checksum } },
      });
      if (existing) {
        chunksSkippedDuplicate += 1;
        continue;
      }

      const embedResult = await this.aiGateway.embed({ text, actorId });
      if (!embedResult.available || !embedResult.embedding) {
        this.logger.warn(`Embedding failed for document ${documentId} chunk ${i}: ${embedResult.errorMessage}`);
        chunksFailed += 1;
        continue;
      }

      await this.prisma.knowledgeChunk.create({
        data: {
          documentId,
          chunkIndex: i,
          text,
          checksum,
          embeddingModel: embedResult.model ?? 'unknown',
          embeddingVersion: 1,
          embedding: embedResult.embedding,
        },
      });
      chunksCreated += 1;
    }

    return { chunksCreated, chunksSkippedDuplicate, chunksFailed };
  }

  // Background re-indexing: re-embeds every chunk of a document with
  // whatever embedding model is current, bumping embeddingVersion so a
  // caller can tell an old vector apart from a freshly re-computed one
  // without re-chunking the source text.
  async reindexDocument(documentId: string, actorId?: string): Promise<EmbedDocumentResult> {
    const chunks = await this.prisma.knowledgeChunk.findMany({ where: { documentId } });
    let chunksCreated = 0;
    const chunksSkippedDuplicate = 0;
    let chunksFailed = 0;

    for (const chunk of chunks) {
      const embedResult = await this.aiGateway.embed({ text: chunk.text, actorId });
      if (!embedResult.available || !embedResult.embedding) {
        chunksFailed += 1;
        continue;
      }
      await this.prisma.knowledgeChunk.update({
        where: { id: chunk.id },
        data: {
          embedding: embedResult.embedding,
          embeddingModel: embedResult.model ?? chunk.embeddingModel,
          embeddingVersion: { increment: 1 },
        },
      });
      chunksCreated += 1;
    }

    return { chunksCreated, chunksSkippedDuplicate, chunksFailed };
  }
}
