// Dark Matter rule-based scanner — reflected XSS probe.
// Oracle: unique canary reflected UNENCODED (canaryReflected), with an
// HTML-encoded variant as the control (must not reflect raw).
//
// URI-SCHEME leg (14 Nov 2026, row #272 [Medium] XSS — JavaScript URI /
// data URI): a second oracle in the same file, probeXssUriScheme. A
// javascript: / data:text/html, value executes only when it lands in an
// attribute the browser treats as a navigable URL (href/src/action/
// formaction) — so the leg confirms ONLY on a verbatim scheme + canary
// inside such an attribute. A bare text echo of the same value proves
// nothing (the plain reflected probe already covers raw reflection) and
// never confirms here; that attribute-context requirement IS the
// control. No browser execution is needed for the reflection proof —
// execution proof is a CDP step, as in cssInjection.js. Severity is
// medium (click-required), matching the row's [Medium] filing — unlike
// the load-time break-out payload, which stays high.
import { randomBytes } from 'node:crypto';
import { mutateUrl, probePointName, probePointParameter, noteAttemptedPoints } from '../probePoints.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

export const URI_SCHEMES = ['javascript:', 'data:text/html,'];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Shared with storedXss.js: does `value` (an executable URI scheme +
// canary) appear verbatim inside a navigable-URL attribute?
export function uriSchemeInAttribute(body, value) {
  const re = new RegExp(
    `(?:href|src|action|formaction|xlink:href)\\s*=\\s*["']?${escapeRegExp(value)}`,
    'i',
  );
  return re.test(body);
}

async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    return await res.text().catch(() => '');
  } finally {
    clearTimeout(t);
  }
}


export async function probeXssReflected(url, params, opts = {}) {
  const findings = [];
  noteAttemptedPoints(opts, params.slice(0, 10));
  for (const param of params.slice(0, 10)) {
    const rand = randomBytes(4).toString('hex');
    const payload = `'"<>${`dmxss${rand}`}`;
    let body;
    try {
      body = await get(mutateUrl(url, param, payload), opts);
    } catch {
      continue;
    }
    if (!body.includes(payload)) continue;
    // Control: the HTML-encoded variant must not come back raw.
    const encoded = payload
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    let body2 = '';
    try {
      body2 = await get(mutateUrl(url, param, encoded), opts);
    } catch {
      // ignore control failure
    }
    const pIdx = body.indexOf(payload);
    const pWindow = pIdx >= 0 ? body.slice(Math.max(0, pIdx - 60), pIdx + 120) : body.slice(0, 200);
    findings.push({
      class: 'xss_reflected',
      id: `xss-reflected-${probePointName(param)}`,
      title: `Reflected XSS in parameter '${probePointParameter(param)}'`,
      severity: 'high',
      url,
      param: probePointParameter(param),
      evidence: {
        request: `GET ${mutateUrl(url, param, payload)}`,
        response: `payload reflected unencoded — "...${pWindow}..."`,
        impact_demo:
          body2.includes(encoded) && !body2.includes(payload)
            ? 'encoded variant neutralized — raw variant is the executable one'
            : 'raw payload reflected verbatim in HTML context',
        canaryReflected: true,
      },
    });
  }
  return findings;
}

export async function probeXssUriScheme(url, params, opts = {}) {
  const findings = [];
  noteAttemptedPoints(opts, params.slice(0, 10));
  for (const param of params.slice(0, 10)) {
    for (const scheme of URI_SCHEMES) {
      const rand = randomBytes(4).toString('hex');
      const payload = `${scheme}dmxss${rand}`;
      let body;
      try {
        body = await get(mutateUrl(url, param, payload), opts);
      } catch {
        continue;
      }
      if (!uriSchemeInAttribute(body, payload)) continue;
      const m = new RegExp(escapeRegExp(payload), 'i').exec(body);
      const pIdx = m ? m.index : -1;
      const pWindow = pIdx >= 0 ? body.slice(Math.max(0, pIdx - 60), pIdx + 120) : body.slice(0, 200);
      findings.push({
        class: 'xss_uri_scheme',
        id: `xss-uri-scheme-${probePointName(param)}-${scheme.replace(/[^a-z]/g, '')}`,
        title: `Reflected XSS via ${scheme} URI in parameter '${probePointParameter(param)}'`,
        severity: 'medium',
        url,
        param: probePointParameter(param),
        evidence: {
          request: `GET ${mutateUrl(url, param, payload)}`,
          response: `${scheme} URI reflected verbatim in an attribute context — "...${pWindow}..."`,
          impact_demo: 'a javascript:/data: URI in an href/src attribute executes when the victim clicks the link — no script tag needed',
          canaryReflected: true,
          scheme,
        },
      });
    }
  }
  return findings;
}
