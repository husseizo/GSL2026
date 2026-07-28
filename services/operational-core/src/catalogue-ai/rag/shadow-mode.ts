// Shadow-mode pilot controls (DGX Prototype 1.5) — real, operator-toggled
// env flags, not a hardcoded assumption. Defaults are the safe posture per
// the spec: generation stays on (needed to run the offline evaluation and
// verification script) but every generative answer is labeled as
// experimental and low-confidence/conflicting answers are auto-routed to
// the existing manual-review queue. See docs/ai-tuning/shadow-pilot.md.
export function isShadowModeEnabled(): boolean {
  return process.env.CATALOGUE_RAG_SHADOW_MODE !== 'false';
}

// "AI can be disabled instantly" — a real, separate kill switch from
// shadow-mode labeling. When false, the generative layer is skipped
// entirely; deterministic search is unaffected (same real code path as the
// DGX-unavailable fallback, just operator-controlled rather than
// infrastructure-controlled).
export function isGenerationEnabled(): boolean {
  return process.env.CATALOGUE_RAG_GENERATION_ENABLED !== 'false';
}

// DGX Prototype 1.7 — additive Catalogue AI <-> Knowledge Platform
// integration flag. Defaults OFF (opt-in), so this phase changes zero
// existing behavior for any caller unless explicitly enabled. See
// docs/knowledge-platform/catalogue-ai-integration.md.
export function isKnowledgePlatformIntegrationEnabled(): boolean {
  return process.env.KNOWLEDGE_PLATFORM_CATALOGUE_INTEGRATION_ENABLED === 'true';
}

// DGX Prototype 1.7.2 — additive Retrieval Intelligence Platform
// integration flag. Defaults OFF until the real trusted-knowledge quality
// gates pass (see src/ai-benchmark/pipeline/retrieval-intelligence-quality-gates.ts
// and docs/retrieval-intelligence/decision-log.md) — same activation
// discipline as KnowledgeSnapshotService.activate()'s gate blocking.
export function isRetrievalIntelligenceEnabled(): boolean {
  return process.env.RETRIEVAL_INTELLIGENCE_ENABLED === 'true';
}

const SHADOW_MODE_PREFIX = '[AI explanation — shadow-mode pilot, not a confirmed answer] ';

export function applyShadowModeLabel(answerText: string): string {
  return SHADOW_MODE_PREFIX + answerText;
}

// Which confidence levels must be auto-routed to manual review while in
// shadow mode — spec §33: "All low-confidence responses are flagged. All
// conflict responses route to review."
export function requiresShadowModeReview(confidenceLevel: string): boolean {
  return confidenceLevel === 'LOW' || confidenceLevel === 'CONFLICTING' || confidenceLevel === 'INSUFFICIENT_EVIDENCE';
}
