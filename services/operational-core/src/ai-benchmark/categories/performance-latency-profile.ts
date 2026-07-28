// DGX Prototype 1.6 — PERFORMANCE / LATENCY / RELIABILITY.
//
// Per the honest dataset-scale plan, these are NOT case-authored content
// pools — they're measured by replaying a representative real query mix
// (already-real identifier + generative queries pulled from other
// categories) at volume and timing the real calls, not inventing a
// separate "performance benchmark" text corpus.
import { PrismaService } from '../../prisma/prisma.service';

export interface QueryMixSample {
  query: string;
  kind: 'DETERMINISTIC' | 'GENERATIVE';
}

const DEFAULT_DETERMINISTIC_SAMPLE_SIZE = 30;
const DEFAULT_GENERATIVE_SAMPLE_SIZE = 5; // kept small — every generative sample is a real, slow (CPU-only) Ollama call

// A real representative mix: mostly deterministic (matches real production
// traffic shape, where most catalogue queries are exact-identifier
// lookups), a small generative slice (expensive, capped hard).
export async function buildQueryMixSample(prisma: PrismaService, deterministicSize = DEFAULT_DETERMINISTIC_SAMPLE_SIZE, generativeSize = DEFAULT_GENERATIVE_SAMPLE_SIZE): Promise<QueryMixSample[]> {
  const samples: QueryMixSample[] = [];

  const realParts = await prisma.part.findMany({ where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB' }, take: deterministicSize });
  for (const p of realParts) {
    samples.push({ query: p.oemNumber, kind: 'DETERMINISTIC' });
  }

  const descriptiveParts = await prisma.part.findMany({ where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB', productName: { not: '' } }, take: generativeSize });
  for (const p of descriptiveParts) {
    samples.push({ query: `What is the recommended replacement for ${p.productName}?`, kind: 'GENERATIVE' });
  }

  return samples;
}

export function percentile(sortedMs: number[], p: number): number {
  if (sortedMs.length === 0) return 0;
  const index = Math.min(sortedMs.length - 1, Math.floor((p / 100) * sortedMs.length));
  return sortedMs[index];
}
