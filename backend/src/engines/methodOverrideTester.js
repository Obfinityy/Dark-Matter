/**
 * methodOverrideTester.js — HTTP method-override header analysis for autonomous bug bounty.
 *
 * Implements idea-bank item 00406: analyze responses to X-HTTP-Method-Override
 * (and equivalent) probes to find hidden verb handling, where a POST carrying
 * an override header is treated as PUT or DELETE by the application.
 *
 * During an authorized engagement the caller records a baseline response for
 * a plain request and a second response for the same request carrying an
 * override header with a canary value. This module compares the two recorded
 * observations and decides whether the override was honored, rejected, or
 * ignored — without sending any request itself.
 */

/** Override headers commonly honored by frameworks and middleware. */
export const OVERRIDE_HEADERS = [
  'X-HTTP-Method-Override',
  'X-HTTP-Method',
  'X-Method-Override',
  '_method', // query/body parameter used by several frameworks
];

/**
 * Compare a baseline observation with an override-header observation.
 * @param {object} baseline { status?: number|null, bodyFingerprint?: string, allowHeader?: string|null } recorded without the override header.
 * @param {object} probed { status?: number|null, bodyFingerprint?: string, allowHeader?: string|null } recorded with the override header.
 * @param {object} meta { overrideHeader?: string, overrideValue?: string, path?: string }.
 * @returns {{honored:boolean, verdict:'honored'|'rejected'|'ignored'|'inconclusive', evidence:string[], risk:string}}
 */
export function analyzeOverrideProbe(baseline, probed, meta = {}) {
  const base = baseline && typeof baseline === 'object' ? baseline : {};
  const probe = probed && typeof probed === 'object' ? probed : {};
  const header =
    typeof meta.overrideHeader === 'string' ? meta.overrideHeader : 'X-HTTP-Method-Override';
  const value =
    typeof meta.overrideValue === 'string' ? meta.overrideValue.toUpperCase() : 'DELETE';
  const path = typeof meta.path === 'string' ? meta.path : '/';
  const evidence = [];

  const statusChanged = base.status !== probe.status;
  const bodyChanged =
    (base.bodyFingerprint || null) !== (probe.bodyFingerprint || null) &&
    probe.bodyFingerprint != null;
  const baseAllow = String(base.allowHeader || '');
  const probeAllow = String(probe.allowHeader || '');
  const allowChanged = baseAllow !== probeAllow && probeAllow.length > 0;

  if (statusChanged) evidence.push(`status changed ${base.status ?? '?'} → ${probe.status ?? '?'}`);
  if (bodyChanged) evidence.push('response body fingerprint changed');
  if (allowChanged) evidence.push('Allow header changed between baseline and override probe');

  let verdict = 'ignored';
  if (
    (statusChanged || bodyChanged || allowChanged) &&
    probe.status !== 400 &&
    probe.status !== 501
  ) {
    verdict = 'honored';
  } else if (probe.status === 400 || probe.status === 501 || probe.status === 405) {
    verdict = 'rejected';
  } else if (!statusChanged && !bodyChanged && !allowChanged) {
    verdict = 'ignored';
  } else {
    verdict = 'inconclusive';
  }

  const honored = verdict === 'honored';
  if (honored) {
    evidence.unshift(
      `${header}: ${value} appears honored on ${path} — hidden verb handling present`
    );
  }

  const risk =
    honored && (value === 'DELETE' || value === 'PUT') ? 'high' : honored ? 'medium' : 'info';

  return { honored, verdict, evidence, risk };
}

/**
 * Aggregate override-probe comparisons across endpoints and override values.
 * @param {Array<{baseline:object, probed:object, overrideHeader?:string, overrideValue?:string, path?:string}>} probes Probe pairs.
 * @returns {Array<{path:string, overrideHeader:string, honoredValues:string[], verdicts:Record<string,string>, risk:string, evidence:string[]}>}
 */
export function aggregateOverrideResults(probes) {
  const list = Array.isArray(probes) ? probes : [];
  const byKey = new Map();
  for (const p of list) {
    if (!p || typeof p !== 'object') continue;
    const key = `${p.path || '/'}::${p.overrideHeader || 'X-HTTP-Method-Override'}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        path: p.path || '/',
        overrideHeader: p.overrideHeader || 'X-HTTP-Method-Override',
        honoredValues: [],
        verdicts: {},
        risk: 'info',
        evidence: [],
      });
    }
    const entry = byKey.get(key);
    const value = String(p.overrideValue || 'DELETE').toUpperCase();
    const result = analyzeOverrideProbe(p.baseline, p.probed, p);
    entry.verdicts[value] = result.verdict;
    if (result.honored && !entry.honoredValues.includes(value)) entry.honoredValues.push(value);
    entry.evidence.push(...result.evidence.map(e => `[${value}] ${e}`));
    if (result.risk === 'high') entry.risk = 'high';
    else if (result.risk === 'medium' && entry.risk !== 'high') entry.risk = 'medium';
  }
  return [...byKey.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/**
 * Render report-ready lines for honored overrides.
 * @param {Array<{path:string, overrideHeader:string, honoredValues:string[], risk:string}>} aggregated Output of aggregateOverrideResults.
 * @returns {Array<string>}
 */
export function overrideSummaryLines(aggregated) {
  const list = Array.isArray(aggregated) ? aggregated : [];
  return list
    .filter(e => e.honoredValues.length > 0)
    .map(
      e => `${e.path}: ${e.overrideHeader} honors ${e.honoredValues.join(', ')} (risk: ${e.risk})`
    );
}
