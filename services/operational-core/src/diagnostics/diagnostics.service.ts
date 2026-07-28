import { Injectable, NotFoundException } from '@nestjs/common';
import { CauseConfidence, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddDiagnosticCodeDto } from './dto/add-diagnostic-code.dto';
import { CreateDiagnosticSessionDto } from './dto/create-diagnostic-session.dto';

// Structured storage only — no AI interpretation of DTCs in Phase 3. See
// docs/architecture/diagnostic-model.md and docs/architecture/03-ai-platform.md.
@Injectable()
export class DiagnosticsService {
  constructor(private readonly prisma: PrismaService) {}

  createSession(dto: CreateDiagnosticSessionDto) {
    return this.prisma.diagnosticSession.create({ data: dto });
  }

  async completeSession(id: string) {
    await this.getSessionOrThrow(id);
    return this.prisma.diagnosticSession.update({ where: { id }, data: { completedAt: new Date() } });
  }

  recordProcedure(id: string, steps: string[]) {
    return this.prisma.diagnosticSession.update({ where: { id }, data: { proceduresPerformed: steps as Prisma.InputJsonValue } });
  }

  async addCode(sessionId: string, dto: AddDiagnosticCodeDto) {
    await this.getSessionOrThrow(sessionId);
    return this.prisma.diagnosticCode.create({
      data: {
        sessionId,
        code: dto.code,
        source: dto.source,
        description: dto.description,
        freezeFrame: dto.freezeFrame as Prisma.InputJsonValue | undefined,
      },
    });
  }

  addSymptom(sessionId: string, description: string, reportedBy: 'TECHNICIAN' | 'CUSTOMER' = 'TECHNICIAN') {
    return this.prisma.symptom.create({ data: { sessionId, description, reportedBy } });
  }

  addSuspectedCause(sessionId: string, description: string, diagnosticCodeId?: string) {
    return this.prisma.suspectedCause.create({ data: { sessionId, description, diagnosticCodeId } });
  }

  async confirmCause(id: string, confirmedById?: string) {
    const cause = await this.prisma.suspectedCause.findUnique({ where: { id } });
    if (!cause) throw new NotFoundException(`Suspected cause ${id} not found`);
    return this.prisma.suspectedCause.update({
      where: { id },
      data: { confidence: CauseConfidence.CONFIRMED, confirmedAt: new Date(), confirmedById },
    });
  }

  addAttachment(sessionId: string, url: string, kind: string) {
    return this.prisma.diagnosticAttachment.create({ data: { sessionId, url, kind } });
  }

  listSessionsForJob(jobId: string) {
    return this.prisma.diagnosticSession.findMany({
      where: { jobId },
      include: { codes: true, symptoms: true, causes: true, attachments: true },
      orderBy: { startedAt: 'desc' },
    });
  }

  // Used by repeat-repair detection: every DTC ever recorded for a vehicle,
  // across all its jobs' diagnostic sessions.
  listCodeHistoryForVehicle(vehicleId: string) {
    return this.prisma.diagnosticCode.findMany({
      where: { session: { job: { vehicleId } } },
      include: { session: { include: { job: true } } },
      orderBy: { recordedAt: 'desc' },
    });
  }

  private async getSessionOrThrow(id: string) {
    const session = await this.prisma.diagnosticSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException(`Diagnostic session ${id} not found`);
    return session;
  }
}
