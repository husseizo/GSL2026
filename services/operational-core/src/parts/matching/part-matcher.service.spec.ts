import { MatchCandidateStatus, MatchStage } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SimilarityScorer } from './similarity-scorer';
import { PartMatcherService } from './part-matcher.service';

describe('PartMatcherService', () => {
  let prisma: {
    part: { findMany: jest.Mock };
    partMatchCandidate: { upsert: jest.Mock; findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock };
  };
  let fixedScorer: SimilarityScorer;

  beforeEach(() => {
    prisma = {
      part: { findMany: jest.fn() },
      partMatchCandidate: {
        upsert: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };
    fixedScorer = { score: jest.fn().mockReturnValue(0) };
  });

  function makeService() {
    return new PartMatcherService(prisma as unknown as PrismaService, fixedScorer);
  }

  describe('runRuleBasedMatching', () => {
    it('creates exactly one candidate for two parts sharing a normalized OEM number, ignoring formatting differences', async () => {
      prisma.part.findMany.mockResolvedValue([
        { id: 'part-a', oemNumber: 'BMW-123', alternateNumbers: [] },
        { id: 'part-b', oemNumber: 'bmw123', alternateNumbers: [] }, // same number, different casing/dashes
        { id: 'part-c', oemNumber: 'UNRELATED-999', alternateNumbers: [] },
      ]);

      const service = makeService();
      const created = await service.runRuleBasedMatching();

      expect(created).toBe(1);
      expect(prisma.partMatchCandidate.upsert).toHaveBeenCalledTimes(1);
      const call = prisma.partMatchCandidate.upsert.mock.calls[0][0];
      expect(call.create.stage).toBe(MatchStage.RULE_BASED);
      expect(call.create.score).toBe(1);
      expect([call.create.partAId, call.create.partBId].sort()).toEqual(['part-a', 'part-b'].sort());
    });

    it('matches via alternate/superseded numbers, not just the primary OEM number', async () => {
      prisma.part.findMany.mockResolvedValue([
        { id: 'part-a', oemNumber: 'OLD-111', alternateNumbers: [] },
        {
          id: 'part-b',
          oemNumber: 'NEW-222',
          alternateNumbers: [{ number: 'OLD 111', type: 'SUPERSEDED' }],
        },
      ]);

      const created = await makeService().runRuleBasedMatching();

      expect(created).toBe(1);
    });

    it('produces a stable pair regardless of scan order (canonicalized)', async () => {
      prisma.part.findMany.mockResolvedValue([
        { id: 'z-part', oemNumber: 'SAME1', alternateNumbers: [] },
        { id: 'a-part', oemNumber: 'SAME1', alternateNumbers: [] },
      ]);

      await makeService().runRuleBasedMatching();

      const call = prisma.partMatchCandidate.upsert.mock.calls[0][0];
      // canonicalPair sorts lexicographically: 'a-part' < 'z-part'
      expect(call.create.partAId).toBe('a-part');
      expect(call.create.partBId).toBe('z-part');
    });
  });

  describe('runSimilarityMatching', () => {
    it('skips a pair already resolved by rule-based matching', async () => {
      prisma.part.findMany.mockResolvedValue([
        { id: 'part-a', category: 'brakes', standardizedProductName: 'brake pad front' },
        { id: 'part-b', category: 'brakes', standardizedProductName: 'brake pad front' },
      ]);
      (fixedScorer.score as jest.Mock).mockReturnValue(0.9);
      prisma.partMatchCandidate.findUnique.mockResolvedValue({ id: 'existing-rule-match' });

      const created = await makeService().runSimilarityMatching(0.6);

      expect(created).toBe(0);
      expect(prisma.partMatchCandidate.upsert).not.toHaveBeenCalled();
    });

    it('creates a SIMILARITY candidate when score clears the threshold and no rule match exists', async () => {
      prisma.part.findMany.mockResolvedValue([
        { id: 'part-a', category: 'brakes', standardizedProductName: 'brake pad front' },
        { id: 'part-b', category: 'brakes', standardizedProductName: 'brake pad rear' },
      ]);
      (fixedScorer.score as jest.Mock).mockReturnValue(0.75);

      const created = await makeService().runSimilarityMatching(0.6);

      expect(created).toBe(1);
      const call = prisma.partMatchCandidate.upsert.mock.calls[0][0];
      expect(call.create.stage).toBe(MatchStage.SIMILARITY);
      expect(call.create.score).toBe(0.75);
    });

    it('does not create a candidate below threshold', async () => {
      prisma.part.findMany.mockResolvedValue([
        { id: 'part-a', category: 'brakes', standardizedProductName: 'brake pad front' },
        { id: 'part-b', category: 'brakes', standardizedProductName: 'engine oil filter' },
      ]);
      (fixedScorer.score as jest.Mock).mockReturnValue(0.1);

      const created = await makeService().runSimilarityMatching(0.6);

      expect(created).toBe(0);
    });
  });

  describe('reviewCandidate', () => {
    it('only updates status/reviewer — never triggers an automatic merge', async () => {
      const service = makeService();
      await service.reviewCandidate('candidate-1', MatchCandidateStatus.APPROVED, 'user-1');

      expect(prisma.partMatchCandidate.update).toHaveBeenCalledWith({
        where: { id: 'candidate-1' },
        data: {
          status: MatchCandidateStatus.APPROVED,
          reviewedById: 'user-1',
          reviewedAt: expect.any(Date),
        },
      });
    });
  });
});
