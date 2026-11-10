// Dark Matter rule-based scanner — shared LLM-lab helpers.
//
// The vulnerable-LLM lab (labs/llm-lab) is a DETERMINISTIC stub:
// server.js is Node stdlib only, no weights, no external calls, $0
// spend. Every LLM probe in this folder fingerprints the stub FIRST
// (GET {origin}/health must answer service 'llm-lab' + model
// 'shopassist-stub-1.0') and returns [] on any other target, so no
// chat/tool traffic ever reaches Juice, DVWA, or a real site.
//
// Shared seams (all unit-testable with a stub fetchFn):
//   llmGate(url, opts)      — labCreds + allowWrite + lab host +
//                             depth !== 'quick'; returns { origin }.
//   isLlmLab(origin, fn)    — the /health fingerprint.
//   postJson / getJson       — JSON requests with a 15s timeout.
//   llmChat / llmTool / llmRag / llmModelCard / llmIndex — the
//                             stub's endpoints, parsed or null.
//   hasThrottleSignal / assessLlmResponse — the throttle oracle
//                             shared by the rate-limit probe (same
//                             shape as quotaBypass's assessApiResponse:
//                             429 / Retry-After / refusal text =
//                             throttled; 2xx + JSON = granted).
//   ev()                    — evidence objects; every finding is
//                             judged on signalCorrelated (default
//                             protocol) and carries field names only
//                             — sensitive values NEVER enter a report.

import { isLabTargetHost } from '../../labCreds.js';

export const LLM_MODEL = 'shopassist-stub-1.0';
export const LLM_SERVICE = 'llm-lab';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const THROTTLE_TEXT_RE =
  /rate[ -]?limit|too many requests|slow down|quota exceeded|request limit|try again later|throttl|exceeded.*(limit|quota)/i;

export function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

export function originOf(url) {
  try {
    return new URL(String(url)).origin;
  } catch {
    return null;
  }
}

async function req(fetchFn, url, { method = 'GET', body = null } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchFn(url, {
      method,
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body } : {}),
    });
    const text = await res.text().catch(() => '');
    return {
      status: res.status,
      text: String(text || '').slice(0, 200000),
      headers: res.headers || null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function parseJson(text) {
  try {
    const v = JSON.parse(String(text || ''));
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

export async function getJson(fetchFn, url) {
  const r = await req(fetchFn, url);
  if (!r) return null;
  return { status: r.status, text: r.text, headers: r.headers, json: parseJson(r.text) };
}

export async function postJson(fetchFn, url, obj) {
  const r = await req(fetchFn, url, { method: 'POST', body: JSON.stringify(obj || {}) });
  if (!r) return null;
  return { status: r.status, text: r.text, headers: r.headers, json: parseJson(r.text) };
}

/**
 * Fingerprint the deterministic stub: GET {origin}/health must
 * answer the lab's own service + model. Anything else (404, SPA
 * HTML, a real model API) is not the LLM lab. Pure apart from the
 * single GET.
 */
export async function isLlmLab(origin, fetchFn) {
  const r = await getJson(fetchFn, `${origin}/health`);
  if (!r || r.status !== 200 || !r.json) return false;
  return r.json.service === LLM_SERVICE && r.json.model === LLM_MODEL;
}

/** POST /api/chat {prompt} -> parsed body, or null. */
export async function llmChat(origin, prompt, fetchFn) {
  const r = await postJson(fetchFn, `${origin}/api/chat`, { prompt: String(prompt) });
  if (!r || r.status !== 200 || !r.json) return null;
  return r.json;
}

/** POST /api/tool {action, ...extra} -> raw {status, text, json}, or null. */
export async function llmTool(origin, action, extra, fetchFn) {
  return postJson(fetchFn, `${origin}/api/tool`, { action, ...(extra || {}) });
}

/** GET /api/rag?q=... -> parsed body, or null. */
export async function llmRag(origin, q, fetchFn) {
  const r = await getJson(fetchFn, `${origin}/api/rag?q=${encodeURIComponent(String(q))}`);
  if (!r || r.status !== 200 || !r.json) return null;
  return r.json;
}

/** GET /api/model -> parsed model card, or null. */
export async function llmModelCard(origin, fetchFn) {
  const r = await getJson(fetchFn, `${origin}/api/model`);
  if (!r || r.status !== 200 || !r.json) return null;
  return r.json;
}

/** GET / -> index HTML text, or null. */
export async function llmIndex(origin, fetchFn) {
  const r = await req(fetchFn, `${origin}/`);
  if (!r || r.status !== 200) return null;
  return r.text;
}

/**
 * Does a response carry a Retry-After header? Accepts a
 * Headers-like object (.get), a plain object of header names, or
 * null. Pure.
 */
export function hasRetryAfter(headers) {
  if (!headers) return false;
  try {
    if (typeof headers.get === 'function') {
      return headers.get('retry-after') != null || headers.get('Retry-After') != null;
    }
    if (typeof headers === 'object') {
      return Object.keys(headers).some((k) => String(k).toLowerCase() === 'retry-after');
    }
  } catch {
    return false;
  }
  return false;
}

/** True when a response carries any throttle signal. Pure. */
export function hasThrottleSignal(status, text, headers) {
  if (hasRetryAfter(headers)) return true;
  if (THROTTLE_TEXT_RE.test(typeof text === 'string' ? text : '')) return true;
  if (status === 429) return true;
  return false;
}

/**
 * Judge one LLM-lab JSON response. Returns { kind, reason } where
 * kind is 'granted' (2xx + a JSON body, no throttle signal),
 * 'throttled' (HTTP 429, a Retry-After header, or rate-limit
 * refusal text in the body), or 'other' (anything else). Pure.
 */
export function assessLlmResponse(status, text, headers) {
  if (hasThrottleSignal(status, text, headers)) {
    return { kind: 'throttled', reason: 'response carries a throttle signal (HTTP 429 / Retry-After / refusal text)' };
  }
  if (typeof status === 'number' && status >= 200 && status < 300) {
    const trimmed = String(text || '').trim();
    if (trimmed.length === 0) {
      return { kind: 'other', reason: 'endpoint answered 2xx with an empty body' };
    }
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return { kind: 'other', reason: 'endpoint answered 2xx with a non-JSON body' };
    }
    return { kind: 'granted', reason: `endpoint answered HTTP ${status} with a JSON body` };
  }
  return { kind: 'other', reason: `endpoint answered HTTP ${status}` };
}

/**
 * The shared LLM-lab gate: labCreds + allowWrite + lab host +
 * depth !== 'quick' (same lab gate as quotaBypass / bfla /
 * coupon-abuse — model traffic runs only against authorized lab
 * targets, never in quick scans). Returns { origin } or null.
 * Pure apart from the host check.
 */
export function llmGate(url, opts = {}) {
  const creds = opts.labCreds;
  if (!creds || !creds.username || !creds.password) return null;
  if (opts.allowWrite !== true) return null;
  if (!isLabTargetHost(url, opts.labTargets)) return null;
  if ((opts.depth || 'standard') === 'quick') return null;
  const origin = originOf(url);
  if (!origin) return null;
  return { origin };
}
