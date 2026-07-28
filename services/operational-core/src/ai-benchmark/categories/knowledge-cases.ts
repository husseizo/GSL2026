// DGX Prototype 1.7 integration — real KNOWLEDGE-category case generation,
// drawn from real, already-published KnowledgeItemVersion rows (never
// fabricated). Mechanically scaled from whatever the Knowledge Platform
// has actually published — an honest, small sample in this environment
// (see docs/knowledge-platform/real-content-and-limitations.md), not
// padded.
import { PrismaService } from '../../prisma/prisma.service';
import { BenchmarkCaseDraft } from './category-taxonomy';

export interface KnowledgeRetrievalCaseInput {
  query: string;
  expectedItemId: string;
}

export async function buildKnowledgeRetrievalCases(prisma: PrismaService, cap = 100): Promise<BenchmarkCaseDraft[]> {
  const publishedVersions = await prisma.knowledgeItemVersion.findMany({ where: { status: 'PUBLISHED' }, include: { item: true }, take: cap });

  return publishedVersions.map((v) => ({
    externalCaseId: `knowledge-retrieval:${v.itemId}`,
    input: { query: v.title, expectedItemId: v.itemId } satisfies KnowledgeRetrievalCaseInput,
    expectedOutput: { expectedItemId: v.itemId, expectedVersionId: v.id },
    difficulty: 'EASY',
    language: 'en',
    status: 'APPROVED',
    provenance: { source: 'real-published-knowledge-item', derivation: `real KnowledgeItemVersion ${v.id}` },
  }));
}

// Real supersession-accuracy cases — one per real SUPERSEDED version that
// has a real supersedesVersionId chain, checking that current retrieval
// resolves to the newer version, not the superseded one.
export async function buildSupersessionCases(prisma: PrismaService, cap = 50): Promise<BenchmarkCaseDraft[]> {
  const superseded = await prisma.knowledgeItemVersion.findMany({ where: { status: 'SUPERSEDED' }, include: { supersededBy: true }, take: cap });

  return superseded
    .filter((v) => v.supersededBy)
    .map((v) => ({
      externalCaseId: `supersession:${v.id}`,
      input: { oldVersionId: v.id },
      expectedOutput: { expectedCurrentVersionId: v.supersededBy!.id },
      difficulty: 'MEDIUM',
      language: 'en',
      status: 'APPROVED',
      provenance: { source: 'real-supersession-chain', derivation: `real KnowledgeItemVersion ${v.id} superseded by ${v.supersededBy!.id}` },
    }));
}

// Real expired/restricted exclusion cases.
export async function buildExpiredRestrictedCases(prisma: PrismaService, cap = 50): Promise<BenchmarkCaseDraft[]> {
  const expired = await prisma.knowledgeItemVersion.findMany({ where: { status: 'EXPIRED' }, take: cap });
  const restrictedSources = await prisma.knowledgeSource.findMany({ where: { accessClassification: 'RESTRICTED' }, take: cap });

  const cases: BenchmarkCaseDraft[] = expired.map((v) => ({
    externalCaseId: `expired-exclusion:${v.id}`,
    input: { versionId: v.id, kind: 'EXPIRED' },
    expectedOutput: { mustBeExcluded: true },
    difficulty: 'MEDIUM',
    language: 'en',
    status: 'APPROVED',
    provenance: { source: 'real-expired-version', derivation: `real KnowledgeItemVersion ${v.id}, status EXPIRED` },
  }));

  for (const source of restrictedSources) {
    cases.push({
      externalCaseId: `restricted-exclusion:${source.id}`,
      input: { sourceId: source.id, kind: 'RESTRICTED' },
      expectedOutput: { mustBeExcluded: !source.allowedAiUse },
      difficulty: 'MEDIUM',
      language: 'en',
      status: 'APPROVED',
      provenance: { source: 'real-restricted-source', derivation: `real KnowledgeSource ${source.id}, accessClassification RESTRICTED` },
    });
  }

  return cases;
}
