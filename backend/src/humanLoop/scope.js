// Split out of humanLoop.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; humanLoop.js re-exports the public names so callers are unchanged.

import { isInScope } from '../scopeParser.js';

export const OBS_BUDGET = 3500; // chars of an action result shown on the next screen

export const COMMAND_CAP = 4000; // same transport cap as the pipeline (solver #459)

// Hosts a hunter may legitimately touch without "attacking" them:
// downloading a tool is not testing a target. Anything else that is
// not the target (or a programme-listed asset) is out of scope.
const DOWNLOAD_HOSTS = new Set([
  'github.com', 'raw.githubusercontent.com', 'objects.githubusercontent.com',
  'pypi.org', 'files.pythonhosted.org', 'registry.npmjs.org', 'npmjs.org',
  'deb.debian.org', 'archive.kali.org', 'http.kali.org', 'ftp.debian.org',
  'dl.google.com', 'storage.googleapis.com',
]);

// Heavy automated scanning — blocked only when the programme forbids
// it (parsedScope.rules.noHeavyScan). Human-paced probes stay legal.
const HEAVY_SCAN_PATTERNS = [
  /\bmasscan\b/i,
  /\bnikto\b/i,
  /\bdirsearch\b/i,
  /\bgobuster\b[^|;&]*\b(dir|dns|fuzz)\b/i,
  /\bffuf\b[^|;&]*(-t\s*[2-9]\d|-rate\s*[2-9]\d)/i,
  /\bnmap\b[^|;&]*(-p-|--top-ports\s+\d{3,})/i,
  /\bsqlmap\b[^|;&]*(--level\s*[45]|--risk\s*3|--threads\s*[2-9]\d*)/i,
  /\bhydra\b/i,
  /\bnuclei\b[^|;&]*(-rate-limit\s*[2-9]\d|-bulk-size\s*[2-9]\d)/i,
];

export function targetHostOf(target) {
  try {
    return new URL(String(target)).hostname.toLowerCase();
  } catch {
    return '';
  }
}

// WRONG-PAGE GUARD (25 Oct 2026): the CDP driver refuses to type /
// click / snapshot when the live tab is not the target, and the
// observation it returns starts with "WRONG PAGE —". These helpers
// are the loop-side half of that guard: the target hosts the driver
// is bound to, whether a URL is on them, and the narrow dedupe
// exemption that lets the agent navigate BACK to the target when it
// is currently on a foreign page (Trap 4: every return-to-target
// open already ran x2, so dedupe blocked the way home forever).
export function targetHostsFor(target, parsedScope) {
  const hosts = [];
  const tHost = targetHostOf(target);
  if (tHost) hosts.push(tHost);
  for (const entry of (parsedScope && parsedScope.inScope) || []) {
    const d = String(entry).toLowerCase();
    if (d && !hosts.includes(d)) hosts.push(d);
  }
  // Structured lists (scopeParser, 1 Nov 2026): exact named assets
  // are bare entries; wildcard bases are `*.base` entries. The
  // matchers — hostOnTargetList here and onTargetHosts in the CDP
  // driver (guiTools.js) — treat `*.` entries as subdomain-only,
  // never the base itself (1-Nov exact-host rule). Without the
  // structured lists, named assets were invisible to the CDP
  // wrong-page guard and the agent could not drive a tab on them.
  for (const entry of (parsedScope && parsedScope.inScopeExactHosts) || []) {
    const d = String(entry).toLowerCase();
    if (d && !hosts.includes(d)) hosts.push(d);
  }
  for (const entry of (parsedScope && parsedScope.inScopeWildcardHosts) || []) {
    const d = String(entry).toLowerCase();
    const w = d.startsWith('*.') ? d : '*.' + d;
    if (d && !hosts.includes(w)) hosts.push(w);
  }
  return hosts;
}

function hostOnTargetList(host, hosts) {
  const h = String(host || '').toLowerCase();
  if (!h) return false;
  return (hosts || []).some((d) => {
    const dd = String(d).toLowerCase();
    // `*.base` entries authorize subdomains of the base, never the
    // base itself (1-Nov exact-host rule). Bare entries are exact:
    // a subdomain of the target or of an exact asset is NOT on
    // target unless a wildcard entry says so.
    if (dd.startsWith('*.')) {
      const base = dd.slice(2);
      return !!base && h !== base && h.endsWith('.' + base);
    }
    return h === dd;
  });
}

export function isOnTargetHosts(url, target, parsedScope) {
  let host = '';
  try {
    host = new URL(String(url)).hostname.toLowerCase();
  } catch {
    return false;
  }
  return hostOnTargetList(host, targetHostsFor(target, parsedScope));
}

// Narrow dedupe exemption: browser_open of a target-host URL is
// allowed when the current tab is provably NOT the target (the
// agent is on a foreign page — about:blank, our own frontend, an
// SSO hop that never landed — and must navigate home). Unknown
// current page ('') means NO exemption: a broken tracker must never
// open a re-open-forever loophole. Repeated opens while already ON
// the target are still deduped as before.
export function isReturnToTarget(kind, action, currentPageUrl, target, parsedScope) {
  if (String(kind || '').toLowerCase() !== 'browser_open') return false;
  if (!currentPageUrl) return false;
  if (isOnTargetHosts(currentPageUrl, target, parsedScope)) return false;
  const url = String((action && action.url) || '');
  return isOnTargetHosts(url, target, parsedScope);
}

// Extract the current page URL from a browser observation. The
// snapshot formatter's first line is "Page: <title> — <url>"; a
// wrong-page refusal names the URL in prose; about:blank is a real
// (empty) page, not an unknown one. Returns '' when no URL can be
// found — callers treat '' as "unknown", never as "on target".
export function pageUrlFromObservation(obs) {
  const s = String(obs || '');
  if (!s) return '';
  const pageLine = s.match(/^Page:.*—\s*(\S+)/m);
  // The text after the dash is the page URL only when it LOOKS like
  // one. A snapshot title can end in words instead — 'Page: Login ::
  // DVWA — Username Password Login' — and returning the first word
  // ('Username') as the page URL made isReturnToTarget exempt every
  // repeat open, so the dedup gate never fired (degraded-gate
  // loop(3a), 7 Nov 2026). A non-URL capture falls through to the
  // generic URL scan below, which finds the real URL in the
  // 'Opened ...' line instead.
  if (pageLine && /^https?:\/\//i.test(pageLine[1])) return pageLine[1];
  const wrong = s.match(/WRONG PAGE — you are on (\S+),/);
  if (wrong) return wrong[1];
  if (/about:blank/.test(s)) return 'about:blank';
  const url = s.match(/https?:\/\/[^\s'"<>)\]|,]+/i);
  return url ? url[0] : '';
}

/**
 * Clip a tool observation for the reasoning log. Probes put their VERDICT
 * as the last line by convention, so a pure head-truncate silently drops
 * the most important line. Keep the head (context) AND the tail (verdict).
 * Exported for tests.
 */
export function clipResult(observation) {
  const s = String(observation || '');
  if (s.length <= 800) return s;
  const omitted = s.length - 800;
  return s.slice(0, 400) + `\n…[truncated ${omitted} chars]…\n` + s.slice(-400);
}

// Seed for lastObservation at session start (fix 2): the last
// non-empty result the previous session recorded, so the new
// session does not start blind. Results that are themselves an
// empty-page snapshot are skipped — seeding one would re-trip the
// very gate the seed exists to defeat. Returns '' when the previous
// session left nothing usable; the turn-start snapshot then
// provides it.
export function lastActionResultOfLeftOff(leftOff) {
  const actions = (leftOff && leftOff.lastActions) || [];
  for (let i = actions.length - 1; i >= 0; i--) {
    const r = String((actions[i] && actions[i].result) || '').trim();
    if (r && !r.includes('(empty page snapshot)')) return r;
  }
  return '';
}

/**
 * Out-of-scope check for a URL string against the hunt's parsedScope.
 * Returns the offending URL, or null when allowed. Allows: the target
 * host itself (EXACT — its subdomains need an explicit `*.target`
 * wildcard, per the 1-Nov exact-host rule), any host the programme
 * lists in inScope (exact, or subdomains of a `*.` entry), anything
 * isInScope() accepts, and known tool-download hosts.
 */
export function scopeViolation(url, target, parsedScope) {
  let host = '';
  try {
    // Protocol-relative URLs (//host/path) carry a host but need a
    // scheme to parse — resolve them as https before judging.
    const raw = String(url);
    host = new URL(raw.startsWith('//') ? 'https:' + raw : raw).hostname.toLowerCase();
  } catch {
    // Unparseable absolute URL: fail closed. A malformed URL must not
    // slip past the guard. (Bare non-URL strings have no "://" and
    // are not judged here.)
    return String(url).includes('://') ? url : null;
  }
  if (!host) return null;
  const tHost = targetHostOf(target);
  // Named out-of-scope hosts beat everything else — including a
  // wildcard in-scope base AND the tool-download exemption (the
  // programme may name a download host out of scope; the named
  // exclusion wins). The hunt's own target host is exempt:
  // contradictory scope text must not brick the hunt itself.
  // (Lane D, 21 Oct 2026.)
  const outOfScopeHosts = parsedScope ? (parsedScope.outOfScopeHosts || []) : [];
  if (host !== tHost) {
    for (const oos of outOfScopeHosts) {
      const d = String(oos).toLowerCase();
      if (host === d || host.endsWith('.' + d)) return url;
    }
  }
  if (DOWNLOAD_HOSTS.has(host)) return null;
  // 1-Nov exact-host rule (scope-guard widening lane, 7 Nov 2026):
  // the target host authorizes ONLY itself — its subdomains need an
  // explicit `*.target` wildcard in the programme scope (checked by
  // isInScope() below). The old `host.endsWith('.' + tHost)` let any
  // target subdomain past this gate.
  if (tHost && host === tHost) return null;
  const inScope = parsedScope ? (parsedScope.inScope || []) : [];
  for (const entry of inScope) {
    const d = String(entry).toLowerCase();
    // Legacy inScope entries are named assets: exact-only. A `*.base`
    // entry (never emitted by parseScope, but possible in a hand-built
    // scope) authorizes subdomains of the base, never the base
    // itself — the same rule isInScope() applies to wildcards.
    if (d.startsWith('*.')) {
      const base = d.slice(2);
      if (base && host !== base && host.endsWith('.' + base)) return null;
    } else if (host === d) {
      return null;
    }
  }
  // No parsed scope: only the target host (+ download hosts, above)
  // pass. A missing scope must not mean "everything is allowed".
  if (!parsedScope) return url;
  return isInScope(url, parsedScope) ? null : url;
}

export function commandScopeViolation(command, target, parsedScope) {
  const urls = String(command).match(/(?:[a-z][a-z0-9+.-]*:)?\/\/[^\s'"<>)|\]]+/gi) || [];
  for (const u of urls) {
    const v = scopeViolation(u, target, parsedScope);
    if (v) return v;
  }
  return null;
}

export function heavyScanViolation(command, parsedScope) {
  if (!parsedScope || !parsedScope.rules || !parsedScope.rules.noHeavyScan) return null;
  for (const re of HEAVY_SCAN_PATTERNS) {
    if (re.test(String(command))) return re.source;
  }
  return null;
}

/**
 * The task block beside the action (KEYWORD-INDEX, 27 Oct 2026):
 * what the brain is doing right now, what it achieves, how far it
 * is — the hunt's current state, so the next turn resumes it instead
 * of starting fresh. Accepts the block nested under "task" or as
 * sibling fields of the action object. Validated: strings ≤300 chars,
 * status in_progress|complete (default in_progress). A malformed
 * block returns null and never breaks the action.
 */
export function extractTaskBlock(obj) {
  if (!obj || typeof obj !== 'object') return null;
  let src = null;
  const t = obj.task;
  if (typeof t === 'string') src = { task: t };
  else if (t && typeof t === 'object') src = t;
  else if (typeof obj.goal === 'string' || typeof obj.progress === 'string' || typeof obj.status === 'string' || typeof obj.summary === 'string') {
    src = { task: '', goal: obj.goal, progress: obj.progress, status: obj.status, summary: obj.summary };
  }
  if (!src) return null;
  const out = {};
  if (typeof src.task === 'string' && src.task.trim()) out.task = src.task.trim().slice(0, 300);
  if (typeof src.goal === 'string' && src.goal.trim()) out.goal = src.goal.trim().slice(0, 300);
  if (typeof src.progress === 'string' && src.progress.trim()) out.progress = src.progress.trim().slice(0, 300);
  if (typeof src.summary === 'string' && src.summary.trim()) out.summary = src.summary.trim().slice(0, 300);
  const status = typeof src.status === 'string' ? src.status.trim().toLowerCase() : '';
  if (status === 'complete' || status === 'in_progress') out.status = status;
  if (!out.task && !out.goal && !out.progress && !out.summary && !out.status) return null;
  if (!out.status) out.status = 'in_progress';
  return out;
}

/**
 * Parse the model's action: the LAST JSON object in the reply that
 * carries an "action" string. Tolerant by design (the 8B wraps JSON
 * in prose and code fences): scan balanced {...} spans, try each from
 * the end. Returns { action, jsonStart, task } or null — `task` is
 * the task block beside the action, when the brain sent one.
 */
export function parseHumanAction(reply) {
  if (!reply) return null;
  const text = String(reply);
  const spans = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        spans.push([start, i]);
        start = -1;
      }
      if (depth < 0) depth = 0;
    }
  }
  for (let i = spans.length - 1; i >= 0; i--) {
    const [s, e] = spans[i];
    try {
      const obj = JSON.parse(text.slice(s, e + 1));
      if (obj && typeof obj.action === 'string' && obj.action) {
        return { action: obj, jsonStart: s, task: extractTaskBlock(obj) };
      }
    } catch { /* try the previous span */ }
  }
  return null;
}
