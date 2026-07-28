import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductComparisonService } from './product-comparison.service';

// Real Postgres integration tests — real Part/LubricantProduct/
// PartRelationship fixture rows, real Prisma queries throughout.
describe('ProductComparisonService (integration, real Postgres)', () => {
  let prisma: PrismaService;
  let comparison: ProductComparisonService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    comparison = new ProductComparisonService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('compareParts', () => {
    it('labels identical part ids SAME_CANONICAL_ITEM', async () => {
      const part = await prisma.part.create({ data: { oemNumber: `OEM-SAME-${Date.now()}`, productName: 'Test Part', standardizedProductName: 'test part' } });
      const result = await comparison.compareParts(part.id, part.id);
      expect(result.label).toBe('SAME_CANONICAL_ITEM');
    });

    it('labels two parts sharing a real OEM but conflicting category as CONFLICTING_DATA — never interchangeable', async () => {
      const oem = `OEM-CONFLICT-CMP-${Date.now()}`;
      const a = await prisma.part.create({ data: { oemNumber: oem, productName: 'A', standardizedProductName: 'a', category: 'BRAKES' } });
      const b = await prisma.part.create({ data: { oemNumber: oem, productName: 'B', standardizedProductName: 'b', category: 'ENGINE' } });

      const result = await comparison.compareParts(a.id, b.id);
      expect(result.label).toBe('CONFLICTING_DATA');
    });

    it('labels two parts sharing a real OEM with the same category as VERIFIED_EQUIVALENT', async () => {
      const oem = `OEM-EQUIV-${Date.now()}`;
      const a = await prisma.part.create({ data: { oemNumber: oem, productName: 'A', standardizedProductName: 'a', category: 'BRAKES' } });
      const b = await prisma.part.create({ data: { oemNumber: oem, productName: 'B', standardizedProductName: 'b', category: 'BRAKES' } });

      const result = await comparison.compareParts(a.id, b.id);
      expect(result.label).toBe('VERIFIED_EQUIVALENT');
    });

    it('labels a verified COMPATIBLE_WITH relationship as COMPATIBLE_ALTERNATIVE, not VERIFIED_EQUIVALENT', async () => {
      const a = await prisma.part.create({ data: { oemNumber: `OEM-A-${Date.now()}`, productName: 'A', standardizedProductName: 'a' } });
      const b = await prisma.part.create({ data: { oemNumber: `OEM-B-${Date.now()}`, productName: 'B', standardizedProductName: 'b' } });
      await prisma.partRelationship.create({ data: { fromPartId: a.id, toPartId: b.id, relationshipType: 'COMPATIBLE_WITH', source: 'test', evidence: {}, verificationStatus: 'APPROVED' } });

      const result = await comparison.compareParts(a.id, b.id);
      expect(result.label).toBe('COMPATIBLE_ALTERNATIVE');
    });

    it('never presents a PENDING (unverified) relationship as a confirmed equivalence — only POSSIBLE_ALTERNATIVE', async () => {
      const a = await prisma.part.create({ data: { oemNumber: `OEM-PEND-A-${Date.now()}`, productName: 'A', standardizedProductName: 'a' } });
      const b = await prisma.part.create({ data: { oemNumber: `OEM-PEND-B-${Date.now()}`, productName: 'B', standardizedProductName: 'b' } });
      await prisma.partRelationship.create({ data: { fromPartId: a.id, toPartId: b.id, relationshipType: 'SAME_AS', source: 'test', evidence: {}, verificationStatus: 'PENDING' } });

      const result = await comparison.compareParts(a.id, b.id);
      expect(result.label).toBe('POSSIBLE_ALTERNATIVE');
      expect(result.verifiedRelationship).toBeNull();
    });

    it('labels two unrelated parts with no shared evidence as INSUFFICIENT_EVIDENCE', async () => {
      const a = await prisma.part.create({ data: { oemNumber: `OEM-UNREL-A-${Date.now()}`, productName: 'A', standardizedProductName: 'a', category: 'BRAKES' } });
      const b = await prisma.part.create({ data: { oemNumber: `OEM-UNREL-B-${Date.now()}`, productName: 'B', standardizedProductName: 'b', category: 'BRAKES' } });

      const result = await comparison.compareParts(a.id, b.id);
      expect(result.label).toBe('INSUFFICIENT_EVIDENCE');
    });

    it('throws NotFoundException for a real nonexistent part id', async () => {
      await expect(comparison.compareParts('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001')).rejects.toThrow(NotFoundException);
    });
  });

  describe('compareLubricants', () => {
    it('labels identical lubricant ids SAME_CANONICAL_ITEM', async () => {
      const product = await prisma.lubricantProduct.create({ data: { brand: 'B', productName: 'P', normalizedName: 'p', category: 'ENGINE_OIL' } });
      const result = await comparison.compareLubricants(product.id, product.id);
      expect(result.label).toBe('SAME_CANONICAL_ITEM');
    });

    it('labels two products in different categories as DIFFERENT_APPLICATION', async () => {
      const a = await prisma.lubricantProduct.create({ data: { brand: 'B', productName: 'Engine Oil', normalizedName: 'engine oil', category: 'ENGINE_OIL' } });
      const b = await prisma.lubricantProduct.create({ data: { brand: 'B', productName: 'Gear Oil', normalizedName: 'gear oil', category: 'GEAR_OIL' } });

      const result = await comparison.compareLubricants(a.id, b.id);
      expect(result.label).toBe('DIFFERENT_APPLICATION');
    });

    it('labels two same-category products with no verified approval as INSUFFICIENT_EVIDENCE, never claiming equivalence', async () => {
      const a = await prisma.lubricantProduct.create({ data: { brand: 'B', productName: 'Oil A', normalizedName: 'oil a', category: 'ENGINE_OIL' } });
      const b = await prisma.lubricantProduct.create({ data: { brand: 'B', productName: 'Oil B', normalizedName: 'oil b', category: 'ENGINE_OIL' } });

      const result = await comparison.compareLubricants(a.id, b.id);
      expect(result.label).toBe('INSUFFICIENT_EVIDENCE');
    });

    it('never returns VERIFIED_EQUIVALENT for two distinct lubricant products, even with a verified approval on one', async () => {
      const a = await prisma.lubricantProduct.create({ data: { brand: 'B', productName: 'Oil A', normalizedName: 'oil a', category: 'ENGINE_OIL' } });
      const b = await prisma.lubricantProduct.create({ data: { brand: 'B', productName: 'Oil B', normalizedName: 'oil b', category: 'ENGINE_OIL' } });
      await prisma.lubricantApproval.create({ data: { lubricantProductId: a.id, oemBrand: `VW-${Date.now()}`, approvalCode: '504.00', isVerified: true } });

      const result = await comparison.compareLubricants(a.id, b.id);
      expect(result.label).not.toBe('VERIFIED_EQUIVALENT');
      expect(result.label).toBe('POSSIBLE_ALTERNATIVE');
    });
  });
});
