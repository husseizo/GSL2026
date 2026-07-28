# AIOS Release Strategy

## Current state

This repository does not yet have a tagged release. This document defines the policy that will apply once releases begin — it does not itself create a release, and nothing here should be read as announcing one.

## Release channels

| Channel | Purpose | Stability expectation |
|---|---|---|
| **Development** (`main` branch) | Continuous integration of accepted, reviewed changes. | May contain work that has not yet passed a full regression suite for every service; not intended for any real business use. |
| **Release Candidate** (`vX.Y.Z-rc.N` tag) | A `main` snapshot proposed for stabilization ahead of a Stable release. | Full regression suite passing across `operational-core`, `dgx-ai-platform`, and `web-portal`; open for real-world validation, not yet declared Stable. |
| **Stable** (`vX.Y.Z` tag + GitHub Release) | A release candidate that has completed validation with no material regression found. | The version any real deployment should track. |
| **Hotfix** (`vX.Y.Z+1` off the last Stable tag) | A minimal, targeted fix for a real defect found in a released Stable version, backported without pulling in unrelated `main` changes. | Same stability bar as Stable; scope is deliberately narrow. |
| **LTS** (a Stable tag explicitly designated Long-Term Support) | A Stable release given an extended maintenance window (security/critical-fix backports only, no new features) for deployments that cannot track every release. | Designated explicitly per release, not automatic — see [Support Lifecycle](#support-lifecycle). |

## Versioning policy — Semantic Versioning

AIOS follows [Semantic Versioning 2.0.0](https://semver.org/) (`MAJOR.MINOR.PATCH`) once tagging begins:

- **MAJOR** — a breaking API contract change in `operational-core`'s public routes, a breaking schema migration that is not backward-compatible, or a Foundation-level architectural change.
- **MINOR** — a new, backward-compatible capability or feature (e.g. a new capability layer reaching a released maturity level), or an additive Certification Standard amendment.
- **PATCH** — a real bug fix, security fix, or documentation correction with no behavioral contract change.

**A capability's certification verdict is never part of its version number.** `DGX 2.0`'s certification status (`NOT_READY`, per the current [Baseline 1.0](execution/DGX2_PHASE_A_BASELINE_1_0.md)) is tracked independently of the repository's own release version — a repository version bump never implies a certification-status change, and vice versa.

## Tag strategy

- Tags are annotated (`git tag -a`), never lightweight, so each carries a real message and a verifiable signature where signing is configured.
- Tag format: `vMAJOR.MINOR.PATCH` for Stable, `vMAJOR.MINOR.PATCH-rc.N` for Release Candidates.
- Tags are created only from `main`, only after the full regression suite (`services/operational-core`: `npx tsc --noEmit`, `npm run lint`, `npm run test:all`) passes, and only for a commit that has already been merged — never force-pushed or moved after publication.

## GitHub Release process

1. Confirm the regression suite is green on the exact commit being tagged.
2. Create the annotated tag and push it.
3. Draft a GitHub Release from that tag, with release notes generated from [`CHANGELOG.md`](../CHANGELOG.md)'s corresponding section — never hand-written from memory.
4. Mark the release as a **Pre-release** if it is a Release Candidate; only a Stable tag is published as a full Release.
5. Link the release notes back to the relevant `docs/execution/` baseline or `docs/certification/` report if the release includes certification-relevant changes, so a reader can trace exactly what evidence backs the release.

## Support lifecycle

| Release type | Support window |
|---|---|
| Latest Stable | Full support — bug fixes, security fixes, new features via subsequent Minor/Major releases. |
| Previous Minor (non-LTS) | Security and critical-defect fixes only, until the next Minor release. |
| LTS | Security and critical-defect fixes only, for the explicitly stated LTS window on that release's own notes — no LTS window is assumed by default. |
| Anything else | Unsupported — upgrade to the latest Stable or the active LTS. |

## Relationship to certification and governance

A release tag is an **engineering packaging event** — it says "this exact commit passed the regression suite and is a coherent, deployable snapshot." It is not a certification event. A capability's real trust level (`NOT_READY` / `LIMITED_PILOT` / `PILOT_APPROVED` / `PRODUCTION_READY` / `ENTERPRISE_CERTIFIED`) comes only from a real, executed certification run against its own Certification Standard (see [`docs/certification/`](certification/)), independent of which repository version happens to be tagged at the time. Do not infer certification status from a release number, and do not infer a release's engineering quality from a certification verdict — they answer different questions.
