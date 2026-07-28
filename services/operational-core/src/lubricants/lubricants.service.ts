import { Injectable, NotFoundException } from '@nestjs/common';
import { LubricantCategory, MatchCandidateStatus } from '@prisma/client';
import { PaginationQueryDto, paginate, toSkipTake } from '../common/pagination/pagination.dto';
import { standardizeProductName } from '../parts/normalize';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLubricantDto } from './dto/create-lubricant.dto';
import { ProposeAlternativeDto } from './dto/propose-alternative.dto';

@Injectable()
export class LubricantsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateLubricantDto) {
    return this.prisma.lubricantProduct.create({
      data: { ...dto, normalizedName: standardizeProductName(dto.productName) },
    });
  }

  async update(id: string, dto: Partial<CreateLubricantDto>) {
    await this.findById(id);
    return this.prisma.lubricantProduct.update({
      where: { id },
      data: {
        ...dto,
        normalizedName: dto.productName ? standardizeProductName(dto.productName) : undefined,
      },
    });
  }

  async search(query: PaginationQueryDto & { category?: LubricantCategory }) {
    const where = {
      category: query.category,
      OR: query.search
        ? [
            { brand: { contains: query.search, mode: 'insensitive' as const } },
            { productName: { contains: query.search, mode: 'insensitive' as const } },
            { internalCode: { contains: query.search, mode: 'insensitive' as const } },
          ]
        : undefined,
    };

    const [data, total] = await Promise.all([
      this.prisma.lubricantProduct.findMany({ where, ...toSkipTake(query), orderBy: { createdAt: 'desc' } }),
      this.prisma.lubricantProduct.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  async findById(id: string) {
    const product = await this.prisma.lubricantProduct.findUnique({
      where: { id },
      include: { approvals: true, compatibility: true },
    });
    if (!product) throw new NotFoundException(`Lubricant ${id} not found`);
    return product;
  }

  listApprovals(lubricantProductId: string) {
    return this.prisma.lubricantApproval.findMany({ where: { lubricantProductId } });
  }

  listCompatibility(lubricantProductId: string) {
    return this.prisma.lubricantCompatibility.findMany({ where: { lubricantProductId } });
  }

  // Proposed only — never auto-approved. Same "propose, human reviews" shape
  // as Phase 1's PartMatchCandidate. See docs/architecture/phase-2-commercial-foundation.md §2.3.
  async proposeAlternative(lubricantId: string, dto: ProposeAlternativeDto) {
    const [source, alternative] = await Promise.all([
      this.findById(lubricantId),
      this.findById(dto.alternativeId),
    ]);
    if (!source || !alternative) {
      throw new NotFoundException('Lubricant or alternative not found');
    }

    return this.prisma.lubricantAlternative.upsert({
      where: { lubricantId_alternativeId: { lubricantId, alternativeId: dto.alternativeId } },
      create: {
        lubricantId,
        alternativeId: dto.alternativeId,
        alternativeType: dto.alternativeType,
        rationale: dto.rationale,
      },
      update: { alternativeType: dto.alternativeType, rationale: dto.rationale },
    });
  }

  listAlternatives(lubricantId: string, status?: MatchCandidateStatus) {
    return this.prisma.lubricantAlternative.findMany({
      where: { lubricantId, status },
      include: { alternative: true },
    });
  }

  reviewAlternative(id: string, status: 'APPROVED' | 'REJECTED') {
    return this.prisma.lubricantAlternative.update({ where: { id }, data: { status } });
  }
}
