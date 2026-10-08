/**
 * webhookCatcherDetector.js — Temporary webhook-catcher leftover detector.
 *
 * Developers often debug webhooks with disposable catcher services (webhook.site,
 * requestcatcher.com, beeceptor, pipedream, ...) and forget to remove the URLs
 * from shipped configs, env samples, docs, or JS bundles. A leftover catcher URL
 * is a hardening finding: it reveals testing infrastructure, may still forward
 * live production events to a third party, and shows the deployment pipeline
 * leaks debug artefacts.
 *
 * Pure text analysis: the caller supplies fetched text (config, JS bundle,
 * documentation). This module only DETECTS exposure — it never sends data to
 * catchers. Defensive use: authorized hardening review on targets the user may test.
 */

/** Disposable webhook-catcher services whose domains should never ship in configs. */
export const TEMPORARY_CATCHER_DOMAINS = [
  'webhook.site',
  'requestcatcher.com',
  'beeceptor.com',
  'pipedream.net',
  'm.pipedream.net',
  'postb.in',
  'webhookinbox.com',
  'smee.io',
  'hookbin.com',
  'requestbin.net',
  'ptsv2.com',
];

const URL_RE = /https?:\/\/[^\s"'`<>()]+/gi;

/**
 * Extract all http(s) URLs from a text blob.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function extractUrls(text) {
  if (typeof text !== 'string') return [];
  URL_RE.lastIndex = 0;
  const out = [];
  let m;
  while ((m = URL_RE.exec(text)) !== null) {
    out.push(m[0].replace(/[.,;!?]+$/, ''));
  }
  return out;
}

/**
 * Check whether a hostname belongs to a known temporary catcher service.
 *
 * @param {string} hostname
 * @returns {string|null} matching catcher domain, or null
 */
export function matchCatcherDomain(hostname) {
  const host = String(hostname || '').toLowerCase();
  for (const domain of TEMPORARY_CATCHER_DOMAINS) {
    if (host === domain || host.endsWith(`.${domain}`)) return domain;
  }
  return null;
}

/**
 * Score severity from the source context a URL was found in.
 *
 * @param {string} source - e.g. 'config', 'js-bundle', 'docs', 'env-sample'
 * @returns {'high'|'medium'|'low'}
 */
export function severityForSource(source = '') {
  const s = String(source).toLowerCase();
  if (/(^|[^a-z])(config|env|secret|credential|prod|deploy)/.test(s)) return 'high';
  if (/js|bundle|chunk|asset/.test(s)) return 'medium';
  return 'low';
}

/**
 * Scan text for leftover temporary webhook-catcher URLs.
 *
 * @param {{ source?: string, text: string }} input
 * @returns {{ type: string, confidence: string, findings: object[], evidence: string }}
 */
export function detectCatcherLeftovers({ source = 'unknown', text = '' } = {}) {
  const findings = [];
  for (const url of extractUrls(text)) {
    let hostname;
    try {
      hostname = new URL(url).hostname;
    } catch {
      continue;
    }
    const catcher = matchCatcherDomain(hostname);
    if (catcher) {
      findings.push({
        url,
        hostname,
        catcherService: catcher,
        severity: severityForSource(source),
        source,
        remediation:
          'Remove the disposable catcher URL and point the webhook at the real ' +
          'endpoint; rotate any credentials that may have been posted to the catcher.',
      });
    }
  }

  const unique = [];
  const seen = new Set();
  for (const f of findings) {
    if (!seen.has(f.url)) {
      seen.add(f.url);
      unique.push(f);
    }
  }

  return {
    type: 'Temporary Webhook-Catcher Leftover Detection',
    confidence: unique.length ? 'high' : 'low',
    findings: unique,
    evidence: unique.length
      ? `Found ${unique.length} temporary webhook-catcher URL(s) in ${source}: ${unique.map(f => `${f.url} (${f.catcherService}, severity ${f.severity})`).join('; ')}. ` +
        'Catcher URLs in shipped artefacts reveal debug infrastructure and may leak live events to third parties.'
      : `No temporary webhook-catcher URLs found in ${source}.`,
  };
}

export const WEBHOOK_CATCHER_DETECTOR = {
  TEMPORARY_CATCHER_DOMAINS,
  extractUrls,
  matchCatcherDomain,
  severityForSource,
  detectCatcherLeftovers,
};
export default WEBHOOK_CATCHER_DETECTOR;
