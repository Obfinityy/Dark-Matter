// Dark Matter frontend — API client for Self (Hunter Self) mode.
//
// Contract (scout 14 Nov 2026; backend builder implements the same):
//   GET  /api/v1/self/checklist                          -> 202-check config
//   POST /api/v1/self/runs {target, confirmedAuthorized:true} -> run
//   GET  /api/v1/self/runs/:id                          -> run state + checklist Yes/No + evidence
//   POST /api/v1/self/runs/:id/checks/:checkId/run      -> run one check
//   POST /api/v1/self/runs/:id/run-category {category}  -> run one category
//   POST /api/v1/self/runs/:id/run-all                  -> whole series
//   POST /api/v1/self/runs/:id/ai-consent {consent:boolean} -> the AI gate
// All require the same JWT as hunts (Bearer `dm_token`).
//
// Response-shape tolerance: the backend is being built in parallel, so the
// normalizers below accept the shapes the contract implies and the obvious
// variants (categories array, flat checks array, `data` wrapper, checks
// state as object map or array). Anything the backend returns that does not
// match is surfaced as an error, never silently invented — no mock data
// lives in this file.
//
// $0 Meta spend: this client makes NO AI calls. The ai-consent POST only
// records the user's explicit Yes/No; the gate itself is enforced
// server-side (the runner must not run an AI leg while aiConsent !== true).
import { resolveApiBase } from '../config';
import { getAuthToken } from './api';

const BASE = '/api/v1/self';

// --- request plumbing (mirrors lib/api.js: timeout, auth, {ok, error, data}) ---

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function request(method, path, body, opts = {}) {
  const controller = new AbortController();
  const timeoutMs = opts.timeout || 120000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const signal = opts.signal || controller.signal;
  try {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${resolveApiBase()}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: (data && (data.message || data.error)) || `Request failed (${res.status})`,
        data,
      };
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    if (err && err.name === 'AbortError') {
      return { ok: false, error: 'Request timed out. The backend may still be processing — refresh the run before retrying.' };
    }
    return { ok: false, error: 'Backend unreachable. Check Settings → backend connection.' };
  } finally {
    clearTimeout(timeoutId);
  }
}

const get = (path, opts) => request('GET', path, undefined, opts);
const post = (path, body, opts) => request('POST', path, body, opts);

// --- endpoints ---

export function getSelfChecklist() {
  return get(`${BASE}/checklist`);
}

export function createSelfRun(target) {
  return post(`${BASE}/runs`, { target, confirmedAuthorized: true });
}

export function getSelfRun(runId) {
  return get(`${BASE}/runs/${encodeURIComponent(runId)}`);
}

export function runSelfCheck(runId, checkId) {
  return post(`${BASE}/runs/${encodeURIComponent(runId)}/checks/${encodeURIComponent(checkId)}/run`, {});
}

export function runSelfCategory(runId, category) {
  return post(`${BASE}/runs/${encodeURIComponent(runId)}/run-category`, { category });
}

export function runSelfAll(runId) {
  return post(`${BASE}/runs/${encodeURIComponent(runId)}/run-all`, {});
}

// The AI gate: consent is the user's explicit choice, passed through
// verbatim. This client NEVER defaults it to true and NEVER calls this
// without the user pressing Yes/No on the consent card.
export function submitSelfAiConsent(runId, consent) {
  return post(`${BASE}/runs/${encodeURIComponent(runId)}/ai-consent`, { consent: consent === true });
}

// --- normalizers (pure; unit-tested in selfApi.test.js) ---

function slug(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function normalizeCheck(raw, fallbackCategory) {
  if (!raw || typeof raw !== 'object') return null;
  const id = asText(raw.id || raw.key || raw.checkId).trim();
  if (!id) return null;
  return {
    id,
    name: asText(raw.name || raw.title || raw.label || id).trim(),
    kind: String(raw.kind || raw.type || 'rule-based').toLowerCase() === 'ai' ? 'ai' : 'rule-based',
    description: asText(raw.description || raw.detail || ''),
    category: asText(raw.category || raw.sheet || fallbackCategory || '').trim(),
  };
}

function normalizeCategory(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = asText(raw.name || raw.title || raw.label || raw.id || raw.key).trim();
  if (!name) return null;
  const rawChecks = Array.isArray(raw.checks) ? raw.checks : [];
  return {
    id: asText(raw.id || raw.key || slug(name)).trim() || slug(name),
    name,
    checks: rawChecks.map((c) => normalizeCheck(c, name)).filter(Boolean),
  };
}

// Accepts: {categories:[{id,name,checks:[...]}]}, {checks:[...]} flat
// (grouped by check.category/sheet in first-seen order), or a `data`
// wrapper around either. Duplicate check ids across categories (the
// A11–A16 focused views repeat A01/A05/A08 checks) are kept ONCE, at
// their first occurrence, so the total is the 202 distinct checks —
// categories left empty by dedupe are dropped.
export function normalizeChecklist(raw) {
  const body = raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object' ? raw.data : raw;
  if (!body || typeof body !== 'object') return { categories: [], totalChecks: 0 };
  let categories = [];
  if (Array.isArray(body.categories)) {
    categories = body.categories.map(normalizeCategory).filter(Boolean);
  } else if (Array.isArray(body.checks)) {
    const byCategory = new Map();
    for (const rawCheck of body.checks) {
      const check = normalizeCheck(rawCheck, '');
      if (!check) continue;
      const catName = check.category || 'Uncategorised';
      if (!byCategory.has(catName)) byCategory.set(catName, { id: slug(catName) || 'uncategorised', name: catName, checks: [] });
      byCategory.get(catName).checks.push(check);
    }
    categories = [...byCategory.values()];
  }
  const seen = new Set();
  const deduped = [];
  for (const cat of categories) {
    const checks = [];
    for (const check of cat.checks) {
      if (seen.has(check.id)) continue;
      seen.add(check.id);
      checks.push(check);
    }
    if (checks.length > 0) deduped.push({ ...cat, checks });
  }
  return { categories: deduped, totalChecks: seen.size };
}

const CHECK_VERDICTS = new Set(['yes', 'no', 'running', 'pending', 'skipped', 'blocked', 'failed', 'done']);

export function normalizeCheckResult(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const statusRaw = String(raw.status || raw.verdict || raw.state || '').toLowerCase().replace(/[\s_]+/g, '-');
  let status = CHECK_VERDICTS.has(statusRaw) ? statusRaw : null;
  if (!status) {
    // Boolean-shaped results: explicit found/vulnerable flags only.
    if (raw.found === true || raw.vulnerable === true) status = 'yes';
    else if (raw.found === false || raw.vulnerable === false) status = 'no';
    else if (raw.ran === true || raw.completed === true) status = 'done';
  }
  const findings = Array.isArray(raw.findings) ? raw.findings : [];
  const evidence = Array.isArray(raw.evidence)
    ? raw.evidence
    : (typeof raw.evidence === 'string' && raw.evidence ? [raw.evidence] : []);
  return {
    status,
    summary: asText(raw.summary || raw.message || ''),
    counts: raw.counts && typeof raw.counts === 'object' ? raw.counts : null,
    findings,
    evidence,
    error: asText(raw.error || raw.reason || ''),
  };
}

// Accepts run state as the object itself or wrapped in `data`; per-check
// state from `checks` / `checklist` / `results` as an object map
// ({checkId: result}) or an array ([{checkId|id, ...result}]).
export function normalizeRun(raw) {
  const body = raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object' && !raw.id ? raw.data : raw;
  if (!body || typeof body !== 'object') return null;
  const id = asText(body.id || body.runId || '').trim();
  if (!id) return null;
  const checksRaw = body.checks || body.checklist || body.results || {};
  const checks = {};
  if (Array.isArray(checksRaw)) {
    for (const entry of checksRaw) {
      if (!entry || typeof entry !== 'object') continue;
      const checkId = asText(entry.checkId || entry.id || entry.key).trim();
      if (!checkId) continue;
      checks[checkId] = normalizeCheckResult(entry);
    }
  } else if (checksRaw && typeof checksRaw === 'object') {
    for (const [checkId, entry] of Object.entries(checksRaw)) {
      checks[checkId] = normalizeCheckResult(entry);
    }
  }
  return {
    id,
    target: asText(body.target || ''),
    phase: asText(body.phase || body.status || '').trim(),
    status: asText(body.status || body.phase || '').trim(),
    aiConsent: body.aiConsent === true ? true : body.aiConsent === false ? false : null,
    checks,
    summary: body.summary && typeof body.summary === 'object' ? body.summary : null,
    createdAt: asText(body.createdAt || ''),
    updatedAt: asText(body.updatedAt || ''),
  };
}

// Verdict for the checklist tick: 'yes' | 'no' | 'running' | 'pending' |
// 'skipped' | 'blocked' | 'failed' | null (never run / unknown).
export function checkVerdict(result) {
  if (!result) return null;
  if (result.status === 'done') return 'yes';
  return result.status || null;
}

// SHORT + filtered: counts + at most 5 top findings + at most 5 evidence
// lines, each line capped — never a raw dump. Findings may be strings or
// objects ({title|summary|name}); objects are reduced to one line.
export function shortResult(result, { maxFindings = 5, maxEvidence = 5, maxLine = 160 } = {}) {
  if (!result) return { counts: null, topFindings: [], evidence: [], error: '' };
  const clip = (line) => {
    const s = String(line || '').trim().replace(/\s+/g, ' ');
    return s.length > maxLine ? `${s.slice(0, maxLine - 1)}…` : s;
  };
  const oneLine = (f) => {
    if (typeof f === 'string') return f;
    if (f && typeof f === 'object') return f.title || f.summary || f.name || f.message || f.url || '';
    return '';
  };
  return {
    counts: result.counts || null,
    topFindings: (result.findings || []).map(oneLine).map(clip).filter(Boolean).slice(0, maxFindings),
    evidence: (result.evidence || []).map(clip).filter(Boolean).slice(0, maxEvidence),
    error: clip(result.error || ''),
  };
}
