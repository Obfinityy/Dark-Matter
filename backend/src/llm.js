// Dark Matter backend — LLM client for real AI chat (not hardcoded).
//
// The mid-hunt chat must THINK, not recite canned responses. This module
// provides a real LLM backend. The provider is chosen by LLM_PROVIDER:
//
//   LLM_PROVIDER=bedrock (default) — AWS Bedrock (credentials from env).
//   LLM_PROVIDER=ollama            — self-hosted Ollama on the same box,
//                                    e.g. dolphin-mistral:7b (uncensored).
//                                    $0 marginal token cost; the box itself
//                                    is the only cost.
//   LLM_PROVIDER=sagemaker         — AWS SageMaker async inference endpoint.
//                                    For larger models (32B+) that don't fit
//                                    on the EC2 box. Pay-per-use, scales to
//                                    zero. Set SAGEMAKER_ENDPOINT_NAME.
//   LLM_PROVIDER=openrouter          — OpenRouter API (OpenAI-compatible).
//                                    Fast GPU inference, $0 on free-tier
//                                    models. Set OPENROUTER_API_KEY and
//                                    optionally OPENROUTER_MODEL.
//
// When the configured provider is unavailable, chatWithAI returns null and
// the caller falls back to deterministic steering (pause/resume/stop) plus
// an honest notice.
//
// Steering commands (pause/resume/stop) STAY rule-based in chat.js —
// deterministic control must never depend on an LLM's mood.

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
// NOTE: SageMaker SDK is imported LAZILY (dynamic import) only when
// LLM_PROVIDER=sagemaker, because the installed SDK version may not export
// the async APIs as named ESM exports. A static import here crashes the
// entire backend on startup if the exports don't exist.
import { recordCost } from './costTracker.js';
import { config } from './config.js';

const PROVIDER = String(process.env.LLM_PROVIDER || 'bedrock').toLowerCase();

const DEFAULT_MODEL = process.env.BEDROCK_MODEL || 'meta.llama3-1-70b-instruct-v1:0';
const DEFAULT_REGION = process.env.AWS_REGION || 'us-east-1';

const OLLAMA_URL = String(process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'dolphin-mistral:7b';

// SageMaker async inference — for 32B+ models. Endpoint scales to zero;
// each invocation is pay-per-use (~$4-5 per 3-hour hunt on 32B).
const SAGEMAKER_ENDPOINT = process.env.SAGEMAKER_ENDPOINT_NAME || '';
const SAGEMAKER_REGION = process.env.SAGEMAKER_REGION || process.env.AWS_REGION || 'us-east-1';

// ---- Privacy gateway --------------------------------------------------------
// Strip secrets, tokens, and PII before anything reaches the model.
// Technique: Dark-Moon (technique only, no code copied).

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,                    // OpenAI-style keys
  /ghp_[a-zA-Z0-9]{20,}/g,                   // GitHub tokens
  /xox[baprs]-[a-zA-Z0-9-]+/g,               // Slack tokens
  /AKIA[0-9A-Z]{16}/g,                       // AWS access keys
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
  /bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,        // Bearer tokens
  /password\s*[:=]\s*\S+/gi,                 // password assignments
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // emails
];

export function sanitizeForModel(text) {
  let out = String(text || '');
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, '[REDACTED]');
  }
  return out;
}

function getBedrockConfig() {
  // AWS is connected BY DEFAULT via environment variables (owner's account).
  // No per-user plugin setup needed — invite-only, owner controls the keys.
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return null;
  return {
    region: DEFAULT_REGION,
    credentials: { accessKeyId, secretAccessKey },
    model: DEFAULT_MODEL,
  };
}

/** True when the configured AI backend is available for chat. */
export function aiAvailable() {
  if (PROVIDER === 'ollama') return true; // endpoint is probed on first real call
  if (PROVIDER === 'openrouter') return !!process.env.OPENROUTER_API_KEY;
  if (PROVIDER === 'kaggle') return !!process.env.KAGGLE_GRADIO_URL;
  return getBedrockConfig() !== null;
}

// The heartbeat path: AI_HEARTBEAT_PATH wins; otherwise the
// config-derived default (checkout root + '.ai-inference-active').
// Read at call time (not module load) so tests can point it at a temp
// file. The heartbeat is GLOBAL — one shared model, one file, read by
// the ollama-watchdog too — so the default is app-root-derived, never
// hunt-scoped and never a hardcoded install path.
export function getInferenceHeartbeatPath() {
  return process.env.AI_HEARTBEAT_PATH || config.aiHeartbeatPath;
}

// CHAT-ANSWERS (26 Oct 2026): is an inference running RIGHT NOW?
// chatWithOllama writes a heartbeat file carrying a deadline while a
// generation runs and deletes it when done (the same file the
// ollama-watchdog reads, so the watchdog never kills a healthy busy
// server). A fresh heartbeat means the one shared 8B is occupied —
// a chat question sent now would queue 10–25 min behind the running
// hunt turn and die at the deadline. Callers answer from the live
// record instead. Best-effort and side-effect-free: a missing,
// unreadable, or stale file means "not busy". The env var is read at
// call time (not module load) so tests can point it at a temp file.
export function isInferenceActive() {
  try {
    const p = getInferenceHeartbeatPath();
    const hb = JSON.parse(fs.readFileSync(p, 'utf8'));
    return typeof hb.deadline === 'number' && hb.deadline > Date.now();
  } catch {
    return false;
  }
}

async function chatWithBedrock(messages, system, ctx) {
  const cfg = getBedrockConfig();
  if (!cfg) return null;
  const client = new BedrockRuntimeClient({
    region: cfg.region,
    credentials: cfg.credentials,
  });
  // Privacy gateway (Dark-Moon technique): strip secrets/PII before the model.
  const clean = (t) => sanitizeForModel(String(t || ''));
  const cmd = new ConverseCommand({
    modelId: cfg.model,
    system: system ? [{ text: clean(system) }] : undefined,
    messages: (messages || []).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: [{ text: clean(m.text).slice(0, 8000) }],
    })),
    inferenceConfig: { maxTokens: 1500, temperature: 0.7 },
  });
  const out = await client.send(cmd);
  // Burn tracking: every token has a price.
  try {
    const usage = out.usage || {};
    if (usage.inputTokens || usage.outputTokens) {
      recordCost({
        userId: ctx && ctx.userId,
        huntId: ctx && ctx.huntId,
        kind: 'bedrock',
        model: cfg.model,
        inputTokens: usage.inputTokens || 0,
        outputTokens: usage.outputTokens || 0,
      });
    }
  } catch (e) { try { console.warn('[cost] recordCost failed:', (e && e.message) || e); } catch {} /* cost tracking must never break chat */ }
  const blocks = (out.output && out.output.message && out.output.message.content) || [];
  return blocks.map((b) => b.text || '').join('').trim() || null;
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
async function chatWithOllama(messages, system, ctx, opts = {}) {
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
      console.error(`[llm] ollama call hunt=${huntId} advisory=${advisory} outcome=${outcome} duration_ms=${Date.now() - callStart}`);
    } catch { /* logging never breaks the call */ }
  }
}

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
  const ollamaChatOnce = (deadlineMs) => new Promise((resolve, reject) => {
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
        result = await ollamaChatOnce(attemptMs);
      } catch (err) {
        console.error(`[llm] advisory call failed fast at ${OLLAMA_URL}: ${err.message} — skipping advice`);
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
      result = await ollamaChatOnce(hbTimeoutMs);
    } catch (err) {
      console.error(`[llm] Ollama attempt 1 failed at ${OLLAMA_URL}: ${err.message}`);
      if (isOllamaConnectionError(err)) {
        // The server is (re)starting — wait for it to answer again
        // before the retry (readiness note above). An immediate
        // retry here is the old bug: ECONNREFUSED while the model
        // reloads, then null, then a no-reply turn.
        console.error('[llm] Ollama connection failed — waiting for the server to come back before retrying');
        const ready = await waitForOllamaReady();
        if (!ready) {
          console.error('[llm] Ollama never came back within the readiness wait');
          return null;
        }
        writeHeartbeat(); // extend the deadline across the wait
      }
      // One retry — transient stalls are common on 2vCPU.
      try {
        result = await ollamaChatOnce(hbTimeoutMs);
      } catch (err2) {
        console.error(`[llm] Ollama unreachable at ${OLLAMA_URL} after retry: ${err2.message}`);
        return null;
      }
    }
    if (!result.ok) {
      console.error(`[llm] Ollama HTTP ${result.status} for model ${OLLAMA_MODEL}: ${result.body || ''}`);
      // RETRY ON 5xx (19 Oct 2026): HTTP 500 "unexpected EOF" is transient —
      // it fires while the model is (re)loading after a watchdog kill or an
      // OOM crash. The old fixed 15s wait assumed the watchdog's ~15-30s
      // reload; an OOM reload takes ~176s, so the wait is now the same
      // readiness poll as the connection-failure path — it returns as
      // soon as the server answers (fast for a quick reload) and waits
      // out a slow one, bounded.
      if (result.status >= 500) {
        console.error('[llm] Ollama 5xx — waiting for the server to be ready again, then one retry');
        const ready = await waitForOllamaReady();
        if (!ready) {
          console.error('[llm] Ollama never came back after 5xx');
          return null;
        }
        writeHeartbeat(); // extend the deadline across the wait
        try {
          result = await ollamaChatOnce(hbTimeoutMs);
        } catch (err3) {
          console.error(`[llm] Ollama retry after 5xx failed: ${err3.message}`);
          return null;
        }
        if (!result.ok) {
          console.error(`[llm] Ollama still HTTP ${result.status} after 5xx retry: ${result.body || ''}`);
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
  // Self-hosted = $0 marginal cost; still ledger the burn event for the UI.
  try {
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
  } catch (e) { try { console.warn('[cost] recordCost failed:', (e && e.message) || e); } catch {} /* cost tracking must never break chat */ }
  return text || null;
}

/**
 * Chat with the real AI.
 * @param {Array<{role:'user'|'assistant', text:string}>} messages
 * @param {string} system — system prompt (hunt context goes here)
 * @param {{userId?: string, huntId?: string}} ctx — for cost tracking
 * @returns {Promise<string|null>} reply text, or null if no AI is configured.
 */
/**
 * OpenRouter — OpenAI-compatible API for fast GPU inference.
 * Uses free-tier uncensored models by default ($0). Set OPENROUTER_MODEL
 * to override. API key from OPENROUTER_API_KEY env.
 */
async function chatWithOpenRouter(messages, system, ctx) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('[llm] OpenRouter API key not configured (OPENROUTER_API_KEY)');
    return null;
  }
  const model = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
  const clean = (t) => sanitizeForModel(String(t || ''));
  const orMessages = [];
  if (system) orMessages.push({ role: 'system', content: clean(system).slice(0, 8000) });
  for (const m of messages || []) {
    orMessages.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: clean(m.text).slice(0, 8000),
    });
  }
  try {
    console.log('[llm] OpenRouter calling model:', model);
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://hack.thebhavesh.online',
        'X-Title': 'Dark Matter Hunt AI',
      },
      body: JSON.stringify({
        model,
        messages: orMessages,
        max_tokens: 600,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (res.status === 429) {
      // Rate limited — wait and retry once
      const retryAfter = parseInt(res.headers.get('retry-after') || '5', 10);
      console.log(`[llm] OpenRouter rate limited, waiting ${retryAfter}s...`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      // Retry once
      const retryRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://hack.thebhavesh.online',
          'X-Title': 'Dark Matter Hunt AI',
        },
        body: JSON.stringify({
          model,
          messages: orMessages,
          max_tokens: 600,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(120000),
      });
      if (!retryRes.ok) {
        console.error(`[llm] OpenRouter retry HTTP ${retryRes.status}`);
        return null;
      }
      const retryData = await retryRes.json();
      const retryText = retryData.choices && retryData.choices[0] && retryData.choices[0].message
        ? retryData.choices[0].message.content : null;
      return (retryText || '').trim() || null;
    }
    if (!res.ok) {
      console.error(`[llm] OpenRouter HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const text = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content : null;
    return (text || '').trim() || null;
  } catch (err) {
    console.error('[llm] OpenRouter error:', err.message);
    return null;
  }
}

export async function chatWithAI(messages, system, ctx, opts = {}) {
  // Per-hunt provider override (1 Nov 2026): allows a hunt to use a specific
  // API provider without changing the global LLM_PROVIDER env var.
  // Used by brainProvider.callBrain for OpenRouter-selected hunts.
  const provider = (opts.providerOverride || PROVIDER).toLowerCase();
  if (provider === 'ollama') return chatWithOllama(messages, system, ctx, opts);
  if (provider === 'sagemaker') return chatWithSageMaker(messages, system, ctx);
  if (provider === 'openrouter') return chatWithOpenRouter(messages, system, ctx);
  if (provider === 'kaggle') return chatWithKaggle(messages, system, ctx);
  return chatWithBedrock(messages, system, ctx);
}

/**
 * Kaggle GPU — Gradio interface to uncensored Dolphin model on free Kaggle GPU.
 * Set KAGGLE_GRADIO_URL to the public Gradio share URL (e.g. https://xxx.gradio.live).
 * No rate limits, no censorship, $0.
 */
async function chatWithKaggle(messages, system, ctx) {
  const baseUrl = (process.env.KAGGLE_GRADIO_URL || '').replace(/\/$/, '');
  if (!baseUrl) {
    console.error('[llm] Kaggle Gradio URL not configured (KAGGLE_GRADIO_URL)');
    return null;
  }
  const clean = (t) => sanitizeForModel(String(t || ''));
  const gradioMessages = (messages || []).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: clean(m.text).slice(0, 8000),
  }));
  try {
    const res = await fetch(`${baseUrl}/gradio_api/call/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [gradioMessages, clean(system || '').slice(0, 8000)] }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      console.error(`[llm] Kaggle submit HTTP ${res.status}`);
      return null;
    }
    const { event_id } = await res.json();
    // Poll the event stream for the result (Gradio 4/5 SSE format)
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const r2 = await fetch(`${baseUrl}/gradio_api/call/chat/${event_id}`, {
        signal: AbortSignal.timeout(30000),
      });
      if (!r2.ok) continue;
      const text = await r2.text();
      // Look for: event: complete\ndata: ["..."]
      const m = text.match(/data:\s*(\[.*\])/s);
      if (m) {
        try {
          const arr = JSON.parse(m[1]);
          if (arr && arr[0]) return String(arr[0]).slice(0, 8000).trim() || null;
        } catch { /* keep polling */ }
      }
      if (/event:\s*complete/.test(text) && !m) return null;
    }
    console.error('[llm] Kaggle poll timed out');
    return null;
  } catch (err) {
    console.error('[llm] Kaggle error:', err.message);
    return null;
  }
}

/**
 * SageMaker async inference — for 32B+ models that don't fit on EC2.
 * Uses async inference (scales to zero, pay-per-use).
 * 
 * Flow:
 * 1. InvokeEndpointAsync → returns output S3 location
 * 2. Poll GetAsyncInferenceResult until complete
 * 3. Parse response
 */
async function chatWithSageMaker(messages, system, ctx) {
  if (!SAGEMAKER_ENDPOINT) {
    console.error('[llm] SageMaker endpoint not configured (SAGEMAKER_ENDPOINT_NAME)');
    return null;
  }

  // Lazy-load SageMaker SDK (may not export async APIs in all versions)
  let SageMakerRuntimeClient, InvokeEndpointCommand;
  try {
    const pkg = await import('@aws-sdk/client-sagemaker-runtime');
    // Handle both ESM named exports and CJS default export
    const mod = pkg.default || pkg;
    SageMakerRuntimeClient = mod.SageMakerRuntimeClient || pkg.SageMakerRuntimeClient;
    InvokeEndpointCommand = mod.InvokeEndpointCommand || pkg.InvokeEndpointCommand;
    if (!SageMakerRuntimeClient || !InvokeEndpointCommand) {
      throw new Error('SageMaker SDK exports not found');
    }
  } catch (err) {
    console.error('[llm] SageMaker SDK load failed:', err.message);
    return null;
  }

  const clean = (t) => sanitizeForModel(String(t || ''));
  
  // Build prompt in ChatML format for Qwen models
  let prompt = '';
  if (system) prompt += `<|im_start|>system\n${clean(system).slice(0, 8000)}<|im_end|>\n`;
  for (const m of messages || []) {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    prompt += `<|im_start|>${role}\n${clean(m.text).slice(0, 8000)}<|im_end|>\n`;
  }
  prompt += '<|im_start|>assistant\n';

  const client = new SageMakerRuntimeClient({
    region: SAGEMAKER_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });

  try {
    const payload = JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 600,
        temperature: 0.7,
        top_p: 0.9,
        do_sample: true,
      },
    });

    // Use InvokeEndpoint (sync) — simpler and works with standard endpoints
    const syncCmd = new InvokeEndpointCommand({
      EndpointName: SAGEMAKER_ENDPOINT,
      ContentType: 'application/json',
      Body: Buffer.from(payload),
    });

    const response = await client.send(syncCmd);
    const responseBody = await response.Body.transformToString();
    const data = JSON.parse(responseBody);
    
    // HuggingFace TGI format: [{generated_text: "..."}] or {generated_text: "..."}
    let text = '';
    if (Array.isArray(data) && data[0]?.generated_text) {
      text = data[0].generated_text;
    } else if (data.generated_text) {
      text = data.generated_text;
    } else if (typeof data === 'string') {
      text = data;
    }

    text = text.trim();
    if (!text) return null;

    // Record cost (SageMaker 32B ~$0.50/hour pro-rated per request)
    try {
      recordCost({
        userId: ctx && ctx.userId,
        huntId: ctx && ctx.huntId,
        kind: 'sagemaker',
        model: SAGEMAKER_ENDPOINT,
        inputTokens: 0, // Async doesn't return token counts reliably
        outputTokens: 0,
        amountUsd: 0.01, // Estimated per-request cost
        note: 'sagemaker-async',
      });
    } catch (e) { try { console.warn('[cost] recordCost failed:', (e && e.message) || e); } catch {} /* cost tracking must never break chat */ }

    return text;
  } catch (err) {
    console.error(`[llm] SageMaker failed: ${err.message}`);
    return null;
  }
}
