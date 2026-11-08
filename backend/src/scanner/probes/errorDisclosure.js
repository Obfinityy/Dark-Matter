// Dark Matter rule-based scanner — error-message information disclosure
// (coverage rows #175 [Low] Full Path Disclosure + #176 [Medium]
// Information Disclosure via Error Messages, phase 70).
//
// DIAGNOSIS: when an application hits an unexpected input it often
// answers with its own internals — the absolute filesystem path of
// the failing script, a language stack trace, an exception class, a
// SQL fragment. A bare 404/500 says nothing; a 500 that prints
// "/var/www/html/includes/db.php on line 42" hands the attacker the
// deployment layout, and a traceback hands them the framework,
// library versions and call chain the next probe needs.
//
// VERIFICATION (100% truth rule): a leak counts ONLY on a
// differential — the matched path / error detail must appear in the
// error response (4xx/5xx) AND NOT in the baseline GET of the same
// target. Paths and error text that already appear on the normal
// page (a JS bundle path, a docs snippet) are not findings. One
// finding per distinct leak (class + matched text), first URL cited.
// A bare 404/500 with no leak is NEVER a finding, and an error
// trigger that answers 2xx/3xx (a soft error page) is not scanned
// at all — the design scans 4xx/5xx responses only.
//
// SAFETY: read-only GETs only — no writes, no allowWrite gate. Two
// trigger shapes, both GETs: (a) a non-existent path under the
// target's directory, (b) a malformed query value (special chars +
// overlong filler) on the first parameter of a param-bearing target.
// BUDGETS ARE PER CLASS, never shared (re-proof #3, 8 Nov 2026): the
// malformed-query class is uncapped — one trigger per param-bearing
// target, because the input list is already bounded upstream by the
// orchestrator's scanTargets cap (maxUrls + 20) — so target order can
// never starve a late param target again. The non-existent-path class
// keeps its own cap of 10 (one per directory, deduped). Baselines are
// one GET per target, fetched lazily only when the trigger actually
// errored.
import { createHash } from 'node:crypto';
import { fetchPage } from '../fingerprint.js';

// Per-class request budget. Malformed-query triggers have NO cap here:
// one per param-bearing target, bounded upstream by the orchestrator
// (scanTargets <= maxUrls + 20). A shared cap let the 11th+ param
// target lose its trigger (re-proof #3, 8 Nov 2026: with 15
// param-bearing Juice targets the 10-cap cut the late ones and the
// live SQLite leak vanished even though the malformed-first reorder
// was in place).
const MAX_NONEXISTENT_REQUESTS = 10;
const MAX_FINDINGS = 20;
const SNIPPET_RADIUS = 80;

// Deterministic non-existent leaf: the same on every scan, so a
// repeated scan is reproducible and the token can never collide with
// a real application file.
const NONEXISTENT_LEAF = 'dm-nonexistent-9f27a1c4.html';
// Malformed query value: special chars (quote/bracket/ampersand)
// plus overlong filler — type-wrong, syntax-hostile and long enough
// to trip fixed buffers, in one value.
const MALFORMED_VALUE = '\'"<>&%00' + 'A'.repeat(64);

// Unix filesystem paths: a known webroot / system root, at least
// one directory below it, and a final filename carrying an extension.
// The extension gate kills bare URL paths such as /api/users/123
// (no extension) and the known-root gate kills app-relative paths.
const UNIX_PATH_RE =
  /\/(?:var|srv|home|opt|usr|etc|tmp|app|root|data|www)(?:\/[A-Za-z0-9._~%+-]+)*\/[A-Za-z0-9._~%+-]+\.[A-Za-z0-9]{1,10}\b/g;
// Windows filesystem paths: drive letter + at least one directory +
// a final filename carrying an extension.
const WINDOWS_PATH_RE =
  /\b[A-Za-z]:\\(?:[^\s\\/:*?"<>|]+\\)+[^\s\\/:*?"<>|]+\.[A-Za-z0-9]{1,10}\b/g;

// Error-detail patterns. Each entry names the leak family it proves;
// a match is a finding only when the differential (below) clears it.
// Kept tight: every pattern needs an error-shaped token (a traceback
// header, a fatal/uncaught marker, an exception class, a SQL error
// phrase) — a bare word such as "error" never fires.
const ERROR_DETAIL_PATTERNS = [
  { label: 'Python traceback', re: /Traceback \(most recent call last\)/g },
  { label: 'stack trace', re: /Stack trace:/gi },
  { label: 'PHP fatal error', re: /Fatal error:/gi },
  { label: 'PHP uncaught exception', re: /Uncaught \w+(?:Error|Exception)/g },
  { label: 'PHP warning', re: /Warning: (?:mysqli?|pg_|fopen|include|require)[^\n]{0,120}/gi },
  { label: 'SQL syntax error', re: /You have an error in your SQL syntax[^\n]{0,120}/gi },
  { label: 'SQL syntax error', re: /SQL syntax[^\n]{0,80}near [^\n]{0,80}/gi },
  { label: 'Oracle error', re: /\bORA-\d{5}\b/g },
  { label: 'PostgreSQL error', re: /\bPG::(?:SyntaxError|Error|UndefinedTable)\b/g },
  { label: 'SQLite error', re: /\bSQLITE_ERROR\b/g },
  { label: 'SQLite error', re: /\bsqlite3?\.(?:OperationalError|DatabaseError|IntegrityError)\b/g },
  { label: 'SQLite error', re: /\bSQLite3?::SQLException\b/g },
  { label: 'SQL Server error', re: /Unclosed quotation mark after the character string/g },
  { label: 'OLE DB error', re: /Microsoft OLE DB Provider[^\n]{0,120}/gi },
  { label: 'ODBC error', re: /ODBC Driver[^\n]{0,80}error[^\n]{0,80}/gi },
  { label: 'JDBC error', re: /java\.sql\.SQLException[^\n]{0,120}/g },
  { label: '.NET data error', re: /System\.Data\.SqlClient[^\n]{0,120}/g },
  { label: 'MySQL function leak', re: /\bmysql(?:i)?_(?:fetch|query|connect|select_db)\w*\s*\(/g },
  { label: 'Java exception', re: /Caused by:\s*[\w.$]+(?:Exception|Error)/g },
  { label: 'Java exception', re: /Exception in thread "[^"]*"\s+[\w.$]+(?:Exception|Error)/g },
  { label: 'Java exception', re: /\b(?:java\.lang\.|org\.[\w.]+)[\w.$]*?(?:Exception|Error)\b/g },
  { label: 'Node.js error', re: /\b(?:ReferenceError|TypeError|SyntaxError|RangeError): [^\n]{1,200}/g },
  { label: 'Node.js module error', re: /Error: Cannot find module '[^\n']{1,200}'/g },
  { label: 'JS stack frame', re: /^\s*at [\w$.<>]+\s+\([^()\n]*:\d+:\d+\)/gm },
  { label: '.NET server error', re: /Server Error in '\/[^']*' Application/gi },
  { label: '.NET exception', re: /\bSystem\.[\w.]+Exception\b/g },
  { label: 'Django error', re: /\b(?:TemplateDoesNotExist|DisallowedHost|OperationalError|ImproperlyConfigured)\b/g },
  { label: 'Werkzeug debugger', re: /Werkzeug Debugger/g },
  { label: 'Ruby error', re: /\b(?:ActionController|ActiveRecord)::\w+\b/g },
  { label: 'Ruby error', re: /\bNoMethodError\b/g },
  { label: 'PHP Xdebug', re: /\bXdebug\b/g },
];

function sha12(text) {
  return createHash('sha256').update(String(text || '')).digest('hex').slice(0, 12);
}

// A redacted snippet around the match — newlines flattened, capped.
function snippetAround(body, matchIndex, matchLen) {
  const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
  const end = Math.min(body.length, matchIndex + matchLen + SNIPPET_RADIUS);
  let snip = body.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snip = `…${snip}`;
  if (end < body.length) snip = `${snip}…`;
  return snip.slice(0, 400);
}

/**
 * Build the error-trigger request list for a set of GET probe
 * targets. Pure — exported for unit tests. Each trigger carries the
 * URL to fetch, the baseline URL it is differenced against, the
 * trigger kind and (for malformed queries) the parameter name.
 * One trigger per target (malformed query when the target carries
 * params, non-existent path otherwise), plus one non-existent-path
 * trigger from the first target when every target was param-bearing
 * (so both trigger shapes are exercised whenever possible).
 * Budgets are per class: every param-bearing target gets its
 * malformed-query trigger (no cap — the input is bounded upstream),
 * non-existent-path triggers cap at MAX_NONEXISTENT_REQUESTS.
 *
 * Order (re-proof #2 fix, 8 Nov 2026): malformed-query triggers
 * are built FIRST, nonexistent-path triggers second — the trigger
 * budget must not depend on the mined-target sort order. The miner
 * promotes login/check routes ahead of param-bearing API routes, so
 * a single in-order pass let param-less routes spend the whole cap
 * and dropped the malformed trigger for /rest/products/search?q=
 * (the live SQLite leak, re-proof #2). Malformed triggers carry
 * the error-detail signal (#176); nonexistent-path triggers carry
 * the path signal (#175) — both shapes are still built.
 *
 * Order alone was NOT enough (re-proof #3, 8 Nov 2026): with 15
 * param-bearing Juice targets the shared 10-cap still cut the 11th+
 * param target, so the malformed class now has no cap of its own —
 * the reorder only decides which trigger is FIRST, the per-class
 * budget decides that none is ever dropped.
 */
export function buildErrorTriggers(urls) {
  const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
  const triggers = [];
  const seenUrls = new Set();
  const push = (trigger) => {
    // Two targets in one directory share the same non-existent
    // path — sending it twice wastes budget and double-counts
    // nothing (findings dedup anyway). Keep the first.
    if (seenUrls.has(trigger.url)) return false;
    seenUrls.add(trigger.url);
    triggers.push(trigger);
    return true;
  };
  // Pass 1 — malformed-query triggers for every param-bearing
  // target, in list order. Pass 2 — nonexistent-path triggers for
  // the param-less targets, capped per class. The malformed class
  // has NO cap (the input is bounded upstream), so a late
  // param-bearing target can never lose its trigger to an earlier
  // one — the re-proof #3 starvation cannot recur.
  const parsed = [];
  for (const raw of list) {
    let u;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }
    parsed.push({ raw, u });
  }
  let sawNonexistent = false;
  let nonexistentCount = 0;
  for (const { raw, u } of parsed) {
    const firstParam = [...u.searchParams.keys()][0];
    if (!firstParam) continue;
    const bad = new URL(u);
    bad.searchParams.set(firstParam, MALFORMED_VALUE);
    push({
      url: bad.toString(),
      baselineUrl: raw,
      kind: 'malformed-query',
      parameter: firstParam,
    });
  }
  for (const { raw, u } of parsed) {
    if (nonexistentCount >= MAX_NONEXISTENT_REQUESTS) break;
    if ([...u.searchParams.keys()].length > 0) continue;
    const dir = u.pathname.slice(0, u.pathname.lastIndexOf('/') + 1) || '/';
    const bad = new URL(u);
    bad.pathname = `${dir}${NONEXISTENT_LEAF}`;
    bad.search = '';
    bad.hash = '';
    if (
      push({
        url: bad.toString(),
        baselineUrl: raw,
        kind: 'nonexistent-path',
        parameter: null,
      })
    ) {
      nonexistentCount += 1;
      sawNonexistent = true;
    }
  }
  if (!sawNonexistent && list.length > 0 && nonexistentCount < MAX_NONEXISTENT_REQUESTS) {
    try {
      const u = new URL(list[0]);
      const dir = u.pathname.slice(0, u.pathname.lastIndexOf('/') + 1) || '/';
      const bad = new URL(u);
      bad.pathname = `${dir}${NONEXISTENT_LEAF}`;
      bad.search = '';
      bad.hash = '';
      push({
        url: bad.toString(),
        baselineUrl: list[0],
        kind: 'nonexistent-path',
        parameter: null,
      });
    } catch {
      // ignore a malformed first target — the malformed-query
      // triggers already cover the scan
    }
  }
  return triggers;
}

// Scan one error body for leaks the baseline does not carry.
// `push` records a finding; dedup is on class + matched-text hash.
function scanErrorBody(body, baselineBody, trigger, res, findings, seen) {
  const text = typeof body === 'string' ? body : '';
  const base = typeof baselineBody === 'string' ? baselineBody : '';
  if (!text) return;
  // Matches already recorded from THIS response, per class — two
  // patterns naming the same leak (e.g. `sqlite3.OperationalError`
  // and the bare `OperationalError` inside it) are one finding, not
  // two: a new match that contains, or is contained in, a recorded
  // match of the same class is suppressed.
  const recorded = [];
  const push = (cls, severity, title, match, matchIndex) => {
    if (!match) return;
    // DIFFERENTIAL (mandatory): the leak must NOT appear in the
    // baseline GET of the same target — a path/detail the normal
    // page already shows is not a disclosure.
    if (base.includes(match)) return;
    if (
      recorded.some(
        (r) => r.cls === cls && (r.match.includes(match) || match.includes(r.match))
      )
    ) {
      return;
    }
    // Record before the cross-response dedup below, so a match
    // already seen in an earlier response still suppresses its
    // contained siblings in this one.
    recorded.push({ cls, match });
    const key = `${cls}|${sha12(match)}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({
      class: cls,
      id: `error-disclosure-${cls}-${sha12(match)}`,
      title,
      severity,
      url: trigger.url,
      parameter: trigger.parameter,
      evidence: {
        request:
          `GET ${trigger.url} (${trigger.kind === 'malformed-query' ? `malformed value for parameter '${trigger.parameter}'` : 'non-existent path'}); ` +
          `baseline GET ${trigger.baselineUrl}`,
        response:
          `HTTP ${res.status} error response leaks ${title.split(' — ')[1] || title}: ` +
          `snippet: ${snippetAround(text, matchIndex, match.length)}`,
        impact_demo:
          cls === 'path_disclosure'
            ? 'Full-path-disclosure primitive — the absolute deployment path narrows every later probe (file inclusion, traversal, config reads) to the real layout instead of guesses.'
            : 'Error-message information-disclosure primitive — the stack trace / exception detail hands the attacker the framework, library and call chain the next probe needs; chain with a targeted injection against the named component.',
        signalCorrelated: true,
      },
    });
  };
  for (const re of [UNIX_PATH_RE, WINDOWS_PATH_RE]) {
    const fresh = new RegExp(re.source, re.flags);
    let m;
    while ((m = fresh.exec(text)) !== null) {
      push(
        'path_disclosure',
        'low',
        `Full path disclosure — filesystem path leaked in an error response (${trigger.kind})`,
        m[0],
        m.index
      );
      if (findings.length >= MAX_FINDINGS) return;
    }
  }
  for (const p of ERROR_DETAIL_PATTERNS) {
    const fresh = new RegExp(p.re.source, p.re.flags);
    let m;
    while ((m = fresh.exec(text)) !== null) {
      push(
        'error_info_disclosure',
        'medium',
        `Information disclosure via error messages — ${p.label} in an error response (${trigger.kind})`,
        m[0],
        m.index
      );
      if (findings.length >= MAX_FINDINGS) return;
    }
  }
}

/**
 * Probe error-message information disclosure (#175 + #176).
 * @param {string[]} urls — distinct GET probe target URLs (the
 *   orchestrator selects them; a URL with no probe point is not a
 *   GET probe target and is never passed in).
 * @param {object} opts — { timeoutMs, headers, fetchPage }.
 *   fetchPage is the test seam (defaults to fingerprint.fetchPage).
 * @returns {object[]} findings (classes 'path_disclosure' low and
 *   'error_info_disclosure' medium).
 */
export async function probeErrorDisclosure(urls, opts = {}) {
  const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
  const triggers = buildErrorTriggers(urls);
  const findings = [];
  const seen = new Set();
  const baselines = new Map();
  for (const trigger of triggers) {
    if (findings.length >= MAX_FINDINGS) break;
    let res;
    try {
      res = await fetchFn(trigger.url, opts);
    } catch {
      continue;
    }
    if (!res || !res.body) continue;
    // Only 4xx/5xx responses are error responses. A 2xx/3xx
    // answer to a bad input is a soft error page, not a leak
    // surface — it is not scanned.
    if (typeof res.status !== 'number' || res.status < 400) continue;
    let baselineBody = baselines.get(trigger.baselineUrl);
    if (baselineBody === undefined) {
      try {
        const baseRes = await fetchFn(trigger.baselineUrl, opts);
        baselineBody = baseRes && baseRes.body ? String(baseRes.body) : '';
      } catch {
        baselineBody = '';
      }
      baselines.set(trigger.baselineUrl, baselineBody);
    }
    scanErrorBody(res.body, baselineBody, trigger, res, findings, seen);
  }
  return findings;
}

export const __errorDisclosureMeta = { phases: ['error-disclosure'], depth: ['quick', 'standard', 'deep'] };
