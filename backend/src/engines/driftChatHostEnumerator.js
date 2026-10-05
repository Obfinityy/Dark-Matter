/**
 * driftChatHostEnumerator.js — Drift chat host enumeration engine.
 *
 * @idea 00284 — Drift chat host enumeration — discover Drift chat
 *   endpoints from page snippets and DNS.
 *
 * Drift's conversational marketing chat is embedded via the
 * js.driftt.com/include snippet plus a per-account "Drift ID" passed to
 * drift.load(). This engine extracts Drift IDs and Drift host references
 * from page HTML and correlates them with DNS CNAME evidence.
 *
 * Pure functions only: callers fetch page HTML and DNS records themselves.
 * No live network calls here.
 */

const DRIFT_HOST_PATTERNS = [
  { re: /^js\.driftt\.com$/i, kind: 'snippet-cdn', note: 'Drift snippet include host' },
  { re: /\.driftt\.com$/i, kind: 'drift-cdn', note: 'Drift infrastructure host' },
  { re: /\.drift\.com$/i, kind: 'drift-host', note: 'Drift corporate/hosted host' },
  { re: /^app\.driftt\.com$/i, kind: 'app', note: 'Drift app host' },
  { re: /^conversations\.driftt\.com$/i, kind: 'conversations', note: 'Drift conversations endpoint' },
];

/**
 * Normalize a hostname: lowercase, strip scheme, port, trailing dot.
 * @param {string} host
 * @returns {string}
 */
export function normalizeHostname(host) {
  if (!host) return '';
  return String(host)
    .trim()
    .toLowerCase()
    .replace(/^\w+:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * Classify a hostname as Drift infrastructure.
 * @param {string} host
 * @returns {{isDrift: boolean, kind: string, note: string, host: string}}
 */
export function classifyDriftHost(host) {
  const h = normalizeHostname(host);
  for (const { re, kind, note } of DRIFT_HOST_PATTERNS) {
    if (re.test(h)) return { isDrift: true, kind, note, host: h };
  }
  return { isDrift: false, kind: 'other', note: '', host: h };
}

/**
 * Extract Drift integration signals from page HTML: the Drift ID handed to
 * drift.load() / drift.init(), and Drift host references.
 * @param {string} html page HTML
 * @returns {{driftIds: string[], driftHosts: string[], snippetFound: boolean, versionHints: string[]}}
 */
export function extractDriftSignals(html) {
  const text = String(html || '');
  const driftIds = new Set();
  const hosts = new Set();
  const versionHints = new Set();

  const idPatterns = [
    /drift\.load\s*\(\s*["']([a-z0-9]{6,})["']/i,
    /drift\.init\s*\(\s*["']([a-z0-9]{6,})["']/i,
    /data-drift-id=["']([a-z0-9]{6,})["']/i,
    /driftt?\.com\/include\/([a-z0-9]{4,})/i,
    /["']driftId["']\s*:\s*["']([a-z0-9]{6,})["']/i,
  ];
  for (const re of idPatterns) {
    const m = text.match(re);
    if (m) driftIds.add(m[1]);
  }

  const urlRe = /https?:\/\/([a-z0-9][a-z0-9.-]*drift[a-z0-9.-]*)/gi;
  let m;
  while ((m = urlRe.exec(text)) !== null) hosts.add(normalizeHostname(m[1]));

  const srcRe = /<script[^>]+src=["']https?:\/\/([^"']+)["']/gi;
  while ((m = srcRe.exec(text)) !== null) {
    const h = normalizeHostname(m[1].split('/')[0]);
    if (/drift/.test(h)) hosts.add(h);
  }

  const verRe = /js\.driftt\.com\/include\/([a-z0-9./_-]+)/gi;
  while ((m = verRe.exec(text)) !== null) versionHints.add(m[1]);

  const snippetFound = /js\.driftt\.com\/include|drift\.load|drift\.init|window\.drift/i.test(text);

  return {
    driftIds: [...driftIds],
    driftHosts: [...hosts],
    snippetFound,
    versionHints: [...versionHints],
  };
}

/**
 * Enumerate Drift chat endpoints from DNS CNAME records.
 * @param {{query: string, type: string, value: string}[]} records DNS records
 *   already fetched by the caller (CNAME)
 * @returns {{query: string, target: string, kind: string, note: string, confidence: string}[]}
 */
export function enumerateDriftHostsFromDns(records) {
  const findings = [];
  const seen = new Set();
  for (const r of records || []) {
    if (!r || !r.value) continue;
    if (String(r.type || '').toUpperCase() !== 'CNAME') continue;
    const verdict = classifyDriftHost(r.value);
    if (!verdict.isDrift) continue;
    const query = normalizeHostname(r.query);
    if (seen.has(query)) continue;
    seen.add(query);
    findings.push({
      query,
      target: verdict.host,
      kind: verdict.kind,
      note: verdict.note,
      confidence: 'high',
    });
  }
  return findings;
}

/**
 * Full enumeration: merge DNS evidence with page-snippet evidence.
 * @param {{query: string, type: string, value: string}[]} dnsRecords
 * @param {{query: string, html: string}[]} pages page HTML per hostname
 * @returns {{query: string, driftDetected: boolean, driftIds: string[], dnsEvidence: object|null, snippetEvidence: object, confidence: string}[]}
 */
export function enumerateDriftChatHosts(dnsRecords, pages) {
  const dnsHits = new Map(
    enumerateDriftHostsFromDns(dnsRecords).map((f) => [f.query, f])
  );
  const pageQueries = new Set((pages || []).map((p) => normalizeHostname(p.query)));
  const allQueries = new Set([...dnsHits.keys(), ...pageQueries]);
  const results = [];

  for (const query of allQueries) {
    const page = (pages || []).find((p) => normalizeHostname(p.query) === query);
    const snippet = extractDriftSignals(page ? page.html : '');
    const dnsHit = dnsHits.get(query) || null;
    const snippetHit = snippet.snippetFound || snippet.driftIds.length > 0;
    const confidence =
      dnsHit && snippetHit ? 'high' : dnsHit || snippetHit ? 'medium' : 'low';
    results.push({
      query,
      driftDetected: Boolean(dnsHit || snippetHit),
      driftIds: snippet.driftIds,
      dnsEvidence: dnsHit,
      snippetEvidence: snippet,
      confidence,
    });
  }
  return results;
}
