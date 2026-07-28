import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationQueryDto, paginate, toSkipTake } from '../common/pagination/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: dto });
  }

  async search(query: PaginationQueryDto) {
    const where = query.search
      ? {
          OR: [
            { legalName: { contains: query.search, mode: 'insensitive' as const } },
            { displayName: { contains: query.search, mode: 'insensitive' as const } },
            { supplierCode: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({ where, ...toSkipTake(query), orderBy: { createdAt: 'desc' } }),
      this.prisma.supplier.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  async findById(id: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id }, include: { metrics: true } });
    if (!supplier) throw new NotFoundException(`Supplier ${id} not found`);
    return supplier;
  }
}
