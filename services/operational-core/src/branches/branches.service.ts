import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateBranchDto) {
    return this.prisma.branch.create({ data: dto });
  }

  list(filter: { organizationId?: string }) {
    return this.prisma.branch.findMany({
      where: { organizationId: filter.organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id }, include: { warehouses: true } });
    if (!branch) throw new NotFoundException(`Branch ${id} not found`);
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto) {
    await this.findById(id);
    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  async setActive(id: string, isActive: boolean) {
    await this.findById(id);
    return this.prisma.branch.update({ where: { id }, data: { isActive } });
  }
}
