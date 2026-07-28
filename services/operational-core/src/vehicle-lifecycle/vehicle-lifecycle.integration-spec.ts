import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { createVehicleFixture, createWarehouseFixture } from '../test-helpers/db-fixtures';
import { VehicleDigitalTwinService } from './digital-twin.service';
import { RepeatRepairService } from './repeat-repair.service';
import { VehicleTimelineService } from './vehicle-timeline.service';

describe('Vehicle lifecycle (digital twin, timeline, repeat-repair) (integration)', () => {
  let prisma: PrismaService;
  let digitalTwin: VehicleDigitalTwinService;
  let timeline: VehicleTimelineService;
  let repeatRepair: RepeatRepairService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    digitalTwin = new VehicleDigitalTwinService(prisma);
    timeline = new VehicleTimelineService(prisma);
    repeatRepair = new RepeatRepairService(prisma, new AuditService(prisma));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('digital twin aggregates DTC history and repair history across multiple jobs for one vehicle', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'twin-1');
    const vehicle = await createVehicleFixture(prisma, 'twin-1');

    const jobA = await prisma.garageJob.create({ data: { jobNumber: 'JOB-TWIN-A', vehicleId: vehicle.id, branchId: branch.id, status: 'COMPLETED' } });
    const jobB = await prisma.garageJob.create({ data: { jobNumber: 'JOB-TWIN-B', vehicleId: vehicle.id, branchId: branch.id } });
    const sessionA = await prisma.diagnosticSession.create({ data: { jobId: jobA.id } });
    await prisma.diagnosticCode.create({ data: { sessionId: sessionA.id, code: 'P0301', source: 'GENERIC_OBD' } });

    const twin = await digitalTwin.getDigitalTwin(vehicle.id);

    expect(twin.repairHistory).toHaveLength(2);
    expect(twin.repairHistory.map((j) => j.jobId).sort()).toEqual([jobA.id, jobB.id].sort());
    expect(twin.dtcHistory.map((c) => c.code)).toContain('P0301');
    // Phase 3 left these as permanent-looking nulls; Phase 4 fills them with
    // real deterministic scoring (see twin-intelligence-math.ts) — a vehicle
    // with only two jobs and no repeated system issues has too little
    // history for anything above LOW confidence, which is itself the
    // correct, honest answer rather than a fabricated one.
    expect(twin.predictedMaintenance).toEqual([]);
    expect(twin.aiConfidenceScore).toBe('LOW');
  });

  it('vehicle timeline merges reception and job-timeline events in chronological order', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'timeline-1');
    const vehicle = await createVehicleFixture(prisma, 'timeline-1');
    const earlier = new Date('2026-01-01T00:00:00Z');
    const later = new Date('2026-02-01T00:00:00Z');

    await prisma.vehicleReception.create({ data: { vehicleId: vehicle.id, branchId: branch.id, mileage: 1000, arrivalAt: later } });
    const job = await prisma.garageJob.create({ data: { jobNumber: 'JOB-TIMELINE-1', vehicleId: vehicle.id, branchId: branch.id } });
    await prisma.jobTimeline.create({ data: { jobId: job.id, eventType: 'JOB_CREATED', description: 'created', occurredAt: earlier } });

    const entries = await timeline.getTimeline(vehicle.id);
    expect(entries[0].occurredAt.getTime()).toBeLessThanOrEqual(entries[1].occurredAt.getTime());
    expect(entries.map((e) => e.eventType)).toEqual(['JOB_CREATED', 'VEHICLE_RECEIVED']);
  });

  it('repeat-repair detection deduplicates via the unique (jobId, relatedJobId, matchReason) key on re-run', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'repeat-1');
    const vehicle = await createVehicleFixture(prisma, 'repeat-1');

    const jobA = await prisma.garageJob.create({ data: { jobNumber: 'JOB-REPEAT-A', vehicleId: vehicle.id, branchId: branch.id } });
    const jobB = await prisma.garageJob.create({ data: { jobNumber: 'JOB-REPEAT-B', vehicleId: vehicle.id, branchId: branch.id } });
    const sessionA = await prisma.diagnosticSession.create({ data: { jobId: jobA.id } });
    await prisma.diagnosticCode.create({ data: { sessionId: sessionA.id, code: 'P0420', source: 'GENERIC_OBD' } });
    const sessionB = await prisma.diagnosticSession.create({ data: { jobId: jobB.id } });
    await prisma.diagnosticCode.create({ data: { sessionId: sessionB.id, code: 'P0420', source: 'GENERIC_OBD' } });

    const first = await repeatRepair.detectForJob(jobB.id);
    const second = await repeatRepair.detectForJob(jobB.id); // re-run
    expect(first.flagsCreated).toBe(1);
    expect(second.flagsCreated).toBe(1); // detects the same match again...

    const flags = await prisma.repeatRepairFlag.findMany({ where: { jobId: jobB.id } });
    expect(flags).toHaveLength(1); // ...but upserts onto the same row, not a duplicate
  });

  it('resolving a repeat-repair flag records an AuditLog entry', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'repeat-2');
    const vehicle = await createVehicleFixture(prisma, 'repeat-2');
    const jobA = await prisma.garageJob.create({ data: { jobNumber: 'JOB-REPEAT-C', vehicleId: vehicle.id, branchId: branch.id } });
    const jobB = await prisma.garageJob.create({ data: { jobNumber: 'JOB-REPEAT-D', vehicleId: vehicle.id, branchId: branch.id } });
    const sA = await prisma.diagnosticSession.create({ data: { jobId: jobA.id } });
    await prisma.diagnosticCode.create({ data: { sessionId: sA.id, code: 'P0171', source: 'GENERIC_OBD' } });
    const sB = await prisma.diagnosticSession.create({ data: { jobId: jobB.id } });
    await prisma.diagnosticCode.create({ data: { sessionId: sB.id, code: 'P0171', source: 'GENERIC_OBD' } });

    await repeatRepair.detectForJob(jobB.id);
    const [flag] = await prisma.repeatRepairFlag.findMany({ where: { jobId: jobB.id } });
    await repeatRepair.resolve(flag.id, 'CONFIRMED', 'user-1', 'confirmed repeat');

    const audit = await prisma.auditLog.findMany({ where: { entityType: 'RepeatRepairFlag', entityId: flag.id } });
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe('REPEAT_REPAIR_FLAG_RESOLVED');
  });
});
