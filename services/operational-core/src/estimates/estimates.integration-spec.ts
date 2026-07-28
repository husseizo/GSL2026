import { PrismaService } from '../prisma/prisma.service';
import { createCustomerFixture, createVehicleFixture, createWarehouseFixture } from '../test-helpers/db-fixtures';
import { EstimatesService } from './estimates.service';

describe('EstimatesService (integration)', () => {
  let prisma: PrismaService;
  let estimates: EstimatesService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    estimates = new EstimatesService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function setupJob(suffix: string) {
    const { branch, warehouse } = await createWarehouseFixture(prisma, suffix);
    const vehicle = await createVehicleFixture(prisma, suffix);
    const customer = await createCustomerFixture(prisma, suffix);
    const job = await prisma.garageJob.create({
      data: { jobNumber: `JOB-${suffix}`, vehicleId: vehicle.id, branchId: branch.id, warehouseId: warehouse.id, customerId: customer.id },
    });
    return { job, branch, warehouse, customer };
  }

  it('computes subtotal/tax/discount/grand totals from the submitted lines', async () => {
    const { job } = await setupJob('est-1');
    const estimate = await estimates.create({
      jobId: job.id,
      lines: [
        { lineType: 'LABOUR', description: 'Labour', quantity: 2, unitPrice: 10000 },
        { lineType: 'PART', description: 'Part', quantity: 1, unitPrice: 5000, discountAmount: 500, taxAmount: 200 },
      ],
    });

    expect(Number(estimate.subtotal)).toBe(25000); // 2*10000 + 1*5000
    expect(Number(estimate.discountTotal)).toBe(500);
    expect(Number(estimate.taxTotal)).toBe(200);
    expect(Number(estimate.grandTotal)).toBe(24700); // 25000 - 500 + 200
  });

  it('supports partial approval, deriving PARTIALLY_APPROVED at the estimate level', async () => {
    const { job } = await setupJob('est-2');
    const estimate = await estimates.create({
      jobId: job.id,
      lines: [
        { lineType: 'LABOUR', description: 'Labour', quantity: 1, unitPrice: 10000 },
        { lineType: 'PART', description: 'Part', quantity: 1, unitPrice: 5000 },
      ],
    });
    const request = await estimates.sendForApproval(estimate.id);
    const full = await estimates.findById(estimate.id);

    await estimates.respond(request.id, {
      lineDecisions: [
        { estimateLineId: full.lines[0].id, decision: 'APPROVED' },
        { estimateLineId: full.lines[1].id, decision: 'REJECTED' },
      ],
    });

    const result = await estimates.findById(estimate.id);
    expect(result.status).toBe('PARTIALLY_APPROVED');
    const approvedLine = result.lines.find((l) => l.id === full.lines[0].id)!;
    const rejectedLine = result.lines.find((l) => l.id === full.lines[1].id)!;
    expect(approvedLine.approvalDecision).toBe('APPROVED');
    expect(rejectedLine.approvalDecision).toBe('REJECTED');
  });

  it('rejects responding to an approval request twice', async () => {
    const { job } = await setupJob('est-3');
    const estimate = await estimates.create({ jobId: job.id, lines: [{ lineType: 'LABOUR', description: 'Labour', quantity: 1, unitPrice: 1000 }] });
    const request = await estimates.sendForApproval(estimate.id);
    await estimates.respond(request.id, {});

    await expect(estimates.respond(request.id, {})).rejects.toThrow();
  });

  it('revise() snapshots the prior lines into an EstimateRevision and bumps the version', async () => {
    const { job } = await setupJob('est-4');
    const estimate = await estimates.create({ jobId: job.id, lines: [{ lineType: 'LABOUR', description: 'v1', quantity: 1, unitPrice: 1000 }] });

    const revised = await estimates.revise(estimate.id, [{ lineType: 'LABOUR', description: 'v2', quantity: 2, unitPrice: 1000 }], 'customer asked for more work', 'advisor-1');

    expect(revised.version).toBe(2);
    const revisions = await prisma.estimateRevision.findMany({ where: { estimateId: estimate.id } });
    expect(revisions).toHaveLength(1);
    expect(revisions[0].version).toBe(1);
  });

  it('convertToInvoice only bills APPROVED lines, excluding REJECTED ones', async () => {
    const { job } = await setupJob('est-5');
    const estimate = await estimates.create({
      jobId: job.id,
      lines: [
        { lineType: 'LABOUR', description: 'Approved labour', quantity: 1, unitPrice: 10000 },
        { lineType: 'PART', description: 'Rejected part', quantity: 1, unitPrice: 50000 },
      ],
    });
    const request = await estimates.sendForApproval(estimate.id);
    const full = await estimates.findById(estimate.id);
    await estimates.respond(request.id, {
      lineDecisions: [
        { estimateLineId: full.lines[0].id, decision: 'APPROVED' },
        { estimateLineId: full.lines[1].id, decision: 'REJECTED' },
      ],
    });

    const invoice = await estimates.convertToInvoice(estimate.id, {});
    expect(invoice.lines).toHaveLength(1);
    expect(Number(invoice.grandTotal)).toBe(10000);
    expect(invoice.documentType).toBe('INVOICE');
    expect(invoice.garageJobId).toBe(job.id);
  });

  it('rejects converting an estimate with no approved lines', async () => {
    const { job } = await setupJob('est-6');
    const estimate = await estimates.create({ jobId: job.id, lines: [{ lineType: 'LABOUR', description: 'Not approved', quantity: 1, unitPrice: 1000 }] });

    await expect(estimates.convertToInvoice(estimate.id, {})).rejects.toThrow();
  });
});
