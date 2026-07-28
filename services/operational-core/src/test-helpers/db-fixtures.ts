import { PrismaService } from '../prisma/prisma.service';

// Shared minimal fixture builders for integration tests — real rows in the
// real (test) database, not mocks. Each test that needs a warehouse/part
// pulls from here instead of repeating the same boilerplate.
export async function createWarehouseFixture(prisma: PrismaService, suffix: string) {
  const org = await prisma.organization.create({ data: { code: `ORG-${suffix}`, name: `Org ${suffix}` } });
  const branch = await prisma.branch.create({ data: { organizationId: org.id, code: `BR-${suffix}`, name: `Branch ${suffix}` } });
  const warehouse = await prisma.warehouse.create({ data: { branchId: branch.id, code: `WH-${suffix}`, name: `Warehouse ${suffix}` } });
  return { org, branch, warehouse };
}

export async function createPartFixture(prisma: PrismaService, suffix: string) {
  return prisma.part.create({
    data: {
      oemNumber: `OEM-${suffix}`,
      productName: `Test Part ${suffix}`,
      standardizedProductName: `test part ${suffix}`,
    },
  });
}

export async function createVehicleFixture(prisma: PrismaService, suffix: string) {
  return prisma.vehicle.create({
    data: { vin: `VIN-${suffix}`.padEnd(17, '0'), brand: 'TestBrand', model: `Model-${suffix}` },
  });
}

export async function createCustomerFixture(prisma: PrismaService, suffix: string) {
  return prisma.customer.create({
    data: { customerCode: `CUST-${suffix}`, legalName: `Customer ${suffix}`, displayName: `Customer ${suffix}` },
  });
}

export async function createTechnicianFixture(prisma: PrismaService, suffix: string, branchId: string) {
  return prisma.technician.create({ data: { employeeCode: `TECH-${suffix}`, name: `Technician ${suffix}`, branchId } });
}

export async function createGarageJobFixture(
  prisma: PrismaService,
  params: { vehicleId: string; branchId: string; customerId?: string; warehouseId?: string; isWarranty?: boolean },
) {
  return prisma.garageJob.create({
    data: {
      jobNumber: `JOB-TEST-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      vehicleId: params.vehicleId,
      branchId: params.branchId,
      customerId: params.customerId,
      warehouseId: params.warehouseId,
      isWarranty: params.isWarranty ?? false,
    },
  });
}
