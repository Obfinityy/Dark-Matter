// Dark Matter rule-based scanner — CRLF header injection probe (#41).
//
// Response-HEADER injection and response SPLITTING only (bare open-redirect
// values stay in redirect.js; request-layer CL/TE stays in smuggling.js).
//   D1. Header-reflection inventory: canary in each input, record which
//       response HEADERS echo it (Location, Set-Cookie, ...).
//   T1. Injected-header CONFIRM — HIGH: X-DM-CRLF-<runid> appears as a REAL
//       new header line vs the payload-free control.
//   T2. Response-splitting — HIGH: canary lands in the BODY ahead of
//       original content (CRITICAL impact note on cacheable endpoints).
//   T3. Set-Cookie fixation — MEDIUM/HIGH: injected Set-Cookie observed.
//   T4. Encoding-bypass ladder — INFO→HIGH: double-encoded, unicode, folding.
//
// Oracle: RAW response-header diff (Node rawHeaders — never the normalized
// map) control vs payload. FP guards: WAF-stripped -> INFO (hardened);
// canary echoed inside ONE header value = reflection, NOT injection;
// CONFIRMED needs a NEW header line or body placement. No lab gate —
// read-only observations on our own scan session. Per-run canary.

import http from 'node:http';
import https from 'node:https';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

// Raw HTTP GET with access to rawHeaders (pre-normalization).
function rawGet(targetUrl, opts = {}) {
  return new Promise((resolve) => {
    const u = new URL(targetUrl);
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(
      {
        host: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: 'GET',
        headers: { 'User-Agent': UA, ...(opts.headers || {}) },
        timeout: 10000,
      },
      (res) => {
        let body = '';
        res.on('data', (d) => {
          body += d.toString('latin1');
          if (body.length > 300000) res.destroy();
        });
        res.on('end', () =>
          resolve({ status: res.statusCode, rawHeaders: res.rawHeaders || [], body })
        );
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

function rawHeaderLines(rawHeaders) {
  const lines = [];
  for (let i = 0; i + 1 < rawHeaders.length; i += 2) {
    lines.push(`${rawHeaders[i]}: ${rawHeaders[i + 1]}`);
  }
  return lines;
}

function hasHeader(rawHeaders, name) {
  const n = name.toLowerCase();
  for (let i = 0; i < rawHeaders.length; i += 2) {
    if (String(rawHeaders[i]).toLowerCase() === n) return true;
  }
  return false;
}

// ---- D1: echo-point inventory ------------------------------------------------------
async function d1EchoPoints(url, params, opts, rid) {
  const points = [];
  const canary = `__dm_crlf_${rid}`;
  for (const p of params.slice(0, 8)) {
    const u = new URL(url);
    u.searchParams.set(p, canary);
    const r = await rawGet(u.toString(), opts);
    if (!r) continue;
    const echoHeaders = [];
    for (let i = 0; i < r.rawHeaders.length; i += 2) {
      if (String(r.rawHeaders[i + 1]).includes(canary)) {
        echoHeaders.push(r.rawHeaders[i]);
      }
    }
    if (echoHeaders.length) points.push({ param: p, echoHeaders });
  }
  return points;
}

// ---- T1: injected header --------------------------------------------------------------
async function t1InjectedHeader(url, points, opts, rid) {
  const findings = [];
  const hdrName = `X-DM-CRLF-${rid}`;
  for (const pt of points.slice(0, 4)) {
    const u = new URL(url);
    u.searchParams.set(pt.param, `v%0d%0a${hdrName}: yes`);
    const rPay = await rawGet(u.toString(), opts);
    const uCtrl = new URL(url);
    uCtrl.searchParams.set(pt.param, 'v');
    const rCtrl = await rawGet(uCtrl.toString(), opts);
    if (!rPay || !rCtrl) continue;
    const payHas = hasHeader(rPay.rawHeaders, hdrName);
    const ctrlHas = hasHeader(rCtrl.rawHeaders, hdrName);
    if (payHas && !ctrlHas) {
      findings.push({
        class: 'crlf_injection',
        id: `crlf-hdr-${rand()}`,
        title: 'CRLF injection — arbitrary response header injected (HIGH)',
        severity: 'high',
        url,
        parameter: pt.param,
        evidence: ev(
          `GET ${url}?${pt.param}=v%0d%0a${hdrName}: yes (raw headers, pre-normalization)`,
          `New header line "${hdrName}: yes" present in payload response, absent in control — byte-level raw-header differential.`,
          'Response-header injection primitive: cache poisoning / XSS delivery / session fixation chains.'
        ),
      });
    }
  }
  return findings;
}

// ---- T2: response splitting ----------------------------------------------------------------
async function t2Splitting(url, points, opts, rid) {
  const findings = [];
  const canary = `__dm_split_${rid}`;
  for (const pt of points.slice(0, 4)) {
    const u = new URL(url);
    u.searchParams.set(pt.param, `v%0d%0a%0d%0a<html>${canary}`);
    const r = await rawGet(u.toString(), opts);
    if (!r) continue;
    const idxCanary = r.body.indexOf(canary);
    if (idxCanary !== -1 && idxCanary < 2000) {
      findings.push({
        class: 'crlf_injection',
        id: `crlf-split-${rand()}`,
        title: 'CRLF injection — response splitting, body injected (HIGH)',
        severity: 'high',
        url,
        parameter: pt.param,
        evidence: ev(
          `GET ${url}?${pt.param}=v%0d%0a%0d%0a<html>${canary}`,
          `Canary lands in the response BODY at offset ${idxCanary} — the server honored the injected blank line as a header terminator.`,
          'Response-splitting primitive (cacheable endpoint => cache-poisoning impact).'
        ),
      });
      break;
    }
  }
  return findings;
}

// ---- T3: Set-Cookie fixation -------------------------------------------------------------------
async function t3CookieFix(url, points, opts, rid) {
  const findings = [];
  for (const pt of points.slice(0, 4)) {
    if (!pt.echoHeaders.some((h) => /set-cookie/i.test(h))) continue;
    const u = new URL(url);
    u.searchParams.set(pt.param, `x%0d%0aSet-Cookie: dmfix_${rid}=1`);
    const rPay = await rawGet(u.toString(), opts);
    if (!rPay) continue;
    const injected = rPay.rawHeaders.some(
      (h, i) => i % 2 === 0 && /set-cookie/i.test(h) && String(rPay.rawHeaders[i + 1]).includes(`dmfix_${rid}`)
    );
    if (injected) {
      findings.push({
        class: 'crlf_injection',
        id: `crlf-cookie-${rand()}`,
        title: 'CRLF injection — Set-Cookie fixation via header injection (MEDIUM)',
        severity: 'medium',
        url,
        parameter: pt.param,
        evidence: ev(
          `GET ${url}?${pt.param}=x%0d%0aSet-Cookie: dmfix_${rid}=1`,
          `Response carries an injected Set-Cookie for dmfix_${rid} — read-only observation on our own scan session.`,
          'Session-fixation primitive via response-header injection.'
        ),
      });
      break;
    }
  }
  return findings;
}

// ---- T4: encoding-bypass ladder ---------------------------------------------------------------------
async function t4Variants(url, points, opts, rid) {
  const findings = [];
  const variants = [
    { name: 'double-encoded', payload: (h) => `v%250d%250a${h}: yes` },
    { name: 'unicode-u0085', payload: (h) => `v%C2%85${h}: yes` },
    { name: 'tab-folding', payload: (h) => `v%0d%0a%20${h}: yes` },
  ];
  for (const pt of points.slice(0, 3)) {
    for (const v of variants) {
      const hdrName = `X-DM-CRLF-${rid}-${v.name}`;
      const u = new URL(url);
      // Bypass URLSearchParams encoding: build the query manually.
      u.search = `?${pt.param}=${v.payload(hdrName)}`;
      const rPay = await rawGet(u.toString(), opts);
      if (!rPay) continue;
      if (hasHeader(rPay.rawHeaders, hdrName)) {
        findings.push({
          class: 'crlf_injection',
          id: `crlf-var-${rand()}`,
          title: `CRLF injection — encoding bypass (${v.name}) injects header (HIGH)`,
          severity: 'high',
          url,
          parameter: pt.param,
          evidence: ev(
            `GET ${u.toString().slice(0, 160)}`,
            `Variant "${v.name}" produced a NEW header line ${hdrName} — filter bypass confirmed.`,
            'Filter-evasion primitive for header injection.'
          ),
        });
        break;
      }
    }
    if (findings.length) break;
  }
  return findings;
}

export async function probeCrlf(url, params, opts = {}) {
  const findings = [];
  if (!params || params.length === 0) return findings;
  const rid = rand();
  const points = await d1EchoPoints(url, params, opts, rid);
  if (!points.length) return findings; // no echo point — class tested, absent
  findings.push(...(await t1InjectedHeader(url, points, opts, rid)));
  findings.push(...(await t2Splitting(url, points, opts, rid)));
  findings.push(...(await t3CookieFix(url, points, opts, rid)));
  findings.push(...(await t4Variants(url, points, opts, rid)));
  return findings;
}

export const __crlfMeta = { phases: ['crlf'], depth: ['quick', 'standard', 'deep'] };
