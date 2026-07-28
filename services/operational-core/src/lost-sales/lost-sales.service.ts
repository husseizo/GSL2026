import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LostSaleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LostSalesService {
  constructor(private readonly prisma: PrismaService) {}

  list(filter: { status?: LostSaleStatus; partId?: string; lubricantProductId?: string }) {
    return this.prisma.lostSaleCandidate.findMany({
      where: filter,
      include: { evidence: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const candidate = await this.prisma.lostSaleCandidate.findUnique({
      where: { id },
      include: { evidence: { include: { appEvent: true } }, part: true, lubricantProduct: true },
    });
    if (!candidate) throw new NotFoundException(`Lost sale candidate ${id} not found`);
    return candidate;
  }

  confirm(id: string, resolvedById: string, resolutionReason?: string) {
    return this.transition(id, LostSaleStatus.CONFIRMED, resolvedById, resolutionReason);
  }

  dismiss(id: string, resolvedById: string, resolutionReason?: string) {
    return this.transition(id, LostSaleStatus.DISMISSED, resolvedById, resolutionReason);
  }

  convert(id: string, resolvedById: string, resolutionReason?: string) {
    return this.transition(id, LostSaleStatus.CONVERTED, resolvedById, resolutionReason);
  }

  private async transition(id: string, status: LostSaleStatus, resolvedById: string, resolutionReason?: string) {
    const candidate = await this.prisma.lostSaleCandidate.findUnique({ where: { id } });
    if (!candidate) throw new NotFoundException(`Lost sale candidate ${id} not found`);
    if (candidate.status !== LostSaleStatus.OPEN) {
      throw new BadRequestException(`Candidate ${id} is not OPEN (currently ${candidate.status})`);
    }
    return this.prisma.lostSaleCandidate.update({
      where: { id },
      data: { status, resolvedAt: new Date(), resolvedById, resolutionReason },
    });
  }

  async summary() {
    const [open, confirmed, dismissed, converted] = await Promise.all([
      this.prisma.lostSaleCandidate.count({ where: { status: LostSaleStatus.OPEN } }),
      this.prisma.lostSaleCandidate.count({ where: { status: LostSaleStatus.CONFIRMED } }),
      this.prisma.lostSaleCandidate.count({ where: { status: LostSaleStatus.DISMISSED } }),
      this.prisma.lostSaleCandidate.count({ where: { status: LostSaleStatus.CONVERTED } }),
    ]);
    const estimatedValueOpen = await this.prisma.lostSaleCandidate.aggregate({
      where: { status: LostSaleStatus.OPEN },
      _sum: { estimatedValue: true },
    });
    return { open, confirmed, dismissed, converted, estimatedValueOpen: estimatedValueOpen._sum.estimatedValue ?? 0 };
  }
}
