// Dark Matter rule-based scanner — union-based SQL injection probe.
// Coverage row #277 [Critical], CWE-89.
//
// Oracle: discover the column count (ORDER BY n differential), then
// confirm ONLY when a UNION SELECT returns attacker-chosen data (a
// numeric canary) in the response where the benign query did not,
// with a control UNION carrying a DIFFERENT canary proving the
// channel is live and the probe canary is not stale/static.
//
// The canary is NUMERIC (1337 + 4 random digits), placed in EVERY
// column of the UNION SELECT: the first column's type is unknown, and
// a string canary would be coerced to 0 by a numeric column while a
// number renders in both numeric and text columns. Oracle dialect
// appends FROM DUAL (Oracle needs a table for a bare SELECT).
//
// LAB-GATED (safety requirement): UNION payloads go out ONLY when
// the target host is listed in opts.labTargets. A non-lab target
// returns [] without a single request — a skip, never a negative.
// Column-count discovery is read-only (ORDER BY + SELECT, no writes).
//
// Budget: per param, at most 10 ORDER BY probes + benign + probe +
// control UNION = 13 requests; params capped at 4 (52 requests max).
import { randomBytes } from 'node:crypto';
import { detectDbError } from '../fingerprint.js';
import { isLabTargetHost } from '../../labCreds.js';
import { mutateUrl, probePointName, probePointParameter, noteAttemptedPoints } from '../probePoints.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const MAX_ORDER_BY = 10;
const MAX_PARAMS = 4;

async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 200000) };
  } finally {
    clearTimeout(t);
  }
}

function numericCanary() {
  return `1337${randomBytes(2).readUInt16BE(0) % 10000}`.padEnd(8, '0').slice(0, 8);
}

function unionPayload(canary, columnCount, dbHint) {
  const cols = Array.from({ length: columnCount }, () => canary).join(',');
  const fromDual = dbHint === 'oracle' ? ' FROM DUAL' : '';
  return `1' UNION SELECT ${cols}${fromDual}-- -`;
}

// Pure oracle decision, exported for unit tests: all four conditions
// must hold, otherwise the UNION channel is not proven.
export function isUnionConfirmed({ benign, probeBody, controlBody, canary, controlCanary }) {
  if (!canary || !controlCanary || canary === controlCanary) return false;
  if (benign.includes(canary)) return false; // differential broken: canary on benign too
  if (!probeBody.includes(canary)) return false; // probe UNION did not return the canary
  if (controlBody.includes(canary)) return false; // control returned the PROBE canary: stale/static
  if (!controlBody.includes(controlCanary)) return false; // control did not return its own canary: channel not live
  return true;
}

function queryFailed(res) {
  if (!res) return true;
  return res.status >= 500 || Boolean(detectDbError(res.text));
}

// Column-count discovery: the largest n whose ORDER BY does not fail
// the query. Null when ORDER BY 1 already fails (not injectable here).
async function discoverColumnCount(url, param, opts) {
  let count = null;
  for (let n = 1; n <= MAX_ORDER_BY; n += 1) {
    const res = await get(mutateUrl(url, param, `1' ORDER BY ${n}-- -`), opts).catch(() => null);
    if (queryFailed(res)) break;
    count = n;
  }
  return count;
}

export async function probeSqliUnion(url, params, opts = {}) {
  const findings = [];
  if (!isLabTargetHost(url, opts.labTargets)) return findings;
  const dbHint = (opts.dbHint || 'mysql').toLowerCase();
  noteAttemptedPoints(opts, params.slice(0, MAX_PARAMS));
  for (const param of params.slice(0, MAX_PARAMS)) {
    const benign = await get(mutateUrl(url, param, '1'), opts).catch(() => null);
    if (!benign) continue;
    const columnCount = await discoverColumnCount(url, param, opts);
    if (!columnCount) continue;
    const canary = numericCanary();
    const controlCanary = numericCanary();
    if (canary === controlCanary) continue;
    const probeBody = await get(mutateUrl(url, param, unionPayload(canary, columnCount, dbHint)), opts).catch(() => null);
    if (!probeBody) continue;
    const controlBody = await get(
      mutateUrl(url, param, unionPayload(controlCanary, columnCount, dbHint)),
      opts
    ).catch(() => null);
    if (!controlBody) continue;
    if (
      !isUnionConfirmed({
        benign: benign.text,
        probeBody: probeBody.text,
        controlBody: controlBody.text,
        canary,
        controlCanary,
      })
    ) {
      continue;
    }
    const idx = probeBody.text.indexOf(canary);
    findings.push({
      class: 'sqli_union',
      id: `sqli-union-${probePointName(param)}`,
      title: `Union-based SQL injection in parameter '${probePointParameter(param)}'`,
      severity: 'critical',
      url,
      param: probePointParameter(param),
      evidence: {
        request: `GET ${mutateUrl(url, param, unionPayload(canary, columnCount, dbHint))}`,
        response: `UNION SELECT returned attacker-chosen value ${canary} — "...${probeBody.text.slice(Math.max(0, idx - 60), idx + 120)}..." — absent on the benign query, control UNION returned its own canary ${controlCanary}`,
        impact_demo: `UNION SELECT with ${columnCount} columns returns attacker-chosen data (${dbHint} dialect)`,
        unionConfirmed: true,
        columnCount,
        signalCorrelated: true,
      },
      dbFamily: dbHint,
    });
  }
  return findings;
}
