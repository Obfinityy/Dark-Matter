/**
 * restErrorShapeAnalysis.js — REST framework fingerprinting from error-response shapes.
 *
 * Implements idea-bank item 00436: fingerprint the REST framework behind an
 * API by analyzing the shape of its error JSON (keys, nesting, message
 * formats) on 4xx/5xx responses.
 *
 * All functions are pure and side-effect free: they operate on response
 * observations supplied by the caller (gathered during an authorized
 * engagement). No network requests are performed here.
 */

/**
 * Known error-shape signatures. Each matcher receives the parsed body
 * (object) and the raw text, and returns true when the shape matches.
 */
export const ERROR_SHAPE_SIGNATURES = [
  {
    framework: 'FastAPI (Starlette)',
    match: b =>
      Array.isArray(b.detail) &&
      b.detail.every(d => d && typeof d === 'object' && 'loc' in d && 'msg' in d && 'type' in d),
    note: 'FastAPI validation errors: {"detail":[{"loc":[...],"msg":"...","type":"..."}]}.',
  },
  {
    framework: 'Django REST Framework',
    match: b => typeof b.detail === 'string' && Object.keys(b).length <= 3,
    note: 'DRF error shape: {"detail":"..."} for 404/403/401 responses.',
  },
  {
    framework: 'Spring Boot',
    match: b => 'timestamp' in b && 'status' in b && 'error' in b && 'path' in b,
    note: 'Spring Boot WhiteLabel shape: {"timestamp","status","error","message","path"}.',
  },
  {
    framework: 'Laravel',
    match: b => typeof b.message === 'string' && ('exception' in b || 'file' in b || 'trace' in b),
    note: 'Laravel debug shape: {"message","exception","file","line","trace"}.',
  },
  {
    framework: 'NestJS',
    match: b =>
      typeof b.statusCode === 'number' &&
      typeof b.message !== 'undefined' &&
      typeof b.error === 'string',
    note: 'NestJS HttpException shape: {"statusCode","message","error"}.',
  },
  {
    framework: 'Hapi',
    match: b =>
      typeof b.statusCode === 'number' &&
      typeof b.error === 'string' &&
      typeof b.message === 'string' &&
      !('status' in b),
    note: 'Hapi Boom shape: {"statusCode","error","message"}.',
  },
  {
    framework: 'Ruby on Rails (API mode)',
    match: b => Array.isArray(b.errors) && b.errors.every(e => e && typeof e === 'object'),
    note: 'Rails API error shape: {"errors":[{...}]} (often from active_model_serializers).',
  },
  {
    framework: 'Express (default handler)',
    match: (b, raw) => /<!DOCTYPE html>|<html/i.test(raw || '') && /Error/i.test(raw || ''),
    note: 'Default Express error handler renders an HTML stack-trace page, not JSON.',
  },
  {
    framework: 'Go (Echo)',
    match: b => typeof b.message === 'string' && Object.keys(b).length === 1,
    note: 'Echo default shape: {"message":"..."} with a single key.',
  },
  {
    framework: 'ASP.NET Core',
    match: b => typeof b.title === 'string' && typeof b.status === 'number' && 'traceId' in b,
    note: 'ASP.NET Core ProblemDetails shape: {"type","title","status","traceId"}.',
  },
];

/**
 * Safely parse a response body as JSON.
 * @param {string} body Response body text.
 * @returns {{parsed:object|null, isHtml:boolean}}
 */
export function parseErrorBody(body) {
  if (!body || typeof body !== 'string') return { parsed: null, isHtml: false };
  const trimmed = body.trim();
  const isHtml = /^<!DOCTYPE html>|<html[\s>]/i.test(trimmed);
  try {
    const parsed = JSON.parse(trimmed);
    return { parsed: parsed && typeof parsed === 'object' ? parsed : null, isHtml };
  } catch {
    return { parsed: null, isHtml };
  }
}

/**
 * Fingerprint the REST framework from one observed error response.
 * @param {object} obs { status?: number|null, body?: string, headers?: object }
 * @returns {Array<{framework:string, confidence:string, note:string}>} best matches first.
 */
export function fingerprintErrorShape(obs) {
  const o = obs || {};
  const { parsed, isHtml } = parseErrorBody(o.body || '');
  const raw = typeof o.body === 'string' ? o.body : '';
  const hits = [];
  if (isHtml) {
    const express = ERROR_SHAPE_SIGNATURES.find(s => s.framework.startsWith('Express'));
    if (express && express.match(null, raw)) {
      hits.push({ framework: express.framework, confidence: 'high', note: express.note });
    } else {
      hits.push({
        framework: 'unknown (HTML error page)',
        confidence: 'low',
        note: 'Non-JSON error page — framework renders HTML errors by default.',
      });
    }
    return hits;
  }
  if (!parsed) return [];
  for (const sig of ERROR_SHAPE_SIGNATURES) {
    let matched = false;
    try {
      matched = sig.match(parsed, raw) === true;
    } catch {
      matched = false;
    }
    if (matched) hits.push({ framework: sig.framework, confidence: 'high', note: sig.note });
  }
  // Corroborate with the Server / X-Powered-By banner when available.
  const headers = o.headers || {};
  const server = Object.entries(headers).find(([k]) => k.toLowerCase() === 'server');
  if (server && /gunicorn|uvicorn/i.test(String(server[1]))) {
    hits.push({
      framework: 'Python WSGI/ASGI server (Gunicorn/Uvicorn)',
      confidence: 'medium',
      note: 'Server banner corroborates a Python REST stack.',
    });
  }
  return hits;
}

/**
 * Aggregate framework fingerprints across many error observations and pick
 * the most consistent candidate.
 * @param {Array<object>} observations Error-response observations (same shape as fingerprintErrorShape input).
 * @returns {{framework:string|null, confidence:string, votes:object, notes:string[]}}
 */
export function aggregateFrameworkVotes(observations) {
  const list = Array.isArray(observations) ? observations : [];
  const votes = {};
  const notes = [];
  for (const o of list) {
    for (const hit of fingerprintErrorShape(o)) {
      votes[hit.framework] = (votes[hit.framework] || 0) + 1;
    }
  }
  const entries = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return {
      framework: null,
      confidence: 'none',
      votes,
      notes: ['no recognizable error shapes in the supplied observations'],
    };
  }
  const [framework, count] = entries[0];
  const confidence = count >= 3 ? 'high' : count === 2 ? 'medium' : 'low';
  if (entries.length > 1 && entries[1][1] === count) {
    notes.push(
      'multiple frameworks tied on votes — the API may sit behind a gateway that rewrites errors'
    );
  } else {
    notes.push(`${count} of ${list.length} error observation(s) matched ${framework}`);
  }
  return { framework, confidence, votes, notes };
}
