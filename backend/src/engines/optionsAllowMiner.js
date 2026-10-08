/**
 * optionsAllowMiner.js — OPTIONS Allow-header mining for autonomous bug bounty.
 *
 * Implements idea-bank item 00404: parse Allow headers from OPTIONS
 * responses to enumerate supported methods, and cross-check the advertised
 * set against methods actually observed working, to catch lies and gaps.
 *
 * During an authorized engagement the caller issues a benign OPTIONS request
 * per endpoint and records the response headers. This module is pure
 * analysis of those recorded headers: it parses, normalizes, and compares
 * the advertised Allow set with observed per-method outcomes. No requests
 * are sent by this module.
 */

import { ENUMERATED_METHODS, methodRisk } from './httpMethodEnumerator.js';

/**
 * Parse an Allow header value into a normalized, deduplicated method list.
 * Unknown tokens are preserved (flagged) rather than dropped, because
 * custom verbs are themselves interesting.
 * @param {string|null|undefined} value Raw Allow header value.
 * @returns {{methods:string[], unknown:string[], raw:string|null}}
 */
export function parseAllowHeader(value) {
  if (value == null || typeof value !== 'string') return { methods: [], unknown: [], raw: null };
  const methods = [];
  const unknown = [];
  const seen = new Set();
  for (const token of value.split(',')) {
    const m = token.trim().toUpperCase();
    if (!m || seen.has(m)) continue;
    seen.add(m);
    if (ENUMERATED_METHODS.includes(m)) methods.push(m);
    else unknown.push(m);
  }
  return { methods, unknown, raw: value };
}

/**
 * Mine OPTIONS responses: per endpoint, extract the advertised Allow set.
 * @param {Array<{url?:string, path?:string, status?:number, allowHeader?:string}>} responses Recorded OPTIONS responses.
 * @returns {Array<{path:string, status:number|null, advertised:string[], unknownVerbs:string[], raw:string|null}>}
 */
export function mineOptionsResponses(responses) {
  const list = Array.isArray(responses) ? responses : [];
  return list.map(r => {
    const rec = r && typeof r === 'object' ? r : {};
    const path =
      typeof rec.path === 'string' ? rec.path : typeof rec.url === 'string' ? rec.url : '/';
    const parsed = parseAllowHeader(rec.allowHeader);
    return {
      path,
      status: typeof rec.status === 'number' ? rec.status : null,
      advertised: parsed.methods,
      unknownVerbs: parsed.unknown,
      raw: parsed.raw,
    };
  });
}

/**
 * Cross-check advertised Allow sets against observed per-method probe outcomes.
 * Flags verbs advertised but rejected (misleading header) and verbs working
 * but not advertised (hidden capability).
 * @param {Array<{path:string, advertised:string[]}>} advertised Output of mineOptionsResponses.
 * @param {Array<{path:string, methods:Record<string,{verdict:string}>}>} observed Output of enumerateMethods.
 * @returns {Array<{path:string, type:'advertised-but-rejected'|'working-but-unadvertised', method:string, risk:string, detail:string}>}
 */
export function detectAllowDiscrepancies(advertised, observed) {
  const advList = Array.isArray(advertised) ? advertised : [];
  const obsList = Array.isArray(observed) ? observed : [];
  const obsByPath = new Map(obsList.map(o => [o.path, o.methods || {}]));
  const out = [];
  for (const adv of advList) {
    const methods = obsByPath.get(adv.path);
    if (!methods) continue;
    const advertisedSet = new Set(adv.advertised || []);
    for (const method of ENUMERATED_METHODS) {
      const verdict = methods[method] ? methods[method].verdict : 'unknown';
      const works = verdict === 'accepted' || verdict === 'protected';
      if (advertisedSet.has(method) && verdict === 'rejected') {
        out.push({
          path: adv.path,
          type: 'advertised-but-rejected',
          method,
          risk: 'low',
          detail: `${method} is listed in the Allow header on ${adv.path} but probing returned 405/404 — the header over-advertises`,
        });
      } else if (!advertisedSet.has(method) && works) {
        out.push({
          path: adv.path,
          type: 'working-but-unadvertised',
          method,
          risk: methodRisk(method),
          detail: `${method} works on ${adv.path} but is missing from the Allow header — a hidden verb capability`,
        });
      }
    }
  }
  return out;
}

/**
 * Summarize mining results into report-ready lines.
 * @param {Array<{path:string, advertised:string[], unknownVerbs:string[]}>} mined Output of mineOptionsResponses.
 * @returns {Array<string>}
 */
export function allowSummaryLines(mined) {
  const list = Array.isArray(mined) ? mined : [];
  return list.map(m => {
    const adv = m.advertised.length > 0 ? m.advertised.join(', ') : '(no Allow header advertised)';
    const extra = m.unknownVerbs.length > 0 ? `; custom verbs: ${m.unknownVerbs.join(', ')}` : '';
    return `${m.path} advertises: ${adv}${extra}`;
  });
}
