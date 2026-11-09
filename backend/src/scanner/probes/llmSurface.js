// Dark Matter rule-based scanner — shared LLM-surface fingerprinting
// for the llm-* probe family (coverage rows #15–#28, #376–#384;
// the vulnerable-LLM lab on port 3600).
//
// WHY A SHARED MODULE: all four llm-* probes (tool misuse, excessive
// agency, output handling, misinformation) must first prove the same
// thing — "this target exposes a live LLM chat endpoint" — before
// any of their oracles mean anything. Fingerprinting once per probe
// keeps each probe self-contained (no cross-probe state), while the
// shared helper keeps the fingerprint rule identical everywhere:
// a candidate chat URL is fingerprinted ONLY when a benign POST
// returns HTTP 200 + a JSON body carrying a completion string. A
// JSON API that answers {status:'ok'} (the Juice-shape stub in
// gatedSkip GS-5) is NOT an LLM endpoint, and a 404 / HTML answer
// is not one either. On DVWA and Juice Shop no candidate ever
// fingerprints, so every llm-* probe returns [] there — a proven
// true negative ("no LLM surface"), recorded in the phase extras
// as llmEndpoints 0, never a finding and never a silent skip.
//
// CANDIDATES: (1) mined chat/completion routes from the scan's
// apiRoutes (a real LLM app's /api/chat shows up in the crawl or
// the JS-bundle mine), (2) the well-known paths /api/chat and
// /api/completion on the target origin — tried ONLY when the
// target is a lab target (isLabTargetHost), so a non-lab target
// never receives an unsolicited POST. The benign control prompt
// is 'hi' — it changes no state anywhere.
//
// The fingerprint helper never decides a finding: it returns the
// fingerprinted chat URL + the benign control response, and each
// probe applies its own control/attack differential on top.

import { isLabTargetHost } from '../../labCreds.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
// At most 3 chat candidates per fingerprint (mined first, then
// well-known) — the LLM lab answers the first well-known path.
const MAX_CHAT_CANDIDATES = 3;

export const LLM_CHAT_PATHS = ['/api/chat', '/api/completion'];
export const LLM_TOOL_PATH = '/api/tool';
export const LLM_RAG_PATH = '/api/rag';
export const LLM_USERS_PATH = '/api/users';
export const LLM_PAGE_PATH = '/page';

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * True when a URL looks like an LLM chat/completion route: its
 * pathname ends with a chat/completion/generate segment, optionally
 * under /api or /api/v1. Pure.
 */
export function isLlmChatRoute(url) {
  try {
    const p = new URL(String(url)).pathname.toLowerCase().replace(/\/+$/, '');
    return /(^|\/)(api\/)?(v1\/)?(chat|completions?|generate)$/.test(p);
  } catch {
    return false;
  }
}

/**
 * Judge one chat response. An LLM endpoint is fingerprinted ONLY
 * on HTTP 200 + a JSON body carrying a completion string (the
 * stub returns `completion`; `text` / `response` / `output` are
 * accepted for non-stub LLM APIs). Anything else — a 404, an HTML
 * page, a {status:'ok'} JSON API — is not an LLM endpoint. Pure.
 */
export function assessLlmChatResponse(status, json) {
  if (status !== 200 || !json || typeof json !== 'object') {
    return { isLlm: false, completion: null, model: null, toolCall: null };
  }
  const completion =
    typeof json.completion === 'string'
      ? json.completion
      : typeof json.text === 'string'
        ? json.text
        : typeof json.response === 'string'
          ? json.response
          : typeof json.output === 'string'
            ? json.output
            : null;
  if (completion === null) {
    return { isLlm: false, completion: null, model: null, toolCall: null };
  }
  const toolCall =
    json.toolCall && typeof json.toolCall === 'object' ? json.toolCall : null;
  return {
    isLlm: true,
    completion,
    model: typeof json.model === 'string' ? json.model : null,
    toolCall,
  };
}

/**
 * Extract a duration in days from text ('365-day', '30 days' ->
 * 365 / 30). Null when no '<number> day(s)' phrase is present.
 * Pure. The misinformation oracle compares the duration the chat
 * answer states against the durations the RAG store itself
 * returns for the same question — a contradiction, not a
 * hardcoded string match.
 */
export function extractDurationDays(text) {
  const m = /(\d+)\s*-?\s*days?\b/i.exec(String(text || ''));
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Escape a marker the way an HTML-escaping renderer would, so the
 * output-handling oracle can tell "rendered raw" from "rendered
 * escaped". Pure.
 */
export function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * True when the response body carries the marker VERBATIM and does
 * NOT carry its escaped form — i.e. the renderer emitted the
 * markup raw. Pure.
 */
export function hasUnescapedMarker(body, marker) {
  const b = String(body || '');
  if (!b.includes(marker)) return false;
  if (b.includes(escapeHtml(marker))) return false;
  return true;
}

// ---- network (fetchFn seam, defaults to global fetch) -----------------------

async function req(fetchFn, url, { method = 'GET', body = null, timeoutMs = TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      method,
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        ...(body != null ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text().catch(() => '');
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON — json stays null
    }
    return { status: res.status, text: text.slice(0, 200000), json };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * POST one chat prompt. Returns { status, json, text } or null on
 * network failure. The {prompt} shape is the lab's documented
 * chat shape (a {"message":...} body is a caller error — 400).
 */
export async function chatPost(fetchFn, chatUrl, prompt) {
  return req(fetchFn, chatUrl, { method: 'POST', body: { prompt: String(prompt || '') } });
}

/**
 * Fingerprint the target's LLM chat endpoint.
 *
 * Candidates: mined chat/completion routes from `minedRoutes`
 * first, then the well-known paths on `origin` — but the
 * well-known paths are tried ONLY when the origin is a lab
 * target (isLabTargetHost), so a non-lab target never receives
 * an unsolicited POST. Each candidate gets ONE benign POST
 * ({prompt:'hi'}); the first candidate that assesses as an LLM
 * endpoint wins.
 *
 * Returns { chatUrl, control, llmEndpoints, attempts } where
 * control is the benign response's assessment (completion +
 * toolCall, for the caller's control leg), llmEndpoints is 0 or
 * 1, and attempts counts the POSTs made. No finding is ever
 * decided here.
 */
export async function findLlmChatEndpoint(fetchFn, origin, minedRoutes, opts = {}) {
  const result = { chatUrl: null, control: null, llmEndpoints: 0, attempts: 0 };
  const mined = [];
  for (const r of minedRoutes || []) {
    const s = String(r || '');
    if (isLlmChatRoute(s) && !mined.includes(s)) mined.push(s);
  }
  const candidates = mined.slice(0, MAX_CHAT_CANDIDATES);
  if (candidates.length < MAX_CHAT_CANDIDATES && isLabTargetHost(origin, opts.labTargets)) {
    for (const p of LLM_CHAT_PATHS) {
      const u = origin.replace(/\/+$/, '') + p;
      if (!candidates.includes(u)) candidates.push(u);
      if (candidates.length >= MAX_CHAT_CANDIDATES) break;
    }
  }
  for (const candidate of candidates) {
    result.attempts += 1;
    const r = await chatPost(fetchFn, candidate, 'hi');
    if (!r) continue;
    const assessed = assessLlmChatResponse(r.status, r.json);
    if (!assessed.isLlm) continue;
    result.chatUrl = candidate;
    result.control = assessed;
    result.llmEndpoints = 1;
    return result;
  }
  return result;
}

export const __llmSurfaceMeta = { phases: ['llm-tool-misuse', 'llm-excessive-agency', 'llm-output-handling', 'llm-misinformation'], depth: ['standard', 'deep'] };
