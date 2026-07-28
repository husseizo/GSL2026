import { Injectable, NotFoundException } from '@nestjs/common';
import { TechnicianSpecialization } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssignSkillDto } from './dto/assign-skill.dto';
import { CreateTechnicianDto } from './dto/create-technician.dto';

@Injectable()
export class TechniciansService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTechnicianDto) {
    return this.prisma.technician.create({ data: dto });
  }

  list(filter: { branchId?: string; specialization?: TechnicianSpecialization }) {
    return this.prisma.technician.findMany({
      where: {
        branchId: filter.branchId,
        skills: filter.specialization ? { some: { specialization: filter.specialization } } : undefined,
      },
      include: { skills: true, certifications: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const technician = await this.prisma.technician.findUnique({
      where: { id },
      include: { skills: true, certifications: true, availability: true, schedules: true },
    });
    if (!technician) throw new NotFoundException(`Technician ${id} not found`);
    return technician;
  }

  assignSkill(technicianId: string, dto: AssignSkillDto) {
    return this.prisma.technicianSkill.upsert({
      where: { technicianId_specialization: { technicianId, specialization: dto.specialization } },
      create: { technicianId, specialization: dto.specialization, proficiency: dto.proficiency },
      update: { proficiency: dto.proficiency },
    });
  }

  addCertification(technicianId: string, data: { name: string; issuedBy?: string; issuedAt?: Date; expiresAt?: Date }) {
    return this.prisma.technicianCertification.create({ data: { technicianId, ...data } });
  }

  setAvailability(technicianId: string, date: Date, isAvailable: boolean, reason?: string) {
    return this.prisma.technicianAvailability.upsert({
      where: { technicianId_date: { technicianId, date } },
      create: { technicianId, date, isAvailable, reason },
      update: { isAvailable, reason },
    });
  }

  addScheduleSlot(technicianId: string, data: { dayOfWeek: number; startTime: string; endTime: string }) {
    return this.prisma.technicianSchedule.create({ data: { technicianId, ...data } });
  }

  // Used by JobAssignmentService to pick a technician whose skills match the
  // job's required specialization — simple deterministic ranking by
  // proficiency, no AI.
  async findBestMatch(branchId: string, specialization: TechnicianSpecialization) {
    const candidates = await this.prisma.technician.findMany({
      where: { branchId, isActive: true, skills: { some: { specialization } } },
      include: { skills: { where: { specialization } } },
    });
    return candidates.sort((a, b) => (b.skills[0]?.proficiency ?? 0) - (a.skills[0]?.proficiency ?? 0))[0] ?? null;
  }
}
