// Pure time-based and entity-grouped split functions — no DB, no I/O. See
// docs/data-readiness/leakage-prevention.md for why random splits are
// forbidden for forecasting/behavioural models in this phase.
export interface DatedRecord {
  date: Date;
}

export interface TimeSplitBoundaries {
  trainStart: Date;
  trainEnd: Date;
  validationStart: Date;
  validationEnd: Date;
  testStart: Date;
  testEnd: Date;
}

export interface TimeSplitResult<T extends DatedRecord> {
  boundaries: TimeSplitBoundaries;
  train: T[];
  validation: T[];
  test: T[];
}

// Splits a real, dated series into three non-overlapping, chronologically-
// ordered windows — training always the earliest, test always the most
// recent, and validation strictly between them. No record's date can fall
// in more than one split; the boundaries themselves are returned so a
// caller can record them (spec's "record all split boundaries").
export function timeBasedSplit<T extends DatedRecord>(records: T[], validationDays: number, testDays: number): TimeSplitResult<T> {
  if (records.length === 0) {
    const now = new Date();
    return { boundaries: { trainStart: now, trainEnd: now, validationStart: now, validationEnd: now, testStart: now, testEnd: now }, train: [], validation: [], test: [] };
  }

  const sorted = [...records].sort((a, b) => a.date.getTime() - b.date.getTime());
  const minDate = sorted[0].date;
  const maxDate = sorted[sorted.length - 1].date;
  const dayMs = 24 * 60 * 60 * 1000;

  const testStart = new Date(maxDate.getTime() - testDays * dayMs);
  const validationStart = new Date(testStart.getTime() - validationDays * dayMs);

  const train = sorted.filter((r) => r.date < validationStart);
  const validation = sorted.filter((r) => r.date >= validationStart && r.date < testStart);
  const test = sorted.filter((r) => r.date >= testStart);

  return {
    boundaries: { trainStart: minDate, trainEnd: new Date(validationStart.getTime() - 1), validationStart, validationEnd: new Date(testStart.getTime() - 1), testStart, testEnd: maxDate },
    train,
    validation,
    test,
  };
}

// Entity-grouped split for matching/deduplication datasets — ensures every
// example belonging to the same real entity (e.g. the same canonical
// customer, or the same consolidated part) lands entirely in one split,
// never partially in train and partially in test. Prevents the specific
// leakage the phase calls out: "near-duplicate records appearing in both
// training and testing."
export function entityGroupedSplit<T extends { entityId: string }>(records: T[], testFraction: number, seed = 'data-readiness-v1'): { train: T[]; test: T[] } {
  const entityIds = [...new Set(records.map((r) => r.entityId))].sort();
  const testEntityCount = Math.max(1, Math.round(entityIds.length * testFraction));

  // Deterministic (seeded) assignment — same input + same seed always
  // produces the same split, which the phase's reproducibility rule
  // requires, without needing true randomness.
  const hashed = entityIds.map((id) => ({ id, hash: simpleHash(seed + id) })).sort((a, b) => a.hash - b.hash);
  const testEntityIds = new Set(hashed.slice(0, testEntityCount).map((h) => h.id));

  return {
    train: records.filter((r) => !testEntityIds.has(r.entityId)),
    test: records.filter((r) => testEntityIds.has(r.entityId)),
  };
}

// FNV-1a — a naive rolling polynomial hash (hash = hash*31 + char) was
// tried first and rejected: it clusters entity IDs sharing a prefix (e.g.
// "entity-1"/"entity-10"/"entity-19") into similar hash ranges regardless
// of seed, because the shared prefix dominates the early hash state. FNV-1a's
// per-character multiply-then-xor gives much better avalanche behavior, so
// changing the seed actually reshuffles which entities land in the test
// split rather than just shifting all hashes by a near-constant offset.
function simpleHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
