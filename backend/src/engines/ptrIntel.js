/**
 * ptrIntel.js — Reverse-DNS (PTR) sweep analysis and naming-pattern
 * prediction for autonomous bug bounty.
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. Covers
 * idea-bank items 00051–00060:
 *
 *  00059 PTR sweep of acquired netblocks — reverse-DNS sweep every IP in
 *            the target's announced prefixes to collect PTR hostnames that
 *            forward DNS never lists.
 *  00060 PTR pattern inference — analyze PTR naming patterns to predict
 *            unlisted hostnames following the same convention.
 *
 * All functions are pure: they analyze PTR records and IP/prefix data
 * supplied as plain values. Actual reverse-DNS querying is left to the
 * caller, so the engine stays testable and safe to run anywhere.
 */

/**
 * Validate an IPv4 dotted-quad.
 *
 * @param {string} ip
 * @returns {boolean}
 */
export function isValidIpv4(ip) {
  if (typeof ip !== 'string') return false;
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

/**
 * Parse an IPv4 CIDR prefix.
 *
 * @param {string} cidr e.g. "203.0.113.0/24"
 * @returns {{ network: string, prefixLen: number, size: number }|null}
 */
export function parseCidr(cidr) {
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(String(cidr || '').trim());
  if (!m) return null;
  if (!isValidIpv4(m[1])) return null;
  const prefixLen = Number(m[2]);
  if (prefixLen < 0 || prefixLen > 32) return null;
  return { network: m[1], prefixLen, size: Math.pow(2, 32 - prefixLen) };
}

/**
 * Check sweep coverage of a reverse-DNS sweep: how many addresses of the
 * announced prefixes were actually queried vs the address space size.
 *
 * @param {object[]} prefixes [{ cidr, queriedIps?: string[] }]
 * @returns {object[]} per-prefix { cidr, size, queried, coveragePct, unqueriedNote }.
 */
export function sweepCoverageStats(prefixes) {
  return (Array.isArray(prefixes) ? prefixes : []).map(p => {
    const parsed = parseCidr(p?.cidr);
    if (!parsed) return { cidr: p?.cidr ?? null, size: null, queried: 0, coveragePct: 0, unqueriedNote: 'invalid CIDR' };
    const queried = new Set((p.queriedIps || []).filter(isValidIpv4)).size;
    return {
      cidr: p.cidr,
      size: parsed.size,
      queried,
      coveragePct: parsed.size > 0 ? Math.round((queried / parsed.size) * 10000) / 100 : 0,
      unqueriedNote: queried < parsed.size ? `${parsed.size - queried} address(es) not swept` : 'fully swept',
    };
  });
}

/**
 * Tokenize a PTR hostname into lowercase tokens.
 *
 * @param {string} hostname
 * @returns {string[]} tokens.
 */
export function tokenizePtrHostname(hostname) {
  return String(hostname || '').trim().toLowerCase().split(/[-_.]/).filter(Boolean);
}

/**
 * Convert a PTR hostname into a naming template, e.g.
 * "web-07.east.example.com" → { template: "app-{n}.region.apex", tokens: [...] }.
 * Numeric segments become {n}, env/region tokens stay literal.
 *
 * @param {string} hostname
 * @param {object} [opts] { regionTokens?: string[] }
 * @returns {{ hostname: string, template: string, numericSlots: number[] }}
 */
export function inferPtrTemplate(hostname, opts = {}) {
  const norm = String(hostname || '').trim().toLowerCase();
  const regionTokens = new Set((opts.regionTokens || []).map(String));
  const labels = norm.split('.');
  const templated = labels.map(label => {
    const toks = label.split(/[-_]/).filter(Boolean);
    return toks
      .map(t => (/^\d+$/.test(t) ? '{n}' : regionTokens.has(t) ? t : /^[a-z]+$/.test(t) ? t : (/[a-z]/i.test(t) ? '{w}' : t)))
      .join('-');
  });
  const numericSlots = [];
  labels.forEach((label, li) => {
    label.split(/[-_]/).filter(Boolean).forEach((t, ti) => {
      if (/^\d+$/.test(t)) numericSlots.push({ labelIndex: li, tokenIndex: ti, value: Number(t), width: t.length });
    });
  });
  return { hostname: norm, template: templated.join('.'), numericSlots };
}

/**
 * Cluster PTR hostnames by their inferred naming template (idea 00060).
 *
 * @param {string[]} ptrHostnames
 * @param {object} [opts] { regionTokens?: string[] }
 * @returns {object[]} clusters { template, members: string[], count } sorted by count desc.
 */
export function clusterPtrNames(ptrHostnames, opts = {}) {
  const clusters = new Map();
  for (const h of Array.isArray(ptrHostnames) ? ptrHostnames : []) {
    const norm = String(h || '').trim().toLowerCase();
    if (!norm) continue;
    const { template } = inferPtrTemplate(norm, opts);
    if (!clusters.has(template)) clusters.set(template, { template, members: [] });
    clusters.get(template).members.push(norm);
  }
  const out = [...clusters.values()].map(c => ({ ...c, count: c.members.length }));
  out.sort((a, b) => b.count - a.count);
  return out;
}

/**
 * Analyze numeric sequences within a cluster to find gaps — unlisted
 * hosts that probably exist between observed numbers (idea 00060).
 *
 * @param {string[]} members hostnames sharing one template
 * @returns {object[]} gaps { template, missing: string[], low, high }.
 */
export function findNumericGaps(members) {
  const byTemplate = new Map();
  for (const m of Array.isArray(members) ? members : []) {
    const { template, numericSlots } = inferPtrTemplate(m);
    if (!byTemplate.has(template)) byTemplate.set(template, new Map());
    const slotMap = byTemplate.get(template);
    for (const slot of numericSlots) {
      const key = `${slot.labelIndex}:${slot.tokenIndex}`;
      if (!slotMap.has(key)) slotMap.set(key, new Set());
      slotMap.get(key).add(slot.value);
    }
  }
  const gaps = [];
  for (const [template, slotMap] of byTemplate) {
    for (const [slotKey, values] of slotMap) {
      const sorted = [...values].sort((a, b) => a - b);
      if (sorted.length < 2) continue;
      const low = sorted[0]; const high = sorted[sorted.length - 1];
      const observed = new Set(sorted);
      const missingNums = [];
      for (let n = low; n <= high; n++) {
        if (!observed.has(n)) missingNums.push(n);
      }
      if (missingNums.length > 0) {
        gaps.push({ template, slot: slotKey, missing: missingNums, low, high, observedCount: sorted.length });
      }
    }
  }
  return gaps;
}

/**
 * Predict unlisted hostnames following the observed PTR naming convention:
 * fill numeric gaps and extrapolate the next numbers in each sequence.
 *
 * @param {string[]} ptrHostnames observed PTR hostnames
 * @param {object} [opts] { extrapolate?: number, regionTokens?: string[] }
 * @returns {string[]} predicted hostnames, deduplicated, observed ones excluded.
 */
export function predictUnlistedHosts(ptrHostnames, opts = {}) {
  const extrapolate = Number.isFinite(opts.extrapolate) ? Math.max(0, opts.extrapolate) : 3;
  const observed = new Set((Array.isArray(ptrHostnames) ? ptrHostnames : []).map(h => String(h).trim().toLowerCase()));
  const predicted = new Set();
  const gaps = findNumericGaps([...observed]);
  for (const gap of gaps) {
    const numbers = [...gap.missing];
    for (let i = 1; i <= extrapolate; i++) numbers.push(gap.high + i);
    for (const n of numbers) {
      const filled = gap.template.replace('{n}', String(n).padStart(2, '0'))
        .replace(/\{n\}/g, String(n));
      if (!observed.has(filled)) predicted.add(filled);
    }
  }
  return [...predicted].sort();
}

/**
 * Score a netblock's PTR sweep yield: unique hostnames, coverage of the
 * sweep, and whether the naming looks machine-generated (bulk infra) or
 * curated (named services) — curated names merit deeper probing.
 *
 * @param {object} sweep { cidr, ptrRecords: [{ ip, hostname }] }
 * @returns {{ cidr, uniqueHostnames, templates: string[], curatedScore: number, notes: string[] }}
 */
export function analyzeSweepYield(sweep) {
  const notes = [];
  const records = Array.isArray(sweep?.ptrRecords) ? sweep.ptrRecords : [];
  const hostnames = [...new Set(
    records.map(r => String(r?.hostname || '').trim().toLowerCase()).filter(Boolean),
  )];
  const clusters = clusterPtrNames(hostnames);
  const templates = clusters.map(c => c.template);
  const numericTotal = hostnames.reduce((acc, h) => acc + (/\d/.test(h) ? 1 : 0), 0);
  const machineRatio = hostnames.length > 0 ? numericTotal / hostnames.length : 0;
  const curatedScore = Math.round((1 - machineRatio) * 100);
  if (hostnames.length === 0) notes.push('no PTR hostnames collected — sweep may have failed');
  if (clusters.length > 0 && clusters[0].count >= 5) notes.push(`dominant naming template: ${clusters[0].template}`);
  if (curatedScore >= 60) notes.push('naming looks curated — named services likely worth deeper probing');
  if (curatedScore < 40) notes.push('naming looks machine-generated — bulk infrastructure');
  return {
    cidr: sweep?.cidr ?? null,
    uniqueHostnames: hostnames.length,
    templates,
    curatedScore,
    notes,
  };
}
