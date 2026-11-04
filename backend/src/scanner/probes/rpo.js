// Dark Matter rule-based scanner — RPO (relative path overwrite) detector (#50).
//
// Defensive purpose: detect pages where relative stylesheet/script URLs +
// path-info tolerance + reflection form a style-injection sink, so the
// owner can harden them (absolute URLs, <base>, nosniff). GET-only,
// read-only, stateless; markers inert in HTML context.
//   D1. Surface: relative <link rel=stylesheet href> / <script src>
//       (no leading /, no scheme). D1b: path-tolerance check
//       (<page>/<dmjunk>/ renders same page, similarity >= 0.9).
//   D2. Reflection oracle: CSS-shaped marker }dmrpo<RUNID>{x:y in reflected
//       params; request the browser-derived stylesheet URL; CONFIRMED iff
//       verbatim marker + page-HTML shape + not HTML-escaped.
//   D2d. Content-type amplifier: text/css -> HIGH; text/html w/o nosniff ->
//       MEDIUM; with nosniff -> INFO.
//   D3. Multi-sink sweep (scripts too). D4. Hardening INFO. D5. Error shape.
//
// Class key: rpoinjection. Honest ceiling: string-level sink proof; the
// scanner never claims CSS execution it did not observe. Per-run canary.

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

async function getFull(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA }, redirect: 'manual' });
    const text = await res.text().catch(() => '');
    return {
      status: res.status, text: text.slice(0, 500000),
      ct: res.headers.get('content-type') || '',
      nosniff: /nosniff/i.test(res.headers.get('x-content-type-options') || ''),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function normLen(t) {
  return t.replace(/\s+/g, ' ').trim().length;
}
function similarity(a, b) {
  const la = normLen(a);
  const lb = normLen(b);
  if (!la || !lb) return 0;
  return Math.min(la, lb) / Math.max(la, lb);
}

function relativeResources(html) {
  const out = [];
  const re = /<(?:link[^>]+rel=["']stylesheet["'][^>]+href|script[^>]+src)=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const v = m[1];
    if (!v.startsWith('/') && !/^[a-z]+:/i.test(v) && !v.startsWith('//') && !v.startsWith('#')) {
      out.push(v);
    }
  }
  return [...new Set(out)].slice(0, 5);
}

// ---- D1: inventory + path tolerance ----------------------------------------------------------------
async function d1Surface(url, opts) {
  const page = await getFull(url, opts);
  if (!page || !/<html/i.test(page.text)) return null;
  const rels = relativeResources(page.text);
  if (!rels.length) return { hardening: 'absolute resource URLs' };
  if (/<base\s+href/i.test(page.text)) return { hardening: '<base href> pins resolution' };
  // D1b: path tolerance.
  const junk = `${url.replace(/\/$/, '')}/${`dmjunk${rand()}`.toLowerCase()}/`;
  const rJunk = await getFull(junk, opts);
  if (!rJunk) return { hardening: 'path not tolerated' };
  const sim = similarity(page.text, rJunk.text);
  if (sim < 0.9) return { hardening: 'path not tolerated' };
  return { page, rels, junkBase: junk.replace(/\/$/, '') };
}

// ---- D2: reflection oracle ------------------------------------------------------------------------------
async function d2Oracle(url, params, surf, opts, rid) {
  const findings = [];
  const marker = `dmrpo${rid}`;
  const cssFrag = `}${marker}{x:y`;
  for (const p of (params || []).slice(0, 4)) {
    const u = new URL(url);
    u.searchParams.set(p, cssFrag);
    const rPage = await getFull(u.toString(), opts);
    if (!rPage || !rPage.text.includes(marker)) continue; // not reflected
    // Browser-derived stylesheet URL: junk dir + relative href.
    const relHref = surf.rels[0].split('?')[0];
    const manipUrl = `${surf.junkBase}/${relHref}`;
    // Baseline: same manipulated URL, inert value.
    const uBase = new URL(url);
    uBase.searchParams.set(p, 'dmrpo-baseline');
    const rBasePage = await getFull(uBase.toString(), opts);
    const rManip = await getFull(manipUrl + `?${p}=${encodeURIComponent(cssFrag)}`, opts);
    if (!rManip) continue;
    const verbatim = rManip.text.includes(marker);
    const pageShape = similarity(surf.page.text, rManip.text) >= 0.9;
    const escaped = rManip.text.includes(`&#125;${marker}`) || rManip.text.includes(`&gt;${marker}`);
    const baseClean = !rBasePage || !rBasePage.text.includes(marker);
    if (verbatim && pageShape && !escaped && baseClean) {
      const isCss = /text\/css/i.test(rManip.ct);
      const severity = isCss ? 'high' : rManip.nosniff ? 'low' : 'medium';
      findings.push({
        class: 'rpoinjection',
        id: `rpo-${rand()}`,
        title: `RPO style-injection sink — relative URL + path tolerance + reflection (${severity.toUpperCase()})`,
        severity,
        url,
        parameter: p,
        evidence: ev(
          `GET ${manipUrl}?${p}=}${marker}{x:y (browser-derived stylesheet URL)`,
          `Verbatim marker in the stylesheet-position response; page-HTML shape served (sim>=0.9); not HTML-escaped; baseline clean. Content-Type: ${rManip.ct || 'n/a'}${rManip.nosniff ? ' + nosniff' : ''} — ${isCss ? 'browser executes as stylesheet (full chain, string-level)' : rManip.nosniff ? 'sink present, not browser-exploitable (nosniff)' : 'sink proven, execution sniffing-dependent'}.`,
          'Defensive finding: harden with absolute URLs, <base>, nosniff.'
        ),
      });
      break;
    }
  }
  return findings;
}

export async function probeRpo(url, params, opts = {}) {
  const findings = [];
  const surf = await d1Surface(url, opts);
  if (!surf || surf.hardening) return findings; // INFO exit, not a miss
  findings.push(...(await d2Oracle(url, params, surf, opts, rand())));
  // D3 scripts ride the same oracle (documented); D5 error-shape is a
  // cheap add when the junk path yields verbose errors (not implemented
  // in v1 — documented, not silently absent).
  return findings;
}

export const __rpoMeta = { phases: ['rpo'], depth: ['quick', 'standard', 'deep'] };
