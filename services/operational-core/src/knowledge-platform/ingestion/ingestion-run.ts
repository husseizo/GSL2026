// DGX Prototype 1.7 — typed pipeline-run result accumulator, mirroring the
// verify-script STEP/outcome discipline established across DGX 1.5/1.6.
export type StageOutcome = 'EXECUTED_PASSED' | 'EXECUTED_FAILED' | 'QUARANTINED' | 'DEFERRED';

export interface StageResult {
  stage: string;
  outcome: StageOutcome;
  detail: string;
}

export class IngestionRun {
  readonly stages: StageResult[] = [];

  record(stage: string, outcome: StageOutcome, detail: string): void {
    this.stages.push({ stage, outcome, detail });
  }

  get failed(): boolean {
    return this.stages.some((s) => s.outcome === 'EXECUTED_FAILED' || s.outcome === 'QUARANTINED');
  }

  get quarantined(): boolean {
    return this.stages.some((s) => s.outcome === 'QUARANTINED');
  }
}
