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
//             screenshot / claim_finding — executed through the SAME
//             machinery the pipeline uses (executeWithEvasion for
//             shell, webSearch, artifacts, guiTools).
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
    } else if (['shell', 'browser_open', 'browser_click', 'browser_type', 'claim_finding'].includes(e.tool)) {
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
// ---------------------------------------------------------------------------

const GATED_TOOLS = new Set(['shell', 'search', 'browser_open', 'browser_click', 'browser_type']);
const DEDUP_THRESHOLD = 2; // an action already run this many times is not run again

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
 * tool_call events: signature -> { tool, detail, count, lastResult }.
 * Detail-less calls and non-gated tools carry no repeatable identity
 * and are skipped. lastResult is filled in live by the running
 * session (events do not store results); across sessions it stays
 * empty and the gate's observation simply omits it.
 */
export function buildActionHistory(events) {
  const history = new Map();
  for (const e of events || []) {
    if (!e || e.type !== 'tool_call') continue;
    const tool = String(e.tool || '').toLowerCase();
    if (!GATED_TOOLS.has(tool)) continue;
    if (!String(e.detail || '').trim()) continue;
    const sig = actionSignature(tool, e.detail);
    const cur = history.get(sig);
    if (cur) cur.count++;
    else history.set(sig, { tool, detail: normalisedActionDetail(tool, e.detail), count: 1, lastResult: '' });
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
    default: return null;
  }
}

/**
 * Gate verdict for one parsed action against the hunt's history:
 * { tool, detail, count, lastResult } when the identical action has
 * already been executed >= DEDUP_THRESHOLD times, else null.
 */
export function dedupeGateHit(kind, action, history) {
  const cand = gatedCandidate(String(kind || '').toLowerCase(), action || {});
  if (!cand || !cand.detail.trim()) return null;
  const entry = (history || new Map()).get(actionSignature(cand.tool, cand.detail));
  if (!entry || entry.count < DEDUP_THRESHOLD) return null;
  return { tool: cand.tool, detail: entry.detail, count: entry.count, lastResult: entry.lastResult || '' };
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

function buildScreen({ target, parsedScope, briefing, findings, machineState, lastObservation, turn, turns, scopeHosts = [], facts = [], repetition = [], explored = [], leftOff = [], journal = [], retractedCount = 0, leads = [], coverage = [], skills = [], stateOfMind = [] }) {
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
 *               default and claims are recorded UNVERIFIED), gui, sleep,
 *               now, buildBriefing
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
        const cur = actionHistory.get(sig);
        if (cur) cur.count++;
        else actionHistory.set(sig, { tool: t, detail: normalisedActionDetail(t, detail), count: 1, lastResult: '' });
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
  let pendingSig = null; // signature of the action executing this turn
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
        ' It was NOT executed again — an identical repeat returns the identical result and only burns a turn. Choose a DIFFERENT action: a page you have not visited, a search you have not run, a probe you have not tried — or act on what you already learned.';
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
      const name = String(action.skill || '').slice(0, 80);
      toolCall('load_skill', name);
      try {
        observation = String(loadSkill(name) || '').slice(0, 2600) || 'That skill card is empty.';
      } catch {
        observation = 'Skill cards are unavailable this turn — work from your briefing and your leads.';
      }
      note({ action: `load_skill: ${name}`, why: thinkingText, result: observation.slice(0, 300), learned: '' });
    } else if (kind === 'browser_open') {
      const url = String(action.url || '');
      const bad = scopeViolation(url, target, parsedScope);
      if (bad) {
        observation = `BLOCKED — OUT OF SCOPE: ${bad} is not part of this programme. Nothing was opened.`;
        say(`Out-of-scope browser_open blocked: ${url.slice(0, 120)}`);
      } else {
        toolCall('browser_open', url);
        const res = await getGui().open(huntId, url);
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
      observation = res.observation || '(no observation)';
      note({ action: `browser_click: ${text.slice(0, 80)}`, why: thinkingText, result: observation.slice(0, 300), learned: '' });
    } else if (kind === 'browser_type') {
      const text = String(action.text || '');
      toolCall('browser_type', text.slice(0, 80));
      const res = await getGui().type(huntId, text, action.submit === true);
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
      observation = `Unknown action "${kind}". Valid actions: shell, search, write_file, note, recall, record_coverage, load_skill, browser_open, browser_snapshot, browser_click, browser_type, screenshot, claim_finding. Pick exactly one, as JSON on the last line.`;
    }

    // Lane F: remember what the executed action returned, so a later
    // repeat attempt can be answered with its last result.
    if (pendingSig) {
      const entry = actionHistory.get(pendingSig);
      if (entry) entry.lastResult = String(observation).slice(0, 220);
      pendingSig = null;
    }

    log.push({ turn, action: kind, detail: detailForAction(kind, action), observation: String(observation).slice(0, 300) });
    lastObservation = observation;
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
    const leftOff = {
      at: new Date().toISOString(),
      lastActions: log.slice(-5).map((l) => ({
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
        turnsTotal: (prev.turnsTotal || 0) + turnsRun,
        lastTurnAt: new Date().toISOString(),
        lastActions: log.slice(-6).map((l) => l.action),
        leftOff,
      },
    });
  } catch { /* checkpoint is best-effort */ }

  return { aiOk, turnsRun, actionsRun: log.length, newFindings, log };
}
