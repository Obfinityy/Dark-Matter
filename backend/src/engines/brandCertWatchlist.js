/**
 * brandCertWatchlist.js — Certificate-brand watchlist automation engine.
 *
 * @idea 00299
 * Covers idea-bank item 00299:
 *  - 00299 Certificate-brand watchlist automation — maintain an automated
 *    CT watchlist for every brand variant and alert on new issuance in
 *    real time.
 *
 * Pure functions only: the caller streams CT log entries (crt.sh style) and
 * passes them in; this engine matches them against the watchlist and
 * produces alerts. No live HTTP here.
 */

/**
 * Build the brand-variant watchlist from a base brand name.
 * Covers case variants, common separators, and homoglyph-safe suffixes —
 * defensive matching only, no domain registration performed.
 *
 * @param {string} brand base brand name (e.g. "acme")
 * @param {{tlds?: string[], extraVariants?: string[]}} [options]
 * @returns {{variant: string, kind: string}[]} watchlist entries
 */
export function buildBrandWatchlist(brand, options = {}) {
  const base = String(brand || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!base) return [];
  const tlds = options.tlds && options.tlds.length > 0 ? options.tlds : ['com', 'net', 'org', 'io', 'co', 'app', 'dev'];
  const variants = new Map();

  const add = (variant, kind) => {
    if (!variants.has(variant)) variants.set(variant, { variant, kind });
  };

  add(base, 'exact');
  for (const tld of tlds) add(`${base}.${tld}`, 'exact-tld');
  add(`${base}pay`, 'suffix-pay');
  add(`${base}app`, 'suffix-app');
  add(`${base}secure`, 'suffix-secure');
  add(`${base}login`, 'suffix-login');
  add(`get${base}`, 'prefix-get');
  add(`my${base}`, 'prefix-my');
  add(`try${base}`, 'prefix-try');
  add(base.replace(/o/g, '0'), 'homoglyph-zero');
  add(base.replace(/l/g, '1'), 'homoglyph-one');
  for (const extra of options.extraVariants || []) {
    const clean = String(extra).trim().toLowerCase();
    if (clean) add(clean, 'custom');
  }
  return [...variants.values()].sort((a, b) => a.variant.localeCompare(b.variant));
}

/**
 * Compile a watchlist into matchers (exact + subdomain suffix match).
 * @param {{variant: string, kind: string}[]} watchlist
 * @returns {{variant: string, kind: string, re: RegExp}[]}
 */
export function compileWatchlistMatchers(watchlist = []) {
  return (watchlist || []).map((w) => {
    const escaped = w.variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { ...w, re: new RegExp(`(^|\\.)${escaped}$`, 'i') };
  });
}

/**
 * Match CT log certificate entries against the brand watchlist.
 * Entry shape: {commonName, dnsNames[], issuer, notBefore, serial}.
 *
 * @param {object[]} certs certificate entries already fetched by the caller
 * @param {{variant: string, kind: string, re: RegExp}[]} matchers
 * @returns {{
 *   variant: string, kind: string, matchedName: string,
 *   issuer: string, notBefore: string, serial: string, severity: string
 * }[]} alerts
 */
export function matchCertsAgainstWatchlist(certs = [], matchers = []) {
  const alerts = [];
  const seen = new Set();

  for (const cert of certs || []) {
    const names = new Set(
      [cert?.commonName, ...(cert?.dnsNames || [])]
        .filter(Boolean)
        .map((n) => String(n).trim().toLowerCase().replace(/\.$/, ''))
    );
    for (const name of names) {
      const bare = name.startsWith('*.') ? name.slice(2) : name;
      for (const m of matchers || []) {
        if (!m.re.test(bare)) continue;
        const key = `${m.variant}|${bare}|${String(cert?.serial || '')}`;
        if (seen.has(key)) continue;
        seen.add(key);
        alerts.push({
          variant: m.variant,
          kind: m.kind,
          matchedName: name,
          issuer: String(cert?.issuer || ''),
          notBefore: String(cert?.notBefore || ''),
          serial: String(cert?.serial || ''),
          severity: m.kind === 'exact' || m.kind === 'exact-tld' ? 'high' : m.kind.startsWith('homoglyph') ? 'critical' : 'medium',
        });
      }
    }
  }

  const rank = { critical: 0, high: 1, medium: 2 };
  return alerts.sort((a, b) => (rank[a.severity] - rank[b.severity]) || a.variant.localeCompare(b.variant));
}

/**
 * Summarize alerts into a watchlist health snapshot for the caller.
 * @param {ReturnType<typeof matchCertsAgainstWatchlist>} alerts
 * @param {{variant: string, kind: string}[]} watchlist
 * @returns {{watched: number, hits: number, critical: number, high: number, medium: number, topVariants: string[]}}
 */
export function summarizeWatchlist(alerts = [], watchlist = []) {
  const counts = { critical: 0, high: 0, medium: 0 };
  const byVariant = new Map();
  for (const a of alerts || []) {
    counts[a.severity] = (counts[a.severity] || 0) + 1;
    byVariant.set(a.variant, (byVariant.get(a.variant) || 0) + 1);
  }
  const topVariants = [...byVariant.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([v]) => v);
  return {
    watched: (watchlist || []).length,
    hits: (alerts || []).length,
    critical: counts.critical,
    high: counts.high,
    medium: counts.medium,
    topVariants,
  };
}
