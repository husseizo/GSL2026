// DGX Prototype 1.6 — PRODUCTION_READINESS.
//
// Not case-based at all (spec's own distinction from every other category)
// — a checklist scored as a pass fraction. Every item here is a real,
// independently-checkable fact about the system's current state, not a
// subjective judgment call.
export interface ProductionReadinessItem {
  id: string;
  description: string;
  check: () => Promise<boolean> | boolean;
}

export interface ProductionReadinessResult {
  id: string;
  description: string;
  passed: boolean;
}

// Built by the caller (benchmark-pipeline.service.ts), which has access to
// the real services needed to evaluate each check (PrismaService,
// ModelRegistryService, etc.) — this file only defines the checklist
// shape and the pure scoring function, not the checks themselves, so it
// stays free of NestJS DI concerns.
export async function evaluateChecklist(items: ProductionReadinessItem[]): Promise<{ results: ProductionReadinessResult[]; itemsChecked: number; itemsPassed: number; passRate: number }> {
  const results: ProductionReadinessResult[] = [];
  for (const item of items) {
    const passed = await item.check();
    results.push({ id: item.id, description: item.description, passed });
  }
  const itemsPassed = results.filter((r) => r.passed).length;
  return {
    results,
    itemsChecked: results.length,
    itemsPassed,
    passRate: results.length > 0 ? Math.round((itemsPassed / results.length) * 10000) / 10000 : 1,
  };
}
