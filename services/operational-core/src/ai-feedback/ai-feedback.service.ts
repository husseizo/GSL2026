import { Injectable } from '@nestjs/common';
import { AiFeedbackDecision, AiInferenceKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Spec §15/§17: "Feedback Capture" and "Recommendation acceptance /
// Technician acceptance / Purchase acceptance" all reduce to the same
// primitive — a human recording ACCEPTED/REJECTED/EDITED against a
// specific AiInferenceLog row. One table, one service, reused by every
// assistant's feedback loop rather than a bespoke acceptance-tracking
// mechanism per assistant. See docs/architecture/ai-governance.md.
@Injectable()
export class AiFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  record(inferenceLogId: string, decision: AiFeedbackDecision, actorId?: string, note?: string) {
    return this.prisma.aiFeedback.create({ data: { inferenceLogId, decision, actorId, note } });
  }

  listForLog(inferenceLogId: string) {
    return this.prisma.aiFeedback.findMany({ where: { inferenceLogId }, orderBy: { createdAt: 'desc' } });
  }

  async acceptanceRate(filter: { kind?: AiInferenceKind; since?: Date } = {}): Promise<{
    total: number;
    accepted: number;
    rejected: number;
    edited: number;
    acceptanceRatePct: number | null;
  }> {
    const feedbackRows = await this.prisma.aiFeedback.findMany({
      where: {
        inferenceLog: {
          kind: filter.kind,
          createdAt: filter.since ? { gte: filter.since } : undefined,
        },
      },
    });

    const total = feedbackRows.length;
    const accepted = feedbackRows.filter((f) => f.decision === AiFeedbackDecision.ACCEPTED).length;
    const rejected = feedbackRows.filter((f) => f.decision === AiFeedbackDecision.REJECTED).length;
    const edited = feedbackRows.filter((f) => f.decision === AiFeedbackDecision.EDITED).length;

    return {
      total,
      accepted,
      rejected,
      edited,
      acceptanceRatePct: total > 0 ? Math.round((accepted / total) * 10000) / 100 : null,
    };
  }
}
