/**
 * irPlatformMiner.js — Investor-relations platform host discovery engine.
 *
 * @idea 00296
 * Covers idea-bank item 00296:
 *  - 00296 Investor-relations platform host discovery — find Q4/Notified IR
 *    hosts via investor-page links.
 *
 * Pure functions only: the caller fetches investor-relations page HTML and
 * passes the raw text in. No live HTTP here.
 */

const IR_PROVIDERS = [
  {
    provider: 'q4',
    hostRe: /(^|\.)q4cdn\.com$|(^|\.)q4inc\.com$|(^|\.)q4ir\.com$/i,
    linkRe: /q4cdn\.com/i,
    note: 'Q4 Inc. IR platform — webcasts, filings, alerts hosts',
  },
  {
    provider: 'notified',
    hostRe: /(^|\.)notified\.com$|(^|\.)globene[w]swire\.com$|(^|\.)intrado\.com$/i,
    linkRe: /notified\.com|globenewswire\.com|intrado\.com/i,
    note: 'Notified (ex-Intrado) IR platform — press-release and webcast hosts',
  },
  {
    provider: 'businesswire',
    hostRe: /(^|\.)businesswire\.com$/i,
    linkRe: /businesswire\.com/i,
    note: 'Business Wire IR/newsroom hosting',
  },
  {
    provider: 'nasdaq-ir',
    hostRe: /(^|\.)ir\.nasdaq\.com$|(^|\.)corporate\.nasdaq\.com$/i,
    linkRe: /nasdaq\.com/i,
    note: 'Nasdaq IR platform hosting',
  },
  {
    provider: 'shareholder-com',
    hostRe: /(^|\.)shareholder\.com$/i,
    linkRe: /shareholder\.com/i,
    note: 'Shareholder.com IR portal hosting',
  },
  {
    provider: 'investorroom',
    hostRe: /(^|\.)investorroom\.com$/i,
    linkRe: /investorroom\.com/i,
    note: 'InvestorRoom IR portal hosting',
  },
  {
    provider: 'sra',
    hostRe: /(^|\.)srax\.com$|(^|\.)srair\.com$/i,
    linkRe: /srair\.com|srax\.com/i,
    note: 'SRA (Strategic IR) portal hosting',
  },
  {
    provider: 'edgar-online',
    hostRe: /(^|\.)onlinewsj\.com$|(^|\.)edgar-online\.com$/i,
    linkRe: /edgar-online\.com/i,
    note: 'EDGAR filing-hosting service',
  },
];

const ATTR_URL_RE = /(?:href|src|action|data-[a-z-]*url)\s*=\s*["']([^"']+)["']/gi;

/**
 * Normalize a hostname: lowercase, strip scheme, port, trailing dot.
 * @param {string} host
 * @returns {string}
 */
export function normalizeHost(host) {
  return String(host || '')
    .trim()
    .toLowerCase()
    .replace(/^\w+:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * Fingerprint an IR platform provider from a hostname.
 * @param {string} host
 * @returns {{provider: string, note: string} | null}
 */
export function fingerprintIrProvider(host) {
  const h = normalizeHost(host);
  if (!h) return null;
  for (const p of IR_PROVIDERS) {
    if (p.hostRe.test(h)) return { provider: p.provider, note: p.note };
  }
  return null;
}

/**
 * Discover IR-platform hosts from investor-relations page HTML.
 * @param {string} html investor-relations page HTML
 * @returns {{provider: string, host: string, url: string, note: string}[]}
 */
export function discoverIrHosts(html = '') {
  const text = String(html || '');
  const results = [];
  const seen = new Set();

  for (const m of text.matchAll(ATTR_URL_RE)) {
    const raw = m[1];
    if (!/^(https?:)?\/\//i.test(raw)) continue;
    let host = '';
    try {
      host = normalizeHost(new URL(raw.startsWith('//') ? `https:${raw}` : raw).hostname);
    } catch { continue; }
    const fp = fingerprintIrProvider(host);
    if (!fp) continue;
    const key = `${fp.provider}|${host}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ provider: fp.provider, host, url: raw.slice(0, 200), note: fp.note });
  }

  // Also catch provider mentions that do not resolve to a linked host.
  for (const p of IR_PROVIDERS) {
    if (p.linkRe.test(text)) {
      const mentionKey = `${p.provider}|mentioned`;
      if (!seen.has(mentionKey) && !results.some((r) => r.provider === p.provider)) {
        seen.add(mentionKey);
        results.push({ provider: p.provider, host: '', url: '', note: `${p.note} (referenced in page text, no direct host link found)` });
      }
    }
  }

  return results.sort((a, b) => a.provider.localeCompare(b.provider) || a.host.localeCompare(b.host));
}

/**
 * Score IR findings: IR hosts publish filings, webcasts and alert lists —
 * legitimate brand surface, useful for subdomain pivoting.
 * @param {ReturnType<typeof discoverIrHosts>} findings
 * @returns {{host: string, provider: string, score: number, reason: string}[]}
 */
export function scoreIrFindings(findings = []) {
  return (findings || []).map((f) => ({
    host: f.host || f.provider,
    provider: f.provider,
    score: f.host ? 55 : 30,
    reason: f.host
      ? `${f.provider} IR platform host linked from the investor page — filings/webcast surface, pivot for related subdomains`
      : `${f.provider} referenced but no direct host link — confirm provider contract manually`,
  })).sort((a, b) => b.score - a.score);
}
