/**
 * engineFeed.js — the passive recon feed for the hunt planner.
 *
 * The repository ships 282 pure-function engines under backend/src/engines/.
 * This module consumes them as the planner's recon feed: engines are
 * IMPORTED here (never copied), discovered dynamically, and invoked with
 * structured arguments by the task tree. Engine failures are isolated —
 * one bad engine never breaks the feed.
 *
 * Two access patterns:
 *   1. runEngineTask('eliteRecon', 'fingerprintTech', args) — call a specific
 *      engine function by module + export name.
 *   2. runReconSweep(input, { maxEngines }) — best-effort sweep over the
 *      curated passive recon engines listed below.
 *
 * Everything here is passive/analytical (parsing, scoring, classification).
 * No engine in this feed sends exploit payloads.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ENGINES_DIR = path.resolve(here, '..', 'engines');

const moduleCache = new Map();

/** Dynamically import one engine module (cached). */
export async function loadEngineModule(name) {
  if (moduleCache.has(name)) return moduleCache.get(name);
  const file = path.join(ENGINES_DIR, `${name}.js`);
  await fs.access(file); // throws a clear error for unknown engines
  const mod = await import(pathToFileURL(file).href);
  moduleCache.set(name, mod);
  return mod;
}

/** List all engine module names available on disk. */
export async function listEngines() {
  const files = await fs.readdir(ENGINES_DIR);
  return files.filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3)).sort();
}

/**
 * Call a single engine function.
 *
 * @param {string} moduleName — e.g. 'eliteRecon'
 * @param {string} fnName — exported function name, e.g. 'fingerprintTech'
 * @param {*} args — structured arguments for the engine
 * @returns {{ ok: true, result } | { ok: false, error }}
 */
export async function runEngineTask(moduleName, fnName, args) {
  try {
    const mod = await loadEngineModule(moduleName);
    const fn = mod[fnName] ?? mod.default?.[fnName];
    if (typeof fn !== 'function') {
      return { ok: false, error: `Engine ${moduleName} has no export "${fnName}"` };
    }
    // Engine functions have heterogeneous arities; an array means "spread".
    const result = Array.isArray(args) ? await fn(...args) : await fn(args);
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

/**
 * Curated passive recon engines, grouped by what they consume.
 * Each entry: [module, fn, argsBuilder(input) -> args].
 * The sweep feeds them whatever input the hunt has gathered so far and
 * collects structured results into task evidence.
 */
const RECON_SWEEP = [
  // Host/domain level
  ['eliteRecon', 'subdomainCandidates', (i) => [i.domain, i.extraSubdomains || []]],
  // HTTP response level
  ['eliteRecon', 'fingerprintTech', (i) => [i.httpResponse || {}]],
  ['eliteRecon', 'scoreEndpoint', (i) => [i.path || '/', i.statusCode || 0, i.contentLength || 0]],
  ['secretScanner', 'scanForSecrets', (i) => [i.bodyText || '']],
  ['secretScanner', 'extractJsUrls', (i) => [i.bodyText || '', i.url || '']],
  ['jwtAnalyzer', 'extractJWTs', (i) => [i.bodyText || '']],
  ['vulnDetector', 'scanResponse', (i) => [{ url: i.url || '', body: i.bodyText || '', headers: i.headers || {} }, {}]],
  ['vulnDetector', 'detectSSRFParams', (i) => [i.url || '']],
  ['vulnDetector', 'detectIDORParams', (i) => [i.url || '']],
  ['corsChecker', 'checkCORS', (i) => [{ url: i.url || '', headers: i.headers || {} }]],
  ['paramMiner', 'mineParams', (i) => [i.url || '']],
  ['takeoverChecker', 'checkTakeover', (i) => [{
    subdomain: i.host || '', cname: i.cname || '', httpBody: i.bodyText || '', httpStatus: i.statusCode || 0,
  }]],
];

/**
 * Best-effort passive sweep over the curated recon engines.
 *
 * @param {object} input — { domain, host, url, httpResponse, headers, bodyText, statusCode, contentLength, cname, path, extraSubdomains }
 * @param {object} opts — { maxEngines, timeoutMs, logger }
 * @returns {Promise<Array<{ engine, fn, ok, result?, error? }>>}
 */
export async function runReconSweep(input = {}, opts = {}) {
  const { maxEngines = RECON_SWEEP.length, timeoutMs = 15_000, logger = null } = opts;
  const results = [];
  for (const [mod, fn, buildArgs] of RECON_SWEEP.slice(0, maxEngines)) {
    let args;
    try {
      args = buildArgs(input);
    } catch (error) {
      results.push({ engine: mod, fn, ok: false, error: `arg build failed: ${error.message}` });
      continue;
    }
    const call = Array.isArray(args)
      ? (async () => {
        const m = await loadEngineModule(mod);
        const f = m[fn] ?? m.default?.[fn];
        if (typeof f !== 'function') throw new Error(`no export "${fn}"`);
        return f(...args);
      })()
      : runEngineTask(mod, fn, args).then((r) => {
        if (!r.ok) throw new Error(r.error);
        return r.result;
      });
    try {
      const result = await withTimeout(call, timeoutMs);
      results.push({ engine: mod, fn, ok: true, result: truncateResult(result) });
    } catch (error) {
      logger?.warn?.(`[engineFeed] ${mod}.${fn} failed: ${error.message}`);
      results.push({ engine: mod, fn, ok: false, error: error.message });
    }
  }
  return results;
}

/** Post-hunt analysis helpers the planner uses on the accumulated findings. */
export async function analyzeFindings(findings = []) {
  const out = {};
  const rb = await runEngineTask('riskScorer', 'prioritize', findings);
  if (rb.ok) out.prioritized = rb.result;
  const chains = await runEngineTask('chainBuilder', 'findChains', findings);
  if (chains.ok) out.chains = chains.result;
  const fp = await runEngineTask('fpFilter', 'filterBatch', findings);
  if (fp.ok) out.filtered = fp.result;
  return out;
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`engine timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Keep persisted evidence small: cap strings/arrays in engine results. */
function truncateResult(value, depth = 0) {
  if (depth > 3) return '[truncated]';
  if (typeof value === 'string') return value.length > 2000 ? `${value.slice(0, 2000)}…[truncated]` : value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => truncateResult(v, depth + 1));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value).slice(0, 40)) out[k] = truncateResult(v, depth + 1);
    return out;
  }
  return value;
}
