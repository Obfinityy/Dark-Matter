/**
 * Active DNS brute-force — label wordlist × target hostname resolved through
 * dnsx when available, with a pure-Node DNS fallback when the binary is missing.
 *
 * Graceful degradation (verified by tests):
 *   1. dnsx binary present      → fast bulk resolution (dnsx -silent -json)
 *   2. dnsx missing             → node:dns resolve4/resolveCname per candidate (slower, still real)
 *   3. dns unavailable entirely → returns { degraded: 'no_dns' } so the hunt continues
 *
 * NEVER touches external DNS beyond the candidate names the hunt authorized —
 * every candidate is derived from the in-scope target hostname.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dns from 'node:dns/promises';
import { execFile } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_WORDLIST_PATH = path.resolve(__dirname, '../../data/subdomains-top500.txt');

const _wordlistCache = new Map();

/** Load the wordlist (cached). Returns array of labels. */
export async function loadWordlist(wordlistPath = DEFAULT_WORDLIST_PATH) {
  if (_wordlistCache.has(wordlistPath)) return _wordlistCache.get(wordlistPath);
  const text = await fs.readFile(wordlistPath, 'utf8');
  const labels = text.split('\n').map((l) => l.trim().toLowerCase())
    .filter((l) => l && !l.startsWith('#') && /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(l));
  _wordlistCache.set(wordlistPath, labels);
  return labels;
}

/** Build candidate FQDNs for a hostname. Respects `max` to bound cost. */
export async function buildBruteCandidates(hostname, { wordlistPath = DEFAULT_WORDLIST_PATH, max = 500 } = {}) {
  const host = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
  if (!host || host.includes(' ') || host.includes('/')) {
    throw new Error(`Invalid hostname for DNS brute-force: ${hostname}`);
  }
  const labels = await loadWordlist(wordlistPath);
  return labels.slice(0, max).map((label) => `${label}.${host}`);
}

/** Parse dnsx JSONL output into normalized records. */
export function parseDnsxJsonLines(raw) {
  if (!raw) return { records: [], count: 0 };
  const records = [];
  for (const line of String(raw).split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t);
      if (!obj.host) continue;
      records.push({
        host: String(obj.host).toLowerCase(),
        a: obj.a || [],
        aaaa: obj.aaaa || [],
        cname: obj.cname || [],
        mx: obj.mx || [],
        ns: obj.ns || [],
        statusCode: obj.status_code ?? null
      });
    } catch { /* skip malformed lines */ }
  }
  return { records, count: records.length };
}

/** Check whether the dnsx binary is on PATH. */
export function dnsxAvailable() {
  return new Promise((resolve) => {
    execFile('dnsx', ['-version'], { timeout: 5000 }, (err) => resolve(!err));
  });
}

/** Resolve candidates with dnsx (binary path). */
async function resolveWithDnsx(candidates, { timeoutMs = 90_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      'dnsx',
      ['-silent', '-json', '-a', '-aaaa', '-cname', '-r', 'all', '-retry', '2'],
      { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => {
        if (err && err.killed) return reject(new Error('dnsx timed out'));
        if (err && !stdout) return reject(new Error(`dnsx failed: ${err.message}`));
        resolve(parseDnsxJsonLines(stdout));
      }
    );
    child.stdin.write(candidates.join('\n'));
    child.stdin.end();
  });
}

/** Pure-Node fallback: resolve4 + resolveCname per candidate, bounded concurrency. */
export async function resolveWithNodeDns(candidates, { concurrency = 20, timeoutMs = 8000 } = {}) {
  const records = [];
  const queue = [...candidates];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const host = queue.shift();
      try {
        const [a, cname] = await Promise.all([
          dns.resolve4(host, { ttl: false }).catch(() => []),
          dns.resolveCname(host).catch(() => [])
        ]);
        if ((a && a.length) || (cname && cname.length)) {
          records.push({ host, a: a || [], aaaa: [], cname: cname || [], mx: [], ns: [], statusCode: null, via: 'node-dns' });
        }
      } catch { /* NXDOMAIN etc. — not a hit */ }
    }
  });
  // Give each worker its own overall deadline.
  await Promise.race([
    Promise.all(workers),
    new Promise((_, rej) => setTimeout(() => rej(new Error('node DNS brute-force timed out')), timeoutMs * Math.ceil(candidates.length / concurrency) + timeoutMs))
  ]).catch((e) => { if (!/timed out/.test(e.message)) throw e; });
  return { records, count: records.length, via: 'node-dns' };
}

/**
 * Run the brute stage. `availability` lets tests force each degradation tier
 * without needing the real binary:
 *   { dnsx: true } → dnsx path; { dnsx: false } → node-dns path.
 */
export async function runDnsBrute(hostname, {
  wordlistPath = DEFAULT_WORDLIST_PATH,
  max = 500,
  availability = null,
  onProgress = null
} = {}) {
  const candidates = await buildBruteCandidates(hostname, { wordlistPath, max });
  if (onProgress) onProgress({ stage: 'candidates_built', count: candidates.length });

  const hasDnsx = availability?.dnsx ?? await dnsxAvailable();
  if (hasDnsx) {
    try {
      const parsed = await resolveWithDnsx(candidates);
      return { ...parsed, candidates: candidates.length, method: 'dnsx', degraded: false };
    } catch (error) {
      // dnsx broke mid-run: fall THROUGH to node DNS rather than dying.
      if (onProgress) onProgress({ stage: 'dnsx_failed_falling_back', error: error.message });
    }
  }

  try {
    const parsed = await resolveWithNodeDns(candidates);
    return { ...parsed, candidates: candidates.length, method: 'node-dns', degraded: !hasDnsx };
  } catch (error) {
    return {
      records: [], count: 0, candidates: candidates.length,
      method: 'none', degraded: 'no_dns', error: error.message
    };
  }
}
