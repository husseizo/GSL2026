# Documentation CI Validation Discrepancy — Root Cause Investigation #1

## Status: FORENSIC INVESTIGATION — NO REMEDIATION PERFORMED

---

## Document Control

| Field | Value |
|---|---|
| Document | Documentation CI Root Cause Investigation #1 |
| Investigates | Mermaid Validation failure discrepancy between local reproduction and GitHub Actions, on commit `53b205487708f771571a6820f8f2eae32b521944` |
| Investigation authority | AIOS Documentation Reliability Investigation Board (DRIB) |
| Investigation date | 2026-07-30 |
| Authoritative inputs | `.github/workflows/docs-mermaid-check.yml`; `scripts/ci/validate-mermaid-blocks.py`; GitHub Actions Checks API (runs, jobs, check-run annotations) for commit `53b2054`; direct local execution of `mmdc` 11.16.0 against three independently-derived copies of the same content; `npm view`/installed-package inspection of `@mermaid-js/mermaid-cli`'s dependency tree |

**This document is a forensic record. It performs no remediation, modifies no documentation, no Mermaid diagram, no workflow, and no script. Every conclusion below is labeled by its evidentiary status (Supported / Rejected / Inconclusive) and traces to a specific, reproducible test recorded in this document.**

---

## 1. Executive Summary

This investigation conclusively **proves one concrete defect** in the validation pipeline: `scripts/ci/validate-mermaid-blocks.py`'s error-reporting line embeds a raw, unescaped newline character inside a GitHub Actions `::error::` workflow command. GitHub's workflow-command parser does not support literal newlines in command message text without percent-encoding (`%0A`) — this **silently truncates every annotation at the word "parse:"**, discarding the actual `mmdc` stderr text that would explain the failure. This is not inferred; it is directly demonstrated in §5 below.

This defect is also why this investigation could not go further using only the public, unauthenticated Checks API: the one piece of evidence that would prove or disprove every remaining hypothesis (the real `mmdc` stderr for one of the 10 failing blocks) has never been visible anywhere — not in the annotation, not in the check-run's summary/text fields (both empty), and not accessible via raw log download (`403 Forbidden — Must have admin rights to Repository`).

A second, independently confirmed structural finding materially changes the investigation's prior assumption: **`@mermaid-js/mermaid-cli`'s pinned version (11.16.0) does not pin its own rendering engine.** `puppeteer` is declared only as a peer dependency (`"puppeteer": "^23 || ^24 || ^25"`), and a fresh install resolves it — along with its bundled Chromium binary — to whatever the latest matching version is *at install time* (confirmed locally: `puppeteer@25.4.0`, npm's current absolute latest). Pinning `mermaid-cli` alone, as the prior remediation task did, does **not** make the actual rendering engine deterministic or eliminate a real class of Linux-specific native-dependency risk that does not exist on this investigation's Windows machine.

Combined, these two findings support a specific, plausible failure mechanism (Puppeteer/Chromium failing to launch or being resource-exhausted on the GitHub-hosted Ubuntu runner, for reasons invisible on Windows) — but this mechanism remains **unproven**, because the one defect that is proven (§ above) has, since this repository's validation script was written, permanently hidden the evidence that would confirm it.

**Root cause of the discrepancy is not yet identified with certainty. Root cause of why it cannot currently be identified is proven.**

---

## 2. Workflow Execution Trace

Exact command chain, as defined in `.github/workflows/docs-mermaid-check.yml` (verified against the committed `HEAD` content — working tree and `git show HEAD:...` are byte-identical, confirmed by diff):

```text
actions/checkout@v4
        ↓
actions/setup-node@v4 (node-version: "20")
        ↓
npm install -g @mermaid-js/mermaid-cli@11.16.0
        ↓ (resolves peer dependency `puppeteer` to latest matching ^23||^24||^25 — UNPINNED)
        ↓ (puppeteer's own postinstall downloads a bundled Chromium build — UNPINNED, network-dependent)
python3 scripts/ci/validate-mermaid-blocks.py
        ↓
os.walk(".") — every *.md file, skipping node_modules/.git/dist/build/__pycache__
        ↓
re.findall(r"```mermaid\n(.*?)```", text, re.DOTALL)  — per file
        ↓
tempfile.NamedTemporaryFile(mode="w", suffix=".mmd", encoding="utf-8")  — per block
        ↓
subprocess.run(["mmdc", "-i", tmp_in, "-o", tmp_out], capture_output=True, text=True, timeout=60)
        ↓
if returncode != 0: print(f"::error file={path}::Mermaid block {index} failed to parse:\n{result.stderr}")
        ↓
exit 1 if any block failed
```

Confirmed job step results for commit `53b2054` (`validate mermaid blocks` job, id `90954867383`), via the Checks API:

| Step | Conclusion |
|---|---|
| Set up job | success |
| Run actions/checkout@v4 | success |
| Run actions/setup-node@v4 | success |
| Install mermaid-cli | **success** |
| Extract and validate every mermaid block | **failure** |
| Post Run actions/setup-node@v4 | skipped |
| Post Run actions/checkout@v4 | success |
| Complete job | success |

The pinned install step itself succeeded — the failure is entirely inside the validation script's own execution, not in setting up the tool.

---

## 3. Mermaid Extraction Analysis

The extraction regex (`MERMAID_BLOCK = re.compile(r"```mermaid\n(.*?)```", re.DOTALL)`) was independently re-implemented for this investigation, applied to three separately-sourced copies of the same three documents, and cross-checked for identical block counts and identical extracted content:

| Source | Method | Blocks found (3 target files) | Result |
|---|---|---|---|
| Working tree (CRLF, as edited) | Direct file read | 3 + 1 + 6 = 10 | All 10 render successfully (`mmdc` exit 0) |
| Git blob at `HEAD` (LF, byte-exact to what `actions/checkout` produces) | `git show HEAD:<path>` | 3 + 1 + 6 = 10 | All 10 render successfully (`mmdc` exit 0) |
| Full repository walk (matching `find_markdown_files`'s own `SKIP_DIRS` exactly) | `os.walk(".")` re-implementation | 42 total (all tracked `.md` files) | All 42 render successfully (`mmdc` exit 0) |

The extraction logic itself is not in question: the same regex against the same underlying bytes produces the same result whether run on this investigation's machine or (by direct byte-comparison) what a Linux checkout would produce. **Extraction bug: rejected as a cause** (see Evidence Matrix, §7).

---

## 4. Temporary File Analysis

For each of the 10 originally-flagged blocks, the exact bytes written to the `.mmd` file were inspected directly:

- **Encoding**: UTF-8 confirmed for all 10 (`encoding="utf-8"` in both `tempfile.NamedTemporaryFile` and this investigation's reproduction).
- **UTF-8 BOM**: none present in any of the 10 source files or extracted blocks (confirmed via `open(..., "rb")` byte inspection — no `EF BB BF` prefix).
- **LF vs. CRLF**: the working tree stores these three files as CRLF (confirmed via `file` command: "with CRLF line terminators"); the committed `git` blob stores them as LF (confirmed via `git show HEAD:<path> | xxd`). Both versions were extracted and tested independently — **identical result (all pass)** in both cases. `core.autocrlf=true` locally explains the working-tree/blob difference; it has no bearing on what a Linux `actions/checkout` produces (no `.gitattributes` exists in this repository to override the default, and a Linux checkout does not perform CRLF translation regardless).
- **Trailing whitespace, escaping, quotes, HTML entities**: no anomaly found in any of the 10 blocks under direct inspection; all use standard Mermaid node-label quoting (`"..."`) and the `\n` line-break escape sequence inside quoted labels, which mermaid-cli 11.16.0 is confirmed (by direct, repeated test) to parse correctly.
- **Invisible characters**: no zero-width or non-breaking space characters found via direct byte inspection of the 10 blocks.

**Temporary-file corruption, encoding, and CRLF conversion: rejected as causes** (see Evidence Matrix, §7) — all were directly tested, not assumed.

---

## 5. Subprocess Analysis

**stderr is not discarded by the workflow shell** — `capture_output=True` in the script's own `subprocess.run` call correctly captures both stdout and stderr in Python. The loss occurs one step later, in how that captured stderr is surfaced:

```python
print(f"::error file={path}::Mermaid block {index} failed to parse:\n{result.stderr}")
```

**This line contains a literal, unescaped `\n` character between "failed to parse:" and the actual `result.stderr` content.** GitHub Actions' workflow-command protocol (the `::error::`/`::warning::`/`::notice::` syntax) requires message text to have `%`, `\r`, and `\n` percent-encoded (`%25`, `%0D`, `%0A` respectively) to appear correctly inside a single command's message field; a raw, literal newline is treated as the end of that command's single line of input. Directly reproducing the exact print statement (§ below) demonstrates this precisely:

```text
Input to print(): '::error file=...::Mermaid block 1 failed to parse:\nError: <the real stderr>\n<more real stderr>'
```

The captured annotation for every one of the 10 failing blocks, retrieved from the Checks API, reads **exactly**:

```text
Mermaid block N failed to parse:
```

— with nothing after the colon, for all 10, across two different check runs' worth of annotations (this commit's, matching the pattern already present in every prior run referenced in this program). This is not a coincidence of short error messages; it is the direct, mechanical consequence of the unescaped newline: GitHub's parser stops reading the message at the first raw newline, silently dropping everything the script intended to print afterward — including the one piece of information (the real `mmdc`/Puppeteer stderr) that would resolve this investigation.

**Hidden stderr: confirmed and proven**, independent of and prior to any question about why `mmdc` itself is failing.

The check run's own `output.summary` and `output.text` fields (which can carry a longer, separate body distinct from per-line annotations) were also queried directly and are both `null` — the script never writes to these fields at all; it relies solely on the (broken) per-block annotation mechanism.

---

## 6. Environment Comparison

| Property | This investigation (local) | GitHub Actions (confirmed) | GitHub Actions (unconfirmed / cannot observe) |
|---|---|---|---|
| OS | Windows (MINGW64/Git Bash over Windows 10.0.20348) | `ubuntu-latest` (per workflow `runs-on`) | Exact Ubuntu image version/build in effect for this run |
| Shell | bash (Git Bash) | bash (default for `ubuntu-latest` `run:` steps) | — |
| Python | 3.11.9 | `python3` invoked directly, no explicit version pin in the workflow | Exact `python3` version resolved on the runner image |
| Node.js | v22.19.0 (ambient, not provisioned by this investigation) | Requested "20" via `actions/setup-node@v4`; a runner-wide advisory states actions targeting Node 20 are now force-run under Node 24 (see below) | The actual `node --version` on `PATH` at the moment `npm install -g` and `mmdc` executed |
| mermaid-cli | 11.16.0 (pinned, confirmed installed) | 11.16.0 (pinned; "Install mermaid-cli" step succeeded) | — |
| puppeteer (peer dependency) | **25.4.0** — confirmed installed, resolved from an **unpinned** `^23 \|\| ^24 \|\| ^25` range at install time | **Unpinned** — will independently resolve to whatever is latest at that job's install moment | The exact version actually resolved in that job; whether it matches 25.4.0 |
| puppeteer-core | 25.4.0 (matches puppeteer) | Unpinned, tied to whatever puppeteer resolves to | Exact version |
| Chromium (bundled by puppeteer) | Whatever build ships with puppeteer 25.4.0 for Windows | Whatever build ships with puppeteer's resolved version for Linux | Exact revision; whether its launch succeeded; whether required shared libraries are present on the runner image |
| Git checkout mode | N/A (working directly in an existing clone) | `actions/checkout@v4`, default settings, no sparse checkout, no LFS directives observed in the workflow | — |
| `.gitattributes` | Confirmed absent (no root `.gitattributes` file exists) | Same (repository-wide, not environment-specific) | — |
| Working directory | Repository root (`f:\GSL2026`) | Repository root (`actions/checkout@v4` default) | — |

**A confirmed, GitHub-surfaced platform-level anomaly**: both this run's Mermaid and Lint jobs carry a `warning`-level annotation stating *"Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24."* This is a real, GitHub-wide runner-infrastructure change (dated 2025-09-19 per the annotation's own reference) affecting the **JavaScript runtime that executes the actions' own bundled code** (`actions/checkout@v4`, `actions/setup-node@v4`). It is a distinct concern from what Node version `actions/setup-node@v4` subsequently provisions onto `PATH` for the workflow's own `run:` steps (governed by the `node-version: "20"` input, not by which runtime executes the action itself). Whether this forcing has any downstream effect on what `npm install -g` / `mmdc` actually resolved to in that job **cannot be determined from the available evidence** — it is recorded here as an observed anomaly, not a proven cause.

---

## 7. Evidence Matrix (Hypothesis Testing)

| Hypothesis | Status | Evidence |
|---|---|---|
| Mermaid syntax defect in one or more of the 10 blocks | **Rejected** | All 10 render successfully under `mmdc` 11.16.0 in three independent extractions (working-tree CRLF, git-blob LF, full repo walk) |
| Extraction bug (regex, block boundaries) | **Rejected** | Identical regex re-implemented and applied to identical bytes; block counts and content match exactly across all three extraction methods |
| Temporary-file corruption | **Rejected** | Direct byte inspection of every extracted `.mmd` file: correct UTF-8, no BOM, no invisible characters, no corruption found |
| Encoding mismatch | **Rejected** | UTF-8 confirmed end-to-end; no BOM; no encoding-related `mmdc` error possible to reproduce |
| CRLF conversion | **Rejected** | Both CRLF (working tree) and byte-exact LF (git blob, what Linux checkout produces) tested directly — both pass |
| Workflow checkout misconfiguration | **Rejected** | Default `actions/checkout@v4`, no `.gitattributes`, no sparse checkout or LFS directive found; working tree matches committed `HEAD` exactly |
| Puppeteer launch failure (Linux-specific) | **Inconclusive** | Structurally plausible and newly supported by the discovery that `puppeteer` is an **unpinned peer dependency** whose resolved version (confirmed locally: 25.4.0, npm's absolute latest) and bundled Chromium are not controlled by the `mermaid-cli` version pin; cannot be directly confirmed without the actual stderr (hidden, §5) |
| Chromium sandbox/missing shared libraries on the runner | **Inconclusive** | Same reasoning as above — a well-documented, common class of failure for Puppeteer-based tools on minimal Linux CI images; cannot be confirmed without stderr |
| `mmdc` regression (version-specific bug) | **Rejected** | The exact pinned version (11.16.0) that the "Install mermaid-cli" step successfully installed is the same version tested exhaustively and successfully in this investigation |
| Hidden/suppressed stderr | **Confirmed (proven)** | The script's own `print()` call embeds a raw, unescaped `\n` inside a GitHub `::error::` command; this is demonstrated directly in §5 and independently corroborated by every one of the 10 annotations being truncated at the identical point ("...failed to parse:") |
| GitHub runner environment anomaly (Node 20→24 forcing) | **Inconclusive** | A real, confirmed warning is present on this exact run, but its scope (action-runtime only) makes a causal link to the `mmdc` failure unproven either way |
| Resource exhaustion across 42 sequential Puppeteer launches in one job | **Inconclusive** | Would coherently explain a "some, not all" failure pattern tied to processing order rather than content, but cannot be confirmed without stderr or per-block timing data |

---

## 8. Root Cause Assessment

**Proven root cause (of why this investigation cannot proceed further today)**: `scripts/ci/validate-mermaid-blocks.py` line — `print(f"::error file={path}::Mermaid block {index} failed to parse:\n{result.stderr}")` — uses an unescaped, literal newline inside a GitHub Actions workflow command, which truncates every resulting annotation before the actual diagnostic content (`result.stderr`) is ever shown. This has been true for every run this program has observed and is independently reproducible by inspecting the print statement's own formatting logic against GitHub's documented workflow-command escaping requirements.

**Not yet proven**: the specific reason `mmdc` returns a non-zero exit code for these 10 particular blocks inside the GitHub Actions Ubuntu container specifically. Every hypothesis that could explain a genuine Windows/Linux behavioral difference (Puppeteer/Chromium launch failure, missing native shared libraries, resource exhaustion across many sequential headless-browser launches) remains structurally plausible and, in the case of Puppeteer's unpinned peer-dependency resolution, newly and independently *supported* by direct evidence — but none can be confirmed as the actual mechanism without seeing the real stderr text, which is currently unobtainable through any available channel.

---

## 9. Missing Evidence

To move any of the three "Inconclusive" hypotheses in §7 to "Confirmed" or "Rejected," the following specific evidence is required, in order of how directly it would resolve the question:

1. **The actual `result.stderr` text for at least one failing block.** Obtainable only by either (a) a repository administrator downloading the raw job log via the authenticated `GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs` endpoint (this investigation received `403 — Must have admin rights to Repository` on that exact call), or (b) correcting the annotation's newline-escaping defect and observing a subsequent run's now-complete annotation text.
2. **The exact `puppeteer`/`puppeteer-core`/Chromium version actually resolved inside that specific CI job**, obtainable from the same raw log (the `npm install -g` step's own console output lists every resolved package version).
3. **Confirmation of which system-level shared libraries are present on the exact `ubuntu-latest` image revision used for this run**, obtainable only from GitHub's own runner-image changelog for that date, or from a diagnostic step added to the workflow (not implemented by this investigation).
4. **Per-block timing data** (how long each of the 42 `mmdc` invocations took in that job), which would either support or refute the resource-exhaustion/sequential-launch hypothesis; not currently emitted anywhere by the script.

---

## 10. Recommended Next Action

**Recommended, not implemented** (this task is forensic-only):

1. Fix the annotation-escaping defect identified in §5/§8 — percent-encode `result.stderr` (`\r` → `%0D`, `\n` → `%0A`, and any literal `%` → `%25`) before interpolating it into the `::error::` command, so future runs actually surface the real failure text via the public annotation mechanism (no admin access would then be required to diagnose this class of issue again).
2. Once that fix lands and a subsequent run reproduces the same 10 failures, re-run this investigation using the now-visible stderr text to resolve the three remaining "Inconclusive" hypotheses definitively.
3. Independently of the above, consider whether pinning `mermaid-cli`'s peer dependency (`puppeteer`) to an exact version — and, if Linux-specific native dependencies turn out to be the cause, adding an explicit Chromium system-dependency installation step (e.g., `npx puppeteer browsers install chrome --with-deps`, or the equivalent `apt-get` package list) to the workflow — would remove the non-determinism this investigation identified in §6, independent of whatever the stderr ultimately reveals.

Neither action is performed by this document.

---

## 11. What This Investigation Does Not Authorize

This document does not authorize any change to `scripts/ci/validate-mermaid-blocks.py`, any workflow file, any Mermaid diagram, or any other documentation. It records forensic findings only, for a separate, future, properly-authorized remediation task to act on.

---

*End of Documentation CI Root Cause Investigation #1. FORENSIC INVESTIGATION — NO REMEDIATION PERFORMED.*
