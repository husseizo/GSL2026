// Pure, deterministic Digital Twin scoring — no DB, no LLM call, no
// training data. This is exactly the spec's own instruction applied
// literally: "Never assume deep learning is automatically better." There is
// nowhere near enough historical data per vehicle in this system to train a
// real model without either overfitting to a handful of rows or fabricating
// confidence that isn't earned — a rule-based, evidence-citing approach is
// both honest about that limitation and, for this data volume, more
// reliable. See docs/architecture/digital-twin-intelligence.md.
//
// Every score traces back to real evidence items counted from the vehicle's
// actual history (DTCs, parts, complaints, inspection findings) — nothing
// here is a black box.

export type SystemCategory = 'COOLING' | 'ENGINE' | 'TRANSMISSION' | 'SUSPENSION' | 'ELECTRICAL' | 'BRAKE';

const SYSTEM_KEYWORDS: Record<SystemCategory, string[]> = {
  COOLING: ['coolant', 'radiator', 'water pump', 'thermostat', 'antifreeze', 'overheating'],
  ENGINE: ['engine', 'ignition', 'spark', 'fuel', 'turbo', 'misfire', 'piston', 'timing'],
  TRANSMISSION: ['transmission', 'gearbox', 'clutch', 'dsg', 'atf', 'torque converter'],
  SUSPENSION: ['suspension', 'shock', 'strut', 'air spring', 'control arm', 'bushing'],
  ELECTRICAL: ['electrical', 'battery', 'alternator', 'wiring', 'ecu', 'module', 'sensor', 'fuse'],
  BRAKE: ['brake', 'pad', 'rotor', 'caliper', 'disc', 'abs'],
};

export const ALL_SYSTEMS: SystemCategory[] = ['COOLING', 'ENGINE', 'TRANSMISSION', 'SUSPENSION', 'ELECTRICAL', 'BRAKE'];

export function classifySystem(text: string): SystemCategory | 'OTHER' {
  const lower = text.toLowerCase();
  for (const system of ALL_SYSTEMS) {
    if (SYSTEM_KEYWORDS[system].some((keyword) => lower.includes(keyword))) return system;
  }
  return 'OTHER';
}

export interface EvidenceEvent {
  text: string;
  occurredAt: Date;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface SystemRiskResult {
  system: SystemCategory;
  riskScore: number;
  riskLevel: RiskLevel;
  evidenceCount: number;
}

const RISK_WINDOW_DAYS = 365;

// Each relevant event in the trailing 12 months adds 25 points, capped at
// 100 — three or more incidents on the same system within a year is treated
// as HIGH risk. Simple, explainable, and directly traceable to a count a
// reviewer can re-derive by hand from the same evidence list.
export function computeSystemRisks(events: EvidenceEvent[], now: Date = new Date()): Record<SystemCategory, SystemRiskResult> {
  const windowMs = RISK_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const result = {} as Record<SystemCategory, SystemRiskResult>;

  for (const system of ALL_SYSTEMS) {
    const relevant = events.filter((e) => classifySystem(e.text) === system && now.getTime() - e.occurredAt.getTime() <= windowMs);
    const riskScore = Math.min(100, relevant.length * 25);
    const riskLevel: RiskLevel = riskScore >= 60 ? 'HIGH' : riskScore >= 25 ? 'MEDIUM' : 'LOW';
    result[system] = { system, riskScore, riskLevel, evidenceCount: relevant.length };
  }

  return result;
}

export function computeVehicleHealthScore(systemRisks: Record<SystemCategory, SystemRiskResult>): number {
  const scores = Object.values(systemRisks).map((r) => r.riskScore);
  const averageRisk = scores.reduce((sum, s) => sum + s, 0) / Math.max(scores.length, 1);
  return Math.round(Math.max(0, 100 - averageRisk));
}

export function computeMaintenanceRiskScore(
  systemRisks: Record<SystemCategory, SystemRiskResult>,
  repeatRepairFlagCount: number,
): number {
  const scores = Object.values(systemRisks).map((r) => r.riskScore);
  const averageRisk = scores.reduce((sum, s) => sum + s, 0) / Math.max(scores.length, 1);
  return Math.min(100, Math.round(averageRisk + repeatRepairFlagCount * 10));
}

export function computeWarrantyRisk(warrantyJobCount: number, totalJobCount: number, warrantyCandidateFlagCount: number): number {
  if (totalJobCount === 0) return 0;
  const warrantyRatio = warrantyJobCount / totalJobCount;
  return Math.min(100, Math.round(warrantyCandidateFlagCount * 30 + warrantyRatio * 40));
}

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_HISTORY';

// More repair history behind a prediction earns more confidence in it — a
// vehicle with one job ever cannot honestly support a HIGH-confidence
// prediction about its future, regardless of what the math produces.
export function computeOverallConfidence(jobCount: number): ConfidenceLevel {
  if (jobCount < 2) return 'INSUFFICIENT_HISTORY';
  if (jobCount < 5) return 'LOW';
  if (jobCount < 10) return 'MEDIUM';
  return 'HIGH';
}

export interface ServiceInterval {
  occurredAt: Date;
  mileage?: number;
}

export interface ServiceComplianceResult {
  score: number | null;
  targetIntervalDays: number;
  observedIntervals: number[];
  compliantIntervals: number;
  confidence: ConfidenceLevel;
}

// Compares actual gaps between services against a target interval (default
// 180 days, a common general service interval) — the same "compare against
// a known standard, don't invent a smarter number" approach as Phase 2's
// reorder-point math. Requires at least two dated events to have any
// interval at all.
export function computeServiceCompliance(events: ServiceInterval[], targetIntervalDays = 180): ServiceComplianceResult {
  const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  if (sorted.length < 2) {
    return { score: null, targetIntervalDays, observedIntervals: [], compliantIntervals: 0, confidence: 'INSUFFICIENT_HISTORY' };
  }

  const observedIntervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const days = (sorted[i].occurredAt.getTime() - sorted[i - 1].occurredAt.getTime()) / (24 * 60 * 60 * 1000);
    observedIntervals.push(Math.round(days));
  }

  const compliantIntervals = observedIntervals.filter((d) => d <= targetIntervalDays * 1.25).length;
  const score = Math.round((compliantIntervals / observedIntervals.length) * 100);

  return {
    score,
    targetIntervalDays,
    observedIntervals,
    compliantIntervals,
    confidence: computeOverallConfidence(sorted.length),
  };
}

export interface RecurringItemEvent {
  key: string;
  label: string;
  occurredAt: Date;
}

export interface PredictedRecurrence {
  key: string;
  label: string;
  lastOccurredAt: Date;
  averageIntervalDays: number;
  predictedNextDate: Date;
  occurrenceCount: number;
  confidence: ConfidenceLevel;
}

// "Predicted future parts" / "predicted lubricant needs": for any part or
// lubricant that has been replaced/used 2+ times on this vehicle, project
// the next occurrence from the average real interval between past
// occurrences. A part replaced only once has no interval to average —
// explicitly returns nothing for it rather than guessing a generic figure.
export function predictRecurrences(events: RecurringItemEvent[]): PredictedRecurrence[] {
  const byKey = new Map<string, RecurringItemEvent[]>();
  for (const event of events) {
    const list = byKey.get(event.key) ?? [];
    list.push(event);
    byKey.set(event.key, list);
  }

  const predictions: PredictedRecurrence[] = [];
  for (const [key, occurrences] of byKey) {
    if (occurrences.length < 2) continue;

    const sorted = occurrences.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push((sorted[i].occurredAt.getTime() - sorted[i - 1].occurredAt.getTime()) / (24 * 60 * 60 * 1000));
    }
    const averageIntervalDays = Math.round(intervals.reduce((s, v) => s + v, 0) / intervals.length);
    const lastOccurredAt = sorted[sorted.length - 1].occurredAt;
    const predictedNextDate = new Date(lastOccurredAt.getTime() + averageIntervalDays * 24 * 60 * 60 * 1000);

    predictions.push({
      key,
      label: sorted[sorted.length - 1].label,
      lastOccurredAt,
      averageIntervalDays,
      predictedNextDate,
      occurrenceCount: sorted.length,
      confidence: computeOverallConfidence(sorted.length),
    });
  }

  return predictions.sort((a, b) => a.predictedNextDate.getTime() - b.predictedNextDate.getTime());
}

export interface MaintenanceRecommendation {
  system: SystemCategory;
  riskLevel: RiskLevel;
  recommendation: string;
  evidenceCount: number;
}

// Predicted Maintenance: not a single number, a ranked list of "this system
// has enough recent evidence to warrant attention" — each entry names the
// system, cites how many real evidence events back it, and says what to do
// (inspect first for MEDIUM, prioritize repair for HIGH). LOW-risk systems
// are omitted, not padded in with a hollow "all good" entry.
export function computePredictedMaintenance(systemRisks: Record<SystemCategory, SystemRiskResult>): MaintenanceRecommendation[] {
  return ALL_SYSTEMS.filter((system) => systemRisks[system].riskLevel !== 'LOW')
    .map((system) => {
      const risk = systemRisks[system];
      return {
        system,
        riskLevel: risk.riskLevel,
        recommendation:
          risk.riskLevel === 'HIGH'
            ? `Prioritize inspection/repair of the ${system.toLowerCase()} system — ${risk.evidenceCount} related issue(s) in the last 12 months.`
            : `Schedule a precautionary check of the ${system.toLowerCase()} system — ${risk.evidenceCount} related issue(s) in the last 12 months.`,
        evidenceCount: risk.evidenceCount,
      };
    })
    .sort((a, b) => b.evidenceCount - a.evidenceCount);
}
