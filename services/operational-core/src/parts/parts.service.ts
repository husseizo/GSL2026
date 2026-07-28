import { Injectable } from '@nestjs/common';
import { Part } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartDto } from './dto/create-part.dto';
import { standardizeProductName } from './normalize';

@Injectable()
export class PartsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreatePartDto): Promise<Part> {
    return this.prisma.part.create({
      data: {
        internalItemCode: dto.internalItemCode,
        oemNumber: dto.oemNumber,
        brand: dto.brand,
        productName: dto.productName,
        standardizedProductName: standardizeProductName(dto.productName),
        category: dto.category,
        subcategory: dto.subcategory,
        alternateNumbers: dto.alternateNumbers
          ? { create: dto.alternateNumbers }
          : undefined,
      },
      include: { alternateNumbers: true },
    });
  }

  findById(id: string) {
    return this.prisma.part.findUnique({
      where: { id },
      include: { alternateNumbers: true, compatibility: true },
    });
  }

  list(filter: { category?: string; brand?: string }) {
    return this.prisma.part.findMany({
      where: {
        category: filter.category,
        brand: filter.brand,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
