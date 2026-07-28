import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationQueryDto, paginate, toSkipTake } from '../common/pagination/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryDto & { customerId?: string }) {
    const where = {
      customerId: query.customerId,
      branchId: query.branchId,
      documentDate:
        query.dateFrom || query.dateTo
          ? { gte: query.dateFrom ? new Date(query.dateFrom) : undefined, lte: query.dateTo ? new Date(query.dateTo) : undefined }
          : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.salesDocument.findMany({ where, ...toSkipTake(query), include: { lines: true }, orderBy: { documentDate: 'desc' } }),
      this.prisma.salesDocument.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async findById(id: string) {
    const doc = await this.prisma.salesDocument.findUnique({
      where: { id },
      include: { lines: true, customer: true },
    });
    if (!doc) throw new NotFoundException(`Sales document ${id} not found`);
    return doc;
  }

  async findByDocumentNumber(documentNumber: string) {
    const docs = await this.prisma.salesDocument.findMany({ where: { documentNumber }, include: { lines: true } });
    return docs;
  }

  searchByItem(partId?: string, lubricantProductId?: string) {
    return this.prisma.salesDocumentLine.findMany({
      where: { partId, lubricantProductId },
      include: { salesDocument: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  searchByVehicle(vehicleId: string) {
    return this.prisma.salesDocumentLine.findMany({
      where: { vehicleId },
      include: { salesDocument: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
