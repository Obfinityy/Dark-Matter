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

function defaultBriefing(huntId, target, meta) {
  try {
    const rows = getAllReasoning(huntId);
    const findings = readHuntEvents(huntId).filter((e) => e.type === 'finding');
    const ledger = buildFullHistoryLedger({
      reasoningRows: rows,
      findings,
      chainContext: (meta && meta.chainContext) || null,
      budgetChars: 6000,
    });
    let gm = '';
    try {
      const fp = (meta && meta.appFingerprint) || { appType: 'unknown', techStack: [] };
      gm = formatGlobalMemoryForPrompt(getRelevantMemories(fp, 6)).slice(0, 1500);
    } catch { /* global memory is best-effort */ }
    return [ledger.text || '', gm ? `\n--- LESSONS FROM ALL PAST HUNTS ---\n${gm}` : '']
      .join('\n')
      .slice(0, 7500);
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

function buildScreen({ target, parsedScope, briefing, findings, machineState, lastObservation, turn, turns, scopeHosts = [], facts = [], repetition = [] }) {
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
    buildBriefing: d.buildBriefing || defaultBriefing,
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
  let repetition = [];
  try {
    repetition = repetitionLines(deps.readEvents(huntId));
  } catch { /* repetition is best-effort */ }
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
    if (kind === 'shell') {
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
