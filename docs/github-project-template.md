# GitHub Project Template — Recommendation

This document recommends a GitHub Projects (v2) board configuration for AIOS. **No project board, issue, or milestone has been created by this document** — it is a template recommendation for a maintainer to apply manually via the GitHub UI/API when ready.

## Columns (status field values)

| Column | Meaning | Exit criteria |
|---|---|---|
| **Backlog** | A real, captured idea/issue not yet reviewed. | Triaged by a maintainer. |
| **Architecture Review** | Requires Architecture Review per the Capability Governance Standard (§5) — typically anything using the [Architecture Proposal](../.github/ISSUE_TEMPLATE/architecture_proposal.md) template, or a Feature Request that expands an existing capability's scope. | Architecture Review completed; an ADR filed if the decision requires one. |
| **Approved** | Reviewed and accepted for implementation; not yet started. | Assigned and moved to Engineering. |
| **Engineering** | Actively being implemented. | A PR is open referencing this item. |
| **Verification** | PR open/merged; tests, lint, and regression suite passing; awaiting review sign-off. | Reviewer approval + green CI. |
| **Certification** | Only for items that affect a governed capability's certified status (e.g. anything touching DGX 2.0 gate logic) — requires a real certification-relevant review before being considered done. | Certification impact assessed and documented (does not necessarily require a full certification re-run — see `docs/certification/`). |
| **Released** | Merged to `main` (and, where relevant, included in a tagged release per [`docs/release-strategy.md`](release-strategy.md)). | Closed. |

Most items (bug fixes, documentation, small features) will skip **Architecture Review** and **Certification** entirely — those two columns exist specifically for the subset of work that touches a governed boundary, not as a mandatory pipeline for every change.

## Recommended labels

| Label | Meaning |
|---|---|
| `bug` | A real, reproducible defect. |
| `enhancement` | A new feature or improvement within approved scope. |
| `architecture` | Touches Foundation/Reference Architecture, Governance Standard, or a Certification Standard. |
| `documentation` | Documentation-only change. |
| `governance` | Requires Architecture Board / Approval Committee review per the Governance Standard. |
| `certification` | Affects a capability's certification gates, dataset, or scorecard. |
| `good first issue` | Well-scoped, low-context-required — suitable for a new contributor. |
| `help wanted` | Maintainers would welcome outside contribution on this. |
| `blocked` | Cannot proceed until a named dependency (linked issue/ADR/decision) resolves. |
| `wontfix` | Considered and explicitly declined, with the reason recorded in the issue. |

## Milestones

Recommend one milestone per planned release (per [`release-strategy.md`](release-strategy.md)'s versioning policy — e.g. `v0.1.0`), not per calendar period. A milestone's due date, if set, should reflect a real target, not an aspirational one — consistent with this repository's own "never fabricate a date" discipline.

## Workflow automation recommendations

Using GitHub Projects' built-in workflow automation (no custom Action required):

- **Item added to project** → default status `Backlog`.
- **Issue/PR closed** → status → `Released` (for PRs merged to `main`) or simply archived (for issues closed as not planned).
- **PR linked to an issue and opened** → move the linked issue to `Engineering` automatically.
- **PR review requested** → move to `Verification`.

Custom automation beyond GitHub's built-in project workflows (e.g. auto-moving an item to `Certification` based on changed file paths matching `services/operational-core/src/dgx2-certification/**`) is a reasonable future enhancement, implementable as a GitHub Action, but is not itself created by this document.

## Explicitly not done here

No issue, milestone, or project board was created as part of producing this recommendation — per the instruction not to create fake issues or synthetic project-management artifacts. A maintainer should apply this template deliberately, against real, current backlog items.
