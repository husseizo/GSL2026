# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This repository does not yet follow Semantic Versioning tags (see [`docs/release-strategy.md`](docs/release-strategy.md) for the policy that will apply once releases begin) — everything below is therefore recorded under **[Unreleased]**, dated by the real date each milestone's evidence artifact was produced, not estimated or backfilled.

> **Note on dates**: dates below are taken directly from real, verifiable sources — git commit history (`git log`) for anything committed to this repository, and file timestamps for pre-commit historical artifacts (e.g. certification reports, ADRs, the frozen baseline). No date in this file is estimated or invented.

## [Unreleased]

### Documentation

- **2026-07-28** — Repository Excellence initiative: enterprise README restructure, C4 architecture diagrams, community health files (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`), issue/PR templates, this `CHANGELOG.md`, ADR index, release strategy, documentation portal decision record, and documentation-quality GitHub Actions — repository engineering assets only, no business capability changed.
- **2026-07-28** — Documentation Reconciliation: aligned `README.md`, the Enterprise Roadmap, Reference Architecture, and Capability Governance Standard with the frozen DGX 2.0 Phase A Baseline 1.0 — recorded two completed certification runs and the `NOT_READY` verdict, without altering any historical evidence, frozen baseline, or certification report (commit `d37b518`).
- **2026-07-28** — Initial commit of the full AIOS repository to version control (commit `84a7f2e`).

### DGX 2.0 Demand Forecasting — Phase A

- **2026-07-28** — Baseline Freeze: `docs/execution/DGX2_PHASE_A_BASELINE_1_0.md` published as the permanent, immutable archival record of Phase A — architecture, governance, certification, and operational-transition status frozen at closure.
- **2026-07-28** — Certification Run #2 executed under Certification Standard v1.1 (Amendment-aware five-condition exclusion mechanism) — verdict `NOT_READY` (same two mandatory gates as Run #1; zero rows qualified for the new exclusion, since none yet carried the required evidence field).
- **2026-07-28** — Remediation Cycle 2: implemented the Amendment v1.1 five-condition deterministic exclusion for `HISTORICAL_METRICS_PERSISTED`, with full audit-trail reporting; no forecasting algorithm, threshold, or scoring rule changed.
- **2026-07-28** — Governance Amendment v1.1 adopted via ADR-0002 and formal Enterprise Change Control — an additive, threshold-preserving clarification for mathematically undefined forecast metrics under verified zero business activity.
- **2026-07-28** — Remediation Cycle 1: exhaustive, evidence-based investigation into the `FORECAST_QUALITY_MASE` gate failure; four independent engineering experiments found no viable fix within Phase A's approved scope; one real governance ambiguity identified.
- **2026-07-28** — Certification Run #1 executed under Certification Standard v1.0 — verdict `NOT_READY` (`FORECAST_QUALITY_MASE` and `HISTORICAL_METRICS_PERSISTED` gates failed on real, measured evidence).
- **2026-07-27 to 2026-07-28** — Sprints 1-4: Critical Safety Gates (`ADR-0001`, warehouse capacity + supplier-active checks), certification evidence infrastructure (WAPE/MASE persistence, observability metrics), the DGX 2.0 Certification Dataset v1, and the Certification Runner/Scorecard.

### AI Foundation

- **2026-07-27** — AI Foundation Certification Sprint: `AI_FOUNDATION_CERTIFIED` — every mandatory Retrieval Quality Gate passed on real, full-dataset evidence (Recall@1=0.986, MRR=0.988, Identifier Accuracy=1.000). See [`docs/ai-foundation-certification/final-report.md`](docs/ai-foundation-certification/final-report.md).
- Prior DGX prototypes (1 through 1.7.2) and the Data Consolidation / Data Readiness phases that preceded certification are recorded in full, with their own honest verdicts, in the [Phases](README.md#phases) section of the root README and their respective `docs/` decision logs — not restated here to avoid duplicating that record.

[Unreleased]: https://github.com/husseizo/GSL2026/compare/84a7f2e...HEAD
