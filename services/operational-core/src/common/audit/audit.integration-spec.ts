import { PrismaService } from '../../prisma/prisma.service';
import { CustomersService } from '../../customers/customers.service';
import { AuditService } from './audit.service';

describe('AuditService / customer update audit trail (integration)', () => {
  let prisma: PrismaService;
  let audit: AuditService;
  let customers: CustomersService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    audit = new AuditService(prisma);
    customers = new CustomersService(prisma, audit);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('records an audit log entry with before/after state when a customer is updated', async () => {
    const customer = await prisma.customer.create({
      data: { customerCode: 'AUDIT-TEST-1', legalName: 'Original Name', displayName: 'Original' },
    });

    await customers.update(customer.id, { legalName: 'Corrected Name' }, { userId: 'user-1', role: 'BRANCH_MANAGER' });

    const logs = await audit.list({ entityType: 'Customer', entityId: customer.id });
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('CUSTOMER_UPDATED');
    expect(logs[0].actorId).toBe('user-1');
    expect((logs[0].beforeState as { legalName: string }).legalName).toBe('Original Name');
    expect((logs[0].afterState as { legalName: string }).legalName).toBe('Corrected Name');
  });
});
