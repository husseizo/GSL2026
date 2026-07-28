import { Injectable, NotFoundException } from '@nestjs/common';
import { CopyrightStatus, KnowledgeSourceType } from '@prisma/client';
import { EmbeddingService } from '../embeddings/embedding.service';
import { PrismaService } from '../prisma/prisma.service';

export interface IngestDocumentParams {
  source: string;
  sourceType: KnowledgeSourceType;
  title: string;
  content: string;
  version?: string;
  publicationDate?: Date;
  confidence?: number;
  copyrightStatus?: CopyrightStatus;
  language?: string;
  accessPermissions?: string[];
  sourceUri?: string;
  vehicleId?: string;
  partId?: string;
  lubricantProductId?: string;
  isApproved?: boolean;
  actorId?: string;
}

// The official knowledge repository the spec asks for. Every document
// carries the full metadata envelope (source/version/publicationDate/
// confidence/copyrightStatus/language/accessPermissions) and starts
// unapproved unless the caller explicitly marks it approved — RagService
// and VectorSearchService both filter on `isApproved`, so an ingested-but-
// unreviewed document is invisible to the assistant until a human approves
// it. See docs/architecture/rag-architecture.md.
@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingService,
  ) {}

  async ingestDocument(params: IngestDocumentParams) {
    const document = await this.prisma.knowledgeDocument.create({
      data: {
        source: params.source,
        sourceType: params.sourceType,
        title: params.title,
        version: params.version,
        publicationDate: params.publicationDate,
        confidence: params.confidence ?? 1.0,
        copyrightStatus: params.copyrightStatus ?? CopyrightStatus.UNKNOWN,
        language: params.language ?? 'en',
        accessPermissions: params.accessPermissions,
        sourceUri: params.sourceUri,
        vehicleId: params.vehicleId,
        partId: params.partId,
        lubricantProductId: params.lubricantProductId,
        isApproved: params.isApproved ?? false,
      },
    });

    const embedResult = await this.embeddings.embedDocumentContent(document.id, params.content, params.actorId);

    return { document, ...embedResult };
  }

  approve(documentId: string) {
    return this.prisma.knowledgeDocument.update({ where: { id: documentId }, data: { isApproved: true } });
  }

  reject(documentId: string) {
    return this.prisma.knowledgeDocument.update({ where: { id: documentId }, data: { isApproved: false } });
  }

  list(filter: { sourceType?: KnowledgeSourceType; isApproved?: boolean } = {}) {
    return this.prisma.knowledgeDocument.findMany({ where: filter, orderBy: { createdAt: 'desc' } });
  }

  async getById(documentId: string) {
    const document = await this.prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
      include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
    });
    if (!document) throw new NotFoundException(`Knowledge document ${documentId} not found`);
    return document;
  }

  async reindex(documentId: string, actorId?: string) {
    await this.getById(documentId);
    return this.embeddings.reindexDocument(documentId, actorId);
  }
}
