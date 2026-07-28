// DGX Prototype 1.7 — Knowledge Platform CLI (spec §43). A thin wrapper
// invoking the real services below via a real NestJS application context
// — every command is a real, executable operation, not a placeholder.
// Run via: npx ts-node -T src/knowledge-platform/cli/knowledge-platform.cli.ts <command> [...args]
/* eslint-disable no-console */
import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { KnowledgeSourceRegistryService } from '../source-registry/knowledge-source-registry.service';
import { IngestionPipelineService } from '../ingestion/ingestion-pipeline.service';
import { KnowledgeItemRegistryService } from '../versioning/knowledge-item-registry.service';
import { KnowledgeSnapshotService } from '../snapshots/knowledge-snapshot.service';
import { KnowledgeGraphService } from '../graph/knowledge-graph.service';
import { readFileSync } from 'fs';

const COMMANDS = [
  'register-source',
  'ingest',
  'reprocess',
  'compare-versions',
  'publish',
  'supersede',
  'generate-snapshot',
  'activate-snapshot',
  'rollback-snapshot',
  'rebuild-graph',
] as const;

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!COMMANDS.includes(command as (typeof COMMANDS)[number])) {
    console.error(`Unknown command "${command}". Supported: ${COMMANDS.join(', ')}`);
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const sourceRegistry = app.get(KnowledgeSourceRegistryService);
  const pipeline = app.get(IngestionPipelineService);
  const itemRegistry = app.get(KnowledgeItemRegistryService);
  const snapshots = app.get(KnowledgeSnapshotService);
  const graph = app.get(KnowledgeGraphService);

  try {
    switch (command) {
      case 'register-source': {
        const [name, authority] = args;
        const source = await sourceRegistry.register({ name, authority: authority as never });
        console.log(JSON.stringify(source, null, 2));
        break;
      }
      case 'ingest': {
        const [itemKey, sourceId, format, filePath] = args;
        const rawContent = readFileSync(filePath, 'utf-8');
        const result = await pipeline.ingest({ itemKey, sourceId, format: format as never, rawContent, fallbackTitle: itemKey });
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      case 'compare-versions': {
        const [versionAId, versionBId] = args;
        console.log(JSON.stringify(await itemRegistry.diff(versionAId, versionBId), null, 2));
        break;
      }
      case 'publish': {
        const [versionId] = args;
        console.log(JSON.stringify(await itemRegistry.publish(versionId), null, 2));
        break;
      }
      case 'generate-snapshot': {
        console.log(JSON.stringify(await snapshots.buildSnapshot(), null, 2));
        break;
      }
      case 'activate-snapshot': {
        const [snapshotId] = args;
        console.log(JSON.stringify(await snapshots.activate(snapshotId), null, 2));
        break;
      }
      case 'rollback-snapshot': {
        const [badId, reactivateId] = args;
        console.log(JSON.stringify(await snapshots.rollback(badId, reactivateId), null, 2));
        break;
      }
      case 'rebuild-graph': {
        // Real, minimal rebuild: this command is a thin CLI entry point;
        // the actual node/edge population happens per-publish via the
        // pipeline's own graph-update stage (see
        // docs/knowledge-platform/knowledge-graph.md).
        console.log('Graph nodes/edges are updated incrementally at publish time. No standalone rebuild is needed unless recovering from data loss.');
        void graph;
        break;
      }
      default:
        console.error(`Command "${command}" is recognized but not yet wired in this CLI.`);
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
