/**
 * domainWatchIntel.js — Domain expiry watch and drop-catchlist intelligence
 * for autonomous bug bounty.
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. Covers
 * idea-bank items 00051–00060:
 *
 *  00051 Expired-domain re-registration monitor — watch domains previously
 *            owned by the target that expire; flag when re-registrable
 *            because dangling DNS may still point at them.
 *  00052 Domain-drop catchlist building — build a watchlist of
 *            target-linked domains nearing expiry from WHOIS data and queue
 *            takeover checks the moment they drop.
 *
 * All functions are pure and side-effect free: they parse WHOIS expiry
 * records and priority data supplied by the caller. WHOIS lookups and the
 * actual takeover checks are left to the caller, so the engine stays
 * testable and safe to run anywhere.
 */

const MS_PER_DAY = 86400000;

/** Expiry windows (in days) used to categorize watchlist entries. */
export const EXPIRY_WINDOWS = {
  expired: 0,
  imminent: 7,
  near: 30,
  upcoming: 90,
};

/** Weighting used by scoreDropPriority(). */
export const DROP_SCORE_WEIGHTS = {
  targetLinked: 40,      // domain was previously owned by / linked to the target
  danglingEvidence: 25,  // evidence that live DNS still references the name
  brandKeyword: 15,      // domain contains a target brand keyword
  windowProximity: 20,   // how close the drop is (scaled 0..20)
};

/**
 * Parse a WHOIS-style expiry value into a Date.
 * Accepts ISO strings, epoch seconds, epoch milliseconds, and common
 * "YYYY-MM-DD" forms. Returns null when the value is unparseable.
 *
 * @param {string|number|null|undefined} value
 * @returns {Date|null}
 */
export function parseExpiryDate(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    const ms = value < 1e12 ? value * 1000 : value; // epoch seconds vs ms
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return null;
    let d = new Date(t);
    if (!Number.isNaN(d.getTime())) return d;
    // Try "YYYYMMDD" compact form.
    if (/^\d{8}$/.test(t)) {
      d = new Date(`${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T00:00:00Z`);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return null;
  }
  return null;
}

/**
 * Whole days from `now` until the domain expires (negative = already expired).
 *
 * @param {Date|null} expiry
 * @param {Date} [now]
 * @returns {number|null} null when expiry is unknown.
 */
export function daysUntilExpiry(expiry, now = new Date()) {
  if (!expiry || !(expiry instanceof Date) || Number.isNaN(expiry.getTime())) return null;
  return Math.floor((expiry.getTime() - now.getTime()) / MS_PER_DAY);
}

/**
 * Categorize a watchlist entry by its expiry horizon.
 *
 * @param {number|null} daysLeft days until expiry from daysUntilExpiry()
 * @returns {'expired'|'imminent'|'near'|'upcoming'|'distant'|'unknown'}
 */
export function categorizeExpiryWindow(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return 'unknown';
  if (daysLeft <= EXPIRY_WINDOWS.expired) return 'expired';
  if (daysLeft <= EXPIRY_WINDOWS.imminent) return 'imminent';
  if (daysLeft <= EXPIRY_WINDOWS.near) return 'near';
  if (daysLeft <= EXPIRY_WINDOWS.upcoming) return 'upcoming';
  return 'distant';
}

/**
 * Normalize a raw WHOIS-derived domain record into a watchlist entry.
 *
 * @param {object} record { domain, expiry, registrant?, brandKeywords?, ... }
 * @param {object} [opts] { now?: Date, brandKeywords?: string[] }
 * @returns {object|null} watchlist entry or null when the domain is invalid.
 */
export function buildWatchEntry(record, opts = {}) {
  if (!record || typeof record.domain !== 'string') return null;
  const domain = record.domain.trim().toLowerCase();
  if (!/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?\.[a-z]{2,}$/i.test(domain)) return null;
  const now = opts.now instanceof Date ? opts.now : new Date();
  const expiry = parseExpiryDate(record.expiry);
  const daysLeft = daysUntilExpiry(expiry, now);
  const brandKeywords = Array.isArray(opts.brandKeywords) ? opts.brandKeywords : (record.brandKeywords || []);
  const brandHit = brandKeywords
    .filter(k => typeof k === 'string' && k.length > 0)
    .some(k => domain.includes(k.toLowerCase()));
  return {
    domain,
    expiry: expiry ? expiry.toISOString() : null,
    daysLeft,
    window: categorizeExpiryWindow(daysLeft),
    targetLinked: record.targetLinked === true,
    danglingEvidence: record.danglingEvidence === true,
    brandKeywordHit: brandHit,
    registrant: typeof record.registrant === 'string' ? record.registrant : null,
  };
}

/**
 * Build the full expiry watchlist from raw WHOIS records.
 *
 * @param {object[]} records raw records (see buildWatchEntry)
 * @param {object} [opts] { now?: Date, brandKeywords?: string[], maxHorizonDays?: number }
 * @returns {object[]} entries sorted by daysLeft ascending (unknown last).
 */
export function buildExpiryWatchlist(records, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const maxHorizon = Number.isFinite(opts.maxHorizonDays) ? opts.maxHorizonDays : 365;
  const entries = (Array.isArray(records) ? records : [])
    .map(r => buildWatchEntry(r, { ...opts, now }))
    .filter(Boolean)
    .filter(e => e.daysLeft === null || e.daysLeft <= maxHorizon);
  entries.sort((a, b) => {
    if (a.daysLeft === null) return 1;
    if (b.daysLeft === null) return -1;
    return a.daysLeft - b.daysLeft;
  });
  return entries;
}

/**
 * Score how urgently a domain belongs on the drop-catchlist (0–100).
 * Target-linked, recently-dropped names with dangling-DNS evidence score
 * highest because they are the classic subdomain-takeover pattern.
 *
 * @param {object} entry watchlist entry from buildWatchEntry()
 * @param {object} [opts] { now?: Date }
 * @returns {{ score: number, reasons: string[] }}
 */
export function scoreDropPriority(entry, opts = {}) {
  const reasons = [];
  let score = 0;
  if (!entry || typeof entry !== 'object') return { score: 0, reasons };
  if (entry.targetLinked === true) {
    score += DROP_SCORE_WEIGHTS.targetLinked;
    reasons.push('previously owned by or linked to the target');
  }
  if (entry.danglingEvidence === true) {
    score += DROP_SCORE_WEIGHTS.danglingEvidence;
    reasons.push('evidence that live DNS still references this name');
  }
  if (entry.brandKeywordHit === true) {
    score += DROP_SCORE_WEIGHTS.brandKeyword;
    reasons.push('contains a target brand keyword');
  }
  if (typeof entry.daysLeft === 'number') {
    // Proximity peaks right after the drop; fades for far-future expiries.
    const proximity = entry.daysLeft <= 0
      ? DROP_SCORE_WEIGHTS.windowProximity
      : Math.max(0, Math.round(
          DROP_SCORE_WEIGHTS.windowProximity * (1 - entry.daysLeft / EXPIRY_WINDOWS.upcoming),
        ));
    score += proximity;
    if (entry.daysLeft <= 0) reasons.push('already expired — may be re-registrable now');
    else if (entry.daysLeft <= EXPIRY_WINDOWS.imminent) reasons.push(`expires in ${entry.daysLeft} day(s)`);
  }
  return { score: Math.min(100, score), reasons };
}

/**
 * Build the prioritized drop catchlist: entries near or past expiry, each
 * scored and ready for takeover checks to be queued against them.
 *
 * @param {object[]} watchlist entries from buildExpiryWatchlist()
 * @param {object} [opts] { minScore?: number, limit?: number }
 * @returns {object[]} scored entries sorted by score descending.
 */
export function buildDropCatchlist(watchlist, opts = {}) {
  const minScore = Number.isFinite(opts.minScore) ? opts.minScore : 30;
  const limit = Number.isFinite(opts.limit) ? opts.limit : 500;
  return (Array.isArray(watchlist) ? watchlist : [])
    .filter(e => e.window === 'expired' || e.window === 'imminent' || e.window === 'near')
    .map(e => ({ ...e, ...scoreDropPriority(e) }))
    .filter(e => e.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * From a catchlist, select the domains that have dropped (past expiry) and
 * should have takeover checks queued immediately.
 *
 * @param {object[]} catchlist scored entries from buildDropCatchlist()
 * @param {object} [opts] { minScore?: number }
 * @returns {object[]} entries actionable right now, highest score first.
 */
export function selectDroppedForTakeoverQueue(catchlist, opts = {}) {
  const minScore = Number.isFinite(opts.minScore) ? opts.minScore : 50;
  return (Array.isArray(catchlist) ? catchlist : [])
    .filter(e => e.window === 'expired' && e.score >= minScore)
    .map(e => ({
      domain: e.domain,
      score: e.score,
      reasons: e.reasons,
      queueAction: 'takeover-check',
    }));
}
