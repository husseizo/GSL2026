import { Injectable, NotFoundException } from '@nestjs/common';
import { ChecklistCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChecklistTemplateDto } from './dto/create-checklist-template.dto';
import { SubmitChecklistResponseDto } from './dto/submit-checklist-response.dto';

// One generic checklist engine reused by Reception, Job, and Quality
// checklists — see docs/architecture/decision-log-phase3.md.
@Injectable()
export class ChecklistsService {
  constructor(private readonly prisma: PrismaService) {}

  createTemplate(dto: CreateChecklistTemplateDto) {
    return this.prisma.checklistTemplate.create({
      data: {
        name: dto.name,
        category: dto.category,
        items: { create: dto.items.map((item, index) => ({ ...item, sortOrder: index })) },
      },
      include: { items: true },
    });
  }

  listTemplates(category?: ChecklistCategory) {
    return this.prisma.checklistTemplate.findMany({ where: { category, isActive: true }, include: { items: true } });
  }

  async submitResponse(dto: SubmitChecklistResponseDto) {
    const template = await this.prisma.checklistTemplate.findUnique({ where: { id: dto.templateId }, include: { items: true } });
    if (!template) throw new NotFoundException(`Checklist template ${dto.templateId} not found`);

    return this.prisma.checklistResponse.create({
      data: {
        templateId: dto.templateId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        completedById: dto.completedById,
        items: {
          create: dto.items.map((item) => ({
            templateItemId: item.templateItemId,
            status: item.status,
            note: item.note,
            photoUrl: item.photoUrl,
          })),
        },
      },
      include: { items: true },
    });
  }

  listResponsesForEntity(entityType: string, entityId: string) {
    return this.prisma.checklistResponse.findMany({
      where: { entityType, entityId },
      include: { items: { include: { templateItem: true } }, template: true },
      orderBy: { completedAt: 'desc' },
    });
  }
}
