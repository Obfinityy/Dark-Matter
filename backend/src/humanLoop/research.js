// Split out of humanLoop.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; humanLoop.js re-exports the public names so callers are unchanged.

import { recordReasoning, getAllReasoning, buildFullHistoryLedger, searchRecall } from '../reasoningMemory.js';
import { findWrongTargetPaths, knownAppOf, knownAppSOMLines } from '../knownApps.js';
import { getRelevantMemories, formatGlobalMemoryForPrompt, readAllGlobalMemories } from '../globalMemory.js';
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
} from '../coverageLedger.js';
import {
  DESKTOP_FIRST_RULE,
  looksLikeShellLogin,
  desktopFirstNudge,
  heartbeatBlock,
} from '../desktopFirst.js';
import {
  loadHuntMemory,
  buildStateOfMind,
  applyRetractions,
  retractedFindingCount,
  extractDossierBriefing,
  deadEndLines,
  isErrorPageFinding,
  SOM_TOTAL_BUDGET,
} from '../huntMemory.js';
import { COMMAND_CAP, OBS_BUDGET, clipResult, commandScopeViolation, heavyScanViolation, isReturnToTarget, lastActionResultOfLeftOff, pageUrlFromObservation, parseHumanAction, scopeViolation, targetHostOf, targetHostsFor } from './scope.js';

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

export const clipLine = (s, n) => {
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
  { id: 'sqli', label: 'SQL injection', re: /\bsqli\b|sql injection/i, probes: [/\bunion\s+(all\s+)?select\b/i, /'\s*(or|and)\s+('?[\w-]+'?|\d+)\s*=\s*('?[\w-]+'?|\d+)/i, /'\s*(--|#)/, /\b(sleep|benchmark)\s*\(\s*\d/i], testValue: "' OR 1=1", testNote: "compare with the same request using ' OR 1=2 — if the two answers differ, the input reaches the query" },
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

/** The topic a Lane J lead line belongs to, when it names one. */
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
export function coverageObservation(result, { surface, cls }) {
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
    // (c) distilled global lessons for this target type.
    // HUMAN-BRAIN (26 Oct 2026, per-hunt isolation): the target is
    // passed so another target's endpoint-specific lessons are
    // reduced to their technique rate before they reach the screen.
    let globalLessons = [];
    try {
      const fp = (meta && meta.appFingerprint) || (memory.meta && memory.meta.appFingerprint) || { appType: 'unknown', techStack: [] };
      globalLessons = globalLessonLines(getRelevantMemories(fp, 6, { target }));
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
      knownApp: knownAppOf(meta, target),
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

export function systemPromptFor(target, parsedScope) {
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
    // HUNTER-MIND (26 Oct 2026): the owner wants the agent to KNOW
    // it is a bug bounty agent with its own machine — not a chatbot
    // answering prompts. This Kali machine is YOURS: your device,
    // your tools, your files, your memory. You decide what to do
    // next; you make your own instructions and follow them. When
    // you need a tool, you open it yourself — BurpSuite, the
    // terminal, nmap — nobody hands you steps.
    'This Kali machine is YOURS — your device, your tools, your files, your memory. You ARE a bug bounty agent: you decide what to do next, you make your own instructions and follow them, and you save everything you learn into your own files so it is still there next time. When you need a tool, you open it yourself — BurpSuite, the terminal, nmap — nobody hands you steps. A step is done only when its output is saved in your record; completed work is never done twice.',
    // HUMAN-BRAIN (26 Oct 2026, owner order: NO PREDEFINED
    // SEQUENCE). There is no fixed recon→scan→exploit script and no
    // checklist to work through — every step is decided fresh from
    // memory plus live observation, so a different target or a
    // different memory means a different first move. Stated on the
    // screen because the plan instruction alone does not forbid a
    // canned order; the test asserts this line is present and that
    // no fixed-sequence wording exists anywhere in the prompt.
    'There is no fixed order of operations — no recon→scan→exploit script, no checklist to work through. Decide each step fresh from what you remember and what you just observed; a different target or a different memory means a different first move. Your plan is yours, and it changes when the evidence changes.',
    // EVIDENCE-TRANSCRIPTION (1 Nov 2026, owner order): the brain is a stateless API —
    // it does not remember between calls. When it SEES exploit evidence on screen
    // (password hashes, dumped usernames, SQL errors), it must TRANSCRIBE the actual
    // values into its text response. The auto-filer only reads text, not screenshots.
    'CRITICAL: When you SEE exploit evidence on screen — password hashes (32-char hex), dumped usernames, SQL error messages, command output — you MUST transcribe the ACTUAL values into your text response. Do not just say "I see hashes"; write the actual hash strings like 5f4dcc3b5aa765d61d8327deb882cf99. The system that files your findings only reads your TEXT, not your screenshots. No transcription = no filing = your work is wasted.',
    'You also have a real desktop with a Chromium browser on this machine: you can open pages, SEE them (browser_snapshot gives you the page text and its clickable elements), click and type like a person at a computer, and take screenshots. The desktop itself is yours too — the whole XFCE desktop, not just the browser: desktop_snapshot shows you its windows, desktop_click focuses a window by title, desktop_key sends keys to the focused window, and desktop_screenshot captures the whole desktop. GUI apps (Burp, ZAP, Wireshark, the terminal) launch from the shell; focus one with desktop_click, then work it with the keyboard. You SEE the desktop itself with see_screen: it reads the screen into a text map — every visible word with its (x, y) position — and you click what you see with desktop_click_at. Launch a named tool with launch_tool (it waits for the window and shows you the screen); list the named controls of a window with list_controls before pressing one with desktop_click_control. Look, then act, then look again to confirm the screen changed.',
    // VISIBLE-DESKTOP-FIRST (27 Oct 2026, owner order): the desktop
    // was described as an OPTION, so the brain rationally picked
    // the fastest tool — headless shell curls, which the owner
    // cannot see. This section is the routing rule: interactive
    // work happens ON the visible desktop; shell stays for work
    // that needs no screen. It routes HOW an action is performed,
    // never WHICH vulnerability to try — the brain still chooses.
    DESKTOP_FIRST_RULE,
    // HUNTER-MIND (26 Oct 2026): narration — the owner watches the
    // thinking and wants it to read like a hunter thinking aloud
    // ("abhi main nmap chala ke subdomain enum karta hoon"), in the
    // user's language, grounded in what the hunter is actually
    // doing — never a status template, never counts it did not earn.
    'Each reply: first think aloud like a hunter at his machine — in the user\'s language, in your own words, 2–3 sentences: what you are doing right now, what the last output told you, and what you will try next and why. Say it like you would to another hunter watching over your shoulder — never a status template, never counts you did not earn, never "I will do X later" without doing it. Then give EXACTLY ONE action as a JSON object on the last line:',
    // REAL-HUMAN (26 Oct 2026): the owner talks to you mid-hunt.
    // When YOUR OWNER\'S QUESTIONS are on your screen, answer them
    // in THIS reply: add a "chat_answers" array to your action JSON
    // — [{"q":"<id>","answer":"..."}] — one answer per question, in
    // the user\'s language, from what you actually did and think.
    // Never a canned summary, never counts you did not earn, never
    // "I will answer later" — the answer IS this reply. A question
    // you leave out stays queued for your next turn.
    'If YOUR OWNER\'S QUESTIONS are on your screen, answer them in this same reply: add "chat_answers":[{"q":"<id>","answer":"your answer in the user\'s language"}] to your action JSON (beside the action, not instead of it). Answer from what you actually did and think — a real human answers the person talking to them, they do not recite a status template.',
    '{"action":"shell","command":"..."} — run any shell command on your machine (curl, nmap, python3, anything installed — or download/install what you need)',
    '{"action":"search","query":"..."} — search the web (techniques, CVEs, docs)',
    '{"action":"write_file","name":"x.py","content":"..."} — save a file or script in your workspace (permanent: it survives container restarts); run it later with a shell action. For anything longer than one reply — a big script, a tool installer — write the first chunk with write_file, then keep appending one chunk per reply with a shell action whose command is APPEND_ARTIFACT: x.py followed by the next chunk on the next line, resuming exactly where the last chunk ended; READ_ARTIFACT: x.py with start:end reads any slice back. Save downloaded tools the same way: keep the installer script as a file and rerun it in a fresh container, never trust a container install to survive a restart.',
    '{"action":"browser_open","url":"..."} — open a page in your desktop browser',
    '{"action":"browser_snapshot"} — see the current page: its text and clickable elements',
    '{"action":"browser_click","text":"visible label OR CSS selector"} — click in the desktop browser',
    '{"action":"browser_type","target":"field label OR CSS selector","text":"...","submit":true} — type into THAT field (it is cleared first, then your text is typed; the observation tells you what the field holds afterwards — if it does not match what you typed, snapshot and correct yourself; a type without a target is refused). submit=true presses Enter after typing',
    '{"action":"screenshot"} — capture the browser viewport to a PNG artifact; you also get the page text',
    '{"action":"desktop_snapshot"} — see the whole XFCE desktop: its windows and which one is focused (text — you never see the image; the owner watches the desktop live)',
    '{"action":"desktop_click","window":"Burp Suite"} — focus a window by its title (exact, starts-with, or contains) and send it a click; the focused window then receives your desktop_key keystrokes. Take desktop_snapshot first if you do not know the window titles.',
    '{"action":"desktop_click_control","control":"Repeater","window":"Burp Suite"} — click a NAMED CONTROL inside a GUI app (a tab, a button, a menu item) by its visible name: the loop finds it in the app\'s accessibility tree and clicks it. Give the control\'s visible name ("Repeater", "Send", "Proxy"), and "window" when more than one app is open. This is how you press a button inside Burp/ZAP/Wireshark — desktop_click only focuses a window, it never presses a button inside it. If the app has no accessibility tree (or AT-SPI is not installed in this image), the observation says so — fall back to desktop_key keyboard navigation.',
    '{"action":"desktop_key","keys":"ctrl+l"} — send keys to the focused window: modifiers ctrl/alt/shift/super/meta plus one key (Return, Tab, Escape, space, BackSpace, Delete, arrows, Home, End, Page_Up, Page_Down, F1-F12, or a single letter/digit). Or {"action":"desktop_key","text":"nmap -sV target"} to type literal text into the focused window. This is how you work inside GUI apps after focusing them.',
    '{"action":"desktop_screenshot"} — capture the WHOLE desktop (not just the browser) to a JPG artifact; you also get the desktop state text',
    '{"action":"see_screen"} — LOOK at the desktop yourself: read the whole screen into a text map — every visible word with its (x, y) position, e.g. `"Log in" at (1240, 310)`. This is how you see what is on screen (you never see the image itself). Use it before clicking anything on the desktop, and again after acting to confirm the screen changed. If it says OCR is not installed, the image rebuild has not landed yet — use desktop_snapshot instead.',
    '{"action":"desktop_click_at","x":1240,"y":310} — click at a point FROM THE SCREEN MAP (see_screen first; never guess coordinates). The mouse moves to (x, y) and clicks. Then see_screen again to confirm what changed.',
    // MISSION Stage 2 (31 Oct 2026): explicit expectation — the brain
    // declares what the action should achieve; the loop verifies it.
    'EXPECTATION (proves your action worked — use it on important actions): add "expect" to any action, e.g. {"action":"browser_click","text":"Login","expect":"url contains /dashboard"}. Clauses, ";"-separated: "url contains <text>", "url is <url>", "url not <text>", "text contains <text>", "text absent <text>". The next observation carries [EXPECTATION VERIFIED] or [EXPECTATION NOT VERIFIED] with evidence — on NOT VERIFIED, diagnose and retry instead of assuming success.',
    // MISSION Stage 3 (31 Oct 2026): structured plan — objective, state,
    // risk, fallback alongside the machine-checkable expect.
    'STRUCTURED PLAN (makes your reasoning auditable — use it on multi-step work): add "plan" to any action, e.g. {"action":"browser_click","text":"Login","expect":"url contains /dashboard","plan":{"objective":"log in to DVWA","state":"on the login page with a vaulted credential","expected":"dashboard loads","risk":"low — lab target, in scope","fallback":"if login fails, read the error text and re-type the password"}}. The plan is recorded; on [EXPECTATION NOT VERIFIED] your fallback is surfaced back to you.',
    // TOOLS/OS AUTONOMY (27 Oct 2026, owner order): named tool
    // launches, allow-listed installs, and control lists — the
    // structured actions behind the desktop-tools skill card.
    '{"action":"launch_tool","tool":"burp"} — launch a NAMED tool on your machine and wait for it to be ready: GUI tools (burp, zap, wireshark) open on the desktop and you get a fresh screen map back; CLI tools (nmap, nikto, nuclei, sqlmap, ffuf, gobuster) are checked and you get their version. A repeat launch just reports the tool is already running — it never starts a second copy. Use launch_tool (not shell) for starting GUI tools. The first Burp launch in a hunt also walks the first-run wizard, confirms the intercept proxy, and opens the target in Burp\'s own browser.',
    '{"action":"download_tool","tool":"subfinder"} — install a tool that is missing from this machine. Installable tools are: subfinder, amass, dnsenum, whatweb (apt) and jwt-tool (one small direct download). Anything else is refused before anything runs. The install is logged, and the tool stays installed in this container.',
    '{"action":"list_controls","window":"Burp Suite"} — list the NAMED controls (buttons, tabs, fields) of a GUI window from its accessibility tree, with the screen position of each. Use it before desktop_click_control when you do not know a control\'s exact name. If the app exposes no tree, the observation says so — fall back to see_screen and desktop_click_at.',
    // HUMAN-BRAIN (26 Oct 2026, owner order: GUI-VISIBLE TERMINAL).
    // Terminal work happens in a terminal window ON the GUI desktop
    // so the owner watches it live — this action opens xfce4-terminal
    // if needed, focuses it, types the command visibly, presses
    // Return, and brings the output back (the run is also saved in
    // the output ledger, like a shell run). Same rules as shell:
    // scope-checked, deduped, recalled from the saved output.
    '{"action":"desktop_terminal","command":"..."} — run a command in a terminal window ON the GUI desktop (the owner watches it live): the loop opens xfce4-terminal if needed, focuses it, types your command visibly and presses Return, and brings the output back to you. Use it for terminal work you want seen — nmap, curl, a script — instead of the headless shell action. Same rules as shell: scope-checked, deduped, and answered from the saved output if you already ran it (force + why to re-run).',
    '{"action":"proxy_start"} — start your intercepting proxy (Burp-style) on this machine: your browser is re-routed through it so EVERY request/response is captured, and you get the intercept dashboard URL — open it in your browser to click through captured requests visually. The proxy is pass-through: traffic is captured, never held.',
    '{"action":"intercept_list"} — list the requests your proxy has captured (newest last, each with a # index)',
    '{"action":"intercept_read","index":3} — read one captured request in full: its headers and body, and the response headers and body',
    '{"action":"intercept_replay","index":3,"headers":{"X-Test":"1"},"body":"changed=1","url":"http://target.test/other"} — resend a captured request from your machine, optionally with a changed URL, extra/changed headers (a null value removes a header), or a changed body. This is Burp Repeater work: change ONE thing at a time and compare the response. The URL is scope-checked like any other action.',
    '{"action":"note","text":"..."} — write a note in your own notebook (your memory is permanent)',
    '{"action":"recall","query":"..."} — search YOUR OWN memory: this hunt\'s full record, what earlier hunts on THIS target learned, and generic technique rates from other targets (never their endpoints or payloads — each target\'s memory stays its own). Use it whenever your briefing mentions something you need in detail — an exact result, a payload you tried, a lesson — instead of re-doing the work; remembering is free and instant.',
    // KEYWORD-INDEX (27 Oct 2026): recall by sequential id + the
    // task block beside the action. The Action Index on every screen
    // lists one line per action, numbered #1, #2, #3… — the number IS
    // the lookup. The task block is the hunt's current state: the
    // backend records it, and the next turn resumes it instead of
    // starting fresh.
    '{"action":"recall","id":7} — fetch the FULL stored record of action #7 from your Action Index (one line per action, numbered #1, #2, #3… — the number is the lookup, no search needed). Use it when you need an exact result, a payload you tried, or an output — instead of re-doing the work. Out of range, the observation says how many actions the index holds.',
    // BRAIN FILES (28 Oct 2026, owner order): the brain's context is
    // three files. The MEMORY file (titles + hashes only — what was
    // done, never the results) and the PROCESS file (the current
    // process, full detail, in_process true/false) are sent to you
    // every turn on your screen. The OUTPUT file (the results) stays
    // on the backend — fetch ONE result by hash/id when you need it.
    'YOUR SCREEN carries your MEMORY file (titles + hashes — everything you have done in this hunt, so you NEVER repeat work) and your PROCESS file (the process you are in, in_process true/false, and every line of what has happened in it). Read both before choosing. When a process finishes (in_process flips to false), think of a NEW process — a new vulnerability, a new curiosity, a new variety.',
    // RECALL WITH A REASON (28 Oct 2026, owner order): when you need
    // a past result, say WHY — {"recall":{"id":7,"reason":"I need the exact UNION payload that dumped the users, to reuse it on the next endpoint"}}. The reason is recorded with the request.',
    'When you recall a past action, ALWAYS say why: {"recall":{"id":7,"reason":"<why you need this data>"}} — the reason is recorded with the request. A recall without a reason is still served, but a brain that cannot say why it needs data is a brain guessing.',
    'Your reply may carry a task block beside the action: {"task":"<what you are doing right now>","goal":"<what it achieves>","progress":"<how far you are>","status":"in_progress"} — I record it as your current task, so the next turn resumes it instead of starting fresh. When a task is DONE, send the block with "status":"complete" and a one-line "summary" of what it produced — its input and output are saved to your record then. A task is a goal plus its actions; finishing one is how the hunt moves forward.',
    'Your screen carries an ACTION INDEX — one line per action you have taken in THIS hunt, numbered #1, #2, #3… with a one-word outcome each. It is your complete map of what is done: read it before choosing, so you never redo a finished action and you can see which variants are still open.',
    // HUNTER-MIND (26 Oct 2026): the plan is the hunter's own
    // instructions — it writes them, works them step by step, and
    // checks steps off with evidence. And the output ledger: an
    // action already run is answered from its saved output instead
    // of re-running — a redo needs a stated reason ("force" + "why").
    '{"action":"hunt_plan","steps":["first step in your words","next step","..."]} — write or revise YOUR OWN hunt plan: your own steps, your own order, up to 12 steps, one instruction each. Your plan runs the hunt: work it step by step. {"action":"hunt_plan","done":2,"evidence":"the output that proves it"} marks a step done (step number, or its id); {"action":"hunt_plan","skip":2,"evidence":"why it does not apply"} drops one. Finished steps stay finished — a revised list never resurrects them.',
    'Your completed work is saved in your record: if you choose an action you already ran, the loop answers with the saved output instead of re-running it — act on that output. Re-run ONLY if something changed (the target changed, you need a different flag or scope, the saved output is incomplete for what you need now) — and say why: repeat the action with "force": true and "why": "<your reason>". A re-run without a reason is refused.',
    '{"action":"record_coverage","surface":"the page/endpoint/feature","class":"the vuln class","outcome":"probed_clean|confirmed|ruled_out|not_applicable|open_gap","evidence":"what you observed"} — account for a surface × class in your coverage ledger. Each pair is recorded exactly once; closing as ruled_out or not_applicable REQUIRES the evidence to name the control that stops the class. Add "update":true to change an existing row. Researched-but-unprobed classes are carried as open gaps automatically — closing them is how they leave your screen.',
    '{"action":"load_skill","skill":"sqli"} — pull one of your SKILL CARDS: a compact procedure for a vuln class (attack surface, detection channels, numbered testing steps, and the proof bar a claim must clear). Pull one when you OPEN a class, instead of searching the web — the card\'s steps end in a probe. The card index is on every screen; one card at a time.',
    '{"action":"request_details","title":"Login for <site>","account":"owner","fields":[{"key":"email","label":"Login email","type":"email"},{"key":"password","label":"Password","type":"password"}]} — ASK THE OWNER for details you need (a login, an OTP, any field): a card appears below the chat and the owner fills it in. Wait for the next turn — the details arrive on your screen (one-turn only, never written to the record). Do NOT re-ask for the same details and do NOT re-attempt the blocked action while a request is open. Any field type works: text, email, password, otp, textarea. "account":"owner" means it is the OWNER\'s own existing account (ask first is correct there). "account":"fresh" (or omitted) means a NEW account you could create yourself — the server REFUSES a fresh ask until you have tried the self path first (save_credential, then use_saved_credential, then fetch_verification_code); ask only after that path fails, and say what failed.',
    'ACCOUNTS — when a target needs an account, FIRST decide whose account it is. (A) THE OWNER\'S OWN EXISTING ACCOUNT (his personal login to a service he already has, e.g. his kSuite login): ask FIRST with request_details and "account":"owner" — the owner gives you THEIR account in the chat; do NOT create your own. (B) A FRESH ACCOUNT on a target (a training ground, or any site that allows self-registration): try YOURSELF first, in this order — (1) save_credential for the site (vaults the login AND provisions your own temp-mail inbox for verification mail), (2) use_saved_credential to fill the form from the vault, (3) fetch_verification_code to poll your temp-mail inbox for the code. Only if that path FAILS (the site blocks the temp-mail domain, no mail arrives, or it demands a phone/SMS code or an interactive captcha your clicks cannot solve) ask the owner with request_details and "account":"fresh" — and say what failed. The server REFUSES a fresh ask when you have not tried yourself first, so attempt the self path and record it before asking. Never the owner\'s identity, never another user\'s data, only in-scope targets. {"action":"save_credential","site":"https://target.example","username":"obfinity-xxxx"} — vault a credential for a site (omit "password" and the server generates a random 20-char one and shows it to you ONCE, this turn only — type it immediately with browser_type into the password field (target: the password field label, e.g. "Password"), then submit; it is never written to the permanent record, and neither is any password you invent: keep passwords OUT of your thinking and notes, the record keeps the handle only, e.g. cred:target.example:ab12cd34ef56). {"action":"use_saved_credential","handle":"cred:...","usernameField":"Email","passwordField":"Password"} — fill a login form from the vault without the password ever appearing in text (give the two fields\' visible labels from a snapshot; omit them and you get the handle + username back to snapshot first). {"action":"fetch_verification_code","handle":"cred:..."} — poll your temp-mail inbox for that site\'s verification code (one-turn observation — type it immediately; if no mail arrives the observation says the domain may be blocked, so record that as a blocker and move on, never retry forever). If a signup demands a phone/SMS code or an interactive captcha your clicks cannot solve, that path is blocked — say so and move on; never use a third-party captcha solver.',
    '{"action":"claim_finding","title":"...","class":"sqli","evidence":"the exact output that proves it","command":"the exact command that produced that evidence","counterevidence":"the control/baseline result that could have disproved it","confidence":"high|medium|low","confidence_rationale":"required when confidence is not high"} — claim a vulnerability. The filing is complete-the-proof gated: a claim missing any of title, class, a runnable reproduction ("command", or "poc" naming a proof script saved in this hunt), evidence, counterevidence, or confidence is bounced back UNRECORDED with the missing pieces named — complete the package and claim again. A complete claim goes to an independent verifier, which re-runs your command and checks the evidence; ONLY verified findings count. Never claim without reproduced evidence.',
    'Act like a person: if you need a tool, download it; if you don\'t know something, search; if output is interesting, dig; one step at a time — you will see the result on the next screen.',
    `Programme rules you must obey: ${rules.join('; ')}.`,
  ].join('\n');
}

export function findingsFromEvents(deps, huntId) {
  try {
    return applyRetractions(deps.readEvents(huntId));
  } catch {
    return [];
  }
}
