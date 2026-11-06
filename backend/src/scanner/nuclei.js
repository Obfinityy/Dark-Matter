// Dark Matter rule-based scanner — Nuclei driver.
// Runs docker/tools/nuclei/run-nuclei.sh (projectdiscovery/nuclei, MIT)
// against the authorized target and normalizes its JSONL output.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCmd, parseJsonl } from './runner.js';

const TOOLS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docker/tools'
);

// Curated info/low-severity templates that the main critical,high,medium
// sweep can NEVER fire, even when the condition exists on the target —
// verified 6 Nov 2026 (NUCLEI-25 lane, standalone sweeps vs the 5 authorised
// labs on EC2; every path below exists in the 14,104-YAML cache, checked
// that day). Each entry maps to a coverage-ledger row:
//   directory-listing            -> #245 Directory Listing Enabled
//   cors-misconfig               -> #417 CORS / CSP wildcards
//   csp-script-src-wildcard      -> #417 (CSP half)
//   weak-csp-detect              -> #417 (CSP half)
//   missing-sri                  -> #423 CDN script without integrity (PROVEN 6 Nov: fired on Juice Shop /)
//   swagger-api                  -> #253 Shadow / Zombie / Deprecated APIs (PROVEN 6 Nov: fired on Juice Shop /api-docs/swagger.json)
//   openapi                      -> #253 (PROVEN 6 Nov: fired on VAmPI /openapi.json)
//   debug-vars                   -> #244/#413 Debug mode enabled
//   php-eol                      -> #111 Unpatched Web Server / Framework (PROVEN 6 Nov: bWAPP runs PHP/5.5.9, EOL)
//   apache-httpd-eol             -> #111
//   express-stack-trace          -> #255/#419 Verbose errors / stack traces
//   phpcli-stack-trace           -> #255/#419
//   lucee-stack-trace            -> #255/#419
// DELIBERATELY EXCLUDED: http/miscellaneous/options-method.yaml. It fires
// whenever OPTIONS is allowed, but that does NOT prove the rows it would
// map to (#254/#415 "PUT/DELETE/TRACE enabled"): on VAmPI it fired while
// PUT/DELETE/TRACE all return 405 (Allow: GET, HEAD, OPTIONS). Surfacing
// it as a verified finding would be a false positive by construction.
export const NUCLEI_TARGETED_TEMPLATES = [
  'http/miscellaneous/directory-listing.yaml',
  'http/vulnerabilities/generic/cors-misconfig.yaml',
  'http/misconfiguration/csp-script-src-wildcard.yaml',
  'http/misconfiguration/weak-csp-detect.yaml',
  'http/misconfiguration/missing-sri.yaml',
  'http/exposures/apis/swagger-api.yaml',
  'http/exposures/apis/openapi.yaml',
  'http/exposures/configs/debug-vars.yaml',
  'http/technologies/eol/php-eol.yaml',
  'http/technologies/eol/apache-httpd-eol.yaml',
  'http/misconfiguration/express-stack-trace.yaml',
  'http/misconfiguration/phpcli-stack-trace.yaml',
  'http/exposures/logs/lucee-stack-trace.yaml',
];

// The targeted pass runs with the full severity range because its list is
// curated to genuine misconfiguration checks — no fingerprinting/tech-detect
// noise. Widening the MAIN sweep this way would flood scans; the narrow
// list is the whole point.
export const NUCLEI_TARGETED_SEVERITY = 'info,low,medium,high,critical';

// Per-pass timeout for BOTH nuclei passes (6 Nov 2026, raised 300s → 600s).
// Lab re-validation measured nuclei phases at 304–319s on every lab vs the
// old 300s cap, and VAmPI's main pass timed out at 300s (ok=false,
// timedOut=true) — main-pass coverage truncated, though the targeted pass
// still found OpenAPI. A main pass that completes runs ~290–320s, so 600s
// is ~2x the slowest observed pass: headroom for a cold template cache, a
// loaded 2vCPU box, and slower targets, while still bounding the worst
// case (2 passes x 600s = 20 min nuclei phase; the typical case is
// unchanged at ~320s because the pass now completes instead of timing
// out). Single source of truth: scannerHunt.js passes this constant
// explicitly, and the runNuclei default below is the same value, so a
// caller that omits it gets the same cap by construction.
export const NUCLEI_TIMEOUT_MS = 600000;

function normalizeNucleiJsonl(stdout, url) {
  return parseJsonl(stdout).map((f) => ({
    class: 'nuclei',
    id: String(f['template-id'] || f.templateID || 'unknown-template'),
    title: String((f.info && f.info.name) || f['template-id'] || 'Nuclei finding'),
    severity: String((f.info && f.info.severity) || 'unknown').toLowerCase(),
    url: String(f['matched-at'] || f.host || url),
    // Nuclei templates are verified-check by construction (see run-nuclei.sh):
    // the match itself is the differential signal.
    evidence: {
      request: `nuclei ${f['template-id']} vs ${url}`,
      response: `matched at ${f['matched-at'] || f.host}`,
      impact_demo:
        (f.info && (f.info.description || f.info.name)) || 'verified-check template match',
      signalCorrelated: true,
    },
    raw: f,
  }));
}

// Merge the main + targeted finding lists, deduping on template-id +
// matched-at (a targeted template with medium+ severity would otherwise
// appear twice). Pure — unit-tested in nuclei.test.js.
export function mergeNucleiFindings(main, targeted) {
  const seen = new Set();
  const out = [];
  for (const f of [...(main || []), ...(targeted || [])]) {
    const key = `${f.id || ''}|${f.url || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

export async function runNuclei(
  url,
  { severity = 'critical,high,medium', nucleiTimeoutMs = NUCLEI_TIMEOUT_MS, cmdRunner = runCmd } = {}
) {
  // Nuclei gets its OWN dedicated timeout. The generic runScan timeoutMs
  // (15s standard / 30s deep) is tuned for fast HTTP probes, but a full
  // Nuclei template run needs minutes — inheriting the short generic timeout
  // silently killed every nuclei phase before any template completed
  // (0 findings, empty errors). The generic opts.timeoutMs is therefore
  // deliberately IGNORED here; callers override via nucleiTimeoutMs.
  const script = path.join(TOOLS_DIR, 'nuclei', 'run-nuclei.sh');
  const r = await cmdRunner('bash', [script, url, severity], { timeoutMs: nucleiTimeoutMs });
  const mainFindings = normalizeNucleiJsonl(r.stdout, url);
  // Targeted second pass (6 Nov 2026, NUCLEI-25): the curated info/low
  // templates above can never fire under the main severity filter, so they
  // run separately with the full severity range. Only 13 templates, so this
  // pass is fast (template load dominates; ~1 min) next to the full sweep.
  // opts.cmdRunner is the test seam (defaults to the real runCmd): unit
  // tests must never spawn docker/nuclei. Production callers never pass it.
  const rt = await cmdRunner(
    'bash',
    [script, url, NUCLEI_TARGETED_SEVERITY, NUCLEI_TARGETED_TEMPLATES.join(',')],
    { timeoutMs: nucleiTimeoutMs }
  );
  const targetedFindings = normalizeNucleiJsonl(rt.stdout, url);
  const findings = mergeNucleiFindings(mainFindings, targetedFindings);
  return {
    ok: Boolean(r.ok && rt.ok),
    timedOut: Boolean(r.timedOut || rt.timedOut),
    findings,
    stderr: [r.stderr, rt.stderr].filter(Boolean).join('\n'),
  };
}

// Phase-record extras for the nuclei step (5 Nov 2026, phase-visibility
// fix). runNuclei returns ok/timedOut/stderr beyond its findings, and the
// scanner used to drop all three — a nuclei timeout/failure vanished with
// no trace. stderr is capped to its last ~500 chars so a noisy failure
// cannot bloat the hunt event log. Pure — unit-tested in nuclei.test.js.
export function nucleiPhaseFields(result) {
  return {
    ok: Boolean(result && result.ok),
    timedOut: Boolean(result && result.timedOut),
    stderrTail: String((result && result.stderr) || '').slice(-500),
  };
}
