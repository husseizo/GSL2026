import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInspectionTemplateDto } from './dto/create-inspection-template.dto';
import { RecordInspectionResultDto } from './dto/record-inspection-result.dto';

@Injectable()
export class InspectionsService {
  constructor(private readonly prisma: PrismaService) {}

  createTemplate(dto: CreateInspectionTemplateDto) {
    return this.prisma.inspectionTemplate.create({
      data: {
        name: dto.name,
        sections: {
          create: dto.sections.map((section, sectionIndex) => ({
            name: section.name,
            sortOrder: sectionIndex,
            items: { create: section.items.map((item, itemIndex) => ({ label: item.label, sortOrder: itemIndex })) },
          })),
        },
      },
      include: { sections: { include: { items: true } } },
    });
  }

  listTemplates() {
    return this.prisma.inspectionTemplate.findMany({
      where: { isActive: true },
      include: { sections: { include: { items: true } } },
    });
  }

  // Upsert rather than reject a re-submission for the same job+item — a
  // technician correcting an inspection result is normal, not a duplicate-
  // data problem, and @@unique([jobId, itemId]) already prevents two
  // concurrent rows for the same finding.
  async recordResult(jobId: string, dto: RecordInspectionResultDto) {
    const item = await this.prisma.inspectionItem.findUnique({ where: { id: dto.itemId } });
    if (!item) throw new NotFoundException(`Inspection item ${dto.itemId} not found`);

    return this.prisma.inspectionResult.upsert({
      where: { jobId_itemId: { jobId, itemId: dto.itemId } },
      create: { jobId, ...dto },
      update: { ...dto, inspectedAt: new Date() },
    });
  }

  addPhoto(resultId: string, url: string) {
    return this.prisma.inspectionPhoto.create({ data: { resultId, url } });
  }

  listResultsForJob(jobId: string) {
    return this.prisma.inspectionResult.findMany({
      where: { jobId },
      include: { item: { include: { section: true } }, photos: true, requiredPart: true, requiredLubricant: true },
    });
  }

  listFailedForJob(jobId: string) {
    return this.prisma.inspectionResult.findMany({
      where: { jobId, finding: 'FAIL' },
      include: { item: true },
    });
  }
}
