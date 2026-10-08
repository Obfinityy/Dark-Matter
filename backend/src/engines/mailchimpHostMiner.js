/**
 * mailchimpHostMiner.js — Mailchimp landing-page host mining engine.
 *
 * Covers idea-bank item 00280:
 *  - 00280 Mailchimp landing-page host mining — find Mailchimp-hosted
 *    pages via mailchi.mp and list-manage patterns.
 *
 * Pure functions only: callers fetch page source and DNS records themselves
 * (respecting provider rate limits) and pass the raw data in. No live HTTP
 * here.
 */

const MC_HOST_RES = [
  { re: /\.mailchi\.mp$/i, kind: 'mailchimp-landing', note: 'Mailchimp landing page (mailchi.mp)' },
  {
    re: /\.list-manage\.com$/i,
    kind: 'list-manage',
    note: 'Mailchimp list-manage (signup/archive) host',
  },
  { re: /\.mailchimp\.com$/i, kind: 'mailchimp', note: 'Mailchimp platform host' },
  {
    re: /\.campaign-archive\.com$/i,
    kind: 'campaign-archive',
    note: 'Mailchimp campaign archive host',
  },
];
const MC_HOSTNAME_RE =
  /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:mailchi\.mp|list-manage\.com|mailchimp\.com|campaign-archive\.com)\b/gi;
// Mailchimp embedded form action: https://xxx.us14.list-manage.com/subscribe/post?u=<uid>&amp;id=<listid>
const MC_FORM_RE =
  /https?:\/\/([a-z0-9.-]+\.list-manage\.com)\/subscribe\/post\?u=([a-f0-9]+)(?:&(?:amp;)?id=([a-f0-9]+))?/i;

/**
 * Normalize a hostname: lowercase, strip trailing dot, port, and scheme.
 * @param {string} host
 * @returns {string}
 */
export function normalizeHostname(host) {
  if (!host) return '';
  return String(host)
    .trim()
    .toLowerCase()
    .replace(/^\w+:\/\//, '')
    .replace(/^[^@\s]+@/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * Classify a hostname by Mailchimp host pattern.
 * @param {string} hostname
 * @returns {{isMailchimp: boolean, kind: string, note: string, host: string}}
 */
export function classifyMailchimpHost(hostname) {
  const host = normalizeHostname(hostname);
  for (const { re, kind, note } of MC_HOST_RES) {
    if (re.test(host)) return { isMailchimp: true, kind, note, host };
  }
  return { isMailchimp: false, kind: 'other', note: '', host };
}

/**
 * Extract Mailchimp list identifiers (u= account uid, id= list id) from an
 * embedded signup form action URL found in page source.
 *
 * @param {string} pageSource HTML already fetched by the caller
 * @returns {{host: string, accountUid: string, listId: string}|null}
 */
export function extractMailchimpForm(pageSource = '') {
  const m = String(pageSource || '').match(MC_FORM_RE);
  if (!m) return null;
  return { host: normalizeHostname(m[1]), accountUid: m[2] || '', listId: m[3] || '' };
}

/**
 * Extract Mailchimp-hosted page hosts from page source and DNS CNAME targets
 * supplied by the caller.
 *
 * @param {string} pageSource HTML already fetched by the caller
 * @param {string[]} cnameTargets CNAME targets already resolved by the caller
 * @returns {{host: string, kind: string, note: string, sources: string[], accountUid: string, listId: string}[]}
 */
export function extractMailchimpHosts(pageSource = '', cnameTargets = []) {
  const byHost = new Map();
  const note = (raw, source) => {
    const cls = classifyMailchimpHost(raw);
    if (!cls.isMailchimp) return;
    if (!byHost.has(cls.host)) {
      byHost.set(cls.host, { host: cls.host, kind: cls.kind, note: cls.note, sources: new Set() });
    }
    byHost.get(cls.host).sources.add(source);
  };

  for (const m of String(pageSource || '').matchAll(MC_HOSTNAME_RE)) {
    note(m[0], 'page-source');
  }
  for (const target of cnameTargets || []) note(target, 'dns-cname');

  const form = extractMailchimpForm(pageSource);

  return [...byHost.values()]
    .map(e => ({
      host: e.host,
      kind: e.kind,
      note: e.note,
      sources: [...e.sources].sort(),
      accountUid: form && form.host === e.host ? form.accountUid : '',
      listId: form && form.host === e.host ? form.listId : '',
    }))
    .sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Detect Mailchimp presence on a site from page source markers.
 *
 * @param {string} pageSource HTML already fetched by the caller
 * @returns {{onMailchimp: boolean, form: ReturnType<typeof extractMailchimpForm>, evidence: string[]}}
 */
export function detectMailchimp(pageSource = '') {
  const evidence = [];
  const text = String(pageSource || '');
  const form = extractMailchimpForm(text);
  if (form) evidence.push('Mailchimp embedded signup form action present');
  if (/mc-validate|mailchimp/i.test(text)) evidence.push('Mailchimp references in page source');
  return { onMailchimp: evidence.length > 0, form, evidence };
}

/**
 * Score Mailchimp hosts for hunt relevance: brand-matching and
 * list-attributable hosts score highest.
 *
 * @param {ReturnType<typeof extractMailchimpHosts>} hosts
 * @param {string} rootDomain e.g. "example.com"
 * @returns {{host: string, score: number, reasons: string[]}[]}
 */
export function scoreMailchimpHosts(hosts = [], rootDomain = '') {
  const brand = normalizeHostname(rootDomain).split('.')[0];
  return (hosts || [])
    .map(h => {
      let score = 25;
      const reasons = ['Mailchimp-hosted page'];
      if (brand && h.host.includes(brand)) {
        score += 40;
        reasons.push(`hostname references brand "${brand}"`);
      }
      if (h.kind === 'mailchimp-landing') {
        score += 10;
        reasons.push('dedicated landing page host');
      }
      if (h.accountUid || h.listId) {
        score += 15;
        reasons.push('list/account identifiers attributable');
      }
      if (h.sources.length > 1) {
        score += 10;
        reasons.push(`confirmed via ${h.sources.join(' + ')}`);
      }
      return { host: h.host, score: Math.min(100, score), reasons };
    })
    .sort((a, b) => b.score - a.score);
}
