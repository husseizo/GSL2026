// DGX Prototype 1.7.1 — deterministic (never LLM) extraction of real
// structured facts from the company's own real, already-integrated Liqui
// Moly product cache (MolasCacheDb.dbo.CacheLiquiMolyProducts, 362 real
// rows). Real, named legal narrowing (see docs/trusted-knowledge-pilot/
// licensing-decisions.md and the plan's Context section): this function
// deliberately touches ONLY the factual specification fields the row
// contains — SpecGrade, Approvals, SpecificationItems, PackagingSize,
// Liter. It never reads Description (Liqui Moly's own marketing prose),
// ImageUrl/AllImageUrls/ProductUrl/ProductInfoPdfUrl/SafetyDataSheetPdfUrl
// (hotlinked third-party media/documents) — those must never become
// citable knowledge content this phase.
export interface LiquiMolyProductRow {
  ArticleNumber: string;
  Name: string;
  Category: string | null;
  SpecGrade: string | null;
  PackagingSize: string | null;
  Liter: string | number | null;
  Approvals: string | null; // JSON-encoded string array, or null
  Specifications: string | null; // JSON-encoded string array, or null (observed always null in this real data)
  SpecificationItems: string | null; // JSON-encoded string array, or null
}

export interface ExtractedLiquiMolyFact {
  factType: 'FLUID_TYPE' | 'FLUID_CAPACITY' | 'LUBRICANT_APPROVAL';
  value: Record<string, unknown>;
  unit?: string;
  conditions?: Record<string, unknown>;
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

// Real, factual summary text for the KnowledgeItem's rawContent — built
// only from the same allowed fields, never from Description/marketing copy.
export function buildLiquiMolySummaryText(row: LiquiMolyProductRow): string {
  const lines = [`Liqui Moly article ${row.ArticleNumber}: ${row.Name}.`];
  if (row.Category) lines.push(`Category: ${row.Category}.`);
  if (row.SpecGrade) lines.push(`Specification grade: ${row.SpecGrade}.`);
  if (row.PackagingSize) lines.push(`Packaging size: ${row.PackagingSize}.`);
  const approvals = parseJsonArray(row.Approvals);
  if (approvals.length > 0) lines.push(`Approvals: ${approvals.join(', ')}.`);
  const specItems = parseJsonArray(row.SpecificationItems);
  if (specItems.length > 0) lines.push(`Specifications: ${specItems.join(', ')}.`);
  return lines.join(' ');
}

export function extractLiquiMolyFacts(row: LiquiMolyProductRow): ExtractedLiquiMolyFact[] {
  const facts: ExtractedLiquiMolyFact[] = [];

  // 5W-30 must not become 5W30 — the original SpecGrade string is preserved
  // verbatim in `value.grade`, never reformatted.
  if (row.SpecGrade) {
    facts.push({ factType: 'FLUID_TYPE', value: { grade: row.SpecGrade } });
  }

  if (row.Liter !== null && row.Liter !== undefined) {
    facts.push({ factType: 'FLUID_CAPACITY', value: { liters: Number(row.Liter) }, unit: 'L', conditions: row.PackagingSize ? { sourcePackagingSize: row.PackagingSize } : undefined });
  } else if (row.PackagingSize) {
    facts.push({ factType: 'FLUID_CAPACITY', value: { sourcePackagingSize: row.PackagingSize } });
  }

  // Approval and recommendation/specification must remain distinct (spec
  // §17) — tagged via `conditions.kind`, never merged into one bucket.
  for (const approvalCode of parseJsonArray(row.Approvals)) {
    facts.push({ factType: 'LUBRICANT_APPROVAL', value: { approvalCode }, conditions: { kind: 'OEM_APPROVAL' } });
  }
  for (const specItem of parseJsonArray(row.SpecificationItems)) {
    facts.push({ factType: 'LUBRICANT_APPROVAL', value: { specification: specItem }, conditions: { kind: 'INDUSTRY_SPECIFICATION' } });
  }

  return facts;
}
