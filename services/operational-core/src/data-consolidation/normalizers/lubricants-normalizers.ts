// Pure mapping functions from MolasCacheDb's real raw column shapes (see
// docs/data-sources/molas-cache-db-profile.md) into the canonical shapes
// the matching/import services expect. Kept separate from those services so
// the real-world column-name quirks (CardCode vs CustomerCode, sentinel
// dates, etc.) are isolated in one place and independently testable.
import { CustomerMatchCandidateInput } from '../matching/customer-matching.service';
import { LubricantMatchCandidateInput } from '../matching/lubricant-matching.service';

// MolasCacheDb's .NET-sentinel "never synced" placeholder — see
// docs/data-sources/molas-cache-db-profile.md "Real data-quality findings".
const DOTNET_SENTINEL_DATE = new Date('1899-12-30T00:00:00.000Z').getTime();

export function isSentinelDate(value: unknown): boolean {
  if (!value) return false;
  const time = new Date(value as string).getTime();
  return time === DOTNET_SENTINEL_DATE;
}

export interface RawCacheCustomer {
  CardCode: string;
  CardName: string;
  IsActive: boolean;
  Phone1?: string | null;
  Email?: string | null;
  PriceList?: number | null;
  BillToCountry?: string | null;
}

export function normalizeLubricantsCustomer(raw: RawCacheCustomer): CustomerMatchCandidateInput & { customerCode: string; legalName: string; isActive: boolean; phone: string | null; email: string | null; pricingGroup: string | null } {
  return {
    sourceSystem: 'MOLAS_CACHE_LUBRICANTS',
    sourceRecordId: raw.CardCode,
    customerCode: raw.CardCode,
    legalName: raw.CardName?.trim() || raw.CardCode,
    rawName: raw.CardName ?? null,
    rawPhone: raw.Phone1 ?? null,
    rawTaxNumber: null, // not present in this source — see source-data-risks.md
    rawEmail: raw.Email ?? null,
    phone: raw.Phone1?.trim() || null,
    email: raw.Email?.trim() || null,
    isActive: raw.IsActive ?? true,
    pricingGroup: raw.PriceList != null ? String(raw.PriceList) : null,
  };
}

export interface RawCacheProduct {
  ItemCode: string;
  ItemName: string;
  IsActive: boolean;
  PriceList_1?: number | null;
  WarehouseCode: string;
}

export function normalizeLubricantsProduct(raw: RawCacheProduct): LubricantMatchCandidateInput & { itemCode: string; productName: string; isActive: boolean; sellingPrice: number | null } {
  return {
    sourceSystem: 'MOLAS_CACHE_LUBRICANTS',
    sourceRecordId: raw.ItemCode,
    itemCode: raw.ItemCode,
    brand: null, // brand is not reliably separated from productName in this source — parsed-and-unverified only, never inferred as confirmed. See lubricants-consolidation.md.
    productName: raw.ItemName?.trim() || raw.ItemCode,
    isActive: raw.IsActive ?? true,
    sellingPrice: raw.PriceList_1 ?? null,
  };
}

export interface RawCacheSalesOrder {
  SapDocEntry: number;
  SapDocNum?: number;
  CustomerCode: string;
  DocStatus: string;
  DocDate: string;
  DocTotal: number;
}

export interface NormalizedLubricantsSalesOrder {
  sourceSystem: string;
  sourceRecordId: string;
  docEntry: number;
  customerCode: string;
  docStatus: string;
  docDate: Date;
  docTotal: number;
}

export function normalizeLubricantsSalesOrder(raw: RawCacheSalesOrder): NormalizedLubricantsSalesOrder {
  return {
    sourceSystem: 'MOLAS_CACHE_LUBRICANTS',
    sourceRecordId: String(raw.SapDocEntry),
    docEntry: raw.SapDocEntry,
    customerCode: raw.CustomerCode,
    docStatus: raw.DocStatus,
    docDate: new Date(raw.DocDate),
    docTotal: Number(raw.DocTotal ?? 0),
  };
}

// Real CacheSalesOrderLines columns (see docs/data-sources/molas-cache-db-profile.md):
// Id, SapDocEntry, ItemCode, Quantity, OdooSalesOrderLineId, LineNum, ItemName, Price, LineTotal, WarehouseCode.
// Added in the Data Validation & Business Baselining phase specifically to
// give the lubricant-demand forecasting dataset real per-item quantities —
// see docs/data-readiness/forecast-baselines.md. Extends the existing
// pipeline (StagingService/ImportService), does not duplicate it.
export interface RawCacheSalesOrderLine {
  Id: number;
  SapDocEntry: number;
  ItemCode: string;
  Quantity: number;
  LineNum: number;
  ItemName?: string | null;
  Price?: number | null;
  LineTotal: number;
}

export interface NormalizedLubricantsSalesOrderLine {
  sourceSystem: string;
  sourceRecordId: string;
  docEntry: number;
  itemCode: string;
  lineNumber: number;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export function normalizeLubricantsSalesOrderLine(raw: RawCacheSalesOrderLine): NormalizedLubricantsSalesOrderLine {
  return {
    sourceSystem: 'MOLAS_CACHE_LUBRICANTS',
    sourceRecordId: String(raw.Id),
    docEntry: raw.SapDocEntry,
    itemCode: raw.ItemCode,
    lineNumber: raw.LineNum,
    quantity: Number(raw.Quantity ?? 0),
    unitPrice: Number(raw.Price ?? 0),
    lineTotal: Number(raw.LineTotal ?? 0),
  };
}
