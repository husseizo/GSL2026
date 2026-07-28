import { detectRepeatRepairs, JobRepairSignature, normalizeComplaint } from './repeat-repair-math';

function signature(overrides: Partial<JobRepairSignature> = {}): JobRepairSignature {
  return {
    jobId: 'current-job',
    complaintDescriptions: [],
    dtcCodes: [],
    partIds: [],
    partCategories: [],
    ...overrides,
  };
}

describe('normalizeComplaint', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeComplaint('  Engine   Noise  ')).toBe('engine noise');
  });
});

describe('detectRepeatRepairs', () => {
  it('flags SAME_COMPLAINT when a prior job has an identical normalized complaint', () => {
    const current = signature({ complaintDescriptions: ['engine noise on startup'] });
    const prior = signature({ jobId: 'prior-1', complaintDescriptions: ['engine noise on startup'] });
    const matches = detectRepeatRepairs(current, [prior]);
    expect(matches).toEqual([{ relatedJobId: 'prior-1', matchReason: 'SAME_COMPLAINT' }]);
  });

  it('flags SAME_DTC when a prior job recorded the same diagnostic code', () => {
    const current = signature({ dtcCodes: ['P0301'] });
    const prior = signature({ jobId: 'prior-1', dtcCodes: ['P0301', 'P0171'] });
    const matches = detectRepeatRepairs(current, [prior]);
    expect(matches).toEqual([{ relatedJobId: 'prior-1', matchReason: 'SAME_DTC' }]);
  });

  it('flags SAME_PART when a prior job replaced the same part', () => {
    const current = signature({ partIds: ['part-water-pump'] });
    const prior = signature({ jobId: 'prior-1', partIds: ['part-water-pump'] });
    const matches = detectRepeatRepairs(current, [prior]);
    expect(matches).toEqual([{ relatedJobId: 'prior-1', matchReason: 'SAME_PART' }]);
  });

  it('flags SAME_SYSTEM as the weakest signal when only the part category overlaps', () => {
    const current = signature({ partCategories: ['Cooling'] });
    const prior = signature({ jobId: 'prior-1', partCategories: ['Cooling'] });
    const matches = detectRepeatRepairs(current, [prior]);
    expect(matches).toEqual([{ relatedJobId: 'prior-1', matchReason: 'SAME_SYSTEM' }]);
  });

  it('prefers the strongest signal when multiple overlap for the same prior job', () => {
    const current = signature({ complaintDescriptions: ['engine noise'], dtcCodes: ['P0301'], partIds: ['part-1'] });
    const prior = signature({ jobId: 'prior-1', complaintDescriptions: ['engine noise'], dtcCodes: ['P0301'], partIds: ['part-1'] });
    const matches = detectRepeatRepairs(current, [prior]);
    expect(matches).toEqual([{ relatedJobId: 'prior-1', matchReason: 'SAME_COMPLAINT' }]);
  });

  it('does not match the current job against itself', () => {
    const current = signature({ jobId: 'job-1', dtcCodes: ['P0301'] });
    const matches = detectRepeatRepairs(current, [signature({ jobId: 'job-1', dtcCodes: ['P0301'] })]);
    expect(matches).toEqual([]);
  });

  it('returns no matches when nothing overlaps', () => {
    const current = signature({ complaintDescriptions: ['brake squeal'], dtcCodes: ['P0420'] });
    const prior = signature({ jobId: 'prior-1', complaintDescriptions: ['oil leak'], dtcCodes: ['P0171'] });
    expect(detectRepeatRepairs(current, [prior])).toEqual([]);
  });

  it('evaluates each prior job independently, producing one match per matching job', () => {
    const current = signature({ dtcCodes: ['P0301'] });
    const priorA = signature({ jobId: 'prior-a', dtcCodes: ['P0301'] });
    const priorB = signature({ jobId: 'prior-b', dtcCodes: ['P0171'] });
    const matches = detectRepeatRepairs(current, [priorA, priorB]);
    expect(matches).toEqual([{ relatedJobId: 'prior-a', matchReason: 'SAME_DTC' }]);
  });
});
