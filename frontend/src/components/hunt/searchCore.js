/**
 * searchCore.js — Findings Search Suite query engine.
 * Forge wave 7, ideas 50241–50280. Pure logic, no DOM (localStorage helpers
 * degrade gracefully when window is unavailable). Consumed by SearchSuite.jsx.
 *
 * Query language:
 *   plain terms            fuzzy substring match over title/evidence/host/notes/comments
 *   "quoted phrase"        exact phrase match
 *   sev:critical           operator filters (50241)
 *   host:example.com       hostname match
 *   has:poc | has:evidence | has:notes | has:comments | has:chain
 *   is:unreviewed | is:archived | is:starred | is:fixed
 *   in:evidence | in:notes | in:title   scope restriction (50257, 50263)
 *   title:<text>           title-only match
 *   phase:<name>           hunt phase match
 *   tag:<tag>              tag match
 *   before:"last tuesday"  after:2026-09-01   natural-language dates (50269)
 *   wild*card             wildcard terms (50248)
 *   AND OR NOT (...)      boolean operators (50266), implicit AND between terms
 *   !hunt | !report | !setting   bang scope prefixes (50286)
 */

/* ------------------------------------------------------------------ */
/* 50251 — synonym expansion                                          */
/* ------------------------------------------------------------------ */

export const SYNONYMS = {
  login: ['auth', 'signin', 'sign-in', 'session', 'logon'],
  auth: ['login', 'signin', 'sign-in', 'session'],
  signin: ['login', 'auth', 'session'],
  password: ['passwd', 'credential', 'secret'],
  xss: ['cross-site scripting', 'cross site scripting', 'script injection'],
  sqli: ['sql injection', 'sql-injection'],
  injection: ['inject'],
  rce: ['remote code execution', 'command execution'],
  ssrf: ['server-side request forgery'],
  csrf: ['cross-site request forgery', 'xsrf'],
  idor: ['insecure direct object reference', 'broken object level authorization'],
  lfi: ['local file inclusion'],
  rfi: ['remote file inclusion'],
  admin: ['administrator', 'root', 'superuser'],
  token: ['jwt', 'bearer', 'session token'],
  cookie: ['session cookie'],
  redirect: ['open redirect', 'redirection'],
  upload: ['file upload'],
  cors: ['cross-origin'],
};

export function expandSynonyms(term) {
  const t = String(term || '').toLowerCase();
  const out = new Set([t]);
  if (SYNONYMS[t]) for (const s of SYNONYMS[t]) out.add(s);
  // reverse lookup: if t is a synonym of a key, include the key too
  for (const [k, vals] of Object.entries(SYNONYMS)) {
    if (vals.includes(t)) {
      out.add(k);
      for (const s of vals) out.add(s);
    }
  }
  return [...out];
}

/* ------------------------------------------------------------------ */
/* 50279 — multilingual search                                        */
/* ------------------------------------------------------------------ */

// Minimal real translation map for common vuln terms (en → es/de/fr/hi).
// Findings with translated titles still match the English query.
export const TRANSLATIONS = {
  injection: { es: 'inyección', de: 'injektion', fr: 'injection', hi: 'इंजेक्शन' },
  login: { es: 'inicio de sesión', de: 'anmeldung', fr: 'connexion', hi: 'लॉगिन' },
  password: { es: 'contraseña', de: 'passwort', fr: 'mot de passe', hi: 'पासवर्ड' },
  vulnerability: { es: 'vulnerabilidad', de: 'schwachstelle', fr: 'vulnérabilité', hi: 'भेद्यता' },
  critical: { es: 'crítica', de: 'kritisch', fr: 'critique', hi: 'गंभीर' },
  finding: { es: 'hallazgo', de: 'befund', fr: 'constatation', hi: 'खोज' },
  report: { es: 'informe', de: 'bericht', fr: 'rapport', hi: 'रिपोर्ट' },
  admin: { es: 'administrador', de: 'administrator', fr: 'administrateur', hi: 'एडमिन' },
};

export function multilingualVariants(term) {
  const t = String(term || '').toLowerCase();
  const out = new Set([t]);
  if (TRANSLATIONS[t]) for (const v of Object.values(TRANSLATIONS[t])) out.add(v.toLowerCase());
  return [...out];
}

/* ------------------------------------------------------------------ */
/* Tokenizer + parser (50241, 50266, 50286)                           */
/* ------------------------------------------------------------------ */

const OPERATOR_KEYS = new Set([
  'sev',
  'severity',
  'host',
  'has',
  'is',
  'in',
  'title',
  'phase',
  'tag',
  'before',
  'after',
  'assignee',
]);

const BANG_SCOPES = { '!hunt': 'hunt', '!report': 'report', '!setting': 'setting' };

function tokenize(raw) {
  const tokens = [];
  const re = /([A-Za-z]+):"([^"]*)"|"([^"]*)"|(\()|(\))|(\S+)/g;
  let m;
  while ((m = re.exec(raw))) {
    if (m[1] !== undefined) {
      // operator with quoted multi-word value: after:"last tuesday"
      const key = m[1].toLowerCase();
      if (OPERATOR_KEYS.has(key)) tokens.push({ kind: 'filter', key, value: m[2] });
      else tokens.push({ kind: 'term', value: `${m[1]}:"${m[2]}"` });
    } else if (m[3] !== undefined) tokens.push({ kind: 'phrase', value: m[3] });
    else if (m[4]) tokens.push({ kind: 'lparen' });
    else if (m[5]) tokens.push({ kind: 'rparen' });
    else {
      const w = m[6];
      const up = w.toUpperCase();
      if (up === 'AND' || up === 'OR' || up === 'NOT') tokens.push({ kind: 'op', value: up });
      else if (BANG_SCOPES[w.toLowerCase()])
        tokens.push({ kind: 'bang', value: BANG_SCOPES[w.toLowerCase()] });
      else {
        const ci = w.indexOf(':');
        if (ci > 0 && OPERATOR_KEYS.has(w.slice(0, ci).toLowerCase())) {
          tokens.push({
            kind: 'filter',
            key: w.slice(0, ci).toLowerCase(),
            value: w.slice(ci + 1).replace(/^"|"$/g, ''),
          });
        } else tokens.push({ kind: 'term', value: w });
      }
    }
  }
  return tokens;
}

/**
 * Parse a query string into { ast, scope, filters }.
 * ast is null for an empty query (match-all).
 */
export function parseQuery(raw = '') {
  const tokens = tokenize(String(raw).trim());
  let scope = 'all';
  const filters = [];
  const expr = [];
  for (const t of tokens) {
    if (t.kind === 'bang') {
      scope = t.value;
      continue;
    }
    if (t.kind === 'filter') {
      filters.push(t);
      expr.push(t);
      continue;
    }
    expr.push(t);
  }
  // insert implicit AND between adjacent operands
  const withAnd = [];
  const isOperand = t =>
    t.kind === 'term' || t.kind === 'phrase' || t.kind === 'filter' || t.kind === 'rparen';
  const startsOperand = t =>
    t.kind === 'term' || t.kind === 'phrase' || t.kind === 'filter' || t.kind === 'lparen';
  for (let i = 0; i < expr.length; i++) {
    withAnd.push(expr[i]);
    const cur = expr[i];
    const nxt = expr[i + 1];
    if (
      nxt &&
      isOperand(cur) &&
      (startsOperand(nxt) || (nxt.kind === 'op' && nxt.value === 'NOT'))
    ) {
      withAnd.push({ kind: 'op', value: 'AND' });
    }
  }
  // shunting-yard: NOT > AND > OR
  const prec = { NOT: 3, AND: 2, OR: 1 };
  const output = [];
  const ops = [];
  for (const t of withAnd) {
    if (t.kind === 'op') {
      while (
        ops.length &&
        ops[ops.length - 1].kind === 'op' &&
        prec[ops[ops.length - 1].value] >= prec[t.value]
      )
        output.push(ops.pop());
      ops.push(t);
    } else if (t.kind === 'lparen') ops.push(t);
    else if (t.kind === 'rparen') {
      while (ops.length && ops[ops.length - 1].kind !== 'lparen') output.push(ops.pop());
      ops.pop();
    } else output.push(t);
  }
  while (ops.length) output.push(ops.pop());
  // build AST from RPN
  const stack = [];
  for (const t of output) {
    if (t.kind === 'op') {
      if (t.value === 'NOT') {
        const a = stack.pop();
        stack.push({ type: 'not', a });
      } else {
        const b = stack.pop();
        const a = stack.pop();
        stack.push({ type: t.value.toLowerCase(), a, b });
      }
    } else stack.push({ type: t.kind, ...t });
  }
  return { ast: stack.length ? stack[0] : null, scope, filters };
}

/* ------------------------------------------------------------------ */
/* 50242 — operator autocomplete values                                */
/* ------------------------------------------------------------------ */

export const OPERATOR_VALUES = {
  sev: ['critical', 'high', 'medium', 'low', 'info'],
  severity: ['critical', 'high', 'medium', 'low', 'info'],
  has: ['poc', 'evidence', 'notes', 'comments', 'chain'],
  is: ['unreviewed', 'archived', 'starred', 'fixed'],
  in: ['evidence', 'notes', 'title'],
};

export function suggestOperatorValues(partial = '') {
  const out = [];
  const p = String(partial || '').toLowerCase();
  const ci = p.indexOf(':');
  if (ci < 0) {
    // suggest operator keys themselves
    for (const k of [...OPERATOR_KEYS])
      if (k.startsWith(p)) out.push({ text: `${k}:`, kind: 'operator' });
    return out;
  }
  const key = p.slice(0, ci);
  const valPart = p.slice(ci + 1);
  const vals = OPERATOR_VALUES[key] || [];
  for (const v of vals) if (v.startsWith(valPart)) out.push({ text: `${key}:${v}`, kind: 'value' });
  return out;
}

/* ------------------------------------------------------------------ */
/* 50269 — natural-language dates                                      */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Parse phrases like "today", "yesterday", "last tuesday", "3 days ago",
 * "last week", "last month", ISO dates. Returns { from, to } epoch ms or null.
 */
export function naturalDate(phrase, now = Date.now()) {
  const p = String(phrase || '')
    .trim()
    .toLowerCase()
    .replace(/^"|"$/g, '');
  const d = new Date(now);
  const startOfDay = x => {
    const c = new Date(x);
    c.setHours(0, 0, 0, 0);
    return c.getTime();
  };
  if (p === 'today') return { from: startOfDay(d), to: now };
  if (p === 'yesterday') {
    const t = startOfDay(d);
    return { from: t - 86400000, to: t - 1 };
  }
  let m = p.match(/^last\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (m) {
    const want = WEEKDAYS.indexOf(m[1]);
    const c = new Date(startOfDay(d));
    let back = (c.getDay() - want + 7) % 7;
    if (back === 0) back = 7;
    c.setDate(c.getDate() - back);
    return { from: c.getTime(), to: c.getTime() + 86400000 - 1 };
  }
  m = p.match(/^(\d+)\s+days?\s+ago$/);
  if (m) {
    const t = startOfDay(d) - Number(m[1]) * 86400000;
    return { from: t, to: t + 86400000 - 1 };
  }
  if (p === 'last week') return { from: now - 7 * 86400000, to: now };
  if (p === 'last month') return { from: now - 30 * 86400000, to: now };
  const iso = Date.parse(p);
  if (!Number.isNaN(iso)) return { from: startOfDay(iso), to: startOfDay(iso) + 86400000 - 1 };
  return null;
}

/* ------------------------------------------------------------------ */
/* Matching core                                                      */
/* ------------------------------------------------------------------ */

function wildcardToRegExp(term) {
  const esc = term.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(esc, 'i');
}

function termMatches(
  term,
  text,
  { caseSensitive = false, synonyms = true, multilingual = false } = {}
) {
  // Case-sensitive mode implies precision: skip lowercase-normalized synonyms.
  const needles = caseSensitive
    ? [String(term)]
    : synonyms
      ? expandSynonyms(term)
      : [String(term).toLowerCase()];
  const variants = multilingual ? needles.flatMap(multilingualVariants) : needles;
  const hay = caseSensitive ? String(text) : String(text).toLowerCase();
  const isWild = String(term).includes('*');
  for (const n of variants) {
    if (!n) continue;
    if (isWild) {
      if (
        wildcardToRegExp(caseSensitive ? n : n.toLowerCase()).test(
          caseSensitive ? String(text) : hay
        )
      )
        return n;
    } else {
      const needle = caseSensitive ? n : n.toLowerCase();
      if (hay.includes(needle)) return n;
    }
  }
  return null;
}

function filterMatches(f = {}, key, value) {
  const v = String(value || '').toLowerCase();
  switch (key) {
    case 'sev':
    case 'severity':
      return String(f.severity || '').toLowerCase() === v;
    case 'host':
      return String(f.host || f.hostname || '')
        .toLowerCase()
        .includes(v);
    case 'has':
      if (v === 'poc') return !!(f.poc || f.hasPoc);
      if (v === 'evidence') return !!f.evidence;
      if (v === 'notes') return !!f.notes;
      if (v === 'comments') return !!(Array.isArray(f.comments) ? f.comments.length : f.comments);
      if (v === 'chain') return !!(f.chainId || (Array.isArray(f.chain) && f.chain.length));
      return false;
    case 'is':
      if (v === 'unreviewed') return f.reviewed === false || f.reviewed == null; // 50262
      if (v === 'archived') return !!f.archived;
      if (v === 'starred') return !!f.starred;
      if (v === 'fixed')
        return ['fixed', 'verified'].includes(String(f.triage || f.status || '').toLowerCase());
      return false;
    case 'title':
      return String(f.title || '')
        .toLowerCase()
        .includes(v);
    case 'phase':
      return String(f.phase || '').toLowerCase() === v;
    case 'tag':
      return (f.tags || [])
        .map(String)
        .map(s => s.toLowerCase())
        .includes(v);
    case 'assignee':
      return String(f.assignee || '')
        .toLowerCase()
        .includes(v);
    case 'before': {
      const r = naturalDate(v);
      return r ? (f.createdAt || 0) < r.to : false;
    }
    case 'after': {
      const r = naturalDate(v);
      return r ? (f.createdAt || 0) > r.from : false;
    }
    case 'in':
      return true; // scope handled at term level
    default:
      return false;
  }
}

function evaluateNode(node, f, ctx) {
  const reasons = [];
  if (!node) return { match: true, reasons };
  if (node.type === 'and') {
    const a = evaluateNode(node.a, f, ctx);
    const b = evaluateNode(node.b, f, ctx);
    return { match: a.match && b.match, reasons: [...a.reasons, ...b.reasons] };
  }
  if (node.type === 'or') {
    const a = evaluateNode(node.a, f, ctx);
    const b = evaluateNode(node.b, f, ctx);
    const r = a.match ? a.reasons : b.reasons;
    return { match: a.match || b.match, reasons: r };
  }
  if (node.type === 'not') {
    const a = evaluateNode(node.a, f, ctx);
    return {
      match: !a.match,
      reasons: a.match ? [] : [{ kind: 'exclusion', text: `excluded "${describeNode(node.a)}"` }],
    };
  }
  if (node.type === 'filter') {
    if (node.key === 'in') return { match: true, reasons: [] }; // scope only
    const ok = filterMatches(f, node.key, node.value);
    if (ok) reasons.push({ kind: 'filter', text: `matched ${node.key}:${node.value}` });
    return { match: ok, reasons };
  }
  // term / phrase
  const scope = ctx.inScope || 'all';
  const allFields = {
    title: f.title || '',
    evidence: f.evidence || '',
    host: f.host || f.hostname || '',
    notes: f.notes || '',
    comments: Array.isArray(f.comments) ? f.comments.join('\n') : f.comments || '',
    hunt: f.huntName || '',
  };
  const names =
    scope === 'evidence'
      ? ['evidence']
      : scope === 'notes'
        ? ['notes', 'comments']
        : scope === 'title'
          ? ['title']
          : ['title', 'evidence', 'host', 'notes', 'comments', 'hunt'];
  const opts = {
    caseSensitive: !!ctx.caseSensitive,
    synonyms: ctx.synonyms !== false,
    multilingual: !!ctx.multilingual,
  };
  let hit = null;
  let field = null;
  for (const name of names) {
    const m = termMatches(node.value, allFields[name], opts);
    if (m) {
      hit = m;
      field = name;
      break;
    }
  }
  if (hit) {
    const label = hit !== String(node.value).toLowerCase() ? ` (via synonym "${hit}")` : '';
    reasons.push({ kind: 'term', text: `matched ${field}${label}` });
  }
  return { match: !!hit, reasons };
}

function describeNode(node) {
  if (!node) return '';
  if (node.type === 'term' || node.type === 'phrase') return node.value;
  if (node.type === 'filter') return `${node.key}:${node.value}`;
  if (node.type === 'not') return `NOT ${describeNode(node.a)}`;
  return `${describeNode(node.a)} ${node.type.toUpperCase()} ${describeNode(node.b)}`;
}

/** 50267 — human-readable relevance explanation. */
export function explainMatch(reasons = []) {
  return reasons.map(r => r.text).join('; ') || 'no match detail';
}

/* ------------------------------------------------------------------ */
/* Scoring, snippets, search()                                        */
/* ------------------------------------------------------------------ */

const SEV_WEIGHT = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };

function scoreResult(f, reasons) {
  let s = 10;
  for (const r of reasons) {
    if (r.kind === 'filter') s += 6;
    if (r.kind === 'term' && r.text.startsWith('matched title')) s += 8;
    else if (r.kind === 'term') s += 4;
  }
  s += SEV_WEIGHT[String(f.severity || '').toLowerCase()] || 0;
  if (f.starred) s += 3;
  if (f.reviewed === false) s += 1;
  return s;
}

/** 50249 — matched line with surrounding context from evidence/notes. */
export function snippet(f = {}, rawQuery = '', contextLines = 1) {
  const { ast } = parseQuery(rawQuery);
  const terms = [];
  const collect = n => {
    if (!n) return;
    if (n.type === 'term' || n.type === 'phrase') terms.push(n.value);
    if (n.a) collect(n.a);
    if (n.b) collect(n.b);
  };
  collect(ast);
  const texts = [
    f.title || '',
    f.evidence || '',
    f.notes || '',
    Array.isArray(f.comments) ? f.comments.join('\n') : f.comments || '',
  ];
  for (const text of texts) {
    const lines = String(text).split('\n');
    for (let i = 0; i < lines.length; i++) {
      const hit = terms.find(t =>
        !t.includes('*')
          ? lines[i].toLowerCase().includes(String(t).toLowerCase())
          : wildcardToRegExp(t).test(lines[i])
      );
      if (hit) {
        const from = Math.max(0, i - contextLines);
        const to = Math.min(lines.length - 1, i + contextLines);
        return { line: i + 1, text: lines.slice(from, to + 1).join('\n'), matchedTerm: hit };
      }
    }
  }
  return { line: 0, text: String(f.title || '').slice(0, 160), matchedTerm: '' };
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  return dp[m][n];
}

/** 50268 — did-you-mean over finding titles. 50245 — operator corrections. */
export function didYouMean(term, corpus = []) {
  const t = String(term || '').toLowerCase();
  let best = null;
  let bestD = Infinity;
  for (const c of corpus) {
    for (const w of String(c)
      .toLowerCase()
      .split(/[\s\-_/]+/)) {
      if (!w || w.length < 3) continue;
      const d = levenshtein(t, w);
      if (d < bestD && d <= Math.max(2, Math.floor(t.length / 3))) {
        bestD = d;
        best = w;
      }
    }
  }
  return best;
}

export function operatorHint(badToken) {
  const t = String(badToken || '').toLowerCase();
  let best = null;
  let bestD = Infinity;
  for (const k of [...OPERATOR_KEYS]) {
    const d = levenshtein(t, k);
    if (d < bestD && d <= 2) {
      bestD = d;
      best = k;
    }
  }
  return best ? `did you mean ${best}:?` : null;
}

/**
 * 50259 — full search with perf note. opts: caseSensitive, synonyms,
 * multilingual, includeArchived, inScope, corpus (for did-you-mean).
 */
export function search(findings = [], rawQuery = '', opts = {}) {
  const t0 = Date.now();
  const { ast, scope, filters } = parseQuery(rawQuery);
  const inScope = (filters.find(f => f.key === 'in') || {}).value || opts.inScope || 'all';
  const ctx = {
    caseSensitive: !!opts.caseSensitive,
    synonyms: opts.synonyms !== false,
    multilingual: !!opts.multilingual,
    inScope,
  };
  const pool = opts.includeArchived === false ? findings.filter(f => !f.archived) : findings;
  const results = [];
  for (const f of pool) {
    const { match, reasons } = evaluateNode(ast, f, ctx);
    if (match)
      results.push({
        finding: f,
        score: scoreResult(f, reasons),
        reasons,
        snippet: snippet(f, rawQuery),
      });
  }
  results.sort((a, b) => b.score - a.score);
  const ms = Math.max(1, Date.now() - t0);
  const out = { results, total: results.length, searched: pool.length, ms, scope, filters };
  if (!results.length && rawQuery.trim()) {
    const corpus = (opts.corpus || pool).map(f => f.title || '');
    const firstTerm = rawQuery.trim().split(/\s+/)[0].replace(/"/g, '');
    const fix = didYouMean(firstTerm, corpus);
    if (fix) out.correction = fix;
    const opish = firstTerm.match(/^([a-z]+):/i);
    if (opish && !OPERATOR_KEYS.has(opish[1].toLowerCase()))
      out.operatorHint = operatorHint(opish[1]);
  }
  return out;
}

/** 50243 — group ranked results with per-group counts. */
export function groupResults(results = [], by = 'severity') {
  const groups = new Map();
  for (const r of results) {
    const f = r.finding || {};
    let key = 'other';
    if (by === 'severity') key = String(f.severity || 'info').toLowerCase();
    else if (by === 'host') key = String(f.host || f.hostname || 'unknown');
    else if (by === 'type') key = String(f.type || f.category || 'finding');
    else if (by === 'hunt') key = String(f.huntName || 'hunt');
    else if (by === 'phase') key = String(f.phase || 'unknown');
    if (!groups.has(key)) groups.set(key, { key, count: 0, results: [] });
    const g = groups.get(key);
    g.count++;
    g.results.push(r);
  }
  const order = by === 'severity' ? ['critical', 'high', 'medium', 'low', 'info', 'other'] : null;
  const arr = [...groups.values()];
  if (order) arr.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  else arr.sort((a, b) => b.count - a.count);
  return arr;
}

/* ------------------------------------------------------------------ */
/* 50265 — encoded search URLs                                        */
/* ------------------------------------------------------------------ */

export function encodeSearch(state = {}) {
  const slim = {
    q: state.q || '',
    scope: state.scope || 'all',
    caseSensitive: !!state.caseSensitive,
    includeArchived: state.includeArchived !== false,
    multilingual: !!state.multilingual,
  };
  const json = JSON.stringify(slim);
  const b64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(json, 'utf8').toString('base64')
      : btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSearch(str = '') {
  try {
    const b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json =
      typeof Buffer !== 'undefined'
        ? Buffer.from(pad, 'base64').toString('utf8')
        : decodeURIComponent(escape(atob(pad)));
    const s = JSON.parse(json);
    return {
      q: s.q || '',
      scope: s.scope || 'all',
      caseSensitive: !!s.caseSensitive,
      includeArchived: s.includeArchived !== false,
      multilingual: !!s.multilingual,
    };
  } catch {
    return {
      q: '',
      scope: 'all',
      caseSensitive: false,
      includeArchived: true,
      multilingual: false,
    };
  }
}

/* ------------------------------------------------------------------ */
/* 50247 / 50255 / 50280 — persistent search history + ranked tops    */
/* ------------------------------------------------------------------ */

const HISTORY_KEY = 'infinityai.search.history.v1';
const SAVED_KEY = 'infinityai.search.saved.v1';

function lsGet(key, fallback) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return fallback;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key, val) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch {
    return false;
  }
}

/** Push a query; keeps { q, count, lastUsed }. Cap 100 entries. */
export function pushHistory(list = [], q = '') {
  const query = String(q).trim();
  if (!query) return list;
  const now = Date.now();
  const prev = list.find(h => h.q === query);
  const next = list.filter(h => h.q !== query);
  next.unshift({ q: query, count: (prev ? prev.count : 0) + 1, lastUsed: now });
  return next.slice(0, 100);
}

export function loadHistory() {
  return lsGet(HISTORY_KEY, []);
}
export function saveHistory(list) {
  return lsSet(HISTORY_KEY, list);
}

/** 50255 — suggestions ranked by recency + frequency. */
export function rankSuggestions(prefix = '', history = [], limit = 6) {
  const p = String(prefix).toLowerCase();
  const now = Date.now();
  return history
    .filter(h => h.q.toLowerCase().startsWith(p) && h.q.toLowerCase() !== p)
    .map(h => {
      const ageHrs = (now - (h.lastUsed || now)) / 3600000;
      const recency = Math.max(0, 1 - ageHrs / 168); // decays over a week
      return { ...h, rank: (h.count || 1) * 2 + recency * 3 };
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit);
}

/** 50280 — personal top queries. */
export function topQueries(history = [], limit = 8) {
  return [...history].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* 50264 / 50270 — saved searches, pinned widgets, digests            */
/* ------------------------------------------------------------------ */

export function loadSaved() {
  return lsGet(SAVED_KEY, []);
}
export function saveSaved(list) {
  return lsSet(SAVED_KEY, list);
}

export function saveSearchEntry(list = [], entry = {}) {
  const id = entry.id || `ss_${Date.now().toString(36)}`;
  const next = list.filter(s => s.id !== id);
  next.unshift({
    id,
    name: entry.name || entry.q || 'Saved search',
    q: entry.q || '',
    scope: entry.scope || 'all',
    pinned: !!entry.pinned,
    digest: !!entry.digest,
    lastCheck: entry.lastCheck || 0,
    createdAt: entry.createdAt || Date.now(),
  });
  return next.slice(0, 50);
}

/** 50270 — new matches since the saved search's last digest check. */
export function digestNewMatches(saved = {}, findings = []) {
  const since = saved.lastCheck || 0;
  const fresh = findings.filter(f => (f.createdAt || f.updatedAt || 0) > since);
  const { results } = search(fresh, saved.q || '', { synonyms: true });
  return results.map(r => r.finding);
}

/* ------------------------------------------------------------------ */
/* 50275 — similar-finding search                                     */
/* ------------------------------------------------------------------ */

/** Rank duplicate candidates for a finding (shared terms, host, type, sev). */
export function similarFindings(f = {}, all = [], limit = 5) {
  const words = new Set(
    String(f.title || '')
      .toLowerCase()
      .split(/[\s\-_/()]+/)
      .filter(w => w.length > 3)
  );
  const scored = [];
  for (const o of all) {
    if (o.id === f.id) continue;
    let s = 0;
    const ow = String(o.title || '')
      .toLowerCase()
      .split(/[\s\-_/()]+/);
    for (const w of words) if (ow.includes(w)) s += 2;
    if ((o.host || o.hostname) && (o.host || o.hostname) === (f.host || f.hostname)) s += 3;
    if (o.type && o.type === f.type) s += 2;
    if (o.severity && o.severity === f.severity) s += 1;
    if (s >= 3) scored.push({ finding: o, score: s });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* 50246 / 50261 / 50272 — scoped text search helpers                 */
/* ------------------------------------------------------------------ */

/** 50246 — in-card evidence search (Ctrl+F scope): all match offsets. */
export function searchInText(text = '', query = '', { caseSensitive = false } = {}) {
  const q = String(query);
  if (!q) return [];
  const hay = caseSensitive ? String(text) : String(text).toLowerCase();
  const needle = caseSensitive ? q : q.toLowerCase();
  const hits = [];
  let i = hay.indexOf(needle);
  while (i >= 0) {
    hits.push({ index: i, length: needle.length });
    i = hay.indexOf(needle, i + 1);
  }
  return hits;
}

/** 50261 — terminal log search with jump-to-line. */
export function searchTerminalLog(lines = [], query = '') {
  const q = String(query).toLowerCase();
  if (!q) return [];
  const out = [];
  lines.forEach((line, i) => {
    const text = typeof line === 'string' ? line : line.text || '';
    if (text.toLowerCase().includes(q)) out.push({ line: i + 1, text: text.slice(0, 200) });
  });
  return out;
}

/** 50272 — timeline text search: index of first matching event. */
export function searchTimeline(events = [], query = '') {
  const q = String(query).toLowerCase();
  if (!q) return -1;
  return events.findIndex(e =>
    String(e.label || e.text || e.type || '')
      .toLowerCase()
      .includes(q)
  );
}

/* ------------------------------------------------------------------ */
/* 50277 — typing-throttle indicator                                  */
/* ------------------------------------------------------------------ */

/**
 * Returns true when the UI should show a throttling hint: huge datasets
 * with very fast typing. Pure heuristic for the indicator component.
 */
export function shouldThrottleHint(datasetSize = 0, charsPerSecond = 0) {
  return datasetSize > 2000 && charsPerSecond > 12;
}

/* ------------------------------------------------------------------ */
/* 50253 — persistent per-tab filter state                            */
/* ------------------------------------------------------------------ */

export const RESULT_SCOPES = ['all', 'findings', 'notes', 'evidence'];

export function serializeScopeState(perScope = {}) {
  const slim = {};
  for (const s of RESULT_SCOPES) {
    slim[s] = {
      q: (perScope[s] || {}).q || '',
      caseSensitive: !!(perScope[s] || {}).caseSensitive,
    };
  }
  return JSON.stringify(slim);
}

export function deserializeScopeState(raw = '') {
  try {
    const s = JSON.parse(raw);
    const out = {};
    for (const key of RESULT_SCOPES)
      out[key] = { q: (s[key] || {}).q || '', caseSensitive: !!(s[key] || {}).caseSensitive };
    return out;
  } catch {
    return {
      all: { q: '', caseSensitive: false },
      findings: { q: '', caseSensitive: false },
      notes: { q: '', caseSensitive: false },
      evidence: { q: '', caseSensitive: false },
    };
  }
}

/* ------------------------------------------------------------------ */
/* 50278 / 50284 / 50288 — small action helpers                       */
/* ------------------------------------------------------------------ */

/** 50278 — build a "search this host" query from an asset chip. */
export function hostSearchQuery(host = '') {
  return host ? `host:${host}` : '';
}

/** 50284 — badge data every result row carries. */
export function resultBadge(f = {}) {
  return { severity: String(f.severity || 'info').toLowerCase(), hunt: f.huntName || 'hunt' };
}

/** 50288 — one-click chip narrowing results to the finding's phase. */
export function phaseChip(f = {}) {
  return f.phase ? `phase:${f.phase}` : '';
}

/** 50289 — starter queries shown on empty-box focus. */
export const STARTER_QUERIES = [
  'sev:critical',
  'has:poc',
  'is:unreviewed',
  'login OR auth',
  'host:',
  'after:"last week"',
];
