// Dark Matter rule-based scanner — reverse tabnabbing detector (#51).
//
// Defensive purpose: find opener-capable markup missing rel=noopener so the
// owner can add the attribute. Pure static HTML analysis — zero extra
// requests beyond the page fetch; no payloads, no browser, no interaction.
//   D1. Sinks: <a>/<area>/<form target=_blank>, <base target=_blank>,
//       window.open() in handlers/inline scripts.
//   D2. Hardening oracle: rel tokens noopener|noreferrer count; nofollow
//       does NOT (explicit trap); window.open features or opener=null.
//   D3. Destination grading: external -> MEDIUM; same-origin -> LOW;
//       javascript:/#//empty -> INFO.
//   D4. <base target=_blank> amplifier. D5. Hardening INFO.
//
// Class key: tabnabbing. Proof = verbatim vulnerable element. One finding
// per page (dedupe), elements listed (cap 25).

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

async function getText(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA }, redirect: 'manual' });
    const text = await res.text().catch(() => '');
    return text.slice(0, 500000);
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}

function etld1(host) {
  const parts = host.split('.').filter(Boolean);
  return parts.length <= 2 ? host : parts.slice(-2).join('.');
}

function relHardened(rel) {
  const toks = String(rel || '').toLowerCase().split(/\s+/);
  return toks.includes('noopener') || toks.includes('noreferrer');
}

function isExternal(href, pageHost) {
  try {
    const u = new URL(href, `https://${pageHost}`);
    return etld1(u.hostname) !== etld1(pageHost);
  } catch {
    return false;
  }
}

export async function probeTabnabbing(url, opts = {}) {
  const findings = [];
  // Coverage diagnostic: a markup-only probe — it attempts no
  // params by design; the surface is the page markup itself.
  if (opts && opts.diagnostics) {
    opts.diagnostics.pointsAttempted = [];
    opts.diagnostics.coverageNote = 'markup-only probe — no params attempted by design';
  }
  const html = await getText(url, opts);
  if (!html) return findings;
  let pageHost = '';
  try {
    pageHost = new URL(url).hostname;
  } catch {
    return findings;
  }
  const vuln = [];
  let baseAmplifier = null;

  // <base target="_blank">
  const baseM = /<base[^>]+target=["']_blank["'][^>]*>/i.exec(html);
  if (baseM) baseAmplifier = baseM[0].slice(0, 200);

  // <a>, <area>, <form> with target=_blank
  const tagRe = /<(a|area|form)\b([^>]*)>/gi;
  let m;
  while ((m = tagRe.exec(html))) {
    const attrs = m[2];
    if (!/target=["']_blank["']/i.test(attrs)) continue;
    const relM = /rel=["']([^"']*)["']/i.exec(attrs);
    const hrefM = /(?:href|action)=["']([^"']*)["']/i.exec(attrs);
    const href = hrefM ? hrefM[1] : '';
    if (/^(javascript:|#|$)/i.test(href.trim())) continue; // not a navigation sink
    if (relHardened(relM ? relM[1] : '')) continue;
    const external = isExternal(href, pageHost);
    vuln.push({ el: m[0].slice(0, 220), href: href.slice(0, 120), external });
  }

  // window.open in handlers / inline scripts
  const woRe = /window\.open\(\s*['"]([^'"]+)['"]\s*(,[^)]*)?\)/gi;
  while ((m = woRe.exec(html))) {
    const dest = m[1];
    const features = m[2] || '';
    const hardened = /noopener/i.test(features) || /opener\s*=\s*null/i.test(html.slice(Math.max(0, m.index - 200), m.index + 200));
    if (hardened) continue;
    if (/^(javascript:|#|$)/i.test(dest.trim())) continue;
    const external = isExternal(dest, pageHost);
    vuln.push({ el: `window.open('${dest.slice(0, 80)}')`, href: dest.slice(0, 120), external });
  }

  if (!vuln.length && !baseAmplifier) return findings; // D5 INFO exit
  const hasExternal = vuln.some((v) => v.external) || !!baseAmplifier;
  const severity = hasExternal ? 'medium' : 'low';
  const shown = vuln.slice(0, 25).map((v) => `  - ${v.el} -> ${v.href} (${v.external ? 'external' : 'same-origin'})`).join('\n');
  findings.push({
    class: 'tabnabbing',
    id: `tabnab-${rand()}`,
    title: `Reverse tabnabbing — ${vuln.length} opener sink(s) missing rel=noopener (${severity.toUpperCase()})`,
    severity,
    url,
    parameter: 'markup',
    evidence: ev(
      `GET ${url} (static markup analysis)`,
      `${vuln.length} opener-capable element(s) without noopener/noreferrer (verbatim):\n${shown}${vuln.length > 25 ? `\n  ... +${vuln.length - 25} more` : ''}${baseAmplifier ? `\nAmplifier: <base target="_blank"> present — every plain link is an opener sink: ${baseAmplifier}` : ''}\nNote: rel="nofollow" does NOT harden (verified tokenized); rel="noreferrer" does.`,
      'Defensive finding: add rel="noopener" (or noreferrer) to external target=_blank links.'
    ),
  });
  return findings;
}

export const __tabnabMeta = { phases: ['tabnabbing'], depth: ['quick', 'standard', 'deep'] };
