/**
 * routingSecurityRecon.js — Routing-layer security reconnaissance (ideas 00656–00660).
 *
 * Defensive analysis capabilities for an authorized bug-bounty agent:
 *  - BGP origin-hijack alerting against a known-good baseline (00656)
 *  - RPKI validation flagging for announcements covering target prefixes (00657)
 *  - Looking-glass AS-path analysis to map upstream providers (00658)
 *  - Traceroute-based router-level topology mapping from multiple vantages (00659)
 *  - MPLS deployment inference from TTL and label-stack behaviors (00660)
 *
 * All functions are pure and side-effect free: they analyse supplied
 * announcements, ROA sets, looking-glass output and traceroute hops.
 * No network I/O happens in this module.
 */

/**
 * IPv4 helpers for prefix arithmetic (documented: IPv4 only).
 */
function ipv4ToInt(ip) {
  const parts = String(ip || '')
    .trim()
    .split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const b = Number(p);
    if (!Number.isInteger(b) || b < 0 || b > 255) return null;
    n = n * 256 + b;
  }
  return n;
}

function parsePrefix(prefix) {
  const m = /^\s*([0-9.]+)\/(\d{1,2})\s*$/.exec(String(prefix || ''));
  if (!m) return null;
  const addr = ipv4ToInt(m[1]);
  const len = Number(m[2]);
  if (addr === null || len > 32) return null;
  const mask = len === 0 ? 0 : (0xffffffff - 2 ** (32 - len) + 1) >>> 0;
  return { network: (addr & mask) >>> 0, len };
}

/** True when `covering` (a less-specific prefix) contains `inner`. */
function prefixCovers(covering, inner) {
  if (!covering || !inner || covering.len > inner.len) return false;
  const mask = covering.len === 0 ? 0 : (0xffffffff - 2 ** (32 - covering.len) + 1) >>> 0;
  return (inner.network & mask) >>> 0 === covering.network;
}

/** Split a whitespace/comma separated AS path into integer ASNs. */
function parseAsPath(asPath) {
  return String(asPath || '')
    .split(/[\s,]+/)
    .map(a => Number(a))
    .filter(a => Number.isInteger(a) && a > 0);
}

/**
 * Idea 00656 — Alert on unexpected BGP origin-AS changes for target prefixes.
 *
 * Compares live announcements against a baseline of known-good origin ASNs.
 * New origins are classified: an authorized migration (baseline-approved),
 * benign anycast (baseline-flagged), a multi-origin (MOAS) event, or a
 * hijack suspect — an unexpected single origin whose announcement deserves
 * immediate investigation.
 *
 * @param {object} opts
 * @param {string} opts.prefix target prefix, e.g. "203.0.113.0/24"
 * @param {Array<{originAs: number, asPath?: string, collector?: string, observedAt?: string}>} [opts.announcements]
 * @param {object} [opts.baseline] { originAses: number[], authorizedAses?: number[], anycast?: boolean }
 * @returns {{prefix: string, alerts: Array<object>, allClear: boolean, summary: string}}
 */
export function detectOriginHijack({ prefix, announcements = [], baseline = {} } = {}) {
  const target = String(prefix || '');
  const known = new Set((baseline.originAses || []).map(Number));
  const authorized = new Set((baseline.authorizedAses || []).map(Number));
  const anycast = Boolean(baseline.anycast);

  const byOrigin = new Map();
  for (const a of announcements || []) {
    if (!a || !Number.isFinite(Number(a.originAs))) continue;
    const asn = Number(a.originAs);
    let entry = byOrigin.get(asn);
    if (!entry) {
      entry = { originAs: asn, seenBy: new Set(), firstSeen: a.observedAt || null, paths: [] };
      byOrigin.set(asn, entry);
    }
    if (a.collector) entry.seenBy.add(String(a.collector));
    if (a.asPath) entry.paths.push(String(a.asPath));
    if (a.observedAt && (!entry.firstSeen || a.observedAt < entry.firstSeen))
      entry.firstSeen = a.observedAt;
  }

  const alerts = [];
  const newOrigins = [...byOrigin.keys()].filter(asn => !known.has(asn));
  const simultaneous = newOrigins.length >= 2;

  for (const asn of newOrigins) {
    const entry = byOrigin.get(asn);
    const seenBy = [...entry.seenBy];
    if (authorized.has(asn)) {
      alerts.push({
        type: 'authorized-migration',
        originAs: asn,
        severity: 'info',
        seenBy,
        firstSeen: entry.firstSeen,
        reasons: [
          'Origin AS is in the baseline authorized set — expected migration, not an attack.',
        ],
      });
      continue;
    }
    if (anycast) {
      alerts.push({
        type: 'benign-anycast',
        originAs: asn,
        severity: 'low',
        seenBy,
        firstSeen: entry.firstSeen,
        reasons: ['Prefix is baseline-flagged as anycast — additional origins are expected.'],
      });
      continue;
    }
    if (simultaneous) {
      alerts.push({
        type: 'moas-event',
        originAs: asn,
        severity: 'medium',
        seenBy,
        firstSeen: entry.firstSeen,
        reasons: [
          `Multiple unexpected origins (${newOrigins.join(', ')}) announced simultaneously.`,
          'Could be a multi-homing change or a distributed hijack — verify with the prefix holder.',
        ],
      });
      continue;
    }
    const severity = seenBy.length >= 3 ? 'high' : seenBy.length >= 1 ? 'medium' : 'low';
    alerts.push({
      type: 'hijack-suspect',
      originAs: asn,
      severity,
      seenBy,
      firstSeen: entry.firstSeen,
      reasons: [
        `Unexpected origin AS${asn} for ${target} not present in the baseline.`,
        seenBy.length >= 3
          ? `Visible from ${seenBy.length} collectors — wide propagation increases hijack likelihood.`
          : 'Limited visibility so far — confirm with additional collectors before escalating.',
      ],
    });
  }

  alerts.sort(
    (a, b) =>
      (({ high: 0, medium: 1, low: 2, info: 3 })[a.severity] ?? 4) -
      ({ high: 0, medium: 1, low: 2, info: 3 }[b.severity] ?? 4)
  );

  return {
    prefix: target,
    alerts,
    allClear: alerts.filter(a => a.severity !== 'info' && a.severity !== 'low').length === 0,
    summary: alerts.length
      ? `${alerts.length} origin anomalie(s) for ${target}; highest severity: ${alerts[0].severity}.`
      : `No unexpected origin changes for ${target}.`,
  };
}

/**
 * Idea 00657 — Flag RPKI-invalid announcements affecting target prefixes.
 *
 * Validates each announcement against a supplied ROA set using longest-prefix
 * match: valid (origin matches a covering ROA and length is within maxLength),
 * invalid (a covering ROA exists but origin or maxLength fails), or not-found
 * (no covering ROA — the prefix is simply uncovered).
 *
 * @param {object} opts
 * @param {Array<{prefix: string, originAs: number, asPath?: string}>} [opts.announcements]
 * @param {Array<{prefix: string, maxLength: number, asn: number}>} [opts.roas]
 * @returns {{results: Array<object>, invalid: Array<object>, summary: string}}
 */
export function flagRpkiInvalid({ announcements = [], roas = [] } = {}) {
  const parsedRoas = (roas || [])
    .map(r => ({
      ...r,
      parsed: parsePrefix(r.prefix),
      asn: Number(r.asn),
      maxLength: Number(r.maxLength),
    }))
    .filter(r => r.parsed && Number.isInteger(r.asn));

  const results = [];
  for (const a of announcements || []) {
    if (!a || !a.prefix) continue;
    const ann = parsePrefix(a.prefix);
    const originAs = Number(a.originAs);
    if (!ann || !Number.isInteger(originAs)) continue;

    const covering = parsedRoas.filter(r => prefixCovers(r.parsed, ann));
    if (!covering.length) {
      results.push({
        prefix: a.prefix,
        originAs,
        state: 'not-found',
        coveringRoa: null,
        reason: 'No covering ROA — prefix is not covered by RPKI; validation is impossible.',
      });
      continue;
    }
    covering.sort((x, y) => y.parsed.len - x.parsed.len);
    const roa = covering[0];
    if (roa.asn !== originAs) {
      results.push({
        prefix: a.prefix,
        originAs,
        state: 'invalid',
        coveringRoa: { prefix: roa.prefix, maxLength: roa.maxLength, asn: roa.asn },
        reason: `Origin AS${originAs} does not match ROA-authorized AS${roa.asn} — classic hijack signature.`,
      });
      continue;
    }
    if (ann.len > roa.maxLength) {
      results.push({
        prefix: a.prefix,
        originAs,
        state: 'invalid',
        coveringRoa: { prefix: roa.prefix, maxLength: roa.maxLength, asn: roa.asn },
        reason: `Announcement /${ann.len} is more specific than ROA maxLength /${roa.maxLength} — invalid.`,
      });
      continue;
    }
    results.push({
      prefix: a.prefix,
      originAs,
      state: 'valid',
      coveringRoa: { prefix: roa.prefix, maxLength: roa.maxLength, asn: roa.asn },
      reason: 'Origin and length are authorized by a covering ROA.',
    });
  }

  const invalid = results.filter(r => r.state === 'invalid');
  return {
    results,
    invalid,
    summary:
      `${results.length} announcement(s) validated: ${invalid.length} invalid, ` +
      `${results.filter(r => r.state === 'not-found').length} not-found, ` +
      `${results.filter(r => r.state === 'valid').length} valid.`,
  };
}

/**
 * Idea 00658 — Analyse AS paths from looking glasses to map upstream providers.
 *
 * Given `show ip bgp` style AS paths collected from several looking glasses,
 * infers the target's upstream providers: the AS adjacent to the origin on
 * most paths is the primary upstream, and the first AS of each path is the
 * looking glass's own network. Also reports path diversity and multi-homing.
 *
 * @param {object} opts
 * @param {string} opts.prefix target prefix the paths were collected for
 * @param {Array<{lg: string, asPath: string}>} [opts.paths]
 * @returns {{prefix: string, primaryUpstream: number|null, upstreams: Array<object>,
 *   transitAsns: number[], uniquePathCount: number, pathDiversity: number, multihomed: boolean, summary: string}}
 */
export function analyzeLgPaths({ prefix, paths = [] } = {}) {
  const target = String(prefix || '');
  const parsed = (paths || [])
    .map(p => ({ lg: String((p && p.lg) || 'unknown'), asns: parseAsPath(p && p.asPath) }))
    .filter(p => p.asns.length >= 2);

  const origins = new Set(parsed.map(p => p.asns[p.asns.length - 1]));
  const neighborCounts = new Map();
  const transit = new Set();
  const uniquePaths = new Set();

  for (const p of parsed) {
    uniquePaths.add(p.asns.join(' '));
    const neighbor = p.asns[p.asns.length - 2]; // AS adjacent to origin = upstream
    neighborCounts.set(neighbor, (neighborCounts.get(neighbor) || 0) + 1);
    for (let i = 1; i < p.asns.length - 1; i++) transit.add(p.asns[i]);
  }

  const upstreams = [...neighborCounts.entries()]
    .map(([asn, count]) => ({
      asn,
      count,
      share: parsed.length ? Number((count / parsed.length).toFixed(3)) : 0,
      confidence: count / Math.max(parsed.length, 1) >= 0.5 ? 'high' : 'medium',
    }))
    .sort((a, b) => b.count - a.count);

  const primaryUpstream = upstreams.length ? upstreams[0].asn : null;
  const uniquePathCount = uniquePaths.size;
  const pathDiversity = parsed.length ? Number((uniquePathCount / parsed.length).toFixed(3)) : 0;

  return {
    prefix: target,
    primaryUpstream,
    upstreams,
    transitAsns: [...transit].sort((a, b) => a - b),
    pathCount: parsed.length,
    uniquePathCount,
    pathDiversity,
    multihomed: origins.size > 1,
    summary: parsed.length
      ? `Primary upstream AS${primaryUpstream} (seen on ${upstreams[0].count}/${parsed.length} paths); ` +
        `${origins.size} origin AS(es); path diversity ${pathDiversity}.`
      : 'No parseable AS paths supplied.',
  };
}

/**
 * Idea 00659 — Build router-level topology from traceroutes across vantage points.
 *
 * Merges traceroute hops collected from multiple vantage points into a single
 * router-level graph. Alias resolution is deliberately conservative: the same
 * IP observed anywhere is treated as the same router (documented limitation —
 * a full alias-resolution engine can refine this later). Parallel equal-cost
 * paths show up as multi-path events.
 *
 * @param {object} opts
 * @param {Array<{vantage: string, target?: string, hops: Array<{ttl: number, ip?: string|null, rttMs?: number}>}>} [opts.traces]
 * @returns {{nodes: Array<object>, edges: Array<object>, multipath: Array<object>, stats: object}}
 */
export function buildTopology({ traces = [] } = {}) {
  const nodes = new Map();
  const edges = new Map();
  const perVantageTtl = new Map();

  const nodeFor = (ip, vantage) => {
    let n = nodes.get(ip);
    if (!n) {
      n = { ip, observedBy: new Set(), degree: 0 };
      nodes.set(ip, n);
    }
    n.observedBy.add(String(vantage));
    return n;
  };

  for (const t of traces || []) {
    const vantage = String((t && t.vantage) || 'unknown');
    const hops = ((t && t.hops) || []).filter(h => h && h.ip);
    hops.forEach(h => {
      nodeFor(String(h.ip), vantage);
      const key = `${vantage}|${h.ttl}`;
      if (!perVantageTtl.has(key)) perVantageTtl.set(key, new Set());
      perVantageTtl.get(key).add(String(h.ip));
    });
    for (let i = 1; i < hops.length; i++) {
      const from = String(hops[i - 1].ip);
      const to = String(hops[i].ip);
      if (from === to) continue;
      const key = `${from}->${to}`;
      let e = edges.get(key);
      if (!e) {
        e = { from, to, count: 0, observedBy: new Set() };
        edges.set(key, e);
      }
      e.count += 1;
      e.observedBy.add(vantage);
    }
  }

  for (const e of edges.values()) {
    nodes.get(e.from).degree += 1;
    nodes.get(e.to).degree += 1;
  }

  const multipath = [];
  for (const [key, ips] of perVantageTtl) {
    if (ips.size > 1) {
      const [vantage, ttl] = key.split('|');
      multipath.push({
        vantage,
        ttl: Number(ttl),
        ips: [...ips],
        detail: 'Multiple next-hops at the same TTL — equal-cost multi-path.',
      });
    }
  }

  return {
    nodes: [...nodes.values()].map(n => ({
      ip: n.ip,
      observedBy: [...n.observedBy],
      degree: n.degree,
    })),
    edges: [...edges.values()].map(e => ({
      from: e.from,
      to: e.to,
      count: e.count,
      observedBy: [...e.observedBy],
    })),
    multipath,
    stats: {
      routerCount: nodes.size,
      edgeCount: edges.size,
      vantageCount: new Set((traces || []).map(t => String((t && t.vantage) || 'unknown'))).size,
      multipathCount: multipath.length,
    },
  };
}

/**
 * Idea 00660 — Infer MPLS deployments from TTL and label-stack behaviors.
 *
 * Two independent signal families:
 *  - Explicit: RFC 4950 ICMP extensions carrying an MPLS label stack —
 *    decoded here for depth, implicit-null (PHP, label 3) and explicit-null
 *    (labels 0/2) indicators.
 *  - Implicit: TTL-propagation gaps — consecutive traceroute hops whose TTLs
 *    differ by more than one reveal routers hidden inside an LSP that does
 *    not decrement TTL (no-ttl-propagate).
 *
 * @param {object} opts
 * @param {Array<{vantage?: string, hops: Array<{ttl: number, ip?: string|null, rttMs?: number, labelStack?: Array<{label: number, exp?: number, s?: number, ttl?: number}>}>}>} [opts.traces]
 * @returns {{mplsLikely: boolean, confidence: string, indicators: Array<object>, labelStacks: Array<object>}}
 */
export function inferMpls({ traces = [] } = {}) {
  const indicators = [];
  const labelStacks = [];

  for (const t of traces || []) {
    const vantage = String((t && t.vantage) || 'unknown');
    const hops = ((t && t.hops) || []).filter(h => h && Number.isFinite(Number(h.ttl)));
    hops.sort((a, b) => a.ttl - b.ttl);

    for (const h of hops) {
      if (Array.isArray(h.labelStack) && h.labelStack.length) {
        const labels = h.labelStack.map(l => Number(l.label));
        const implicitNull = labels.includes(3);
        const explicitNull = labels.some(l => l === 0 || l === 2);
        labelStacks.push({
          vantage,
          ttl: h.ttl,
          ip: h.ip || null,
          depth: labels.length,
          labels,
          bottomOfStack:
            h.labelStack[h.labelStack.length - 1] && h.labelStack[h.labelStack.length - 1].s === 1,
        });
        indicators.push({
          type: 'explicit-label-stack',
          vantage,
          at: `ttl ${h.ttl}${h.ip ? ` (${h.ip})` : ''}`,
          detail:
            `RFC 4950 label stack of depth ${labels.length}` +
            (implicitNull ? '; implicit-null (label 3) — penultimate-hop popping in use' : '') +
            (explicitNull ? '; explicit-null label observed on the wire' : '') +
            '.',
        });
      }
    }

    for (let i = 1; i < hops.length; i++) {
      const gap = hops[i].ttl - hops[i - 1].ttl;
      if (gap > 1) {
        indicators.push({
          type: 'ttl-propagation-gap',
          vantage,
          at: `ttl ${hops[i - 1].ttl} -> ${hops[i].ttl}`,
          detail: `${gap - 1} hidden hop(s) between replies — consistent with an MPLS LSP using no-ttl-propagate.`,
        });
      }
    }
  }

  const explicit = indicators.filter(i => i.type === 'explicit-label-stack').length;
  const gaps = indicators.filter(i => i.type === 'ttl-propagation-gap').length;
  const mplsLikely = explicit > 0 || gaps > 0;
  const confidence = explicit > 0 ? 'high' : gaps > 0 ? 'medium' : 'low';

  return {
    mplsLikely,
    confidence,
    indicators,
    labelStacks,
    summary: !mplsLikely
      ? 'No MPLS indicators found in the supplied traces.'
      : `${explicit} explicit label stack(s), ${gaps} TTL-propagation gap(s) — MPLS likely (${confidence} confidence).`,
  };
}

export const ROUTING_SECURITY_RECON = {
  detectOriginHijack,
  flagRpkiInvalid,
  analyzeLgPaths,
  buildTopology,
  inferMpls,
};

export default ROUTING_SECURITY_RECON;
