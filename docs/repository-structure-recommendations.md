# Repository Structure — Recommendations (not applied)

This document records structural observations from a full review of the repository layout. **No file has been moved.** These are recommendations for a maintainer to evaluate and apply deliberately, each as its own reviewable change — restructuring a documentation corpus this large in one uncoordinated pass would itself be a real risk (broken relative links, lost git history via naive moves).

## Observation 1 — `docs/` is organized chronologically by phase, not by lasting concern

`docs/` currently has around 30 top-level subdirectories (`ai/`, `ai-benchmark/`, `ai-evaluation/`, `ai-foundation-certification/`, `ai-tuning/`, `architecture/`, `adr/`, `capabilities/`, `certification/`, `data-consolidation/`, `data-readiness/`, `data-sources/`, `execution/`, `governance/`, `knowledge-platform/`, `retrieval-intelligence/`, `strategy/`, `trusted-knowledge-pilot/`, and more), largely reflecting the order phases were built rather than a stable information architecture. A newcomer has to already know the project's history to guess, e.g., that "AI Foundation certification" lives in `docs/ai-foundation-certification/` rather than `docs/certification/` (which is instead DGX-2.0-specific).

**Recommendation**: consider a future, deliberate consolidation under a smaller number of top-level concern areas (e.g. `docs/architecture/`, `docs/governance/`, `docs/capabilities/<name>/` with each capability's own specification + certification + execution history nested together, `docs/platform-history/` for the completed AI Foundation phase-by-phase record). This is a real, non-trivial migration — the [Documentation Portal Decision](documentation-portal-decision.md) is a more actionable near-term step that improves navigability (a curated nav tree) without physically moving any file.

## Observation 2 — Root-level `scripts/ci/` is new and intentionally separate from `services/operational-core/scripts/`

This Repository Excellence initiative added `scripts/ci/validate-mermaid-blocks.py` at the repository root, not under `services/operational-core/scripts/`. This is deliberate: it is a repository-wide documentation-quality concern, not specific to the `operational-core` service, and should not be confused with that service's own operational scripts (dataset builders, certification runners, etc.). Recommend keeping this distinction if more repo-wide (non-service-specific) tooling scripts are added later.

## Observation 3 — `services/` naming is already clean and needs no change

`services/operational-core/`, `services/dgx-ai-platform/`, `services/web-portal/` is a clear, purpose-named, flat structure. No recommendation to change this.

## Observation 4 — Community health files are now at the repository root, per GitHub convention

`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, and `CHANGELOG.md` were added at the repository root rather than under `docs/` — this matches GitHub's own convention for auto-discovering these files (GitHub looks for them at the root, in `.github/`, or in `docs/`, in that order of precedence for some of them) and is the most broadly recognized location. No further change recommended here.

## Observation 5 — No repository-root `LICENSE` file exists

See [Open Source Readiness](../README.md) discussion in the final health report — this is a real gap, but license selection is a business decision outside this initiative's scope to make unilaterally.
