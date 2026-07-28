import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationQueryDto, paginate, toSkipTake } from '../common/pagination/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryDto & { supplierId?: string }) {
    const where = {
      supplierId: query.supplierId,
      branchId: query.branchId,
      documentDate:
        query.dateFrom || query.dateTo
          ? { gte: query.dateFrom ? new Date(query.dateFrom) : undefined, lte: query.dateTo ? new Date(query.dateTo) : undefined }
          : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.purchaseDocument.findMany({ where, ...toSkipTake(query), include: { lines: true }, orderBy: { documentDate: 'desc' } }),
      this.prisma.purchaseDocument.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async findById(id: string) {
    const doc = await this.prisma.purchaseDocument.findUnique({
      where: { id },
      include: { lines: true, goodsReceipts: { include: { lines: true } }, supplier: true },
    });
    if (!doc) throw new NotFoundException(`Purchase document ${id} not found`);
    return doc;
  }

  searchByItem(partId?: string, lubricantProductId?: string) {
    return this.prisma.purchaseDocumentLine.findMany({
      where: { partId, lubricantProductId },
      include: { purchaseDocument: { include: { supplier: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
