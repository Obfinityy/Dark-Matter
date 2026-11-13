// Dark Matter rule-based scanner — blind SQL injection probe.
// Two legs, one file:
//   (a) TIME-BASED (probeBlindSqli): a SQL SLEEP payload must ADD ~5s
//       to the response time vs baseline. Uses the same double-baseline
//       + pure-differential pattern as the cmdi probe.
//   (b) BOOLEAN-BASED (probeBooleanBlindSqli, coverage row #278
//       [High]): TRUE/FALSE payload pairs (`1' AND 1=1-- -` vs
//       `1' AND 1=2-- -`) — confirm ONLY when TRUE returns the
//       baseline page, FALSE changes it, and a repeat reproduces both
//       in the same direction. Volatile values are stripped before
//       the differential (oracleGuards.js, proof #18). Lab-gated.
import { randomBytes } from 'node:crypto';
import { detectDbError } from '../fingerprint.js';
import { isLabTargetHost } from '../../labCreds.js';
import { stripVolatileValues } from './oracleGuards.js';
import { mutateUrl, probePointName, probePointParameter, noteAttemptedPoints } from '../probePoints.js';

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
  noteAttemptedPoints(opts, params.slice(0, 6));
  for (const param of params.slice(0, 6)) {
    const base1 = await getTimed(mutateUrl(url, param, '1'), opts).catch(() => null);
    const base2 = await getTimed(mutateUrl(url, param, '2'), opts).catch(() => null);
    if (!base1 || !base1.ok || !base2 || !base2.ok) continue;
    if (Math.abs(base1.ms - base2.ms) > 2000) continue; // jittery page
    const baseMs = Math.max(base1.ms, base2.ms);
    const injected = await getTimed(mutateUrl(url, param, mkPayload(SLEEP_S)), {
      ...opts,
      timeoutMs: 35000,
    }).catch(() => null);
    if (!injected || !injected.ok) continue;
    const delayTracks = injected.ms - baseMs >= (SLEEP_S - 1) * 1000;
    if (delayTracks) {
      findings.push({
        class: 'sqli_blind',
        id: `sqli-blind-${probePointName(param)}`,
        title: `Blind (time-based) SQL injection in parameter '${probePointParameter(param)}'`,
        severity: 'critical',
        url,
        param: probePointParameter(param),
        evidence: {
          request: `GET ${mutateUrl(url, param, mkPayload(SLEEP_S))}`,
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

// Pure oracle decision for the boolean-blind leg, exported for unit
// tests: TRUE must return the baseline page, FALSE must change it,
// and a repeat must reproduce both in the same direction.
export function booleanBlindConfirms({ baseline, trueBody, falseBody, trueRepeat, falseRepeat }) {
  if (trueBody !== baseline) return false; // TRUE does not return the normal page
  if (falseBody === baseline) return false; // FALSE does not change the page
  if (trueBody === falseBody) return false;
  if (trueRepeat !== trueBody) return false; // repeat does not reproduce TRUE
  if (falseRepeat !== falseBody) return false; // repeat does not reproduce FALSE
  return true;
}

async function getBody(url, opts = {}) {
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

// Boolean-based blind SQLi (row #278 [High]): the injected condition
// is TRUE on one request and FALSE on the next, and the application
// answers differently. No timing is involved — the channel is the
// response content itself. A DB error on either leg belongs to the
// error-based probe (sqliError.js), never this one: an erroring leg
// voids the pair instead of confirming.
//
// LAB-GATED: payloads go out ONLY when the target host is listed in
// opts.labTargets. A non-lab target returns [] without a single
// request — a skip, never a negative.
//
// Budget: 5 requests per param (baseline + TRUE/FALSE + repeat
// TRUE/FALSE); params capped at 6, same as the time-based leg.
export async function probeBooleanBlindSqli(url, params, opts = {}) {
  const findings = [];
  if (!isLabTargetHost(url, opts.labTargets)) return findings;
  noteAttemptedPoints(opts, params.slice(0, 6));
  for (const param of params.slice(0, 6)) {
    const baseline = await getBody(mutateUrl(url, param, '1'), opts).catch(() => null);
    if (!baseline) continue;
    const trueBody = await getBody(mutateUrl(url, param, "1' AND 1=1-- -"), opts).catch(() => null);
    const falseBody = await getBody(mutateUrl(url, param, "1' AND 1=2-- -"), opts).catch(() => null);
    if (!trueBody || !falseBody) continue;
    // An erroring leg is error-based SQLi, not boolean-blind.
    if (detectDbError(trueBody.text) || detectDbError(falseBody.text)) continue;
    const trueRepeat = await getBody(mutateUrl(url, param, "1' AND 1=1-- -"), opts).catch(() => null);
    const falseRepeat = await getBody(mutateUrl(url, param, "1' AND 1=2-- -"), opts).catch(() => null);
    if (!trueRepeat || !falseRepeat) continue;
    if (detectDbError(trueRepeat.text) || detectDbError(falseRepeat.text)) continue;
    const norm = (res) => stripVolatileValues(res.text);
    if (
      !booleanBlindConfirms({
        baseline: norm(baseline),
        trueBody: norm(trueBody),
        falseBody: norm(falseBody),
        trueRepeat: norm(trueRepeat),
        falseRepeat: norm(falseRepeat),
      })
    ) {
      continue;
    }
    findings.push({
      class: 'sqli_boolean_blind',
      id: `sqli-boolean-blind-${probePointName(param)}`,
      title: `Blind (boolean-based) SQL injection in parameter '${probePointParameter(param)}'`,
      severity: 'high',
      url,
      param: probePointParameter(param),
      evidence: {
        request: `GET ${mutateUrl(url, param, "1' AND 1=1-- -")} vs GET ${mutateUrl(url, param, "1' AND 1=2-- -")}`,
        response: 'TRUE variant returns the baseline page, FALSE variant changes it, repeat reproduces both in the same direction',
        impact_demo: "boolean condition '1=1' vs '1=2' changes the response — the query result is attacker-controlled",
        booleanDiverges: true,
        signalCorrelated: true,
      },
    });
  }
  return findings;
}
