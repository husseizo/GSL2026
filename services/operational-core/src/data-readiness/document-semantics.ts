// Formal, documented business-metric semantics — which real document type
// drives which metric, so a sales order followed by a delivery and an
// invoice for the same real transaction is never counted three times. Pure
// module: no DB, no I/O, so the rule itself is directly unit-testable. See
// docs/data-readiness/commercial-document-semantics.md.
export type DocumentType = 'QUOTATION' | 'SALES_ORDER' | 'DELIVERY' | 'INVOICE' | 'CREDIT_NOTE' | 'RETURN' | 'PURCHASE_ORDER' | 'GOODS_RECEIPT';

export type RevenueMetric = 'REVENUE' | 'INVENTORY_CONSUMPTION' | 'SALES_VELOCITY' | 'CUSTOMER_DEMAND' | 'MARGIN' | 'PAYMENT_STATUS' | 'LOST_DEMAND';

// Real document types confirmed to exist in this build's actually-imported
// sources (see docs/data-sources/molas-cache-db-profile.md and
// parts-catalog-autohub-profile.md): only SALES_ORDER document headers
// (and, for lubricants, their lines) have been imported. INVOICE/DELIVERY/
// PAYMENT/CREDIT_NOTE/RETURN/PURCHASE_ORDER/GOODS_RECEIPT tables were
// profiled but not imported this phase (see docs/data-consolidation/
// sales-reconciliation.md and purchase-reconciliation.md) — the mapping
// below is the documented semantic model, ready for when those document
// types are imported, not a claim that they're already flowing.
export const METRIC_DRIVER: Record<RevenueMetric, DocumentType> = {
  REVENUE: 'INVOICE', // an order isn't revenue until invoiced — not yet imported
  INVENTORY_CONSUMPTION: 'DELIVERY', // stock leaves on delivery, not on order — not yet imported
  SALES_VELOCITY: 'SALES_ORDER', // demand signal — real data imported this phase
  CUSTOMER_DEMAND: 'SALES_ORDER', // real data imported this phase
  MARGIN: 'INVOICE', // needs cost-at-sale + invoiced price — not yet imported
  PAYMENT_STATUS: 'INVOICE', // paid-to-date lives on the invoice — not yet imported
  LOST_DEMAND: 'QUOTATION', // a quotation that never converted — no quotation source imported (see odoo-garage-profile.md)
};

// Given a set of real document records for the same underlying commercial
// transaction (identified by a shared business key, e.g. the same
// SapDocEntry chain), returns which ones should count toward a given
// metric — the double-count-prevention rule itself.
export interface DocumentChainMember {
  documentType: DocumentType;
  documentId: string;
  isCancelled?: boolean;
}

export function selectDocumentsForMetric(chain: DocumentChainMember[], metric: RevenueMetric): DocumentChainMember[] {
  const driverType = METRIC_DRIVER[metric];
  const matching = chain.filter((d) => d.documentType === driverType && !d.isCancelled);
  if (matching.length > 0) return matching;

  // Fallback: if the driving document type isn't present in this chain
  // (e.g. INVOICE not yet imported), CUSTOMER_DEMAND/SALES_VELOCITY may
  // still fall back to SALES_ORDER as the next-best real signal — but
  // REVENUE/MARGIN/PAYMENT_STATUS must never silently substitute an order
  // for an invoice (an order is not yet revenue), so they return empty
  // rather than double-counting or fabricating a metric the data can't
  // support yet.
  if ((metric === 'CUSTOMER_DEMAND' || metric === 'SALES_VELOCITY') && driverType !== 'SALES_ORDER') {
    return chain.filter((d) => d.documentType === 'SALES_ORDER' && !d.isCancelled);
  }
  return [];
}

// Real double-count guard: given every real document imported for ONE
// underlying transaction, a metric must select documents from exactly one
// document type (per selectDocumentsForMetric above) — never sum across
// SALES_ORDER and INVOICE and DELIVERY for the same transaction as if they
// were three independent sales.
export function assertNoDoubleCounting(chain: DocumentChainMember[], metric: RevenueMetric): void {
  const selected = selectDocumentsForMetric(chain, metric);
  const distinctTypes = new Set(selected.map((d) => d.documentType));
  if (distinctTypes.size > 1) {
    throw new Error(`Double-counting risk: metric ${metric} selected documents from ${distinctTypes.size} different document types (${[...distinctTypes].join(', ')}) for one transaction chain`);
  }
}
