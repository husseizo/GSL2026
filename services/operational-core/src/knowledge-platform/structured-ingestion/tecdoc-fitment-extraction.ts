// DGX Prototype 1.7.1 — deterministic (never LLM) extraction from the
// company's own real, already-integrated TecDoc-derived parts catalogue
// (Parts_Catalog.tecdoc_article / tecdoc_article_vehicle — see
// docs/data-sources/parts-catalog-autohub-profile.md). Same conservative
// legal narrowing as liqui-moly-extraction.ts: `image_url` is never touched
// or stored as citable content.
export interface TecdocArticleRow {
  tecdoc_article_id: number;
  article_number: string;
  name: string;
  supplier_name: string | null;
  canonical_oem_number: string | null;
  ean_barcode: string | null;
  weight_kg: string | number | null;
  part_group: string | null;
  part_component: string | null;
}

export interface TecdocArticleVehicleRow {
  article_id: number;
  vehicle_id: number;
  model_id: number;
}

export interface ExtractedTecdocFact {
  factType: 'PART_DIMENSION' | 'FITMENT';
  value: Record<string, unknown>;
  unit?: string;
}

export function buildTecdocArticleSummaryText(row: TecdocArticleRow): string {
  const lines = [`TecDoc article ${row.tecdoc_article_id} (${row.article_number}): ${row.name}.`];
  if (row.supplier_name) lines.push(`Supplier: ${row.supplier_name}.`);
  if (row.canonical_oem_number) lines.push(`Canonical OEM number: ${row.canonical_oem_number}.`);
  if (row.part_group) lines.push(`Part group: ${row.part_group}${row.part_component ? ` (${row.part_component})` : ''}.`);
  return lines.join(' ');
}

export function extractTecdocArticleFacts(row: TecdocArticleRow): ExtractedTecdocFact[] {
  const facts: ExtractedTecdocFact[] = [];
  if (row.weight_kg !== null && row.weight_kg !== undefined && Number(row.weight_kg) > 0) {
    facts.push({ factType: 'PART_DIMENSION', value: { weightKg: Number(row.weight_kg), articleNumber: row.article_number }, unit: 'kg' });
  }
  if (row.canonical_oem_number) {
    facts.push({ factType: 'FITMENT', value: { canonicalOemNumber: row.canonical_oem_number, articleNumber: row.article_number } });
  }
  return facts;
}

// Real graph-edge shape for a fitment row — PART -FITS-> VEHICLE. Fitment
// triples are graph edges, not reviewable prose, so they deliberately
// bypass the item/claim/review pipeline (see decision-log.md).
export interface FitmentGraphEdge {
  partRefId: string;
  vehicleRefId: string;
  vehicleLabel: string;
}

export function buildFitmentGraphEdge(row: TecdocArticleVehicleRow): FitmentGraphEdge {
  return {
    partRefId: String(row.article_id),
    vehicleRefId: String(row.vehicle_id),
    vehicleLabel: `TecDoc vehicle ${row.vehicle_id} (model ${row.model_id})`,
  };
}
