/**
 * expectContinueBehavior.js — Expect: 100-continue behavior classification for autonomous bug bounty.
 *
 * Implements idea-bank item 00418: classify how a server/proxy pair
 * handles the Expect: 100-continue handshake (interim 100, 417 rejection,
 * silent body consumption) to fingerprint the stack combination.
 *
 * All functions are pure and side-effect free: they classify handshake
 * observations the caller recorded with safe probes during an authorized
 * engagement. No network activity happens here.
 */

/**
 * Known 100-continue behavior profiles.
 * @type {Array<{combination:string, interim100:boolean, rejects417:boolean, behavior:string, confidence:number}>}
 */
export const CONTINUE_PROFILES = [
  { combination: 'nginx origin', interim100: true, rejects417: false, behavior: 'sends 100 promptly, then reads body', confidence: 0.7 },
  { combination: 'Apache httpd origin', interim100: true, rejects417: true, behavior: 'sends 100 or 417 based on handler acceptance', confidence: 0.7 },
  { combination: 'AWS ALB frontend', interim100: false, rejects417: false, behavior: 'consumes body without interim 100', confidence: 0.75 },
  { combination: 'Cloudflare edge', interim100: true, rejects417: false, behavior: 'edge terminates handshake, 100 always sent', confidence: 0.75 },
  { combination: 'IIS origin', interim100: false, rejects417: true, behavior: 'no interim response; 417 when body disallowed', confidence: 0.7 },
  { combination: 'Go net/http origin', interim100: true, rejects417: false, behavior: 'automatic 100 on first body read', confidence: 0.65 },
];

/**
 * Classify a single 100-continue handshake observation.
 * @param {object} obs { expectSent:boolean, interim100Received:boolean,
 *   finalStatus:number|null, bodyConsumed:boolean, waitBeforeBodyMs:number,
 *   serverWaitedFor100:boolean }
 * @returns {{handshake:string, evidence:string[], anomaly:boolean}}
 */
export function classifyHandshake(obs) {
  const o = obs || {};
  const evidence = [];
  let handshake = 'unknown';
  let anomaly = false;
  if (!o.expectSent) {
    handshake = 'no-expect';
    evidence.push('no Expect header sent — baseline observation');
    return { handshake, evidence, anomaly };
  }
  if (o.interim100Received) {
    handshake = 'interim-100';
    evidence.push('server sent interim 100 Continue');
  } else if (o.finalStatus === 417) {
    handshake = 'rejected-417';
    evidence.push('server rejected with 417 Expectation Failed');
  } else if (o.bodyConsumed) {
    handshake = 'silent-consume';
    evidence.push('server consumed the body without any interim response');
    anomaly = true;
  } else {
    handshake = 'no-interim-final-only';
    evidence.push('server skipped interim 100 and went straight to final status');
  }
  if (o.serverWaitedFor100 === false && o.interim100Received === false && o.bodyConsumed) {
    anomaly = true;
    evidence.push('client sent body without server invitation — frontend may not forward Expect semantics');
  }
  if (o.waitBeforeBodyMs != null && o.waitBeforeBodyMs > 3000 && o.interim100Received) {
    evidence.push(`long pre-body wait (${o.waitBeforeBodyMs}ms) despite interim 100 — possible chained proxy`);
  }
  return { handshake, evidence, anomaly };
}

/**
 * Fingerprint the server/proxy combination from handshake classification.
 * @param {{handshake:string, anomaly:boolean}} classification Output of classifyHandshake.
 * @returns {Array<{combination:string, confidence:number, reason:string}>} sorted by confidence.
 */
export function fingerprintContinueStack(classification) {
  const interim = classification.handshake === 'interim-100';
  const rejected = classification.handshake === 'rejected-417';
  const results = [];
  for (const p of CONTINUE_PROFILES) {
    let score = 0;
    if (p.interim100 === interim) score += 1;
    if (p.rejects417 === rejected) score += 1;
    if (score === 0) continue;
    let confidence = p.confidence * (score / 2);
    if (classification.anomaly && p.combination.includes('frontend')) confidence = Math.min(0.9, confidence + 0.1);
    results.push({ combination: p.combination, confidence, reason: p.behavior });
  }
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Summarize 100-continue findings across multiple endpoints.
 * @param {Array<{handshake:string, anomaly:boolean}>} classifications
 * @returns {{consistent:boolean, handshakes:string[], anomalies:number, summary:string}}
 */
export function summarizeContinueBehavior(classifications) {
  const list = Array.isArray(classifications) ? classifications : [];
  const handshakes = [...new Set(list.map((c) => c.handshake))];
  const anomalies = list.filter((c) => c.anomaly).length;
  const consistent = handshakes.length <= 1;
  const summary = consistent
    ? `uniform ${handshakes[0] || 'unknown'} behavior across ${list.length} endpoints`
    : `inconsistent handshake behavior (${handshakes.join(', ')}) — possible mixed proxy/origin stack`;
  return { consistent, handshakes, anomalies, summary };
}
