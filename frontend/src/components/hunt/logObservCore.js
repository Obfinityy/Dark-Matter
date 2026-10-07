/**
 * logObservCore.js — wave 32 (ideas 51241–51280): log observability round 3
 * — pure logic.
 *
 * Ideas 51241–51280 (log observability round 3): log bookmarks with notes,
 * anomaly flagging, log correlation to findings/phases, tail-follow mode,
 * mid-hunt log sampling, structured log cards, log diff view, tool runtime
 * stats, command echo, log retention control, multi-hunt log switcher,
 * log annotations, quiet hours for logs, log-driven alerts,
 * screenshot-on-event, log timeline minimap, copy-as-curl, log redaction
 * presets, agent thought stream, log performance overlay, stall detection,
 * log sharing links, log watermarking, offline log cache, log summarizer,
 * tool output diffing, log keyboard navigation, custom log views,
 * log-to-finding promotion, execution graph view, log sentiment, request
 * replay sandbox, log integrity hash, parallel stream merge, log density
 * control, smart log folding, log voice narration, log export scheduling,
 * cross-hunt log compare, log-based Q&A.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic (no Math.random, no Date.now inside).
 */

export const WAVE32_START = 51241;
export const WAVE32_END = 51280;

/** Registry of all 40 ideas in this wave — completeness is testable. */
export const WAVE32_IDEAS = [
  [51241, 'log bookmarks', 'Mark lines to revisit, with notes attached to each bookmark'],
  [51242, 'anomaly flagging', 'The agent flags unusual log patterns for your attention automatically'],
  [51243, 'log correlation', 'Lines linked to the finding or phase they contributed to'],
  [51244, 'tail-follow mode', 'The stream auto-scrolls with a pause-on-hover for reading'],
  [51245, 'log sampling (mid-hunt)', 'During floods, show a representative sample with a "showing 1 of N" indicator'],
  [51246, 'structured log cards', 'Key events rendered as readable cards instead of raw text'],
  [51247, 'log diff view', 'Compare log segments between two phases or two hunts'],
  [51248, 'tool runtime stats', 'Per-tool execution counts, durations, and error rates live'],
  [51249, 'command echo', 'Every agent decision shown with the command it issued and why'],
  [51250, 'log retention control', 'Choose how much history stays in the live buffer per hunt'],
  [51251, 'multi-hunt log switcher', 'Flip the log view between concurrent hunts without losing scroll position'],
  [51252, 'log annotations', 'Add your own notes inline on any log line for later review'],
  [51253, 'quiet hours for logs', 'Collapse routine recon chatter into summaries during long phases'],
  [51254, 'log-driven alerts', 'Get notified when a log pattern you defined appears'],
  [51255, 'screenshot-on-event', 'The agent captures screenshots at key log moments automatically'],
  [51256, 'log timeline minimap', 'A density overview for jumping to busy or quiet periods'],
  [51257, 'copy-as-curl (mid-hunt)', 'One click copies any logged request as a curl command for manual replay'],
  [51258, 'log redaction presets', 'One-tap masking profiles for demos, clients, or public sharing'],
  [51259, 'agent thought stream', 'The agents internal reasoning rendered as a readable companion to raw logs'],
  [51260, 'log performance overlay', 'Request rates and latencies graphed alongside the log stream'],
  [51261, 'stall detection', 'The log view highlights when no new activity appears for an unusual gap'],
  [51262, 'log sharing links', 'Share a live, read-only log view with a teammate via link'],
  [51263, 'log watermarking', 'Shared log views carry viewer identity to discourage leaks'],
  [51264, 'offline log cache', 'The full log stays browsable even if the hunt connection drops'],
  [51265, 'log summarizer', 'AI-condensed summaries of any selected log range in plain language'],
  [51266, 'tool output diffing', 'Compare outputs of the same tool across runs to spot changes'],
  [51267, 'log keyboard navigation', 'Jump between errors, findings, and bookmarks with shortcuts'],
  [51268, 'custom log views', 'Save filter combinations as named views like "auth failures only"'],
  [51269, 'log-to-finding promotion', 'Turn any log line into a draft finding with evidence attached'],
  [51270, 'execution graph view', 'The hunt rendered as a live node graph of actions and their results'],
  [51271, 'log sentiment', 'Phases color-coded by success, struggle, or idle based on log signals'],
  [51272, 'request replay sandbox', 'Re-run a logged request in an isolated sandbox from the log view'],
  [51273, 'log integrity hash', 'Tamper-evident hashing so logs serve as reliable evidence'],
  [51274, 'parallel stream merge', 'Sub-agent logs merged into one chronological stream with color coding'],
  [51275, 'log density control', 'Slider from "every packet" to "milestones only"'],
  [51276, 'smart log folding', 'Repetitive sequences collapsed into "repeated 47x" with expand option'],
  [51277, 'log voice narration', 'Have key log events read aloud during hands-free monitoring'],
  [51278, 'log export scheduling', 'Auto-export logs to your storage at phase boundaries'],
  [51279, 'cross-hunt log compare', 'Overlay logs from two hunts of the same target to spot differences'],
  [51280, 'log-based Q&A', 'Ask "why did the login test fail?" and get an answer grounded in the logs'],
];

// --- 51241 log bookmarks -----------------------------------------------------

/** Add or update a bookmark on a log line. Returns a new bookmarks map. */
export function addBookmark(bookmarks, lineId, note) {
  const next = { ...(bookmarks || {}) };
  next[lineId] = { lineId, note: String(note || ''), order: Object.keys(next).length };
  return next;
}

/** Remove a bookmark. Returns a new bookmarks map. */
export function removeBookmark(bookmarks, lineId) {
  const next = { ...(bookmarks || {}) };
  delete next[lineId];
  return next;
}

/** Bookmarks sorted in the order they were added. */
export function listBookmarks(bookmarks) {
  return Object.values(bookmarks || {}).sort((a, b) => a.order - b.order);
}

// --- 51242 anomaly flagging ---------------------------------------------------

/**
 * Flag anomalous lines: error bursts (>=3 errors within 5 lines), repeated
 * identical failures, and unusually long gaps. Returns flagged line ids with
 * reasons. Pure and deterministic.
 */
export function flagAnomalies(lines) {
  const ls = lines || [];
  const flags = [];
  let errRun = 0;
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    const lvl = String(l.level || 'info').toLowerCase();
    if (lvl === 'error' || lvl === 'warn') errRun++;
    else {
      if (errRun >= 3) flags.push({ lineId: l.id, reason: `error-burst (${errRun} consecutive)` });
      errRun = 0;
    }
    if (i > 0 && ls[i - 1].text === l.text && l.text) {
      let run = 2;
      let j = i - 1;
      while (j > 0 && ls[j - 1].text === l.text) { run++; j--; }
      if (run >= 4) flags.push({ lineId: l.id, reason: `repeated ${run}x` });
    }
    if (i > 0 && typeof l.ts === 'number' && typeof ls[i - 1].ts === 'number') {
      const gap = l.ts - ls[i - 1].ts;
      if (gap > 120000) flags.push({ lineId: l.id, reason: `gap ${Math.round(gap / 1000)}s` });
    }
  }
  if (errRun >= 3 && ls.length) flags.push({ lineId: ls[ls.length - 1].id, reason: `error-burst (${errRun} consecutive)` });
  return flags;
}

// --- 51243 log correlation ----------------------------------------------------

/** Attach finding/phase correlation to lines that reference them. */
export function correlateLines(lines, findings) {
  const fs = findings || [];
  return (lines || []).map((l) => {
    const text = String(l.text || '');
    const hit = fs.find((f) => f.id && text.includes(f.id));
    if (hit) return { ...l, findingId: hit.id, phase: hit.phase || l.phase };
    const ph = fs.find((f) => f.phase && l.phase === f.phase);
    return { ...l, phase: l.phase || (ph ? ph.phase : undefined) };
  });
}

// --- 51244 tail-follow mode -------------------------------------------------------

/**
 * Compute tail-follow state. Following pauses while the user hovers the
 * stream or has scrolled up; resumes on explicit follow or scroll-to-bottom.
 */
export function tailFollowState({ following, hovering, scrolledUp }) {
  if (hovering || scrolledUp) return 'paused';
  return following ? 'following' : 'idle';
}

// --- 51245 log sampling -----------------------------------------------------------

/**
 * Representative sample: keep first, last, all errors/warnings/bookmarked,
 * then evenly stride the rest to fit maxN. Returns { sample, total,
 * sampled } where sampled is true when the sample is smaller than total.
 */
export function sampleLines(lines, maxN, bookmarkIds) {
  const ls = lines || [];
  const bm = new Set(bookmarkIds || []);
  if (ls.length <= maxN) return { sample: ls.slice(), total: ls.length, sampled: false };
  const must = [];
  const rest = [];
  ls.forEach((l, i) => {
    const lvl = String(l.level || 'info').toLowerCase();
    if (i === 0 || i === ls.length - 1 || lvl === 'error' || lvl === 'warn' || bm.has(l.id)) must.push(i);
    else rest.push(i);
  });
  const budget = Math.max(0, maxN - must.length);
  const picked = new Set(must);
  if (budget > 0 && rest.length) {
    const stride = rest.length / budget;
    for (let k = 0; k < budget; k++) picked.add(rest[Math.floor(k * stride)]);
  }
  const idx = [...picked].sort((a, b) => a - b);
  return { sample: idx.map((i) => ls[i]), total: ls.length, sampled: true };
}

/** Human label for a sampled view: "showing 1 of N". */
export function sampleLabel(sampleCount, total) {
  return total <= sampleCount ? `showing all ${total}` : `showing ${sampleCount} of ${total}`;
}

// --- 51246 structured log cards -------------------------------------------------------

const CARD_LEVELS = new Set(['error', 'warn', 'finding', 'milestone']);

/** Render key events as structured cards instead of raw text. */
export function toLogCards(lines) {
  return (lines || [])
    .filter((l) => CARD_LEVELS.has(String(l.level || '').toLowerCase()) || l.findingId)
    .map((l) => ({
      id: l.id,
      kind: l.findingId ? 'finding' : String(l.level || 'info').toLowerCase(),
      title: l.findingId ? `Finding ${l.findingId}` : String(l.text || '').slice(0, 80),
      body: String(l.text || ''),
      ts: l.ts,
      module: l.module,
      findingId: l.findingId,
    }));
}

// --- 51247 log diff view ---------------------------------------------------------------

/**
 * Line-level diff between two segments: lines present in b but not a
 * (added), in a but not b (removed). Order-preserving, deterministic.
 */
export function diffLogSegments(a, b) {
  const sa = new Set((a || []).map((l) => l.text));
  const sb = new Set((b || []).map((l) => l.text));
  return {
    added: (b || []).filter((l) => !sa.has(l.text)),
    removed: (a || []).filter((l) => !sb.has(l.text)),
    addedCount: (b || []).filter((l) => !sa.has(l.text)).length,
    removedCount: (a || []).filter((l) => !sb.has(l.text)).length,
  };
}

// --- 51248 tool runtime stats ----------------------------------------------------------------

/** Per-tool execution counts, total/avg durations, and error rates. */
export function toolRuntimeStats(lines) {
  const stats = {};
  for (const l of lines || []) {
    if (!l.tool) continue;
    const s = stats[l.tool] || (stats[l.tool] = { tool: l.tool, runs: 0, errors: 0, totalMs: 0 });
    s.runs++;
    if (String(l.level || '').toLowerCase() === 'error') s.errors++;
    if (typeof l.durationMs === 'number') s.totalMs += l.durationMs;
  }
  return Object.values(stats).map((s) => ({
    ...s,
    avgMs: s.runs ? Math.round(s.totalMs / s.runs) : 0,
    errorRate: s.runs ? Math.round((s.errors / s.runs) * 1000) / 10 : 0,
  }));
}

// --- 51249 command echo -------------------------------------------------------------------------

/** Format an agent decision with the command it issued and why. */
export function commandEcho(decision) {
  const d = decision || {};
  return {
    decision: d.decision || 'unknown',
    command: d.command || '',
    why: d.why || '',
    line: `$ ${d.command || ''}\n# why: ${d.why || 'n/a'} → ${d.decision || 'unknown'}`,
  };
}

// --- 51250 log retention control ------------------------------------------------------------------

/** Keep only the newest `limit` lines in the live buffer. */
export function retentionSlice(lines, limit) {
  const ls = lines || [];
  const n = Math.max(0, Math.floor(limit));
  if (!n) return [];
  return ls.slice(Math.max(0, ls.length - n));
}

// --- 51251 multi-hunt log switcher -------------------------------------------------------------------

/**
 * Switch the visible hunt while preserving each hunt's scroll position.
 * state: { activeHuntId, scroll: { [huntId]: number } }.
 */
export function switchHuntLog(state, huntId, currentScroll) {
  const s = state || { activeHuntId: null, scroll: {} };
  const scroll = { ...(s.scroll || {}) };
  if (s.activeHuntId) scroll[s.activeHuntId] = currentScroll || 0;
  return { activeHuntId: huntId, scroll };
}

/** Restore the saved scroll position for a hunt (default 0). */
export function restoreScroll(state, huntId) {
  return (state && state.scroll && state.scroll[huntId]) || 0;
}

// --- 51252 log annotations -------------------------------------------------------------------------------

/** Add an inline annotation to a log line. */
export function addAnnotation(annotations, lineId, author, note) {
  const next = { ...(annotations || {}) };
  const list = [...(next[lineId] || [])];
  list.push({ author: String(author || 'you'), note: String(note || ''), order: list.length });
  next[lineId] = list;
  return next;
}

// --- 51253 quiet hours for logs -------------------------------------------------------------------------------

const ROUTINE = new Set(['recon', 'heartbeat', 'poll', 'keepalive']);

/** Collapse routine recon chatter into per-module summaries. */
export function quietHoursCollapse(lines) {
  const kept = [];
  const collapsed = {};
  for (const l of lines || []) {
    if (ROUTINE.has(String(l.module || '').toLowerCase()) && String(l.level || 'info').toLowerCase() === 'info') {
      const k = l.module;
      collapsed[k] = collapsed[k] || { module: k, count: 0, firstTs: l.ts, lastTs: l.ts };
      collapsed[k].count++;
      collapsed[k].lastTs = l.ts;
    } else kept.push(l);
  }
  const summaries = Object.values(collapsed).map((c) => ({
    id: `quiet-${c.module}`,
    level: 'summary',
    module: c.module,
    text: `${c.module}: ${c.count} routine messages collapsed`,
    count: c.count,
    ts: c.lastTs,
    collapsed: true,
  }));
  return { lines: kept, summaries, collapsedCount: Object.values(collapsed).reduce((n, c) => n + c.count, 0) };
}

// --- 51254 log-driven alerts -------------------------------------------------------------------------------------

/** Return patterns that match a log line's text (case-insensitive substring). */
export function checkAlertPatterns(line, patterns) {
  const text = String((line && line.text) || '').toLowerCase();
  return (patterns || []).filter((p) => p && p.pattern && text.includes(String(p.pattern).toLowerCase()));
}

// --- 51255 screenshot-on-event ----------------------------------------------------------------------------------------

const SCREENSHOT_TRIGGERS = new Set(['finding', 'error']);

/** Line ids that should trigger automatic screenshots. */
export function screenshotEvents(lines) {
  return (lines || [])
    .filter((l) => SCREENSHOT_TRIGGERS.has(String(l.level || '').toLowerCase()) || l.findingId)
    .map((l) => ({ lineId: l.id, ts: l.ts, reason: l.findingId ? `finding ${l.findingId}` : l.level }));
}

// --- 51256 log timeline minimap -------------------------------------------------------------------------------------------

/** Bucket line counts into n density buckets for the minimap. */
export function minimapBuckets(lines, n) {
  const ls = lines || [];
  const buckets = new Array(Math.max(1, n)).fill(0);
  if (!ls.length) return buckets;
  ls.forEach((_, i) => {
    const b = Math.min(buckets.length - 1, Math.floor((i / ls.length) * buckets.length));
    buckets[b]++;
  });
  const max = Math.max(...buckets, 1);
  return buckets.map((c) => Math.round((c / max) * 100) / 100);
}

// --- 51257 copy-as-curl --------------------------------------------------------------------------------------------------------

function shellQuote(s) {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s;
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

/** Build a curl command from a logged HTTP request for manual replay. */
export function toCurl(req) {
  const r = req || {};
  const parts = ['curl', '-X', String(r.method || 'GET').toUpperCase()];
  for (const [k, v] of Object.entries(r.headers || {})) parts.push('-H', shellQuote(`${k}: ${v}`));
  if (r.body) parts.push('--data-raw', shellQuote(typeof r.body === 'string' ? r.body : JSON.stringify(r.body)));
  parts.push(shellQuote(r.url || ''));
  return parts.join(' ');
}

// --- 51258 log redaction presets ---------------------------------------------------------------------------------------------------

const REDACTION_PRESETS = {
  demo: [/password=[^\s&]+/gi, /token=[^\s&]+/gi],
  client: [/password=[^\s&]+/gi, /token=[^\s&]+/gi, /api[_-]?key=[^\s&]+/gi, /secret=[^\s&]+/gi],
  public: [/password=[^\s&]+/gi, /token=[^\s&]+/gi, /api[_-]?key=[^\s&]+/gi, /secret=[^\s&]+/gi, /\b\d{1,3}(?:\.\d{1,3}){3}\b/g],
};

/** Apply a one-tap masking profile to log text. Unknown preset → unchanged. */
export function applyRedactionPreset(text, preset) {
  const rules = REDACTION_PRESETS[String(preset || '').toLowerCase()];
  if (!rules) return String(text || '');
  return rules.reduce((t, re) => t.replace(re, '[redacted]'), String(text || ''));
}

// --- 51259 agent thought stream -------------------------------------------------------------------------------------------------------

/** Format an internal reasoning step as a readable companion entry. */
export function thoughtStreamEntry(thought) {
  const t = thought || {};
  return {
    id: t.id,
    ts: t.ts,
    text: String(t.text || ''),
    confidence: typeof t.confidence === 'number' ? t.confidence : null,
    relatesTo: t.relatesTo || null,
  };
}

// --- 51260 log performance overlay -------------------------------------------------------------------------------------------------------

/**
 * Per-bucket request rates and avg latencies for the overlay graph.
 * Buckets span the log's time range evenly.
 */
export function perfOverlay(lines, buckets = 24) {
  const ls = (lines || []).filter((l) => typeof l.ts === 'number');
  const out = new Array(Math.max(1, buckets)).fill(null).map(() => ({ count: 0, totalMs: 0 }));
  if (!ls.length) return out.map((b) => ({ ...b, avgMs: 0 }));
  const ts = ls.map((l) => l.ts);
  const min = Math.min(...ts);
  const max = Math.max(...ts);
  const span = Math.max(1, max - min);
  for (const l of ls) {
    const b = Math.min(out.length - 1, Math.floor(((l.ts - min) / span) * out.length));
    out[b].count++;
    if (typeof l.durationMs === 'number') out[b].totalMs += l.durationMs;
  }
  return out.map((b) => ({ count: b.count, avgMs: b.count ? Math.round(b.totalMs / b.count) : 0 }));
}

// --- 51261 stall detection ------------------------------------------------------------------------------------------------------------------

/** Find gaps longer than thresholdMs with no new activity. */
export function detectStalls(lines, thresholdMs) {
  const ls = (lines || []).filter((l) => typeof l.ts === 'number');
  const stalls = [];
  for (let i = 1; i < ls.length; i++) {
    const gap = ls[i].ts - ls[i - 1].ts;
    if (gap > thresholdMs) stalls.push({ afterLineId: ls[i - 1].id, beforeLineId: ls[i].id, gapMs: gap });
  }
  return stalls;
}

// --- 51262 log sharing links -------------------------------------------------------------------------------------------------------------------

/** Deterministic share token from hunt id (FNV-1a hex). */
export function shareLink(huntId) {
  const s = String(huntId || '');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const token = (h >>> 0).toString(16).padStart(8, '0');
  return { url: `/share/logs/${token}`, token, huntId: s, readOnly: true };
}

// --- 51263 log watermarking -------------------------------------------------------------------------------------------------------------------------

/** Embed viewer identity into a shared view descriptor. */
export function watermark(viewer) {
  const v = viewer || {};
  return {
    viewerId: v.id || 'anonymous',
    viewerName: v.name || 'Anonymous',
    watermarkText: `Shared with ${v.name || 'Anonymous'} (${v.id || 'anonymous'}) — do not redistribute`,
    ts: null,
  };
}

// --- 51264 offline log cache ---------------------------------------------------------------------------------------------------------------------------------

/** Serialize the log for offline browsing (drops nothing, marks cachedAt as null for determinism). */
export function offlineCache(lines) {
  return { version: 1, cachedAt: null, count: (lines || []).length, lines: (lines || []).map((l) => ({ ...l })) };
}

// --- 51265 log summarizer -------------------------------------------------------------------------------------------------------------------------------------------

const STOPWORDS = new Set('the,a,an,and,or,to,of,in,on,for,with,is,was,are,were,be,been,by,at,as,it,its,this,that,from'.split(','));

/**
 * Extractive summary: score lines by signal words (error/finding/success/
 * failed/found) minus stopword noise, return top N in original order.
 */
export function summarizeRange(lines, maxLines = 5) {
  const ls = lines || [];
  const signal = ['error', 'failed', 'finding', 'found', 'success', 'vulnerable', 'critical', 'warning'];
  const scored = ls.map((l, i) => {
    const words = String(l.text || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
    let score = 0;
    for (const w of words) {
      if (STOPWORDS.has(w)) continue;
      score += 1;
      if (signal.includes(w)) score += 5;
    }
    if (String(l.level || '').toLowerCase() === 'error') score += 10;
    if (l.findingId) score += 10;
    return { i, score };
  });
  const top = scored
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, Math.max(1, maxLines))
    .map((s) => s.i)
    .sort((a, b) => a - b);
  return top.map((i) => ls[i]);
}

// --- 51266 tool output diffing -------------------------------------------------------------------------------------------------------------------------------------------

/** Line-level diff of two tool outputs (same shape as diffLogSegments). */
export function diffToolOutputs(a, b) {
  return diffLogSegments(
    (a || []).map((t, i) => ({ id: `a${i}`, text: String(t) })),
    (b || []).map((t, i) => ({ id: `b${i}`, text: String(t) })),
  );
}

// --- 51267 log keyboard navigation -------------------------------------------------------------------------------------------------------------------------------------------

/** Canonical shortcut map for log navigation. */
export function shortcutMap() {
  return {
    nextError: 'e',
    prevError: 'Shift+E',
    nextFinding: 'f',
    prevFinding: 'Shift+F',
    nextBookmark: 'b',
    prevBookmark: 'Shift+B',
    followTail: 't',
    search: '/',
    clearFilters: 'Escape',
  };
}

/**
 * Resolve the next line id matching a target kind from a position.
 * kind: 'error' | 'finding' | 'bookmark'. direction: 1 | -1.
 */
export function navigateLog(lines, fromIndex, kind, direction, bookmarkIds) {
  const ls = lines || [];
  const bm = new Set(bookmarkIds || []);
  const match = (l) => {
    if (kind === 'error') return ['error', 'warn'].includes(String(l.level || '').toLowerCase());
    if (kind === 'finding') return Boolean(l.findingId);
    if (kind === 'bookmark') return bm.has(l.id);
    return false;
  };
  if (direction >= 0) {
    for (let i = fromIndex + 1; i < ls.length; i++) if (match(ls[i])) return ls[i].id;
  } else {
    for (let i = fromIndex - 1; i >= 0; i--) if (match(ls[i])) return ls[i].id;
  }
  return null;
}

// --- 51268 custom log views ----------------------------------------------------------------------------------------------------------------------------------------------------

/** Save a named filter combination. */
export function saveView(views, name, filters) {
  const next = { ...(views || {}) };
  next[String(name)] = { name: String(name), filters: { ...(filters || {}) } };
  return next;
}

/** Apply a saved view's filters to lines (level + module + text query). */
export function applyView(lines, view) {
  const f = (view && view.filters) || {};
  return (lines || []).filter((l) => {
    if (f.level && String(l.level || '').toLowerCase() !== String(f.level).toLowerCase()) return false;
    if (f.module && String(l.module || '').toLowerCase() !== String(f.module).toLowerCase()) return false;
    if (f.query && !String(l.text || '').toLowerCase().includes(String(f.query).toLowerCase())) return false;
    return true;
  });
}

// --- 51269 log-to-finding promotion --------------------------------------------------------------------------------------------------------------------------------------------------

/** Turn a log line into a draft finding with evidence attached. */
export function promoteToFinding(line) {
  const l = line || {};
  return {
    id: null,
    draft: true,
    title: String(l.text || '').slice(0, 80) || 'Untitled finding',
    evidence: [{ lineId: l.id, text: l.text, ts: l.ts, module: l.module }],
    severity: 'medium',
    status: 'draft',
    source: 'log-promotion',
  };
}

// --- 51270 execution graph view -------------------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Build a node graph: each tool invocation is a node, edges link
 * consecutive invocations (parent = previous line's tool run).
 */
export function executionGraph(lines) {
  const nodes = [];
  const edges = [];
  let prevId = null;
  for (const l of lines || []) {
    if (!l.tool) continue;
    const id = `n${nodes.length}`;
    nodes.push({
      id,
      tool: l.tool,
      level: String(l.level || 'info').toLowerCase(),
      ts: l.ts,
      durationMs: l.durationMs || null,
      findingId: l.findingId || null,
    });
    if (prevId) edges.push({ from: prevId, to: id });
    prevId = id;
  }
  return { nodes, edges };
}

// --- 51271 log sentiment --------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Phase sentiment from log signals: error-heavy → struggle,
 * finding-heavy → success, mostly idle/routine → idle.
 */
export function logSentiment(lines) {
  const ls = lines || [];
  if (!ls.length) return 'idle';
  let errors = 0;
  let findings = 0;
  for (const l of ls) {
    const lvl = String(l.level || '').toLowerCase();
    if (lvl === 'error' || lvl === 'warn') errors++;
    if (l.findingId || lvl === 'finding') findings++;
  }
  const n = ls.length;
  if (findings / n >= 0.15) return 'success';
  if (errors / n >= 0.25) return 'struggle';
  return 'idle';
}

// --- 51272 request replay sandbox -----------------------------------------------------------------------------------------------------------------------------------------------------------------------

/** Build an isolated replay descriptor for a logged request. */
export function replaySandbox(request) {
  const r = request || {};
  return {
    sandbox: true,
    isolated: true,
    method: String(r.method || 'GET').toUpperCase(),
    url: r.url || '',
    headers: { ...(r.headers || {}) },
    body: r.body ?? null,
    curl: toCurl(r),
    warnings: ['Runs isolated from the live hunt', 'No findings will be recorded'],
  };
}

// --- 51273 log integrity hash -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/** FNV-1a hash of a string (hex, 8 chars). */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Tamper-evident chain hash: each line's hash includes the previous hash.
 * Returns { head, chain } where chain[i] = { lineId, hash }.
 */
export function integrityHash(lines) {
  let prev = '00000000';
  const chain = (lines || []).map((l) => {
    const hash = fnv1a(`${prev}|${l.id}|${l.ts}|${l.text}`);
    prev = hash;
    return { lineId: l.id, hash };
  });
  return { head: prev, chain };
}

/** Verify a chain produced by integrityHash. Returns true if intact. */
export function verifyIntegrity(lines, chain) {
  const fresh = integrityHash(lines);
  if (fresh.chain.length !== (chain || []).length) return false;
  return fresh.chain.every((c, i) => c.hash === chain[i].hash);
}

// --- 51274 parallel stream merge -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const STREAM_COLORS = ['#4f9cf7', '#7ee2a8', '#f7b84f', '#f47e7e', '#c79ef7', '#7ef0e2'];

/**
 * Merge sub-agent streams into one chronological stream with color coding.
 * streams: [{ agentId, name, lines }].
 */
export function mergeStreams(streams) {
  const all = [];
  (streams || []).forEach((s, si) => {
    const color = STREAM_COLORS[si % STREAM_COLORS.length];
    for (const l of s.lines || []) all.push({ ...l, agentId: s.agentId, agentName: s.name, color });
  });
  all.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  return all;
}

// --- 51275 log density control -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const DENSITY_LEVELS = ['packets', 'detailed', 'standard', 'milestones'];

/**
 * Filter by density level: packets (all), detailed (drop debug/trace),
 * standard (info+), milestones (findings/errors/milestones only).
 */
export function densityFilter(lines, level) {
  const ls = lines || [];
  const lvl = String(level || 'standard').toLowerCase();
  if (lvl === 'packets') return ls.slice();
  if (lvl === 'detailed') return ls.filter((l) => !['debug', 'trace'].includes(String(l.level || '').toLowerCase()));
  if (lvl === 'milestones') {
    return ls.filter((l) => {
      const lv = String(l.level || '').toLowerCase();
      return lv === 'error' || lv === 'finding' || lv === 'milestone' || Boolean(l.findingId);
    });
  }
  return ls.filter((l) => !['debug', 'trace'].includes(String(l.level || '').toLowerCase()));
}

export function densityLevels() {
  return [...DENSITY_LEVELS];
}

// --- 51276 smart log folding -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Collapse consecutive identical lines into "repeated Nx" groups.
 * Returns an array of { type: 'line'|'fold', ... }.
 */
export function foldRepeats(lines) {
  const ls = lines || [];
  const out = [];
  let i = 0;
  while (i < ls.length) {
    let j = i + 1;
    while (j < ls.length && ls[j].text === ls[i].text) j++;
    const count = j - i;
    if (count >= 3) {
      out.push({ type: 'fold', text: ls[i].text, count, firstId: ls[i].id, lastId: ls[j - 1].id, ids: ls.slice(i, j).map((l) => l.id) });
    } else {
      for (let k = i; k < j; k++) out.push({ type: 'line', ...ls[k] });
    }
    i = j;
  }
  return out;
}

// --- 51277 log voice narration -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/** Build spoken text for key log events (errors, findings, milestones). */
export function voiceNarration(lines) {
  return (lines || [])
    .filter((l) => {
      const lv = String(l.level || '').toLowerCase();
      return lv === 'error' || lv === 'finding' || lv === 'milestone' || Boolean(l.findingId);
    })
    .map((l) => {
      const lv = String(l.level || 'info').toLowerCase();
      const prefix = l.findingId ? 'Finding' : lv === 'error' ? 'Error' : 'Milestone';
      return `${prefix}: ${String(l.text || '').slice(0, 140)}`;
    });
}

// --- 51278 log export scheduling --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/** Build an auto-export plan: one export per phase boundary. */
export function exportSchedule(phases) {
  return (phases || []).map((p, i) => ({
    id: `export-${i}`,
    phase: p.name || `phase-${i}`,
    trigger: 'phase-boundary',
    format: p.format || 'json',
    destination: p.destination || 'default-storage',
  }));
}

// --- 51279 cross-hunt log compare -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/** Overlay two hunts' logs: shared vs unique line counts + diff. */
export function crossHuntCompare(a, b) {
  const d = diffLogSegments(a, b);
  const totalA = (a || []).length;
  const totalB = (b || []).length;
  const shared = totalB - d.addedCount;
  return {
    huntALines: totalA,
    huntBLines: totalB,
    sharedLines: Math.max(0, shared),
    onlyInA: d.removedCount,
    onlyInB: d.addedCount,
    added: d.added,
    removed: d.removed,
  };
}

// --- 51280 log-based Q&A ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Minimal grounded Q&A: find lines matching question keywords, return the
 * top matches as cited evidence with a templated answer. Honest about
 * being keyword-based, not a language model.
 */
export function answerFromLogs(question, lines) {
  const q = String(question || '').toLowerCase();
  const keywords = q.split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOPWORDS.has(w));
  const scored = (lines || []).map((l) => {
    const text = String(l.text || '').toLowerCase();
    let score = 0;
    for (const k of keywords) if (text.includes(k)) score += 2;
    if (String(l.level || '').toLowerCase() === 'error') score += 1;
    return { line: l, score };
  }).filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  const evidence = scored.slice(0, 3).map((s) => ({ lineId: s.line.id, text: s.line.text, ts: s.line.ts }));
  return {
    question: String(question || ''),
    answer: evidence.length
      ? `Based on ${evidence.length} matching log line${evidence.length > 1 ? 's' : ''}: ${evidence[0].text}`
      : 'No matching log lines found for this question.',
    evidence,
    grounded: evidence.length > 0,
  };
}
