/**
 * ripeAtlasDnsChain.js — RIPE Atlas DNS-chain tracing and visualization (idea 00198).
 *
 * Atlas DNS measurement results include the full answer section (abuf),
 * which preserves the CNAME chain a resolver walked. Hidden CNAME hops —
 * chains that pass through third-party or legacy providers — are prime
 * takeover and trust-boundary candidates. This module traces those chains
 * from pre-parsed results and flags suspicious hops off-line.
 * All functions are pure and synchronous — no network calls.
 */

const SUSPICIOUS_CNAME_RE =
  /\b(herokuapp|azurewebsites|cloudapp|elasticbeanstalk|s3-website|github\.io|netlify|vercel|fastly|cloudfront|akamai|incapdns|sucuri|wpengine|shopify|zendesk|freshdesk|helpscout|statuspage|unbounce|launchrock|tilda|webflow|cargo|surge|bitbucket)\b/i;
const INTERNAL_CNAME_RE = /\b(intra|internal|corp|local|lan|dc\d*|mgmt)\b/i;

/**
 * Idea 00198 — Trace the CNAME chain from a parsed DNS answer list.
 *
 * Accepts ordered answers like [{ name, type: 'CNAME'|'A'|'AAAA', data }]
 * and rebuilds the hop sequence from the queried name to the terminal A/AAAA.
 *
 * @param {string} qname — the originally queried hostname
 * @param {Array<{ name, type, data }>} answers — in response order
 * @returns {{ qname, hops: Array<{ from, to, type }>, terminal: string[] }}
 */
export function traceDnsChain(qname, answers = []) {
  const norm = (s) => String(s || '').toLowerCase().replace(/\.$/, '');
  const hops = [];
  const terminal = [];
  let current = norm(qname);
  const remaining = [...(answers || [])];
  const seen = new Set([current]);
  let guard = 0;
  while (guard++ < 64) {
    const idx = remaining.findIndex(
      (a) => norm(a.name) === current && /^CNAME$/i.test(String(a.type || '')),
    );
    if (idx === -1) break;
    const [cname] = remaining.splice(idx, 1);
    const target = norm(cname.data);
    if (!target || seen.has(target)) break;
    seen.add(target);
    hops.push({ from: current, to: target, type: 'CNAME' });
    current = target;
  }
  for (const a of remaining) {
    if (norm(a.name) === current && /^(A|AAAA)$/i.test(String(a.type || '')) && a.data) {
      terminal.push(String(a.data));
    }
  }
  return { qname: norm(qname), hops, terminal };
}

/**
 * Idea 00198 — Uncover hidden/suspicious CNAME hops across many chains.
 *
 * A "hidden" hop is any intermediate CNAME target that is NOT the queried
 * brand's own zone — i.e., resolution leaves the target's infrastructure.
 * Hops pointing at well-known third-party/takeover-prone providers are
 * flagged with reasons.
 *
 * @param {Array<{ qname, hops: Array<{from, to, type}>, terminal: string[] }>} chains — from traceDnsChain
 * @param {string} brandDomain — target's apex domain (e.g. "example.com")
 * @returns {Array<{ qname, hiddenHops: Array<{ from, to, reason }>, hopCount, terminal: string[] }>}
 */
export function uncoverHiddenCnames(chains = [], brandDomain = '') {
  const brand = String(brandDomain || '').toLowerCase().replace(/\.$/, '');
  const inBrand = (name) => {
    const n = String(name || '').toLowerCase().replace(/\.$/, '');
    return brand && (n === brand || n.endsWith(`.${brand}`));
  };
  const out = [];
  for (const c of chains || []) {
    if (!c) continue;
    const hiddenHops = [];
    for (const h of c.hops || []) {
      const to = String(h.to || '').toLowerCase().replace(/\.$/, '');
      if (inBrand(to)) continue;
      const reasons = ['leaves-brand-zone'];
      if (SUSPICIOUS_CNAME_RE.test(to)) reasons.push('third-party-provider');
      if (INTERNAL_CNAME_RE.test(to)) reasons.push('internal-name-exposed');
      hiddenHops.push({ from: h.from, to: h.to, reason: reasons.join(',') });
    }
    if (hiddenHops.length) {
      out.push({
        qname: c.qname,
        hiddenHops,
        hopCount: (c.hops || []).length,
        terminal: c.terminal || [],
      });
    }
  }
  return out.sort((a, b) => b.hiddenHops.length - a.hiddenHops.length);
}

/**
 * Idea 00198 — Render chains as a compact ASCII visualization for reports.
 *
 * @param {Array<{ qname, hops: Array<{from, to}>, terminal: string[] }>} chains
 * @returns {string} multi-line ASCII diagram
 */
export function visualizeChains(chains = []) {
  const lines = [];
  for (const c of chains || []) {
    const nodes = [c.qname];
    for (const h of c.hops || []) nodes.push(h.to);
    const terms = (c.terminal || []).length ? ` → [${c.terminal.join(', ')}]` : '';
    lines.push(`${nodes.join('  ⇢  ')}${terms}`);
  }
  return lines.join('\n');
}
