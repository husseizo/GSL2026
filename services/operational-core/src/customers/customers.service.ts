import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerType } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { PaginationQueryDto, paginate, toSkipTake } from '../common/pagination/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { LinkVehicleDto } from './dto/link-vehicle.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: dto });
  }

  async search(query: PaginationQueryDto & { customerType?: CustomerType }) {
    const where = {
      customerType: query.customerType,
      OR: query.search
        ? [
            { legalName: { contains: query.search, mode: 'insensitive' as const } },
            { displayName: { contains: query.search, mode: 'insensitive' as const } },
            { customerCode: { contains: query.search, mode: 'insensitive' as const } },
            { phone: { contains: query.search, mode: 'insensitive' as const } },
          ]
        : undefined,
    };

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        ...toSkipTake(query),
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir ?? 'desc' } : { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  async getProfile(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { contacts: true, addresses: true, vehicleLinks: { include: { vehicle: true } } },
    });
    if (!customer) throw new NotFoundException(`Customer ${id} not found`);

    const [salesCount, salesTotal] = await Promise.all([
      this.prisma.salesDocument.count({ where: { customerId: id } }),
      this.prisma.salesDocument.aggregate({ where: { customerId: id }, _sum: { grandTotal: true } }),
    ]);

    return { ...customer, salesSummary: { documentCount: salesCount, lifetimeValue: salesTotal._sum.grandTotal ?? 0 } };
  }

  async update(id: string, dto: UpdateCustomerDto, actor?: { userId?: string; role?: string }) {
    const before = await this.prisma.customer.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`Customer ${id} not found`);

    const after = await this.prisma.customer.update({ where: { id }, data: dto });

    await this.audit.log({
      action: 'CUSTOMER_UPDATED',
      actorId: actor?.userId,
      actorRole: actor?.role,
      entityType: 'Customer',
      entityId: id,
      beforeState: before,
      afterState: after,
    });

    return after;
  }

  async linkVehicle(customerId: string, dto: LinkVehicleDto) {
    const [customer, vehicle] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: customerId } }),
      this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } }),
    ]);
    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);
    if (!vehicle) throw new NotFoundException(`Vehicle ${dto.vehicleId} not found`);

    return this.prisma.customerVehicleLink.upsert({
      where: { customerId_vehicleId: { customerId, vehicleId: dto.vehicleId } },
      create: { customerId, vehicleId: dto.vehicleId, relationship: dto.relationship ?? 'OWNER' },
      update: { relationship: dto.relationship ?? 'OWNER', isActive: true },
    });
  }

  async listSalesHistory(customerId: string, query: PaginationQueryDto) {
    const where = { customerId };
    const [data, total] = await Promise.all([
      this.prisma.salesDocument.findMany({
        where,
        ...toSkipTake(query),
        include: { lines: true },
        orderBy: { documentDate: 'desc' },
      }),
      this.prisma.salesDocument.count({ where }),
    ]);
    return paginate(data, total, query);
  }
}
