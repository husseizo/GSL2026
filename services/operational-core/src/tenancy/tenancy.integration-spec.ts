import { PrismaService } from '../prisma/prisma.service';
import { createWarehouseFixture } from '../test-helpers/db-fixtures';
import { OrganizationConfigurationService } from './organization-configuration.service';
import { TenantContextService } from './tenant-context.service';

describe('Tenancy (integration)', () => {
  let prisma: PrismaService;
  let config: OrganizationConfigurationService;
  let tenantContext: TenantContextService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    config = new OrganizationConfigurationService(prisma);
    tenantContext = new TenantContextService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns honest structural defaults when no configuration row exists yet', async () => {
    const org = await prisma.organization.create({ data: { code: 'TEN-1', name: 'Tenant Test Org 1' } });
    const result = await config.get(org.id);
    expect(result.timezone).toBe('Africa/Dar_es_Salaam');
    expect(result.currency).toBe('TZS');
  });

  it('upserts real configuration and persists feature flags', async () => {
    const org = await prisma.organization.create({ data: { code: 'TEN-2', name: 'Tenant Test Org 2' } });
    await config.upsert(org.id, { currency: 'USD', brandName: 'Test Brand', featureFlags: { newDashboard: true } });

    const result = await config.get(org.id);
    expect(result.currency).toBe('USD');
    expect(result.brandName).toBe('Test Brand');
    expect(await config.isFeatureEnabled(org.id, 'newDashboard')).toBe(true);
    expect(await config.isFeatureEnabled(org.id, 'unknownFlag')).toBe(false);
  });

  it('assertBranchBelongsToOrganization passes for a real matching branch', async () => {
    const { org, branch } = await createWarehouseFixture(prisma, 'tenancy-1');
    await expect(tenantContext.assertBranchBelongsToOrganization(branch.id, org.id)).resolves.toBeUndefined();
  });

  it('assertBranchBelongsToOrganization rejects a branch from a different organization', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'tenancy-2');
    const otherOrg = await prisma.organization.create({ data: { code: 'TEN-OTHER', name: 'Other Org' } });
    await expect(tenantContext.assertBranchBelongsToOrganization(branch.id, otherOrg.id)).rejects.toThrow();
  });
});
