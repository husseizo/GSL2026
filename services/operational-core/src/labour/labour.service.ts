import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLabourOperationDto } from './dto/create-labour-operation.dto';

@Injectable()
export class LabourService {
  constructor(private readonly prisma: PrismaService) {}

  createCategory(name: string) {
    return this.prisma.labourCategory.create({ data: { name } });
  }

  createOperation(dto: CreateLabourOperationDto) {
    return this.prisma.labourOperation.create({ data: dto });
  }

  listOperations() {
    return this.prisma.labourOperation.findMany({ where: { isActive: true }, include: { category: true } });
  }

  async findOperationByCode(code: string) {
    const op = await this.prisma.labourOperation.findUnique({ where: { code } });
    if (!op) throw new NotFoundException(`Labour operation ${code} not found`);
    return op;
  }

  setRate(data: { labourOperationId?: string; branchId?: string; hourlyRate: number }) {
    return this.prisma.labourRate.create({ data });
  }

  async getEffectiveRate(labourOperationId: string | undefined, branchId: string | undefined, at: Date = new Date()) {
    const rate = await this.prisma.labourRate.findFirst({
      where: {
        labourOperationId: labourOperationId ?? undefined,
        branchId: branchId ?? undefined,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    return rate ? Number(rate.hourlyRate) : null;
  }
}
