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
  { severity = 'critical,high,medium', timeoutMs = 300000 } = {}
) {
  const script = path.join(TOOLS_DIR, 'nuclei', 'run-nuclei.sh');
  const r = await runCmd('bash', [script, url, severity], { timeoutMs });
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
