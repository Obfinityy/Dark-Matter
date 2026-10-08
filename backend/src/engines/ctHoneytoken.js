/**
 * ctHoneytoken.js — Certificate-transparency honeytoken planting (idea 00199).
 *
 * During an authorized hunt, the agent plants canary subdomains (honeytokens)
 * that no legitimate user would ever query. If a third-party scanner later
 * enumerates those names — observable in CT logs via certificates issued for
 * them, or in the agent's own DNS query logs — the agent maps the scanner's
 * infrastructure (source IPs, resolvers, timing), turning adversary
 * reconnaissance into defensive intelligence.
 * All functions are pure and synchronous — no network calls.
 */

const TOKEN_WORDS = [
  'canary',
  'honey',
  'trap',
  'decoy',
  'sentinel',
  'tripwire',
  'bait',
  'lure',
  'mirage',
  'phantom',
  'ghost',
  'shadow',
  'warden',
  'sentry',
];

/**
 * Idea 00199 — Generate canary subdomain labels for a brand.
 *
 * Labels are deterministic-ish (seeded) yet unguessable: a token word plus a
 * hex fragment, e.g. `canary-9f3a2b.example.com`. They are planted as real
 * DNS records so any enumeration attempt is observable.
 *
 * @param {string} apex — target apex domain (e.g. "example.com")
 * @param {number} [count] — how many canaries to plant (default 5, max 50)
 * @param {string} [seed] — optional seed string for reproducibility
 * @returns {Array<{ label, fqdn, plantedAt: null, purpose: 'ct-honeytoken' }>}
 */
export function generateCanarySubdomains(apex, count = 5, seed = '') {
  const domain = String(apex || '')
    .toLowerCase()
    .replace(/\.$/, '');
  if (!domain || !domain.includes('.')) return [];
  const n = Math.max(1, Math.min(50, Math.floor(count) || 5));
  // Simple deterministic PRNG (xorshift32) from the seed string.
  let h = 2166136261;
  for (const ch of String(seed || domain)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
  const out = [];
  const used = new Set();
  while (out.length < n) {
    const word = TOKEN_WORDS[Math.floor(rand() * TOKEN_WORDS.length)];
    const frag = Math.floor(rand() * 0xffffff)
      .toString(16)
      .padStart(6, '0');
    const label = `${word}-${frag}`;
    if (used.has(label)) continue;
    used.add(label);
    out.push({ label, fqdn: `${label}.${domain}`, plantedAt: null, purpose: 'ct-honeytoken' });
  }
  return out;
}

/**
 * Idea 00199 — Match scanner hits against planted canaries.
 *
 * Accepts observed queries/certificates naming hostnames ({ hostname, source,
 * firstSeen, sourceType }) and returns every hit on a planted canary,
 * grouped by scanner source — mapping adversary infrastructure.
 *
 * @param {Array<{ hostname, source?, firstSeen?, sourceType? }>} observations
 * @param {Array<{ fqdn }|string>} canaries — planted canary FQDNs (or strings)
 * @returns {{ hits: Array<{ fqdn, hostname, source, firstSeen, sourceType }>, bySource: Array<{ source, hits: number, fqdns: string[], firstSeen, lastSeen }> }}
 */
export function matchScannerHits(observations = [], canaries = []) {
  const canon = new Set(
    (canaries || []).map(c =>
      String((c && c.fqdn) || c || '')
        .toLowerCase()
        .replace(/\.$/, '')
    )
  );
  const hits = [];
  for (const o of observations || []) {
    if (!o || !o.hostname) continue;
    const name = String(o.hostname).toLowerCase().replace(/\.$/, '');
    if (!canon.has(name)) continue;
    hits.push({
      fqdn: name,
      hostname: o.hostname,
      source: o.source || 'unknown',
      firstSeen: o.firstSeen || null,
      sourceType: o.sourceType || 'unknown',
    });
  }
  const bySource = new Map();
  for (const hit of hits) {
    if (!bySource.has(hit.source)) {
      bySource.set(hit.source, {
        source: hit.source,
        hits: 0,
        fqdns: new Set(),
        firstSeen: null,
        lastSeen: null,
      });
    }
    const g = bySource.get(hit.source);
    g.hits++;
    g.fqdns.add(hit.fqdn);
    const times = [g.firstSeen, g.lastSeen, hit.firstSeen].filter(Boolean).sort();
    g.firstSeen = times[0] || null;
    g.lastSeen = times[times.length - 1] || null;
  }
  const sources = [...bySource.values()]
    .map(g => ({ ...g, fqdns: [...g.fqdns].sort() }))
    .sort((a, b) => b.hits - a.hits);
  return { hits, bySource: sources };
}

/**
 * Idea 00199 — Score scanner infrastructure for report prioritization.
 *
 * A source that hits many distinct canaries quickly looks like automated
 * adversarial enumeration; a single hit may be a stray resolver.
 *
 * @param {Array<{ source, hits, fqdns: string[], firstSeen, lastSeen }>} bySource — from matchScannerHits
 * @returns {Array<{ source, hits, distinctCanaries, verdict, score }>} sorted by score
 */
export function scoreScannerInfrastructure(bySource = []) {
  return (bySource || [])
    .map(s => {
      const distinct = new Set(s.fqdns || []).size;
      let score = Math.min(100, distinct * 25 + Math.min(25, (s.hits || 0) * 2));
      let verdict = 'stray';
      if (distinct >= 3) {
        verdict = 'automated-enumeration';
        score = Math.max(score, 75);
      } else if (distinct >= 2) {
        verdict = 'likely-scanner';
        score = Math.max(score, 50);
      }
      return { source: s.source, hits: s.hits, distinctCanaries: distinct, verdict, score };
    })
    .sort((a, b) => b.score - a.score);
}
