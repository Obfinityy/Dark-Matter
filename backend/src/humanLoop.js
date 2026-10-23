// Dark Matter — HUMAN MODE: one free hunter, not a pipeline.
//
// The staged pipeline (recon -> plan-of-3 -> injected deterministic
// probes -> special-command grammar) made the agent a form-filler: it
// could only do what a stage allowed, and the model almost never used
// the SEARCH:/WRITE_ARTIFACT: grammar bolted onto it (0 organic uses,
// audited 20 Oct 2026). The owner's model of the product is a HIRED
// HUMAN: give them a target and a machine, and they work — they look
// at the screen, think, click, search, write a script, run it, read
// the output, adapt — in one fluid loop, non-stop.
//
// humanIteration() is that loop, bounded to a number of turns per call
// (the hunt loop calls it repeatedly, forever, until stop/credits):
//
//   PERCEIVE  the "screen": memory briefing (full history + global
//             lessons) + findings so far + live machine state (pwd,
//             workspace listing) + the last action's full result.
//   THINK     one chatWithAI call. The model thinks briefly in prose,
//             then ends with EXACTLY ONE self-chosen action as JSON.
//   ACT       shell / search / write_file / note / browser_* /
//             proxy_start / intercept_* (Lane U) / screenshot /
//             claim_finding — executed through the SAME machinery
//             the pipeline uses (executeWithEvasion for shell,
//             webSearch, artifacts, guiTools, proxyIntercept).
//   OBSERVE   the result becomes the next turn's screen. Nothing is
//             hidden and nothing is staged.
//
// What deliberately STAYS (programme law + the 100% truth rule, not
// scaffolding): parsedScope enforcement (out-of-scope hosts blocked,
// heavy scanners blocked when the programme forbids them, the
// requests-per-minute cap paced between shell actions) and the
// pipeline verifier for claimed findings — a claim is re-run and
// judged by assessResult; the hunter can never verify its own claim.
// No deterministic probes are injected here, ever.
//
// Everything external is an injectable dep (opts.deps) so the loop is
// testable end-to-end with fakes — see scripts/test-human-loop.mjs.

import { execInHuntContainerWithRespawn } from './huntRunner.js';
import { chatWithAI } from './llm.js';
import { webSearch } from './webSearch.js';
import { writeArtifact, spillOutput, artifactInfo } from './artifacts.js';
import { appendHuntEvent, readHuntMeta, writeHuntMetaCheckpoint, readHuntEvents } from './store.js';
import { isInScope } from './scopeParser.js';
import { recordReasoning, getAllReasoning, buildFullHistoryLedger, searchRecall } from './reasoningMemory.js';
import { getRelevantMemories, formatGlobalMemoryForPrompt, readAllGlobalMemories } from './globalMemory.js';
import { listSkills, loadSkill } from './skillCards.js';
import {
  loadCoverage,
  saveCoverage,
  applyRecord,
  recordCoverage,
  updateCoverage,
  mergeResearchDebt,
  openGapRows,
  probedClassIds,
  normaliseSurface,
  normaliseCoverageClass,
  classLabelFor,
} from './coverageLedger.js';
import {
  guiBrowserOpen,
  guiBrowserSnapshot,
  guiBrowserClick,
  guiBrowserType,
  guiBrowserScreenshot,
} from './guiTools.js';
// Lane U: the Burp-style intercept workflow (mitmproxy inside the
// hunt container; see proxyIntercept.js for the topology). The pure
// replay builders + signature are imported directly — deterministic
// code, exercised through the dispatch with a fake capture read.
import {
  startInterceptProxy,
  listIntercept,
  readInterceptEntry,
  buildReplayRequest,
  buildReplayCurl,
  replaySignature,
} from './proxyIntercept.js';
// Lane O: huntMemory.js is the single read path for the hunt's
// permanent record (reasoning, events, findings, coverage, the
// ruled-out registry, dossier, left-off, prior hunts of the same
// target). The pure record helpers that used to live in this file
// (applyRetractions, retractedFindingCount, extractDossierBriefing,
// deadEndLines) moved there and are re-exported below, so existing
// imports keep working unchanged.
import {
  loadHuntMemory,
  buildStateOfMind,
  applyRetractions,
  retractedFindingCount,
  extractDossierBriefing,
  deadEndLines,
} from './huntMemory.js';

export { applyRetractions, retractedFindingCount, extractDossierBriefing, deadEndLines };

const OBS_BUDGET = 3500; // chars of an action result shown on the next screen
const COMMAND_CAP = 4000; // same transport cap as the pipeline (solver #459)

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

function targetHostOf(target) {
  try {
    return new URL(String(target)).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Out-of-scope check for a URL string against the hunt's parsedScope.
 * Returns the offending URL, or null when allowed. Allows: the target
 * host itself, any host the programme lists in inScope (domain or
 * subdomain of it), anything isInScope() accepts, and known
 * tool-download hosts.
 */
export function scopeViolation(url, target, parsedScope) {
  if (!parsedScope) return null;
  let host = '';
  try {
    host = new URL(String(url)).hostname.toLowerCase();
  } catch {
    return null; // unparseable — not a host we can judge
  }
  if (!host) return null;
  if (DOWNLOAD_HOSTS.has(host)) return null;
  const tHost = targetHostOf(target);
  // Named out-of-scope hosts beat everything else — including a
  // wildcard in-scope base (the programme may put *.ys7.com in scope
  // while naming test.ys7.com out; the named exclusion wins). The
  // hunt's own target host is exempt: contradictory scope text must
  // not brick the hunt itself. (Lane D, 21 Oct 2026.)
  if (host !== tHost) {
    for (const oos of parsedScope.outOfScopeHosts || []) {
      const d = String(oos).toLowerCase();
      if (host === d || host.endsWith('.' + d)) return url;
    }
  }
  if (tHost && (host === tHost || host.endsWith('.' + tHost))) return null;
  for (const entry of parsedScope.inScope || []) {
    const d = String(entry).toLowerCase();
    if (host === d || host.endsWith('.' + d)) return null;
  }
  return isInScope(url, parsedScope) ? null : url;
}

function commandScopeViolation(command, target, parsedScope) {
  if (!parsedScope) return null;
  const urls = String(command).match(/https?:\/\/[^\s'"<>)\]|]+/gi) || [];
  for (const u of urls) {
    const v = scopeViolation(u, target, parsedScope);
    if (v) return v;
  }
  return null;
}

function heavyScanViolation(command, parsedScope) {
  if (!parsedScope || !parsedScope.rules || !parsedScope.rules.noHeavyScan) return null;
  for (const re of HEAVY_SCAN_PATTERNS) {
    if (re.test(String(command))) return re.source;
  }
  return null;
}

/**
 * Parse the model's action: the LAST JSON object in the reply that
 * carries an "action" string. Tolerant by design (the 8B wraps JSON
 * in prose and code fences): scan balanced {...} spans, try each from
 * the end. Returns { action, jsonStart } or null.
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
        return { action: obj, jsonStart: s };
      }
    } catch { /* try the previous span */ }
  }
  return null;
}

// ---------------------------------------------------------------------------
// MEMORY BRIEFING (Lane G, 21 Oct 2026 — owner order: "it HAS memory, so it
// must never redo work it already did").
//
// AUDIT of what reached the human-mode screen before this change (measured
// with a synthetic hunt modelled on the live Ezviz pattern — 30 reasoning
// rows, 60 tool calls, 2 rejected claims, 7 ruled_out rows):
//   - system prompt 2,163 chars; screen 5,287 chars total on a young hunt;
//     briefing section 3,919 chars (ledger 3,437 + global memory ~480).
//   - The briefing was ONLY buildFullHistoryLedger (action budget 6,000)
//     followed by global memory (sliced to 1,500), the whole thing sliced
//     at 7,500 — so the lowest-density content (raw action lines) sat
//     FIRST and the lessons were the first thing the cap ate on a mature
//     hunt.
//   - The dead-end registry (episodeStore ruled_out — the validator-gated
//     lessons the pipeline renders via formatLessonsForPrompt) was NEVER
//     imported here: 0 bytes of it reached the human-mode brain.
//   - The ledger's own DEAD ENDS line is structurally always empty in
//     human mode: note() writes reasoning rows with hypothesis '', and
//     the ledger groups dead ends by hypothesis (measured deadEnds: 0
//     even with rejected claims in the record). A rejected claim showed
//     up only as a raw "[unverified]" line among the action history.
//   - "Researched but never probed" was computed NOWHERE: SSTI appeared
//     only as 16 identical raw "search:" action lines.
// The builders below fix the content side (Lane F adds the hard dedupe
// gate on the action side). Priority order inside the SAME 7,500-char
// briefing cap: (a) dead ends for this target, (b) researched-but-not-
// probed next-action candidates, (c) distilled global lessons, then the
// full-history ledger fills whatever budget remains. A section whose
// source is empty is omitted silently — no placeholder text, ever.

const BRIEFING_BUDGET = 7500; // the pre-existing briefing cap — unchanged

const clipLine = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

const normTitle = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// (a) Dead ends for this target are rendered by deadEndLines in
// huntMemory.js (imported + re-exported above) — the single memory
// read path owns the record helpers since Lane O.

// Technique topics for the researched-not-probed derivation. `research`
// matches the topic in searches/notes/stated intent; `probes` are the
// payload/signature shapes that count as an actual test against the
// target (plus a topic mention inside an executed shell/browser/claim
// action). Deliberately conservative: reading about a technique never
// counts as probing it.
//
// `testValue` / `testNote` (Lane J, 22 Oct 2026) are the canonical
// FIRST probe for the class — the textbook test value and what its
// result would mean — used only to GROUND the unprobed-leads section
// in a concrete payload shape (see unprobedLeadLines). They are
// perception text, never an executed action: the hunter still chooses
// every action itself.
export const PROBE_TOPICS = [
  { id: 'ssti', label: 'SSTI (template injection)', re: /\bssti\b|template injection/i, probes: [/\{\{[^}]{0,60}\}\}/, /\$\{[^}]{0,60}\}/, /\{%[^%]{0,60}%}/], testValue: '{{7*7}}', testNote: 'if the response shows 49, the template engine evaluated your input' },
  { id: 'xss', label: 'XSS (cross-site scripting)', re: /\bxss\b|cross[- ]site scripting/i, probes: [/<script\b/i, /\balert\s*\(/, /\bonerror\s*=/i, /<svg\b/i, /\bprompt\s*\(/], testValue: '<script>alert(1)</script>', testNote: 'then check whether your marker comes back in the page unescaped' },
  { id: 'sqli', label: 'SQL injection', re: /\bsqli\b|sql injection/i, probes: [/\bunion\s+(all\s+)?select\b/i, /'\s*or\s+('?1'?|\d+)\s*=\s*\1/i, /'\s*(--|#)/, /\b(sleep|benchmark)\s*\(\s*\d/i], testValue: "' OR 1=1", testNote: "compare with the same request using ' OR 1=2 — if the two answers differ, the input reaches the query" },
  { id: 'ssrf', label: 'SSRF', re: /\bssrf\b|server[- ]side request forgery/i, probes: [/169\.254\.169\.254/, /metadata\.google/i, /100\.100\.100\.200/, /\bgopher:\/\//i], testValue: 'http://169.254.169.254/latest/meta-data/', testNote: 'watch whether the server fetches it or the answer changes' },
  { id: 'xxe', label: 'XXE', re: /\bxxe\b|xml external entit/i, probes: [/<!ENTITY/i, /<!DOCTYPE[^>]*\[/], testValue: 'an XML body declaring <!ENTITY xxe SYSTEM "file:///etc/passwd">', testNote: "if the response contains the file's contents, the parser resolved your entity" },
  { id: 'lfi', label: 'LFI / path traversal', re: /\blfi\b|path traversal|directory traversal|local file inclusion/i, probes: [/\.\.[/\\]\.\.[/\\]/, /\/etc\/passwd/, /%2e%2e(%2f|\/)/i], testValue: '../../etc/passwd', testNote: "if the response contains 'root:' lines, the server read the file" },
  { id: 'cmdi', label: 'command injection', re: /command injection|\bos command\b/i, probes: [/[;|&`]\s*(id|whoami|sleep\s+\d)/i, /\$\(\s*(id|whoami)/], testValue: 'test; id', testNote: 'if a uid= line from id appears in the response, the command ran' },
  { id: 'jwt', label: 'JWT attacks', re: /\bjwt\b|json web token/i, probes: [/eyJ[A-Za-z0-9_-]{5,}\.eyJ/, /alg["']?\s*[:=]\s*["']?none/i], testValue: 'the session token with its header alg set to none and an empty signature', testNote: 'if the API still accepts it, signature verification is missing' },
  { id: 'cors', label: 'CORS misconfiguration', re: /\bcors\b|cross-origin/i, probes: [/origin\s*:/i], testValue: 'https://evil.example', testNote: 'if the response reflects it in Access-Control-Allow-Origin while allowing credentials, it is misconfigured', via: (param) => 'with an Origin: https://evil.example header' },
  { id: 'headers', label: 'security headers', re: /security headers|content-security-policy|\bcsp\b|clickjacking/i, probes: [/curl\s+[^|;&]*-[a-zA-Z]*I\b/, /curl\s+[^|;&]*--head\b/i], testValue: '', testNote: 'missing Content-Security-Policy or X-Frame-Options on a page with a login form is a reportable weakness', via: () => 'by running curl -s -I on it and reading which security headers are absent', oneShot: true },
  { id: 'openredirect', label: 'open redirect', re: /open redirect/i, probes: [/[?&](url|next|redirect|redirect_uri|return|dest|target)=https?%3a/i], testValue: 'https://example.com', testNote: 'if the browser lands on example.com, the redirect is open' },
  { id: 'graphql', label: 'GraphQL', re: /graphql/i, probes: [/\/graphql\b/i, /\{\s*__schema\b/, /\bintrospection\b/i], testValue: '{__schema{types{name}}}', testNote: 'a full schema answer means introspection is switched on' },
  { id: 'fileupload', label: 'file upload', re: /file upload|upload vulnerab|unrestricted upload/i, probes: [/curl\s+[^|;&]*\s-F\b/, /multipart\/form-data/i], testValue: 'a small test file (first a harmless .txt, then an .html carrying a marker)', testNote: 'if the file is afterwards reachable and served as-is, the upload is unrestricted', pathRe: /upload/i, via: () => 'by sending a real file with curl -F' },
];

/**
 * Per-topic research/probe accounting over the hunt's own record —
 * the shared counting core for the briefing's researched-not-probed
 * section (Lane G) and the concrete unprobed leads (Lane J). Returns
 * [{ topic, n, probed }] for every topic with n > 0, most-researched
 * first. `probed` means a payload-signature action for the topic
 * exists somewhere in the record (see PROBE_TOPICS).
 */
export function researchedTopicStats({ events = [], reasoningRows = [] } = {}) {
  // Counting rule (kept explainable — the hunter is shown these
  // numbers): a research hit is one SEARCH action (counted from its
  // tool_call event; the mirrored reasoning row for the same search is
  // a duplicate and skipped) or one distinct note/intent snippet from
  // a non-search reasoning row, deduplicated by text.
  const counts = new Map(); // topicId -> hits
  const noteSnippets = new Map(); // topicId -> Set of normalised snippets
  const probeText = [];
  const hit = (t) => counts.set(t.id, (counts.get(t.id) || 0) + 1);
  for (const e of events || []) {
    if (!e || e.type !== 'tool_call') continue;
    const detail = String(e.detail || '');
    if (e.tool === 'search') {
      for (const t of PROBE_TOPICS) if (t.re.test(detail)) hit(t);
    } else if (['shell', 'browser_open', 'browser_click', 'browser_type', 'claim_finding', 'intercept_replay'].includes(e.tool)) {
      probeText.push(detail);
    }
  }
  for (const r of reasoningRows || []) {
    if (!r) continue;
    const action = String(r.action || '');
    if (action.startsWith('search:')) continue; // duplicate of the tool_call event
    if (/^(shell|claim_finding):/.test(action)) probeText.push(action);
    // Notes and stated intent in a row's why/learned count as research,
    // never as a probe — thinking about a technique is not testing it.
    const intent = `${r.why || ''} ${r.learned || ''}`;
    if (!intent.trim()) continue;
    for (const t of PROBE_TOPICS) {
      if (!t.re.test(intent)) continue;
      if (!noteSnippets.has(t.id)) noteSnippets.set(t.id, new Set());
      const key = normTitle(intent).slice(0, 140);
      if (!noteSnippets.get(t.id).has(key)) {
        noteSnippets.get(t.id).add(key);
        hit(t);
      }
    }
  }
  const probeBlob = probeText.join('\n');
  const out = [];
  for (const t of PROBE_TOPICS) {
    const n = counts.get(t.id) || 0;
    if (!n) continue;
    const probed = t.re.test(probeBlob) || t.probes.some((re) => re.test(probeBlob));
    out.push({ topic: t, n, probed });
  }
  out.sort((a, b) => b.n - a.n);
  return out;
}

/**
 * (b) Researched but not yet probed: topics this hunt has searched or
 * noted (or stated as intent in a reasoning row's "why") with NO probe
 * action against the target anywhere in the hunt's own record. One line
 * each, phrased as an explicit next-action candidate. Pure; capped at 6,
 * most-researched first.
 */
export function researchedNotProbedLines({ events = [], reasoningRows = [] } = {}) {
  return researchedTopicStats({ events, reasoningRows })
    .filter((s) => !s.probed)
    .slice(0, 6)
    .map((s) => `- ${s.topic.label}: researched ×${s.n} in your searches/notes, never probed — candidate next action: send ONE real probe for this at the target now instead of researching it again.`);
}

// ---------------------------------------------------------------------------
// UNPROBED LEADS + ENDPOINT COVERAGE (Lane J, 22 Oct 2026)
//
// Live diagnosis on the Ezviz hunt (iter 148, 2,121 events, 633 tool
// calls, 0 genuine verified): 335 of 633 tool calls were web searches
// (53%); after a search the next action was another search 62% of the
// time and a shell probe only 14 times in the whole hunt. Lane G's
// briefing section DID render ("command injection: researched ×64,
// never probed — send ONE real probe for this at the target") — but it
// named no page, no input and no payload, and the brain's own record
// shows what that produces: a thinking block resolving to "send a
// real probe for command injection at the target now", followed by a
// plain registration POST carrying no payload at all. Intent without
// grounding does not convert. The surface the hunt itself discovered
// (/rest/user/login with username+password, /rest/user/profile with
// file=, /upload opened twice) was never presented back as a coverage
// map, so researched classes and known endpoints never met on screen:
// file upload was researched repeatedly while /upload never received
// a single probe (no multipart action exists in the record).
//
// The builders below derive BOTH halves from the hunt's own record
// and join them into concrete leads: researched class × discovered
// endpoint × the input it takes × the canonical first test value.
// Pure perception — nothing is executed, injected or staged; the
// hunter remains the sole decision-maker.
// ---------------------------------------------------------------------------

const URL_IN_TEXT = /https?:\/\/[^\s'"<>)\]|]+/gi;

function paramNamesFrom(text) {
  const names = [];
  const seen = new Set();
  const add = (n) => {
    if (n && !seen.has(n) && names.length < 6) {
      seen.add(n);
      names.push(n);
    }
  };
  for (const m of String(text || '').matchAll(/"([A-Za-z_][\w-]*)"\s*:/g)) add(m[1]);
  for (const m of String(text || '').matchAll(/(?:^|[&\s'"])([A-Za-z_][\w-]*)=/g)) add(m[1]);
  return names;
}

/**
 * The hunt's discovered endpoint coverage, derived ONLY from its own
 * tool_call record: every URL on the target host the hunter has
 * touched (browser_open, or a URL inside a shell command), with how
 * often, which input names it was seen taking (query keys + body
 * keys), whether data was ever sent to it, and which probe classes
 * have actually reached it (payload-signature match on the actions
 * that touched it). Sorted most-visited first. Pure.
 */
export function discoveredEndpoints(events, target) {
  const tHost = targetHostOf(target);
  if (!tHost) return [];
  const byKey = new Map();
  const touch = (rawUrl, text, dataSent) => {
    let u;
    try {
      u = new URL(rawUrl);
    } catch {
      return;
    }
    if (u.hostname.toLowerCase() !== tHost) return;
    let p = u.pathname || '/';
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    const key = `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${p}`;
    let ep = byKey.get(key);
    if (!ep) {
      ep = { url: key, path: p, visits: 0, params: [], dataSent: false, probeActions: 0, probedClasses: new Set() };
      byKey.set(key, ep);
    }
    ep.visits++;
    if (dataSent) ep.dataSent = true;
    for (const name of paramNamesFrom(`${u.search || ''} ${text || ''}`)) {
      if (!ep.params.includes(name) && ep.params.length < 6) ep.params.push(name);
    }
    let probedHere = false;
    for (const t of PROBE_TOPICS) {
      if (t.probes.some((re) => re.test(text || ''))) {
        ep.probedClasses.add(t.id);
        probedHere = true;
      }
    }
    if (probedHere) ep.probeActions++;
  };
  for (const e of events || []) {
    if (!e || e.type !== 'tool_call') continue;
    const detail = String(e.detail || '');
    if (!detail) continue;
    if (e.tool === 'browser_open') {
      touch(detail.trim(), detail, false);
    } else if (e.tool === 'shell') {
      const dataSent = /(-d\b|--data|-X\s*(POST|PUT|PATCH|DELETE)\b|-F\b)/i.test(detail);
      for (const m of detail.match(URL_IN_TEXT) || []) touch(m, detail, dataSent);
    }
  }
  return [...byKey.values()]
    .map((ep) => ({ ...ep, probedClasses: [...ep.probedClasses] }))
    .sort((a, b) => b.visits - a.visits);
}

/**
 * How many actions in the record carry a payload signature for the
 * topic — the strict, per-class probe count (events side only; the
 * same tool set the topic accounting treats as probe-capable).
 */
export function probeSignatureHits(events, topic) {
  if (!topic || !Array.isArray(topic.probes)) return 0;
  let hits = 0;
  for (const e of events || []) {
    if (!e || e.type !== 'tool_call') continue;
    if (!['shell', 'browser_open', 'browser_click', 'browser_type', 'claim_finding'].includes(e.tool)) continue;
    const detail = String(e.detail || '');
    if (detail && topic.probes.some((re) => re.test(detail))) hits++;
  }
  return hits;
}

/**
 * Concrete unprobed leads: the join of researchedTopicStats and
 * discoveredEndpoints. Two kinds, topic leads first:
 *   1. a researched class that has never been probed — or that the
 *      binary probed flag credits on glancing evidence only (at most
 *      one payload-signature action against ≥5 research hits, and
 *      the class is not one whose canonical probe is a single
 *      observation) — grounded on the best discovered endpoint for
 *      it (a path match for the class, else the most-visited
 *      endpoint that takes input and has not been probed for this
 *      class), naming the input and the canonical first test value.
 *      On the live Ezviz record this tier is what surfaces SQL
 *      injection at all: researched ×104, its entire "probing" one
 *      typed fragment (`sql' --` in a form field).
 *   2. a discovered endpoint that has never received any probe at
 *      all (the bare root path is the lobby, not a lead, and is
 *      skipped unless it takes parameters), ordered so an endpoint
 *      matching an unprobed class's path pattern and endpoints
 *      taking parameters come before plain pages.
 * An endpoint already probed for a class is not offered for it; an
 * endpoint that receives a probe drops off the coverage list.
 * Pure; capped at `limit` lines, each clipped.
 */
export function unprobedLeadLines({ events = [], reasoningRows = [], target = '', limit = 6 } = {}) {
  const allStats = researchedTopicStats({ events, reasoningRows });
  const neverProbed = allStats.filter((s) => !s.probed).map((s) => ({ ...s, glancing: -1 }));
  const glancing = allStats
    .filter((s) => s.probed && !s.topic.oneShot && s.n >= 5)
    .map((s) => ({ ...s, glancing: probeSignatureHits(events, s.topic) }))
    .filter((s) => s.glancing <= 1);
  const topicLeads = [...neverProbed, ...glancing].sort((a, b) => b.n - a.n).slice(0, 4);
  const endpoints = discoveredEndpoints(events, target);
  const lines = [];
  const namedUrls = new Set();
  // 1. Topic leads — researched class × concrete surface.
  for (const s of topicLeads) {
    const t = s.topic;
    const candidates = endpoints.filter((ep) => !ep.probedClasses.includes(t.id));
    // Rank: endpoints no probe of ANY class has reached first (virgin
    // input surface beats re-working an endpoint another class is
    // already on), then most-visited.
    const ranked = [...candidates].sort((a, b) => (a.probeActions > 0 ? 1 : 0) - (b.probeActions > 0 ? 1 : 0) || b.visits - a.visits);
    const pathMatch = t.pathRe ? ranked.find((ep) => t.pathRe.test(ep.path)) : null;
    const ep = pathMatch || ranked.find((e) => e.params.length || e.dataSent) || ranked[0] || null;
    const where = ep ? ep.url : String(target || '');
    if (ep) namedUrls.add(ep.url);
    const param = ep && ep.params.length ? ep.params[0] : '';
    const via = t.via
      ? t.via(param)
      : param
        ? `with ${param} set to ${t.testValue}`
        : t.testValue
          ? `with a test input set to ${t.testValue}`
          : '';
    // Topics carrying their own phrasing (t.via) name the method
    // themselves; the rest get a plain method + endpoint + input.
    const lead = t.via
      ? `Concrete next probe: ${where}${via ? ` ${via}` : ''} — ${t.testNote}.`
      : `Concrete next probe: ${ep && ep.dataSent ? 'POST' : 'send a request to'} ${where}${via ? ` ${via}` : ''} — ${t.testNote}.`;
    const researched = s.glancing < 0
      ? `researched ×${s.n}, never probed`
      : s.glancing === 0
        ? `researched ×${s.n}; no payload for it exists anywhere in your record — never actually probed`
        : `researched ×${s.n}; your whole record holds exactly one glancing attempt at it — never a complete probe`;
    lines.push(clipLine(`- ${t.label} — ${researched}. ${lead}`, 280));
  }
  // 2. Coverage leads — discovered surface no probe has ever reached,
  // ordered: an endpoint matching a lead-eligible class's path
  // pattern first, then endpoints taking parameters, then the rest
  // by visits.
  const coverage = endpoints
    .filter((ep) => ep.probeActions === 0 && !(ep.path === '/' && !ep.params.length) && !namedUrls.has(ep.url))
    .map((ep) => {
      const pair = topicLeads.find((s) => s.topic.pathRe && s.topic.pathRe.test(ep.path)) ||
        allStats.find((s) => !s.probed && s.topic.pathRe && s.topic.pathRe.test(ep.path));
      return { ep, pair };
    })
    .sort((a, b) => (b.pair ? 1 : 0) - (a.pair ? 1 : 0) || (b.ep.params.length ? 1 : 0) - (a.ep.params.length ? 1 : 0) || b.ep.visits - a.ep.visits);
  for (const { ep, pair } of coverage) {
    if (lines.length >= limit) break;
    const paramNote = ep.params.length ? ` It takes parameters: ${ep.params.join(', ')}.` : '';
    const pairNote = pair ? ` It pairs with your unprobed research: ${pair.topic.label} (researched ×${pair.n}, never probed).` : '';
    lines.push(clipLine(`- ${ep.url} — discovered in your own record (visited ×${ep.visits}), never probed: no test payload has ever been sent to it.${paramNote}${pairNote}`, 280));
  }
  return lines.slice(0, limit);
}

// ---------------------------------------------------------------------------
// COVERAGE LEDGER + SESSION RECONCILIATION (Lane L, 22 Oct 2026)
//
// Lane J made researched-but-unprobed classes concrete for the
// CURRENT screen, but its leads are recomputed from the raw record
// every turn and carry no accounting: nothing records that a class
// was ever DELIBERATELY closed, and research debt evaporates at the
// session boundary (Lane I's open threads are recomputed hunt-wide,
// not accumulated). Lane L adds the durable half, re-implementing
// the state contracts Lane K extracted from usestrix/strix (§1.6,
// §3 P1+P4) in our idiom:
//
//   P1 — a per-hunt coverage ledger (coverageLedger.js): rows keyed
//   by (surface, class), written by the brain's own record_coverage
//   action, with code-enforced uniqueness (a second row for a key
//   returns the existing row instead of duplicating) and closure
//   evidence (ruled_out / not_applicable must name the control).
//   Open rows render on screen next to Lane J's leads and take
//   precedence over them (mergeLeadsWithCoverage below).
//
//   P4 — at session end, the classes researched in THIS session are
//   reconciled against probe actions and ledger rows
//   (reconcileSessionResearch below). Unaccounted research becomes
//   an open_gap ledger row + a leftOff open item, and the cumulative
//   researched-vs-probed counters (research debt) persist in the
//   ledger, so "researched ×104, never probed" is a tracked debt
//   the briefing shows, not a statistic that resets.
//
// One free hunter preserved: record_coverage is the brain's choice,
// like recall/note; nothing probes or claims on its behalf. The P4
// reconciliation writes ONLY bookkeeping rows about research debt —
// it records that research is unaccounted, never that a probe
// happened. DOSSIER.md is deliberately NOT written here:
// consolidation.js owns it and regenerates it wholesale, so open
// items live in leftOff + the ledger instead of fighting it.
// ---------------------------------------------------------------------------

/** The topic a Lane J lead line belongs to, when it names one. */
function leadTopicOf(line) {
  const s = String(line || '');
  for (const t of PROBE_TOPICS) {
    if (s.startsWith(`- ${t.label} `) || s.startsWith(`- ${t.label} —`)) return t;
    if (s.includes(`pairs with your unprobed research: ${t.label} (`)) return t;
  }
  return null;
}

/** The first URL a lead line names (its grounded surface), or ''. */
function leadUrlOf(line) {
  const m = /https?:\/\/[^\s'"]+/.exec(String(line || ''));
  return m ? m[0].replace(/[.,;]+$/, '') : '';
}

/**
 * Merge Lane J's computed leads with the coverage ledger for the
 * screen. Precedence rule: a ledger row accounts for its
 * (surface, class) key, so a computed lead for the SAME key is
 * dropped — the ledger line replaces it. A row recorded against
 * the hunt target as a whole additionally takes precedence over
 * that class's topic lead (the brain accounted for the class on
 * the target generally; the concrete computed lead would only
 * re-list the same class). Computed leads still cover every class
 * and endpoint with no row yet. Returns { leads, coverage }:
 * the filtered Lane J lines, and the ledger lines (open gaps
 * first, then research debt for classes no row accounts for).
 * Pure.
 */
export function mergeLeadsWithCoverage({ leads = [], rows = [], debt = {}, target = '' } = {}) {
  const rowList = Array.isArray(rows) ? rows : [];
  const targetSurface = normaliseSurface(target);
  const hasRow = (surface, cls) => rowList.some((r) => r.class === cls && r.surface === surface);
  const keptLeads = [];
  for (const line of leads || []) {
    const topic = leadTopicOf(line);
    if (topic) {
      const url = normaliseSurface(leadUrlOf(line));
      if (hasRow(url, topic.id) || (targetSurface && hasRow(targetSurface, topic.id))) continue;
    }
    keptLeads.push(line);
  }
  const coverage = [];
  const gaps = openGapRows({ rows: rowList })
    .slice()
    .sort((a, b) => ((debt[b.class] && debt[b.class].researched) || 0) - ((debt[a.class] && debt[a.class].researched) || 0));
  for (const r of gaps.slice(0, 6)) {
    const d = debt[r.class];
    const debtNote = d && d.researched > 0 && !d.probed ? ` — researched ×${d.researched} across sessions, still unprobed` : '';
    const ev = r.evidence ? ` ${clipLine(r.evidence, 140)}` : '';
    coverage.push(clipLine(`- OPEN GAP: ${r.surface} × ${classLabelFor(r.class)}${debtNote}.${ev}`, 280));
  }
  const gapClasses = new Set(gaps.map((r) => r.class));
  const accounted = new Set(rowList.map((r) => r.class));
  const debtLines = Object.entries(debt || {})
    .filter(([cls, d]) => d && Number(d.researched) > 0 && !d.probed && !gapClasses.has(cls) && !accounted.has(cls))
    .sort((a, b) => (Number(b[1].researched) || 0) - (Number(a[1].researched) || 0))
    .slice(0, 3)
    .map(([cls, d]) => clipLine(`- RESEARCH DEBT: ${classLabelFor(cls)} — researched ×${d.researched} across ${d.sessionsResearched || 1} session(s), still unprobed, and no coverage row accounts for it yet.`, 280));
  return { leads: keptLeads, coverage: [...coverage, ...debtLines].slice(0, 8) };
}

/**
 * Session-end reconciliation (Lane L P4) — pure. Diffs the classes
 * researched in THIS session (the session's own event/reasoning
 * slice, counted by the same researchedTopicStats machinery the
 * briefing uses) against (a) probe-signature actions in the same
 * slice and (b) any coverage-ledger row for the class. Returns:
 *   openItems  — leftOff lines for researched-but-unaccounted classes
 *   gapInputs  — open_gap row inputs for those classes (surface =
 *                the hunt target; the ledger's uniqueness rule means
 *                re-running this never duplicates a row)
 *   debtStats  — [{ id, n, probed }] for EVERY class researched this
 *                session, for the cumulative debt merge
 * A class probed this session, or already carrying any ledger row,
 * is accounted and produces no open item.
 */
export function reconcileSessionResearch({ sessionEvents = [], sessionRows = [], coverageData = null, target = '' } = {}) {
  const stats = researchedTopicStats({ events: sessionEvents, reasoningRows: sessionRows });
  const rows = coverageData && Array.isArray(coverageData.rows) ? coverageData.rows : [];
  const prevDebt = (coverageData && coverageData.researchDebt) || {};
  const openItems = [];
  const gapInputs = [];
  const debtStats = [];
  for (const s of stats) {
    debtStats.push({ id: s.topic.id, n: s.n, probed: s.probed });
    if (s.probed) continue;
    if (rows.some((r) => r.class === s.topic.id)) continue;
    const cumulative = (Number(prevDebt[s.topic.id] && prevDebt[s.topic.id].researched) || 0) + s.n;
    openItems.push(`- ${s.topic.label}: researched ×${s.n} this session (×${cumulative} across all sessions), 0 probes — carried open in your coverage ledger.`);
    gapInputs.push({
      surface: String(target || ''),
      class: s.topic.id,
      outcome: 'open_gap',
      evidence: `Researched ×${s.n} this session with no probe and no coverage row; opened by session-end reconciliation — memory bookkeeping about research debt, not a probe.`,
    });
  }
  return { openItems, gapInputs, debtStats };
}

/** The observation text for a record_coverage result. */
function coverageObservation(result, { surface, cls }) {
  const label = classLabelFor(cls);
  if (!result) return 'Coverage ledger unavailable this turn — nothing was recorded.';
  if (result.status === 'created' || result.status === 'updated') {
    const row = result.row || {};
    return `Coverage ${result.status === 'created' ? 'recorded' : 'updated'}: ${row.surface || surface} × ${label} → ${row.outcome}. Your ledger is your accounting: a surface × class counts as dealt with only when its row says so, and an open_gap row stays on your screen until you probe it or close it with a named control.`;
  }
  if (result.status === 'duplicate') {
    const row = result.row || {};
    return `Already on your coverage ledger: ${row.surface || surface} × ${label} is recorded as ${row.outcome}${row.evidence ? ` (evidence: ${clipLine(row.evidence, 160)})` : ''}. A surface × class is accounted for exactly once, so nothing was written. To change the row, send record_coverage again with "update":true.`;
  }
  return `NOT recorded: ${result.error || 'the coverage write was rejected'}.`;
}

/**
 * (c) Distilled global-memory lessons relevant to this target type, as
 * compact one-liners (reuses the store's own prompt formatter, header
 * stripped). Capped at 5 lines.
 */
export function globalLessonLines(memories = []) {
  let text = '';
  try {
    text = formatGlobalMemoryForPrompt(memories || []);
  } catch {
    return [];
  }
  if (!text) return [];
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('•'))
    .slice(0, 5)
    .map((l) => `- ${clipLine(l.replace(/^•\s*/, ''), 200)}`);
}

/**
 * Assemble the memory briefing in binding priority order inside the
 * existing cap: dead ends → researched-not-probed → global lessons →
 * full-history ledger (the caller sizes the ledger to the budget this
 * head leaves). Empty sources contribute nothing — no placeholders.
 */
export function assembleMemoryBriefing({ deadEnds = [], unprobed = [], globalLessons = [], ledgerText = '', dossierText = '', budgetChars = BRIEFING_BUDGET } = {}) {
  const head = [];
  if (dossierText) head.push(['--- FROM YOUR DOSSIER (open threads / next step) ---', String(dossierText)].join('\n'));
  if (deadEnds.length) head.push(['--- DEAD ENDS ON THIS TARGET (tried and failed here — do not repeat these) ---', ...deadEnds].join('\n'));
  if (unprobed.length) head.push(['--- RESEARCHED BUT NEVER PROBED (your own open threads) ---', ...unprobed].join('\n'));
  if (globalLessons.length) head.push(['--- LESSONS FROM ALL PAST HUNTS ---', ...globalLessons].join('\n'));
  const headText = head.join('\n\n');
  const parts = [headText, String(ledgerText || '')].filter((p) => p && p.trim());
  return parts.join('\n').slice(0, budgetChars);
}

/** Length of the priority head alone — sizes the ledger's budget. */
export function memoryHeadLength({ deadEnds = [], unprobed = [], globalLessons = [], dossierText = '' } = {}) {
  return assembleMemoryBriefing({ deadEnds, unprobed, globalLessons, dossierText, ledgerText: '', budgetChars: Number.MAX_SAFE_INTEGER }).length;
}

// ---------------------------------------------------------------------------
// WORKING MEMORY (Lane I, 21 Oct 2026 — owner order: "make it like a
// human — when he is thinking he knows his past, what he has done
// already, and what he is doing now").
//
// Three truth fixes on top of Lanes F+G:
//   * RETRACTIONS: Lane A appended 'retraction' events for the two
//     false Ezviz FTP stamps, but every display path still read the
//     raw finding events, so the brain kept seeing its own retracted
//     claims stamped [VERIFIED]. applyRetractions is the display-side
//     truth filter (the verifier itself is untouched).
//   * DOSSIER: consolidation writes DOSSIER.md into the hunt dir, but
//     human mode never read it — its distilled open threads / next
//     step now lead the briefing. ONLY those two sections are read:
//     the dossier's Confirmed-facts section can still carry
//     pre-retraction pollution, so it is never surfaced here.
//   * CONTINUITY + JOURNAL + RECALL live in humanIteration below.
// ---------------------------------------------------------------------------

// applyRetractions / retractedFindingCount live in huntMemory.js
// since Lane O (imported + re-exported above).

// extractDossierBriefing lives in huntMemory.js since Lane O
// (imported + re-exported above); the dossier itself is loaded by
// loadHuntMemory, so the briefing below reads it from the snapshot.

export function buildMemoryBriefing(huntId, target, meta) {
  try {
    // Lane O: every hunt-local source comes through the single
    // memory read path (huntMemory.loadHuntMemory), which loads and
    // reconciles the reasoning record, the event record, the
    // retraction-filtered findings, the ruled-out registry and the
    // dossier from disk — tolerantly, so a torn line in any store
    // costs that line, never the briefing.
    const memory = loadHuntMemory(huntId, { target, meta });
    const rows = memory.reasoningRows;
    const events = memory.events;
    // Lane I: retracted claims are not findings — the ledger must not
    // keep stamping them [VERIFIED] after their retraction landed.
    const findings = memory.findings;
    // Lane I: the dossier consolidation wrote for this target leads
    // the briefing (open threads + next step only — see above).
    const dossierText = memory.dossierBriefing;

    // (a) dead ends for this target — validator registry + rejected claims
    const deadEnds = deadEndLines({ ruledOut: memory.ruledOut, events });
    // (b) researched but never probed — from the hunt's own record
    const unprobed = researchedNotProbedLines({ events, reasoningRows: rows });
    // (c) distilled global lessons for this target type
    let globalLessons = [];
    try {
      const fp = (meta && meta.appFingerprint) || (memory.meta && memory.meta.appFingerprint) || { appType: 'unknown', techStack: [] };
      globalLessons = globalLessonLines(getRelevantMemories(fp, 6));
    } catch { /* global memory is best-effort */ }

    // The ledger fills whatever the priority head leaves of the
    // existing cap (its own action budget was 6,000 when it stood
    // alone; findings/dead-end fixed lines always render in full).
    const headLen = memoryHeadLength({ deadEnds, unprobed, globalLessons, dossierText });
    const ledgerBudget = Math.max(1200, Math.min(6000, BRIEFING_BUDGET - headLen - 1));
    const ledger = buildFullHistoryLedger({
      reasoningRows: rows,
      findings,
      chainContext: (meta && meta.chainContext) || (memory.meta && memory.meta.chainContext) || null,
      budgetChars: ledgerBudget,
    });
    return assembleMemoryBriefing({
      deadEnds,
      unprobed,
      globalLessons,
      dossierText,
      ledgerText: ledger.text || '',
      budgetChars: BRIEFING_BUDGET,
    });
  } catch {
    return '';
  }
}

function systemPromptFor(target, parsedScope) {
  const rules = [];
  if (parsedScope && parsedScope.rules) {
    if (parsedScope.rules.noHeavyScan) rules.push('NO automated scanners or heavy traffic — single, human-paced, targeted probes only');
    if (parsedScope.rules.maxRequestsPerMin) rules.push(`at most ${parsedScope.rules.maxRequestsPerMin} requests per minute to the target`);
    if (parsedScope.rules.noDoS) rules.push('no denial-of-service, ever');
  }
  rules.push('test ONLY your own accounts and data — never touch another user\'s data');
  rules.push('non-destructive: read and probe, do not break or delete anything');
  return [
    `You are an elite human bug-bounty hunter who has been hired to test ${target}. You are sitting at your own Kali machine. You see the machine's current state below.`,
    'You also have a real desktop with a Chromium browser on this machine: you can open pages, SEE them (browser_snapshot gives you the page text and its clickable elements), click and type like a person at a computer, and take screenshots.',
    'Each reply: first think briefly like a human (what you notice, what you wonder, what you will try next and why), then give EXACTLY ONE action as a JSON object on the last line:',
    '{"action":"shell","command":"..."} — run any shell command on your machine (curl, nmap, python3, anything installed — or download/install what you need)',
    '{"action":"search","query":"..."} — search the web (techniques, CVEs, docs)',
    '{"action":"write_file","name":"x.py","content":"..."} — save a file or script in your workspace; run it later with a shell action',
    '{"action":"browser_open","url":"..."} — open a page in your desktop browser',
    '{"action":"browser_snapshot"} — see the current page: its text and clickable elements',
    '{"action":"browser_click","text":"visible label OR CSS selector"} — click in the desktop browser',
    '{"action":"browser_type","text":"...","submit":true} — type into the page field (submit=true presses Enter)',
    '{"action":"screenshot"} — capture the desktop to a PNG artifact; you also get the page text',
    '{"action":"proxy_start"} — start your intercepting proxy (Burp-style) on this machine: your browser is re-routed through it so EVERY request/response is captured, and you get the intercept dashboard URL — open it in your browser to click through captured requests visually. The proxy is pass-through: traffic is captured, never held.',
    '{"action":"intercept_list"} — list the requests your proxy has captured (newest last, each with a # index)',
    '{"action":"intercept_read","index":3} — read one captured request in full: its headers and body, and the response headers and body',
    '{"action":"intercept_replay","index":3,"headers":{"X-Test":"1"},"body":"changed=1","url":"http://target.test/other"} — resend a captured request from your machine, optionally with a changed URL, extra/changed headers (a null value removes a header), or a changed body. This is Burp Repeater work: change ONE thing at a time and compare the response. The URL is scope-checked like any other action.',
    '{"action":"note","text":"..."} — write a note in your own notebook (your memory is permanent)',
    '{"action":"recall","query":"..."} — search YOUR OWN memory: this hunt\'s full record and the lessons of every past hunt. Use it whenever your briefing mentions something you need in detail — an exact result, a payload you tried, a lesson — instead of re-doing the work; remembering is free and instant.',
    '{"action":"record_coverage","surface":"the page/endpoint/feature","class":"the vuln class","outcome":"probed_clean|confirmed|ruled_out|not_applicable|open_gap","evidence":"what you observed"} — account for a surface × class in your coverage ledger. Each pair is recorded exactly once; closing as ruled_out or not_applicable REQUIRES the evidence to name the control that stops the class. Add "update":true to change an existing row. Researched-but-unprobed classes are carried as open gaps automatically — closing them is how they leave your screen.',
    '{"action":"load_skill","skill":"sqli"} — pull one of your SKILL CARDS: a compact procedure for a vuln class (attack surface, detection channels, numbered testing steps, and the proof bar a claim must clear). Pull one when you OPEN a class, instead of searching the web — the card\'s steps end in a probe. The card index is on every screen; one card at a time.',
    '{"action":"claim_finding","title":"...","class":"sqli","evidence":"the exact output that proves it","command":"the exact command that produced that evidence","counterevidence":"the control/baseline result that could have disproved it","confidence":"high|medium|low","confidence_rationale":"required when confidence is not high"} — claim a vulnerability. The filing is complete-the-proof gated: a claim missing any of title, class, a runnable reproduction ("command", or "poc" naming a proof script saved in this hunt), evidence, counterevidence, or confidence is bounced back UNRECORDED with the missing pieces named — complete the package and claim again. A complete claim goes to an independent verifier, which re-runs your command and checks the evidence; ONLY verified findings count. Never claim without reproduced evidence.',
    'Act like a person: if you need a tool, download it; if you don\'t know something, search; if output is interesting, dig; one step at a time — you will see the result on the next screen.',
    `Programme rules you must obey: ${rules.join('; ')}.`,
  ].join('\n');
}

function findingsFromEvents(deps, huntId) {
  try {
    return applyRetractions(deps.readEvents(huntId));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// COMPLETE-THE-PROOF GATE (Lane N, 22 Oct 2026 — Lane K's Strix P3,
// re-implemented by reference; no Strix code copied)
//
// Strix's report tool refuses to file a vulnerability until the proof
// package is complete (PoC + evidence + counterevidence + confidence),
// because a verifier handed prose has to re-argue the claim instead of
// checking artefacts. Our claim path had the same hole: claim_finding
// recorded (or sent to assessResult) whatever title/evidence/command
// the brain supplied, so half-proved claims reached the verifier as
// assertions. This gate is the deterministic completeness half of
// that contract, applied at the recording point in the claim_finding
// branch — BEFORE the verifier is invoked and before any finding is
// recorded. It judges COMPLETENESS ONLY, never truth: assessResult
// remains the sole judge of whether a complete claim is real.
//
// A claim is complete when it carries ALL of:
//   - title — one line naming the vulnerability;
//   - class — the vuln class ("class" field, normalised through the
//     coverage ledger's class normaliser; when the field is absent,
//     a PROBE_TOPICS match on the title supplies it);
//   - a runnable reproduction — the exact "command" (the claim path's
//     existing last-shell-command fallback counts, exactly as the
//     recording path has always used it) OR "poc" naming an artefact
//     that exists in this hunt's own artifacts (checked through
//     deps.pocExists, so a fabricated handle bounces);
//   - evidence — the exact output that proves it, at least
//     CLAIM_EVIDENCE_MIN chars: a real response excerpt, not a bare
//     assertion like "it worked";
//   - counterevidence — what the hunter checked that could have
//     disproved the claim (for a differential class, the baseline /
//     control result beside the trigger result);
//   - confidence — high | medium | low; when not high, a
//     confidence_rationale is required.
//
// An incomplete claim is NOT recorded and the verifier never sees
// it. The brain gets ONE observation naming every missing piece and
// the field that supplies it, and the refusal is recorded as a
// claim_bounce event (the dedup_block pattern: countable by
// monitors, so the bounce rate is measurable). The gate injects no
// actions and adds no stages — it only shapes a filing the hunter
// chose to make.
// ---------------------------------------------------------------------------

export const CLAIM_EVIDENCE_MIN = 30; // chars of real output, not an assertion
export const CLAIM_COUNTER_MIN = 10; // chars — more than "n/a" or "checked"
export const CLAIM_COMMAND_MIN = 8; // chars — a real probe command, not a word

/** Vuln class from a claim title via PROBE_TOPICS (deterministic). */
export function claimClassFromTitle(title) {
  const t = String(title || '');
  if (!t.trim()) return '';
  for (const topic of PROBE_TOPICS) if (topic.re.test(t)) return topic.id;
  return '';
}

/**
 * The completeness check. Pure: artefact existence arrives as the
 * caller-computed `pocExists` boolean. Returns
 * { ok, missing: [{ field, hint }], cls } — every missing piece is
 * named with the field that supplies it, so the bounce observation
 * can be assembled without further logic.
 */
export function claimGateCheck({
  title = '',
  cls = '',
  command = '',
  poc = '',
  pocExists = false,
  evidence = '',
  counterevidence = '',
  confidence = '',
  rationale = '',
} = {}) {
  const missing = [];
  if (!String(title).trim()) {
    missing.push({ field: 'title', hint: '"title" — one line naming the vulnerability' });
  }
  if (!String(cls).trim()) {
    missing.push({ field: 'class', hint: '"class" — the vuln class (e.g. "sqli", "xss"); or name the class in the title so it can be matched' });
  }
  if (String(command).trim().length < CLAIM_COMMAND_MIN && !pocExists) {
    missing.push(poc
      ? { field: 'poc', hint: `"poc" — the artefact "${String(poc).slice(0, 80)}" is not in this hunt's artifacts; save the proof script with write_file first, or give the exact "command" instead` }
      : { field: 'command', hint: '"command" — the exact command that reproduces it (the verifier re-runs it), or "poc" naming a proof script you saved in this hunt' });
  }
  if (String(evidence).trim().length < CLAIM_EVIDENCE_MIN) {
    missing.push({ field: 'evidence', hint: '"evidence" — the exact output that proves it: a real excerpt of the response/output, not a summary or an assertion' });
  }
  if (String(counterevidence).trim().length < CLAIM_COUNTER_MIN) {
    missing.push({ field: 'counterevidence', hint: '"counterevidence" — what you checked that could have disproved this: the control/baseline result beside the trigger (e.g. the \' OR 1=2 response next to \' OR 1=1), or the strongest false-positive explanation and what ruled it out' });
  }
  const conf = String(confidence || '').trim().toLowerCase();
  if (!['high', 'medium', 'low'].includes(conf)) {
    missing.push({ field: 'confidence', hint: '"confidence" — "high", "medium" or "low" (add "confidence_rationale" whenever it is not high)' });
  } else if (conf !== 'high' && !String(rationale).trim()) {
    missing.push({ field: 'confidence_rationale', hint: '"confidence_rationale" — confidence is not high, so say why: what is still uncertain about this claim' });
  }
  return { ok: missing.length === 0, missing, cls: String(cls || '') };
}

/**
 * The session journal (Lane I): this session's own trail, one line
 * per executed action — turn, kind + short detail, and a ≤80-char
 * result summary. A human glancing at his own last hour does not
 * re-derive it from a lifetime ledger; the loop's log IS that trail
 * (entries carry detail since Lane I). Pure over the log.
 */
export function sessionJournalLines(logEntries) {
  return (logEntries || []).map((l) => {
    const detail = l.detail ? ` ${clipLine(l.detail, 70)}` : '';
    const result = clipLine(l.observation || '', 80);
    return `- Turn ${l.turn}: ${l.action}${detail}${result ? ` → ${result}` : ''}`;
  });
}

/**
 * The left-off block (Lane I): the previous session's structured
 * hand-off, rendered high on the screen so the hunter resumes its
 * own train of thought instead of starting cold. Pure over the
 * persisted meta.humanLoop.leftOff object.
 */
export function leftOffLines(leftOff) {
  if (!leftOff || typeof leftOff !== 'object') return [];
  const lines = ['=== WHERE YOU LEFT OFF (last session) ==='];
  if (leftOff.lastThinking) lines.push(`Your train of thought when you stopped: ${clipLine(leftOff.lastThinking, 240)}`);
  if (Array.isArray(leftOff.lastActions) && leftOff.lastActions.length) {
    lines.push('Your last actions:');
    for (const a of leftOff.lastActions) {
      if (!a) continue;
      const detail = a.detail ? ` ${clipLine(a.detail, 80)}` : '';
      const result = a.result ? ` → ${clipLine(a.result, 80)}` : '';
      lines.push(`- ${a.tool || a.action || ''}${detail}${result}`);
    }
  }
  if (leftOff.lastNote) lines.push(`Your last note to self: ${clipLine(leftOff.lastNote, 220)}`);
  if (Array.isArray(leftOff.openThreads) && leftOff.openThreads.length) {
    lines.push('Open threads you left:');
    for (const t of leftOff.openThreads.slice(0, 6)) {
      const s = String(t);
      lines.push(s.startsWith('-') ? s : `- ${s}`);
    }
  }
  return lines.length > 1 ? lines : [];
}

// ---------------------------------------------------------------------------
// FAILED-ACTION FOLLOW-THROUGH (Lane T, 23 Oct 2026)
//
// Lane P stopped a session hand-off from presenting a dedup-BLOCKED
// attempt as the pending step. The sibling failure survived live on
// the lab hunt (h_bench_d69e5746): turn 8's browser_click on
// "ftp/acquisitions.md" FAILED — "Click failed: no clickable element
// matches … Take a browser_snapshot and use an exact label from
// it." — and turn 9, in the SAME session, never mentioned the click
// or its feedback; it silently re-opened the /ftp page with
// reasoning copied from an older framing. The failure WAS in the
// record (the journal lists it, the reasoning row quotes it) but
// nothing carried it forward as an obligation, so the brain walked
// past it.
//
// This block rebuilds that obligation deterministically from the
// hunt's own records, refreshed on EVERY turn (the same per-turn
// discipline as the Lane I briefing refresh and the Lane J leads —
// a session-start computation would miss failures mid-session,
// which is exactly the live case):
//
//   DETECT  the most recent EXECUTED action whose recorded result
//           is a clear failure. Only the loop's and tools' own
//           failure framings count (recordedActionFailure) — never
//           target content that merely sounds like an error. Gate
//           blocks are NOT executions and never appear here: they
//           emit no tool_call event, their reasoning rows carry the
//           "dedup_block:" label, and Lane P hands them off as
//           "Do NOT retry" threads — the two mechanisms are
//           disjoint by construction, so they can never duplicate.
//   CARRY   while unaddressed, ONE open thread in the screen's
//           never-trimmed continuity region (beside the left-off
//           block), quoting the actual action, the actual error
//           and the tool's own feedback.
//   CLEAR   a later executed action addresses the failure when it
//           is in the same tool family (a browser_snapshot after a
//           failed click; another shell command after a failed one)
//           OR its detail shares a significant stem token with the
//           failed detail (the "ftp" stem shared by the failed `ftp`
//           shell command, the `curl … /ftp` retry and the
//           browser_open of /ftp). Only the LATEST failure is ever
//           carried — a newer failure supersedes an older one.
//   EXPIRE  after 3 later executed actions that do not address it,
//           the thread drops. The record itself is permanent; only
//           the nagging stops.

/** Tool families for the clearing rule above. */
const FOLLOW_TOOL_FAMILY = {
  shell: 'shell',
  intercept_replay: 'shell',
  browser_open: 'browser',
  browser_snapshot: 'browser',
  browser_click: 'browser',
  browser_type: 'browser',
  screenshot: 'browser',
  search: 'search',
  write_file: 'write',
  proxy_start: 'intercept',
  intercept_list: 'intercept',
  intercept_read: 'intercept',
  recall: 'recall',
  record_coverage: 'coverage',
  load_skill: 'skill',
};

/**
 * Tools whose executed failures are carried as a follow-through
 * thread. Deliberately narrow: these are the tools whose reasoning
 * rows record a result framing this module can judge, and whose
 * failure leaves a concrete next step behind. Search / recall /
 * coverage failures are transient or self-evident and have no
 * follow-through step; claim outcomes are the verifier's verdicts,
 * not tool errors.
 */
const FOLLOW_FAILURE_TOOLS = new Set([
  'shell',
  'intercept_replay',
  'browser_open',
  'browser_click',
  'browser_type',
  'write_file',
]);

/** Later executed actions an unaddressed failure survives. */
const FOLLOW_EXPIRE_AFTER = 3;

/**
 * Significant stem tokens of an action detail, for the clearing
 * rule: scheme + host are stripped wherever they appear (every
 * action in a hunt shares the target's host, so host tokens can
 * never distinguish one action from another), pure numbers and
 * short fragments are dropped.
 */
function followStemTokens(detail) {
  const s = String(detail || '').toLowerCase().replace(/[a-z][a-z0-9+.-]*:\/\/[^/\s]+/g, ' ');
  const stop = new Set(['http', 'https', 'www']);
  const out = new Set();
  for (const t of s.split(/[^a-z0-9]+/)) {
    if (t.length >= 3 && !/^\d+$/.test(t) && !stop.has(t)) out.add(t);
  }
  return out;
}

/**
 * The failure a recorded action result represents, or null.
 * Conservative by construction: a leading tool-error line from
 * guiTools, the exec layer's own "Command failed: docker exec …"
 * error echo, or the trailing "[exit code N]" marker the loop
 * appends when a command exits non-zero. A successful result never
 * carries these framings — a 404 inside page text, the word "error"
 * in output a command printed, or an exit code of 0 do not match.
 */
function recordedActionFailure(tool, result) {
  const res = String(result || '');
  if (!res) return null;
  // Gate blocks are not executions (Lane P hands them off as
  // do-not-retry threads); a bounced claim is a gate verdict.
  if (res.startsWith('BLOCKED') || res.startsWith('CLAIM NOT RECORDED')) return null;
  const firstLine = res.split('\n').map((s) => s.trim()).filter(Boolean)[0] || '';
  const leads = (prefixes) => prefixes.some((p) => res.startsWith(p));
  switch (tool) {
    case 'browser_click':
      return leads(['Click failed', 'browser_click failed', 'Browser control failed']) ? { error: firstLine } : null;
    case 'browser_type':
      return leads(['Type failed', 'browser_type failed', 'Browser control failed']) ? { error: firstLine } : null;
    case 'browser_open':
      return leads(['browser_open failed', 'Browser control failed']) ? { error: firstLine } : null;
    case 'write_file':
      return leads(['write_file failed']) ? { error: firstLine } : null;
    case 'shell': {
      const exit = /\[exit code ([1-9]\d*)\]\s*$/.exec(res.trimEnd());
      if (exit) return { error: firstLine, exitCode: exit[1] };
      if (res.startsWith('Command failed: docker exec')) return { error: firstLine };
      if (res.startsWith('Shell action failed to run:')) return { error: firstLine };
      return null;
    }
    case 'intercept_replay': {
      const exit = /\[curl exit code ([1-9]\d*)\]\s*$/.exec(res.trimEnd());
      if (exit) return { error: firstLine, exitCode: exit[1] };
      if (res.startsWith('Replay failed to run:')) return { error: firstLine };
      return null;
    }
    default:
      return null;
  }
}

/**
 * The failed-action follow-through thread for the hunter's screen,
 * or [] when there is nothing to carry. Pure over the hunt's
 * records: tool_call events are the executed-action timeline
 * (blocked attempts emit none), reasoning rows carry each action's
 * recorded result. See the Lane T header above for the detect /
 * carry / clear / expire rules.
 */
export function failedActionThreadLines({ events = [], reasoningRows = [] } = {}) {
  const steps = [];
  for (const e of events || []) {
    if (!e || e.type !== 'tool_call') continue;
    steps.push({ tool: String(e.tool || '').toLowerCase(), detail: String(e.detail || '') });
  }
  const byTool = new Map();
  steps.forEach((s, i) => {
    if (!byTool.has(s.tool)) byTool.set(s.tool, []);
    byTool.get(s.tool).push(i);
  });
  // Pair each reasoning row with the executed step it reports on:
  // same tool, earliest unpaired step whose detail agrees with the
  // row's (a row's detail is a sliced copy of its step's). A row for
  // an attempt that never executed (a gate block) finds no agreeing
  // step and stays unpaired — harmless, since blocks are never
  // failure candidates anyway.
  const agrees = (stepDetail, rowDetail) => {
    const a = String(stepDetail || '').trim();
    const b = String(rowDetail || '').trim();
    if (!b) return true; // detail-less rows (browser_type) pair with the next step of their tool
    if (!a) return false;
    return a.startsWith(b) || b.startsWith(a);
  };
  const used = new Set();
  let lastPosition = -1;
  let latest = null;
  for (const r of reasoningRows || []) {
    const m = /^([a-z][a-z_]*)(?::\s?(.*))?$/.exec(String((r && r.action) || '').trim());
    if (!m) continue;
    const tool = m[1];
    if (tool === 'dedup_block' || !FOLLOW_FAILURE_TOOLS.has(tool)) continue;
    const rowDetail = String(m[2] || '');
    let position = lastPosition;
    for (const idx of byTool.get(tool) || []) {
      if (used.has(idx)) continue;
      if (agrees(steps[idx].detail, rowDetail)) {
        used.add(idx);
        position = idx;
        break;
      }
    }
    if (position > lastPosition) lastPosition = position;
    const failure = recordedActionFailure(tool, r.result);
    if (!failure) continue;
    const detail = (position >= 0 && steps[position] && steps[position].detail) || rowDetail;
    if (!latest || position >= latest.position) latest = { tool, detail, position, ...failure };
  }
  if (!latest) return [];
  // Clearing + expiry over the actions executed after the failure.
  const family = FOLLOW_TOOL_FAMILY[latest.tool] || '';
  const stems = followStemTokens(latest.detail);
  let unaddressed = 0;
  for (let i = latest.position + 1; i < steps.length; i++) {
    const s = steps[i];
    if (family && FOLLOW_TOOL_FAMILY[s.tool] === family) return []; // addressed
    if (stems.size) {
      const toks = followStemTokens(s.detail);
      let hit = false;
      for (const t of stems) if (toks.has(t)) { hit = true; break; }
      if (hit) return []; // addressed
    }
    unaddressed++;
  }
  if (unaddressed >= FOLLOW_EXPIRE_AFTER) return []; // expired
  const detail = clipLine(latest.detail, 120);
  let error = clipLine(latest.error || '', 220);
  if (latest.exitCode && !error.includes('exit code')) error += ` [exit code ${latest.exitCode}]`;
  return [
    '=== OPEN THREAD — YOUR LAST ACTION FAILED (follow through or pivot) ===',
    `- FAILED: ${latest.tool}${detail ? ` "${detail}"` : ''} — ${error}`,
    'Follow through on it now — the feedback above says how — or consciously choose a different next step. Do not silently repeat the move you were already making.',
  ];
}

/** The detail a log/journal entry carries for one parsed action. */
function detailForAction(kind, action) {
  switch (kind) {
    case 'shell': return String(action.command || '').slice(0, 160);
    case 'search': return String(action.query || '').slice(0, 160);
    case 'write_file': return String(action.name || '').slice(0, 120);
    case 'note': return String(action.text || '').slice(0, 160);
    case 'browser_open': return String(action.url || '').slice(0, 160);
    case 'browser_click': return String(action.text || '').slice(0, 120);
    case 'browser_type': return String(action.text || '').slice(0, 80);
    case 'claim_finding': return String(action.title || '').slice(0, 160);
    case 'recall': return String(action.query || '').slice(0, 160);
    case 'record_coverage': return `${String(action.surface || '').slice(0, 100)} ${String(action.class || '').slice(0, 40)} ${String(action.outcome || '').slice(0, 30)}`.trim().slice(0, 160);
    case 'load_skill': return String(action.skill || '').slice(0, 120);
    case 'proxy_start': return '';
    case 'intercept_list': return '';
    case 'intercept_read': return `#${String(action.index ?? '').slice(0, 12)}`;
    case 'intercept_replay': return replaySignature(action).slice(0, 160);
    default: return '';
  }
}

/**
 * Default RECALL (Lane I): the hunter deliberately remembers. Reads
 * ONLY its own memory — this hunt's events + reasoning rows and the
 * global-memory store via searchRecall, plus the episode ledger's
 * hybrid retrieval when available (dynamic import, mirroring the
 * lazy assessResult wiring; any failure falls back to searchRecall
 * alone). Bounded to ~1500 chars of observation.
 */
async function defaultRecallMemory(huntId, query) {
  const rec = searchRecall({
    events: readHuntEvents(huntId),
    reasoningRows: getAllReasoning(huntId),
    globalMemories: (() => { try { return readAllGlobalMemories(); } catch { return []; } })(),
    query,
    limit: 8,
  });
  let ledgerText = '';
  try {
    const es = await import('./episodeStore.js');
    if (es.episodeLedgerEnabled && es.episodeLedgerEnabled()) {
      const ret = await es.retrieveEpisodes(query, { huntId, crossHunt: true, limit: 5 });
      if (ret && ret.results && ret.results.length) {
        ledgerText = es.formatRetrievalForPrompt(ret.results, { budgetChars: 900, query });
      }
    }
  } catch { /* ledger recall is best-effort — searchRecall stands alone */ }
  const merged = ledgerText ? `${ledgerText}\n${rec.text}` : rec.text;
  return String(merged).slice(0, 1500);
}

/**
 * Exact-repeat counts from the hunt's own tool_call record (Lane D,
 * 21 Oct 2026 — Ezviz audit). In the audited 24h, 59% of the hunter's
 * actions were exact repeats of an earlier action (browser_open of
 * the same login page ×27, the identical search ×17), because nothing
 * on the screen ever showed the hunter its own repetition — each new
 * session re-derived the same first moves from the same briefing.
 * This renders the counts as FACTS from the record. It forbids
 * nothing; the hunter stays the sole decision-maker.
 */
export function repetitionLines(events) {
  const counts = new Map();
  for (const e of events || []) {
    if (!e || e.type !== 'tool_call') continue;
    const detail = String(e.detail || '').trim();
    if (!detail) continue; // detail-less calls (snapshots) are not meaningful repeats
    const key = `${e.tool}|${detail}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const rows = [...counts.entries()]
    .map(([key, n]) => {
      const cut = key.indexOf('|');
      return { tool: key.slice(0, cut), detail: key.slice(cut + 1), n };
    })
    .filter((r) => (r.tool === 'search' ? r.n >= 3 : r.n >= 5))
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
  if (!rows.length) return [];
  return [
    'Exact repeats from your own record (same action, same input):',
    ...rows.map((r) => `- ${r.tool} ${r.detail} — ×${r.n}`),
    'An identical repeat returns the identical result; it only teaches something when something has changed.',
  ];
}

// ---------------------------------------------------------------------------
// ALREADY-DONE GATE (Lane F, 21 Oct 2026)
//
// The Repetition Check above only SHOWS the hunter its repeats, and
// the live Ezviz audit (21 Oct, ~22:05 IST) proved the 8B brain
// ignores what it is merely shown: 536 tool_call events, only 214
// unique — browser_open of the target root ×94, the identical search
// ×18, a marketing-button click ×6 in the last 60 actions. Memory
// that is only displayed is not memory that constrains. This gate
// enforces the record in deterministic code: an action whose
// signature already appears >= 2 times in the hunt's history is NOT
// executed; the brain gets an observation saying so (with the last
// result, when known) and must choose a different action.
//
// The gate covers exactly the action kinds whose recorded detail
// fully identifies the action: shell, search, browser_open,
// browser_click, browser_type. Deliberately NOT covered:
//   write_file — re-writing the same filename with new content is
//     how a human iterates on a script; the recorded detail (the
//     name) does not capture content, so a signature would
//     false-positive on legitimate work;
//   claim_finding — a claim is the verifier's call (assessResult),
//     never this gate's;
//   note / browser_snapshot / screenshot — no repeatable identity
//     (detail-less) or pure observation; repeating them harms nothing.
// First- and second-time actions pass untouched, and every existing
// gate (scope, heavy-scan, pacing, verifier) is exactly as it was —
// this only ever stops an action, never allows one.
//
// Lane U (23 Oct 2026): intercept_replay joins the gated set — it
// SENDS traffic to the target, and its recorded identity (capture
// index + final URL + header mods + body, via replaySignature) fully
// identifies the send, so an identical replay is the same mindless
// repeat the gate exists for. The other intercept actions stay OUT:
// proxy_start is an idempotent machine control (re-running it just
// reports state, like recall) and intercept_list / intercept_read
// only read the hunter's own capture file — reading the same page
// of your notebook twice harms nothing, exactly like
// browser_snapshot.
// ---------------------------------------------------------------------------

const GATED_TOOLS = new Set(['shell', 'search', 'browser_open', 'browser_click', 'browser_type', 'intercept_replay']);
const DEDUP_THRESHOLD = 2; // an action already run this many times is not run again

// Lane AF (24 Oct 2026): DEGRADED executions — a browser action
// whose observation was guiTools' headless look-only fallback (the
// desktop was down; the hunter never saw the real interactive
// page) — are not the work the gate exists to stop repeating: the
// DVWA hunt's only two opens were both fallbacks, the gate counted
// them as full runs, and then blocked the very open whose guiTools
// probe would have retried the desktop start (Lane Z/AB recovery
// only fires when a browser action EXECUTES). History therefore
// tracks, per signature, fullCount (real executions) separately
// from degradedStreak (fallback executions since the last full
// one): the gate blocks at DEDUP_THRESHOLD full executions — Lane
// F semantics, unchanged — or at DEGRADED_THRESHOLD degraded ones,
// so a desktop that never recovers still cannot loop forever. A
// full execution resets the streak. The degradation signal is
// guiTools' own `degraded` result flag, threaded through the
// loop's post-execution bookkeeping and persisted as a paired
// tool_degraded event, so a history rebuilt from the record
// (buildActionHistory) replays the identical accounting — one
// consistent record for the gate and Lane AD's settled lines.
const DEGRADED_THRESHOLD = 4; // fallback executions of one signature (since the last full one) before the gate blocks

/**
 * The normalised detail of an action — the part of its identity that
 * survives superficial respelling. Deliberately conservative: only
 * differences that cannot change the result are erased.
 *   browser_open — URL scheme/host case and a trailing slash on the
 *     path ('https://X.test/login/' IS 'https://x.test/login');
 *   search — query lowercased, whitespace collapsed (a search engine
 *     treats those alike);
 *   shell / browser_click / browser_type — trimmed only (commands
 *     and labels are case-sensitive; never fold them).
 * The detail is first cut to the 300 chars the tool_call record
 * itself keeps, so a candidate action is judged on exactly the bytes
 * history was recorded with.
 */
export function normalisedActionDetail(tool, detail) {
  const t = String(tool || '').toLowerCase();
  let d = String(detail || '').slice(0, 300);
  if (t === 'browser_open') {
    const raw = d.trim();
    try {
      const u = new URL(raw);
      let p = u.pathname || '/';
      if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
      return `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${p}${u.search || ''}`;
    } catch {
      d = raw.toLowerCase();
      if (d.length > 1 && d.endsWith('/')) d = d.slice(0, -1);
      return d;
    }
  }
  if (t === 'search') return d.trim().toLowerCase().replace(/\s+/g, ' ');
  return d.trim();
}

/** Canonical identity of one executed action: `tool|normalised detail`. */
export function actionSignature(tool, detail) {
  const t = String(tool || '').toLowerCase();
  return `${t}|${normalisedActionDetail(t, detail)}`;
}

/**
 * The hunt's executed-action history, built from its recorded
 * tool_call events: signature -> { tool, detail, count, fullCount,
 * degradedStreak, lastResult }. Detail-less calls and non-gated
 * tools carry no repeatable identity and are skipped. lastResult
 * is filled in live by the running session (events do not store
 * results); across sessions it stays empty and the gate's
 * observation simply omits it.
 *
 * Lane AF: `count` stays the total number of executions (what the
 * explored digest and Lane AD's settled lines have always read).
 * `fullCount` counts only executions that really ran (a browser
 * action on the live desktop, or any non-browser action);
 * `degradedStreak` counts consecutive look-only-fallback
 * executions since the last full one. A tool_call is replayed as
 * a full execution UNLESS its paired tool_degraded event follows
 * — the loop records that amendment in the same turn, right after
 * the execution it reclassifies — in which case the streak that
 * stood before it is restored and incremented instead. Records
 * written before this lane have no tool_degraded events, so every
 * execution in them replays as full, exactly as the gate judged
 * them at the time.
 */
export function buildActionHistory(events) {
  const history = new Map();
  const unamended = new Map(); // sig -> degradedStreak before the latest execution not yet amended
  for (const e of events || []) {
    if (!e) continue;
    if (e.type === 'tool_degraded') {
      const tool = String(e.tool || '').toLowerCase();
      if (!GATED_TOOLS.has(tool)) continue;
      if (!String(e.detail || '').trim()) continue;
      const sig = actionSignature(tool, e.detail);
      const cur = history.get(sig);
      if (cur && unamended.has(sig)) {
        cur.fullCount = Math.max(0, cur.fullCount - 1);
        cur.degradedStreak = unamended.get(sig) + 1;
        unamended.delete(sig);
      }
      continue;
    }
    if (e.type !== 'tool_call') continue;
    const tool = String(e.tool || '').toLowerCase();
    if (!GATED_TOOLS.has(tool)) continue;
    if (!String(e.detail || '').trim()) continue;
    const sig = actionSignature(tool, e.detail);
    let cur = history.get(sig);
    if (!cur) {
      cur = { tool, detail: normalisedActionDetail(tool, e.detail), count: 0, fullCount: 0, degradedStreak: 0, lastResult: '' };
      history.set(sig, cur);
    }
    cur.count++;
    cur.fullCount++;
    unamended.set(sig, cur.degradedStreak);
    cur.degradedStreak = 0;
  }
  return history;
}

/**
 * The "Already explored — do not repeat" digest for the screen:
 * deduped actions already run 3+ times (i.e. already past the gate),
 * grouped by kind, most-repeated first, capped at ~`limit` item
 * lines. Built from the same live history the gate enforces, so what
 * the hunter reads and what the code enforces can never disagree.
 */
export function exploredDigestLines(history, limit = 30) {
  const sections = [
    ['browser_open', 'Visited pages:'],
    ['search', 'Searches already run:'],
    ['shell', 'Shell commands already run:'],
    ['browser_click', 'Clicks already done:'],
    ['browser_type', 'Text already typed:'],
    ['intercept_replay', 'Replays already sent:'],
  ];
  const groups = [];
  for (const [tool, label] of sections) {
    const rows = [...(history || new Map()).values()]
      .filter((e) => e.tool === tool && e.count >= DEDUP_THRESHOLD + 1)
      .sort((a, b) => b.count - a.count);
    if (rows.length) groups.push({ label, rows });
  }
  if (!groups.length) return [];
  const lines = [
    '=== ALREADY EXPLORED — DO NOT REPEAT ===',
    'From your own record in THIS hunt: every action below has already been run 3 or more times. An identical repeat is stopped before it runs and wastes your turn — vary the page, the query or the approach, or act on what you already learned.',
  ];
  let used = 0;
  for (const { label, rows } of groups) {
    if (used >= limit) break;
    lines.push(label);
    for (const r of rows) {
      if (used >= limit) break;
      lines.push(`- ${r.detail} — ×${r.count}`);
      used++;
    }
  }
  return lines;
}

/**
 * The candidate action's identity in the same (tool, detail) form the
 * loop records via toolCall, or null when the gate does not cover the
 * action kind. The detail slicings mirror the ACT dispatch exactly,
 * so the gate compares like with like.
 */
function gatedCandidate(kind, action) {
  switch (kind) {
    case 'shell': return { tool: 'shell', detail: String(action.command || '').slice(0, COMMAND_CAP) };
    case 'search': return { tool: 'search', detail: String(action.query || '').slice(0, 200) };
    case 'browser_open': return { tool: 'browser_open', detail: String(action.url || '') };
    case 'browser_click': return { tool: 'browser_click', detail: String(action.text || '') };
    case 'browser_type': return { tool: 'browser_type', detail: String(action.text || '').slice(0, 80) };
    case 'intercept_replay': return { tool: 'intercept_replay', detail: replaySignature(action) };
    default: return null;
  }
}

/**
 * Gate verdict for one parsed action against the hunt's history:
 * { tool, detail, count, fullCount, degradedStreak, lastResult }
 * when the identical action has already been executed >=
 * DEDUP_THRESHOLD times for real, or >= DEGRADED_THRESHOLD times
 * as look-only fallbacks since its last real execution (Lane AF),
 * else null. `count` in the verdict stays the TOTAL run count —
 * the figure the block observation, the dedup_block event and
 * Lane AD's settled lines have always carried.
 */
export function dedupeGateHit(kind, action, history) {
  const cand = gatedCandidate(String(kind || '').toLowerCase(), action || {});
  if (!cand || !cand.detail.trim()) return null;
  const entry = (history || new Map()).get(actionSignature(cand.tool, cand.detail));
  if (!entry) return null;
  const fullCount = entry.fullCount != null ? entry.fullCount : entry.count;
  const degradedStreak = entry.degradedStreak || 0;
  if (fullCount < DEDUP_THRESHOLD && degradedStreak < DEGRADED_THRESHOLD) return null;
  return { tool: cand.tool, detail: entry.detail, count: entry.count, fullCount, degradedStreak, lastResult: entry.lastResult || '' };
}

// ---------------------------------------------------------------------------
// SETTLED ACTIONS + FAILED-SKILL MEMORY (Lane AD, 24 Oct 2026)
//
// The gate above stops repeat TRAFFIC, but the live audit behind
// this lane (reasoning logs measured 24 Oct 2026) showed it does
// not stop the repeat CHOICE: on the Ezviz hunt 173 of 791 human
// turns (21.9%) were dedup_block re-choices — browser_open of
// /rest/user/register alone was chosen ×62 AFTER the gate had
// already blocked it, each one burning a full brain generation.
// Lane P's "Do NOT retry" hand-off threads and the explored digest
// state the prohibition; what they never do is correct the stale
// PREMISE the brain re-derives every turn from its summary —
// "the registration endpoint has been visited multiple times
// without being probed" — nor state that re-OPENING a page cannot
// satisfy a probing intent (a probe is a request WITH a payload:
// a different action family). Memory that merely forbids is
// overridden by a belief that still looks true.
//
// settledActionLines closes that gap deterministically from the
// hunt's own record: any gated signature the gate has blocked
// >= SETTLED_MIN_BLOCKS times is rendered in the screen's
// never-trimmed continuity region (beside the Lane T thread,
// outside every cap — Lane Q's SOM budget is untouched because
// this is the screen region, not the SOM) as a SETTLED fact:
// how many times it ran, how many times it was blocked, how many
// requests were already SENT to that path, and — for a plain
// page-open — the redirect to the action families that would
// actually test the endpoint. Bounded: top SETTLED_LIMIT entries
// by block count, each line clipped to SETTLED_LINE_CAP chars.
//
// The sibling failure (Juice, same audit): load_skill is
// deliberately NOT dedupe-gated (re-pulling a real card after the
// context rolls is legitimate), so a name that does not exist —
// "ftp" — was asked, answered with "No skill card named" plus the
// full index, and re-asked verbatim the next turn. failedSkillAsks
// rebuilds the failed-name set from the reasoning record; the loop
// answers a verbatim repeat from that record in the dedup_block
// turn-shape (event + note + BLOCKED observation naming the real
// cards) WITHOUT re-running the lookup. Only the exact repeat of
// a name that already failed is gated — every other load_skill
// behaves exactly as Lane M built it.
// ---------------------------------------------------------------------------

const SETTLED_MIN_BLOCKS = 3; // gate blocks before an action is carried as settled
const SETTLED_LIMIT = 5; // settled entries on screen, most-blocked first
const SETTLED_LINE_CAP = 220; // chars per settled entry

/**
 * Requests already SENT to a URL's path, from the executed record:
 * shell commands and intercept replays whose recorded detail names
 * the path. This is the fact that falsifies "visited but not
 * probed" — a GET page-open is a look; these were sends.
 */
function requestsSentToPath(events, detail) {
  let pathname = '';
  try {
    pathname = new URL(detail).pathname || '';
  } catch {
    return 0;
  }
  if (!pathname || pathname === '/') return 0;
  let n = 0;
  for (const e of events || []) {
    if (!e || e.type !== 'tool_call') continue;
    if (e.tool !== 'shell' && e.tool !== 'intercept_replay') continue;
    if (String(e.detail || '').includes(pathname)) n++;
  }
  return n;
}

/**
 * The SETTLED block for the hunter's screen, or [] when nothing
 * has been blocked often enough to settle. Pure over the hunt's
 * records: dedup_block events are the block timeline (the gate
 * records one per blocked attempt), the executed-action history
 * (buildActionHistory — live in-session) supplies run counts.
 * Only signatures WITH executed history render: a block stream
 * for an action that never executed through the gate (e.g. the
 * load_skill repeats handled separately below) is not a settled
 * action and never appears here — the two mechanisms stay
 * disjoint, as Lane T and Lane P are.
 */
export function settledActionLines({ events = [], history = null } = {}) {
  const hist = history || buildActionHistory(events);
  const blocks = new Map();
  for (const e of events || []) {
    if (!e || e.type !== 'dedup_block') continue;
    const tool = String(e.tool || '').toLowerCase();
    if (!tool || !String(e.detail || '').trim()) continue;
    const sig = actionSignature(tool, e.detail);
    blocks.set(sig, (blocks.get(sig) || 0) + 1);
  }
  const rows = [];
  for (const [sig, blockCount] of blocks) {
    if (blockCount < SETTLED_MIN_BLOCKS) continue;
    const entry = hist.get(sig);
    if (!entry) continue;
    rows.push({ tool: entry.tool, detail: entry.detail, count: entry.count, blockCount });
  }
  rows.sort((a, b) => b.blockCount - a.blockCount || a.detail.localeCompare(b.detail));
  const top = rows.slice(0, SETTLED_LIMIT);
  if (!top.length) return [];
  const lines = ['=== SETTLED — YOUR RECORD HAS ALREADY ANSWERED THESE (stop re-choosing them) ==='];
  for (const r of top) {
    let line = `- ${r.tool} ${r.detail} — run ×${r.count}, blocked ×${r.blockCount}.`;
    if (r.tool === 'browser_open') {
      const sent = requestsSentToPath(events, r.detail);
      if (sent > 0) line += ` requests sent ×${sent}.`;
      line += ' Opening probes nothing (same captured page). To test it, SEND a request: curl with a payload, or type + submit.';
    } else {
      line += ' An identical repeat returns the identical result — vary the input or move on.';
    }
    lines.push(clipLine(line, SETTLED_LINE_CAP));
  }
  return lines;
}

/**
 * The fold a hunter-supplied skill name goes through before it is
 * judged — the same fold skillCards.resolveSkillName applies
 * (lowercase, non-alphanumerics stripped), so "FTP!" and "ftp"
 * are the same ask here exactly as they are at lookup time.
 */
function skillNameKey(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Skill names that have already FAILED in this hunt, rebuilt from
 * the reasoning record: Map<folded name, { name, asks }>. A row
 * counts when it is a load_skill whose recorded result carries
 * loadSkill's own "No skill card named" verdict, or a Lane AD
 * blocked repeat of one (`dedup_block: load_skill <name>`) — so
 * `asks` is the hunt's total asks for that name, failures and
 * blocked repeats alike. A successful pull (the card body as the
 * result) never counts: re-pulling a real card stays free.
 */
export function failedSkillAsks(reasoningRows = []) {
  const asks = new Map();
  const bump = (raw) => {
    const key = skillNameKey(raw);
    if (!key) return;
    const cur = asks.get(key);
    if (cur) cur.asks++;
    else asks.set(key, { name: String(raw || '').trim().slice(0, 60), asks: 1 });
  };
  for (const r of reasoningRows || []) {
    const action = String((r && r.action) || '').trim();
    const m = /^load_skill:\s*(.+)$/.exec(action);
    if (m) {
      if (String((r && r.result) || '').includes('No skill card named')) bump(m[1]);
      continue;
    }
    const b = /^dedup_block:\s*load_skill\s+(.+)$/.exec(action);
    if (b) bump(b[1]);
  }
  return asks;
}

/**
 * Factual hunt-state lines the screen previously never carried
 * (Lane D, 21 Oct 2026). Chief among them: whether the hunt holds
 * any test-account credentials. The Ezviz hunt held NONE, and the
 * hunter — never told — spent turns POSTing guessed/placeholder
 * credentials (admin / your_username / test) at the login form,
 * which is not the "own accounts only" testing the programme
 * permits. Stating the fact is perception, not direction.
 */
export function huntFactLines(meta) {
  const m = meta || {};
  const hasCreds = ['credentials', 'testAccount', 'testAccounts', 'accounts', 'loginCredentials']
    .some((k) => {
      const v = m[k];
      if (Array.isArray(v)) return v.length > 0;
      if (v && typeof v === 'object') return Object.keys(v).length > 0;
      return Boolean(v);
    });
  if (hasCreds) return [];
  return [
    'No test-account credentials were provided for this hunt. The programme permits testing only the owner\'s own accounts, so a login you cannot complete with provided credentials is a closed door — not something to guess at.',
  ];
}

/**
 * The skill-card index for the screen (Lane M): names + one-liners
 * ONLY — the cheap advertisement. A card's body is never inlined
 * here; it is pulled via the load_skill action and arrives as one
 * turn's observation, so at most one card body is ever in context.
 * Kept to a single short block alongside the other early perception
 * blocks, sized so it cannot crowd out Lane J's leads. Pure over
 * skillCards.listSkills; any failure renders nothing.
 */
export function skillCardLines() {
  try {
    const skills = listSkills();
    if (!skills.length) return [];
    return [
      '=== SKILL CARDS — PULL A PROCEDURE INSTEAD OF SEARCHING ===',
      'Pull one when you open a class: {"action":"load_skill","skill":"sqli"} — it returns as your next observation: surface, detection, numbered steps, proof bar. One card at a time.',
      ...skills.map((s) => `- ${s.name}: ${s.description}`),
    ];
  } catch {
    return [];
  }
}

function buildScreen({ target, parsedScope, briefing, findings, machineState, lastObservation, turn, turns, scopeHosts = [], facts = [], repetition = [], explored = [], leftOff = [], journal = [], retractedCount = 0, leads = [], coverage = [], skills = [], stateOfMind = [], followThrough = [], settled = [] }) {
  const confirmed = (findings || []).filter((f) => f.verified);
  const unconfirmed = (findings || []).filter((f) => !f.verified);
  const findLines = [
    ...confirmed.slice(-8).map((f) => `- VERIFIED: ${f.title} (${f.severity || '?'})`),
    ...unconfirmed.slice(-4).map((f) => `- unverified claim: ${f.title} — ${String(f.verification || 'pending').slice(0, 120)}`),
  ];
  const rpm = parsedScope && parsedScope.rules ? parsedScope.rules.maxRequestsPerMin : null;
  return [
    '=== YOUR MACHINE (Kali) ===',
    machineState || '(state unavailable)',
    '',
    '=== YOUR TARGET ===',
    String(target),
    rpm ? `Programme pace: max ${rpm} requests/min, human-paced probes only.` : '',
    ...(scopeHosts && scopeHosts.length
      ? ['', '=== IN SCOPE FOR THIS PROGRAMME ===', `You may test: ${scopeHosts.join(', ')} (a listed domain\'s subdomains are in scope too). Anything else is out of scope and will be blocked.`]
      : []),
    // Lane I: where the hunter left off last session sits beside the
    // explored digest — continuity first, before the long briefing.
    ...(leftOff && leftOff.length ? ['', ...leftOff] : []),
    // Lane T: the failed-action follow-through thread sits in the
    // same never-trimmed continuity region as the left-off block —
    // an unaddressed failure from the hunt's own record, carried on
    // every screen until a later action addresses it or it expires,
    // so a failed action's feedback can no longer be walked past.
    ...(followThrough && followThrough.length ? ['', ...followThrough] : []),
    // Lane AD: the settled-actions block sits in the same
    // never-trimmed continuity region — actions the gate has
    // already blocked 3+ times, rendered as settled facts that
    // correct the premise behind the re-choice (what ran, what was
    // blocked, what was already SENT to the path, and the action
    // families that would actually test it). Refreshed every turn
    // from the hunt's record, like the Lane T thread above.
    ...(settled && settled.length ? ['', ...settled] : []),
    // Lane F: the already-explored digest sits EARLY — ahead of the
    // (long, capped) memory briefing — so no prompt cap downstream
    // can truncate away the record of what is already done.
    ...(explored && explored.length ? ['', ...explored] : []),
    // Lane O: the state-of-mind block — the complete memory
    // essentials (where I left off / what I have done, rolled up by
    // endpoint and class / what I know / what I have NOT done, in
    // full / paths already ruled out, in full / what earlier hunts
    // of this target established), rebuilt from the permanent
    // record every turn by huntMemory. It sits in the same
    // outside-the-cap region as the digest, so the briefing's
    // 7,500-char cap can never cut the not-done table or the
    // ruled-out list — the two things a hunter must never lose.
    ...(stateOfMind && stateOfMind.length ? ['', ...stateOfMind] : []),
    // Lane J: the unprobed leads sit with the digest, OUTSIDE the
    // briefing cap — concrete next probes (researched class ×
    // discovered endpoint × input × test value) derived from the
    // hunt's own record, so conversion material cannot be crowded
    // out by the ledger and does not have to compete with the
    // dossier's distilled next step inside the briefing.
    ...(leads && leads.length
      ? ['', '=== UNPROBED LEADS — CONCRETE NEXT PROBES (from your own record) ===', ...leads, 'A search result is not a test: only a request sent to the target tests anything.']
      : []),
    // Lane L: the coverage ledger's open accounting sits with the
    // leads, in the same outside-the-cap region — open_gap rows the
    // brain recorded (or reconciliation opened for its research
    // debt) and the cumulative researched-but-unprobed debt. A
    // class leaves this list only by being probed or by a
    // record_coverage row closing it with a named control.
    ...(coverage && coverage.length
      ? ['', '=== COVERAGE LEDGER — OPEN GAPS & RESEARCH DEBT (your own accounting) ===', ...coverage, 'Missing information is not proof of safety: an open gap is unexamined, not clean.']
      : []),
    // Lane M: the skill-card index sits with the other early blocks —
    // names + one-liners only, after the leads so it can never crowd
    // them out; bodies are pulled on demand via load_skill.
    ...(skills && skills.length ? ['', ...skills] : []),
    '',
    '=== WHAT YOU KNOW (your memory — everything you have done and learned) ===',
    briefing || '(nothing yet — this hunt is young)',
    '',
    '=== FINDINGS SO FAR ===',
    findLines.length ? findLines.join('\n') : '(none yet)',
    ...(retractedCount > 0 ? [`(${retractedCount} earlier claim(s) were retracted as false positives — see dead ends)`] : []),
    ...(facts && facts.length ? ['', '=== FACTS ABOUT THIS HUNT ===', ...facts] : []),
    ...(repetition && repetition.length ? ['', '=== REPETITION CHECK ===', ...repetition] : []),
    ...(journal && journal.length ? ['', '=== THIS SESSION SO FAR ===', ...journal] : []),
    '',
    '=== RESULT OF YOUR LAST ACTION ===',
    lastObservation || '(this is your first move — start by looking: open the target in your browser or curl it, and see what it is)',
    '',
    `=== TURN ${turn} of ${turns} in this session (the hunt continues after) ===`,
    'Think briefly like a human, then end your reply with EXACTLY ONE action JSON.',
  ].join('\n');
}

/**
 * Run one human-mode session: up to `turns` perceive->think->act->observe
 * cycles. Returns { aiOk, failKind?, turnsRun, actionsRun, newFindings, log }.
 *
 * opts:
 *   turns     — max turns this call (default 6)
 *   findings  — the hunt loop's findings array; verified records are pushed
 *   deps      — injectable machinery (tests): chat, exec (shell, pipeline
 *               semantics), execRaw (container exec), search, writeFile,
 *               spill, record, readMeta, writeMeta, readEvents, recordNote,
 *               pocExists (Lane N claim-gate artefact check), assess
 *               (pipeline verifier; explicit null disables the lazy
 *               default and claims are recorded UNVERIFIED), gui,
 *               intercept (Lane U proxy workflow), sleep, now,
 *               buildBriefing
 */
export async function humanIteration(huntId, target, opts = {}) {
  const d = opts.deps || {};
  const deps = {
    chat: d.chat || chatWithAI,
    exec: d.exec || null, // lazy: pipeline executeWithEvasion
    // Lane E: the raw exec self-heals a missing hunt container (respawn
    // + one retry, target closed over from this iteration) — before this
    // the default called execInHuntContainer directly and a removed
    // container never came back for the whole hunt.
    execRaw: d.execRaw || ((h, c, t, o) => execInHuntContainerWithRespawn(h, c, t, { ...(o || {}), target })),
    search: d.search || webSearch,
    writeFile: d.writeFile || writeArtifact,
    spill: d.spill || spillOutput,
    record: d.record || appendHuntEvent,
    readMeta: d.readMeta || readHuntMeta,
    // FIX (21 Oct 2026, lane B): the session-end checkpoint goes through
    // the guarded checkpoint writer — a pause/stop the owner set during
    // the session must survive it (see store.writeHuntMetaCheckpoint).
    writeMeta: d.writeMeta || writeHuntMetaCheckpoint,
    readEvents: d.readEvents || readHuntEvents,
    recordNote: d.recordNote || recordReasoning,
    // Lane N: the claim gate's artefact check — a "poc" handle counts
    // only if the named file really exists in this hunt's artifacts.
    pocExists: d.pocExists || ((h, name) => Boolean(artifactInfo(h, name))),
    assess: 'assess' in d ? d.assess : (opts.assess || undefined), // undefined -> lazy pipeline assessResult; null -> disabled
    gui: d.gui || null, // lazy: guiTools bound to execRaw
    intercept: d.intercept || null, // lazy: proxyIntercept bound to execRaw (Lane U)
    sleep: d.sleep || ((ms) => new Promise((r) => setTimeout(r, ms))),
    now: d.now || (() => Date.now()),
    buildBriefing: d.buildBriefing || buildMemoryBriefing,
    recall: d.recall || defaultRecallMemory,
  };
  // Lane O: the state-of-mind computer. Production path loads the
  // hunt's complete memory through huntMemory (the single read
  // path) and joins it with this file's own derivations (topic
  // accounting, endpoint discovery) over the same record. Tests may
  // inject deps.buildStateOfMind.
  const computeStateOfMind = (meta) => {
    if (typeof d.buildStateOfMind === 'function') return d.buildStateOfMind(huntId, target, meta);
    const memory = loadHuntMemory(huntId, { target, meta });
    return buildStateOfMind(memory, {
      topicStats: researchedTopicStats({ events: memory.events, reasoningRows: memory.reasoningRows }),
      endpoints: discoveredEndpoints(memory.events, target),
    });
  };
  const turns = Math.max(1, opts.turns || 6);
  const log = [];
  const newFindings = [];

  const meta0 = deps.readMeta(huntId) || {};
  // Lane P: this session's turns-total baseline. Per-turn progress
  // checkpoints (below) write ABSOLUTE totals computed from this
  // base, and the session-end checkpoint takes the max of what it
  // re-reads and base + turnsRun — so the two writers can never
  // double-count a turn.
  const sessionBaseTurns = (meta0.humanLoop && meta0.humanLoop.turnsTotal) || 0;
  const parsedScope = opts.parsedScope || meta0.parsedScope || null;
  const maxRpm = parsedScope && parsedScope.rules ? Number(parsedScope.rules.maxRequestsPerMin) || 0 : 0;
  const minShellGapMs = maxRpm > 0 ? Math.ceil(60000 / maxRpm) : 0;

  const say = (text) => {
    try { deps.record(huntId, { type: 'thinking', text: String(text), via: 'human-mode' }); } catch { /* recording is best-effort */ }
  };
  const toolCall = (tool, detail) => {
    try { deps.record(huntId, { type: 'tool_call', tool, detail: String(detail || '').slice(0, 300), via: 'human-mode' }); } catch { /* best-effort */ }
    // Lane F: every executed action joins the already-done history
    // the moment it is dispatched, so the gate sees this session's
    // own actions too — not just past sessions' records.
    try {
      const t = String(tool || '').toLowerCase();
      if (GATED_TOOLS.has(t) && String(detail || '').trim()) {
        const sig = actionSignature(t, detail);
        // Lane AF: the execution counts as FULL for now — the
        // post-execution bookkeeping (below, where lastResult is
        // attached) reclassifies it if the GUI result carried the
        // degraded flag. pendingPrevStreak remembers the streak
        // this execution is about to reset, so the reclassification
        // can restore-and-increment it, exactly as
        // buildActionHistory replays the recorded pair.
        let cur = actionHistory.get(sig);
        if (!cur) {
          cur = { tool: t, detail: normalisedActionDetail(t, detail), count: 0, fullCount: 0, degradedStreak: 0, lastResult: '' };
          actionHistory.set(sig, cur);
        }
        cur.count++;
        cur.fullCount++;
        pendingPrevStreak = cur.degradedStreak;
        cur.degradedStreak = 0;
        pendingSig = sig;
      }
    } catch { /* gate bookkeeping is best-effort */ }
  };
  const note = (entry) => {
    try { deps.recordNote(huntId, entry); } catch { /* best-effort */ }
  };

  const getGui = () => {
    if (!deps.gui) {
      const ex = (h, c, t, o) => deps.execRaw(h, c, t, o);
      deps.gui = {
        open: (h, url) => guiBrowserOpen(h, url, { exec: ex }),
        snapshot: (h) => guiBrowserSnapshot(h, { exec: ex }),
        click: (h, text) => guiBrowserClick(h, text, { exec: ex }),
        type: (h, text, submit) => guiBrowserType(h, text, submit, { exec: ex }),
        screenshot: (h) => guiBrowserScreenshot(h, { exec: ex }),
      };
    }
    return deps.gui;
  };

  // Lane U: the intercept workflow, bound to the same self-healing
  // raw exec as the GUI tools. Tests inject deps.intercept whole.
  const getIntercept = () => {
    if (!deps.intercept) {
      const ex = (h, c, t, o) => deps.execRaw(h, c, t, o);
      deps.intercept = {
        start: (h) => startInterceptProxy(h, { exec: ex }),
        list: (h) => listIntercept(h, { exec: ex }),
        read: (h, index) => readInterceptEntry(h, index, { exec: ex }),
      };
    }
    return deps.intercept;
  };

  const getExec = async () => {
    if (!deps.exec) {
      const ha = await import('./huntAgent.js');
      deps.exec = ha.executeWithEvasion;
    }
    return deps.exec;
  };
  const getAssess = async () => {
    if (deps.assess === undefined) {
      try {
        const ha = await import('./huntAgent.js');
        deps.assess = ha.assessResult || null;
      } catch {
        deps.assess = null;
      }
    }
    return deps.assess;
  };

  let briefing = '';
  try {
    briefing = await deps.buildBriefing(huntId, target, meta0);
  } catch { /* briefing is best-effort */ }

  const system = systemPromptFor(target, parsedScope);
  // Perception facts computed once per session from the hunt's own
  // records (Lane D): the programme surface the gate will actually
  // allow, hunt-state facts (credentials), and exact-repeat counts.
  const scopeHosts = parsedScope && Array.isArray(parsedScope.inScope) ? parsedScope.inScope : [];
  const facts = huntFactLines(meta0);
  // Lane M: the skill-card index is static (our own playbook files),
  // so it is computed once per session and rides every screen.
  const skillLines = skillCardLines();
  // The hunt's recorded events, read once: they feed both the
  // Repetition Check (display) and the already-done gate (Lane F,
  // enforcement). The gate's history then stays live in-session via
  // toolCall above.
  let sessionEvents = [];
  try {
    sessionEvents = deps.readEvents(huntId) || [];
  } catch { /* events are best-effort */ }
  // Lane L: the reasoning-row count at session start — the session-
  // end reconciliation (P4) diffs only THIS session's slice of the
  // record, so it needs to know where the session began.
  let sessionRowCount = 0;
  try {
    sessionRowCount = (getAllReasoning(huntId) || []).length;
  } catch { /* reasoning read is best-effort */ }
  let repetition = [];
  try {
    repetition = repetitionLines(sessionEvents);
  } catch { /* repetition is best-effort */ }
  const actionHistory = buildActionHistory(sessionEvents);
  // Lane AD: skill names that already failed in this hunt, seeded
  // from the permanent reasoning record — a verbatim repeat of one
  // is answered from the record in the load_skill dispatch below
  // instead of re-running the lookup. The loop also learns new
  // failures as they happen, so the memory covers this session too.
  let failedSkills = new Map();
  try {
    failedSkills = failedSkillAsks(getAllReasoning(huntId) || []);
  } catch { /* failed-skill memory is best-effort */ }
  let pendingSig = null; // signature of the action executing this turn
  let pendingDegraded = false; // Lane AF: the executing browser action's result was the look-only fallback
  let pendingPrevStreak = 0; // Lane AF: the signature's degraded streak before this execution
  let lastObservation = '';
  let lastShellAt = 0;
  let lastShellCommand = '';
  let aiOk = false;
  let turnsRun = 0;
  // Lane I continuity state: the previous session's hand-off renders
  // on every screen of this session; this session's own trail feeds
  // the journal on screen and the leftOff persisted at session end.
  // Lane O: the hand-off comes through the memory read path — when
  // the persisted leftOff is missing (legacy meta, a crash before
  // the first clean session end, a lost write), loadHuntMemory
  // derives one from the permanent record, so a hunt with history
  // never starts cold.
  let memory0 = null;
  try { memory0 = loadHuntMemory(huntId, { target, meta: meta0 }); } catch { /* memory is best-effort */ }
  const prevLeftOff = leftOffLines((memory0 && memory0.leftOff) || (meta0.humanLoop && meta0.humanLoop.leftOff));
  let sessionLastThinking = '';
  let sessionLastNote = '';

  say(`Human mode session: ${turns} turns at my own machine. Target: ${target}.`);

  for (let turn = 1; turn <= turns; turn++) {
    // Operator control: a pause/stop landed mid-session — hold position.
    try {
      const m = deps.readMeta(huntId) || {};
      if (m.paused === true || m.stopped === true || m.state === 'paused' || m.state === 'stopped') {
        say('Hunt paused/stopped by the operator — holding position.');
        break;
      }
    } catch { /* meta check is best-effort */ }

    // PER-TURN MEMORY REFRESH (Lane I): the briefing was built ONCE
    // per session and frozen for all 6 turns, so the brain's own
    // notes and actions from earlier turns of THIS session never
    // entered its memory until the next session. Rebuild it every
    // turn (the session-start call above is turn 1's). Best-effort:
    // a failed refresh keeps the previous briefing, never the turn.
    if (turn > 1) {
      try {
        const fresh = await deps.buildBriefing(huntId, target, deps.readMeta(huntId) || meta0);
        if (typeof fresh === 'string' && fresh.length > 0) briefing = fresh;
      } catch { /* keep the previous briefing */ }
    }

    // PERCEIVE: live machine state (working directory + workspace).
    let machineState = '';
    try {
      const st = await deps.execRaw(huntId, 'pwd; echo ---; ls -1 | head -40', 15000, { bypassTmux: true });
      machineState = `${st.stdout || ''}${st.stderr || ''}`.trim().slice(0, 900) || '(empty)';
    } catch {
      machineState = '(machine state unavailable)';
    }

    const evFindings = findingsFromEvents(deps, huntId);
    const seenTitles = new Set(evFindings.map((f) => f.title));
    const findingsNow = [...evFindings, ...newFindings.filter((f) => !seenTitles.has(f.title))];
    let retractedCount = 0;
    try {
      retractedCount = retractedFindingCount(deps.readEvents(huntId) || []);
    } catch { /* retraction note is best-effort */ }
    // Lane J: concrete unprobed leads, refreshed every turn from the
    // hunt's current record (same per-turn discipline as the Lane I
    // briefing refresh) — as probes land, leads drop off the screen.
    let leads = [];
    try {
      const leadEvents = deps.readEvents(huntId) || sessionEvents;
      let leadRows = [];
      try {
        leadRows = getAllReasoning(huntId) || [];
      } catch { /* reasoning rows are best-effort */ }
      leads = unprobedLeadLines({ events: leadEvents, reasoningRows: leadRows, target });
    } catch { /* leads are best-effort perception */ }
    // Lane L: merge the hunt's coverage ledger into the same
    // region — rows the brain recorded take precedence over the
    // computed lead for their (surface, class) key, and open gaps
    // + cumulative research debt render alongside what remains.
    let coverageLines = [];
    try {
      const covData = loadCoverage(huntId);
      const merged = mergeLeadsWithCoverage({ leads, rows: covData.rows, debt: covData.researchDebt, target });
      leads = merged.leads;
      coverageLines = merged.coverage;
    } catch { /* coverage is best-effort perception */ }
    // Lane O: the state-of-mind block, refreshed every turn from
    // the permanent record (the same per-turn discipline as the
    // Lane I briefing refresh) — as probes land and rows close,
    // the done / not-done picture moves with the hunt.
    let stateOfMind = [];
    try {
      stateOfMind = computeStateOfMind(deps.readMeta(huntId) || meta0) || [];
    } catch { /* state of mind is best-effort perception */ }
    // Lane T: the failed-action follow-through thread, refreshed
    // every turn from the hunt's current record (the same discipline
    // as the leads refresh above) — the live loss happened between
    // two turns of ONE session, so this is never a session-start
    // computation.
    let followThrough = [];
    try {
      const ftEvents = deps.readEvents(huntId) || sessionEvents;
      let ftRows = [];
      try {
        ftRows = getAllReasoning(huntId) || [];
      } catch { /* reasoning rows are best-effort */ }
      followThrough = failedActionThreadLines({ events: ftEvents, reasoningRows: ftRows });
    } catch { /* follow-through is best-effort perception */ }
    // Lane AD: the settled-actions block, refreshed every turn
    // from the hunt's current record (the same discipline as the
    // Lane T thread above) — block counts grow mid-session as the
    // gate fires, and a signature settles the turn its third
    // block lands. Block counts come from the recorded dedup_block
    // events; run counts from the live action history.
    let settled = [];
    try {
      const sEvents = deps.readEvents(huntId) || sessionEvents;
      settled = settledActionLines({ events: sEvents, history: actionHistory });
    } catch { /* settled is best-effort perception */ }
    const screen = buildScreen({
      target,
      parsedScope,
      briefing,
      findings: opts.findings && opts.findings.length ? opts.findings : findingsNow,
      machineState,
      lastObservation,
      turn,
      turns,
      scopeHosts,
      facts,
      repetition,
      explored: exploredDigestLines(actionHistory),
      leftOff: prevLeftOff,
      journal: sessionJournalLines(log),
      retractedCount,
      leads,
      coverage: coverageLines,
      skills: skillLines,
      stateOfMind,
      followThrough,
      settled,
    });

    // THINK: one brain call. Full reply is recorded verbatim (total
    // permanent memory) BEFORE parsing — the thought is the record,
    // the JSON is just its last line.
    let reply = null;
    try {
      reply = await deps.chat([{ role: 'user', text: screen }], system, { huntId });
    } catch {
      reply = null;
    }
    turnsRun++;
    if (!reply || !String(reply).trim()) {
      say('Brain gave no reply this turn.');
      if (!aiOk) {
        return { aiOk: false, failKind: 'no_reply', turnsRun, actionsRun: log.length, newFindings, log };
      }
      break;
    }
    aiOk = true;
    const replyText = String(reply);
    try { deps.record(huntId, { type: 'thinking', text: replyText, via: 'human-mode', turn }); } catch { /* best-effort */ }

    const parsed = parseHumanAction(replyText);
    if (!parsed) {
      sessionLastThinking = replyText.trim().slice(0, 400);
      lastObservation =
        'Your reply had NO parseable action JSON, so nothing happened. Reply with brief thinking, then end with EXACTLY ONE action as a JSON object on the last line — e.g. {"action":"shell","command":"curl -s ' + String(target).slice(0, 60) + '"}';
      note({ action: 'unparseable reply', why: replyText.slice(0, 300), result: 'no action executed', learned: 'Replies must end with exactly one action JSON.' });
      log.push({ turn, action: 'unparseable', detail: '', observation: lastObservation });
      continue;
    }
    const action = parsed.action;
    const thinkingText = replyText.slice(0, parsed.jsonStart).trim().slice(0, 400);
    sessionLastThinking = thinkingText;
    const kind = String(action.action).toLowerCase();
    let observation = '';

    // ACT
    // ALREADY-DONE GATE (Lane F): the identical action has already
    // been executed >= 2 times in this hunt — do not execute it
    // again. The block is recorded as a dedup_block event (visible
    // in events.jsonl, countable by monitors) and the brain gets an
    // observation carrying the count and, when known, the last
    // result — then it must choose a different action. Every other
    // gate below runs exactly as before for actions that pass.
    const gateHit = dedupeGateHit(kind, action, actionHistory);
    if (gateHit) {
      try { deps.record(huntId, { type: 'dedup_block', tool: gateHit.tool, detail: gateHit.detail, count: gateHit.count, via: 'human-mode' }); } catch { /* best-effort */ }
      say(`Already-done gate stopped a repeat: ${gateHit.tool} ${gateHit.detail.slice(0, 120)} — already run ×${gateHit.count} in this hunt.`);
      observation =
        `BLOCKED — ALREADY DONE: you have already performed this exact action ${gateHit.count} times in this hunt (${gateHit.tool}: ${gateHit.detail}).` +
        (gateHit.lastResult ? ` Last result: ${gateHit.lastResult}` : '') +
        ' It was NOT executed again — an identical repeat returns the identical result and only burns a turn. Choose a DIFFERENT action: a page you have not visited, a search you have not run, a probe you have not tried — or act on what you already learned.' +
        // Lane AF: for a blocked page-open, name the two variations
        // that are NOT blocked, deterministically — the cheap half
        // of the DVWA rescue (the brain there never discovered
        // either on its own).
        (gateHit.tool === 'browser_open'
          ? ' For this page specifically: browser_snapshot shows the page you already have open, without re-opening it; and a deeper URL on the same site (its login or setup page, for example) is a different action that is not blocked.'
          : '');
      note({ action: `dedup_block: ${gateHit.tool} ${gateHit.detail.slice(0, 120)}`, why: thinkingText, result: `repeat blocked — already run ×${gateHit.count}`, learned: 'Exact repeats are stopped by the record; vary the action.' });
    } else if (kind === 'shell') {
      const command = String(action.command || '').slice(0, COMMAND_CAP);
      if (!command) {
        observation = 'Empty shell command — nothing ran. Give a real command.';
      } else if (heavyScanViolation(command, parsedScope)) {
        observation = `BLOCKED by the programme rules: "${command.slice(0, 120)}" is automated/heavy scanning, which this programme forbids. Work like a human: single targeted probes, one at a time.`;
        say(`Programme rules blocked a heavy-scan command: ${command.slice(0, 120)}`);
      } else {
        const badUrl = commandScopeViolation(command, target, parsedScope);
        if (badUrl) {
          observation = `BLOCKED — OUT OF SCOPE: ${badUrl} is not part of this programme. Only test ${target} and its listed assets. Nothing was sent.`;
          say(`Out-of-scope command blocked: ${command.slice(0, 120)}`);
        } else {
          // Programme pacing: hold the requests-per-minute cap between
          // shell actions (the pipeline never enforced this; human
          // mode does, because a human at 20 req/min is the programme's
          // own picture of acceptable behaviour).
          if (minShellGapMs > 0 && lastShellAt > 0) {
            const wait = lastShellAt + minShellGapMs - deps.now();
            if (wait > 0) await deps.sleep(wait);
          }
          toolCall('shell', command);
          try {
            const exec = await getExec();
            const result = await exec(huntId, target, command);
            lastShellAt = deps.now();
            lastShellCommand = command;
            const combined = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
            if (combined.length > OBS_BUDGET) {
              let handle = '';
              try {
                handle = deps.spill(huntId, combined);
              } catch { /* spill is best-effort */ }
              observation =
                combined.slice(0, OBS_BUDGET) +
                `\n[output truncated on screen — ${combined.length} chars total${handle ? `, saved in full as artifact ${handle} in your workspace (READ it back via a shell action: cat the hunt artifacts, or re-run with head/grep)` : ''}]`;
            } else {
              observation = combined || `(command finished with no output, exit code ${result.code ?? 0})`;
            }
            if (result.code && result.code !== 0) {
              observation += `\n[exit code ${result.code}]`;
            }
          } catch (err) {
            observation = `Shell action failed to run: ${err.message || err}`;
          }
        }
      }
      note({ action: `shell: ${command.slice(0, 160)}`, why: thinkingText, result: observation.slice(0, 300), learned: '' });
    } else if (kind === 'search') {
      const query = String(action.query || '').slice(0, 200);
      toolCall('search', query);
      try {
        const results = await deps.search(query, 5);
        observation = results && results.length
          ? results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${String(r.snippet || '').slice(0, 200)}`).join('\n')
          : 'No web results found for that query.';
      } catch {
        observation = 'Web search failed this time.';
      }
      note({ action: `search: ${query}`, why: thinkingText, result: observation.slice(0, 300), learned: '' });
    } else if (kind === 'write_file') {
      const name = String(action.name || '');
      const content = String(action.content ?? '');
      toolCall('write_file', name);
      try {
        const w = await deps.writeFile(huntId, name, content);
        observation = `Saved ${w.name || name} in your hunt workspace (${(w.chars ?? content.length)} chars, permanent). Run it any time with a shell action: {"action":"shell","command":"RUN_ARTIFACT: ${w.name || name}"} — it executes inside your container and you see the output next turn.`;
      } catch (err) {
        observation = `write_file failed: ${err.message || err}`;
      }
      note({ action: `write_file: ${name}`, why: thinkingText, result: observation.slice(0, 300), learned: '' });
    } else if (kind === 'note') {
      const text = String(action.text || '');
      sessionLastNote = text;
      note({ action: 'note to self', why: text, result: 'recorded', learned: text.slice(0, 300) });
      say(`Note to self: ${text.slice(0, 300)}`);
      observation = 'Note saved in your notebook — it will be in your memory briefing from now on.';
    } else if (kind === 'recall') {
      // Lane I: deliberate remembering. NOT dedupe-gated (remembering
      // is free) and NOT scope-gated (it reads only the hunter's own
      // memory — no traffic leaves the machine).
      const query = String(action.query || '').slice(0, 200);
      toolCall('recall', query);
      try {
        observation = String(await deps.recall(huntId, query) || '').slice(0, 1500) || 'Recall returned nothing.';
      } catch {
        observation = 'Recall failed this time — your briefing still carries the distilled memory.';
      }
      note({ action: `recall: ${query}`, why: thinkingText, result: observation.slice(0, 300), learned: '' });
    } else if (kind === 'record_coverage') {
      // Lane L: the hunter accounts for a surface × class in its
      // own coverage ledger. NOT dedupe-gated (accounting is free,
      // like recall) and NOT scope-gated (it writes only the hunt's
      // own ledger — no traffic leaves the machine). The ledger
      // enforces its contracts in code: uniqueness per key, and
      // closure evidence naming the control for ruled_out /
      // not_applicable.
      const covInput = {
        surface: String(action.surface || '').slice(0, 300),
        class: String(action.class || '').slice(0, 80),
        outcome: String(action.outcome || '').slice(0, 40),
        evidence: String(action.evidence || '').slice(0, 500),
      };
      toolCall('record_coverage', detailForAction(kind, action));
      let covResult = null;
      try {
        covResult = action.update === true
          ? updateCoverage(huntId, covInput)
          : recordCoverage(huntId, covInput);
      } catch { /* ledger write is best-effort — the observation says so */ }
      observation = coverageObservation(covResult, { surface: covInput.surface, cls: covInput.class });
      if (covResult && (covResult.status === 'created' || covResult.status === 'updated')) {
        say(`Coverage ${covResult.status}: ${covInput.surface} × ${covInput.class} → ${covInput.outcome}`);
      }
      note({ action: `record_coverage: ${covInput.surface} ${covInput.class} ${covInput.outcome}`, why: thinkingText, result: observation.slice(0, 300), learned: '' });
    } else if (kind === 'load_skill') {
      // Lane M: pull a procedure card from the hunter's own playbook
      // (Research Lane K, proposal P2). NOT dedupe-gated — re-pulling
      // a card after the context has rolled is legitimate — and NOT
      // scope-gated: it reads only our own files, no traffic leaves
      // the machine. The card returns as THIS turn's observation, so
      // exactly one card body is ever in play; nothing accumulates
      // into the briefing. loadSkill never throws and answers an
      // unknown name with the index.
      //
      // Lane AD: ONE exception to "not gated" — a verbatim repeat
      // of a name that ALREADY FAILED in this hunt ("No skill card
      // named X"). Re-running the lookup cannot change that answer
      // (the card set is our own static playbook), and live the
      // hunter re-asked "ftp" the very next turn after being told
      // exactly that. The repeat is answered from the record in
      // the dedup_block turn-shape — a dedup_block event, a
      // reasoning note, and a BLOCKED observation naming the cards
      // that DO exist — and the lookup does not run again. A first
      // ask of any name, and every ask of a real card, execute
      // exactly as before.
      const name = String(action.skill || '').slice(0, 80);
      const skillKey = skillNameKey(name);
      const priorFail = skillKey ? failedSkills.get(skillKey) : null;
      if (priorFail) {
        priorFail.asks++;
        try { deps.record(huntId, { type: 'dedup_block', tool: 'load_skill', detail: priorFail.name, count: priorFail.asks, via: 'human-mode' }); } catch { /* best-effort */ }
        say(`Already-answered gate stopped a repeat skill ask: "${priorFail.name}" — no such card (asked ×${priorFail.asks} in this hunt).`);
        let cardNames = '';
        try {
          cardNames = listSkills().map((s) => s.name).join(', ');
        } catch { /* the index is best-effort */ }
        observation =
          `BLOCKED — NO SUCH SKILL CARD: you have already asked for "${priorFail.name}" ${priorFail.asks} times in this hunt and there is no skill card with that name. It was NOT looked up again — asking again cannot create it.` +
          (cardNames
            ? ` The cards that exist: ${cardNames}. Pull one of those, or work from your briefing and leads.`
            : ' Work from your briefing and leads.');
        note({ action: `dedup_block: load_skill ${priorFail.name}`, why: thinkingText, result: `repeat blocked — no skill card named "${priorFail.name}" (asked ×${priorFail.asks})`, learned: 'A skill card that does not exist cannot be pulled into existence; pick a real card from the index.' });
      } else {
        toolCall('load_skill', name);
        try {
          observation = String(loadSkill(name) || '').slice(0, 2600) || 'That skill card is empty.';
        } catch {
          observation = 'Skill cards are unavailable this turn — work from your briefing and your leads.';
        }
        // Lane AD: a fresh failure joins the hunt's failed-name
        // memory the moment it is observed, so a verbatim repeat
        // later in this same session is answered from the record.
        if (skillKey && observation.includes('No skill card named')) {
          failedSkills.set(skillKey, { name: name.trim().slice(0, 60), asks: 1 });
        }
        note({ action: `load_skill: ${name}`, why: thinkingText, result: observation.slice(0, 300), learned: '' });
      }
    } else if (kind === 'proxy_start') {
      // Lane U: start the intercept proxy + dashboard inside the
      // hunter's own container and route its Chromium through it.
      // NOT dedupe-gated (an idempotent machine control — re-running
      // it only reports state, like recall) and NOT scope-gated (it
      // touches only the hunter's own machine; no traffic leaves).
      toolCall('proxy_start', '');
      const res = await getIntercept().start(huntId);
      observation = res.observation || '(no observation)';
      if (res.ok) say('Intercept proxy started — browser traffic is being captured.');
      note({ action: 'proxy_start', why: thinkingText, result: observation.slice(0, 300), learned: '' });
    } else if (kind === 'intercept_list') {
      // Lane U: read the hunter's own capture file. NOT dedupe-gated
      // and NOT scope-gated — a read of its own notebook, like recall.
      toolCall('intercept_list', '');
      const res = await getIntercept().list(huntId);
      observation = res.observation || '(no observation)';
      note({ action: 'intercept_list', why: thinkingText, result: observation.slice(0, 300), learned: '' });
    } else if (kind === 'intercept_read') {
      // Lane U: one captured flow in full. Same read-only treatment
      // as intercept_list.
      toolCall('intercept_read', `#${action.index ?? ''}`);
      const res = await getIntercept().read(huntId, action.index);
      observation = res.observation || '(no observation)';
      note({ action: `intercept_read: #${action.index ?? ''}`, why: thinkingText, result: observation.slice(0, 300), learned: '' });
    } else if (kind === 'intercept_replay') {
      // Lane U: Burp-Repeater work — resend one captured request
      // with the hunter's modifications. This DOES send traffic, so
      // it is treated exactly like a shell probe: dedupe-gated
      // (above, on the replay signature), scope-checked on the FINAL
      // url (a captured third-party request the page made, or a url
      // override, may not be replayed out of programme), paced by
      // the same requests-per-minute cap, and executed through the
      // same pipeline exec as shell commands.
      const read = await getIntercept().read(huntId, action.index);
      if (!read.ok || !read.entry) {
        observation = read.observation || 'That capture could not be read — run intercept_list and pick a real index.';
      } else {
        const built = buildReplayRequest(read.entry.flow, {
          url: action.url,
          headers: action.headers,
          body: action.body,
        });
        if (!built.ok) {
          observation = built.error;
        } else {
          const badUrl = scopeViolation(built.url, target, parsedScope);
          if (badUrl) {
            observation = `BLOCKED — OUT OF SCOPE: ${badUrl} is not part of this programme. A replay may only be sent to ${target} and its listed assets. Nothing was sent.`;
            say(`Out-of-scope replay blocked: ${built.url.slice(0, 120)}`);
          } else {
            if (minShellGapMs > 0 && lastShellAt > 0) {
              const wait = lastShellAt + minShellGapMs - deps.now();
              if (wait > 0) await deps.sleep(wait);
            }
            toolCall('intercept_replay', replaySignature(action));
            try {
              const exec = await getExec();
              const result = await exec(huntId, target, buildReplayCurl(built));
              lastShellAt = deps.now();
              const combined = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
              const statusLine = /^HTTP\/\S+ \d{3}[^\n]*/m.exec(combined);
              const head = `Replayed capture #${read.entry.index} as ${built.method} ${built.url} — ${statusLine ? statusLine[0] : 'no HTTP response received'}.`;
              if (combined.length > OBS_BUDGET) {
                let handle = '';
                try {
                  handle = deps.spill(huntId, combined);
                } catch { /* spill is best-effort */ }
                observation =
                  `${head}\n${combined.slice(0, OBS_BUDGET)}` +
                  `\n[response truncated on screen — ${combined.length} chars total${handle ? `, saved in full as artifact ${handle}` : ''}]`;
              } else {
                observation = combined ? `${head}\n${combined}` : `${head} (the replay produced no output)`;
              }
              if (result.code && result.code !== 0) {
                observation += `\n[curl exit code ${result.code}]`;
              }
            } catch (err) {
              observation = `Replay failed to run: ${err.message || err}`;
            }
          }
        }
      }
      note({ action: `intercept_replay: #${action.index ?? ''}`, why: thinkingText, result: observation.slice(0, 300), learned: '' });
    } else if (kind === 'browser_open') {
      const url = String(action.url || '');
      const bad = scopeViolation(url, target, parsedScope);
      if (bad) {
        observation = `BLOCKED — OUT OF SCOPE: ${bad} is not part of this programme. Nothing was opened.`;
        say(`Out-of-scope browser_open blocked: ${url.slice(0, 120)}`);
      } else {
        toolCall('browser_open', url);
        const res = await getGui().open(huntId, url);
        if (res && res.degraded === true) pendingDegraded = true; // Lane AF
        observation = res.observation || '(no observation)';
      }
      note({ action: `browser_open: ${url.slice(0, 120)}`, why: thinkingText, result: observation.slice(0, 300), learned: '' });
    } else if (kind === 'browser_snapshot') {
      toolCall('browser_snapshot', '');
      const res = await getGui().snapshot(huntId);
      observation = res.observation || '(no observation)';
    } else if (kind === 'browser_click') {
      const text = String(action.text || '');
      toolCall('browser_click', text);
      const res = await getGui().click(huntId, text);
      if (res && res.degraded === true) pendingDegraded = true; // Lane AF
      observation = res.observation || '(no observation)';
      note({ action: `browser_click: ${text.slice(0, 80)}`, why: thinkingText, result: observation.slice(0, 300), learned: '' });
    } else if (kind === 'browser_type') {
      const text = String(action.text || '');
      toolCall('browser_type', text.slice(0, 80));
      const res = await getGui().type(huntId, text, action.submit === true);
      if (res && res.degraded === true) pendingDegraded = true; // Lane AF
      observation = res.observation || '(no observation)';
      note({ action: 'browser_type', why: thinkingText, result: observation.slice(0, 300), learned: '' });
    } else if (kind === 'screenshot') {
      toolCall('screenshot', '');
      const res = await getGui().screenshot(huntId);
      observation = res.observation || '(no observation)';
    } else if (kind === 'claim_finding') {
      const rawTitle = String(action.title || '');
      const title = String(rawTitle.trim() ? rawTitle : 'Untitled claim').slice(0, 200);
      const evidence = String(action.evidence || '');
      const command = String(action.command || lastShellCommand || '');
      // COMPLETE-THE-PROOF GATE (Lane N): the filing is checked for
      // completeness BEFORE the verifier is invoked and before any
      // finding is recorded. An incomplete claim is not recorded and
      // the verifier never sees it; the brain gets one observation
      // naming every missing piece, and the refusal is recorded as a
      // countable claim_bounce event. The gate judges completeness
      // only — assessResult below remains the sole judge of truth.
      const poc = String(action.poc || '').trim().slice(0, 120);
      let pocExists = false;
      if (poc) {
        try { pocExists = Boolean(deps.pocExists(huntId, poc)); } catch { pocExists = false; }
      }
      const gate = claimGateCheck({
        title: rawTitle,
        cls: normaliseCoverageClass(action.class) || claimClassFromTitle(rawTitle),
        command,
        poc,
        pocExists,
        evidence,
        counterevidence: action.counterevidence,
        confidence: action.confidence,
        rationale: action.confidence_rationale,
      });
      if (!gate.ok) {
        try { deps.record(huntId, { type: 'claim_bounce', tool: 'claim_finding', detail: title, missing: gate.missing.map((m) => m.field), via: 'human-mode' }); } catch { /* best-effort */ }
        say(`Claim bounced — incomplete proof package (missing: ${gate.missing.map((m) => m.field).join(', ')}).`);
        observation =
          'CLAIM NOT RECORDED — the proof package is incomplete, so the verifier never saw it. Missing: ' +
          gate.missing.map((m) => m.hint).join('; ') +
          '. Complete every piece and claim again — run the control/baseline probe first if that is what is missing. This gate checks completeness only; the verifier still decides whether a complete claim is true.';
        note({ action: `claim_finding: ${title}`, why: thinkingText, result: observation.slice(0, 300), learned: '' });
      } else {
      toolCall('claim_finding', title);
      const assess = await getAssess();
      if (assess) {
        // The pipeline verifier decides — never the hunter. It
        // re-runs the reproducing command, applies the evidence gate,
        // the 4-step verification and the content-relevance judgement,
        // and records the finding event itself.
        const plan = {
          test: title,
          command,
          why: 'Human-mode claim — the hunter reproduced this itself and asked for independent verification.',
          hypothesis: title,
        };
        const result = { stdout: evidence, stderr: '', code: 0 };
        let rec = null;
        try {
          rec = await assess(huntId, target, plan, result);
        } catch (err) {
          observation = `Verification could not run (${err.message || err}). Your claim was NOT verified — reproduce it cleanly and claim again with the exact command + output.`;
        }
        if (rec) {
          if (rec.verified) {
            newFindings.push(rec);
            if (Array.isArray(opts.findings)) opts.findings.push(rec);
            observation = `VERIFIED by the independent verifier: "${rec.title}" (${rec.severity}). It counts. Think about impact and chaining — what does this unlock?`;
          } else {
            observation = `NOT verified: ${rec.verification || 'the verifier rejected the claim'}. A rejected claim is a dead end, not a finding — either your evidence does not prove it, or the command does not reproduce it. Do not re-claim the same thing; dig for real proof or move on.`;
          }
        }
      } else {
        // No verifier wired (bare driver without the pipeline): the
        // claim is recorded as what it is — UNVERIFIED. It must never
        // be presented as a confirmed finding anywhere.
        try {
          deps.record(huntId, {
            type: 'finding',
            class: 'agent_finding',
            title,
            severity: 'medium',
            url: target,
            evidence: { request: command, response: evidence.slice(0, 3000) },
            verified: false,
            verification: 'human-mode claim — pending pipeline verification',
            via: 'human-mode',
          });
        } catch { /* best-effort */ }
        observation = 'Recorded as an UNVERIFIED claim (no pipeline verifier is wired into this session). It does not count as a finding until the verifier confirms it.';
      }
      note({ action: `claim_finding: ${title}`, why: thinkingText, result: observation.slice(0, 300), learned: '' });
      }
    } else {
      observation = `Unknown action "${kind}". Valid actions: shell, search, write_file, note, recall, record_coverage, load_skill, proxy_start, intercept_list, intercept_read, intercept_replay, browser_open, browser_snapshot, browser_click, browser_type, screenshot, claim_finding. Pick exactly one, as JSON on the last line.`;
    }

    // Lane F: remember what the executed action returned, so a later
    // repeat attempt can be answered with its last result.
    if (pendingSig) {
      const entry = actionHistory.get(pendingSig);
      if (entry) {
        entry.lastResult = String(observation).slice(0, 220);
        // Lane AF: the execution was counted as full at dispatch;
        // if the GUI result says it was really the look-only
        // fallback, reclassify it — the full count comes back off,
        // the streak it interrupted is restored and incremented —
        // and persist the amendment as a paired tool_degraded event
        // so the next session's rebuilt history replays the same
        // accounting from the same record.
        if (pendingDegraded) {
          entry.fullCount = Math.max(0, (entry.fullCount || 0) - 1);
          entry.degradedStreak = pendingPrevStreak + 1;
          try { deps.record(huntId, { type: 'tool_degraded', tool: entry.tool, detail: entry.detail, via: 'human-mode' }); } catch { /* best-effort */ }
        }
      }
      pendingSig = null;
      pendingDegraded = false;
    }

    log.push({ turn, action: kind, detail: detailForAction(kind, action), observation: String(observation).slice(0, 300) });
    lastObservation = observation;

    // PROGRESS CHECKPOINT (Lane P, 23 Oct 2026): the hunt's totals
    // used to move only at session end, so during a whole 6-turn
    // session (10+ minutes on the 8B brain) meta.humanLoop.turnsTotal
    // stood still and the website's hunt looked frozen at the round
    // it resumed from — the owner's live QA watched round 166 for
    // ~12 minutes while the backend was in fact writing reasoning
    // rows and events. Persist the running total after EVERY turn
    // through the guarded checkpoint writer (owner pause/stop holds
    // are preserved; progress fields still record). Best-effort: a
    // failed checkpoint never costs the turn.
    try {
      const cur = deps.readMeta(huntId) || {};
      const curLoop = cur.humanLoop || {};
      deps.writeMeta(huntId, {
        ...cur,
        huntId,
        humanLoop: {
          ...curLoop,
          turnsTotal: sessionBaseTurns + turnsRun,
          lastTurnAt: new Date().toISOString(),
        },
        checkpointAt: new Date().toISOString(),
      });
    } catch { /* progress checkpoint is best-effort */ }
  }

  // Checkpoint: session totals on the hunt meta under humanLoop,
  // plus the LEFT-OFF hand-off (Lane I): where this session stopped —
  // its last actions WITH detail and result, its last note, its open
  // threads, and the tail of its train of thought — so the next
  // session resumes as the same person, not a cold stranger.
  try {
    const m = deps.readMeta(huntId) || {};
    const prev = m.humanLoop || {};
    let endEvents = sessionEvents;
    try {
      endEvents = deps.readEvents(huntId) || sessionEvents;
    } catch { /* fall back to the session-start read */ }
    let endRows = [];
    try {
      endRows = getAllReasoning(huntId) || [];
    } catch { /* reasoning read is best-effort */ }
    let lastNote = sessionLastNote;
    if (!lastNote) {
      for (let i = endRows.length - 1; i >= 0 && !lastNote; i--) {
        const r = endRows[i];
        if (r && r.action === 'note to self') lastNote = String(r.learned || r.why || '');
      }
    }
    if (!lastNote) {
      for (let i = endEvents.length - 1; i >= 0 && !lastNote; i--) {
        const e = endEvents[i];
        if (e && e.type === 'thinking' && String(e.text || '').startsWith('Note to self:')) {
          lastNote = String(e.text).slice('Note to self:'.length).trim();
        }
      }
    }
    let openThreads = [];
    try {
      openThreads = researchedNotProbedLines({ events: endEvents, reasoningRows: endRows });
    } catch { /* open threads are best-effort */ }
    // Lane L (P4): session-end researched-vs-probed reconciliation.
    // The classes researched in THIS session's slice of the record
    // are diffed against probe actions and coverage rows; whatever
    // is unaccounted becomes an open item in this leftOff AND an
    // open_gap row in the coverage ledger, and the cumulative
    // research-debt counters are folded into the ledger. This is
    // memory bookkeeping about research debt — it never records a
    // probe that did not happen, and it writes no DOSSIER.md
    // (consolidation owns that file and regenerates it wholesale).
    try {
      const covData = loadCoverage(huntId);
      const sliceEvents = endEvents.length >= sessionEvents.length ? endEvents.slice(sessionEvents.length) : [];
      const sliceRows = endRows.slice(sessionRowCount);
      const rec = reconcileSessionResearch({ sessionEvents: sliceEvents, sessionRows: sliceRows, coverageData: covData, target });
      if (rec.gapInputs.length || rec.debtStats.length) {
        let next = covData;
        for (const g of rec.gapInputs) next = applyRecord(next, g).data;
        const huntProbed = new Set(
          researchedTopicStats({ events: endEvents, reasoningRows: endRows })
            .filter((s) => s.probed)
            .map((s) => s.topic.id),
        );
        for (const id of probedClassIds(next)) huntProbed.add(id);
        next = mergeResearchDebt(next, rec.debtStats, new Date().toISOString(), huntProbed);
        saveCoverage(huntId, next);
      }
      for (const item of rec.openItems) {
        const label = item.replace(/^-\s*/, '').split(':')[0];
        if (!openThreads.some((l) => l.includes(label))) openThreads.push(item);
      }
    } catch { /* reconciliation is best-effort bookkeeping */ }
    // Lane P: a dedup-BLOCKED attempt is not an action the hunter
    // took and must never be stored as the hand-off's last actions —
    // the next session reads those as its pending thread and retries
    // the exact repeat (live: browser_open /api/register, blocked in
    // one session, was already sitting in leftOff from the session
    // before and got retried again). Blocked attempts instead become
    // an explicit do-not-retry thread.
    const isBlockedRepeat = (l) => String((l && l.observation) || '').startsWith('BLOCKED — ALREADY DONE');
    const seenBlocked = new Set();
    for (const b of log.filter(isBlockedRepeat)) {
      const key = `${b.action}|${b.detail || ''}`;
      if (seenBlocked.has(key)) continue;
      seenBlocked.add(key);
      const line = `- Do NOT retry: ${b.action} ${clipLine(b.detail || '', 120)} — the already-done gate blocked it as an exact repeat; it is not your pending step. Choose a different action.`;
      if (!openThreads.some((t) => t.includes('Do NOT retry') && t.includes(clipLine(b.detail || '', 60)))) {
        openThreads.push(line);
      }
    }
    const leftOff = {
      at: new Date().toISOString(),
      lastActions: log.filter((l) => !isBlockedRepeat(l)).slice(-5).map((l) => ({
        tool: l.action,
        detail: clipLine(l.detail || '', 160),
        result: clipLine(l.observation || '', 220),
      })),
      lastNote: clipLine(lastNote || '', 300),
      openThreads,
      lastThinking: clipLine(sessionLastThinking || '', 240),
    };
    deps.writeMeta(huntId, {
      ...m,
      huntId,
      humanLoop: {
        sessions: (prev.sessions || 0) + 1,
        // Lane P: per-turn progress checkpoints already advanced
        // turnsTotal to sessionBaseTurns + turnsRun during this
        // session; adding turnsRun again here would double-count.
        // The max keeps the total correct whether or not the
        // per-turn writes landed (e.g. a no-op writeMeta in tests).
        turnsTotal: Math.max(prev.turnsTotal || 0, sessionBaseTurns + turnsRun),
        lastTurnAt: new Date().toISOString(),
        lastActions: log.slice(-6).map((l) => l.action),
        leftOff,
      },
    });
  } catch { /* checkpoint is best-effort */ }

  return { aiOk, turnsRun, actionsRun: log.length, newFindings, log };
}
