// Dark Matter rule-based scanner — source code disclosure
// (coverage row #184 [High], phase 73).
//
// DIAGNOSIS: a server that serves its own source — a backup copy
// (`login.php.bak`), a version-control file (`.git/config`), a
// source map (`.js.map` with `sourcesContent`), or a server-side
// file returned unexecuted — hands the attacker the exact code to
// review for secrets, logic flaws and version-specific bugs.
//
// VERIFICATION (100% truth rule): a finding counts ONLY when the
// fetched body actually contains recognisable source code for the
// claimed language. A 200 status alone is NEVER a finding, a 404/403
// is NEVER a finding, an HTML shell served for a backup path is
// NEVER a finding (SPA fallback), and docs prose mentioning code is
// NEVER a finding (mandatory baseline differential — the matched
// snippet must not appear in the pasted page body). One finding per
// distinct disclosed file; the same file via two URLs is two
// findings (two distinct exposures).
//
// NON-OVERLAP (by design): this probe targets SOURCE files only.
// `.git/HEAD`, `.env`, `.DS_Store` and `phpinfo.php` are already
// covered by the 'files' phase (files.js) and are never re-fired
// here; JS bundle contents are already mined by 'secrets-in-js'.
// A `.js`/`.ts` file served normally is a public static asset, not
// a disclosure — only its `.map` (original source) counts. A
// server-side template that OPENS with HTML markup before its first
// code tag is not claimed: it is indistinguishable from a rendered
// page quoting code, so the HTML guard wins over the code markers.
//
// SAFETY: read-only GETs only — no writes, no allowWrite gate. The
// pasted page (baseline) + one catch-all control fetch + up to 13
// candidate fetches (cap 15 total). The pasted page is always a
// surface, so this phase never skips.
import { createHash } from 'node:crypto';
import { fetchPage } from '../fingerprint.js';

const MAX_FETCHES = 15;
const MAX_BASE_PATHS = 5;
const MAX_BACKUP_VARIANTS = 5;
const MAX_MAP_VARIANTS = 2;
const MAX_FINDINGS = 20;

// Deterministic non-existent leaf: the same on every scan, so a
// repeated scan is reproducible and the token can never collide with
// a real application file. Shared with fingerprintBanner.js and
// errorDisclosure.js — the catch-all control for SPA fallbacks.
const NONEXISTENT_LEAF = 'dm-nonexistent-9f27a1c4.html';

// Server-side source extensions eligible for raw-source + backup
// checks. Static assets (.js/.ts/.css/.json) are deliberately NOT
// here — serving them is normal, and secrets-in-js already mines
// their contents.
const SOURCE_EXTS = new Set([
  'php', 'php3', 'php4', 'php5', 'php7', 'phtml',
  'py', 'java', 'jsp', 'asp', 'aspx', 'rb', 'pl', 'cfm',
  'go', 'cs', 'sh', 'sql', 'inc', 'cgi',
]);

// Backup suffixes tried per base path, in order.
const BACKUP_SUFFIXES = ['.bak', '.old'];

// A source file served as plain text must look like code, not a
// rendered page. A body that opens with a doctype/html tag and
// carries no definitive code marker (`<?php`, `<%@`) is a rendered
// page, never source — even if a script block inside it contains
// code-like text.
const HTML_OPEN_RE = /^\s*(<!doctype html|<html[\s>])/i;

// Per-language code markers. Each entry is a list of patterns; a
// pattern counts once however many times it matches. `definitive`
// patterns prove the language on their own (a `<?php` tag cannot
// appear in a rendered page by accident); otherwise at least two
// distinct supporting markers are required. Markers are deliberately
// language-specific: `$x = 1` alone is NOT a PHP marker (jQuery
// writes that too) — PHP needs `<?php` or two of its own idioms.
const LANGUAGE_MARKERS = {
  php: {
    definitive: [/<\?php\b/],
    supporting: [
      /\brequire(_once)?\s*\(?\s*['"]/,
      /\binclude(_once)?\s*\(?\s*['"]/,
      /\becho\s+['"$]/,
      /\bfunction\s+\w+\s*\(/,
      /\$[a-zA-Z_]\w*\s*=/,
      /->\w+\s*\(/,
      /::\w+\s*\(/,
      /\bclass\s+\w+\s*\{/,
      /\bnamespace\s+[\w\\]+;/,
    ],
  },
  python: {
    definitive: [],
    supporting: [
      /^import\s+[\w.]+/m,
      /^from\s+[\w.]+\s+import\s+/m,
      /^def\s+\w+\s*\(/m,
      /^class\s+\w+(\(.*\))?:/m,
      /if\s+__name__\s*==\s*['"]__main__['"]/,
      /^@\w+(\.\w+)*\s*$/m,
    ],
  },
  java: {
    definitive: [],
    supporting: [
      /^package\s+[\w.]+;/m,
      /^import\s+java\./m,
      /public\s+class\s+\w+/,
      /public\s+static\s+void\s+main\s*\(/,
      /private\s+\w+\s+\w+\s*;/,
      /System\.out\.println\s*\(/,
    ],
  },
  jsp: {
    definitive: [/<%@/, /<%!/, /<%=/],
    supporting: [
      /<%\s/,
      /Response\.Write/,
      /Server\.CreateObject/,
      /\bDim\s+\w+/,
    ],
  },
  ruby: {
    definitive: [],
    supporting: [
      /^require\s+['"]/m,
      /^def\s+\w+/m,
      /^class\s+\w+/m,
      /^module\s+\w+/m,
      /puts\s+['"]/,
      /end\s*$/m,
    ],
  },
  go: {
    definitive: [],
    supporting: [
      /^package\s+\w+/m,
      /^import\s*\(/m,
      /^func\s+\w+\s*\(/m,
      /fmt\.Print/,
      /:=/,
    ],
  },
  csharp: {
    definitive: [],
    supporting: [
      /using\s+System;/,
      /^namespace\s+[\w.]+/m,
      /public\s+class\s+\w+/,
      /Console\.Write/,
      /\bstring\s+\w+\s*=/,
    ],
  },
  js: {
    definitive: [],
    supporting: [
      /function\s+\w+\s*\(/,
      /=>/,
      /^import\s+[\w*{]/m,
      /^export\s+(default\s+)?(function|class|const|let)/m,
      /const\s+\w+\s*=/,
      /require\(['"]/,
    ],
  },
  perl: {
    definitive: [],
    supporting: [
      /^use\s+(strict|warnings)/m,
      /my\s+\$\w+\s*=/,
      /\bsub\s+\w+\s*\{/,
      /print\s+["']/,
      /\$ARGV\b/,
    ],
  },
  shell: {
    definitive: [/^#!\/bin\/(ba)?sh/m, /^#!\/usr\/bin\/env\s+(ba)?sh/m],
    supporting: [
      /^echo\s+/m,
      /\bif\s+\[/,
      /\bthen\b/,
      /\bfor\s+\w+\s+in\b/,
    ],
  },
};

// Which marker set a file extension claims. `.inc`/`.cgi` inherit
// the PHP set (the common case). `.sql` claims no set — a SQL dump
// is data disclosure, not source code, and stays out of scope.
const EXT_LANGUAGE = {
  php: 'php', php3: 'php', php4: 'php', php5: 'php', php7: 'php', phtml: 'php',
  inc: 'php', cgi: 'php',
  py: 'python',
  java: 'java',
  jsp: 'jsp', asp: 'jsp', aspx: 'jsp',
  rb: 'ruby',
  go: 'go',
  cs: 'csharp',
  sh: 'shell',
  pl: 'perl',
  cfm: 'jsp',
  js: 'js', mjs: 'js', cjs: 'js', ts: 'js',
};

function sha12(text) {
  return createHash('sha256').update(String(text || '')).digest('hex').slice(0, 12);
}

// A redacted snippet around the match — newlines flattened, capped.
function snippetAround(body, matchIndex, matchLen) {
  const start = Math.max(0, matchIndex - 80);
  const end = Math.min(body.length, matchIndex + matchLen + 80);
  let snip = body.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snip = `…${snip}`;
  if (end < body.length) snip = `${snip}…`;
  return snip.slice(0, 400);
}

function fileExtension(pathname) {
  const base = String(pathname || '').split('/').pop() || '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

/**
 * Detect the source language of a body claimed to be `extension`.
 * Pure — exported for unit tests. Returns the language key or null.
 * A definitive marker proves the language alone; otherwise two
 * distinct supporting markers are required. A rendered HTML page
 * (doctype/html open, no definitive marker) is never source.
 */
export function detectSourceLanguage(body, extension) {
  const text = typeof body === 'string' ? body : '';
  if (!text || text.length < 20) return null;
  const language = EXT_LANGUAGE[String(extension || '').toLowerCase()];
  if (!language) return null;
  const markers = LANGUAGE_MARKERS[language];
  if (!markers) return null;
  // The HTML guard runs BEFORE the definitive markers: a rendered
  // page that QUOTES code (`<pre><?php ...`) is not source, even
  // though it contains a definitive tag. A real source file opens
  // with code (`<?php`, `<%@`, `package ...`), not with a doctype.
  // Honest limit: a server-side template that opens with HTML
  // markup before its first code tag is indistinguishable from a
  // rendered page quoting code, so it is not claimed.
  if (HTML_OPEN_RE.test(text.slice(0, 500))) return null;
  for (const re of markers.definitive) {
    if (re.test(text)) return language;
  }
  let hits = 0;
  for (const re of markers.supporting) {
    if (re.test(text)) hits += 1;
    if (hits >= 2) return language;
  }
  return null;
}

// A .git/config body must look like git config: a [core] section
// plus a second structural line. Length-bounded (a real config is
// small) and never HTML.
function looksLikeGitConfig(body) {
  const text = typeof body === 'string' ? body : '';
  if (!text || text.length > 5000) return false;
  if (HTML_OPEN_RE.test(text.slice(0, 500))) return false;
  if (!/^\s*\[core\]/m.test(text)) return false;
  return /repositoryformatversion\s*=|bare\s*=|\[remote\s+"/.test(text);
}

// A .js.map body must be JSON with a non-empty sourcesContent whose
// entries read as JavaScript/TypeScript source.
function mapSourcesLanguage(body) {
  let parsed;
  try {
    parsed = JSON.parse(typeof body === 'string' ? body : '');
  } catch {
    return null;
  }
  if (!parsed || !Array.isArray(parsed.sourcesContent)) return null;
  const joined = parsed.sourcesContent.filter((s) => typeof s === 'string').join('\n');
  if (joined.length < 20) return null;
  return detectSourceLanguage(joined, 'js');
}

/**
 * Core detection for one fetched candidate — THE negative-control
 * stub point: replacing this body with `return null;` must make
 * every finding-expecting probe test fail and nothing else.
 * `check` = { kind, extension, baselineBody, catchAllBody }.
 * Returns null or { language, snippet } — the snippet is a window
 * around the first code marker, used for the differential.
 */
function detectSourceDisclosure(body, check) {
  const text = typeof body === 'string' ? body : '';
  if (!text) return null;
  const baselineBody = typeof check.baselineBody === 'string' ? check.baselineBody : '';
  const catchAllBody = typeof check.catchAllBody === 'string' ? check.catchAllBody : '';
  // Whitespace-insensitive comparison: the evidence snippet is
  // flattened, so the differential must flatten the baseline too —
  // otherwise a docs page quoting the same code (newlines intact)
  // would slip past the check.
  const normWs = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  // DIFFERENTIALS (mandatory): the fetched body must not BE the
  // baseline page or the SPA catch-all — a fallback shell served
  // for a backup path is not a disclosure.
  if (baselineBody && normWs(text) === normWs(baselineBody)) return null;
  if (catchAllBody && normWs(text) === normWs(catchAllBody)) return null;

  if (check.kind === 'gitconfig') {
    if (!looksLikeGitConfig(text)) return null;
    const snippet = text.slice(0, 200).replace(/\s+/g, ' ').trim();
    if (baselineBody && normWs(baselineBody).includes(normWs(snippet))) return null;
    return { language: 'git-config', snippet };
  }
  if (check.kind === 'map') {
    const language = mapSourcesLanguage(text);
    if (!language) return null;
    const snippet = text.slice(0, 200).replace(/\s+/g, ' ').trim();
    if (baselineBody && normWs(baselineBody).includes(normWs(snippet))) return null;
    return { language, snippet };
  }
  // 'raw' and 'backup': the body must read as source for the
  // claimed extension.
  const language = detectSourceLanguage(text, check.extension);
  if (!language) return null;
  // Find a marker window for the differential + evidence snippet.
  const markers = LANGUAGE_MARKERS[language];
  let idx = -1;
  let len = 0;
  for (const re of [...markers.definitive, ...markers.supporting]) {
    const m = re.exec(text);
    if (m) {
      idx = m.index;
      len = m[0].length;
      break;
    }
  }
  const snippet =
    idx >= 0 ? snippetAround(text, idx, len) : text.slice(0, 200).replace(/\s+/g, ' ').trim();
  // The matched code must not already be printed on the baseline
  // page (a docs page quoting the same snippet is not a leak).
  if (baselineBody && normWs(baselineBody).includes(normWs(snippet.replace(/^…|…$/g, '')))) return null;
  return { language, snippet };
}

/**
 * Build the candidate fetch list for a scan. Pure — exported for
 * unit tests. Priority order: raw-source checks of discovered
 * server-side files, backup variants of those files, .git/config,
 * source maps of discovered JS bundles. Caps keep the probe to
 * MAX_FETCHES total GETs including baseline + catch-all.
 * Returns [{ url, kind, extension }].
 */
export function buildSourceCodeTargets(pageUrl, urls) {
  let page;
  try {
    page = new URL(pageUrl);
  } catch {
    return [];
  }
  const origin = page.origin;
  const basePaths = [];
  const seenPaths = new Set();
  const pushBase = (raw) => {
    if (basePaths.length >= MAX_BASE_PATHS) return;
    let u;
    try {
      u = new URL(raw);
    } catch {
      return;
    }
    if (u.origin !== origin) return;
    const ext = fileExtension(u.pathname);
    if (!ext) return;
    const key = `${u.origin}${u.pathname}`;
    if (seenPaths.has(key)) return;
    seenPaths.add(key);
    basePaths.push({ url: `${u.origin}${u.pathname}`, pathname: u.pathname, extension: ext });
  };
  pushBase(pageUrl);
  for (const u of Array.isArray(urls) ? urls : []) pushBase(u);

  const out = [];
  // 1. Raw-source checks: a server-side file served unexecuted.
  for (const b of basePaths) {
    if (SOURCE_EXTS.has(b.extension)) {
      out.push({ url: b.url, kind: 'raw', extension: b.extension });
    }
  }
  // 2. Backup variants of server-side files (capped in total).
  let backups = 0;
  for (const b of basePaths) {
    if (backups >= MAX_BACKUP_VARIANTS) break;
    if (!SOURCE_EXTS.has(b.extension)) continue;
    for (const suffix of BACKUP_SUFFIXES) {
      if (backups >= MAX_BACKUP_VARIANTS) break;
      out.push({ url: `${b.url}${suffix}`, kind: 'backup', extension: b.extension });
      backups += 1;
    }
  }
  // 3. Version-control metadata (not covered by the 'files' phase,
  // which already checks .git/HEAD, .env, .DS_Store, phpinfo.php).
  out.push({ url: `${origin}/.git/config`, kind: 'gitconfig', extension: '' });
  // 4. Source maps of discovered JS bundles.
  let maps = 0;
  for (const b of basePaths) {
    if (maps >= MAX_MAP_VARIANTS) break;
    if (b.extension !== 'js' && b.extension !== 'mjs' && b.extension !== 'cjs') continue;
    out.push({ url: `${b.url}.map`, kind: 'map', extension: 'js' });
    maps += 1;
  }
  return out;
}

// Record one disclosed file as a finding; dedup is on kind + URL
// (two distinct URLs disclosing source are two findings).
function pushFinding(leak, res, candidate, findings, seen) {
  const key = `${candidate.kind}|${candidate.url}`;
  if (seen.has(key)) return;
  seen.add(key);
  const base = candidate.url.split('/').pop();
  let title;
  if (candidate.kind === 'raw') {
    title = `Source code disclosure — ${leak.language} source file served unexecuted at ${candidate.url}`;
  } else if (candidate.kind === 'backup') {
    title = `Source code disclosure — ${leak.language} backup copy '${base}' exposes server-side source`;
  } else if (candidate.kind === 'gitconfig') {
    title = 'Source code disclosure — exposed .git/config reveals repository metadata';
  } else {
    title = `Source code disclosure — JavaScript source map '${base}' exposes original source`;
  }
  findings.push({
    class: 'source_code_disclosure',
    id: `source-code-${sha12(key)}`,
    title,
    severity: 'high',
    url: candidate.url,
    parameter: null,
    evidence: {
      request: `GET ${candidate.url}`,
      response: `HTTP ${res.status} response discloses ${leak.language} source: snippet: ${leak.snippet}`,
      impact_demo:
        'Source-disclosure primitive — the exact server-side code lets an attacker read secrets and credentials embedded in code, map the logic for bypasses, and target known-vulnerable library versions without guessing; chain with credential reuse or a version-targeted exploit against the disclosed code.',
      signalCorrelated: true,
    },
  });
}

/**
 * Probe source code disclosure (#184).
 * @param {string} pageUrl — the pasted page (baseline + raw surface).
 * @param {string[]} urls — distinct GET probe target URLs (the
 *   orchestrator selects them; their paths seed backup/map
 *   candidates).
 * @param {object} opts — { timeoutMs, headers, fetchPage }.
 *   fetchPage is the test seam (defaults to fingerprint.fetchPage).
 * @returns {object[]} findings (class 'source_code_disclosure', high).
 */
export async function probeSourceCodeDisclosure(pageUrl, urls, opts = {}) {
  const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
  const findings = [];
  const seen = new Set();
  const candidates = buildSourceCodeTargets(pageUrl, urls);

  // Baseline first: the pasted page's body is the control the
  // differential is measured against. A raw-source check runs on
  // the baseline response itself when the page is a server-side
  // file — no extra fetch.
  let baselineBody = '';
  let baselineRes = null;
  try {
    baselineRes = await fetchFn(pageUrl, opts);
    if (baselineRes) {
      baselineBody = typeof baselineRes.body === 'string' ? baselineRes.body : '';
    }
  } catch {
    baselineRes = null;
    baselineBody = '';
  }
  if (baselineRes && baselineRes.status === 200 && baselineBody) {
    let pageExt = '';
    try {
      pageExt = fileExtension(new URL(pageUrl).pathname);
    } catch {
      pageExt = '';
    }
    if (SOURCE_EXTS.has(pageExt)) {
      const leak = detectSourceDisclosure(baselineBody, {
        kind: 'raw',
        extension: pageExt,
        baselineBody: '',
        catchAllBody: '',
      });
      if (leak) {
        pushFinding(
          leak,
          baselineRes,
          { url: pageUrl, kind: 'raw', extension: pageExt },
          findings,
          seen
        );
      }
    }
  }

  // Catch-all control: a nonexistent path in the page's directory.
  // A candidate whose body equals this control is an SPA fallback,
  // not a disclosure. One fetch, skipped when the page URL is
  // unparseable (then there are no candidates either).
  let catchAllBody = '';
  try {
    const page = new URL(pageUrl);
    const dir = page.pathname.slice(0, page.pathname.lastIndexOf('/') + 1) || '/';
    const bad = new URL(page);
    bad.pathname = `${dir}${NONEXISTENT_LEAF}`;
    bad.search = '';
    bad.hash = '';
    const res = await fetchFn(bad.toString(), opts);
    if (res && res.status === 200 && typeof res.body === 'string') {
      catchAllBody = res.body;
    }
  } catch {
    catchAllBody = '';
  }

  // Candidates in priority order, within the fetch budget.
  let fetches = 2; // baseline + catch-all
  for (const candidate of candidates) {
    if (findings.length >= MAX_FINDINGS) break;
    if (fetches >= MAX_FETCHES) break;
    // The baseline response already covers the page-as-raw case.
    if (candidate.kind === 'raw' && candidate.url === pageUrl) continue;
    fetches += 1;
    let res;
    try {
      res = await fetchFn(candidate.url, opts);
    } catch {
      continue;
    }
    if (!res || res.status !== 200 || typeof res.body !== 'string' || !res.body) continue;
    const leak = detectSourceDisclosure(res.body, {
      kind: candidate.kind,
      extension: candidate.extension,
      baselineBody,
      catchAllBody,
    });
    if (leak) {
      pushFinding(leak, res, candidate, findings, seen);
    }
  }
  return findings;
}

export const __sourceCodeDisclosureMeta = { phases: ['source-code-disclosure'], depth: ['quick', 'standard', 'deep'] };
