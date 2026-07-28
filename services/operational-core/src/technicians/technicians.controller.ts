import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TechnicianSpecialization } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { AssignSkillDto } from './dto/assign-skill.dto';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { TechniciansService } from './technicians.service';

@Controller('technicians')
@UseGuards(PermissionsGuard)
export class TechniciansController {
  constructor(private readonly technicians: TechniciansService) {}

  @Post()
  @RequirePermissions('technician.manage')
  create(@Body() dto: CreateTechnicianDto) {
    return this.technicians.create(dto);
  }

  @Get()
  @RequirePermissions('technician.read')
  list(@Query('branchId') branchId?: string, @Query('specialization') specialization?: TechnicianSpecialization) {
    return this.technicians.list({ branchId, specialization });
  }

  @Get(':id')
  @RequirePermissions('technician.read')
  findById(@Param('id') id: string) {
    return this.technicians.findById(id);
  }

  @Post(':id/skills')
  @RequirePermissions('technician.manage')
  assignSkill(@Param('id') id: string, @Body() dto: AssignSkillDto) {
    return this.technicians.assignSkill(id, dto);
  }

  @Post(':id/certifications')
  @RequirePermissions('technician.manage')
  addCertification(@Param('id') id: string, @Body() body: { name: string; issuedBy?: string; issuedAt?: string; expiresAt?: string }) {
    return this.technicians.addCertification(id, {
      name: body.name,
      issuedBy: body.issuedBy,
      issuedAt: body.issuedAt ? new Date(body.issuedAt) : undefined,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
  }

  @Patch(':id/availability')
  @RequirePermissions('technician.manage')
  setAvailability(@Param('id') id: string, @Body() body: { date: string; isAvailable: boolean; reason?: string }) {
    return this.technicians.setAvailability(id, new Date(body.date), body.isAvailable, body.reason);
  }

  @Post(':id/schedule')
  @RequirePermissions('technician.manage')
  addScheduleSlot(@Param('id') id: string, @Body() body: { dayOfWeek: number; startTime: string; endTime: string }) {
    return this.technicians.addScheduleSlot(id, body);
  }
}
