// Dark Matter — COVERAGE LEDGER (Lane L, 22 Oct 2026).
//
// A per-hunt accounting store: which (surface, vuln class) pairs the
// hunter has accounted for, and how. Re-implemented by reference
// from the coverage-ledger contract in usestrix/strix (Lane K
// research, §1.6/§3-P1) — the contracts, not the code:
//
//   * UNIQUENESS — a (surface, class) key is accounted for exactly
//     once. Recording a second row for an existing key does NOT
//     create a duplicate; the existing row is returned so the caller
//     updates it instead. Repeat accounting for the same key is
//     therefore impossible, not merely discouraged.
//   * CLOSURE EVIDENCE — a row may be closed as ruled_out or
//     not_applicable only with evidence naming the control that
//     stops the class (a filter, a check, a configuration the
//     hunter observed). "Nothing found" is not a named control, and
//     missing information is not proof of safety.
//   * NO DELETE — outcomes are the only states. A row is created,
//     updated, or left open; it is never removed.
//
// The ledger is the hunter's own bookkeeping. The brain writes rows
// by choice (the record_coverage action in humanLoop.js); the one
// exception is session-end reconciliation (Lane L P4), which opens
// open_gap rows for researched-but-never-probed classes — that is
// memory bookkeeping about research debt, NOT an action taken on
// the brain's behalf, and the rows it creates say so in their
// evidence text.
//
// Storage: backend/data/hunts/<hunt-id>/coverage.json, written
// atomically (tmp + rename, the store.js idiom). Reads are tolerant:
// a missing or corrupt file degrades to an empty ledger and never
// throws into the hunt loop.

import fs from 'node:fs';
import path from 'node:path';
import { huntDir } from './store.js';

export const COVERAGE_OUTCOMES = ['probed_clean', 'confirmed', 'ruled_out', 'not_applicable', 'open_gap'];

// Outcomes that CLOSE a key. Closing demands evidence naming the
// control — see the header. (probed_clean/confirmed close by having
// been tested, so their evidence is the probe result itself and is
// not gated here; ruled_out/not_applicable close by argument, so
// the argument must name what stops the class.)
const CLOSURE_OUTCOMES = new Set(['ruled_out', 'not_applicable']);

// Canonical class ids — deliberately the same ids the human-mode
// topic accounting uses (PROBE_TOPICS in humanLoop.js), so a ledger
// row, a research-debt counter and a computed unprobed lead all name
// a class the same way and can be reconciled by exact string match.
export const COVERAGE_CLASS_LABELS = {
  sqli: 'SQL injection',
  xss: 'XSS (cross-site scripting)',
  ssti: 'SSTI (template injection)',
  ssrf: 'SSRF',
  xxe: 'XXE',
  lfi: 'LFI / path traversal',
  cmdi: 'command injection',
  jwt: 'JWT attacks',
  cors: 'CORS misconfiguration',
  headers: 'security headers',
  openredirect: 'open redirect',
  graphql: 'GraphQL',
  fileupload: 'file upload',
};

// Free-text class name -> canonical id. Mirrors the topic matchers
// in humanLoop.js so "SQL injection", "sqli" and "SQLi" all land on
// the same key the research accounting counts.
const CLASS_ALIASES = [
  ['sqli', /\bsqli\b|sql injection/i],
  ['xss', /\bxss\b|cross[- ]site scripting/i],
  ['ssti', /\bssti\b|template injection/i],
  ['ssrf', /\bssrf\b|server[- ]side request forgery/i],
  ['xxe', /\bxxe\b|xml external entit/i],
  ['lfi', /\blfi\b|path traversal|directory traversal|local file inclusion/i],
  ['cmdi', /command injection|\bos command\b/i],
  ['jwt', /\bjwt\b|json web token/i],
  ['cors', /\bcors\b|cross-origin/i],
  ['headers', /security headers|content-security-policy|\bcsp\b|clickjacking/i],
  ['openredirect', /open redirect/i],
  ['graphql', /graphql/i],
  ['fileupload', /file upload|upload vulnerab|unrestricted upload/i],
];

/**
 * Normalise a brain-supplied class name to its ledger key: the
 * canonical topic id when the name matches a known class, else a
 * slug of the text (the ledger is generic — an unlisted class like
 * IDOR still gets its own key). '' for empty input.
 */
export function normaliseCoverageClass(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  if (Object.prototype.hasOwnProperty.call(COVERAGE_CLASS_LABELS, s)) return s;
  for (const [id, re] of CLASS_ALIASES) if (re.test(s)) return id;
  return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Display label for a ledger class key (the key itself when unlisted). */
export function classLabelFor(cls) {
  return COVERAGE_CLASS_LABELS[cls] || String(cls || '');
}

/**
 * Normalise a surface to its ledger form: a URL reduces to
 * protocol//host + path (scheme/host lowercased, trailing slash on
 * the path stripped except the root) — the same key shape the
 * endpoint-coverage derivation uses, so a row and a computed lead
 * for the same page share a key. Non-URL surfaces are kept as
 * trimmed text (a surface may be a named feature, not only a URL).
 */
export function normaliseSurface(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    let p = u.pathname || '/';
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${p}`;
  } catch {
    return s;
  }
}

/** The identity of a ledger row. */
export function coverageKey(surface, cls) {
  return `${normaliseSurface(surface)}||${normaliseCoverageClass(cls)}`;
}

export function emptyCoverage() {
  return { version: 1, rows: [], researchDebt: {}, updatedAt: null };
}

function sanitiseRow(r) {
  if (!r || typeof r !== 'object') return null;
  const surface = normaliseSurface(r.surface);
  const cls = normaliseCoverageClass(r.class);
  if (!surface || !cls) return null;
  if (!COVERAGE_OUTCOMES.includes(r.outcome)) return null;
  return {
    surface,
    class: cls,
    outcome: r.outcome,
    evidence: String(r.evidence || ''),
    updatedAt: String(r.updatedAt || ''),
  };
}

/**
 * Parse coverage.json text tolerantly: anything malformed — bad
 * JSON, wrong shape, junk rows — degrades to the empty ledger (or
 * the salvageable subset). Never throws.
 */
export function parseCoverage(text) {
  let obj = null;
  try {
    obj = JSON.parse(String(text || ''));
  } catch {
    return emptyCoverage();
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return emptyCoverage();
  const out = emptyCoverage();
  if (Array.isArray(obj.rows)) {
    const seen = new Set();
    for (const r of obj.rows) {
      const row = sanitiseRow(r);
      if (!row) continue;
      const key = coverageKey(row.surface, row.class);
      if (seen.has(key)) continue; // uniqueness holds even for a hand-edited file
      seen.add(key);
      out.rows.push(row);
    }
  }
  if (obj.researchDebt && typeof obj.researchDebt === 'object' && !Array.isArray(obj.researchDebt)) {
    for (const [cls, d] of Object.entries(obj.researchDebt)) {
      if (!d || typeof d !== 'object') continue;
      const researched = Number(d.researched) || 0;
      if (researched <= 0 && !d.probed) continue;
      out.researchDebt[cls] = {
        researched,
        probed: d.probed === true,
        sessionsResearched: Number(d.sessionsResearched) || 0,
        lastResearchedAt: String(d.lastResearchedAt || ''),
      };
    }
  }
  out.updatedAt = obj.updatedAt ? String(obj.updatedAt) : null;
  return out;
}

export function coverageFilePath(huntId) {
  return path.join(huntDir(huntId), 'coverage.json');
}

/** Load a hunt's ledger. Missing/corrupt -> empty. Never throws. */
export function loadCoverage(huntId) {
  try {
    return parseCoverage(fs.readFileSync(coverageFilePath(huntId), 'utf8'));
  } catch {
    return emptyCoverage();
  }
}

/** Persist a hunt's ledger atomically. Best-effort: returns success. */
export function saveCoverage(huntId, data) {
  try {
    const file = coverageFilePath(huntId);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

export function findCoverageRow(data, surface, cls) {
  const key = coverageKey(surface, cls);
  return (data && data.rows ? data.rows : []).find((r) => coverageKey(r.surface, r.class) === key) || null;
}

/** Validate a would-be row write. Returns an error string, or ''. */
function validateRowWrite({ surface, cls, outcome, evidence }) {
  if (!surface) return 'a surface is required (the page, endpoint or feature the class was assessed on)';
  if (!cls) return 'a class is required (the vulnerability class being accounted for)';
  if (!COVERAGE_OUTCOMES.includes(outcome)) {
    return `outcome must be one of: ${COVERAGE_OUTCOMES.join(', ')}`;
  }
  if (CLOSURE_OUTCOMES.has(outcome) && !String(evidence || '').trim()) {
    return `closing as ${outcome} requires evidence NAMING THE CONTROL that stops this class (the filter, check or configuration you observed) — "nothing found" is not a named control`;
  }
  return '';
}

/**
 * Pure create transition — the UNIQUENESS contract. If the key
 * already has a row, nothing is written and the existing row is
 * returned with status 'duplicate' so the caller updates it
 * instead. Returns { data, result } where result is one of:
 *   { status: 'created', row }
 *   { status: 'duplicate', row }       (data unchanged)
 *   { status: 'rejected', error }      (data unchanged)
 */
export function applyRecord(data, input, nowIso = new Date().toISOString()) {
  const d = data && Array.isArray(data.rows) ? data : emptyCoverage();
  const surface = normaliseSurface(input && input.surface);
  const cls = normaliseCoverageClass(input && input.class);
  const outcome = String((input && input.outcome) || '').trim().toLowerCase();
  const evidence = String((input && input.evidence) || '').trim();
  const error = validateRowWrite({ surface, cls, outcome, evidence });
  if (error) return { data: d, result: { status: 'rejected', error } };
  const existing = findCoverageRow(d, surface, cls);
  if (existing) return { data: d, result: { status: 'duplicate', row: existing } };
  const row = { surface, class: cls, outcome, evidence, updatedAt: nowIso };
  return {
    data: { ...d, rows: [...d.rows, row], updatedAt: nowIso },
    result: { status: 'created', row },
  };
}

/**
 * Pure update transition — the only way an existing row changes.
 * The key must already exist (record first); the closure-evidence
 * rule applies exactly as on create. An update may omit outcome or
 * evidence to change only the other field.
 */
export function applyUpdate(data, input, nowIso = new Date().toISOString()) {
  const d = data && Array.isArray(data.rows) ? data : emptyCoverage();
  const surface = normaliseSurface(input && input.surface);
  const cls = normaliseCoverageClass(input && input.class);
  const existing = surface && cls ? findCoverageRow(d, surface, cls) : null;
  if (!existing) {
    return { data: d, result: { status: 'rejected', error: 'no coverage row exists for that surface × class yet — record it first (without "update")' } };
  }
  const outcome = input && input.outcome ? String(input.outcome).trim().toLowerCase() : existing.outcome;
  const evidence = input && input.evidence !== undefined ? String(input.evidence).trim() : existing.evidence;
  const error = validateRowWrite({ surface, cls, outcome, evidence });
  if (error) return { data: d, result: { status: 'rejected', error } };
  const row = { ...existing, outcome, evidence, updatedAt: nowIso };
  return {
    data: { ...d, rows: d.rows.map((r) => (r === existing ? row : r)), updatedAt: nowIso },
    result: { status: 'updated', row },
  };
}

/** Hunt-level create: load -> applyRecord -> save (only on change). */
export function recordCoverage(huntId, input, nowIso) {
  const { data, result } = applyRecord(loadCoverage(huntId), input, nowIso);
  if (result.status === 'created') saveCoverage(huntId, data);
  return result;
}

/** Hunt-level update: load -> applyUpdate -> save (only on change). */
export function updateCoverage(huntId, input, nowIso) {
  const { data, result } = applyUpdate(loadCoverage(huntId), input, nowIso);
  if (result.status === 'updated') saveCoverage(huntId, data);
  return result;
}

/** All rows still open (the briefing's gap list source). */
export function openGapRows(data) {
  return (data && data.rows ? data.rows : []).filter((r) => r.outcome === 'open_gap');
}

/** Class ids that hold any row at all (accounted, open or closed). */
export function accountedClassIds(data) {
  return new Set((data && data.rows ? data.rows : []).map((r) => r.class));
}

/** Class ids closed by an actual test (probed_clean / confirmed). */
export function probedClassIds(data) {
  return new Set(
    (data && data.rows ? data.rows : [])
      .filter((r) => r.outcome === 'probed_clean' || r.outcome === 'confirmed')
      .map((r) => r.class),
  );
}

/**
 * Pure research-debt merge (Lane L P4): fold one session's research
 * accounting into the cumulative per-class counters. `sessionStats`
 * is [{ id, n, probed }] — n research hits this session, probed =
 * a probe-signature action landed this session. `extraProbed` is a
 * Set of class ids known probed hunt-wide (full-record accounting
 * or a probed ledger row); once a class is probed, the debt is
 * settled permanently — the counter keeps the research total as
 * history but the class stops rendering as debt.
 */
export function mergeResearchDebt(data, sessionStats, nowIso = new Date().toISOString(), extraProbed = new Set()) {
  const d = data && Array.isArray(data.rows) ? data : emptyCoverage();
  const debt = { ...(d.researchDebt || {}) };
  let changed = false;
  for (const s of sessionStats || []) {
    if (!s || !s.id || !(Number(s.n) > 0)) continue;
    const prev = debt[s.id] || { researched: 0, probed: false, sessionsResearched: 0, lastResearchedAt: '' };
    debt[s.id] = {
      researched: prev.researched + Number(s.n),
      probed: prev.probed === true || s.probed === true || extraProbed.has(s.id),
      sessionsResearched: (Number(prev.sessionsResearched) || 0) + 1,
      lastResearchedAt: nowIso,
    };
    changed = true;
  }
  // A class probed hunt-wide settles even if this session added no
  // research for it.
  for (const id of extraProbed) {
    if (debt[id] && !debt[id].probed) {
      debt[id] = { ...debt[id], probed: true };
      changed = true;
    }
  }
  if (!changed) return d;
  return { ...d, researchDebt: debt, updatedAt: nowIso };
}
