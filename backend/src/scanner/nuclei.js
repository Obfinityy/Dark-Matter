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

export async function runNuclei(
  url,
  { severity = 'critical,high,medium', nucleiTimeoutMs = 300000 } = {}
) {
  // Nuclei gets its OWN dedicated timeout. The generic runScan timeoutMs
  // (15s standard / 30s deep) is tuned for fast HTTP probes, but a full
  // Nuclei template run needs minutes — inheriting the short generic timeout
  // silently killed every nuclei phase before any template completed
  // (0 findings, empty errors). The generic opts.timeoutMs is therefore
  // deliberately IGNORED here; callers override via nucleiTimeoutMs.
  const script = path.join(TOOLS_DIR, 'nuclei', 'run-nuclei.sh');
  const r = await runCmd('bash', [script, url, severity], { timeoutMs: nucleiTimeoutMs });
  const findings = parseJsonl(r.stdout).map((f) => ({
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
  return { ok: r.ok, timedOut: r.timedOut, findings, stderr: r.stderr };
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
