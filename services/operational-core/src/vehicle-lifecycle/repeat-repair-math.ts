// Pure, DB-free matching logic — deterministic only, no AI (Phase 5 territory
// per the spec). See docs/architecture/repeat-repair.md.
export interface JobRepairSignature {
  jobId: string;
  complaintDescriptions: string[]; // already normalized (lowercase, trimmed)
  dtcCodes: string[];
  partIds: string[];
  partCategories: string[];
}

export type RepeatRepairReason = 'SAME_COMPLAINT' | 'SAME_DTC' | 'SAME_PART' | 'SAME_SYSTEM';

export interface RepeatRepairMatch {
  relatedJobId: string;
  matchReason: RepeatRepairReason;
}

// One match per prior job, using the strongest available signal (complaint >
// DTC > part > system-category) rather than flagging the same pair multiple
// times for multiple overlapping reasons.
export function detectRepeatRepairs(current: JobRepairSignature, priorJobs: JobRepairSignature[]): RepeatRepairMatch[] {
  const matches: RepeatRepairMatch[] = [];

  for (const prior of priorJobs) {
    if (prior.jobId === current.jobId) continue;

    if (intersects(current.complaintDescriptions, prior.complaintDescriptions)) {
      matches.push({ relatedJobId: prior.jobId, matchReason: 'SAME_COMPLAINT' });
    } else if (intersects(current.dtcCodes, prior.dtcCodes)) {
      matches.push({ relatedJobId: prior.jobId, matchReason: 'SAME_DTC' });
    } else if (intersects(current.partIds, prior.partIds)) {
      matches.push({ relatedJobId: prior.jobId, matchReason: 'SAME_PART' });
    } else if (intersects(current.partCategories, prior.partCategories)) {
      matches.push({ relatedJobId: prior.jobId, matchReason: 'SAME_SYSTEM' });
    }
  }

  return matches;
}

export function normalizeComplaint(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function intersects(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const setB = new Set(b);
  return a.some((value) => value && setB.has(value));
}
