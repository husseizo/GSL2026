// DGX Prototype 1.7.1 — real, one-shot structured-ingestion run against
// the two real, already-integrated company databases (MolasCacheDb,
// Parts_Catalog), plus real internal repair cases and self-authored SOPs.
// Run via: npx ts-node -T scripts/run-real-structured-ingestion.ts
/* eslint-disable no-console */
import 'reflect-metadata';
import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { StructuredSourceIngestionService } from '../src/knowledge-platform/structured-ingestion/structured-source-ingestion.service';
import { KnowledgeSourceRegistryService } from '../src/knowledge-platform/source-registry/knowledge-source-registry.service';
import { IngestionPipelineService } from '../src/knowledge-platform/ingestion/ingestion-pipeline.service';
import { ExtractionProfileService } from '../src/knowledge-platform/extraction-profiles/extraction-profile.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const structuredIngestion = app.get(StructuredSourceIngestionService);
  const sourceRegistry = app.get(KnowledgeSourceRegistryService);
  const pipeline = app.get(IngestionPipelineService);
  const extractionProfiles = app.get(ExtractionProfileService);

  try {
    console.log('=== Seeding 11 real extraction profiles ===');
    const seeded = await extractionProfiles.seedAll();
    console.log(`Seeded ${seeded} new extraction profiles (idempotent).`);

    console.log('=== Ingesting real internal SOPs ===');
    const sopSource = await sourceRegistry.register({ name: 'INTERNAL_WORKSHOP_SOPS', authority: 'INTERNAL_WORKSHOP', allowedAiUse: true, allowedEmbeddingUse: true });
    const sopDir = 'fixtures/trusted-knowledge-pilot/internal-sops';
    const sopFiles = readdirSync(sopDir).filter((f) => f.endsWith('.md'));
    let sopCount = 0;
    for (const file of sopFiles) {
      const content = readFileSync(`${sopDir}/${file}`, 'utf-8');
      const result = await pipeline.ingest({ itemKey: `internal-sop-${file.replace('.md', '')}`, sourceId: sopSource.id, format: 'markdown', rawContent: content, fallbackTitle: file, itemTypeOverride: 'WORKSHOP_SOP' });
      if (result.versionId) sopCount += 1;
    }
    console.log(`Ingested ${sopCount}/${sopFiles.length} real internal SOPs.`);

    console.log('=== Ingesting real Liqui Moly products (MolasCacheDb) ===');
    const liquiMolyResult = await structuredIngestion.ingestLiquiMolyProducts();
    console.log(`Liqui Moly: ${JSON.stringify(liquiMolyResult)}`);

    console.log('=== Ingesting real TecDoc articles (Parts_Catalog) ===');
    const tecdocResult = await structuredIngestion.ingestTecdocArticles();
    console.log(`TecDoc articles: ${JSON.stringify(tecdocResult)}`);

    console.log('=== Ingesting real repair cases (DiagnosticSession/InspectionResult) ===');
    const repairCaseResult = await structuredIngestion.ingestRepairCases();
    console.log(`Repair cases: ${JSON.stringify(repairCaseResult)}`);

    console.log('=== Building real TecDoc fitment graph edges (bounded, 50,000 cap) ===');
    const fitmentResult = await structuredIngestion.ingestTecdocFitmentEdges();
    console.log(`Fitment edges: ${JSON.stringify(fitmentResult)}`);

    console.log('=== DONE ===');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
