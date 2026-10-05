/**
 * intercomHostDiscovery.js — Intercom messenger host discovery engine.
 *
 * @idea 00283 — Intercom messenger host discovery — find Intercom-backed
 *   chat hosts via widget snippets and DNS.
 *
 * Intercom's messenger is embedded via a small boot snippet that references
 * widget.intercom.io and an app_id. Some orgs also route chat subdomains
 * through Intercom. This engine extracts app IDs and Intercom host
 * references from page HTML and classifies DNS targets as Intercom
 * infrastructure.
 *
 * Pure functions only: callers fetch page HTML and DNS records themselves.
 * No live network calls here.
 */

const INTERCOM_HOST_PATTERNS = [
  { re: /^widget\.intercom\.io$/i, kind: 'messenger-widget', note: 'Intercom messenger widget CDN' },
  { re: /^api\.intercom\.io$/i, kind: 'api', note: 'Intercom public API' },
  { re: /\.intercom\.io$/i, kind: 'intercom-cdn', note: 'Intercom infrastructure host' },
  { re: /\.intercomcdn\.com$/i, kind: 'intercom-assets', note: 'Intercom static assets CDN' },
  { re: /^js\.intercomcdn\.com$/i, kind: 'intercom-loader', note: 'Intercom snippet loader' },
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
 * Classify a hostname as Intercom infrastructure.
 * @param {string} host
 * @returns {{isIntercom: boolean, kind: string, note: string, host: string}}
 */
export function classifyIntercomHost(host) {
  const h = normalizeHostname(host);
  for (const { re, kind, note } of INTERCOM_HOST_PATTERNS) {
    if (re.test(h)) return { isIntercom: true, kind, note, host: h };
  }
  return { isIntercom: false, kind: 'other', note: '', host: h };
}

/**
 * Extract Intercom integration signals from page HTML: app_id, workspace
 * identifiers, and referenced Intercom hosts.
 * @param {string} html page HTML
 * @returns {{appIds: string[], intercomHosts: string[], bootSnippetFound: boolean, workspaceHints: string[]}}
 */
export function extractIntercomSignals(html) {
  const text = String(html || '');
  const appIds = new Set();
  const hosts = new Set();
  const workspaceHints = new Set();

  const appIdPatterns = [
    /intercomSettings\s*=\s*\{[^}]*app_id\s*:\s*["']([a-z0-9]{6,})["']/i,
    /["']?app_id["']?\s*:\s*["']([a-z0-9]{6,})["']/i,
    /data-intercom-app-id=["']([a-z0-9]{6,})["']/i,
    /intercom\(['"]boot['"]\s*,\s*\{[^}]*app_id\s*:\s*["']([a-z0-9]{6,})["']/i,
  ];
  for (const re of appIdPatterns) {
    const m = text.match(re);
    if (m) appIds.add(m[1]);
  }

  const urlRe = /https?:\/\/([a-z0-9][a-z0-9.-]*intercom[a-z0-9.-]*)/gi;
  let m;
  while ((m = urlRe.exec(text)) !== null) hosts.add(normalizeHostname(m[1]));

  const srcRe = /<script[^>]+src=["']https?:\/\/([^"']+)["']/gi;
  while ((m = srcRe.exec(text)) !== null) {
    const h = normalizeHostname(m[1].split('/')[0]);
    if (/intercom/.test(h)) hosts.add(h);
  }

  const bootSnippetFound = /window\.Intercom|Intercom\(['"]boot|intercomSettings/i.test(text);

  const wsRe = /(?:intercom\.com\/a\/apps|app\.intercom\.com)\/([a-z0-9_-]{6,})/gi;
  while ((m = wsRe.exec(text)) !== null) workspaceHints.add(m[1]);

  return {
    appIds: [...appIds],
    intercomHosts: [...hosts],
    bootSnippetFound,
    workspaceHints: [...workspaceHints],
  };
}

/**
 * Find Intercom-backed chat hosts from DNS records: CNAMEs pointing at
 * Intercom infrastructure, or subdomains whose names suggest a chat
 * endpoint that also references Intercom hosts in page HTML.
 * @param {{query: string, type: string, value: string}[]} records DNS records
 *   already fetched by the caller (CNAME)
 * @returns {{query: string, target: string, kind: string, note: string, confidence: string}[]}
 */
export function discoverIntercomHostsFromDns(records) {
  const findings = [];
  const seen = new Set();
  for (const r of records || []) {
    if (!r || !r.value) continue;
    if (String(r.type || '').toUpperCase() !== 'CNAME') continue;
    const verdict = classifyIntercomHost(r.value);
    if (!verdict.isIntercom) continue;
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
 * Full discovery: combine DNS evidence with page-snippet evidence for a
 * set of candidate hostnames.
 * @param {{query: string, type: string, value: string}[]} dnsRecords
 * @param {{query: string, html: string}[]} pages page HTML per hostname
 * @returns {{query: string, intercomDetected: boolean, appIds: string[], dnsEvidence: object|null, snippetEvidence: object, confidence: string}[]}
 */
export function discoverIntercomChatHosts(dnsRecords, pages) {
  const dnsHits = new Map(
    discoverIntercomHostsFromDns(dnsRecords).map((f) => [f.query, f])
  );
  const results = [];
  const pageQueries = new Set((pages || []).map((p) => normalizeHostname(p.query)));
  const allQueries = new Set([...dnsHits.keys(), ...pageQueries]);

  for (const query of allQueries) {
    const page = (pages || []).find((p) => normalizeHostname(p.query) === query);
    const snippet = extractIntercomSignals(page ? page.html : '');
    const dnsHit = dnsHits.get(query) || null;
    const snippetHit = snippet.bootSnippetFound || snippet.appIds.length > 0;
    const confidence =
      dnsHit && snippetHit ? 'high' : dnsHit || snippetHit ? 'medium' : 'low';
    results.push({
      query,
      intercomDetected: Boolean(dnsHit || snippetHit),
      appIds: snippet.appIds,
      dnsEvidence: dnsHit,
      snippetEvidence: snippet,
      confidence,
    });
  }
  return results;
}
