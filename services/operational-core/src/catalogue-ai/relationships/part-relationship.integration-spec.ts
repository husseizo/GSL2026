import { PrismaService } from '../../prisma/prisma.service';
import { PartRelationshipService } from './part-relationship.service';

// Real Postgres integration tests — real Part fixture rows, real
// PartRelationship writes.
describe('PartRelationshipService (integration, real Postgres)', () => {
  let prisma: PrismaService;
  let relationships: PartRelationshipService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    relationships = new PartRelationshipService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('proposing a relationship always starts PENDING — never auto-verified', async () => {
    const a = await prisma.part.create({ data: { oemNumber: `OEM-PROP-A-${Date.now()}`, productName: 'A', standardizedProductName: 'a' } });
    const b = await prisma.part.create({ data: { oemNumber: `OEM-PROP-B-${Date.now()}`, productName: 'B', standardizedProductName: 'b' } });

    const relationship = await relationships.propose({ fromPartId: a.id, toPartId: b.id, relationshipType: 'SUPERSEDES', source: 'test-heuristic', evidence: { note: 'real test evidence' } });
    expect(relationship.verificationStatus).toBe('PENDING');
  });

  it('proposing the same relationship twice upserts rather than duplicating', async () => {
    const a = await prisma.part.create({ data: { oemNumber: `OEM-UPSERT-A-${Date.now()}`, productName: 'A', standardizedProductName: 'a' } });
    const b = await prisma.part.create({ data: { oemNumber: `OEM-UPSERT-B-${Date.now()}`, productName: 'B', standardizedProductName: 'b' } });

    await relationships.propose({ fromPartId: a.id, toPartId: b.id, relationshipType: 'ALTERNATE_NUMBER', source: 'test', evidence: { v: 1 } });
    await relationships.propose({ fromPartId: a.id, toPartId: b.id, relationshipType: 'ALTERNATE_NUMBER', source: 'test', evidence: { v: 2 } });

    const all = await prisma.partRelationship.findMany({ where: { fromPartId: a.id, toPartId: b.id, relationshipType: 'ALTERNATE_NUMBER' } });
    expect(all).toHaveLength(1);
    expect((all[0].evidence as { v: number }).v).toBe(2);
  });

  it('verify() sets APPROVED with a real reviewer id and timestamp', async () => {
    const a = await prisma.part.create({ data: { oemNumber: `OEM-VER-A-${Date.now()}`, productName: 'A', standardizedProductName: 'a' } });
    const b = await prisma.part.create({ data: { oemNumber: `OEM-VER-B-${Date.now()}`, productName: 'B', standardizedProductName: 'b' } });
    const reviewer = await prisma.user.create({ data: { email: `reviewer-${Date.now()}@aios.local`, name: 'Reviewer', role: 'DATA_QUALITY_REVIEWER' } });

    const proposed = await relationships.propose({ fromPartId: a.id, toPartId: b.id, relationshipType: 'SAME_AS', source: 'test', evidence: {} });
    const verified = await relationships.verify(proposed.id, reviewer.id);

    expect(verified.verificationStatus).toBe('APPROVED');
    expect(verified.reviewerId).toBe(reviewer.id);
    expect(verified.verifiedAt).not.toBeNull();
  });

  it('reject() sets REJECTED, and rejected relationships never appear in listVerifiedRelationships', async () => {
    const a = await prisma.part.create({ data: { oemNumber: `OEM-REJ-A-${Date.now()}`, productName: 'A', standardizedProductName: 'a' } });
    const b = await prisma.part.create({ data: { oemNumber: `OEM-REJ-B-${Date.now()}`, productName: 'B', standardizedProductName: 'b' } });
    const reviewer = await prisma.user.create({ data: { email: `reviewer-rej-${Date.now()}@aios.local`, name: 'Reviewer', role: 'DATA_QUALITY_REVIEWER' } });

    const proposed = await relationships.propose({ fromPartId: a.id, toPartId: b.id, relationshipType: 'PART_OF_KIT', source: 'test', evidence: {} });
    await relationships.reject(proposed.id, reviewer.id);

    const verifiedList = await relationships.listVerifiedRelationships(a.id);
    expect(verifiedList.some((r) => r.id === proposed.id)).toBe(false);
  });

  it('listPendingRelationships only returns PENDING rows, filterable by part', async () => {
    const a = await prisma.part.create({ data: { oemNumber: `OEM-PEND-A2-${Date.now()}`, productName: 'A', standardizedProductName: 'a' } });
    const b = await prisma.part.create({ data: { oemNumber: `OEM-PEND-B2-${Date.now()}`, productName: 'B', standardizedProductName: 'b' } });
    const c = await prisma.part.create({ data: { oemNumber: `OEM-PEND-C2-${Date.now()}`, productName: 'C', standardizedProductName: 'c' } });

    await relationships.propose({ fromPartId: a.id, toPartId: b.id, relationshipType: 'RELATED_SERVICE_ITEM', source: 'test', evidence: {} });
    await relationships.propose({ fromPartId: a.id, toPartId: c.id, relationshipType: 'MANUAL_REVIEW_LINK', source: 'test', evidence: {} });

    const pendingForA = await relationships.listPendingRelationships(a.id);
    expect(pendingForA.length).toBeGreaterThanOrEqual(2);
    expect(pendingForA.every((r) => r.verificationStatus === 'PENDING')).toBe(true);
  });
});
