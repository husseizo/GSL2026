# Contributing to AIOS

Thank you for your interest in contributing to AIOS. This document describes the workflow, conventions, and evidence-based discipline every change to this repository is expected to follow.

## Before you start

1. Read [`docs/architecture/AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md`](docs/architecture/AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md) — the permanent engineering constitution every contributor must understand first, regardless of which module you touch.
2. Read the [Current Program Status](README.md#current-program-status) so you know what is certified, closed, or still conceptual before proposing a change.
3. If your change touches a capability under active governance (e.g. DGX 2.0 Demand Forecasting), read that capability's specification and certification standard under [`docs/capabilities/`](docs/capabilities/) and [`docs/certification/`](docs/certification/) first.

## Non-negotiables

These apply to every contribution, without exception — see the root [README](README.md#non-negotiables-unchanged-since-phase-1) for the full list. In short:

- The Operational Core (PostgreSQL) is the sole system of record.
- No automatic merges of uncertain data matches — a human always approves.
- No AI capability executes a financial or inventory-mutating transaction directly.
- Unavailable infrastructure is reported honestly, never faked.
- No KPI or test result is ever reported as "improved" without a real, versioned baseline and a real later comparison run.

## Frozen and governed artifacts — do not edit without the matching process

The following require a formal process before they may change, and must never be edited casually as part of an unrelated pull request:

| Artifact | Required process |
|---|---|
| `docs/execution/DGX2_PHASE_A_BASELINE_1_0.md` and any other frozen baseline | Immutable historical record — never edited. A new baseline is a new file. |
| Certification reports and datasets (`docs/certification/reports/`, `docs/certification/datasets/`) | Generated only by a real, executed certification run — never hand-edited. |
| Foundation/Reference Architecture, Capability Governance Standard, Enterprise Roadmap | Changes require an [ADR](docs/adr/README.md) and, where the change affects certification, Architecture Board review. |
| Certification Standards (e.g. `DGX2_DEMAND_FORECASTING_CERTIFICATION_STANDARD_V1.md`) | Amended only additively, via a dedicated Amendment document and formal governance approval — never rewritten in place. |

## Development workflow

1. **Fork/branch** from `main`.
2. **Make your change**, following the existing module's conventions (see the relevant `docs/architecture/` doc for that phase/module).
3. **Add or update tests.** `services/operational-core` uses Jest (`npm run test` for unit, `npm run test:integration` for real-Postgres integration tests) — see [`services/operational-core/README.md`](services/operational-core/README.md).
4. **Run the full check before opening a PR**:
   ```bash
   cd services/operational-core
   npx tsc --noEmit
   npm run lint
   npm run test:all
   ```
5. **Open a Pull Request** using the [PR template](.github/PULL_REQUEST_TEMPLATE.md) — it will prompt you for exactly the evidence a reviewer needs.
6. **Documentation changes** (architecture, governance, certification-adjacent docs) go through the same PR process; see [Documentation Quality](#documentation-quality) below.

## Documentation quality

- Use consistent terminology with the rest of the corpus (e.g. "DGX 2.0 Demand Forecasting," "Phase A," "Baseline 1.0," "NOT_READY," "Manual operational model" — not paraphrased variants).
- Use relative links between documents in this repository; verify they resolve before opening a PR.
- Historical documents (decision logs, frozen baselines, certification reports) are never rewritten to reflect later events — see the frozen-artifact table above.
- A markdown-lint and link-check GitHub Action runs on documentation changes (see [`.github/workflows/`](.github/workflows/)) — please fix any failure it reports rather than suppressing it.

## Reporting issues

Use the [issue templates](.github/ISSUE_TEMPLATE/) — Bug Report, Feature Request, Architecture Proposal, or Question — so your report includes the information needed to act on it.

## Code of Conduct

Participation in this project is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Do not open a public issue for a security vulnerability — see [SECURITY.md](SECURITY.md) for responsible disclosure.

## Questions

See [SUPPORT.md](SUPPORT.md).
