import { Injectable } from '@nestjs/common';
import { PurchaseDocumentStatus, PurchaseDocumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeSupplierMetrics, PurchaseLineSample } from './supplier-metric-math';

const CLOSED_STATUSES: PurchaseDocumentStatus[] = [
  PurchaseDocumentStatus.RECEIVED,
  PurchaseDocumentStatus.CLOSED,
  PurchaseDocumentStatus.CANCELLED,
];

@Injectable()
export class SupplierAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async recalculate(now: Date = new Date()): Promise<{ suppliersProcessed: number }> {
    const suppliers = await this.prisma.supplier.findMany();

    for (const supplier of suppliers) {
      const documents = await this.prisma.purchaseDocument.findMany({
        where: { supplierId: supplier.id, isCancelled: false },
        include: { lines: true },
      });

      const samples: PurchaseLineSample[] = documents.flatMap((doc) =>
        doc.lines.map((line) => ({
          orderedQuantity: Number(line.orderedQuantity),
          receivedQuantity: Number(line.receivedQuantity),
          unitCost: Number(line.unitCost),
          documentDate: doc.documentDate,
          expectedDeliveryDate: line.expectedDeliveryDate ?? doc.expectedDeliveryDate,
          actualReceiptDate: line.actualReceiptDate,
        })),
      );

      const metrics = computeSupplierMetrics(samples);
      const activePurchaseOrders = documents.filter((d) => !CLOSED_STATUSES.includes(d.status)).length;
      const latePurchaseOrders = documents.filter(
        (d) => !CLOSED_STATUSES.includes(d.status) && d.expectedDeliveryDate !== null && d.expectedDeliveryDate < now,
      ).length;
      const returnCount = documents.filter((d) => d.documentType === PurchaseDocumentType.PURCHASE_RETURN).length;

      await this.prisma.supplierMetric.upsert({
        where: { supplierId: supplier.id },
        create: {
          supplierId: supplier.id,
          avgLeadTimeDays: metrics.avgLeadTimeDays,
          leadTimeVariance: metrics.leadTimeVariance,
          onTimeDeliveryPct: metrics.onTimeDeliveryPct,
          fillRatePct: metrics.fillRatePct,
          priceVariancePct: metrics.priceVariancePct,
          quantityAccuracyPct: metrics.quantityAccuracyPct,
          receiptCompletionPct: metrics.receiptCompletionPct,
          returnCount,
          activePurchaseOrders,
          latePurchaseOrders,
          dataSufficiency: metrics.dataSufficiency,
          calculatedAt: now,
        },
        update: {
          avgLeadTimeDays: metrics.avgLeadTimeDays,
          leadTimeVariance: metrics.leadTimeVariance,
          onTimeDeliveryPct: metrics.onTimeDeliveryPct,
          fillRatePct: metrics.fillRatePct,
          priceVariancePct: metrics.priceVariancePct,
          quantityAccuracyPct: metrics.quantityAccuracyPct,
          receiptCompletionPct: metrics.receiptCompletionPct,
          returnCount,
          activePurchaseOrders,
          latePurchaseOrders,
          dataSufficiency: metrics.dataSufficiency,
          calculatedAt: now,
        },
      });
    }

    return { suppliersProcessed: suppliers.length };
  }

  listMetrics() {
    return this.prisma.supplierMetric.findMany({ include: { supplier: true } });
  }

  getScorecard(supplierId: string) {
    return this.prisma.supplierMetric.findUnique({ where: { supplierId }, include: { supplier: true } });
  }

  async listLatePurchaseOrders(now: Date = new Date()) {
    return this.prisma.purchaseDocument.findMany({
      where: {
        status: { notIn: CLOSED_STATUSES },
        expectedDeliveryDate: { lt: now },
      },
      include: { supplier: true },
    });
  }
}
