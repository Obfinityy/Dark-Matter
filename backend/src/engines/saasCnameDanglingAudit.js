/**
 * saasCnameDanglingAudit.js — Service-desk SaaS CNAME audit engine.
 *
 * Audits helpdesk/chat SaaS CNAME records for DANGLING targets: custom
 * domains whose vendor-side tenant no longer exists (e.g. after contract
 * churn), which become subdomain-takeover opportunities for an authorized
 * hunter to report.
 *
 * Passive analysis only: given a list of CNAME records plus per-record
 * "probe" results already collected by the caller (target HTTP status,
 * response body fingerprint), this engine classifies each record as
 *  - active: resolves to the vendor and shows a live tenant page
 *  - dangling: resolves to the vendor but shows the vendor's "no such
 *    account / not found" fingerprint
 *  - external: target is outside known SaaS space (not audited)
 * No network calls are made here.
 */

const PROVIDERS = [
  {
    name: 'Zendesk',
    targetRe: /(^|\.)zendesk\.com$/i,
    danglingRe: /there.+no.+help.?center here|no.+such.+account|this help center|404/i,
    danglingMarkers: ["There's no help center here", 'No help desk found'],
  },
  {
    name: 'Freshdesk',
    targetRe: /(^|\.)freshdesk\.com$/i,
    danglingRe: /this (portal|url)|does not exist|not found/i,
    danglingMarkers: ['This portal does not exist', 'Invalid portal'],
  },
  {
    name: 'Intercom',
    targetRe: /(^|\.)(intercom\.io|intercom\.help|custom\.intercom\.help)$/i,
    danglingRe: /not found|does not exist/i,
    danglingMarkers: ['Help Center not found'],
  },
  {
    name: 'Drift',
    targetRe: /(^|\.)(driftt\.com|drift\.com)$/i,
    danglingRe: /not found|does not exist/i,
    danglingMarkers: ['Page not found'],
  },
  {
    name: 'SendGrid',
    targetRe: /(^|\.)sendgrid\.net$/i,
    danglingRe: /not found/i,
    danglingMarkers: [],
  },
  {
    name: 'Teachable',
    targetRe: /(^|\.)teachable\.com$/i,
    danglingRe: /school not found|does not exist/i,
    danglingMarkers: ['School not found'],
  },
  {
    name: 'Thinkific',
    targetRe: /(^|\.)thinkific\.com$/i,
    danglingRe: /site not found|does not exist/i,
    danglingMarkers: ['Site not found'],
  },
  {
    name: 'Kajabi',
    targetRe: /(^|\.)(mykajabi\.com|kajabi\.com)$/i,
    danglingRe: /not found|does not exist/i,
    danglingMarkers: ['Page not found'],
  },
];

/**
 * Identify which SaaS provider (if any) a CNAME target belongs to.
 * @param {string} target CNAME target hostname
 * @returns {object|null} provider descriptor
 */
export function identifyProvider(target = '') {
  const t = String(target).toLowerCase().replace(/\.$/, '');
  return PROVIDERS.find(p => p.targetRe.test(t)) || null;
}

/**
 * Classify a single audited CNAME record.
 * @param {{name: string, target: string, probe?: {status: number|null, body: string, resolves: boolean}}} record
 * @returns {{name: string, target: string, provider: string|null, verdict: 'active'|'dangling'|'external'|'unresolved', evidence: string[]}}
 */
export function auditCname(record = {}) {
  const name = String(record.name || '')
    .toLowerCase()
    .replace(/\.$/, '');
  const target = String(record.target || '')
    .toLowerCase()
    .replace(/\.$/, '');
  const provider = identifyProvider(target);
  const probe = record.probe || {};
  const evidence = [];

  if (!provider) {
    return {
      name,
      target,
      provider: null,
      verdict: 'external',
      evidence: ['Target is outside known SaaS helpdesk space.'],
    };
  }
  if (probe.resolves === false) {
    evidence.push('CNAME target does not resolve — possible stale record.');
    return { name, target, provider: provider.name, verdict: 'unresolved', evidence };
  }
  const body = String(probe.body || '');
  const markerHit = provider.danglingMarkers.find(m => body.includes(m));
  if (markerHit || provider.danglingRe.test(body)) {
    evidence.push(
      `Vendor fingerprint indicates missing tenant: "${markerHit || 'dangling pattern match'}".`
    );
    evidence.push(
      `Recommendation: verify tenant absence with the vendor, then report as dangling DNS.`
    );
    return { name, target, provider: provider.name, verdict: 'dangling', evidence };
  }
  if (probe.status && probe.status >= 200 && probe.status < 400) {
    evidence.push(
      `Target resolves to ${provider.name} and returns HTTP ${probe.status} — tenant appears active.`
    );
    return { name, target, provider: provider.name, verdict: 'active', evidence };
  }
  evidence.push('Inconclusive probe data — manual review advised.');
  return { name, target, provider: provider.name, verdict: 'unresolved', evidence };
}

/**
 * Audit a full CNAME set and summarize.
 * @param {{name: string, target: string, probe?: object}[]} records
 * @returns {{results: object[], summary: {total: number, dangling: number, active: number, unresolved: number, external: number}}}
 */
export function auditCnameSet(records = []) {
  const results = (records || []).map(auditCname);
  const summary = { total: results.length, dangling: 0, active: 0, unresolved: 0, external: 0 };
  for (const r of results) summary[r.verdict] += 1;
  return { results, summary };
}
