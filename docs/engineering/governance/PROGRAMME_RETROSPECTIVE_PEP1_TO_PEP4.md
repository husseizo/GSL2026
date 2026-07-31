# Programme Retrospective — PEP-1 through PEP-4

## Status: RETROSPECTIVE COMPLETE — ENGINEERING AUDIT, NOT A CELEBRATION

---

## Document Control

| Field | Value |
|---|---|
| Document | Programme Retrospective, PEP-1 through PEP-4 |
| Issuing authority | AIOS Engineering Excellence Board (AEEB) / AIOS Chief Architecture Office |
| Companion document | `docs/engineering/governance/AIOS_ENGINEERING_PLAYBOOK_V1.md` (the standard this retrospective's evidence produced) |
| Effective date | 2026-07-31 |

**This is an engineering audit of what actually happened across PEP-1 through PEP-4, grounded entirely in repository evidence — commits, test counts, and direct file inspection. It is not a summary written to reassure; where a mistake or near-miss occurred, it is named here.**

---

## 1. Executive Summary

The Platform Remediation programme (PEP-1 through PEP-4) closed a real, previously-identified authorization gap — a non-rejecting global JWT guard, an unverified header trusted as identity, and three controllers still gated by a legacy mechanism that never consulted a verified actor — across four independently-verified, independently-governed phases, without a single schema change, a single new API endpoint, or a single business-logic modification anywhere in the programme. The engineering process itself matured visibly across the four phases: PEP-1 and PEP-2 were single, low-risk commits with lightweight closure; PEP-3 introduced formal readiness-locking (which caught a real naming discrepancy before it could propagate) and risk-proportionate work-package subdivision; PEP-4 correctly recognized that its own smaller scope did not warrant repeating PEP-3's heavier structure. The repository's test suite grew from 104 suites/698 tests to 109 suites/832 tests, with zero regressions recorded at any point and two annotated milestone tags marking the programme's two most structurally significant closures.

---

## 2. Timeline

| Phase | Commit(s) | What changed | Verified by | Closed |
|---|---|---|---|---|
| PEP-1 | `6e0114c` | `jwt-auth-context.guard.ts`: stop silently discarding a presented-but-invalid credential, conditional on the resolved handler already requiring a permission/role | `DGX3_PEP1_VERIFICATION_AND_PHASE_CLOSURE.md` | Yes |
| PEP-2 | `814a4d0` | `permissions.guard.ts` + new `require-verified-actor.decorator.ts`: additive, opt-in `@RequireVerifiedActor()` mechanism | `DGX3_PEP2_VERIFICATION_AND_PHASE_CLOSURE.md` | Yes |
| PEP-3 | `cd448ee`, `d75706f`, `97f1f39`, `d87590a` | `permission.ts`/`role-permissions.ts` extended; `integration`/`parts`/`vehicles` controllers migrated `RolesGuard`→`PermissionsGuard` | `PEP3_INDEPENDENT_VERIFICATION.md` (`b9533ab`) | Yes — `f17d192`, tag `pep3-complete` |
| PEP-4 | `69c2ccc` | New `roles.guard.spec.ts`; 2 additive tests in `jwt-auth-context.guard.spec.ts` | `PEP4_INDEPENDENT_VERIFICATION.md` (`7cc8d77`) | Yes — `47d2cab`, tag `pep4-complete` |

---

## 3. Major Engineering Decisions

- **Decision: migrate controllers one at a time (PEP-3), not together.** Driven directly by the Technical Specification's own "High" risk rating for combined-controller change. Verified correct in hindsight — each controller's regression suite was checked independently, and no cross-controller issue ever arose that a combined migration might have obscured.
- **Decision: treat the "PEP-3A" label as referring to the already-approved "PEP-3," but flag the discrepancy rather than silently substituting it.** The readiness-lock step found zero repository documents using the literal label "PEP-3A" — the real, approved phase was named "PEP-3" everywhere else. Rather than blocking outright or silently assuming equivalence, the discrepancy was documented as an explicit condition requiring Program/Governance Board confirmation, while proceeding on the most defensible reading. The condition was later formally resolved by the Governance Board before implementation began.
- **Decision: execute PEP-4 as a single work package, not a multi-package structure like PEP-3.** Made explicitly during PEP-4's own independent readiness review, on the grounds that PEP-4's scope (one new test file, one review step) had no independent per-component risk to justify subdivision — a deliberate rejection of copying PEP-3's structure by default.
- **Decision: accept the `OWNER` role gaining access on every migrated endpoint as an approved exception, not a defect.** `OWNER` already held every permission platform-wide via a pre-existing `ROLE_PERMISSIONS` spread; `RolesGuard` had simply never consulted that map. This was identified once, in the Technical Specification's own mapping table, and then consistently re-confirmed and re-tested identically across all three controller migrations and the final regression consolidation — never re-litigated as a fresh surprise.
- **Decision: update the Engineering Execution Plan's own status addendum for governance tracking, not the separate, more consequential Governance Closure Program's gate table.** The latter's `GATE-SEC-002` entry has direct implications for DGX 3.0 Engineering Authorization eligibility — a decision outside this programme's own narrow scope. Editing the Execution Plan's own addendum recorded PEP-3/PEP-4 completion accurately without making an implicit, unauthorized claim about a much larger governance question.

---

## 4. Major Technical Achievements

- Closed the "verified JWT is never consulted" gap on all three previously `RolesGuard`-gated controllers, unifying every controller in the repository onto a single authorization path (`PermissionsGuard` + `getRequestActor()`).
- Added 134 new tests across the programme (7 + 6 + 21 + 34 + 39 + 22 + 12) without a single regression in any pre-existing test at any phase.
- Closed a real, previously-known testing gap (`RolesGuard` had zero dedicated unit tests since before this programme began) using real, unmocked framework wiring rather than simulated guard logic.
- Closed a second, smaller, previously-documented gap (the untested valid-API-key success path in `jwt-auth-context.guard.spec.ts`), three phases after it was first flagged as non-blocking.
- Delivered the entire programme with zero Prisma schema changes, zero new migrations, and zero new API endpoints — matching every phase's own explicit, repeatedly-restated scope boundary.

---

## 5. Lessons Learned

**Technical**: NestJS's `Reflector.getAllAndOverride` uses override, not merge, semantics between class-level and method-level decorator metadata — a fact this programme didn't just assert but empirically proved via a test that would have failed under the opposite assumption. Puppeteer's `executablePath()` became asynchronous in a version bump the pinned `mermaid-cli` peer dependency silently resolved to — a real API-compatibility lesson from the parallel documentation-CI work this same session also handled, worth remembering whenever a peer-dependency range is left unpinned.

**Architectural**: A "lateral swap" between two guards in the same authorization layer (`RolesGuard` → `PermissionsGuard`) is a safe, low-risk migration precisely because it doesn't cross an established dependency boundary — confirmed, not assumed, by checking that `src/common/permissions/` never imports from the migrated controllers' own directories.

**Testing**: Testing real decorator/guard interaction (real `Reflector`, real `@Roles`/`@RequirePermissions` on real or fixture classes) catches things a mocked-guard test cannot — this programme's strongest, most convincing evidence came from tests that exercised genuine framework behavior, not simulated logic.

**Verification**: A verification pass is only as strong as its willingness to re-derive, not re-read, the implementer's own claims. Every independent verification in this programme re-ran the test suite and re-executed `git log` fresh rather than trusting the prior report's own numbers — and this discipline is what makes "no scope creep occurred" a checked fact rather than a repeated assertion.

**Governance**: A readiness-lock step that inspects real repository/document state before implementation begins catches real discrepancies (the "PEP-3A" label) that would otherwise only surface much later, if at all.

**Documentation**: An addendum appended to an existing document, clearly marked as such, is a safer way to record evolving status than either editing the original scope text or scattering status updates across unrelated files.

**Risk management**: Governance structure should scale with actual, named risk (a Technical Specification's own risk rating), not with precedent alone — PEP-4 explicitly declined to copy PEP-3's multi-work-package structure once its own readiness review established the underlying risk didn't warrant it.

**Repository management**: `git status --short` and `git diff --stat`, checked immediately before every single commit — even a one-file test addition — caught zero actual scope violations across this entire programme, precisely because it was never skipped.

---

## 6. Risks Encountered

- **Naming/label ambiguity** ("PEP-3A" vs. the approved "PEP-3") — could have caused an entire phase's evidence trail to be filed under a label no other document recognized, breaking traceability.
- **Evidence-tooling false positives** — an unquoted grep pattern during WP-3.0's own verification initially, incorrectly, flagged unrelated method calls (`this.parts.create(dto)`, a service call; `prisma.vehicle.create()`, an ORM call) as if they referenced the new permission string literals.
- **A documented, non-blocking gap persisting across multiple phases** — the untested API-key success path was flagged at PEP-1's own closure and not actually closed until PEP-4, three phases later.
- **Combined-controller regression risk** — the Technical Specification's own "High" rating for PEP-3, mitigated by strict sequential migration.
- **Scope creep via "helpful" governance-document edits** — the temptation to update the broader, more consequential `DGX3_GOVERNANCE_CLOSURE_PROGRAM_1.md` gate table (with implications for DGX 3.0 Engineering Authorization) while merely trying to "mark PEP-3 as done."

---

## 7. Risk Mitigations

| Risk | Mitigation applied | Did it work? |
|---|---|---|
| Naming/label ambiguity | Readiness-lock explicitly searched for and reported the literal absence of "PEP-3A" anywhere in the repository, before treating it as equivalent to "PEP-3," and flagged it as a condition requiring Board confirmation | **Yes** — confirmed later; no traceability break occurred |
| Grep false positives | Every grep-based claim was followed by directly reading the matched lines before being cited as evidence; the incorrect match was caught and corrected before the report was finalized | **Yes** |
| Long-lived non-blocking gap | Each phase's readiness review explicitly re-surfaced still-open, previously-flagged observations rather than letting them silently age out of visibility | **Yes**, eventually — though three phases is longer than ideal (see §10) |
| Combined-controller regression risk | Strict, enforced per-controller sequencing (WP-3.0→3.3), each with its own full regression pass before the next began | **Yes** — zero cross-controller regression occurred |
| Scope creep via governance-doc edits | Deliberately chose the narrower, already-existing Execution Plan addendum over the broader gate-table document, explicitly reasoning through which document's edit would and wouldn't imply a bigger, unauthorized claim | **Yes** |

---

## 8. Metrics

| Metric | PEP-1 close | PEP-2 close | PEP-3 close | PEP-4 close |
|---|---|---|---|---|
| Test suites | 104 | 104 | 108 | 109 |
| Tests | 698 | 704 | 820 | 832 |
| Milestone tags | 0 | 0 | 1 (`pep3-complete`) | 2 (`pep4-complete` added) |
| Independent verification documents | 1 | 1 | 1 | 1 |
| Schema/migration changes | 0 | 0 | 0 | 0 |
| New API endpoints | 0 | 0 | 0 | 0 |
| Production files touched (cumulative, this programme) | 1 | 1 (+2 new) | +5 (2 data files, 3 controllers) | 0 (test-only) |

**Programme-wide totals**: 9 real implementation/closure commits; 134 net new tests; 2 annotated milestone tags; 0 schema changes; 0 new endpoints; 0 unresolved regressions at any point.

---

## 9. What Should Continue

- The four-stage lifecycle (Readiness → Implementation → Independent Verification → Governance Closure), applied without exception.
- Risk-proportionate work-package sizing, decided fresh each phase rather than copied from the previous one.
- Real, unmocked framework behavior in authorization/guard tests.
- Fresh, reproduced evidence in every independent verification — never re-stating a prior report's numbers.
- Annotated milestone tags citing real evidence at every structurally significant closure.
- Explicit, written reasoning about which existing governance document is the *correct* one to update, rather than defaulting to the most convenient.

---

## 10. What Should Change

- **Close known, non-blocking gaps faster.** The API-key test-coverage gap took three phases to close after being flagged. Future programmes should consider giving each phase's readiness review an explicit prompt to re-surface *all* still-open prior observations, not just the ones directly relevant to that phase's own scope, and to close cheap ones opportunistically even when not strictly required.
- **Anchor grep-based evidence to exact string literals from the first attempt**, not as a correction after an initial, looser search — the pattern that eventually worked (`'exact.string'` with quotes) should be the default starting pattern for this class of check, not a fallback.
- **Consider a lighter-weight escalation path for label/naming discrepancies** that doesn't require a full Board confirmation cycle when the correct reading is unambiguous from context — the "PEP-3A" resolution worked, but added a full round-trip for what turned out to be a simple labeling clarification.

---

## 11. Recommendations

1. Adopt `docs/engineering/governance/AIOS_ENGINEERING_PLAYBOOK_V1.md` as the binding standard for all future engineering programmes.
2. Require every future phase's Readiness & Scope Lock to explicitly confirm it has reviewed the current Playbook version.
3. Track the programme's own still-open items (`RolesGuard`/`roles.decorator.ts` removal decision; absence of a dedicated backend CI workflow) as standing, named governance items with an owner, not as passive footnotes repeated in each new document.
4. When a phase's own readiness review flags a "non-blocking" gap, require the next phase's readiness review to explicitly state whether it will or will not close that gap, rather than allowing it to be silently omitted again.

---

## 12. Future Programme Guidance

Any future engineering programme (PEP-5 or otherwise) must:

- Begin with its own, separate Readiness & Scope Lock, produced fresh — not inherited or assumed from this programme's closure.
- Explicitly confirm this Playbook has been reviewed and is being followed, noting any deliberate, justified deviation.
- Size its own work-package structure to its own Technical Specification's actual risk rating, not to this programme's precedent by default.
- Re-surface, and decide explicitly what to do about, this retrospective's still-open items (§10) rather than starting from a blank slate.

**This retrospective and the accompanying Playbook do not authorize PEP-5 or any future programme.** A separate, future Readiness & Scope Lock is required before any further implementation work may begin.

---

*End of Programme Retrospective, PEP-1 through PEP-4.*
