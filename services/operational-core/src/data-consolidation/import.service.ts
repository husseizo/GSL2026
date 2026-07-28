import { Injectable, Logger } from '@nestjs/common';
import { RawRecordProcessingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerMatchingService } from './matching/customer-matching.service';
import { LubricantMatchingService } from './matching/lubricant-matching.service';
import { PartConsolidationMatchingService } from './matching/part-consolidation-matching.service';
import { ManualReviewService } from './manual-review.service';
import { normalizeAutoHubPart, normalizeAutoHubSalesOrder, RawAutoHubSalesOrder, RawOitm } from './normalizers/autohub-normalizers';
import {
  normalizeLubricantsCustomer,
  normalizeLubricantsProduct,
  normalizeLubricantsSalesOrder,
  normalizeLubricantsSalesOrderLine,
  RawCacheCustomer,
  RawCacheProduct,
  RawCacheSalesOrder,
  RawCacheSalesOrderLine,
} from './normalizers/lubricants-normalizers';

export interface ImportSummary {
  stagedCount: number;
  importedCount: number;
  updatedCount: number;
  manualReviewCount: number;
  errorCount: number;
}

// Consumes STAGED RawSourceRecords (never raw source rows directly) and
// upserts them into the real domain tables — the second half of the
// pipeline described in docs/data-consolidation/staging-model.md. Every
// EXACT/HIGH_CONFIDENCE match updates an existing canonical entity;
// NO_MATCH creates a new one; POSSIBLE_MATCH/CONFLICT always stops at a
// ManualReviewItem, never auto-merges. See docs/data-consolidation/
// customer-consolidation.md, parts-consolidation.md, lubricants-consolidation.md.
@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customerMatching: CustomerMatchingService,
    private readonly lubricantMatching: LubricantMatchingService,
    private readonly partMatching: PartConsolidationMatchingService,
    private readonly manualReview: ManualReviewService,
  ) {}

  async importLubricantsCustomers(feedName: string): Promise<ImportSummary> {
    const staged = await this.prisma.rawSourceRecord.findMany({ where: { feedName, processingStatus: RawRecordProcessingStatus.STAGED } });
    const summary: ImportSummary = { stagedCount: staged.length, importedCount: 0, updatedCount: 0, manualReviewCount: 0, errorCount: 0 };

    for (const record of staged) {
      try {
        const normalized = normalizeLubricantsCustomer(record.rawPayload as unknown as RawCacheCustomer);
        const outcome = await this.customerMatching.evaluateMatch(normalized);

        if (outcome.matchLevel === 'EXACT' || outcome.matchLevel === 'HIGH_CONFIDENCE') {
          const customer = await this.prisma.customer.update({
            where: { id: outcome.candidateCustomerId! },
            data: { legalName: normalized.legalName, displayName: normalized.legalName, phone: normalized.phone, email: normalized.email, isActive: normalized.isActive },
          });
          await this.prisma.customerExternalReference.upsert({
            where: { sourceSystem_sourceRecordId: { sourceSystem: normalized.sourceSystem, sourceRecordId: normalized.sourceRecordId } },
            create: { customerId: customer.id, sourceSystem: normalized.sourceSystem, sourceRecordId: normalized.sourceRecordId },
            update: {},
          });
          await this.markProcessed(record.id, 'CUSTOMER', customer.id, outcome.matchLevel);
          summary.updatedCount += 1;
        } else if (outcome.matchLevel === 'NO_MATCH') {
          const customer = await this.prisma.customer.create({
            data: {
              customerCode: `LUB-${normalized.customerCode}`,
              legalName: normalized.legalName,
              displayName: normalized.legalName,
              phone: normalized.phone,
              email: normalized.email,
              isActive: normalized.isActive,
              pricingGroup: normalized.pricingGroup,
              sourceSystem: normalized.sourceSystem,
              sourceRecordId: normalized.sourceRecordId,
              syncedAt: new Date(),
            },
          });
          await this.prisma.customerExternalReference.create({
            data: { customerId: customer.id, sourceSystem: normalized.sourceSystem, sourceRecordId: normalized.sourceRecordId },
          });
          await this.markProcessed(record.id, 'CUSTOMER', customer.id, outcome.matchLevel);
          summary.importedCount += 1;
        } else {
          await this.routeToManualReview(record.id, 'CUSTOMER_MATCH', outcome.matchLevel, outcome.matchSignals, normalized.legalName);
          summary.manualReviewCount += 1;
        }
      } catch (err) {
        this.logger.error(`Failed to import lubricants customer from RawSourceRecord ${record.id}`, err as Error);
        summary.errorCount += 1;
      }
    }

    return summary;
  }

  async importLubricantsProducts(feedName: string): Promise<ImportSummary> {
    const staged = await this.prisma.rawSourceRecord.findMany({ where: { feedName, processingStatus: RawRecordProcessingStatus.STAGED } });
    const summary: ImportSummary = { stagedCount: staged.length, importedCount: 0, updatedCount: 0, manualReviewCount: 0, errorCount: 0 };

    for (const record of staged) {
      try {
        const normalized = normalizeLubricantsProduct(record.rawPayload as unknown as RawCacheProduct);
        const outcome = await this.lubricantMatching.evaluateMatch(normalized);

        if (outcome.matchLevel === 'EXACT' || outcome.matchLevel === 'HIGH_CONFIDENCE') {
          const product = await this.prisma.lubricantProduct.update({
            where: { id: outcome.candidateLubricantId! },
            data: { productName: normalized.productName, isActive: normalized.isActive, defaultSellingPrice: normalized.sellingPrice ?? undefined },
          });
          await this.prisma.lubricantExternalReference.upsert({
            where: { sourceSystem_sourceRecordId: { sourceSystem: normalized.sourceSystem, sourceRecordId: normalized.sourceRecordId } },
            create: { lubricantProductId: product.id, sourceSystem: normalized.sourceSystem, sourceRecordId: normalized.sourceRecordId },
            update: {},
          });
          await this.markProcessed(record.id, 'LUBRICANT', product.id, outcome.matchLevel);
          summary.updatedCount += 1;
        } else if (outcome.matchLevel === 'NO_MATCH') {
          const product = await this.prisma.lubricantProduct.create({
            data: {
              internalCode: normalized.itemCode,
              brand: normalized.brand ?? 'UNKNOWN',
              productName: normalized.productName,
              normalizedName: normalized.productName.toLowerCase().trim(),
              category: 'ENGINE_OIL', // real source doesn't separate category — parsed-and-unverified default; see lubricants-consolidation.md
              isActive: normalized.isActive,
              defaultSellingPrice: normalized.sellingPrice ?? undefined,
              sourceSystem: normalized.sourceSystem,
              sourceRecordId: normalized.sourceRecordId,
              syncedAt: new Date(),
            },
          });
          await this.prisma.lubricantExternalReference.create({
            data: { lubricantProductId: product.id, sourceSystem: normalized.sourceSystem, sourceRecordId: normalized.sourceRecordId },
          });
          await this.markProcessed(record.id, 'LUBRICANT', product.id, outcome.matchLevel);
          summary.importedCount += 1;
        } else {
          await this.routeToManualReview(record.id, 'LUBRICANT_DUPLICATE', outcome.matchLevel, outcome.matchSignals, normalized.productName);
          summary.manualReviewCount += 1;
        }
      } catch (err) {
        this.logger.error(`Failed to import lubricants product from RawSourceRecord ${record.id}`, err as Error);
        summary.errorCount += 1;
      }
    }

    return summary;
  }

  async importLubricantsSalesOrders(feedName: string): Promise<ImportSummary> {
    const staged = await this.prisma.rawSourceRecord.findMany({ where: { feedName, processingStatus: RawRecordProcessingStatus.STAGED } });
    const summary: ImportSummary = { stagedCount: staged.length, importedCount: 0, updatedCount: 0, manualReviewCount: 0, errorCount: 0 };

    for (const record of staged) {
      try {
        const normalized = normalizeLubricantsSalesOrder(record.rawPayload as unknown as RawCacheSalesOrder);
        const customerRef = await this.prisma.customerExternalReference.findUnique({
          where: { sourceSystem_sourceRecordId: { sourceSystem: 'MOLAS_CACHE_LUBRICANTS', sourceRecordId: normalized.customerCode } },
        });

        const existing = await this.prisma.salesDocument.findUnique({
          where: { sourceSystem_sourceRecordId: { sourceSystem: normalized.sourceSystem, sourceRecordId: normalized.sourceRecordId } },
        });

        const data = {
          documentNumber: normalized.sourceRecordId,
          documentType: 'SALES_ORDER' as const,
          status: normalized.docStatus === 'C' ? ('CLOSED' as const) : ('OPEN' as const),
          customerId: customerRef?.customerId,
          unresolvedCustomerRef: customerRef ? undefined : normalized.customerCode,
          documentDate: normalized.docDate,
          currency: 'TZS',
          grandTotal: normalized.docTotal,
          sourceSystem: normalized.sourceSystem,
          sourceRecordId: normalized.sourceRecordId,
          syncedAt: new Date(),
        };

        const doc = existing
          ? await this.prisma.salesDocument.update({ where: { id: existing.id }, data })
          : await this.prisma.salesDocument.create({ data });

        await this.markProcessed(record.id, 'SALES_DOCUMENT', doc.id, 'EXACT');
        if (existing) {
          summary.updatedCount += 1;
        } else {
          summary.importedCount += 1;
        }
      } catch (err) {
        this.logger.error(`Failed to import lubricants sales order from RawSourceRecord ${record.id}`, err as Error);
        summary.errorCount += 1;
      }
    }

    return summary;
  }

  // Added in the Data Validation & Business Baselining phase — the sales
  // order headers imported by importLubricantsSalesOrders() alone can't
  // support item-level demand forecasting; this gives the real per-item
  // quantities the lubricant-demand dataset needs. Same staging ->
  // normalize -> resolve -> upsert shape as every other import* method; no
  // new pipeline mechanics.
  async importLubricantsSalesOrderLines(feedName: string): Promise<ImportSummary> {
    const staged = await this.prisma.rawSourceRecord.findMany({ where: { feedName, processingStatus: RawRecordProcessingStatus.STAGED } });
    const summary: ImportSummary = { stagedCount: staged.length, importedCount: 0, updatedCount: 0, manualReviewCount: 0, errorCount: 0 };

    for (const record of staged) {
      try {
        const normalized = normalizeLubricantsSalesOrderLine(record.rawPayload as unknown as RawCacheSalesOrderLine);

        const salesDocument = await this.prisma.salesDocument.findUnique({
          where: { sourceSystem_sourceRecordId: { sourceSystem: normalized.sourceSystem, sourceRecordId: String(normalized.docEntry) } },
        });
        if (!salesDocument) {
          // The header hasn't been imported (yet, or ever) — preserved as
          // an unresolved line rather than silently dropped or guessed at.
          await this.routeToManualReview(record.id, 'UNRESOLVED_SALES_LINE', 'NO_MATCH', { docEntry: normalized.docEntry, itemCode: normalized.itemCode }, `Sales order line references unknown header ${normalized.docEntry}`);
          summary.manualReviewCount += 1;
          continue;
        }

        const lubricantRef = await this.prisma.lubricantExternalReference.findUnique({
          where: { sourceSystem_sourceRecordId: { sourceSystem: normalized.sourceSystem, sourceRecordId: normalized.itemCode } },
        });

        const existing = await this.prisma.salesDocumentLine.findUnique({
          where: { salesDocumentId_lineNumber: { salesDocumentId: salesDocument.id, lineNumber: normalized.lineNumber } },
        });

        const data = {
          salesDocumentId: salesDocument.id,
          lineNumber: normalized.lineNumber,
          itemType: 'LUBRICANT' as const,
          lubricantProductId: lubricantRef?.lubricantProductId,
          unresolvedItemCode: lubricantRef ? undefined : normalized.itemCode,
          quantity: normalized.quantity,
          unitPrice: normalized.unitPrice,
          lineTotal: normalized.lineTotal,
          sourceSystem: normalized.sourceSystem,
          sourceRecordId: normalized.sourceRecordId,
        };

        const line = existing
          ? await this.prisma.salesDocumentLine.update({ where: { id: existing.id }, data })
          : await this.prisma.salesDocumentLine.create({ data });

        await this.markProcessed(record.id, 'SALES_DOCUMENT_LINE', line.id, 'EXACT');
        if (existing) {
          summary.updatedCount += 1;
        } else {
          summary.importedCount += 1;
        }
      } catch (err) {
        this.logger.error(`Failed to import lubricants sales order line from RawSourceRecord ${record.id}`, err as Error);
        summary.errorCount += 1;
      }
    }

    return summary;
  }

  async importAutoHubParts(feedName: string): Promise<ImportSummary> {
    const staged = await this.prisma.rawSourceRecord.findMany({ where: { feedName, processingStatus: RawRecordProcessingStatus.STAGED } });
    const summary: ImportSummary = { stagedCount: staged.length, importedCount: 0, updatedCount: 0, manualReviewCount: 0, errorCount: 0 };

    for (const record of staged) {
      try {
        const normalized = normalizeAutoHubPart(record.rawPayload as unknown as RawOitm);
        const outcome = await this.partMatching.evaluateMatch(normalized);

        if (outcome.matchLevel === 'EXACT' || outcome.matchLevel === 'HIGH_CONFIDENCE') {
          const part = await this.prisma.part.update({
            where: { id: outcome.candidatePartId! },
            data: { productName: normalized.productName, standardizedProductName: normalized.productName.toLowerCase().trim(), category: normalized.category ?? undefined },
          });
          await this.prisma.partExternalReference.upsert({
            where: { sourceSystem_sourceRecordId: { sourceSystem: normalized.sourceSystem, sourceRecordId: normalized.sourceRecordId } },
            create: { partId: part.id, sourceSystem: normalized.sourceSystem, sourceRecordId: normalized.sourceRecordId },
            update: {},
          });
          await this.markProcessed(record.id, 'PART', part.id, outcome.matchLevel);
          summary.updatedCount += 1;
        } else if (outcome.matchLevel === 'NO_MATCH') {
          const part = await this.prisma.part.create({
            data: {
              internalItemCode: normalized.internalItemCode,
              oemNumber: normalized.resolvedOemNumber,
              productName: normalized.productName,
              standardizedProductName: normalized.productName.toLowerCase().trim(),
              category: normalized.category,
              brand: normalized.brand,
              sourceSystem: normalized.sourceSystem,
              sourceRecordId: normalized.sourceRecordId,
              syncedAt: new Date(),
            },
          });
          await this.prisma.partExternalReference.create({
            data: { partId: part.id, sourceSystem: normalized.sourceSystem, sourceRecordId: normalized.sourceRecordId },
          });
          await this.markProcessed(record.id, 'PART', part.id, outcome.matchLevel);
          summary.importedCount += 1;
        } else {
          await this.routeToManualReview(record.id, 'PARTS_DUPLICATE', outcome.matchLevel, outcome.matchSignals, normalized.productName);
          summary.manualReviewCount += 1;
        }
      } catch (err) {
        this.logger.error(`Failed to import AutoHub part from RawSourceRecord ${record.id}`, err as Error);
        summary.errorCount += 1;
      }
    }

    return summary;
  }

  async importAutoHubSalesOrders(feedName: string): Promise<ImportSummary> {
    const staged = await this.prisma.rawSourceRecord.findMany({ where: { feedName, processingStatus: RawRecordProcessingStatus.STAGED } });
    const summary: ImportSummary = { stagedCount: staged.length, importedCount: 0, updatedCount: 0, manualReviewCount: 0, errorCount: 0 };

    for (const record of staged) {
      try {
        const normalized = normalizeAutoHubSalesOrder(record.rawPayload as unknown as RawAutoHubSalesOrder);

        // AutoHub has no dedicated customer-master table (see
        // docs/data-sources/parts-catalog-autohub-profile.md) — CardCode is
        // preserved as an unresolved reference rather than fabricating a
        // customer master record from a document header alone.
        const existing = await this.prisma.salesDocument.findUnique({
          where: { sourceSystem_sourceRecordId: { sourceSystem: normalized.sourceSystem, sourceRecordId: normalized.sourceRecordId } },
        });

        const data = {
          documentNumber: normalized.sourceRecordId,
          documentType: 'SALES_ORDER' as const,
          status: normalized.docStatus === 'C' ? ('CLOSED' as const) : ('OPEN' as const),
          unresolvedCustomerRef: normalized.cardCode,
          documentDate: normalized.docDate,
          currency: 'TZS',
          grandTotal: normalized.docTotal,
          sourceSystem: normalized.sourceSystem,
          sourceRecordId: normalized.sourceRecordId,
          syncedAt: new Date(),
        };

        const doc = existing
          ? await this.prisma.salesDocument.update({ where: { id: existing.id }, data })
          : await this.prisma.salesDocument.create({ data });

        await this.markProcessed(record.id, 'SALES_DOCUMENT', doc.id, 'EXACT');
        if (existing) {
          summary.updatedCount += 1;
        } else {
          summary.importedCount += 1;
        }
      } catch (err) {
        this.logger.error(`Failed to import AutoHub sales order from RawSourceRecord ${record.id}`, err as Error);
        summary.errorCount += 1;
      }
    }

    return summary;
  }

  private markProcessed(rawSourceRecordId: string, entityType: string, entityId: string, matchLevel: 'EXACT' | 'HIGH_CONFIDENCE' | 'POSSIBLE_MATCH' | 'NO_MATCH' | 'CONFLICT') {
    return this.prisma.rawSourceRecord.update({
      where: { id: rawSourceRecordId },
      data: {
        processingStatus: RawRecordProcessingStatus.IMPORTED,
        validationStatus: 'VALID',
        normalizationStatus: 'NORMALIZED',
        matchingStatus: matchLevel,
        finalEntityType: entityType,
        finalEntityId: entityId,
      },
    });
  }

  private async routeToManualReview(rawSourceRecordId: string, queueType: string, matchLevel: string, matchSignals: Record<string, unknown>, label: string) {
    const candidate = await this.prisma.entityMatchCandidate.create({
      data: {
        entityType: queueType.split('_')[0],
        rawSourceRecordId,
        matchLevel: matchLevel as never,
        matchSignals: matchSignals as object,
      },
    });
    await this.manualReview.enqueue({
      queueType,
      relatedRawSourceRecordId: rawSourceRecordId,
      relatedEntityMatchCandidateId: candidate.id,
      proposedAction: matchLevel === 'CONFLICT' ? 'Resolve conflicting signals before linking or creating a new record' : 'Review possible match before linking or creating a new record',
      evidence: { label, matchSignals },
      confidence: matchLevel === 'POSSIBLE_MATCH' ? 0.4 : 0.5,
    });
    await this.prisma.rawSourceRecord.update({
      where: { id: rawSourceRecordId },
      data: { processingStatus: RawRecordProcessingStatus.MANUAL_REVIEW, matchingStatus: matchLevel as never },
    });
  }
}
