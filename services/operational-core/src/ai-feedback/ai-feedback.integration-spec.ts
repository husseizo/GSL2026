import { PrismaService } from '../prisma/prisma.service';
import { AiFeedbackService } from './ai-feedback.service';

describe('AiFeedbackService (integration)', () => {
  let prisma: PrismaService;
  let feedback: AiFeedbackService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    feedback = new AiFeedbackService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function makeLog(kind: 'GENERATION' | 'EMBEDDING' = 'GENERATION') {
    return prisma.aiInferenceLog.create({ data: { kind, success: true } });
  }

  it('records feedback against a real inference log and lists it back', async () => {
    const log = await makeLog();
    await feedback.record(log.id, 'ACCEPTED', 'user-1', 'Looked correct');

    const list = await feedback.listForLog(log.id);
    expect(list).toHaveLength(1);
    expect(list[0].decision).toBe('ACCEPTED');
    expect(list[0].note).toBe('Looked correct');
  });

  it('computes an accurate acceptance rate across mixed feedback', async () => {
    const logA = await makeLog();
    const logB = await makeLog();
    const logC = await makeLog();
    await feedback.record(logA.id, 'ACCEPTED');
    await feedback.record(logB.id, 'ACCEPTED');
    await feedback.record(logC.id, 'REJECTED');

    const rate = await feedback.acceptanceRate();
    expect(rate.total).toBeGreaterThanOrEqual(3);
    expect(rate.acceptanceRatePct).not.toBeNull();
  });

  it('returns null acceptance rate when there is no feedback yet for the filter', async () => {
    const rate = await feedback.acceptanceRate({ kind: 'EMBEDDING', since: new Date(Date.now() + 86_400_000) });
    expect(rate.total).toBe(0);
    expect(rate.acceptanceRatePct).toBeNull();
  });
});
