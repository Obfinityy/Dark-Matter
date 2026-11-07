// Dark Matter rule-based scanner — secrets in client-side code
// (coverage row #179 [High] Secrets in Client-Side Code, phase 69).
//
// DIAGNOSIS: SPAs and modern pages ship their configuration in the
// same-origin JS bundles the browser executes — API keys, tokens and
// credentials that were meant for the server end up as string
// literals in main.js, readable by anyone who fetches the bundle.
// Juice Shop's own main.js (458,398 bytes live, mined by the
// js-api-routes phase) is the shape of the target: the bundle is
// already fetched once per scan, so scanning it costs one more pass
// over bytes already on disk.
//
// VERIFICATION (100% truth rule): a finding fires ONLY on a
// known-format secret, never on a suggestive name alone:
//   * Format-known patterns — AWS access keys (AKIA + 16), GitHub
//     tokens (ghp_/gho_/ghu_/ghs_/ghr_ + 36, github_pat_ + 22),
//     Slack tokens (xox[baprs]-), Google API keys (AIza + 35),
//     Stripe live secret keys (sk_/rk_live_ + 16), Twilio API keys
//     (SK + 32 hex), PEM private-key headers, JWTs (eyJ.eyJ. triple,
//     quoted literal only — an unquoted base64 run is not a token),
//     DB connection strings carrying a password (scheme://user:pass@).
//   * Generic assignments — a key named api-key / secret / token /
//     password (etc.) assigned a quoted value of length >= 16 with
//     Shannon entropy >= 3.5 bits/char. The entropy gate kills
//     "testtesttesttest" (1.58) and repeated filler; the length gate
//     kills short placeholders.
//   * Placeholder exclusion — every candidate is rejected when its
//     value contains test / example / dummy / sample / placeholder /
//     your-key / changeme / xxx / abcdef / 123456 / qwerty (and
//     kin): the AWS docs example key AKIAIOSFODNN7EXAMPLE dies here.
// A bare key NAME with no value, a short value, a low-entropy value
// or a placeholder is NEVER a finding. The same secret value in two
// bundles is one finding (dedup on type + value hash) — the first
// bundle seen is cited.
//
// EVIDENCE / SECRECY: a leaked secret IS the finding, but the full
// value must never land in events or logs — the evidence carries the
// pattern type, the bundle URL, the line number and a REDACTED
// match (first 4 chars + '…' + last 4 chars), plus a redacted
// snippet. A DB URI redacts only the password component. A PEM
// header line carries no key material and is shown verbatim.
//
// SAFETY: read-only GETs of the page's own same-origin script
// bundles (cap 5, the jsRoutes cap) plus the page's inline <script>
// blocks (cap 10) — no writes, no allowWrite gate, same-origin
// only. Bundles are fetched with fingerprint.fetchPage (opts.fetchPage
// is the test seam, mirroring jsRoutesFetcher).
import { createHash } from 'node:crypto';
import { fetchPage } from '../fingerprint.js';
import { extractScriptSrcs, JS_ROUTES_MAX_BUNDLES } from '../jsRoutes.js';

const MAX_BUNDLES = JS_ROUTES_MAX_BUNDLES; // 5, same cap as jsRoutes
const MAX_INLINE = 10;
const MAX_FINDINGS = 20;
const MAX_FINDINGS_PER_SOURCE = 10;
const MIN_GENERIC_LEN = 16;
const MIN_GENERIC_ENTROPY = 3.5;
const SNIPPET_RADIUS = 80;

// Placeholder / example markers — any candidate value containing one
// (case-insensitive) is a doc example or a test fixture, never a
// leaked secret.
const PLACEHOLDER_RE =
  /(test|example|dummy|sample|placeholder|your[-_]?key|changeme|todo|fake|mock|demo|xxx+|lorem|abcdef|123456|qwerty|000000|111111)/i;

function sha12(text) {
  return createHash('sha256').update(String(text || '')).digest('hex').slice(0, 12);
}

function shannonEntropy(s) {
  const freq = new Map();
  for (const ch of s) freq.set(ch, (freq.get(ch) || 0) + 1);
  let h = 0;
  for (const n of freq.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

function isPlaceholder(value) {
  return PLACEHOLDER_RE.test(String(value || ''));
}

// First 4 chars + '…' + last 4 chars — enough to prove the format,
// never enough to use the secret. Short values redact fully.
export function redactSecret(value) {
  const v = String(value || '');
  if (v.length <= 8) return '…(redacted)';
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

// Redact only the password component of a DB connection URI.
function redactDbUri(uri) {
  return String(uri || '').replace(/:\/\/([^:/?#]+):[^@/?#]+@/, '://$1:…@');
}

// Pattern table. `re` is the source (a fresh RegExp is built per
// scan — global regexes carry lastIndex state). `group` is the
// capture group holding the secret value (0 = whole match).
// `gate` is an extra per-candidate check (value) => boolean.
// `redact` overrides the default redactSecret for the evidence.
const PATTERNS = [
  {
    type: 'aws-access-key',
    label: 'AWS access key ID',
    re: '\\bAKIA[0-9A-Z]{16}\\b',
    flags: 'g',
    group: 0,
  },
  {
    type: 'github-token',
    label: 'GitHub token',
    re: '\\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\\b',
    flags: 'g',
    group: 0,
  },
  {
    type: 'github-token',
    label: 'GitHub fine-grained token',
    re: '\\bgithub_pat_[A-Za-z0-9_]{22,}\\b',
    flags: 'g',
    group: 0,
  },
  {
    type: 'slack-token',
    label: 'Slack token',
    re: '\\bxox[baprs]-[A-Za-z0-9-]{10,}\\b',
    flags: 'g',
    group: 0,
  },
  {
    type: 'google-api-key',
    label: 'Google API key',
    re: '\\bAIza[0-9A-Za-z_-]{35}\\b',
    flags: 'g',
    group: 0,
  },
  {
    type: 'stripe-secret-key',
    label: 'Stripe live secret key',
    re: '\\b(?:sk|rk)_live_[0-9a-zA-Z]{16,}\\b',
    flags: 'g',
    group: 0,
  },
  {
    type: 'twilio-api-key',
    label: 'Twilio API key',
    re: '\\bSK[0-9a-f]{32}\\b',
    flags: 'g',
    group: 0,
  },
  {
    type: 'private-key',
    label: 'Private key block',
    re: '-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----',
    flags: 'g',
    group: 0,
    // The header line carries no key material — shown verbatim.
    redact: (v) => `${v} …(key material redacted)`,
    // The snippet must never carry the key block that follows the
    // header: show the redacted header only.
    snippet: (_v, redacted) => redacted,
  },
  {
    type: 'jwt',
    label: 'JSON Web Token',
    // Quoted literal only: an unquoted eyJ.eyJ. run inside a longer
    // base64 blob is not a token. JWTs in JS are string literals.
    re: '["\'`](eyJ[A-Za-z0-9_-]+\\.eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+)["\'`]',
    flags: 'g',
    group: 1,
  },
  {
    type: 'db-connection-string',
    label: 'Database connection string with password',
    re: '\\b(?:mongodb(?:\\+srv)?|mysql|postgres(?:ql)?|redis|amqp):\\/\\/[^\\s"\'`]+:[^\\s"\'`@]+@[^\\s"\'`]+',
    flags: 'g',
    group: 0,
    gate: (uri) => {
      const m = /:\/\/[^:/?#]+:([^@/?#]+)@/.exec(uri);
      return !!m && m[1].length >= 4 && !isPlaceholder(m[1]);
    },
    redact: redactDbUri,
  },
  {
    type: 'generic-secret',
    label: 'Hardcoded secret assignment',
    // A key named api-key / secret / token / password assigned a
    // quoted value — the value gates (length + entropy + placeholder)
    // do the verification; the name alone never fires.
    re: '(?:api[_-]?key|api[_-]?secret|secret[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd|pwd)\\s*[:=]\\s*["\'`]([A-Za-z0-9_\\-+/=]{16,})["\'`]',
    flags: 'gi',
    group: 1,
    gate: (v) => v.length >= MIN_GENERIC_LEN && shannonEntropy(v) >= MIN_GENERIC_ENTROPY,
  },
];

/**
 * Extract the scan targets from a page's HTML: same-origin <script
 * src> bundle URLs (cap 5, via jsRoutes.extractScriptSrcs) plus the
 * page's inline <script> bodies (cap 10). Pure — exported for unit
 * tests and for runScan's skip decision. A page with no scripts
 * yields { bundles: [], inline: [] }.
 */
export function extractSecretTargets(html, baseUrl) {
  const bundles = extractScriptSrcs(html, baseUrl);
  const inline = [];
  const src = typeof html === 'string' ? html : '';
  // Inline only: the negative lookahead excludes tags carrying a
  // src attribute ([\s"'] before src so data-src does not match).
  const inlineRe = /<script(?![^>]*[\s"']src\s*=)[^>]*>([\s\S]*?)<\/script\s*>/gi;
  for (const m of src.matchAll(inlineRe)) {
    const body = (m[1] || '').trim();
    if (body) inline.push(body);
    if (inline.length >= MAX_INLINE) break;
  }
  return { bundles, inline };
}

// Line number (1-based) of an offset in a body.
function lineOf(body, offset) {
  let n = 1;
  for (let i = 0; i < offset && i < body.length; i += 1) {
    if (body[i] === '\n') n += 1;
  }
  return n;
}

// A redacted snippet around the match — newlines flattened, the
// secret value replaced by its redacted form.
function snippetAround(body, matchIndex, value, redacted) {
  const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
  const end = Math.min(body.length, matchIndex + value.length + SNIPPET_RADIUS);
  let snip = body.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snip = `…${snip}`;
  if (end < body.length) snip = `${snip}…`;
  const at = snip.indexOf(value);
  if (at >= 0) snip = snip.slice(0, at) + redacted + snip.slice(at + value.length);
  return snip.slice(0, 400);
}

// Scan one source body (a bundle or an inline block) and push
// findings. `sourceUrl` is the URL the finding is filed under;
// `sourceLabel` names the source in the evidence. Dedup is on
// type + value hash across the whole probe run.
function scanBody(body, sourceUrl, sourceLabel, findings, seen) {
  const text = typeof body === 'string' ? body : '';
  if (!text) return;
  let perSource = 0;
  for (const p of PATTERNS) {
    const re = new RegExp(p.re, p.flags);
    let m;
    while ((m = re.exec(text)) !== null) {
      const value = p.group ? m[p.group] || '' : m[0];
      if (!value) continue;
      // The value's offset inside the whole match (group 1 patterns
      // carry a leading quote in match[0]).
      const valueOffset = m.index + m[0].indexOf(value);
      if (isPlaceholder(value)) continue;
      if (typeof p.gate === 'function' && !p.gate(value)) continue;
      const key = `${p.type}|${sha12(value)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const redacted = typeof p.redact === 'function' ? p.redact(value) : redactSecret(value);
      const line = lineOf(text, valueOffset);
      findings.push({
        class: 'secret_in_js',
        id: `secret-in-js-${p.type}-${sha12(value)}`,
        title: `Secret in client-side code — ${p.label} exposed in ${sourceLabel}`,
        severity: 'high',
        url: sourceUrl,
        parameter: p.label,
        evidence: {
          request:
            sourceLabel.startsWith('inline')
              ? `inline <script> block on ${sourceUrl} (page body already fetched)`
              : `GET ${sourceUrl} (same-origin script bundle)`,
          response:
            `${p.label} found at line ${line} in ${sourceLabel}; ` +
            `match redacted ${redacted}; snippet: ${
              typeof p.snippet === 'function'
                ? p.snippet(value, redacted)
                : snippetAround(text, valueOffset, value, redacted)
            }`,
          impact_demo:
            'Leaked-credential primitive — a secret shipped to every visitor in client-side code can be harvested without any authentication and used directly against the service that issued it; rotate the secret and move it server-side.',
          signalCorrelated: true,
        },
      });
      perSource += 1;
      if (perSource >= MAX_FINDINGS_PER_SOURCE || findings.length >= MAX_FINDINGS) return;
    }
    if (findings.length >= MAX_FINDINGS) return;
  }
}

/**
 * Probe secrets in client-side JS (#179).
 * @param {string} pageUrl — the pasted page URL (findings on inline
 *   scripts are filed under it).
 * @param {object} targets — { bundles: [urls], inline: [bodies] }
 *   from extractSecretTargets (runScan computes it from the page
 *   body so a script-less page skips instead of fetching).
 * @param {object} opts — { timeoutMs, headers, fetchPage }.
 *   fetchPage is the test seam (defaults to fingerprint.fetchPage).
 * @returns {object[]} findings (class 'secret_in_js', high).
 */
export async function probeSecretsInJs(pageUrl, targets, opts = {}) {
  const findings = [];
  const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
  const bundles = Array.isArray(targets && targets.bundles)
    ? targets.bundles.slice(0, MAX_BUNDLES)
    : [];
  const inline = Array.isArray(targets && targets.inline)
    ? targets.inline.slice(0, MAX_INLINE)
    : [];
  const seen = new Set();
  for (const bundleUrl of bundles) {
    let res;
    try {
      res = await fetchFn(bundleUrl, opts);
    } catch {
      continue;
    }
    if (!res || res.status !== 200 || !res.body) continue;
    scanBody(res.body, bundleUrl, `script bundle ${bundleUrl}`, findings, seen);
    if (findings.length >= MAX_FINDINGS) return findings;
  }
  inline.forEach((body, i) => {
    if (findings.length >= MAX_FINDINGS) return;
    scanBody(body, pageUrl, `inline <script> block #${i + 1} on ${pageUrl}`, findings, seen);
  });
  return findings;
}

export const __secretsInJsMeta = { phases: ['secrets-in-js'], depth: ['quick', 'standard', 'deep'] };
