import { PrismaService } from '../prisma/prisma.service';
import { createVehicleFixture, createWarehouseFixture } from '../test-helpers/db-fixtures';
import { DiagnosticsService } from './diagnostics.service';

describe('DiagnosticsService (integration)', () => {
  let prisma: PrismaService;
  let diagnostics: DiagnosticsService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    diagnostics = new DiagnosticsService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('records a full diagnostic session: code, symptom, suspected cause, confirmation', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'diag-1');
    const vehicle = await createVehicleFixture(prisma, 'diag-1');
    const job = await prisma.garageJob.create({ data: { jobNumber: 'JOB-DIAG-1', vehicleId: vehicle.id, branchId: branch.id } });

    const session = await diagnostics.createSession({ jobId: job.id, notes: 'Initial scan' });
    const code = await diagnostics.addCode(session.id, { code: 'P0301', source: 'GENERIC_OBD', description: 'Misfire cylinder 3' });
    await diagnostics.addSymptom(session.id, 'Rough idle');
    const cause = await diagnostics.addSuspectedCause(session.id, 'Faulty coil', code.id);

    expect(cause.confidence).toBe('SUSPECTED');
    const confirmed = await diagnostics.confirmCause(cause.id, 'tech-1');
    expect(confirmed.confidence).toBe('CONFIRMED');
    expect(confirmed.confirmedAt).not.toBeNull();

    await diagnostics.completeSession(session.id);
    const sessions = await diagnostics.listSessionsForJob(job.id);
    expect(sessions[0].completedAt).not.toBeNull();
  });

  it('listCodeHistoryForVehicle aggregates DTCs across all of a vehicle\'s jobs', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'diag-2');
    const vehicle = await createVehicleFixture(prisma, 'diag-2');
    const jobA = await prisma.garageJob.create({ data: { jobNumber: 'JOB-DIAG-2A', vehicleId: vehicle.id, branchId: branch.id } });
    const jobB = await prisma.garageJob.create({ data: { jobNumber: 'JOB-DIAG-2B', vehicleId: vehicle.id, branchId: branch.id } });
    const sessionA = await diagnostics.createSession({ jobId: jobA.id });
    const sessionB = await diagnostics.createSession({ jobId: jobB.id });
    await diagnostics.addCode(sessionA.id, { code: 'P0171', source: 'GENERIC_OBD' });
    await diagnostics.addCode(sessionB.id, { code: 'P0174', source: 'GENERIC_OBD' });

    const history = await diagnostics.listCodeHistoryForVehicle(vehicle.id);
    expect(history.map((c) => c.code).sort()).toEqual(['P0171', 'P0174']);
  });
});
