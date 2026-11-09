// Split out of llm.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; llm.js re-exports the public names so callers are unchanged.

import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { recordCost, recordCostSafe } from '../costTracker.js';
import { config } from '../config.js';
import { sanitizeForModel } from './sanitize.js';
import { createLogger } from '../logger.js';
export { sanitizeForModel } from './sanitize.js';

const log = createLogger('llm');

const OLLAMA_URL = String(process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '');

const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'dolphin-mistral:7b';



// The heartbeat path: AI_HEARTBEAT_PATH wins; otherwise the
// config-derived default (checkout root + '.ai-inference-active').
// Read at call time (not module load) so tests can point it at a temp
// file. The heartbeat is GLOBAL — one shared model, one file, read by
// the ollama-watchdog too — so the default is app-root-derived, never
// hunt-scoped and never a hardcoded install path.
export function getInferenceHeartbeatPath() {
  return process.env.AI_HEARTBEAT_PATH || config.aiHeartbeatPath;
}

/**
 * Char budget for one message on the LOCAL Ollama path (solver #459).
 * The old flat slice(0, 8000) silently cut every message at 8k chars —
 * including the hunt's full-history planning prompt, which Job 5 budgets
 * at (num_ctx − reserve) × 3.5 chars (~55.6k at num_ctx 16384): the model
 * only ever received the first 8,000 chars of it. The real limit is the
 * context window itself, so the cap is derived from OLLAMA_NUM_CTX with
 * the same 3.5 chars/token heuristic huntAgent budgets with (floor 8000
 * so small-window configs behave exactly as before). Other providers
 * keep their own caps — they are cost guards on unused paths.
 */
export function ollamaMessageCharCap() {
  const numCtx = parseInt(process.env.OLLAMA_NUM_CTX || '8192', 10) || 8192;
  return Math.max(8000, Math.floor(numCtx * 3.5));
}

// READINESS-AWARE RETRY (Infinity level, 26 Oct 2026) — the no-reply
// root cause, live: the kernel OOM-kills llama-server (5 kills in
// dmesg, ~7GB RSS on a 7,775MB box; the running server sits at 81.5%
// MEM / 6.4GB RSS), and the model reload takes ~176s. The old code
// retried IMMEDIATELY after a connection failure, hit ECONNREFUSED
// (the server was still reloading), and returned null — "Brain gave
// no reply" — ending the session. 57 no-reply turns of 182 (31%).
// Now a connection failure (and a 5xx, which is the same reload
// wearing an HTTP status) waits for the server to answer GET
// /api/tags again before the single retry. The wait is bounded
// (OLLAMA_READY_WAIT_MS, default 200s — the ~176s reload plus
// margin) and polls every OLLAMA_READY_POLL_MS (default 5s), and it
// runs INSIDE the heartbeat block, so the watchdog does not kill
// the reloading server. The gate is deliberately /api/tags (the
// server answers), NOT /api/ps (the model is loaded): the reload is
// triggered by the retry's own /api/chat request, so requiring the
// model to already be listed would wait forever. A deadline error
// is NOT a connection error — the server was alive but slow — so
// it keeps the old immediate retry. Do NOT raise the timeout
// blindly: the timeout was never the failure; the reload was.
export const OLLAMA_READY_WAIT_MS_DEFAULT = 200000;

export const OLLAMA_READY_POLL_MS_DEFAULT = 5000;

// RULE #50 (30 Oct 2026) — ADVISORY BUDGET: the verifier's advisory LLM
// calls (curiosity follow-ups, PoC drafting) are advice, not the verdict —
// the deterministic re-run already carried every verdict on the 29-Oct
// live rehearsal while the advisory calls hung against a dead Ollama.
// A dead Ollama costs one advisory call ~300s + readiness wait + 300s
// retry (11 claims => ~1h of pure stall). Advisory calls get ONE attempt
// with this bound, no readiness wait, no retry; null returns instantly
// to the deterministic path. OLLAMA_ADVISORY_TIMEOUT_MS overrides.
export const OLLAMA_ADVISORY_TIMEOUT_MS_DEFAULT = 60000;

/** True when an Ollama failure means "the server is (re)starting", not "the model was slow". */
export function isOllamaConnectionError(err) {
  if (!err) return false;
  const code = String(err.code || '');
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ENOTFOUND' || code === 'EPIPE' || code === 'ETIMEDOUT') return true;
  return /ECONNREFUSED|socket hang up|EPIPE/.test(String(err.message || ''));
}

/** One GET against the Ollama server; null on any transport failure. */
function ollamaGet(path, baseUrl) {
  return new Promise((resolve) => {
    let u;
    try {
      u = new URL(`${String(baseUrl || OLLAMA_URL).replace(/\/+$/, '')}${path}`);
    } catch {
      resolve(null);
      return;
    }
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname,
      method: 'GET',
      timeout: 5000,
    }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
      res.on('error', () => resolve(null));
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.end();
  });
}

/**
 * Wait for the Ollama server to answer GET /api/tags again.
 * @returns {Promise<boolean>} true when the server answered 200
 *   within the wait, false when it never came back (bounded).
 */
export async function waitForOllamaReady({ baseUrl, waitMs, pollMs, sleepFn } = {}) {
  const wait = Math.max(0, Number(waitMs ?? process.env.OLLAMA_READY_WAIT_MS ?? OLLAMA_READY_WAIT_MS_DEFAULT) || 0);
  const poll = Math.max(1, Number(pollMs ?? process.env.OLLAMA_READY_POLL_MS ?? OLLAMA_READY_POLL_MS_DEFAULT) || OLLAMA_READY_POLL_MS_DEFAULT);
  const sleep = sleepFn || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const deadline = Date.now() + wait;
  for (;;) {
    const res = await ollamaGet('/api/tags', baseUrl);
    if (res && res.status === 200) return true;
    if (Date.now() >= deadline) return false;
    await sleep(Math.min(poll, Math.max(0, deadline - Date.now())));
  }
}

// PHASE 9 (31 Oct 2026): heartbeat write with never-shorten semantics.
// An advisory (short) call must never overwrite a main turn's (long)
// deadline. Returns true if the file was written, false if the existing
// longer deadline was kept. Exported for testing.
export function writeInferenceHeartbeat(hbPath, newDeadline, huntId) {
  try {
    try {
      const existing = JSON.parse(fs.readFileSync(hbPath, 'utf8'));
      if (typeof existing.deadline === 'number' && existing.deadline > newDeadline) {
        return false; // keep the longer deadline — do not shorten
      }
    } catch { /* no valid existing heartbeat — write fresh */ }
    fs.writeFileSync(hbPath, JSON.stringify({
      startedAt: new Date().toISOString(),
      deadline: newDeadline,
      huntId: huntId || null,
    }));
    return true;
  } catch { /* heartbeat is best-effort */ }
  return false;
}

/**
 * Chat with the real AI.
 * @param {Array<{role:'user'|'assistant', text:string}>} messages
 * @param {string} system — system prompt (hunt context goes here)
 * @param {{userId?: string, huntId?: string}} ctx — for cost tracking
 * @returns {Promise<string|null>} reply text, or null if no AI is configured.
 */
export async function chatWithOllama(messages, system, ctx, opts = {}) {
  const callStart = Date.now();
  const huntId = (ctx && ctx.huntId) || null;
  const advisory = Boolean(opts && opts.advisory);
  let outcome = 'unknown';
  try {
    const text = await chatWithOllamaInner(messages, system, ctx, opts);
    outcome = text ? 'ok' : 'null_reply';
    return text;
  } catch (err) {
    outcome = 'threw:' + String((err && err.message) || 'unknown').slice(0, 60).replace(/\s+/g, ' ');
    throw err;
  } finally {
    try {
      log.error(`[llm] ollama call hunt=${huntId} advisory=${advisory} outcome=${outcome} duration_ms=${Date.now() - callStart}`);
    } catch { /* logging never breaks the call */ }
  }
}

// TRANSPORT (solver #461): node:http + streaming, NOT fetch. Two stacked
// reasons, root-caused live 20 Oct 2026: (1) undici fetch defaults carry a
// ~300 s headers/body-inactivity timeout that no per-request option in
// the fetch API overrides — with stream:false NO byte arrives until the
// whole generation finishes, so every call whose prefill+generation
// exceeded ~300 s died with 'fetch failed' while llama-server kept
// processing the orphaned prompt. Once #459 let the full 55k-char
// planning prompt through (prefill alone ~10.8k tokens at 5-9 tok/s on
// this box), EVERY planning call crossed 300 s: three consecutive
// no-reply iterations paused the main hunt (12:09:50Z). (2) Even with
// stream:true, prefill emits no body bytes for many minutes, so the
// inactivity problem survives streaming under fetch. node:http with
// timeout:0 has no inactivity kill; the ONLY deadline is our own
// overall one (OLLAMA_TIMEOUT_MS), and streamed NDJSON chunks are
// accumulated into the same reply shape the old res.json() produced.
function ollamaChatOnce(ollamaMessages, deadlineMs) {
  return new Promise((resolve, reject) => {
  const u = new URL(`${OLLAMA_URL}/api/chat`);
  const payload = JSON.stringify({
    model: OLLAMA_MODEL,
    messages: ollamaMessages,
    stream: true,
    // Keep the model resident for 24h after each inference. Without this,
    // Ollama falls back to its 5-minute default (the OLLAMA_KEEP_ALIVE env
    // var was not reaching the running ollama serve process), and the model
    // unloads between hunt iterations (10-15 min apart), stalling hunts.
    // Request-level keep_alive overrides the server default.
    keep_alive: '24h',
    // Tuned for 2vCPU EC2: smaller context + fewer tokens = faster.
    // num_ctx caps KV cache to avoid OOM; num_predict keeps plans short.
    options: {
      num_predict: parseInt(process.env.OLLAMA_NUM_PREDICT || '600', 10),
      num_ctx: parseInt(process.env.OLLAMA_NUM_CTX || '8192', 10),
      temperature: 0.7,
    },
  });
  const lib = u.protocol === 'https:' ? https : http;
  const req = lib.request({
    hostname: u.hostname,
    port: u.port || (u.protocol === 'https:' ? 443 : 80),
    path: u.pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    timeout: 0,
  }, (res) => {
    res.setEncoding('utf8');
    if (res.statusCode !== 200) {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => resolve({ ok: false, status: res.statusCode, body: buf.slice(0, 300) }));
      res.on('error', reject);
      return;
    }
    let buf = '';
    let text = '';
    let finalChunk = null;
    res.on('data', (chunk) => {
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        try {
          const j = JSON.parse(line);
          if (j.message && j.message.content) text += j.message.content;
          if (j.done) finalChunk = j;
        } catch { /* a split JSON line is re-parsed when its tail lands */ }
      }
    });
    res.on('end', () => resolve({
      ok: true,
      text,
      promptEvalCount: (finalChunk && finalChunk.prompt_eval_count) || 0,
      evalCount: (finalChunk && finalChunk.eval_count) || 0,
    }));
    res.on('error', reject);
  });
  const timer = setTimeout(() => {
    req.destroy(new Error(`ollama chat deadline ${deadlineMs}ms exceeded`));
  }, deadlineMs);
  req.on('close', () => clearTimeout(timer));
  req.on('error', reject);
  req.write(payload);
  req.end();
  });
}

// Readiness wait shared by both retry paths in chatWithOllamaInner:
// poll until the server answers again, then extend the heartbeat
// across the wait. Returns false when the server never came back.
async function waitForOllamaAndExtendHeartbeat(writeHeartbeat) {
  const ready = await waitForOllamaReady();
  if (!ready) return false;
  writeHeartbeat(); // extend the deadline across the wait
  return true;
}

/**
 * LATENCY OBSERVABILITY (31 Oct 2026, audit R-12): every Ollama call is
 * timed and logged with its outcome — the loop's "latency pressure" was
 * previously invisible (timeouts fired, but nobody could see the
 * duration distribution or correlate slow calls with memory pressure).
 * One stderr line per call: hunt, advisory/main, outcome, duration_ms.
 * Outcome: ok | null_reply (settled with no text) | threw:<msg>.
 * The inner function's own logs keep the detailed classification
 * (connection error vs 5xx vs deadline); this line adds the duration
 * dimension. Logging never breaks the call.
 */
async function chatWithOllamaInner(messages, system, ctx, opts = {}) {
  const advisory = Boolean(opts && opts.advisory);
  // Privacy gateway: strip secrets/PII before the model — same as Bedrock.
  const clean = (t) => sanitizeForModel(String(t || ''));
  const msgCap = ollamaMessageCharCap();
  const ollamaMessages = [];
  if (system) ollamaMessages.push({ role: 'system', content: clean(system).slice(0, msgCap) });
  for (const m of messages || []) {
    ollamaMessages.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: clean(m.text).slice(0, msgCap),
    });
  }
  let result;
  // INFERENCE HEARTBEAT (19 Oct 2026): the ollama-watchdog kills llama-server
  // when its 120s inference probe times out — but a real hunt inference takes
  // 10-15 min on 2vCPU, so the watchdog was murdering HEALTHY busy servers
  // (kill-reload-kill: HTTP 500 "unexpected EOF" mid-hunt, iteration burned,
  // pause ai_no_reply, resume, repeat — seen live 19:47/19:52Z 18 Oct).
  // Write a heartbeat carrying a deadline; the watchdog skips the kill while
  // it is fresh. Deadline (not deletion) is the signal, so a crashed backend
  // can never wedge the watchdog off permanently. Best-effort: never break
  // the AI call.
  const hbPath = getInferenceHeartbeatPath();
  const hbTimeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || '300000', 10);
  // RULE #50 (30 Oct 2026): the advisory bound, env-overridable; a bound
  // of <=0 disables the advisory fast path (falls back to the main path).
  const advisoryMs = advisory
    ? parseInt(process.env.OLLAMA_ADVISORY_TIMEOUT_MS || String(OLLAMA_ADVISORY_TIMEOUT_MS_DEFAULT), 10)
    : 0;
  const attemptMs = advisoryMs > 0 ? Math.min(hbTimeoutMs, advisoryMs) : hbTimeoutMs;
  const writeHeartbeat = () => {
    const newDeadline = Date.now() + attemptMs * 2 + 120000;
    // PHASE 9 (31 Oct 2026): NEVER shorten an existing future deadline.
    // An advisory (short-timeout) call must not overwrite a main turn's
    // (long-timeout) deadline, or the watchdog kills a healthy-busy
    // runner mid-inference (seen live 20:15 IST 31 Oct 2026).
    writeInferenceHeartbeat(hbPath, newDeadline, (ctx && ctx.huntId) || null);
  };
  const clearHeartbeat = () => { try { fs.unlinkSync(hbPath); } catch { /* ignore */ } };
  writeHeartbeat();
  try {
    // RULE #50 (30 Oct 2026) — ADVISORY FAST PATH: one attempt, no
    // readiness wait, no retry. The deterministic verdict already stands
    // (recordValidation ran before any advisory call); a null here just
    // skips the advice. A deadline error is caught — it is not a
    // connection error, and there is no retry to deserve.
    if (advisoryMs > 0) {
      try {
        result = await ollamaChatOnce(ollamaMessages, attemptMs);
      } catch (err) {
        log.error(`[llm] advisory call failed fast at ${OLLAMA_URL}: ${err.message} — skipping advice`);
        return null;
      }
      if (!result || !result.ok) return null;
      const advisoryText = String(result.text || '').trim();
      return advisoryText || null;
    }
    // Defensive: never hang forever if the model stalls — fail cleanly so
    // callers fall back to deterministic replies instead of hanging the
    // request (and the reverse proxy in front of us). The bound is the
    // overall deadline inside ollamaChatOnce (OLLAMA_TIMEOUT_MS).
    try {
      result = await ollamaChatOnce(ollamaMessages, hbTimeoutMs);
    } catch (err) {
      log.error(`[llm] Ollama attempt 1 failed at ${OLLAMA_URL}: ${err.message}`);
      if (isOllamaConnectionError(err)) {
        // The server is (re)starting — wait for it to answer again
        // before the retry (readiness note above). An immediate
        // retry here is the old bug: ECONNREFUSED while the model
        // reloads, then null, then a no-reply turn.
        log.error('[llm] Ollama connection failed — waiting for the server to come back before retrying');
        if (!(await waitForOllamaAndExtendHeartbeat(writeHeartbeat))) {
          log.error('[llm] Ollama never came back within the readiness wait');
          return null;
        }
      }
      // One retry — transient stalls are common on 2vCPU.
      try {
        result = await ollamaChatOnce(ollamaMessages, hbTimeoutMs);
      } catch (err2) {
        log.error(`[llm] Ollama unreachable at ${OLLAMA_URL} after retry: ${err2.message}`);
        return null;
      }
    }
    if (!result.ok) {
      log.error(`[llm] Ollama HTTP ${result.status} for model ${OLLAMA_MODEL}: ${result.body || ''}`);
      // RETRY ON 5xx (19 Oct 2026): HTTP 500 "unexpected EOF" is transient —
      // it fires while the model is (re)loading after a watchdog kill or an
      // OOM crash. The old fixed 15s wait assumed the watchdog's ~15-30s
      // reload; an OOM reload takes ~176s, so the wait is now the same
      // readiness poll as the connection-failure path — it returns as
      // soon as the server answers (fast for a quick reload) and waits
      // out a slow one, bounded.
      if (result.status >= 500) {
        log.error('[llm] Ollama 5xx — waiting for the server to be ready again, then one retry');
        if (!(await waitForOllamaAndExtendHeartbeat(writeHeartbeat))) {
          log.error('[llm] Ollama never came back after 5xx');
          return null;
        }
        try {
          result = await ollamaChatOnce(ollamaMessages, hbTimeoutMs);
        } catch (err3) {
          log.error(`[llm] Ollama retry after 5xx failed: ${err3.message}`);
          return null;
        }
        if (!result.ok) {
          log.error(`[llm] Ollama still HTTP ${result.status} after 5xx retry: ${result.body || ''}`);
          return null;
        }
      } else {
        return null;
      }
    }
  } finally {
    clearHeartbeat();
  }
  const text = String(result.text || '').trim();
  // Locally hosted = $0 marginal cost; still ledger the burn event for the UI.
  recordCostSafe(() => {
    recordCost({
      userId: ctx && ctx.userId,
      huntId: ctx && ctx.huntId,
      kind: 'ollama',
      model: OLLAMA_MODEL,
      inputTokens: result.promptEvalCount || 0,
      outputTokens: result.evalCount || 0,
      amountUsd: 0,
      note: 'self-hosted',
    });
  });
  return text || null;
}
