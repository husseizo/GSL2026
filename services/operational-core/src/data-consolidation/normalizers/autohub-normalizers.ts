// Pure mapping functions from Parts_Catalog's real raw column shapes (see
// docs/data-sources/parts-catalog-autohub-profile.md).
import { PartMatchCandidateInput } from '../matching/part-consolidation-matching.service';

export interface RawOitm {
  item_code: string | null;
  article_number: string | null;
  canonical_oem_number: string | null;
  name: string | null;
  part_group: string | null;
  sell_price_tzs: string | number | null; // numeric columns come back as strings from node-postgres
  supplier_name: string | null;
}

export function normalizeAutoHubPart(raw: RawOitm): PartMatchCandidateInput & { internalItemCode: string | null; resolvedOemNumber: string; productName: string; category: string | null; sellingPrice: number | null; brand: string | null } {
  const resolvedOemNumber = raw.canonical_oem_number?.trim() || raw.article_number?.trim() || raw.item_code?.trim() || 'UNKNOWN';
  return {
    sourceSystem: 'PARTS_CATALOG_AUTOHUB',
    sourceRecordId: raw.item_code ?? raw.article_number ?? `oitm-no-code-${resolvedOemNumber}`,
    itemCode: raw.item_code,
    oemNumber: raw.canonical_oem_number,
    description: raw.name,
    internalItemCode: raw.item_code,
    resolvedOemNumber,
    productName: raw.name?.trim() || resolvedOemNumber,
    category: raw.part_group,
    sellingPrice: raw.sell_price_tzs != null ? Number(raw.sell_price_tzs) : null,
    brand: raw.supplier_name,
  };
}

export interface RawAutoHubSalesOrder {
  DocEntry: number;
  DocNum?: number;
  CardCode: string;
  CardName?: string | null;
  DocDate: string;
  DocStatus: string;
  DocTotal: string | number;
}

export interface NormalizedAutoHubSalesOrder {
  sourceSystem: string;
  sourceRecordId: string;
  docEntry: number;
  cardCode: string;
  cardName: string | null;
  docStatus: string;
  docDate: Date;
  docTotal: number;
}

export function normalizeAutoHubSalesOrder(raw: RawAutoHubSalesOrder): NormalizedAutoHubSalesOrder {
  return {
    sourceSystem: 'PARTS_CATALOG_AUTOHUB',
    sourceRecordId: String(raw.DocEntry),
    docEntry: raw.DocEntry,
    cardCode: raw.CardCode,
    cardName: raw.CardName ?? null,
    docStatus: raw.DocStatus,
    docDate: new Date(raw.DocDate),
    docTotal: Number(raw.DocTotal ?? 0),
  };
}
