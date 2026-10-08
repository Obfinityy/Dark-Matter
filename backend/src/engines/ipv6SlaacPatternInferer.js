/**
 * ipv6SlaacPatternInferer.js — SLAAC address-pattern inference.
 *
 * Idea 00383: analyze SLAAC address patterns to predict other hosts on the
 * same segment.
 *
 * Given a set of observed IPv6 addresses (e.g. from neighbor discovery),
 * this module classifies each address's IID (interface identifier) scheme —
 * EUI-64, privacy (RFC 4941/7217), static/DHCPv6, or manual — and generates
 * *candidate* addresses a legitimate follow-up scan may check, constrained to
 * the authorized prefix. It never emits packets; it only computes candidates.
 */

const IPV6_FULL = /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i;

/** Expand a possibly-compressed IPv6 address into 8 hextets. Returns null if invalid. */
function expand(addr) {
  if (typeof addr !== 'string') return null;
  const lower = addr.toLowerCase().trim();
  const [head, tail] = lower.split('::');
  const hp = head ? head.split(':').filter(Boolean) : [];
  const tp = tail ? tail.split(':').filter(Boolean) : [];
  if (head === undefined || tail === undefined) {
    const all = lower.split(':');
    return all.length === 8 && all.every(p => /^[0-9a-f]{1,4}$/.test(p)) ? all : null;
  }
  const missing = 8 - hp.length - tp.length;
  if (missing < 0) return null;
  const parts = [...hp, ...Array(missing).fill('0'), ...tp];
  if (parts.length !== 8 || !parts.every(p => /^[0-9a-f]{1,4}$/.test(p))) return null;
  return parts;
}

function hexOf(hextets) {
  return hextets.map(h => h.padStart(4, '0')).join(':');
}

/**
 * Classify the IID scheme of an address.
 * @param {string} address
 * @returns {{scheme: 'eui64'|'privacy'|'static-low'|'unknown', oui: string|null, detail: string}}
 */
export function classifyIid(address) {
  const parts = expand(address);
  if (!parts) return { scheme: 'unknown', oui: null, detail: 'not a valid IPv6 address' };
  const iid = parts.slice(4).map(h => h.padStart(4, '0'));
  const iidHex = iid.join('');
  const uBit = parseInt(iid[0].slice(0, 2), 16);

  // EUI-64: ff:fe in the middle of the IID, universal/local bit flipped.
  if (iid[1].endsWith('ff') && iid[2].startsWith('fe')) {
    const flipped = (uBit ^ 0x02).toString(16).padStart(2, '0');
    const oui = `${flipped}${iid[0].slice(2)}:${iid[1].slice(0, 2)}`;
    return {
      scheme: 'eui64',
      oui: oui.toUpperCase(),
      detail: `EUI-64 derived from MAC OUI ${oui.toUpperCase()} — device vendor inferable.`,
    };
  }
  // Statically low IIDs (::1, ::2, … ::ffff) typical of servers/routers.
  const low = BigInt('0x' + iidHex);
  if (low <= 0xffffn && low > 0n) {
    return {
      scheme: 'static-low',
      oui: null,
      detail: `Low numeric IID (::${low.toString(16)}) — typical of manually assigned infrastructure addresses.`,
    };
  }
  // Privacy/RFC7217: u/l bit 0 and no ff:fe marker.
  if ((uBit & 0x02) === 0) {
    return {
      scheme: 'privacy',
      oui: null,
      detail:
        'Randomized IID with universal/local bit clear — privacy extension or RFC 7217 stable address.',
    };
  }
  return {
    scheme: 'unknown',
    oui: null,
    detail: 'IID does not match EUI-64, low-static, or privacy patterns.',
  };
}

/**
 * Analyze a batch of observed addresses and summarize the segment's patterns.
 * @param {string[]} addresses
 */
export function analyzeSlaacPatterns(addresses = []) {
  const classified = [];
  const ouis = new Map();
  const prefixes = new Map();

  for (const addr of addresses) {
    const parts = expand(addr);
    if (!parts) continue;
    const cls = classifyIid(addr);
    const prefix = hexOf(parts.slice(0, 4));
    prefixes.set(prefix, (prefixes.get(prefix) || 0) + 1);
    if (cls.oui) ouis.set(cls.oui, (ouis.get(cls.oui) || 0) + 1);
    classified.push({ address: addr, prefix, ...cls });
  }

  const byScheme = {};
  for (const c of classified) byScheme[c.scheme] = (byScheme[c.scheme] || 0) + 1;

  return {
    classified,
    byScheme,
    ouis: [...ouis.entries()]
      .map(([oui, count]) => ({ oui, count }))
      .sort((a, b) => b.count - a.count),
    prefixes: [...prefixes.entries()].map(([prefix, count]) => ({ prefix, count })),
  };
}

/**
 * Generate follow-up candidate addresses within the authorized scope.
 * Only EUI-64 neighbor-MAC walking and low-IID probing produce candidates;
 * privacy addresses are explicitly NOT brute-forced (infeasible by design).
 *
 * @param {ReturnType<typeof analyzeSlaacPatterns>} analysis
 * @param {{macSeeds?: string[], lowIidMax?: number, maxCandidates?: number}} [options]
 * @returns {{candidates: {address: string, rationale: string}[], skipped: string[]}}
 */
export function inferCandidateHosts(analysis, options = {}) {
  const { macSeeds = [], lowIidMax = 32, maxCandidates = 500 } = options;
  const candidates = [];
  const skipped = [];
  const seen = new Set();

  const push = (address, rationale) => {
    if (seen.has(address) || candidates.length >= maxCandidates) return;
    seen.add(address);
    candidates.push({ address, rationale });
  };

  // 1) Low-IID infrastructure probing on every observed /64.
  for (const { prefix } of analysis.prefixes) {
    const base = prefix.toLowerCase();
    for (let i = 1; i <= lowIidMax; i++) {
      const iid = i.toString(16);
      push(
        `${base}::${iid}`,
        `Low static IID ::${iid} on ${prefix}::/64 — common for routers/servers.`
      );
    }
  }

  // 2) EUI-64 candidates from observed MAC seeds (e.g. from ARP/ND tables
  // the operator legitimately collected): flip u/l bit, insert ff:fe.
  for (const seed of macSeeds) {
    const clean = seed.toLowerCase().replace(/[^0-9a-f]/g, '');
    if (clean.length !== 12) continue;
    const first = (parseInt(clean.slice(0, 2), 16) ^ 0x02).toString(16).padStart(2, '0');
    const iid = `${first}${clean.slice(2, 4)}:${clean.slice(4, 6)}ff:fe${clean.slice(6, 8)}:${clean.slice(8, 10)}${clean.slice(10, 12)}`;
    for (const { prefix } of analysis.prefixes) {
      push(
        `${prefix.toLowerCase()}::${iid}`.replace('::::', '::'),
        `EUI-64 derived from MAC ${seed} on ${prefix}::/64.`
      );
    }
  }

  const privacyCount = analysis.byScheme.privacy || 0;
  if (privacyCount)
    skipped.push(
      `${privacyCount} privacy-IID host(s): no feasible candidate generation — not targeted.`
    );

  return { candidates, skipped };
}

/**
 * Build a report finding from the analysis.
 * @param {ReturnType<typeof analyzeSlaacPatterns>} analysis
 */
export function slaacFinding(analysis) {
  const eui = analysis.byScheme.eui64 || 0;
  return {
    title: `SLAAC address-pattern inference — ${analysis.classified.length} address(es) classified`,
    severity: eui > 0 ? 'Low' : 'Info',
    confidence: analysis.classified.length >= 5 ? 'high' : 'medium',
    schemes: analysis.byScheme,
    vendorOuis: analysis.ouis,
    evidence:
      eui > 0
        ? `${eui} EUI-64 address(es) expose device MACs/vendor OUIs — trackable and predictable; ` +
          'recommend privacy extensions or RFC 7217 stable IIDs.'
        : 'No EUI-64 addresses observed in the sample.',
  };
}

export { IPV6_FULL };
export const IPV6_SLAAC_INFERER = {
  classifyIid,
  analyzeSlaacPatterns,
  inferCandidateHosts,
  slaacFinding,
};
export default IPV6_SLAAC_INFERER;
