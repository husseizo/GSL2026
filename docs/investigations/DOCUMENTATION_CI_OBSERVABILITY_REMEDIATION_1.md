# Documentation CI Observability Remediation #1

## Status: OBSERVABILITY REMEDIATION — VALIDATION LOGIC UNCHANGED

---

## Document Control

| Field | Value |
|---|---|
| Document | Documentation CI Observability Remediation #1 |
| Follows from | `docs/investigations/DOCUMENTATION_CI_ROOT_CAUSE_INVESTIGATION_1.md` |
| Modified file | `scripts/ci/validate-mermaid-blocks.py` |
| Effective date | 2026-07-30 |

**This document records an observability-only change. The rule that determines pass/fail — a block fails if and only if `mmdc` does not exit `0` — is unchanged. What changed is what the workflow reports when that happens, and that a previously-uncaught timeout or exception no longer crashes the whole script without explanation.**

---

## 1. Observed Deficiencies (from the prior investigation)

1. The error annotation embedded a raw, unescaped newline inside a GitHub `::error::` workflow command (`print(f"...failed to parse:\n{result.stderr}")`), which GitHub's command parser truncates at the first literal newline — the real `mmdc` stderr was never visible anywhere, in any run this program observed.
2. `subprocess.TimeoutExpired` was not caught anywhere — a slow render would crash the entire script with an unhandled traceback rather than a per-block failure report.
3. No exit code, command line, temporary-file path/size, or environment/version information was ever reported, for either failing or passing blocks.
4. No distinction existed between "no result" (timeout, exception) and "result with non-zero exit code" — both were handled by a single `if result.returncode != 0` check that would itself raise `AttributeError` if `result` were never assigned (which is exactly what an uncaught timeout produces).

---

## 2. Changes Made

All changes are confined to `scripts/ci/validate-mermaid-blocks.py`. No other file was modified — no workflow YAML change was necessary, since every requirement was achievable inside the existing single script using GitHub's own `::group::`/`::endgroup::` and `::debug::` workflow commands (no new workflow step, artifact upload, or step-debug configuration required).

| Change | Why |
|---|---|
| Added `escape_annotation_message()` / `escape_annotation_property()`, implementing GitHub's documented escaping order (`%` first, then `\r`, then `\n`; property values additionally escape `:` and `,`) | Directly fixes the proven truncation defect (§1, item 1) |
| `::error::` annotation is now short and always single-line (a one-sentence summary + a pointer to the log), never the raw stderr | An annotation is UI-surfaced and length/newline-constrained; it is the wrong place for a multi-line, unbounded parser dump |
| Full command, exit code, signal (if negative return code), timeout flag, exception text, and complete untruncated stdout/stderr are printed inside a `::group::.../::endgroup::` block | Plain log output has no annotation-length or newline restriction — this is where the complete diagnostic belongs |
| `subprocess.TimeoutExpired` and any other exception from `subprocess.run` are now caught explicitly and treated as an ordinary failure (not a crash) | Fixes deficiency §1, item 2 — the script now always completes and always reports a per-block result, even under a timeout |
| Every block (passing or failing) emits one `::debug::` line recording file, block number, temp-file path, temp-file size, encoding, and the exact command | Satisfies the "log temporary files for every block" requirement without cluttering a successful run's default view — `::debug::` lines are hidden in the Actions UI unless step-debug logging is explicitly enabled |
| `print_environment_diagnostics()` — printed once, only if at least one block failed — reports cwd, `PATH`, resolved `mmdc` path, Python/Node/npm/mermaid-cli/puppeteer/Chromium versions, runner image, and platform string | Satisfies the runtime-version and execution-environment requirements while keeping a successful run exactly as concise as before (this function is never invoked on a clean pass) |
| Puppeteer/Chromium version discovery is best-effort and fully defensive (every sub-lookup wrapped so a missing tool never raises) | The prior investigation proved `puppeteer` is an unpinned peer dependency of `mermaid-cli` — its actual resolved version and bundled Chromium build are genuinely new, non-redundant diagnostic information that no existing check reported |

---

## 3. Annotation Escaping Changes

Before:
```python
print(f"::error file={path}::Mermaid block {index} failed to parse:\n{result.stderr}")
```
A literal `\n` here is not a supported escape inside a GitHub workflow-command message — everything from that newline onward is dropped by GitHub's parser before the annotation is even stored.

After:
```python
def escape_annotation_message(text: str) -> str:
    return text.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")

def escape_annotation_property(text: str) -> str:
    return (
        text.replace("%", "%25")
        .replace("\r", "%0D")
        .replace("\n", "%0A")
        .replace(":", "%3A")
        .replace(",", "%2C")
    )

def emit_error_annotation(path: str, message: str) -> None:
    print(f"::error file={escape_annotation_property(path)}::{escape_annotation_message(message)}")
```
The annotation itself is now deliberately kept to one short, human-readable sentence (e.g. *"Mermaid block 2 failed to parse (Error: parse error at line 3) — full command/exit-code/stdout/stderr in the job log below."*) — correctly escaped, so it can never be truncated, and it points the reader to the full detail rather than trying to fit that detail inside the annotation itself.

**Verified directly** (unit test, §8): a message containing embedded newlines, a literal `%`, a colon, and a comma is escaped such that the resulting `::error::` line contains zero raw `\n`/`\r` characters and exactly one `::error` line is ever emitted per failure.

---

## 4. stderr/stdout Improvements

Every failing block now prints, inside a `::group::.../::endgroup::` block (fully expandable in the Actions UI, and always present in the plain/raw log regardless of UI folding):

```text
::group::Mermaid block failure: <path> (block <N>)
Original markdown file: <path>
Block number: <N>
Temporary file: <tmp_in> (<size> bytes, utf-8)
Command: mmdc -i '<tmp_in>' -o '<tmp_out>'
Exit code: <code, or "N/A — see exception below">
[Terminated by signal <n>.]           (only if returncode < 0)
Timed out (> 60s): <True|False>
[Exception: <type>: <message>]        (only if an exception was caught)
--- stdout (complete, untruncated) ---
<full stdout, or "(empty)">
--- stderr (complete, untruncated) ---
<full stderr, or "(empty)">
::endgroup::
```

Nothing here is truncated, shortened, or sampled — the entire captured `stdout`/`stderr` string is printed verbatim, as plain log text with no workflow-command escaping applied to it (plain `print()` output has no such restriction).

---

## 5. Environment Reporting

`print_environment_diagnostics()` reports, once per run and only if at least one failure occurred:

- Working directory (`os.getcwd()`)
- `PATH` (full, unmodified)
- Resolved `mmdc` executable (`shutil.which("mmdc")`)
- Resolved Chromium executable (best-effort, via Puppeteer's own `executablePath()`, invoked through `node -e`)
- Platform string (`platform.platform()`)
- Runner image (`ImageOS`/`ImageVersion` environment variables set by GitHub-hosted runners; falls back to `/etc/os-release`'s `PRETTY_NAME` on Linux; reports `"unavailable"` cleanly if neither exists, e.g. on this investigation's Windows machine)

---

## 6. Runtime Version Reporting

Reported (all defensively wrapped — a missing or unresolvable tool reports `"unavailable"` rather than raising):

- Python (`platform.python_version()`, plus the interpreter path)
- Node (`node --version`)
- npm (`npm --version`)
- mermaid-cli (`mmdc --version`)
- Puppeteer — read directly from `@mermaid-js/mermaid-cli`'s own nested `node_modules/puppeteer/package.json`, located via `npm root -g` — **this is new, previously-unavailable information**: the prior investigation proved pinning `mermaid-cli` does not pin this peer dependency, so knowing exactly which `puppeteer` version a given run actually resolved is now possible for the first time.
- Chromium — resolved via `node -e "require(<puppeteer-dir>).executablePath()"`, then `<that path> --version`, best-effort.

---

## 7. Temporary File Reporting

For **every** block (not only failures), a single `::debug::` line records:

```text
file=<markdown path> block=<N> tmp_in=<path> tmp_out=<path> size_bytes=<N> encoding=utf-8 command=<shlex-quoted mmdc command>
```

`::debug::` commands are recorded by GitHub Actions but hidden from the default Checks UI unless a run has step-debug logging explicitly enabled — this satisfies the literal "for every Mermaid block" requirement without making a successful run's default log any longer than before.

---

## 8. Validation Results

All tests below were run against the actual rewritten script (`scripts/ci/validate-mermaid-blocks.py`), not a copy or simulation.

| Test | Method | Result |
|---|---|---|
| Syntax | `python -m py_compile` | Pass |
| Escaping correctness | Direct unit test of `escape_annotation_message`/`escape_annotation_property` against a string containing `\n`, `\r`, `%`, `:`, `,` | Pass — zero raw newlines in the escaped output; all special characters correctly encoded |
| Success path stays concise | `validate_block()` called with `subprocess.run` mocked to return exit code 0 | Pass — output contains exactly one `::debug::` line; no `::error::`, no `::group::`; function returns `True` |
| Failure path is complete | `validate_block()` called with `subprocess.run` mocked to return exit code 1 with multi-line stderr containing a literal `%` | Pass — exactly one, single-line `::error::` annotation emitted; the complete, verbatim multi-line stderr appears inside the `::group::` block; function returns `False` |
| Timeout no longer crashes | `subprocess.run` mocked to raise `subprocess.TimeoutExpired` | Pass — no exception propagates out of `validate_block()`; function returns `False`; log correctly shows `Timed out (> 60s): True` |
| Environment diagnostics never crash | `print_environment_diagnostics()` invoked directly against this machine's real (partially Windows-limited) toolchain | Pass — completes without raising; every unavailable tool (`npm --version`/`mmdc --version` fail here due to a pre-existing, already-documented Windows `.cmd`-resolution quirk, unrelated to this remediation and irrelevant on the actual Linux CI runner) is reported as `"unavailable"`, not a crash |
| Full repository regression | `python scripts/ci/validate-mermaid-blocks.py` against all 42 real mermaid blocks in this repository | Completes cleanly (exit code 1, since every block fails locally due to the same pre-existing Windows-only `.cmd` limitation documented in the prior investigation and in this session's own history) — critically, the script **processes all 42 blocks and prints a complete diagnostic for every one of them without crashing**, where the prior version would have crashed with an unhandled `FileNotFoundError` traceback on the very first block |
| Scope | `git status --short` / `git diff --stat` | Exactly one file changed: `scripts/ci/validate-mermaid-blocks.py`. No workflow file, no documentation, no Mermaid diagram, no application code touched |

**No test could demonstrate a genuine, real `mmdc` success on this investigation's Windows machine**, because `subprocess.run(["mmdc", ...])` without `shell=True` cannot resolve npm's `.cmd` wrapper on Windows at all (a pre-existing, already-documented limitation of this specific local environment, not of the script's logic, and not present on the Linux CI runner). This gap was closed by directly unit-testing the success path with a mocked, successful `subprocess.run` result (see the "Success path stays concise" row above), which exercises the exact same code path a real Linux success would take.

---

## 9. Sample Failure Output

Representative output for one deliberately-failing block (values shown are from the mocked-failure unit test in §8; a real CI failure will show real `mmdc` values in the same shape):

```text
::debug::file=docs/broken.md block=2 tmp_in=/tmp/tmpXXXXXX.mmd tmp_out=/tmp/tmpXXXXXX.mmd.svg size_bytes=27 encoding=utf-8 command=mmdc -i '/tmp/tmpXXXXXX.mmd' -o '/tmp/tmpXXXXXX.mmd.svg'
::error file=docs/broken.md::Mermaid block 2 failed to parse (Error: parse error at line 3) — full command/exit-code/stdout/stderr in the job log below.
::group::Mermaid block failure: docs/broken.md (block 2)
Original markdown file: docs/broken.md
Block number: 2
Temporary file: /tmp/tmpXXXXXX.mmd (27 bytes, utf-8)
Command: mmdc -i '/tmp/tmpXXXXXX.mmd' -o '/tmp/tmpXXXXXX.mmd.svg'
Exit code: 1
Timed out (> 60s): False
--- stdout (complete, untruncated) ---
some stdout
second line
--- stderr (complete, untruncated) ---
Error: parse error at line 3
Expected 'end' got '['
100% reproducible
::endgroup::
Checked 42 mermaid block(s).
::group::Environment diagnostics (at least one Mermaid block failed to parse)
Working directory: /home/runner/work/GSL2026/GSL2026
PATH: ...
Resolved mmdc executable: /usr/local/bin/mmdc
Python: 3.x.x (...)
Node: v20.x.x
npm: 10.x.x
mermaid-cli (mmdc): 11.16.0
puppeteer (peer dependency — not pinned by mermaid-cli's own version): <actual resolved version>
Chromium executable: <actual path, if resolvable>
Chromium version: <actual version, if resolvable>
Runner image: ImageOS=ubuntu24 ImageVersion=...
Platform: Linux-...
::endgroup::
```

---

## 10. Expected Future Workflow Behavior

- **A genuinely passing run** is unchanged in its visible summary: `Checked N mermaid block(s).`, exit code `0`. Per-block `::debug::` lines exist but remain hidden from the default UI view.
- **A genuinely failing run** now surfaces, for every failing block, in the plain job log (no admin/log-download access required, unlike before): the exact file, block number, temporary file path and size, the exact `mmdc` command, the exit code (or exception/timeout detail), and the complete, unabridged `stdout`/`stderr` — plus, once per run, the full runtime/environment diagnostic block including the previously-invisible Puppeteer and Chromium versions.
- **The very next real CI failure** on this workflow will, for the first time, contain enough information to resolve the three "Inconclusive" hypotheses left open by the prior root-cause investigation (Puppeteer launch failure, Chromium sandbox/missing shared libraries, sequential resource exhaustion) without requiring any further infrastructure investigation.

---

## 11. What This Remediation Does Not Do

This remediation does not change which blocks pass or fail, does not weaken, disable, skip, or suppress validation, does not convert any failure into a warning, and does not touch any Mermaid diagram, documentation file, workflow YAML, or application code. It changes only what is reported when the existing, unmodified pass/fail rule (`mmdc` exit code `0`) is not met.

---

*End of Documentation CI Observability Remediation #1.*
