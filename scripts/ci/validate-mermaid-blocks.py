#!/usr/bin/env python3
"""Validate every fenced ```mermaid block in the repository's Markdown
files by rendering each one with mermaid-cli (mmdc). Renders to a
throwaway temp file and discards it immediately — this validates syntax
only, it never publishes or commits a rendered image.

Used by .github/workflows/docs-mermaid-check.yml. Exits non-zero if any
block fails to parse. Pass/fail logic is unchanged from the original
script — a block fails if and only if `mmdc` exits non-zero (or times
out, or raises an unexpected exception, both of which previously crashed
the whole script uncaught and are now treated as an ordinary failure).

Observability (docs/investigations/DOCUMENTATION_CI_OBSERVABILITY_REMEDIATION_1.md):
the prior version's error annotation embedded a raw, unescaped newline
inside a GitHub `::error::` workflow command, which GitHub silently
truncates before the actual `mmdc` stderr — every failure's real cause
was invisible in the Checks UI and the public annotations API. This
version emits a short, correctly-escaped annotation per failing block,
then prints the complete, untruncated command/exit-code/stdout/stderr
(plus runtime and environment diagnostics) into a collapsible
`::group::` log section — visible in the plain job log, not subject to
annotation escaping or length limits. Successful runs are unaffected:
per-block detail is emitted via `::debug::` (hidden in the UI unless
step-debug logging is enabled) so the default log stays exactly as
concise as before ("Checked N mermaid block(s).").
"""
import json
import os
import platform
import re
import shlex
import shutil
import subprocess
import sys
import tempfile

MERMAID_BLOCK = re.compile(r"```mermaid\n(.*?)```", re.DOTALL)
SKIP_DIRS = {"node_modules", ".git", "dist", "build", "__pycache__"}
MMDC_TIMEOUT_SECONDS = 60


def find_markdown_files(root: str):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if name.endswith(".md"):
                yield os.path.join(dirpath, name)


# --- GitHub Actions workflow-command escaping -------------------------------
# Per GitHub's documented rules, a raw literal newline (or `%`, or `\r`)
# inside a workflow-command's message or property value is not supported and
# silently breaks the command. `%` must be escaped first, before the escape
# sequences below introduce any new `%` characters, or the result would be
# double-escaped.


def escape_annotation_message(text: str) -> str:
    return text.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def escape_annotation_property(text: str) -> str:
    # Property values (e.g. `file=...`) additionally require `:` and `,`
    # escaped, since those characters delimit the property list itself.
    return (
        text.replace("%", "%25")
        .replace("\r", "%0D")
        .replace("\n", "%0A")
        .replace(":", "%3A")
        .replace(",", "%2C")
    )


def emit_error_annotation(path: str, message: str) -> None:
    print(f"::error file={escape_annotation_property(path)}::{escape_annotation_message(message)}")


def emit_debug(message: str) -> None:
    # ::debug:: lines are hidden in the Actions UI by default (only shown
    # when a run has step-debug logging enabled) — this keeps a genuine,
    # complete per-block record (per this remediation's own requirement)
    # without cluttering the default view of a successful run.
    for line in message.splitlines() or [""]:
        print(f"::debug::{escape_annotation_message(line)}")


def _run_quiet(cmd):
    """Run a diagnostic command defensively — never raises, never affects
    the real validation result. Returns None on any failure to launch."""
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    except Exception:
        return None


def resolve_tool_version(cmd) -> str:
    result = _run_quiet(cmd)
    if result is None:
        return "unavailable"
    output = (result.stdout or result.stderr or "").strip()
    return output if output else f"unavailable (exit {result.returncode})"


def resolve_puppeteer_and_chromium():
    """Best-effort discovery of the puppeteer/Chromium versions `mmdc` is
    actually using. Both are a peer/nested dependency of
    @mermaid-js/mermaid-cli and are NOT pinned merely by pinning
    mermaid-cli's own version — see the prior root-cause investigation —
    so this is genuinely new diagnostic information, not a duplicate of
    the mmdc version check. Never raises; every failure path returns a
    plain "unavailable (...)" string instead."""
    try:
        npm_root = _run_quiet(["npm", "root", "-g"])
        if npm_root is None or npm_root.returncode != 0:
            return "unavailable (npm root -g failed)", "unavailable", None

        root = npm_root.stdout.strip()
        puppeteer_dir = os.path.join(root, "@mermaid-js", "mermaid-cli", "node_modules", "puppeteer")
        pkg_path = os.path.join(puppeteer_dir, "package.json")

        puppeteer_version = "unavailable (not found at expected path)"
        if os.path.exists(pkg_path):
            try:
                with open(pkg_path, encoding="utf-8") as f:
                    puppeteer_version = json.load(f).get("version", "unknown")
            except Exception as e:
                puppeteer_version = f"unavailable (error reading package.json: {e})"

        chromium_version = "unavailable"
        executable_path = None
        if os.path.isdir(puppeteer_dir):
            node_script = (
                "try {"
                "const puppeteer = require(process.argv[1]);"
                "console.log(puppeteer.executablePath());"
                "} catch (e) { console.error(String(e)); process.exit(1); }"
            )
            node_result = _run_quiet(["node", "-e", node_script, puppeteer_dir])
            if node_result is not None and node_result.returncode == 0:
                executable_path = node_result.stdout.strip()
                if executable_path and os.path.exists(executable_path):
                    ver_result = _run_quiet([executable_path, "--version"])
                    if ver_result is not None and ver_result.returncode == 0:
                        chromium_version = ver_result.stdout.strip()
                    else:
                        chromium_version = "unavailable (executable did not report a version)"
                else:
                    chromium_version = "unavailable (reported path does not exist)"
        return puppeteer_version, chromium_version, executable_path
    except Exception as e:
        return f"unavailable (unexpected error: {e})", "unavailable", None


def resolve_runner_image() -> str:
    image_os = os.environ.get("ImageOS")
    image_version = os.environ.get("ImageVersion")
    if image_os or image_version:
        return f"ImageOS={image_os or 'unknown'} ImageVersion={image_version or 'unknown'}"
    os_release_path = "/etc/os-release"
    if os.path.exists(os_release_path):
        try:
            with open(os_release_path, encoding="utf-8") as f:
                for line in f:
                    if line.startswith("PRETTY_NAME="):
                        return line.split("=", 1)[1].strip().strip('"')
        except Exception:
            pass
    return "unavailable"


def print_environment_diagnostics() -> None:
    # Only ever called after at least one real failure — a successful run
    # never pays for this, keeping the default log exactly as concise as
    # before.
    print("::group::Environment diagnostics (at least one Mermaid block failed to parse)")
    print(f"Working directory: {os.getcwd()}")
    print(f"PATH: {os.environ.get('PATH', 'unavailable')}")
    print(f"Resolved mmdc executable: {shutil.which('mmdc') or 'not found on PATH'}")
    print(f"Python: {platform.python_version()} ({sys.executable})")
    print(f"Node: {resolve_tool_version(['node', '--version'])}")
    print(f"npm: {resolve_tool_version(['npm', '--version'])}")
    print(f"mermaid-cli (mmdc): {resolve_tool_version(['mmdc', '--version'])}")
    puppeteer_version, chromium_version, chromium_path = resolve_puppeteer_and_chromium()
    print(f"puppeteer (peer dependency — not pinned by mermaid-cli's own version): {puppeteer_version}")
    print(f"Chromium executable: {chromium_path or 'unavailable'}")
    print(f"Chromium version: {chromium_version}")
    print(f"Runner image: {resolve_runner_image()}")
    print(f"Platform: {platform.platform()}")
    print("::endgroup::")


def validate_block(path: str, index: int, block: str) -> bool:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".mmd", delete=False, encoding="utf-8") as f:
        f.write(block)
        tmp_in = f.name
    tmp_out = tmp_in + ".svg"
    tmp_size = os.path.getsize(tmp_in)
    cmd = ["mmdc", "-i", tmp_in, "-o", tmp_out]

    emit_debug(
        f"file={path} block={index} tmp_in={tmp_in} tmp_out={tmp_out} "
        f"size_bytes={tmp_size} encoding=utf-8 command={shlex.join(cmd)}"
    )

    timed_out = False
    exception_text = None
    result = None
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=MMDC_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired as e:
        # Previously uncaught — this crashed the entire script with no
        # per-block annotation at all. Now treated as an ordinary failure.
        timed_out = True
        exception_text = str(e)
    except Exception as e:
        exception_text = f"{type(e).__name__}: {e}"

    try:
        success = result is not None and result.returncode == 0 and not timed_out and exception_text is None
        if success:
            return True

        exit_code = result.returncode if result is not None else None
        signal_note = None
        if exit_code is not None and exit_code < 0:
            signal_note = f"Terminated by signal {-exit_code}."

        stdout_text = result.stdout if result is not None else ""
        stderr_text = result.stderr if result is not None else ""

        if timed_out:
            short_reason = f"timed out after {MMDC_TIMEOUT_SECONDS}s"
        elif exception_text:
            short_reason = exception_text.splitlines()[0]
        elif stderr_text.strip():
            short_reason = stderr_text.strip().splitlines()[0]
        else:
            short_reason = f"exit code {exit_code}"

        emit_error_annotation(
            path,
            f"Mermaid block {index} failed to parse ({short_reason}) "
            f"— full command/exit-code/stdout/stderr in the job log below.",
        )

        print(f"::group::Mermaid block failure: {path} (block {index})")
        print(f"Original markdown file: {path}")
        print(f"Block number: {index}")
        print(f"Temporary file: {tmp_in} ({tmp_size} bytes, utf-8)")
        print(f"Command: {shlex.join(cmd)}")
        print(f"Exit code: {exit_code if exit_code is not None else 'N/A — see exception below'}")
        if signal_note:
            print(signal_note)
        print(f"Timed out (> {MMDC_TIMEOUT_SECONDS}s): {timed_out}")
        if exception_text:
            print(f"Exception: {exception_text}")
        print("--- stdout (complete, untruncated) ---")
        print(stdout_text if stdout_text else "(empty)")
        print("--- stderr (complete, untruncated) ---")
        print(stderr_text if stderr_text else "(empty)")
        print("::endgroup::")
        return False
    finally:
        for p in (tmp_in, tmp_out):
            if os.path.exists(p):
                os.unlink(p)


def main() -> int:
    root = "."
    ok = True
    checked = 0
    for path in find_markdown_files(root):
        text = open(path, encoding="utf-8").read()
        blocks = MERMAID_BLOCK.findall(text)
        for i, block in enumerate(blocks, start=1):
            checked += 1
            if not validate_block(path, i, block):
                ok = False
    print(f"Checked {checked} mermaid block(s).")
    if not ok:
        print_environment_diagnostics()
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
