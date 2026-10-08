/**
 * filtersCore.js — Forge wave 6 (ideas 50201–50240).
 *
 * Pure, framework-free logic for the keyboard + advanced-filter suite.
 * This module is intentionally self-contained: it replicates the wave-4
 * filter dimensions (50181–50200) so it builds without depending on the
 * unmerged `feat/infinity-two-wave-5` branch, and extends the pipeline
 * with every wave-6 dimension.
 *
 * FINDING-DATA SHAPE (superset of the wave-4 shape)
 * {
 *   id, title, severity ('critical'|'high'|'medium'|'low'|'info'),
 *   confidence (0-100), riskScore (0-10), discoveredAt (epoch ms),
 *   updatedAt (epoch ms), status ('new'|'triaged'|'confirmed'|'fixed'|'verified'),
 *   reviewed (bool), tags (string[]), asset: {host, path}, owasp ('A01'..'A10'|''),
 *   evidence ([{type:'image'|'code'|'video'|'text', label, code, src}]),
 *   hasPoc (bool), chained (bool) / parentId, exploitSteps (number|null),
 *   impact, summary, phase ('recon'|'scan'|'exploit'|'report'|'retest'|''),
 *   // wave-6 fields:
 *   falsePositive (bool), dismissed (bool), assignee ({name, initials}|null),
 *   origin ('agent'|'human'), starred (bool), interactedBy (userId[]),
 *   retested (bool), seenInPreviousHunt (bool), huntId (string)
 * }
 */

export const SEVERITY_KEYS = ['critical', 'high', 'medium', 'low', 'info'];
export const TRIAGE_STAGES = ['new', 'triaged', 'confirmed', 'fixed', 'verified'];
export const EVIDENCE_TYPES = ['image', 'code', 'video', 'text'];
export const EVIDENCE_TYPE_LABELS = {
  image: 'Screenshot',
  code: 'Request/Response',
  video: 'Video',
  text: 'Log',
};

/** Default filter state covering every filter dimension (wave-4 + wave-6). */
export const DEFAULT_FILTERS = {
  // --- wave-4 dimensions (replicated from the wave-5 branch pipeline) ---
  severities: [], // multi-select set
  invertSeverity: false, // 50200 — exclude selected severities instead of including
  unreviewedOnly: false, // 50181
  status: 'all', // 50186 — 'all' or one triage stage
  minConfidence: 0, // 50187 — 0–100
  query: '', // 50188 — scoped text search
  asset: 'all', // 50189 — 'all' or exact host
  hasPoc: false, // 50190
  hasScreenshot: false, // 50190 — evidence contains type 'image'
  tags: [], // 50191/50199 — multi-select
  tagLogic: 'OR', // 50199 — 'AND' | 'OR'
  dateRange: 'all', // 50192 — 'all' | 'hour' | 'today' | 'thisHunt'
  owasp: [], // 50193 — selected OWASP category codes
  chainedOnly: false, // 50194
  // --- wave-6 dimensions ---
  excludeFalsePositives: true, // 50204 — default on
  showDismissed: false, // 50212 — reveal dismissed FP rows, muted
  riskScoreMin: 0, // 50211 — 0–10
  riskScoreMax: 10, // 50211 — 0–10
  assignee: 'all', // 50203 — 'all' or assignee name
  needsRetest: false, // 50210 — fixed but not yet verified
  myFindings: false, // 50214 — user personally interacted
  replayable: 'all', // 50216 — 'all' | 'replayable' | 'manual'
  regexMode: false, // 50221 — treat query as regex
  fuzzy: false, // 50236 — typo-tolerant title matching
  evidenceType: 'all', // 50222 — 'all' | image | code | video | text
  starredOnly: false, // 50224
  origin: 'all', // 50230 — 'all' | 'agent' | 'human'
  aging: 'all', // 50231 — 'all' | '7d' | '30d'
  confidenceBand: 'all', // 50229 — 'all' | 'high' | 'review'
  compareMode: false, // 50228 — only NEW vs previous hunt
  changedSinceVisit: false, // 50207 — updated after seen watermark
  searchScope: 'thisHunt', // 50238 — 'thisHunt' | 'allHunts' | 'reports' | 'docs'
  similarToId: null, // 50220 — finding id to seed "similar to this"
  // sort state lives here so it persists with the filters (50205)
  sortKey: 'severity',
  sortDir: 'desc', // 50205 — 'asc' | 'desc', persisted per user
  groupBy: 'none', // 50206 — view-only, not serialized into pills
};

/** 50182 — priority score: severity weight 40/30/20/10/5 + confidence*0.3 + exploitability up to 30. */
const SEV_WEIGHT = { critical: 40, high: 30, medium: 20, low: 10, info: 5 };
export function priorityScore(f = {}) {
  const sevW = SEV_WEIGHT[f.severity] ?? 5;
  const confW = Math.max(0, Math.min(100, f.confidence ?? 0)) * 0.3;
  let expW = 0;
  if (typeof f.exploitSteps === 'number' && f.exploitSteps > 0) {
    expW = Math.max(5, 30 - (f.exploitSteps - 1) * 5);
  } else if (f.hasPoc) {
    expW = 10;
  }
  return sevW + confW + expW;
}

const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const TAG_PRIORITY_BONUS = 0.25; // 50226 — tie-break per matching tag-order position

/**
 * 50182 + 50205 + 50223 — sort findings by key and direction; pure, never mutates.
 * tagPriorityOrder (50226): when pill reordering sets tag precedence, findings
 * matching earlier-ordered tags rank slightly higher as a tie-break on priority.
 */
export function sortFindings(
  findings = [],
  sortKey = 'severity',
  sortDir = 'desc',
  tagPriorityOrder = []
) {
  const arr = [...findings];
  const prio = f => {
    let s = priorityScore(f);
    if (Array.isArray(tagPriorityOrder) && tagPriorityOrder.length && Array.isArray(f.tags)) {
      for (let i = 0; i < tagPriorityOrder.length; i += 1) {
        if (f.tags.includes(tagPriorityOrder[i])) {
          s += (tagPriorityOrder.length - i) * TAG_PRIORITY_BONUS;
          break;
        }
      }
    }
    return s;
  };
  switch (sortKey) {
    case 'severity':
      arr.sort(
        (a, b) =>
          (SEV_RANK[a.severity] ?? 4) - (SEV_RANK[b.severity] ?? 4) ||
          (b.confidence ?? 0) - (a.confidence ?? 0)
      );
      break;
    case 'confidence':
      arr.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
      break;
    case 'newest':
      arr.sort((a, b) => (b.discoveredAt ?? 0) - (a.discoveredAt ?? 0));
      break;
    case 'oldest':
      arr.sort((a, b) => (a.discoveredAt ?? 0) - (b.discoveredAt ?? 0));
      break;
    case 'firstSeen': // 50223
      arr.sort((a, b) => (a.discoveredAt ?? 0) - (b.discoveredAt ?? 0));
      break;
    case 'lastUpdated': // 50223
      arr.sort(
        (a, b) => (b.updatedAt ?? b.discoveredAt ?? 0) - (a.updatedAt ?? a.discoveredAt ?? 0)
      );
      break;
    case 'title':
      arr.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
      break;
    case 'priority':
      arr.sort((a, b) => prio(b) - prio(a));
      break;
    default:
      break;
  }
  if (sortDir === 'asc') arr.reverse();
  return arr;
}

/** 50236 — fuzzy subsequence score; 0 when the query is not a subsequence of the text. */
export function fuzzyScore(query, text) {
  const q = String(query || '')
    .toLowerCase()
    .replace(/\s+/g, '');
  const t = String(text || '').toLowerCase();
  if (!q) return 0;
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  let lastPos = -2;
  for (let i = 0; i < t.length && qi < q.length; i += 1) {
    if (t[i] === q[qi]) {
      consecutive = i === lastPos + 1 ? consecutive + 1 : 1;
      lastPos = i;
      score += 1 + consecutive * 0.5 + (i === qi ? 1 : 0);
      qi += 1;
    }
  }
  if (qi < q.length) return 0; // not a subsequence → no match
  return score / (q.length + t.length * 0.01);
}

/** Escape regex special chars (used when regexMode is off / for highlight splitting). */
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Text match: substring (default), regex (50221), or fuzzy (50236).
 * An invalid regex in regex mode matches nothing (safe; the UI shows the syntax hint).
 */
export function matchesText(f, rawQuery, { regexMode = false, fuzzy = false } = {}) {
  const q = String(rawQuery || '');
  if (!q.trim()) return true;
  const haystack = [
    f.title,
    f.impact,
    f.summary,
    ...(Array.isArray(f.evidence) ? f.evidence.flatMap(e => [e && e.label, e && e.code]) : []),
  ]
    .filter(Boolean)
    .join('\n');
  if (regexMode) {
    try {
      return new RegExp(q, 'i').test(haystack);
    } catch {
      return false;
    }
  }
  if (fuzzy) {
    const needle = q.trim().toLowerCase();
    return fuzzyScore(needle, f.title) > 0 || haystack.toLowerCase().includes(needle);
  }
  return haystack.toLowerCase().includes(q.trim().toLowerCase());
}

/** 50241 (search operators) — parse `sev:critical host:x.com has:poc` tokens out of a query. */
export function parseSearchOperators(rawQuery) {
  const tokens = String(rawQuery || '')
    .split(/\s+/)
    .filter(Boolean);
  const operators = {};
  const rest = [];
  for (const tok of tokens) {
    const m = tok.match(/^([a-zA-Z]+):(.+)$/);
    if (m) {
      const key = m[1].toLowerCase();
      const val = m[2];
      if (key === 'sev' || key === 'severity')
        operators.severity = (operators.severity || []).concat(val.toLowerCase());
      else if (key === 'host' || key === 'asset') operators.host = val.toLowerCase();
      else if (key === 'has') operators.has = (operators.has || []).concat(val.toLowerCase());
      else if (key === 'tag') operators.tag = (operators.tag || []).concat(val);
      else rest.push(tok);
    } else {
      rest.push(tok);
    }
  }
  return { operators, query: rest.join(' ') };
}

/** Does a finding satisfy parsed search operators? (complements text matching) */
export function matchesOperators(f, operators = {}) {
  if (
    operators.severity &&
    operators.severity.length &&
    !operators.severity.includes(String(f.severity || '').toLowerCase())
  )
    return false;
  if (
    operators.host &&
    !(
      f.asset &&
      String(f.asset.host || '')
        .toLowerCase()
        .includes(operators.host)
    )
  )
    return false;
  if (operators.has && operators.has.length) {
    for (const h of operators.has) {
      if (h === 'poc' && !f.hasPoc) return false;
      if (
        (h === 'screenshot' || h === 'shot') &&
        !(Array.isArray(f.evidence) && f.evidence.some(e => e && e.type === 'image'))
      )
        return false;
      if (h === 'evidence' && !(Array.isArray(f.evidence) && f.evidence.length)) return false;
      if (h === 'cve' && !/CVE-\d{4}-\d+/i.test(String(f.title || ''))) return false;
    }
  }
  if (operators.tag && operators.tag.length) {
    const ft = Array.isArray(f.tags) ? f.tags.map(t => t.toLowerCase()) : [];
    if (!operators.tag.every(t => ft.includes(t.toLowerCase()))) return false;
  }
  return true;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 50192 — resolve the cutoff epoch ms for a date range. */
function dateRangeCutoff(range, huntStartedAt) {
  const now = Date.now();
  if (range === 'hour') return now - 60 * 60 * 1000;
  if (range === 'today') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (range === 'thisHunt')
    return typeof huntStartedAt === 'number' && huntStartedAt > 0 ? huntStartedAt : 0;
  return 0;
}

/**
 * The real filter pipeline: pure function applying every wave-4 + wave-6 dimension.
 * `ctx` carries non-filter context: { huntStartedAt, currentUserId, currentHuntId,
 * seenWatermark, similarFinding }.
 * Returns a new array; never mutates inputs.
 */
export function applyFilters(findings = [], filters = {}, ctx = {}) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const {
    huntStartedAt = 0,
    currentUserId = null,
    currentHuntId = null,
    seenWatermark = 0,
    similarFinding = null,
  } = ctx;
  const selSev = new Set(f.severities || []);
  const selTags = f.tags || [];
  const selOwasp = new Set(f.owasp || []);
  const cutoff = dateRangeCutoff(f.dateRange, huntStartedAt);
  const now = Date.now();
  const { operators, query: plainQuery } = parseSearchOperators(f.query);

  return findings.filter(fd => {
    if (!fd) return false;
    // severity: multi-select + invert flag (50180/50200)
    if (selSev.size > 0) {
      const hit = selSev.has(fd.severity);
      if (f.invertSeverity ? hit : !hit) return false;
    }
    // unreviewed only (50181)
    if (f.unreviewedOnly && fd.reviewed) return false;
    // status single-select (50186)
    if (f.status !== 'all' && fd.status !== f.status) return false;
    // min confidence (50187)
    if ((fd.confidence ?? 0) < f.minConfidence) return false;
    // scoped text search: operators + substring/regex/fuzzy (50188/50221/50236)
    if (!matchesText(fd, plainQuery, { regexMode: f.regexMode, fuzzy: f.fuzzy })) return false;
    if (!matchesOperators(fd, operators)) return false;
    // search scope (50238)
    if (f.searchScope === 'thisHunt' && currentHuntId && fd.huntId && fd.huntId !== currentHuntId)
      return false;
    // asset exact host (50189)
    if (f.asset !== 'all' && (fd.asset == null || fd.asset.host !== f.asset)) return false;
    // evidence presence (50190)
    if (f.hasPoc && !fd.hasPoc) return false;
    if (
      f.hasScreenshot &&
      !(Array.isArray(fd.evidence) && fd.evidence.some(e => e && e.type === 'image'))
    )
      return false;
    // evidence type (50222)
    if (
      f.evidenceType !== 'all' &&
      !(Array.isArray(fd.evidence) && fd.evidence.some(e => e && e.type === f.evidenceType))
    )
      return false;
    // tags AND/OR (50191/50199)
    if (selTags.length > 0) {
      const ft = Array.isArray(fd.tags) ? fd.tags : [];
      if (f.tagLogic === 'AND') {
        if (!selTags.every(t => ft.includes(t))) return false;
      } else if (!selTags.some(t => ft.includes(t))) return false;
    }
    // date range (50192)
    if (f.dateRange !== 'all' && (!fd.discoveredAt || fd.discoveredAt < cutoff)) return false;
    // OWASP categories (50193)
    if (selOwasp.size > 0 && !selOwasp.has(fd.owasp)) return false;
    // chained only (50194)
    if (f.chainedOnly && !(fd.chained || fd.parentId)) return false;
    // false-positive exclusion (50204) with dismissed override (50212)
    if (f.excludeFalsePositives && !f.showDismissed && fd.falsePositive) return false;
    if (!f.showDismissed && fd.dismissed && !fd.falsePositive) return false;
    // risk score range (50211)
    const rs = fd.riskScore ?? 0;
    if (rs < f.riskScoreMin || rs > f.riskScoreMax) return false;
    // assignee (50203) — 'all', exact name, or 'unassigned'
    if (f.assignee !== 'all') {
      if (f.assignee === 'unassigned') {
        if (fd.assignee && fd.assignee.name) return false;
      } else if (!(fd.assignee && fd.assignee.name === f.assignee)) return false;
    }
    // needs retest (50210): fixed but not yet verified
    if (f.needsRetest && !(fd.status === 'fixed' && !fd.retested)) return false;
    // my findings (50214)
    if (
      f.myFindings &&
      currentUserId &&
      !(Array.isArray(fd.interactedBy) && fd.interactedBy.includes(currentUserId))
    )
      return false;
    // replayability (50216)
    if (f.replayable === 'replayable' && !fd.hasPoc) return false;
    if (f.replayable === 'manual' && fd.hasPoc) return false;
    // starred (50224)
    if (f.starredOnly && !fd.starred) return false;
    // origin (50230)
    if (f.origin !== 'all' && fd.origin !== f.origin) return false;
    // aging (50231): open longer than 7/30 days
    if (f.aging !== 'all') {
      const days = (now - (fd.discoveredAt ?? now)) / DAY_MS;
      const open = !['fixed', 'verified'].includes(fd.status);
      if (!open || days < (f.aging === '30d' ? 30 : 7)) return false;
    }
    // confidence band (50229)
    if (f.confidenceBand === 'high' && (fd.confidence ?? 0) <= 80) return false;
    if (f.confidenceBand === 'review' && (fd.confidence ?? 0) >= 60) return false;
    // compare mode (50228): only findings NEW vs the previous hunt
    if (f.compareMode && fd.seenInPreviousHunt) return false;
    // changed since visit (50207)
    if (f.changedSinceVisit && (fd.updatedAt ?? fd.discoveredAt ?? 0) <= seenWatermark)
      return false;
    // similar to this (50220)
    if (f.similarToId && similarFinding) {
      if (fd.id === similarFinding.id) return false;
      const sharedTag =
        Array.isArray(fd.tags) &&
        Array.isArray(similarFinding.tags) &&
        fd.tags.some(t => similarFinding.tags.includes(t));
      const sameSev = fd.severity === similarFinding.severity;
      const sameOwasp = fd.owasp && fd.owasp === similarFinding.owasp;
      if (!(sameSev || sameOwasp || sharedTag)) return false;
    }
    return true;
  });
}

/** 50204 — how many false-positive rows the default-on exclusion is hiding. */
export function countHiddenFalsePositives(findings = []) {
  return findings.filter(f => f && f.falsePositive).length;
}

/** Count of active filter dimensions (each dimension counts once). */
export function countActiveFilters(filters = {}) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  let n = 0;
  if ((f.severities || []).length > 0) n += 1;
  if (f.unreviewedOnly) n += 1;
  if (f.status !== 'all') n += 1;
  if (f.minConfidence > 0) n += 1;
  if (String(f.query || '').trim()) n += 1;
  if (f.asset !== 'all') n += 1;
  if (f.hasPoc) n += 1;
  if (f.hasScreenshot) n += 1;
  if ((f.tags || []).length > 0) n += 1;
  if (f.dateRange !== 'all') n += 1;
  if ((f.owasp || []).length > 0) n += 1;
  if (f.chainedOnly) n += 1;
  if (!f.excludeFalsePositives) n += 1;
  if (f.showDismissed) n += 1;
  if (f.riskScoreMin > 0 || f.riskScoreMax < 10) n += 1;
  if (f.assignee !== 'all') n += 1;
  if (f.needsRetest) n += 1;
  if (f.myFindings) n += 1;
  if (f.replayable !== 'all') n += 1;
  if (f.regexMode) n += 1;
  if (f.fuzzy) n += 1;
  if (f.evidenceType !== 'all') n += 1;
  if (f.starredOnly) n += 1;
  if (f.origin !== 'all') n += 1;
  if (f.aging !== 'all') n += 1;
  if (f.confidenceBand !== 'all') n += 1;
  if (f.compareMode) n += 1;
  if (f.changedSinceVisit) n += 1;
  if (f.searchScope !== 'thisHunt') n += 1;
  if (f.similarToId) n += 1;
  return n;
}

/** Human-readable active-filter labels for pills / empty state. */
export function activeFilterLabels(filters = {}) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const labels = [];
  if (f.severities.length)
    labels.push({
      key: 'severity',
      text: `severity: ${f.severities.join(', ')}${f.invertSeverity ? ' (inverted)' : ''}`,
    });
  if (f.unreviewedOnly) labels.push({ key: 'unreviewed', text: 'unreviewed only' });
  if (f.status !== 'all') labels.push({ key: 'status', text: `status: ${f.status}` });
  if (f.minConfidence > 0)
    labels.push({ key: 'confidence', text: `confidence ≥ ${f.minConfidence}%` });
  if (String(f.query || '').trim())
    labels.push({
      key: 'query',
      text: `search: "${f.query.trim()}"${f.regexMode ? ' (regex)' : ''}${f.fuzzy ? ' (fuzzy)' : ''}`,
    });
  if (f.asset !== 'all') labels.push({ key: 'asset', text: `asset: ${f.asset}` });
  if (f.hasPoc) labels.push({ key: 'hasPoc', text: 'has PoC' });
  if (f.hasScreenshot) labels.push({ key: 'hasScreenshot', text: 'has screenshot' });
  if (f.evidenceType !== 'all')
    labels.push({
      key: 'evidenceType',
      text: `evidence: ${EVIDENCE_TYPE_LABELS[f.evidenceType] || f.evidenceType}`,
    });
  if (f.tags.length)
    labels.push({ key: 'tags', text: `tags (${f.tagLogic}): ${f.tags.join(', ')}` });
  if (f.dateRange !== 'all') labels.push({ key: 'dateRange', text: `date: ${f.dateRange}` });
  if (f.owasp.length) labels.push({ key: 'owasp', text: `OWASP: ${f.owasp.join(', ')}` });
  if (f.chainedOnly) labels.push({ key: 'chained', text: 'chained only' });
  if (!f.excludeFalsePositives) labels.push({ key: 'excludeFp', text: 'false positives shown' });
  if (f.showDismissed) labels.push({ key: 'showDismissed', text: 'dismissed shown' });
  if (f.riskScoreMin > 0 || f.riskScoreMax < 10)
    labels.push({ key: 'risk', text: `risk score ${f.riskScoreMin}–${f.riskScoreMax}` });
  if (f.assignee !== 'all') labels.push({ key: 'assignee', text: `assignee: ${f.assignee}` });
  if (f.needsRetest) labels.push({ key: 'retest', text: 'needs retest' });
  if (f.myFindings) labels.push({ key: 'mine', text: 'my findings' });
  if (f.replayable !== 'all') labels.push({ key: 'replay', text: `replay: ${f.replayable}` });
  if (f.starredOnly) labels.push({ key: 'starred', text: 'starred only' });
  if (f.origin !== 'all') labels.push({ key: 'origin', text: `origin: ${f.origin}` });
  if (f.aging !== 'all')
    labels.push({ key: 'aging', text: `open > ${f.aging === '30d' ? '30' : '7'} days` });
  if (f.confidenceBand !== 'all')
    labels.push({
      key: 'confBand',
      text: `confidence: ${f.confidenceBand === 'high' ? '> 80%' : '< 60%'}`,
    });
  if (f.compareMode) labels.push({ key: 'compare', text: 'new vs previous hunt' });
  if (f.changedSinceVisit) labels.push({ key: 'changed', text: 'changed since visit' });
  if (f.searchScope !== 'thisHunt') labels.push({ key: 'scope', text: `scope: ${f.searchScope}` });
  if (f.similarToId) labels.push({ key: 'similar', text: 'similar to selected' });
  return labels;
}

/** Reset map: how to clear each pill key back to its default. */
export const PILL_RESETS = {
  severity: { severities: [], invertSeverity: false },
  unreviewed: { unreviewedOnly: false },
  status: { status: 'all' },
  confidence: { minConfidence: 0 },
  query: { query: '', regexMode: false, fuzzy: false },
  asset: { asset: 'all' },
  hasPoc: { hasPoc: false },
  hasScreenshot: { hasScreenshot: false },
  evidenceType: { evidenceType: 'all' },
  tags: { tags: [] },
  dateRange: { dateRange: 'all' },
  owasp: { owasp: [] },
  chained: { chainedOnly: false },
  excludeFp: { excludeFalsePositives: true },
  showDismissed: { showDismissed: false },
  risk: { riskScoreMin: 0, riskScoreMax: 10 },
  assignee: { assignee: 'all' },
  retest: { needsRetest: false },
  mine: { myFindings: false },
  replay: { replayable: 'all' },
  starred: { starredOnly: false },
  origin: { origin: 'all' },
  aging: { aging: 'all' },
  confBand: { confidenceBand: 'all' },
  compare: { compareMode: false },
  changed: { changedSinceVisit: false },
  scope: { searchScope: 'thisHunt' },
  similar: { similarToId: null },
};

/** 50206 — group findings by severity, host, OWASP category, or discovery phase. */
export function groupFindings(findings = [], groupBy = 'none') {
  if (groupBy === 'none' || !groupBy)
    return [{ key: 'all', label: 'All findings', items: [...findings] }];
  const buckets = new Map();
  const keyOf = f => {
    if (groupBy === 'severity') return f.severity || 'unknown';
    if (groupBy === 'host') return (f.asset && f.asset.host) || 'unknown host';
    if (groupBy === 'owasp') return f.owasp || 'uncategorized';
    if (groupBy === 'phase') return f.phase || 'unspecified';
    return 'all';
  };
  for (const f of findings) {
    const k = keyOf(f);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(f);
  }
  const order =
    groupBy === 'severity'
      ? (a, b) => (SEV_RANK[a[0]] ?? 9) - (SEV_RANK[b[0]] ?? 9)
      : (a, b) => b[1].length - a[1].length;
  return [...buckets.entries()].sort(order).map(([key, items]) => ({ key, label: key, items }));
}

/**
 * 50225 — filter fix suggestions: for each active dimension, test the pipeline
 * without that dimension; dimensions whose removal restores results become
 * suggestions ("try removing the Low severity filter").
 */
export function suggestFilterFixes(findings = [], filters = {}, ctx = {}) {
  const fixes = [];
  const active = activeFilterLabels(filters);
  for (const pill of active) {
    const reset = PILL_RESETS[pill.key];
    if (!reset) continue;
    const relaxed = { ...filters, ...reset };
    const result = applyFilters(findings, relaxed, ctx);
    if (result.length > 0) {
      fixes.push({ key: pill.key, label: pill.text, restores: result.length });
    }
  }
  return fixes.sort((a, b) => b.restores - a.restores).slice(0, 4);
}

/** 50215 — one-line description of the export set, shown in the export dialog. */
export function describeExportSet(filtered = [], total = 0) {
  const n = filtered.length;
  if (n === 0) return 'No findings match the current filters — nothing to export.';
  return `Exports ${n} of ${total} findings — the current filter set is applied.`;
}

/** 50215 — real CSV export of the currently filtered set. */
export function findingsToCsv(findings = []) {
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [
    [
      'id',
      'title',
      'severity',
      'status',
      'confidence',
      'riskScore',
      'host',
      'owasp',
      'assignee',
      'origin',
      'discoveredAt',
    ],
    ...findings.map(f => [
      f.id,
      f.title,
      f.severity,
      f.status,
      f.confidence,
      f.riskScore,
      f.asset && f.asset.host,
      f.owasp,
      f.assignee && f.assignee.name,
      f.origin,
      f.discoveredAt ? new Date(f.discoveredAt).toISOString() : '',
    ]),
  ];
  return rows.map(r => r.map(cell).join(',')).join('\n');
}

/**
 * 50237 — split text into [{text, match}] segments for a query so matched terms
 * can be highlighted. Safe for regex mode (invalid regex → no highlighting).
 */
export function highlightSegments(text, rawQuery, { regexMode = false } = {}) {
  const q = String(rawQuery || '').trim();
  if (!q) return [{ text: String(text ?? ''), match: false }];
  let parts;
  if (regexMode) {
    let re;
    try {
      re = new RegExp(`(${q})`, 'gi');
    } catch {
      return [{ text: String(text ?? ''), match: false }];
    }
    parts = String(text ?? '').split(re);
  } else {
    parts = String(text ?? '').split(new RegExp(`(${escapeRegExp(q)})`, 'gi'));
  }
  return parts
    .filter(p => p !== '')
    .map((p, i) => ({
      text: p,
      match: i % 2 === 1,
    }));
}

/** 50234 — pure undo/redo history helpers over filter snapshots. */
export function pushHistory(history = [], snapshot, limit = 25) {
  const next = [...history, snapshot];
  return next.length > limit ? next.slice(next.length - limit) : next;
}
export function undoOnce(history = [], future = []) {
  if (history.length < 2) return null; // nothing to undo to
  const nextHistory = history.slice(0, -1);
  const prev = nextHistory[nextHistory.length - 1];
  return { filters: prev, history: nextHistory, future: [history[history.length - 1], ...future] };
}
export function redoOnce(history = [], future = []) {
  if (future.length === 0) return null;
  const [next, ...rest] = future;
  return { filters: next, history: [...history, next], future: rest };
}

/** Small localStorage JSON helpers (50219 persistence, 50239 recent searches, 50202 recent filters, 50233 usage). */
const storage = {
  get(key, fallback) {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  },
};

/** 50219 — persist/restore the filter state per hunt so it survives hunt switching. */
export const FILTER_STATE_KEY = huntId => `fc5-filters-${huntId || 'default'}`;
export function saveFilterState(huntId, filters) {
  return storage.set(FILTER_STATE_KEY(huntId), filters);
}
export function loadFilterState(huntId) {
  return storage.get(FILTER_STATE_KEY(huntId), null);
}

/** 50232 — user's default filter (e.g. always hide Info findings), applied on load. */
export const USER_DEFAULT_KEY = 'fc5-user-default-filters';
export function saveUserDefault(filters) {
  return storage.set(USER_DEFAULT_KEY, filters);
}
export function loadUserDefault() {
  return storage.get(USER_DEFAULT_KEY, null);
}
export function clearUserDefault() {
  storage.remove(USER_DEFAULT_KEY);
}

/** 50239 — recent searches: ring buffer with one-click rerun + clear-all. */
const RECENT_SEARCHES_KEY = 'fc5-recent-searches';
export function recordRecentSearch(query) {
  const q = String(query || '').trim();
  if (!q) return storage.get(RECENT_SEARCHES_KEY, []);
  const prev = storage.get(RECENT_SEARCHES_KEY, []).filter(s => s.query !== q);
  const next = [{ query: q, at: Date.now() }, ...prev].slice(0, 10);
  storage.set(RECENT_SEARCHES_KEY, next);
  return next;
}
export function getRecentSearches() {
  return storage.get(RECENT_SEARCHES_KEY, []);
}
export function clearRecentSearches() {
  storage.remove(RECENT_SEARCHES_KEY);
}

/** 50202 — recently-used filter snapshots: ring buffer, one-click reapply. */
const RECENT_FILTERS_KEY = 'fc5-recent-filters';
export function recordRecentFilters(filters) {
  const active = countActiveFilters(filters);
  if (active === 0) return storage.get(RECENT_FILTERS_KEY, []);
  const snapshot = { ...DEFAULT_FILTERS, ...filters };
  const prev = storage
    .get(RECENT_FILTERS_KEY, [])
    .filter(s => serializeFilters(s.filters) !== serializeFilters(snapshot));
  const entry = { filters: snapshot, active, at: Date.now() };
  const next = [entry, ...prev].slice(0, 6);
  storage.set(RECENT_FILTERS_KEY, next);
  return next;
}
export function getRecentFilters() {
  return storage.get(RECENT_FILTERS_KEY, []);
}

/** 50233 — preset usage counts for "popular" badges. */
const PRESET_USAGE_KEY = 'fc5-preset-usage';
export function recordPresetUse(name) {
  const counts = storage.get(PRESET_USAGE_KEY, {});
  counts[name] = (counts[name] || 0) + 1;
  storage.set(PRESET_USAGE_KEY, counts);
  return counts;
}
export function getPresetUsage() {
  return storage.get(PRESET_USAGE_KEY, {});
}
/** Names used more than this many times earn the "Popular" badge. */
export const POPULAR_THRESHOLD = 3;

/** 50207 — seen watermark backing the "changed since last visit" filter. */
const WATERMARK_KEY = 'fc5-seen-watermark';
export function getSeenWatermark() {
  return storage.get(WATERMARK_KEY, 0);
}
export function markAllSeen() {
  return storage.set(WATERMARK_KEY, Date.now());
}

/** 50205 — persistent sort direction per user across sessions. */
const SORT_PREF_KEY = 'fc5-sort-prefs';
export function saveSortPrefs(sortKey, sortDir) {
  return storage.set(SORT_PREF_KEY, { sortKey, sortDir });
}
export function loadSortPrefs() {
  return storage.get(SORT_PREF_KEY, null);
}

/** 50209 — export/import the preset library as JSON for cross-device sync. */
export function presetsToJson(presets = []) {
  return JSON.stringify({ exportedAt: new Date().toISOString(), presets }, null, 2);
}
export function presetsFromJson(text) {
  const parsed = JSON.parse(String(text || ''));
  if (!parsed || !Array.isArray(parsed.presets))
    throw new Error('Invalid preset file: missing presets array');
  return parsed.presets.filter(
    p => p && typeof p.name === 'string' && p.filters && typeof p.filters === 'object'
  );
}

/** Serialize filters to a shareable URL query string (wave-4 dims + wave-6 dims). */
export function serializeFilters(filters = {}) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const p = new URLSearchParams();
  if (f.severities.length) p.set('sev', f.severities.join(','));
  if (f.invertSeverity) p.set('sevInv', '1');
  if (f.unreviewedOnly) p.set('unrev', '1');
  if (f.status !== 'all') p.set('status', f.status);
  if (f.minConfidence > 0) p.set('minConf', String(f.minConfidence));
  if (String(f.query || '').trim()) p.set('q', f.query.trim());
  if (f.searchScope !== 'thisHunt') p.set('qScope', f.searchScope);
  if (f.regexMode) p.set('regex', '1');
  if (f.fuzzy) p.set('fuzzy', '1');
  if (f.asset !== 'all') p.set('asset', f.asset);
  if (f.hasPoc) p.set('poc', '1');
  if (f.hasScreenshot) p.set('shot', '1');
  if (f.evidenceType !== 'all') p.set('evType', f.evidenceType);
  if (f.tags.length) p.set('tags', f.tags.join(','));
  if (f.tagLogic === 'AND') p.set('tagLogic', 'AND');
  if (f.dateRange !== 'all') p.set('range', f.dateRange);
  if (f.owasp.length) p.set('owasp', f.owasp.join(','));
  if (f.chainedOnly) p.set('chained', '1');
  if (!f.excludeFalsePositives) p.set('inclFp', '1');
  if (f.showDismissed) p.set('showDis', '1');
  if (f.riskScoreMin > 0) p.set('riskMin', String(f.riskScoreMin));
  if (f.riskScoreMax < 10) p.set('riskMax', String(f.riskScoreMax));
  if (f.assignee !== 'all') p.set('assignee', f.assignee);
  if (f.needsRetest) p.set('retest', '1');
  if (f.myFindings) p.set('mine', '1');
  if (f.replayable !== 'all') p.set('replay', f.replayable);
  if (f.starredOnly) p.set('starred', '1');
  if (f.origin !== 'all') p.set('origin', f.origin);
  if (f.aging !== 'all') p.set('aging', f.aging);
  if (f.confidenceBand !== 'all') p.set('confBand', f.confidenceBand);
  if (f.compareMode) p.set('cmp', '1');
  if (f.changedSinceVisit) p.set('changed', '1');
  if (f.similarToId) p.set('similar', String(f.similarToId));
  if (f.sortKey !== 'severity') p.set('sort', f.sortKey);
  if (f.sortDir !== 'desc') p.set('dir', f.sortDir);
  return p.toString();
}

/** Deserialize a query string back into filters, merged over DEFAULT_FILTERS. */
export function deserializeFilters(query) {
  const p =
    query instanceof URLSearchParams
      ? query
      : new URLSearchParams(String(query || '').replace(/^\?/, ''));
  const csv = k =>
    (p.get(k) || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  const clampNum = (v, lo, hi, fb) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb;
  };
  return {
    ...DEFAULT_FILTERS,
    severities: csv('sev').filter(s => SEVERITY_KEYS.includes(s)),
    invertSeverity: p.get('sevInv') === '1',
    unreviewedOnly: p.get('unrev') === '1',
    status: p.get('status') || 'all',
    minConfidence: clampNum(parseInt(p.get('minConf') || '0', 10), 0, 100, 0),
    query: p.get('q') || '',
    searchScope: ['thisHunt', 'allHunts', 'reports', 'docs'].includes(p.get('qScope'))
      ? p.get('qScope')
      : 'thisHunt',
    regexMode: p.get('regex') === '1',
    fuzzy: p.get('fuzzy') === '1',
    asset: p.get('asset') || 'all',
    hasPoc: p.get('poc') === '1',
    hasScreenshot: p.get('shot') === '1',
    evidenceType: EVIDENCE_TYPES.includes(p.get('evType')) ? p.get('evType') : 'all',
    tags: csv('tags'),
    tagLogic: p.get('tagLogic') === 'AND' ? 'AND' : 'OR',
    dateRange: p.get('range') || 'all',
    owasp: csv('owasp'),
    chainedOnly: p.get('chained') === '1',
    excludeFalsePositives: p.get('inclFp') !== '1',
    showDismissed: p.get('showDis') === '1',
    riskScoreMin: clampNum(parseFloat(p.get('riskMin')), 0, 10, 0),
    riskScoreMax: clampNum(parseFloat(p.get('riskMax')), 0, 10, 10),
    assignee: p.get('assignee') || 'all',
    needsRetest: p.get('retest') === '1',
    myFindings: p.get('mine') === '1',
    replayable: ['replayable', 'manual'].includes(p.get('replay')) ? p.get('replay') : 'all',
    starredOnly: p.get('starred') === '1',
    origin: ['agent', 'human'].includes(p.get('origin')) ? p.get('origin') : 'all',
    aging: ['7d', '30d'].includes(p.get('aging')) ? p.get('aging') : 'all',
    confidenceBand: ['high', 'review'].includes(p.get('confBand')) ? p.get('confBand') : 'all',
    compareMode: p.get('cmp') === '1',
    changedSinceVisit: p.get('changed') === '1',
    similarToId: p.get('similar') || null,
    sortKey: p.get('sort') || 'severity',
    sortDir: p.get('dir') === 'asc' ? 'asc' : 'desc',
  };
}

/** 50240 — named saved search record factory (pin to sidebar). */
export function makeSavedSearch(name, filters, { pinned = false } = {}) {
  return {
    id: `ss-${Date.now().toString(36)}`,
    name: String(name || '').trim(),
    filters: { ...DEFAULT_FILTERS, ...filters },
    pinned,
    createdAt: Date.now(),
  };
}
