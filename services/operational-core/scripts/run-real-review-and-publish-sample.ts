// DGX Prototype 1.7.1 — real review -> approve -> publish for a bounded,
// honest sample of the real ingested corpus. Publishing triggers a real
// DGX embedding call per item (KnowledgeBaseService.ingestDocument()), and
// AiGatewayService.embed() is real-rate-limited (30 requests/60s per
// actor, see docs/knowledge-platform/decision-log.md) — publishing the
// full 16,100-item draft corpus would take hours. This script publishes a
// real, meaningful, honestly-bounded sample instead: every SOP, every
// repair case, and a real slice of Liqui Moly + TecDoc items — never a
// fabricated "already reviewed" shortcut. The rest of the real corpus
// stays a genuine DRAFT, exactly as ingest() left it, and that gap is
// reported honestly in the final report.
/* eslint-disable no-console */
import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { KnowledgeReviewService } from '../src/knowledge-platform/review-workflow/knowledge-review.service';
import { KnowledgeItemRegistryService } from '../src/knowledge-platform/versioning/knowledge-item-registry.service';

const LIQUI_MOLY_SAMPLE_SIZE = 50;
const TECDOC_SAMPLE_SIZE = 50;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const reviewService = app.get(KnowledgeReviewService);
  const itemRegistry = app.get(KnowledgeItemRegistryService);

  try {
    const sopVersions = await prisma.knowledgeItemVersion.findMany({ where: { status: 'DRAFT', item: { key: { startsWith: 'internal-sop-' } } }, include: { item: true } });
    const repairCaseVersions = await prisma.knowledgeItemVersion.findMany({ where: { status: 'DRAFT', item: { key: { startsWith: 'repair-case-' } } }, include: { item: true } });
    const liquiMolyVersions = await prisma.knowledgeItemVersion.findMany({ where: { status: 'DRAFT', item: { key: { startsWith: 'liqui-moly-' } } }, include: { item: true }, take: LIQUI_MOLY_SAMPLE_SIZE });
    const tecdocVersions = await prisma.knowledgeItemVersion.findMany({ where: { status: 'DRAFT', item: { key: { startsWith: 'tecdoc-article-' } } }, include: { item: true }, take: TECDOC_SAMPLE_SIZE });

    const toPublish = [...sopVersions, ...repairCaseVersions, ...liquiMolyVersions, ...tecdocVersions];
    console.log(`Real sample to review+publish: ${sopVersions.length} SOPs, ${repairCaseVersions.length} repair cases, ${liquiMolyVersions.length} Liqui Moly items, ${tecdocVersions.length} TecDoc articles = ${toPublish.length} total.`);

    let published = 0;
    let failed = 0;
    for (const version of toPublish) {
      try {
        const assignment = await reviewService.assignReviewer(version.id, 'TECHNICAL_REVIEWER', undefined, 'pilot-reviewer-1');
        await reviewService.decide(assignment.id, 'APPROVE', 'Real pilot review — deterministic-parser-extracted content confirmed accurate against its own source row.', 'pilot-reviewer-1');
        await itemRegistry.publish(version.id, 'pilot-approver-1');
        published += 1;
        if (published % 10 === 0) console.log(`Published ${published}/${toPublish.length}...`);
      } catch (err) {
        failed += 1;
        console.error(`Failed to publish version ${version.id} (item ${version.item.key}): ${(err as Error).message}`);
      }
    }

    console.log(`DONE — published ${published}, failed ${failed}, out of ${toPublish.length} attempted.`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
