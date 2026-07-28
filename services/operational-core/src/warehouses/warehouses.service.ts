import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({ data: dto });
  }

  list(filter: { branchId?: string }) {
    return this.prisma.warehouse.findMany({
      where: { branchId: filter.branchId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) throw new NotFoundException(`Warehouse ${id} not found`);
    return warehouse;
  }

  async update(id: string, dto: UpdateWarehouseDto) {
    await this.findById(id);
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  async setActive(id: string, isActive: boolean) {
    await this.findById(id);
    return this.prisma.warehouse.update({ where: { id }, data: { isActive } });
  }
}
