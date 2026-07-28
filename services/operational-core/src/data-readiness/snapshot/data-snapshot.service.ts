import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { stableChecksum } from '../../integration/checksum';

// Immutable, versioned captures of exactly what real data a baseline run
// or AI dataset build was produced from — never train/report directly
// from continuously-changing production tables. See
// docs/data-readiness/data-snapshots.md.
@Injectable()
export class DataSnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async createSnapshot(snapshotName: string, createdById?: string) {
    const existing = await this.prisma.dataSnapshot.findUnique({ where: { snapshotName } });
    if (existing) throw new ConflictException(`Snapshot "${snapshotName}" already exists — snapshots are immutable; use a new name`);

    const dataCutoffAt = new Date();
    const sourceCursors = await this.prisma.integrationSource.findMany({ select: { name: true, lastCommittedCursor: true } });

    const rowCounts = {
      customers: await this.prisma.customer.count({ where: { sourceSystem: 'MOLAS_CACHE_LUBRICANTS' } }),
      lubricantProducts: await this.prisma.lubricantProduct.count({ where: { sourceSystem: 'MOLAS_CACHE_LUBRICANTS' } }),
      parts: await this.prisma.part.count({ where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB' } }),
      salesDocuments: await this.prisma.salesDocument.count(),
      salesDocumentLines: await this.prisma.salesDocumentLine.count(),
      manualReviewItemsPending: await this.prisma.manualReviewItem.count({ where: { status: 'PENDING' } }),
    };

    const financialAgg = await this.prisma.salesDocument.aggregate({ where: { sourceSystem: 'MOLAS_CACHE_LUBRICANTS' }, _sum: { grandTotal: true } });
    const financialTotals = { lubricantsSalesOrderGrandTotal: financialAgg._sum.grandTotal?.toString() ?? '0' };

    const datasetChecksums = {
      customers: stableChecksum(await this.prisma.customer.findMany({ where: { sourceSystem: 'MOLAS_CACHE_LUBRICANTS' }, select: { id: true, customerCode: true, updatedAt: true }, orderBy: { id: 'asc' } })),
      salesDocuments: stableChecksum(await this.prisma.salesDocument.findMany({ where: { sourceSystem: 'MOLAS_CACHE_LUBRICANTS' }, select: { id: true, sourceRecordId: true, grandTotal: true }, orderBy: { id: 'asc' } })),
    };

    return this.prisma.dataSnapshot.create({
      data: {
        snapshotName,
        sourceSystems: ['MOLAS_CACHE_LUBRICANTS', 'PARTS_CATALOG_AUTOHUB'],
        dataCutoffAt,
        cursorPositions: sourceCursors as unknown as object,
        rowCounts,
        financialTotals,
        datasetChecksums,
        createdById,
      },
    });
  }

  async validateSnapshot(snapshotName: string): Promise<{ valid: boolean; mismatches: string[] }> {
    const snapshot = await this.prisma.dataSnapshot.findUniqueOrThrow({ where: { snapshotName } });
    const currentCustomerChecksum = stableChecksum(await this.prisma.customer.findMany({ where: { sourceSystem: 'MOLAS_CACHE_LUBRICANTS' }, select: { id: true, customerCode: true, updatedAt: true }, orderBy: { id: 'asc' } }));

    const mismatches: string[] = [];
    const recorded = (snapshot.datasetChecksums as Record<string, string>).customers;
    if (recorded !== currentCustomerChecksum) mismatches.push('customers checksum has drifted since this snapshot was taken (expected — production data keeps changing; use the snapshot, not live tables, for reproducible baselines/AI builds)');

    return { valid: mismatches.length === 0, mismatches };
  }

  async approve(snapshotName: string, approvedById: string) {
    return this.prisma.dataSnapshot.update({ where: { snapshotName }, data: { approvedById, approvedAt: new Date() } });
  }
}
