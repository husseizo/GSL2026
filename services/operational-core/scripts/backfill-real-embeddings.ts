// DGX Prototype 1.7.1 — real, paced backfill of embeddings for the
// materialized KnowledgeDocument rows created by run-real-review-and-publish-sample.ts.
// A real bug found by this phase's own first real gate run: that script
// called publish() (which calls EmbeddingService.embedDocumentContent())
// in a tight loop, violating this project's own documented real rate-limit
// discipline (CatalogueIndexVersionService.paceEmbedCall(), ~2.1s/call —
// see docs/ai/decision-log-catalogue-rag.md) — most items ended up with
// zero real embedded chunks. embedDocumentContent() only skips chunks that
// already have a real KnowledgeChunk row, so re-running it, paced, safely
// backfills exactly the missing chunks without creating new versions.
/* eslint-disable no-console */
import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmbeddingService } from '../src/embeddings/embedding.service';

const EMBED_CALL_INTERVAL_MS = 2100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const embeddings = app.get(EmbeddingService);

  try {
    const documents = await prisma.knowledgeDocument.findMany({ where: { knowledgeItemVersionId: { not: null }, isApproved: true }, include: { knowledgeItemVersion: true } });
    console.log(`Found ${documents.length} real materialized, approved KnowledgeDocument rows to check/backfill.`);

    let backfilled = 0;
    let alreadyOk = 0;
    let lastCallAt = 0;

    for (const doc of documents) {
      const existingChunks = await prisma.knowledgeChunk.count({ where: { documentId: doc.id } });
      if (existingChunks > 0) {
        alreadyOk += 1;
        continue;
      }

      const elapsed = Date.now() - lastCallAt;
      if (elapsed < EMBED_CALL_INTERVAL_MS) await sleep(EMBED_CALL_INTERVAL_MS - elapsed);
      lastCallAt = Date.now();

      const content = doc.knowledgeItemVersion?.rawContent ?? '';
      if (!content) {
        console.warn(`KnowledgeDocument ${doc.id} has no linked KnowledgeItemVersion.rawContent — skipping.`);
        continue;
      }
      const result = await embeddings.embedDocumentContent(doc.id, content);
      if (result.chunksCreated > 0) backfilled += 1;
      if ((backfilled + alreadyOk) % 10 === 0) console.log(`Progress: ${backfilled} backfilled, ${alreadyOk} already OK, ${documents.length} total.`);
    }

    console.log(`DONE — ${backfilled} documents backfilled with real embeddings, ${alreadyOk} already had real chunks, out of ${documents.length}.`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
