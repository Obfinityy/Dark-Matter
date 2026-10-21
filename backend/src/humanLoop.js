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
import { writeArtifact, spillOutput } from './artifacts.js';
import { appendHuntEvent, readHuntMeta, writeHuntMetaCheckpoint, readHuntEvents } from './store.js';
import { isInScope } from './scopeParser.js';
import { recordReasoning, getAllReasoning, buildFullHistoryLedger } from './reasoningMemory.js';
import { getRelevantMemories, formatGlobalMemoryForPrompt } from './globalMemory.js';
import { getRuledOut } from './episodeStore.js';
import {
  guiBrowserOpen,
  guiBrowserSnapshot,
  guiBrowserClick,
  guiBrowserType,
  guiBrowserScreenshot,
} from './guiTools.js';

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

/**
 * (a) Dead ends for THIS target: what was tried on this hunt and failed,
 * one line each. Sources, in order: the validator-gated dead-end
 * registry (ruled_out — lessons composed by code from validator
 * verdicts), then this hunt's rejected/unverified claim records that the
 * registry does not already cover. Pure over plain data; capped at 8.
 */
export function deadEndLines({ ruledOut = [], events = [] } = {}) {
  const lines = [];
  const covered = new Set();
  const byKey = new Map();
  for (const r of ruledOut || []) {
    if (!r) continue;
    const key = normTitle(r.key || r.title || '');
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, { lesson: r.lesson || '', n: 0 });
    const e = byKey.get(key);
    e.n++;
    if (r.lesson && (!e.lesson || (r.id || 0) > (e.newestId || 0))) {
      e.lesson = r.lesson;
      e.newestId = r.id || 0;
    }
  }
  const ruled = [...byKey.values()].sort((a, b) => b.n - a.n).slice(0, 6);
  for (const e of ruled) {
    if (e.lesson) lines.push(`- ${clipLine(e.lesson, 220)} (ruled out ×${e.n})`);
  }
  for (const key of byKey.keys()) covered.add(key);
  const rejected = [];
  const seenRejected = new Set();
  for (const ev of events || []) {
    if (!ev || ev.type !== 'finding' || ev.verified) continue;
    const key = normTitle(ev.title);
    if (!key || covered.has(key) || seenRejected.has(key)) continue;
    seenRejected.add(key);
    rejected.push(ev);
  }
  for (const ev of rejected.slice(0, 4)) {
    if (lines.length >= 8) break;
    const verdict = clipLine(ev.verification || 'the verifier did not confirm it', 110);
    lines.push(`- Claim rejected: "${clipLine(ev.title, 90)}" — ${verdict}`);
  }
  return lines.slice(0, 8);
}

// Technique topics for the researched-not-probed derivation. `research`
// matches the topic in searches/notes/stated intent; `probes` are the
// payload/signature shapes that count as an actual test against the
// target (plus a topic mention inside an executed shell/browser/claim
// action). Deliberately conservative: reading about a technique never
// counts as probing it.
const PROBE_TOPICS = [
  { id: 'ssti', label: 'SSTI (template injection)', re: /\bssti\b|template injection/i, probes: [/\{\{[^}]{0,60}\}\}/, /\$\{[^}]{0,60}\}/, /\{%[^%]{0,60}%}/] },
  { id: 'xss', label: 'XSS (cross-site scripting)', re: /\bxss\b|cross[- ]site scripting/i, probes: [/<script\b/i, /\balert\s*\(/, /\bonerror\s*=/i, /<svg\b/i, /\bprompt\s*\(/] },
  { id: 'sqli', label: 'SQL injection', re: /\bsqli\b|sql injection/i, probes: [/\bunion\s+(all\s+)?select\b/i, /'\s*or\s+('?1'?|\d+)\s*=\s*\1/i, /'\s*(--|#)/, /\b(sleep|benchmark)\s*\(\s*\d/i] },
  { id: 'ssrf', label: 'SSRF', re: /\bssrf\b|server[- ]side request forgery/i, probes: [/169\.254\.169\.254/, /metadata\.google/i, /100\.100\.100\.200/, /\bgopher:\/\//i] },
  { id: 'xxe', label: 'XXE', re: /\bxxe\b|xml external entit/i, probes: [/<!ENTITY/i, /<!DOCTYPE[^>]*\[/] },
  { id: 'lfi', label: 'LFI / path traversal', re: /\blfi\b|path traversal|directory traversal|local file inclusion/i, probes: [/\.\.[/\\]\.\.[/\\]/, /\/etc\/passwd/, /%2e%2e(%2f|\/)/i] },
  { id: 'cmdi', label: 'command injection', re: /command injection|\bos command\b/i, probes: [/[;|&`]\s*(id|whoami|sleep\s+\d)/i, /\$\(\s*(id|whoami)/] },
  { id: 'jwt', label: 'JWT attacks', re: /\bjwt\b|json web token/i, probes: [/eyJ[A-Za-z0-9_-]{5,}\.eyJ/, /alg["']?\s*[:=]\s*["']?none/i] },
  { id: 'cors', label: 'CORS misconfiguration', re: /\bcors\b|cross-origin/i, probes: [/origin\s*:/i] },
  { id: 'headers', label: 'security headers', re: /security headers|content-security-policy|\bcsp\b|clickjacking/i, probes: [/curl\s+[^|;&]*-[a-zA-Z]*I\b/, /curl\s+[^|;&]*--head\b/i] },
  { id: 'openredirect', label: 'open redirect', re: /open redirect/i, probes: [/[?&](url|next|redirect|redirect_uri|return|dest|target)=https?%3a/i] },
  { id: 'graphql', label: 'GraphQL', re: /graphql/i, probes: [/\/graphql\b/i, /\{\s*__schema\b/, /\bintrospection\b/i] },
];

/**
 * (b) Researched but not yet probed: topics this hunt has searched or
 * noted (or stated as intent in a reasoning row's "why") with NO probe
 * action against the target anywhere in the hunt's own record. One line
 * each, phrased as an explicit next-action candidate. Pure; capped at 6,
 * most-researched first.
 */
export function researchedNotProbedLines({ events = [], reasoningRows = [] } = {}) {
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
    if (probed) continue;
    out.push({ n, line: `- ${t.label}: researched ×${n} in your searches/notes, never probed — candidate next action: send ONE real probe for this at the target now instead of researching it again.` });
  }
  out.sort((a, b) => b.n - a.n);
  return out.slice(0, 6).map((o) => o.line);
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
export function assembleMemoryBriefing({ deadEnds = [], unprobed = [], globalLessons = [], ledgerText = '', budgetChars = BRIEFING_BUDGET } = {}) {
  const head = [];
  if (deadEnds.length) head.push(['--- DEAD ENDS ON THIS TARGET (tried and failed here — do not repeat these) ---', ...deadEnds].join('\n'));
  if (unprobed.length) head.push(['--- RESEARCHED BUT NEVER PROBED (your own open threads) ---', ...unprobed].join('\n'));
  if (globalLessons.length) head.push(['--- LESSONS FROM ALL PAST HUNTS ---', ...globalLessons].join('\n'));
  const headText = head.join('\n\n');
  const parts = [headText, String(ledgerText || '')].filter((p) => p && p.trim());
  return parts.join('\n').slice(0, budgetChars);
}

/** Length of the priority head alone — sizes the ledger's budget. */
export function memoryHeadLength({ deadEnds = [], unprobed = [], globalLessons = [] } = {}) {
  return assembleMemoryBriefing({ deadEnds, unprobed, globalLessons, ledgerText: '', budgetChars: Number.MAX_SAFE_INTEGER }).length;
}

export function buildMemoryBriefing(huntId, target, meta) {
  try {
    const rows = getAllReasoning(huntId);
    const events = readHuntEvents(huntId);
    const findings = events.filter((e) => e.type === 'finding');

    // (a) dead ends for this target — validator registry + rejected claims
    let ruledOut = [];
    try {
      ruledOut = getRuledOut(huntId, 60);
    } catch { /* registry is best-effort */ }
    const deadEnds = deadEndLines({ ruledOut, events });
    // (b) researched but never probed — from the hunt's own record
    const unprobed = researchedNotProbedLines({ events, reasoningRows: rows });
    // (c) distilled global lessons for this target type
    let globalLessons = [];
    try {
      const fp = (meta && meta.appFingerprint) || { appType: 'unknown', techStack: [] };
      globalLessons = globalLessonLines(getRelevantMemories(fp, 6));
    } catch { /* global memory is best-effort */ }

    // The ledger fills whatever the priority head leaves of the
    // existing cap (its own action budget was 6,000 when it stood
    // alone; findings/dead-end fixed lines always render in full).
    const headLen = memoryHeadLength({ deadEnds, unprobed, globalLessons });
    const ledgerBudget = Math.max(1200, Math.min(6000, BRIEFING_BUDGET - headLen - 1));
    const ledger = buildFullHistoryLedger({
      reasoningRows: rows,
      findings,
      chainContext: (meta && meta.chainContext) || null,
      budgetChars: ledgerBudget,
    });
    return assembleMemoryBriefing({
      deadEnds,
      unprobed,
      globalLessons,
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
    '{"action":"claim_finding","title":"...","evidence":"the exact output that proves it","command":"the exact command that produced that evidence"} — claim a vulnerability. An independent verifier re-runs your command and checks the evidence; ONLY verified findings count. Never claim without reproduced evidence.',
    'Act like a person: if you need a tool, download it; if you don\'t know something, search; if output is interesting, dig; one step at a time — you will see the result on the next screen.',
    `Programme rules you must obey: ${rules.join('; ')}.`,
  ].join('\n');
}

function findingsFromEvents(deps, huntId) {
  try {
    return deps.readEvents(huntId).filter((e) => e.type === 'finding');
  } catch {
    return [];
  }
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

function buildScreen({ target, parsedScope, briefing, findings, machineState, lastObservation, turn, turns, scopeHosts = [], facts = [], repetition = [], explored = [] }) {
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
    // Lane F: the already-explored digest sits EARLY — ahead of the
    // (long, capped) memory briefing — so no prompt cap downstream
    // can truncate away the record of what is already done.
    ...(explored && explored.length ? ['', ...explored] : []),
    '',
    '=== WHAT YOU KNOW (your memory — everything you have done and learned) ===',
    briefing || '(nothing yet — this hunt is young)',
    '',
    '=== FINDINGS SO FAR ===',
    findLines.length ? findLines.join('\n') : '(none yet)',
    ...(facts && facts.length ? ['', '=== FACTS ABOUT THIS HUNT ===', ...facts] : []),
    ...(repetition && repetition.length ? ['', '=== REPETITION CHECK ===', ...repetition] : []),
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
 *               assess (pipeline verifier; explicit null disables the lazy
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
    assess: 'assess' in d ? d.assess : (opts.assess || undefined), // undefined -> lazy pipeline assessResult; null -> disabled
    gui: d.gui || null, // lazy: guiTools bound to execRaw
    sleep: d.sleep || ((ms) => new Promise((r) => setTimeout(r, ms))),
    now: d.now || (() => Date.now()),
    buildBriefing: d.buildBriefing || buildMemoryBriefing,
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
  // The hunt's recorded events, read once: they feed both the
  // Repetition Check (display) and the already-done gate (Lane F,
  // enforcement). The gate's history then stays live in-session via
  // toolCall above.
  let sessionEvents = [];
  try {
    sessionEvents = deps.readEvents(huntId) || [];
  } catch { /* events are best-effort */ }
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
      lastObservation =
        'Your reply had NO parseable action JSON, so nothing happened. Reply with brief thinking, then end with EXACTLY ONE action as a JSON object on the last line — e.g. {"action":"shell","command":"curl -s ' + String(target).slice(0, 60) + '"}';
      note({ action: 'unparseable reply', why: replyText.slice(0, 300), result: 'no action executed', learned: 'Replies must end with exactly one action JSON.' });
      log.push({ turn, action: 'unparseable', observation: lastObservation });
      continue;
    }
    const action = parsed.action;
    const thinkingText = replyText.slice(0, parsed.jsonStart).trim().slice(0, 400);
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
      note({ action: 'note to self', why: text, result: 'recorded', learned: text.slice(0, 300) });
      say(`Note to self: ${text.slice(0, 300)}`);
      observation = 'Note saved in your notebook — it will be in your memory briefing from now on.';
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
      const title = String(action.title || 'Untitled claim').slice(0, 200);
      const evidence = String(action.evidence || '');
      const command = String(action.command || lastShellCommand || '');
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
    } else {
      observation = `Unknown action "${kind}". Valid actions: shell, search, write_file, note, browser_open, browser_snapshot, browser_click, browser_type, screenshot, claim_finding. Pick exactly one, as JSON on the last line.`;
    }

    // Lane F: remember what the executed action returned, so a later
    // repeat attempt can be answered with its last result.
    if (pendingSig) {
      const entry = actionHistory.get(pendingSig);
      if (entry) entry.lastResult = String(observation).slice(0, 220);
      pendingSig = null;
    }

    log.push({ turn, action: kind, observation: String(observation).slice(0, 300) });
    lastObservation = observation;
  }

  // Checkpoint: session totals on the hunt meta under humanLoop.
  try {
    const m = deps.readMeta(huntId) || {};
    const prev = m.humanLoop || {};
    deps.writeMeta(huntId, {
      ...m,
      huntId,
      humanLoop: {
        sessions: (prev.sessions || 0) + 1,
        turnsTotal: (prev.turnsTotal || 0) + turnsRun,
        lastTurnAt: new Date().toISOString(),
        lastActions: log.slice(-6).map((l) => l.action),
      },
    });
  } catch { /* checkpoint is best-effort */ }

  return { aiOk, turnsRun, actionsRun: log.length, newFindings, log };
}
