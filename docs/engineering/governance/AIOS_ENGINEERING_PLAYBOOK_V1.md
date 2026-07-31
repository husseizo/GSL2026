# AIOS Engineering Playbook V1

## Status: PERMANENT ENGINEERING STANDARD — DERIVED FROM PEP-1 THROUGH PEP-4

---

## Document Control

| Field | Value |
|---|---|
| Document | AIOS Engineering Playbook, Version 1 |
| Issuing authority | AIOS Engineering Excellence Board (AEEB) / AIOS Chief Architecture Office |
| Derived from | The complete, real execution record of the Platform Remediation programme (PEP-1 through PEP-4) — every standard below is extracted from something that actually happened in this repository, not aspirational best practice |
| Effective date | 2026-07-31 |
| Companion document | `docs/engineering/governance/PROGRAMME_RETROSPECTIVE_PEP1_TO_PEP4.md` (the evidence this playbook is built from) |

**This document is the permanent engineering standard for all future AIOS engineering programmes. It does not implement, modify, or authorize any production code, test, or configuration. Every future programme (including PEP-5 and beyond) is expected to follow it, unless a specific, documented exception is granted.**

---

## 1. Engineering Principles

1. **Evidence over assertion.** No claim about repository state, test coverage, or behavior is accepted without direct, reproducible evidence — a `git log`, a fresh test run, a direct file read. This programme never accepted a prior task's own self-report as sufficient for closure.
2. **Scope is a contract, not a suggestion.** Every phase names, in advance, exactly which files may change and which may not. Deviation requires new evidence and explicit re-authorization, not silent expansion.
3. **Right-size governance to actual risk.** A three-controller migration with an independently-rated "High" regression risk (PEP-3) warrants sequential work packages with individual rollback boundaries. A single, undifferentiated test-coverage addition (PEP-4) does not — and forcing it into that shape would be governance theater, not rigor.
4. **Nothing is verified by the hand that built it.** Every implementation is followed by an independent verification pass that reproduces evidence fresh, not one that re-reads the implementer's own report.
5. **Preserve, don't guess, backward compatibility.** Every migration in this programme identified the *exact* pre-existing behavior (down to which role could call which endpoint) before changing the mechanism, and treated any behavioral delta as something to explain and approve, never something to discover after the fact.
6. **Real behavior beats simulated behavior in tests.** Prefer exercising the actual framework (a real `Reflector` reading real decorator metadata) over a hand-rolled mock that re-implements the logic under test.

---

## 2. Engineering Lifecycle

Every phase in this programme followed the same four-stage lifecycle, and every future phase is expected to as well:

```
Readiness & Scope Lock
        ↓
Implementation (one or more work packages)
        ↓
Independent Verification
        ↓
Governance Closure
```

- **Readiness & Scope Lock**: a planning-only document, produced *before* any implementation, that inspects the actual repository state, defines exactly what is in and out of scope, and issues a GO / GO WITH CONDITIONS / NO-GO decision. It authorizes nothing by itself.
- **Implementation**: one or more work packages, each scoped to a single authorized file set, each independently regression-tested before the next begins.
- **Independent Verification**: a fresh re-inspection of the completed implementation, performed as if the implementer's own report might be wrong, producing its own GO/NO-GO recommendation.
- **Governance Closure**: commits the verification evidence, tags the milestone, updates the living governance/status tracker, and formally ends the phase. It authorizes nothing beyond itself — a new phase requires its own new Readiness & Scope Lock.

**No stage may be skipped, merged, or reordered.** PEP-3 and PEP-4 both followed this lifecycle in full; both are the reference implementations for future programmes to imitate.

---

## 3. Quality Gates

Before any commit in an implementation work package, verify:

- `git status --short` and `git diff --stat` show only the files this phase's own scope authorizes — no unrelated file, however small, is swept in.
- The full repository test suite passes (100%, zero new failures beyond an explicitly named, pre-approved exception).
- `tsc --noEmit` reports zero errors.
- `eslint` (the real, full glob the project's own lint script uses — not a narrowed, changed-files-only pattern) reports zero errors and zero warnings.
- The project actually builds (`npm run build` / equivalent), not merely type-checks — `tsc --noEmit` alone does not prove the project compiles to a working artifact.
- No schema, migration, or API surface changed unless the phase's own scope explicitly authorizes it.

**These gates are non-negotiable and apply identically whether the change is "just a test file" or a production migration** — PEP-4's test-only work package was held to the same gates as PEP-3's controller migrations.

---

## 4. Evidence Requirements

- **Every factual claim in a report must be traceable to a command or a file read**, not to memory or inference. "Confirmed by direct read of `role-permissions.ts`, lines 140-155" is evidence; "should be fine" is not.
- **Git history is authoritative for scope claims.** `git log --oneline -- <file>` is the correct way to prove a file was, or was not, touched by a given phase — not a description of intended scope.
- **A grep result is a lead, not a conclusion.** This programme found, and corrected before publishing, at least one case where an unquoted grep pattern matched unrelated code (`this.parts.create(dto)`, a service method call, mistaken for the permission string `'parts.create'`). Always inspect the actual matched line before citing a grep as proof.
- **Negative claims need evidence too.** "No role gained access" is only a real claim once every affected role's actual permission array has been read, not merely the `@Roles(...)` list that was replaced.
- **Independent verification must reproduce, not repeat.** Re-running the test suite and re-reading the diff is verification; re-stating the implementer's own numbers is not.

---

## 5. Testing Standards

- **New authorization/guard logic must be tested against real framework wiring** wherever practical: a real `Reflector`, real decorator metadata on real or minimal fixture classes, a real guard instance — not a mock of the guard's own internal branches.
- **Every migrated or newly-tested code path must cover**: the granted case, the denied case, missing authentication, authenticated-but-unauthorized, any documented privileged-role behavior (administrator/owner), and — where relevant — decorator/metadata precedence (e.g., method-level overriding class-level).
- **A claim about framework behavior should be provable by the test suite itself**, not just asserted in a comment. This programme's `roles.guard.spec.ts` proved (not merely stated) that NestJS's `Reflector.getAllAndOverride` uses override, not merge, semantics — the relevant test would have failed if that claim were false.
- **Known, non-blocking test gaps must be recorded, and actually closed when a phase's scope allows it.** PEP-1 flagged an untested API-key success path as a future hardening item; PEP-4 closed it. A flagged gap that is never revisited is a process failure, not a acceptable permanent state.
- **Regression evidence is cumulative, not phase-local.** Each phase's closure should re-run and re-cite the full suite, not just the tests it added.

---

## 6. Architecture Review Standards

- **Before migrating multiple similar components (e.g., several controllers), verify cross-component consistency directly** — same guard, same decorator form, same import paths, same naming convention — via a side-by-side comparison performed fresh, not assumed from having written all of them.
- **Confirm dependency direction explicitly whenever an authorization or architecture-layer boundary changes.** A "lateral swap" (e.g., from one guard to a sibling guard in the same layer) is architecturally sound; a new dependency edge crossing an established boundary is not, and must be justified in writing if it occurs.
- **Treat an existing, already-adopted pattern elsewhere in the codebase as the reference implementation**, not a coincidence. This programme found `IntegrationAdaptersController` already using the target `PermissionsGuard`/`@RequirePermissions` pattern before any controller migration began — direct, corroborating evidence the target architecture was sound and already proven, not speculative.

---

## 7. Documentation Standards

Every phase produces a fixed set of documents, each with a distinct, non-overlapping purpose:

| Document type | Purpose | Written by |
|---|---|---|
| Readiness & Scope Lock | Defines what a phase will and will not do, before it begins | Planning stage |
| Implementation Report | Records exactly what changed and why, per work package | Implementation stage |
| Independent Verification | Re-confirms the implementation with fresh evidence | Verification stage |
| Governance Closure record (tag + status-tracker update) | Marks the phase formally done | Closure stage |
| Programme Retrospective / Playbook (this document's own type) | Converts multi-phase experience into a standing standard | End of a programme, not every phase |

- Every document must state, near its top, what it is **not** (e.g., "does not authorize implementation," "does not modify production code") — this convention prevented scope confusion at every stage of this programme.
- A later document may add an **addendum** to an earlier one (e.g., a "Program Status" table appended to an execution plan) without ever altering that earlier document's original scope-defining text — this preserves the original artifact as a historical record while still keeping status current.

---

## 8. Repository Standards

- `git status --short` and `git diff --stat` must be checked immediately before every commit, without exception, even for a single-file, low-risk change.
- Only stage the exact files a phase's authorized scope names — never `git add -A` or `git add .` inside an active engineering task.
- A clean working tree at the start and end of every task is itself evidence, not merely a convenience — an unexpectedly dirty tree is a signal to stop and investigate, never to `git checkout --` away without understanding why first.
- Build artifacts (`dist/`, etc.) generated by a verification step (e.g., running `npm run build` to confirm the project compiles) must be confirmed `.gitignore`d, not merely assumed to be.

---

## 9. Rollback Standards

- Every implementation report must state its own rollback boundary explicitly, in terms of exactly which files revert and why no other file is affected — not merely "this can be reverted."
- Rollback boundaries should be **as small as the actual regression risk allows**: PEP-3's per-controller rollback boundary let any one of three controllers revert without touching the other two; PEP-4's single-work-package rollback boundary was appropriately just as small, since its scope was inherently one unit.
- A rollback boundary claim ("no production file depends on this") must be backed by a repository-wide search for real usages, not assumed from the file's own apparent purpose.

---

## 10. Release Governance

- **A milestone tag marks the end of a phase, not a convenience checkpoint.** Use annotated tags (`git tag -a`), with a message citing the real evidence (verification report path, test counts) — not a bare lightweight tag with no context.
- **A tag is created at the commit where independent verification's evidence was recorded**, not necessarily the latest commit at the time of tagging — later, unrelated governance-document commits do not retroactively move the tag.
- **Every phase requires its own, separate implementation authorization.** Completing a Readiness & Scope Lock, or even an Independent Verification recommending GO, does not itself authorize the next phase or the next work package — a distinct, explicit authorization must be issued each time.
- **Governance-status updates belong in a living tracker (an addendum), not scattered edits across static, point-in-time authorization documents** — this programme deliberately updated an execution plan's own status addendum rather than editing a separate, more consequential governance-closure-program gate table whose implications extended well beyond the phase being closed.

---

## 11. Code Review Expectations

- A reviewer (human or independent-verification task) must re-derive every load-bearing claim, not sample-check it — this programme's independent verifications re-ran the full test suite, re-read every changed file, and re-executed `git log` per file, every time.
- A reviewer must be suspicious of scope creep phrased as helpfulness — e.g., "while I was in there I also cleaned up X" is a finding to flag, not a bonus to praise, unless X was itself part of the authorized scope.
- A reviewer must verify negative claims (e.g., "no role gained access," "RolesGuard has zero real callers") with an actual, fresh, repository-wide search — never accept them as self-evidently true from the nature of the change.

---

## 12. Definition of Done

A work package, phase, or programme is done only when **all** of the following hold simultaneously:

- Every objective its own approved scope defines is satisfied — confirmed by direct evidence, not by intent.
- The full regression suite passes, with zero new failures beyond any explicitly named, pre-approved exception.
- The project builds, type-checks, and lints cleanly.
- The repository diff is confined entirely to the authorized file set.
- An independent verification pass has reproduced the above with fresh evidence and returned GO.
- A governance closure record (commit, and where warranted, a milestone tag) exists.
- Rollback remains genuinely possible and has been described in concrete, file-level terms.

---

## 13. Engineering Anti-Patterns

Observed, named, and to be actively avoided in future programmes:

- **Trusting a grep without reading the matched line.** A pattern that looks specific (`parts.create`) can silently match an unrelated method call (`this.parts.create(dto)`) if not anchored to how the string actually appears in source (e.g., as a quoted literal).
- **Treating "no COMMIT section in the task" as ambiguous rather than as a signal.** When a task's own instructions omit a commit/push section that every sibling task includes, the correct default is to leave the work uncommitted pending an explicit, later authorization — not to guess that a commit was implied.
- **Subdividing a phase into work packages by habit rather than by risk.** Not every phase needs a PEP-3-style multi-package structure; forcing one where the underlying risk doesn't warrant it adds governance overhead without adding safety.
- **Letting a "non-blocking observation" go unaddressed indefinitely.** A flagged gap that survives three subsequent phases without being revisited is a process failure waiting to happen, even if each individual phase's own scope was legitimately narrower.
- **Editing the most convenient existing document instead of the correct one.** A "governance closure" instruction to "update the roadmap/tracker" should prompt an actual search for the right, already-existing artifact (as this programme did, finding the Execution Plan's own status table was the correct home, and explicitly avoiding a more consequential gate-status document whose edit would have implied a bigger, unauthorized governance decision).
- **Mocking away the very framework behavior a test is supposed to prove.** A guard test that mocks `Reflector.getAllAndOverride` directly cannot prove real decorator/guard wiring works — only that the mock does what it was told to do.

---

## 14. Continuous Improvement Process

- Every programme (a run of related phases sharing one Technical Specification, like PEP-1 through PEP-4) concludes with a Programme Retrospective and, where warranted, an update to this Playbook — not merely a final status report.
- A Playbook update is warranted when a programme surfaces a **new, real, evidence-backed lesson** — not on a fixed schedule, and not to pad the document with restated generalities.
- Every future programme's Readiness & Scope Lock should explicitly confirm it has reviewed the current version of this Playbook and note any deliberate deviation, with justification, rather than silently diverging from it.
- This Playbook is versioned (`_V1`, and future `_V2`, etc.) — a new version is warranted by a materially new lesson from a future programme, not by cosmetic rewording of this one.

---

*End of AIOS Engineering Playbook V1.*
