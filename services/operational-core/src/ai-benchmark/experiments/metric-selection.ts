// DGX Prototype 1.6 — Prompt Laboratory / Experiments (spec §6-7).
//
// Pure — no DB. "Select prompts using metrics only" (spec's explicit
// rule): the winner is whichever arm has the best value of
// experiment.selectionMetric, a single named dotted path into that arm's
// stored CategoryMetrics snapshot — never a manual override without a
// logged reason (see PromptExperimentService.decideWinner()).
export interface ExperimentArmSnapshot {
  armId: string;
  label: string;
  metrics: Record<string, unknown>; // one category's CategoryMetrics.metrics object
}

function getByPath(obj: Record<string, unknown>, path: string): number | undefined {
  const value = path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), obj);
  return typeof value === 'number' ? value : undefined;
}

export type SelectionDirection = 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';

export interface WinnerSelectionResult {
  winnerArmId: string | null;
  selectionMetric: string;
  values: { armId: string; label: string; value: number | null }[];
  reason: string;
}

export function selectWinner(arms: ExperimentArmSnapshot[], selectionMetric: string, direction: SelectionDirection = 'HIGHER_IS_BETTER'): WinnerSelectionResult {
  const values = arms.map((arm) => ({ armId: arm.armId, label: arm.label, value: getByPath(arm.metrics, selectionMetric) ?? null }));
  const scored = values.filter((v) => v.value !== null) as { armId: string; label: string; value: number }[];

  if (scored.length === 0) {
    return { winnerArmId: null, selectionMetric, values, reason: `no arm produced a real value for metric "${selectionMetric}"` };
  }

  const best = scored.reduce((a, b) => {
    if (direction === 'HIGHER_IS_BETTER') return b.value > a.value ? b : a;
    return b.value < a.value ? b : a;
  });

  return { winnerArmId: best.armId, selectionMetric, values, reason: `arm "${best.label}" had the ${direction === 'HIGHER_IS_BETTER' ? 'highest' : 'lowest'} real value (${best.value}) for "${selectionMetric}"` };
}
