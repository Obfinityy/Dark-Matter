// Dark Matter rule-based scanner — blind (time-based) SQL injection probe.
// Oracle: a SQL SLEEP payload must ADD ~5s to the response time vs baseline.
// Uses the same double-baseline + pure-differential pattern as the cmdi probe.
import { randomBytes } from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

async function getTimed(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 30000);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    });
    await res.text().catch(() => '');
    return { ms: Date.now() - start, ok: true };
  } catch {
    return { ms: Date.now() - start, ok: false };
  } finally {
    clearTimeout(t);
  }
}

function withParam(url, name, value) {
  const u = new URL(url);
  u.searchParams.set(name, value);
  return u.toString();
}

// DB-specific sleep payloads. MySQL is the most common; the others cover
// MSSQL/PostgreSQL/Oracle for fingerprint-driven selection later.
const SLEEP_PAYLOADS = {
  mysql: (s) => `1' AND SLEEP(${s})-- -`,
  mssql: (s) => `1'; WAITFOR DELAY '0:0:${s}'--`,
  pgsql: (s) => `1'; SELECT pg_sleep(${s})--`,
};

export async function probeBlindSqli(url, params, opts = {}) {
  const findings = [];
  const SLEEP_S = 5;
  const dbHint = (opts.dbHint || 'mysql').toLowerCase();
  const mkPayload = SLEEP_PAYLOADS[dbHint] || SLEEP_PAYLOADS.mysql;
  for (const param of params.slice(0, 6)) {
    const base1 = await getTimed(withParam(url, param, '1'), opts).catch(() => null);
    const base2 = await getTimed(withParam(url, param, '2'), opts).catch(() => null);
    if (!base1 || !base1.ok || !base2 || !base2.ok) continue;
    if (Math.abs(base1.ms - base2.ms) > 2000) continue; // jittery page
    const baseMs = Math.max(base1.ms, base2.ms);
    const injected = await getTimed(withParam(url, param, mkPayload(SLEEP_S)), {
      ...opts,
      timeoutMs: 35000,
    }).catch(() => null);
    if (!injected || !injected.ok) continue;
    const delayTracks = injected.ms - baseMs >= (SLEEP_S - 1) * 1000;
    if (delayTracks) {
      findings.push({
        class: 'sqli_blind',
        id: `sqli-blind-${param}`,
        title: `Blind (time-based) SQL injection in parameter '${param}'`,
        severity: 'critical',
        url,
        param,
        evidence: {
          request: `GET ${withParam(url, param, mkPayload(SLEEP_S))}`,
          response: `response took ${injected.ms}ms vs ${baseMs}ms baseline`,
          impact_demo: `SQL SLEEP(${SLEEP_S}) tracks the response delay (${dbHint} dialect)`,
          delayTracks: true,
          signalCorrelated: true,
        },
        dbFamily: dbHint,
      });
    }
  }
  return findings;
}
