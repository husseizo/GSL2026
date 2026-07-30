# Documentation CI Runtime Remediation #1

## Status: RUNTIME REMEDIATION — MERMAID CONTENT AND VALIDATOR LOGIC UNCHANGED

---

## Document Control

| Field | Value |
|---|---|
| Document | Documentation CI Runtime Remediation #1 |
| Follows from | `DOCUMENTATION_CI_ROOT_CAUSE_INVESTIGATION_1.md`; `DOCUMENTATION_CI_OBSERVABILITY_REMEDIATION_1.md` |
| Modified files | `.github/workflows/docs-mermaid-check.yml`; `scripts/ci/validate-mermaid-blocks.py`; new `scripts/ci/chromium-smoke-test.cjs` |
| Effective date | 2026-07-30 |

**This document records a CI runtime change only. No Mermaid diagram, no documentation content, and no pass/fail validation logic was altered — a block still fails if and only if `mmdc` exits non-zero. What changed is making the runtime Chromium actually able to launch on the GitHub-hosted Ubuntu runner, deterministically, before the real validator ever runs.**

---

## 1. Confirmed Runtime Cause

The observability remediation's very first real CI run exposed the true, previously-hidden failure for all 10 blocks, verbatim from the live check-run annotation:

```text
Error: Failed to launch the browser process:  Code: null
```

This is the canonical Puppeteer/Chromium launch-failure signature — Chromium is not rendering incorrectly or rejecting the diagrams; it never starts at all. This is not a Mermaid syntax, encoding, CRLF, extraction, or `mermaid-cli` version problem — all four were independently ruled out by direct evidence in the prior investigation.

---

## 2. Runner Environment

| Property | Value |
|---|---|
| Runner | `ubuntu-latest` (GitHub-hosted) |
| Ubuntu/OS release | Captured by the new "Stage 1 — Runtime diagnostics" workflow step via `cat /etc/os-release` — printed fresh on every run rather than assumed, since GitHub periodically updates what `ubuntu-latest` points to |
| Node.js | Provisioned by `actions/setup-node@v4` at `node-version: "20"`; exact resolved version printed by the same diagnostics step |
| npm | Whatever ships with that Node install; exact version printed by the same step |

---

## 3. Chromium and Puppeteer Resolution

Directly confirmed (this investigation, and the prior one): `@mermaid-js/mermaid-cli`'s own pinned version (`11.16.0`) does **not** pin its `puppeteer` dependency — `puppeteer` is declared only as a peer dependency (`"puppeteer": "^23 || ^24 || ^25"`), so a fresh `npm install -g` resolves it, and the Chromium build it bundles, to whatever is npm's absolute latest at that moment. Confirmed locally: this resolved to **puppeteer 25.4.0**. The exact Chromium executable path mermaid-cli's own bundled Puppeteer resolves to is obtained via `require(<puppeteer-dir>).executablePath()` — the identical resolution method both the new diagnostics step and the new smoke test use, guaranteeing they test the exact same binary `mmdc` itself would launch.

---

## 4. Missing Dependency or Launch Analysis

"Failed to launch the browser process: Code: null" is the textbook symptom of Chromium's dynamic linker failing to resolve one or more required shared libraries on a minimal or unprepared Linux host — Puppeteer/Google's own troubleshooting guidance for headless Chrome on Debian-based systems lists a specific, well-documented set of runtime packages for exactly this scenario. This repository's own CI evidence gathering (the new "Stage 1" diagnostics step, `ldd` against the resolved Chromium binary) is what confirms, on the actual runner and on every future run, whether libraries are in fact missing — rather than assuming a fixed list applies forever. See §12 for how to read that evidence on the next run.

---

## 5. Runtime Remediation Applied

Five ordered steps were added to `.github/workflows/docs-mermaid-check.yml`, all before the existing (unmodified) validator step:

1. **Pin the Puppeteer peer dependency explicitly**, inside `mermaid-cli`'s own nested `node_modules` (where `mmdc` actually resolves it from) — `npm install puppeteer@25.4.0 --no-save` run from within `$(npm root -g)/@mermaid-js/mermaid-cli`.
2. **Stage 1 — Runtime diagnostics (before)**: prints Node/npm/`mmdc` versions, `/etc/os-release`, the resolved Puppeteer version, the resolved Chromium executable path, its existence/permissions (`ls -la`), `file`, `stat`, `ldd` (explicitly showing any "=> not found" shared library), and a direct `--version` invocation attempt.
3. **Stage 2 — Install Chromium's documented Ubuntu/Debian runtime dependencies**: the specific, named, officially-documented package list for headless Chrome on Debian-based systems (`ca-certificates`, `libnss3`, `libatk-bridge2.0-0`, `libgbm1`, `libasound2`/`libasound2t64`, `libx11-6`, and the rest of that same well-known list — see the workflow file for the exact, complete enumeration), installed one package at a time with `--no-install-recommends`, tolerating (logging, not aborting on) any single package name that does not exist under that exact name on the current runner's Ubuntu release.
4. **Stage 1 (repeat) — confirm resolution**: re-runs `ldd` against the same Chromium binary and explicitly checks for any remaining "not found" library, emitting a `::warning::` if any remain.
5. **Browser launch smoke test**: `node scripts/ci/chromium-smoke-test.cjs` — resolves the exact same Chromium binary, attempts a plain sandboxed launch, falls back to `--no-sandbox`/`--disable-setuid-sandbox` only if that fails, opens a blank page, closes cleanly, and **fails the job here** (no `continue-on-error`) if neither attempt succeeds — deliberately not letting the workflow proceed to repeat the same opaque failure one step later.

Only after all five steps succeed does the existing, byte-for-byte-unchanged validator invocation (`python3 scripts/ci/validate-mermaid-blocks.py`) run.

---

## 6. Why the Remediation Is Minimal

- The dependency list installed is the specific, named, officially-documented set for this exact, well-known failure class — not an arbitrary large bundle. It is installed with `--no-install-recommends` to avoid pulling in anything beyond the named packages themselves.
- No system Chromium package is installed, and no alternative browser is substituted — the existing, already-bundled Puppeteer/Chromium (the one `mermaid-cli` already ships with) is made to work, rather than replaced.
- The sandbox is not disabled unconditionally — the smoke test always tries the properly sandboxed launch first, and only falls back if that specific attempt fails (see §8).
- The only script change is a single, additive function (`resolve_mmdc_extra_args()`) and a one-line change to how the `mmdc` command list is built (`+ resolve_mmdc_extra_args()`), using `mmdc`'s own, officially documented `--puppeteerConfigFile` mechanism (confirmed directly via `mmdc --help`) — nothing about extraction, temp-file handling, or pass/fail determination changed.
- No Mermaid diagram and no documentation content was touched.

---

## 7. Puppeteer/Chromium Pinning Decision

**Decision: pin Puppeteer explicitly to `25.4.0`.** Rationale: the prior investigation already established that leaving this peer dependency unpinned makes the workflow's actual rendering engine non-deterministic — a future run could silently resolve a newer Puppeteer (and a different bundled Chromium build) with different system-dependency requirements, potentially reintroducing this exact failure class, or a different one, without any change to this repository's own files. Pinning it removes that variable entirely. The pin is applied inside `mermaid-cli`'s own nested `node_modules/puppeteer` — the exact location Node's module resolution uses when `mmdc` itself calls `require('puppeteer')` internally — not as a separate, disconnected global package that might not actually be the one `mmdc` resolves.

---

## 8. Sandbox Decision and Justification

**Decision: no unconditional `--no-sandbox`.** The smoke test (`scripts/ci/chromium-smoke-test.cjs`) always attempts a plain, sandboxed launch first. Only if that specific attempt fails does it retry with `--no-sandbox --disable-setuid-sandbox`, and it prints, unambiguously, which of the two succeeded. This satisfies every condition this task set for permitting a sandbox override:

1. **Demonstrably required**: the log records that the sandboxed attempt was tried and failed before the fallback is ever used — never assumed.
2. **Documented**: this section.
3. **Security implications recorded**: disabling the OS-level sandbox means a compromised renderer process has a materially easier path to affecting the host process than it otherwise would. In this specific, narrow context — a short-lived, single-purpose CI job that renders only this repository's own, already-reviewed Markdown content (never third-party or untrusted input) and is torn down immediately after — the practical exposure is low, but it is not zero, and this is recorded here as an accepted, scoped risk specific to this one job, not a general recommendation.
4. **No supported sandboxed alternative available**: GitHub-hosted runners are widely and officially documented (by both Google/Puppeteer and GitHub's own community guidance) to commonly require this exact fallback, because the Linux user-namespace/setuid sandbox mechanism Chromium expects is often unavailable to the unprivileged user these hosted runners execute jobs as. If the dependency installation in §5 alone resolves the launch failure, the sandboxed path succeeds and the fallback is never invoked — the smoke test's own log output on the next run is the authoritative record of which case actually applied.

If the runtime config the smoke test writes indicates the fallback was needed, `scripts/ci/validate-mermaid-blocks.py` picks up the identical, evidence-proven arguments via `mmdc`'s own `--puppeteerConfigFile` option — the real validator never uses a different launch configuration than what the smoke test already proved necessary.

---

## 9. Browser Smoke-Test Result

Cannot be executed identically on this investigation's local (Windows) machine: `subprocess`/`child_process`-style invocation of `mmdc` (and, by the same underlying resolution mechanism, direct Node module resolution against the same `mermaid-cli`-nested `puppeteer` install used here) is unaffected on Windows for this specific smoke test, since it uses Node's own `require()` rather than shelling out to the `mmdc.CMD` wrapper — however, verifying an actual **successful Linux Chromium launch** is only meaningful on the real `ubuntu-latest` runner this remediation targets. The smoke test's logic itself was verified as follows before being committed:

- `node --check scripts/ci/chromium-smoke-test.cjs` — syntax valid.
- Direct inspection confirms it resolves the Chromium path via the identical method already proven correct in the observability remediation's own diagnostics function.
- The sandboxed-first, fallback-second control flow, the runtime-config file it writes, and its exit-code behavior on total failure were all reviewed against the script's own source for correctness (both attempts wrapped in matching try/catch/finally with browser cleanup, and a non-zero exit only if both attempts fail).

**The authoritative result is the live GitHub Actions run** — see §12.

---

## 10. Mermaid Validation Result

Local execution of `scripts/ci/validate-mermaid-blocks.py` on this Windows machine continues to report every block as failing, for the same pre-existing, already-documented reason as every prior task in this program: `subprocess.run(["mmdc", ...])` cannot resolve npm's `.cmd` wrapper on Windows without `shell=True`, which the script (by design, matching how the actual Linux CI invokes it) does not use. This is unrelated to Mermaid content or to this remediation, and does not occur on Linux. The following were re-verified directly against the real `mmdc` binary (bypassing the Windows-only Python-invocation limitation, using Bash directly) to confirm the remediation's logic is sound independent of that local limitation:

- A genuinely valid Mermaid diagram renders successfully (`mmdc -i valid.mmd -o valid.svg` → exit `0`).
- A genuinely invalid Mermaid diagram fails with a real Mermaid parser error (`mmdc -i invalid.mmd -o invalid.svg` → exit `1`, with a full `Parser.parseError` stack trace).
- Adding `--puppeteerConfigFile <config>` (the exact mechanism `resolve_mmdc_extra_args()` now uses) changes **neither** outcome — the valid diagram still exits `0`, the invalid one still exits `1` with the same parser error. This directly confirms the runtime remediation cannot mask or alter a genuine Mermaid syntax failure.

**The authoritative pass/fail result for the 10 originally-failing blocks is the live GitHub Actions run** — see §12.

---

## 11. Invalid-Diagram Failure Test

Performed in an isolated scratch directory outside the repository (never committed, removed immediately after the test):

```text
valid.mmd   → mmdc → exit 0
invalid.mmd → mmdc → exit 1, "Error: Parse error on line 2: ... Expecting 'AMP', 'COLON', ... got 'SUBROUTINESTART'"
```

Repeated with `--puppeteerConfigFile puppeteer-config.json` (`{"args": []}`) present — identical outcomes for both files. This is direct, reproducible confirmation that the runtime remediation does not weaken, suppress, or bypass genuine Mermaid syntax validation.

---

## 12. Rollback Procedure

Every change in this remediation is isolated and independently revertible:

- **Puppeteer pinning / dependency installation / diagnostics / smoke test** (all in `.github/workflows/docs-mermaid-check.yml`): revert the file to its prior committed state (the version from the observability remediation commit) to remove all five new steps at once; the "Install mermaid-cli" and "Extract and validate every mermaid block" steps return to their exact prior form.
- **`scripts/ci/validate-mermaid-blocks.py`**: revert `resolve_mmdc_extra_args()` and its one-line use in the `cmd` construction to restore the exact prior invocation (`cmd = ["mmdc", "-i", tmp_in, "-o", tmp_out]`) — this is a two-part, easily isolated change within an otherwise-unmodified file.
- **`scripts/ci/chromium-smoke-test.cjs`**: delete the file; nothing else depends on it existing except the one workflow step that invokes it (which would need to be removed at the same time, per the workflow revert above).

**Rollback trigger**: the smoke test consistently fails even after the dependency installation (indicating a deeper, different runtime problem than what this remediation addresses), or the real validator's pass/fail behavior for a known-valid or known-invalid diagram changes in a way inconsistent with §10-§11's findings.

---

## 13. What This Remediation Does Not Do

This document does not authorize, and this remediation does not perform, any change to Mermaid diagram content, any other documentation, application source code, schemas, APIs, migrations, governance rules, or authorization logic. It does not weaken, disable, or bypass Mermaid syntax validation — confirmed directly in §11. The underlying pass/fail rule (`mmdc` exit code `0` = pass) is identical to before this remediation and to before the two remediations that preceded it in this program.

---

*End of Documentation CI Runtime Remediation #1.*
