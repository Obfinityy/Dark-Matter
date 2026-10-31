/**
 * premiseDedup.js — semantic premise deduplication for the hunt loop.
 *
 * ROOT CAUSE (31 Oct 2026, audit R-05): the hunt loop keyed dead-end
 * detection on the raw hypothesis *string* with only cosmetic normalization
 * (lowercase + whitespace collapse). The 8B brain defeats this by rewording
 * the same testing idea each turn — "Login endpoint may be vulnerable to
 * SQL injection" vs "Check if the login form accepts SQLi on the username
 * field" never share a key, so failures never accumulate toward the death
 * toll and the loop re-circles forever (observed iters 51–81 on h_6e909d3c1965).
 *
 * FIX: represent each plan/reasoning row as a NORMALIZED SEMANTIC PREMISE —
 * a (vulnClass, sink) tuple extracted via synonym maps and endpoint
 * normalization — and key retirement on the tuple, not the prose.
 *
 * Design rules:
 *  - The sink is part of the key: (sqli, login) retired NEVER blocks
 *    (sqli, search). A vulnerability *class* alone is never retired.
 *  - 'unknown' sink is conservative: (sqli, unknown) does not match
 *    (sqli, login); two unknowns of the same class do match.
 *  - 'unknown|unknown' never matches anything (falls back to text filters).
 *  - Pure functions, no I/O — fully unit-testable.
 */

/**
 * Vulnerability classes, ordered by specificity. FIRST match wins, so
 * concrete technique classes come before generic impact classes:
 * "SQLi authentication bypass on login" must classify as sqli (the
 * technique being tested), not as a generic auth bypass.
 */
const CLASS_RULES = [
  { cls: 'sqli', res: [/\bsql\s*i\b/i, /sql\s*injection/i, /union\s+select/i, /blind\s+sql/i, /sql\s*error/i, /'(\s*or\s+)?'1'\s*=\s*'1/, /"\s*or\s+"1"\s*=\s*"1/] },
  { cls: 'xss', res: [/\bxss\b/i, /cross[\s-]*site\s*script/i, /<script/i, /javascript\s*:/i, /onerror\s*=/i] },
  { cls: 'cmdi', res: [/command\s+injection/i, /\bos\s+command/i, /;\s*(id|whoami|cat\s)/, /\|\s*(id|whoami)\b/, /&&\s*(id|whoami)\b/] },
  { cls: 'lfi', res: [/\blfi\b/i, /file\s+inclusion/i, /(path|directory)\s+traversal/i, /\.\.\//, /etc\/passwd/i] },
  { cls: 'ssrf', res: [/\bssrf\b/i, /server[\s-]*side\s*request\s*forgery/i] },
  { cls: 'csrf', res: [/\bcsrf\b/i, /cross[\s-]*site\s*request\s*forgery/i] },
  { cls: 'ssti', res: [/\bssti\b/i, /template\s+injection/i, /\{\{\s*7\s*\*\s*7\s*\}\}/] },
  { cls: 'xxe', res: [/\bxxe\b/i, /xml\s*external\s*entity/i, /<!entity/i] },
  { cls: 'brute', res: [/\bbrute\s*force\b/i, /dictionary\s+(attack|word)/i, /password\s*spray/i, /enum_password/i, /credential\s*stuffing/i, /hydra/i] },
  { cls: 'session', res: [/manipulate\s*session/i, /session\s*fixation/i, /session\s*hijack/i, /session\s+id/i, /impersonat/i, /weak\s+session/i] },
  { cls: 'idor', res: [/\bidor\b/i, /insecure\s*direct\s*object/i, /object[\s-]*level\s*authorization/i] },
  { cls: 'openredirect', res: [/open\s*redirect/i] },
  { cls: 'defaultcreds', res: [/default\s+credential/i, /default\s+(password|login)/i, /admin\s*\/\s*admin/i] },
  { cls: 'authbypass', res: [/auth(entication)?\s*bypass/i, /bypass(es|ing)?\s+auth/i, /login\s*bypass/i] },
  { cls: 'infoleak', res: [/information\s+disclosure/i, /sensitive\s+(data|file|info)/i, /directory\s+listing/i, /phpinfo/i] },
];

/**
 * Sink (target surface) rules, ordered by specificity. The sink keeps
 * premises distinct: retiring (sqli, login) must not block (sqli, search).
 */
const SINK_RULES = [
  { sink: 'login', res: [/\/login\.php/i, /\blogin\b/i, /sign[\s-]*in/i] },
  { sink: 'register', res: [/\bregist(er|ration)\b/i, /\/signup?\b/i] },
  { sink: 'search', res: [/\bsearch\b/i] },
  { sink: 'upload', res: [/\bupload\b/i] },
  { sink: 'profile', res: [/\bprofile\b/i] },
  { sink: 'comment', res: [/\bcomment\b/i] },
  { sink: 'contact', res: [/\bcontact\b/i] },
  { sink: 'admin', res: [/\badmin\b/i, /\/wp-admin/i] },
  { sink: 'redirect', res: [/\bredirect\b/i, /\bnext\b.*\bparam/i] },
  { sink: 'cookie', res: [/\bcookie\b/i] },
  { sink: 'header', res: [/\bheader\b/i, /\buser-agent\b/i, /\breferer\b/i, /\bhost\b.*\bheader\b/i] },
  { sink: 'api', res: [/\brest\b/i, /\/api\//i, /\bendpoint\b/i] },
];

function firstMatch(rules, text) {
  for (const r of rules) {
    for (const re of r.res) {
      if (re.test(text)) return r.cls || r.sink;
    }
  }
  return null;
}

/** Fallback sink: pull a path segment out of URL-ish text. */
function pathSink(text) {
  let m = text.match(/\/([A-Za-z0-9_-]+)\.php\b/);
  if (m) return m[1].toLowerCase();
  m = text.match(/\/([A-Za-z0-9_-]+)(?:[/?#\s]|$)/);
  if (m && !['http', 'https', 'www'].includes(m[1].toLowerCase())) return m[1].toLowerCase();
  return null;
}

/**
 * Extract the normalized semantic premise from a plan or reasoning row.
 * Joins every text field — hypothesis prose, test label, action slug and
 * command — so a sink named only in the action slug (e.g.
 * `sql_injection_login`) is still grounded.
 */
export function extractPremise(plan = {}) {
  const raw = [plan.hypothesis, plan.test, plan.action, plan.command]
    .filter((s) => typeof s === 'string' && s.length)
    .join(' | ');
  // Separator-normalized once for all matching: action slugs like
  // `sql_injection_login` carry both class and sink signals, but `_` is a
  // word character so `\bsql\b`-style patterns never see through it.
  const text = raw.replace(/[_-]+/g, ' ');
  const vulnClass = firstMatch(CLASS_RULES, text) || 'unknown';
  const sink = firstMatch(SINK_RULES, text) || pathSink(text) || 'unknown';
  return { vulnClass, sink };
}

/** Canonical premise key. 'unknown|unknown' is the non-matchable sentinel. */
export function premiseKey(p) {
  const v = (p && p.vulnClass) || 'unknown';
  const s = (p && p.sink) || 'unknown';
  return `${v}|${s}`;
}

export const UNKNOWN_PREMISE_KEY = 'unknown|unknown';

/**
 * True when two plans/rows test the same semantic premise despite
 * reworded labels, reordered arguments, or different prose.
 * Never true for the unknown|unknown sentinel (falls back to text filters).
 */
export function premisesEquivalent(a, b) {
  const ka = premiseKey(extractPremise(a));
  const kb = premiseKey(extractPremise(b));
  if (ka === UNKNOWN_PREMISE_KEY || kb === UNKNOWN_PREMISE_KEY) return false;
  return ka === kb;
}

/**
 * Group reasoning rows by premise key, counting failures/verifications.
 * Mirrors getHypothesisLedger's counting rules (failed = /no assessment|
 * not verified/i, verified = starts with VERIFIED) but keys on the
 * semantic premise so reworded retries accumulate toward the same toll.
 * Skips hypothesis-retirement rows (no feedback loop) — retirement is an
 * audit marker, not evidence.
 */
export function groupRowsByPremise(rows) {
  const byPremise = new Map();
  for (const r of rows || []) {
    if (!r || r.action === 'hypothesis-retirement') continue;
    const key = premiseKey(extractPremise({ hypothesis: r.hypothesis, action: r.action, command: r.command }));
    if (key === UNKNOWN_PREMISE_KEY) continue;
    if (!byPremise.has(key)) {
      const p = extractPremise({ hypothesis: r.hypothesis, action: r.action });
      byPremise.set(key, { key, vulnClass: p.vulnClass, sink: p.sink, failed: 0, verified: 0, samples: [] });
    }
    const e = byPremise.get(key);
    const res = String(r.result || '');
    if (res.startsWith('VERIFIED')) e.verified++;
    else if (/no assessment|not verified/i.test(res)) e.failed++;
    if (e.samples.length < 3 && r.hypothesis) e.samples.push(String(r.hypothesis).slice(0, 90));
  }
  return byPremise;
}
