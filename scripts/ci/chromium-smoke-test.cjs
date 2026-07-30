#!/usr/bin/env node
// Minimal browser-launch smoke test for the Documentation Mermaid
// Validation workflow. Resolves and launches the exact same Chromium
// binary mermaid-cli's own bundled Puppeteer would use (never a
// separately-installed or system Chromium), opens a single blank page,
// and closes cleanly — proving the CI runtime can actually launch a
// browser before the real (larger, harder-to-diagnose) mermaid
// validator run is attempted.
//
// Evidence-gated sandbox fallback: the sandboxed launch is always tried
// first. Only if that fails does this script retry with
// --no-sandbox/--disable-setuid-sandbox, and it prints, unambiguously,
// which of the two succeeded. The workflow step fails (non-zero exit)
// if *neither* attempt succeeds — this script never continues silently
// past a launch failure.
//
// See docs/investigations/DOCUMENTATION_CI_RUNTIME_REMEDIATION_1.md for
// why this exists and why the sandbox fallback is conditional, not
// unconditional.
//
// On success, writes a small JSON file recording which launch args were
// actually required, to a path outside the repository (RUNNER_TEMP on
// GitHub Actions, the OS temp dir otherwise) — never committed, and
// consumed only by scripts/ci/validate-mermaid-blocks.py so the real
// validator's own mmdc invocations use the same, empirically-proven
// launch arguments this smoke test just confirmed.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

// Same escaping rules as scripts/ci/validate-mermaid-blocks.py's
// escape_annotation_message() — % first, then CR, then LF — see
// docs/investigations/DOCUMENTATION_CI_OBSERVABILITY_REMEDIATION_1.md.
// Without this, a raw newline in a ::error:: command truncates the
// message before GitHub ever stores it, exactly as that document
// documents happened to the Python validator's own original error text.
function escapeAnnotationMessage(text) {
  return String(text).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function emitErrorAnnotation(message) {
  console.log(`::error::${escapeAnnotationMessage(message)}`);
}

const capturedFailures = [];

function resolvePuppeteerDir() {
  const npmRoot = execSync('npm root -g').toString().trim();
  return path.join(npmRoot, '@mermaid-js', 'mermaid-cli', 'node_modules', 'puppeteer');
}

function runtimeConfigPath() {
  const dir = process.env.RUNNER_TEMP || os.tmpdir();
  return path.join(dir, 'mermaid-puppeteer-config.json');
}

async function attemptLaunch(puppeteer, executablePath, extraArgs, label) {
  console.log(`--- Attempt: ${label} (args: ${JSON.stringify(extraArgs)}) ---`);
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: extraArgs,
      timeout: 30000,
    });
    const page = await browser.newPage();
    await page.goto('about:blank');
    const title = await page.title();
    await page.close();
    console.log(`Launch succeeded (${label}). Blank page title: "${title}"`);
    return true;
  } catch (err) {
    const detail = err && err.stack ? err.stack : String(err);
    console.log(`Launch FAILED (${label}):`);
    console.log(detail);
    // Recorded (not yet emitted) so that, if every attempt fails, the
    // *complete* set of failure details — not just the last one — is
    // available for the final ::error:: annotation below. Plain
    // console.log output alone is not queryable via the public GitHub
    // annotations API without repository admin rights (confirmed
    // directly during this remediation's own verification), which is
    // exactly the gap this recording closes.
    capturedFailures.push({ label, detail });
    return false;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_e) {
        // Already closed, or never fully launched — nothing to clean up.
      }
    }
  }
}

async function main() {
  const puppeteerDir = resolvePuppeteerDir();
  console.log(`Resolved puppeteer module directory: ${puppeteerDir}`);

  // eslint-disable-next-line import/no-dynamic-require, global-require
  const puppeteer = require(puppeteerDir);
  const executablePath = puppeteer.executablePath();
  console.log(`Resolved Chromium executable path: ${executablePath}`);
  console.log(`Chromium binary exists: ${fs.existsSync(executablePath)}`);

  if (fs.existsSync(executablePath)) {
    try {
      const stat = fs.statSync(executablePath);
      const isExecutable = Boolean(stat.mode & 0o111);
      console.log(`Chromium binary executable bit set: ${isExecutable}`);
    } catch (e) {
      console.log(`Could not stat Chromium binary: ${e}`);
    }
    try {
      const version = execSync(`"${executablePath}" --version`, { timeout: 10000 }).toString().trim();
      console.log(`Chromium reports version directly: ${version}`);
    } catch (e) {
      console.log(`Chromium did not report a version when invoked directly (this alone is not fatal — a headless launch is the real test): ${e.message}`);
    }
  }

  const sandboxed = await attemptLaunch(puppeteer, executablePath, [], 'sandboxed (default)');
  if (sandboxed) {
    fs.writeFileSync(runtimeConfigPath(), JSON.stringify({ args: [] }, null, 2));
    console.log(`SMOKE TEST RESULT: PASS (sandboxed launch succeeded — no sandbox override needed). Runtime config: ${runtimeConfigPath()}`);
    process.exit(0);
  }

  console.log('Sandboxed launch failed — falling back to --no-sandbox, per the documented,');
  console.log('evidence-gated exception recorded in DOCUMENTATION_CI_RUNTIME_REMEDIATION_1.md.');
  const fallbackArgs = ['--no-sandbox', '--disable-setuid-sandbox'];
  const unsandboxed = await attemptLaunch(puppeteer, executablePath, fallbackArgs, 'unsandboxed (fallback)');
  if (unsandboxed) {
    fs.writeFileSync(runtimeConfigPath(), JSON.stringify({ args: fallbackArgs }, null, 2));
    console.log(`SMOKE TEST RESULT: PASS (required --no-sandbox fallback — see remediation doc). Runtime config: ${runtimeConfigPath()}`);
    process.exit(0);
  }

  console.log('SMOKE TEST RESULT: FAIL (browser could not launch with or without the sandbox)');
  const combined = capturedFailures
    .map((f) => `[${f.label}]\n${f.detail}`)
    .join('\n\n');
  emitErrorAnnotation(
    `Chromium smoke test failed — both launch attempts failed. Full detail below:\n\n${combined}`,
  );
  process.exit(1);
}

main().catch((err) => {
  const detail = err && err.stack ? err.stack : String(err);
  console.log('SMOKE TEST RESULT: FAIL (unexpected error)');
  console.log(detail);
  emitErrorAnnotation(`Chromium smoke test crashed unexpectedly: ${detail}`);
  process.exit(1);
});
