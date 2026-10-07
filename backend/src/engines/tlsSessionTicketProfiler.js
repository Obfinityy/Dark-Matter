/**
 * tlsSessionTicketProfiler.js — TLS session-ticket behavior analysis engine.
 *
 * Analyzes session-ticket observations from handshakes against an authorized
 * target to fingerprint the TLS terminator (server software / edge stack)
 * and to assess session-resumption health. Pure analysis of observed values:
 * lifetime hints, ticket_age_add patterns, ticket rotation cadence, and
 * resumption success. It never crafts handshakes itself.
 */

/**
 * Known session-ticket behavior profiles of common TLS terminators.
 * lifetimeHintSec: typical session_ticket lifetime_hint advertised by the server.
 */
const TERMINATOR_PROFILES = [
  { family: 'nginx', lifetimeHintSec: 86400, ticketLen: [48], note: 'Default 24h session timeout; ticket length stable per build.' },
  { family: 'apache-httpd', lifetimeHintSec: 300, ticketLen: [256], note: 'Short default session cache timeout.' },
  { family: 'haproxy', lifetimeHintSec: 86400, ticketLen: [208], note: 'Ticket keys configurable; ~208-byte tickets typical.' },
  { family: 'cloudflare-edge', lifetimeHintSec: 64800, ticketLen: [164, 176], note: 'Rotating ticket keys; lifetime hint near 18h.' },
  { family: 'aws-cloudfront', lifetimeHintSec: 86400, ticketLen: [192], note: 'Long-lived tickets behind the CloudFront edge.' },
  { family: 'f5-bigip', lifetimeHintSec: 3600, ticketLen: [256], note: 'Configurable cache; 1h default session timeout.' },
  { family: 'envoy', lifetimeHintSec: 604800, ticketLen: [112], note: 'Long session ticket lifetime by default.' },
];

/**
 * Summarize a set of observed NewSessionTicket messages.
 * @param {{lifetimeHintSec?: number, ticketLen?: number, ticketAgeAdd?: number}[]} tickets
 * @returns {{count: number, avgLifetimeHintSec: number|null, ticketLenModes: number[], ticketAgeAddUnique: number, rotationSignals: number}}
 */
export function profileTickets(tickets = []) {
  const list = (Array.isArray(tickets) ? tickets : []).filter((t) => t && typeof t === 'object');
  if (list.length === 0) {
    return { count: 0, avgLifetimeHintSec: null, ticketLenModes: [], ticketAgeAddUnique: 0, rotationSignals: 0 };
  }
  const hints = list.map((t) => t.lifetimeHintSec).filter(Number.isFinite);
  const avgLifetimeHintSec = hints.length ? Math.round(hints.reduce((a, b) => a + b, 0) / hints.length) : null;
  const lenCounts = new Map();
  for (const t of list) {
    if (Number.isFinite(t.ticketLen)) lenCounts.set(t.ticketLen, (lenCounts.get(t.ticketLen) || 0) + 1);
  }
  const ticketLenModes = [...lenCounts.entries()].sort((a, b) => b[1] - a[1]).map(([len]) => len);
  const ageAdds = new Set(list.map((t) => t.ticketAgeAdd).filter(Number.isFinite));
  // Rotation signal: same session resumed but ticket bytes' stable prefix changed across handshakes
  const prefixes = new Set(list.map((t) => String(t.ticketPrefix || '')).filter(Boolean));
  return {
    count: list.length,
    avgLifetimeHintSec,
    ticketLenModes,
    ticketAgeAddUnique: ageAdds.size,
    rotationSignals: prefixes.size > 1 ? prefixes.size - 1 : 0,
  };
}

/**
 * Fingerprint the TLS terminator from an observed ticket profile.
 * @param {{avgLifetimeHintSec?: number|null, ticketLenModes?: number[]}} profile
 * @returns {{family: string, confidence: number, note: string}[]}
 */
export function fingerprintTerminator(profile = {}) {
  const hint = profile.avgLifetimeHintSec;
  const lens = Array.isArray(profile.ticketLenModes) ? profile.ticketLenModes : [];
  const scored = [];
  for (const p of TERMINATOR_PROFILES) {
    let score = 0;
    let reasons = 0;
    if (Number.isFinite(hint)) {
      reasons++;
      const ratio = Math.min(hint, p.lifetimeHintSec) / Math.max(hint, p.lifetimeHintSec);
      if (ratio >= 0.95) score += 60;
      else if (ratio >= 0.8) score += 35;
      else if (ratio >= 0.5) score += 15;
    }
    if (lens.length > 0) {
      reasons++;
      if (p.ticketLen.some((l) => lens.includes(l))) score += 40;
    }
    if (reasons === 0) continue;
    scored.push({
      family: p.family,
      confidence: Math.min(95, Math.round((score / (reasons > 1 ? 100 : 60)) * 100)),
      note: p.note,
    });
  }
  return scored.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Assess ticket-encryption-key rotation cadence from timestamped observations.
 * @param {{observedAt: string, ticketPrefix: string}[]} observations ISO timestamps + stable ticket prefix
 * @returns {{rotations: number, avgRotationHours: number|null, assessment: string}}
 */
export function assessRotation(observations = []) {
  const list = (Array.isArray(observations) ? observations : [])
    .filter((o) => o && o.observedAt && o.ticketPrefix)
    .map((o) => ({ at: new Date(o.observedAt).getTime(), prefix: String(o.ticketPrefix) }))
    .filter((o) => Number.isFinite(o.at))
    .sort((a, b) => a.at - b.at);
  if (list.length < 2) return { rotations: 0, avgRotationHours: null, assessment: 'insufficient-observations' };
  const changeTimes = [];
  for (let i = 1; i < list.length; i++) {
    if (list[i].prefix !== list[i - 1].prefix) changeTimes.push(list[i].at);
  }
  if (changeTimes.length === 0) {
    return { rotations: 0, avgRotationHours: null, assessment: 'no-rotation-observed — ticket keys appear static (forward-secrecy window is wide)' };
  }
  const gaps = [];
  for (let i = 1; i < changeTimes.length; i++) gaps.push((changeTimes[i] - changeTimes[i - 1]) / 3600000);
  gaps.unshift((changeTimes[0] - list[0].at) / 3600000);
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const assessment = avg <= 24
    ? 'healthy rotation (≤24h) — good forward-secrecy hygiene'
    : avg <= 168
      ? 'moderate rotation (≤7d) — acceptable for most threat models'
      : 'slow rotation (>7d) — long-lived ticket keys widen the decryption window if compromised';
  return { rotations: changeTimes.length, avgRotationHours: Math.round(avg * 100) / 100, assessment };
}

/**
 * Score session-resumption health from handshake outcomes.
 * @param {{resumed: boolean, viaTicket?: boolean}[]} sessions
 * @returns {{total: number, resumed: number, resumptionRatePct: number, ticketBased: number, assessment: string}}
 */
export function scoreSessionResumption(sessions = []) {
  const list = (Array.isArray(sessions) ? sessions : []).filter((s) => s && typeof s.resumed === 'boolean');
  const resumed = list.filter((s) => s.resumed);
  const ticketBased = resumed.filter((s) => s.viaTicket).length;
  const rate = list.length === 0 ? 0 : Math.round((resumed.length / list.length) * 10000) / 100;
  const assessment = list.length === 0
    ? 'no-data'
    : rate >= 80
      ? 'healthy resumption — low handshake overhead'
      : rate >= 40
        ? 'partial resumption — investigate ticket vs session-id paths'
        : 'poor resumption — clients pay full handshakes; check ticket deployment';
  return { total: list.length, resumed: resumed.length, resumptionRatePct: rate, ticketBased, assessment };
}

export const TLS_SESSION_TICKET = {
  profileTickets,
  fingerprintTerminator,
  assessRotation,
  scoreSessionResumption,
  TERMINATOR_PROFILES,
};
