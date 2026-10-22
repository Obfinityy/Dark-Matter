// Dark Matter — HUNT MEMORY (Lane O, 22 Oct 2026 — owner order: the
// agent's memory must be PRESERVED in the backend and it must always
// KNOW what it has done, what it knows, and what it has not done,
// like a real human).
//
// THE PROBLEM this module solves. The hunter's record was fragmented
// across five stores (events.jsonl, reasoning.jsonl, coverage.json,
// DOSSIER.md, the ruled-out registry in episodes.db, global memory),
// and the only read path was humanLoop.buildMemoryBriefing, which
// squeezed a priority head + the full-history ledger through a single
// 7,500-char slice. On a long hunt, history silently fell out of the
// brain's view: dead ends were capped at 8 lines, researched-not-
// probed at 6, the coverage accounting on screen at 8 lines, and the
// action history was summarised by outcome counts only — no rollup
// by class or endpoint, so "what have I actually done" had no
// complete answer anywhere. Two more holes: meta.humanLoop.leftOff
// is written only at a clean session end, so a hunt whose hand-off
// was missing (legacy meta, crash, lost write) started cold despite
// a long record on disk; and DOSSIER.md is per-HUNT, so a brand-new
// hunt on a target the hunter had already worked opened knowing
// nothing of the earlier hunt.
//
// THE FIX — one read path, hierarchical memory:
//   loadHuntMemory(huntId) loads and reconciles EVERY store for the
//   hunt, tolerantly (a torn line in any file degrades that line,
//   never the memory), into one snapshot: reasoning rows, events,
//   retraction-filtered findings, the coverage ledger, the ruled-out
//   registry, the dossier, the left-off hand-off (persisted, or
//   DERIVED from the record when the persisted one is missing), and
//   the hunt's prior hunts on the same target.
//   buildStateOfMind(memory) renders the always-present essentials
//   from that snapshot: (a) WHERE I LEFT OFF, (b) WHAT I HAVE DONE
//   (rollups by tool, endpoint and class + the most recent actions),
//   (c) WHAT I KNOW (findings with retraction state, captured
//   artefacts, fingerprint), (d) WHAT I HAVE NOT DONE — the complete
//   outstanding table (coverage open gaps + research debt +
//   researched-not-probed + discovered-but-unprobed endpoints),
//   rendered in full, never sliced, (e) PATHS ALREADY RULED OUT in
//   full, and (f) knowledge inherited from earlier hunts of the same
//   target. The block rides the screen OUTSIDE the 7,500-char
//   briefing cap (the Lane F/J/L outside-cap region), so the
//   essentials cannot be crowded out by the narrative ledger, which
//   keeps its existing capped form inside the briefing.
//   Deep detail stays retrievable via the recall action; what a
//   human would hold in mind — done, known, outstanding, ruled
//   out — is always on screen.
//
// This module only READS. Every writer (appendHuntEvent,
// recordReasoning, coverageLedger, consolidation, episodeStore)
// is untouched, and nothing here judges a finding: assessResult
// remains the sole judge of truth, exactly as before.

import fs from 'node:fs';
import path from 'node:path';
import { dataDir, readHuntEvents, readHuntMeta, listHuntMetas, targetFolderName } from './store.js';
import { getAllReasoning, getHypothesisLedger } from './reasoningMemory.js';
import { loadCoverage, emptyCoverage, classLabelFor } from './coverageLedger.js';
import { getRuledOut } from './episodeStore.js';

const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

export const normTitle = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------
// Pure record helpers (canonical home — humanLoop re-exports these;
// they lived there until Lane O and the briefing/tests import them
// from both places).
// ---------------------------------------------------------------------------

const eventTs = (e) => (e && (e.cachedAt || e.ts || e.at)) || '';

/**
 * Finding events with retracted ones removed. A finding is retracted
 * when a LATER retraction event (type 'retraction') names it:
 * findingTitle must match the finding's title (normalised), and when
 * the retraction carries retractsStampTs AND the finding carries a
 * timestamp, the stamp must match too — conservative on purpose: a
 * title-only collision with a different stamp never removes a
 * genuine finding. Pure over the events array (array order is the
 * hunt's chronological record).
 */
export function applyRetractions(events) {
  const list = events || [];
  const findings = [];
  list.forEach((e, idx) => {
    if (e && e.type === 'finding') findings.push({ e, idx });
  });
  return findings
    .filter(({ e, idx }) => {
      const title = normTitle(e.title);
      if (!title) return true;
      const fTs = eventTs(e);
      for (let j = idx + 1; j < list.length; j++) {
        const r = list[j];
        if (!r || r.type !== 'retraction') continue;
        if (normTitle(r.findingTitle) !== title) continue;
        if (r.retractsStampTs && fTs && String(r.retractsStampTs) !== String(fTs)) continue;
        return false; // a later retraction names this finding
      }
      return true;
    })
    .map(({ e }) => e);
}

/** How many finding events applyRetractions removes. */
export function retractedFindingCount(events) {
  const total = (events || []).filter((e) => e && e.type === 'finding').length;
  return total - applyRetractions(events).length;
}

/**
 * Extract ONLY the 'Open threads' and 'Next step' sections of a
 * DOSSIER.md text, bounded to ≤600 chars total. Placeholder lines
 * ("- (none recorded)") are dropped; every other section — above all
 * 'Confirmed facts', which can carry pre-retraction pollution — is
 * never returned. Returns '' when there is nothing real to show.
 */
export function extractDossierBriefing(dossierText) {
  const lines = String(dossierText || '').split('\n');
  const buckets = { open: [], next: [] };
  let current = null;
  for (const line of lines) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) {
      const t = h[1].toLowerCase();
      current = t === 'open threads' ? 'open' : t === 'next step' ? 'next' : null;
      continue;
    }
    if (!current) continue;
    const t = line.trim();
    if (!t) continue;
    if (/^-\s*\(.*\)\s*$/.test(t)) continue; // "(none recorded)"-style placeholders carry no thread
    buckets[current].push(t);
  }
  const parts = [];
  if (buckets.open.length) parts.push(['Open threads:', ...buckets.open].join('\n'));
  if (buckets.next.length) parts.push(['Next step:', ...buckets.next].join('\n'));
  return parts.join('\n').slice(0, 600);
}

/**
 * The raw '- ' bullet lines of one '## <heading>' section of a
 * DOSSIER.md text (heading matched by case-insensitive prefix, so
 * 'Confirmed facts' matches 'Confirmed facts (validator-stamped
 * only)'). Placeholder bullets are dropped. Used for prior-hunt
 * inheritance, where the ruled-out and confirmed sections of an
 * EARLIER hunt's dossier are exactly the knowledge a new hunt must
 * open with.
 */
export function dossierSectionLines(dossierText, headingPrefix) {
  const want = String(headingPrefix || '').toLowerCase();
  if (!want) return [];
  const out = [];
  let current = false;
  for (const line of String(dossierText || '').split('\n')) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) {
      current = h[1].toLowerCase().startsWith(want);
      continue;
    }
    if (!current) continue;
    const t = line.trim();
    if (!t.startsWith('- ')) continue;
    if (/^-\s*\(.*\)\s*$/.test(t)) continue;
    out.push(t.slice(2).trim());
  }
  return out;
}

/** A dossier confirmed-fact line -> its finding title. */
function dossierFactTitle(line) {
  let t = String(line || '').trim();
  t = t.replace(/^\[[^\]]*\]\s*/, ''); // "[verified · high] " stamp
  const cut = t.search(/\s—\s|\s\(episode|\s\(×\d+\s*stamps?/);
  if (cut > 0) t = t.slice(0, cut);
  return t.trim();
}

/**
 * Dead ends for THIS target: what was tried on this hunt and failed,
 * one line each. Sources, in order: the validator-gated dead-end
 * registry (ruled_out — lessons composed by code from validator
 * verdicts), then this hunt's rejected/unverified claim records that
 * the registry does not already cover. Pure over plain data.
 * `limit` bounds the rendered lines (the capped briefing passes the
 * historical default of 8; the state-of-mind block passes a large
 * limit so the ruled-out record is complete).
 */
export function deadEndLines({ ruledOut = [], events = [] } = {}, { limit = 8 } = {}) {
  const cap = Math.max(1, Number(limit) || 8);
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
  const ruled = [...byKey.values()].sort((a, b) => b.n - a.n).slice(0, Math.max(6, cap - 2));
  for (const e of ruled) {
    if (e.lesson) lines.push(`- ${clip(e.lesson, 220)} (ruled out ×${e.n})`);
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
  const rejectedCap = cap <= 8 ? 4 : cap; // at the briefing's cap, rejected claims historically take at most 4 of the 8 lines
  for (const ev of rejected.slice(0, rejectedCap)) {
    if (lines.length >= cap) break;
    const verdict = clip(ev.verification || 'the verifier did not confirm it', 110);
    lines.push(`- Claim rejected: "${clip(ev.title, 90)}" — ${verdict}`);
  }
  return lines.slice(0, cap);
}

// ---------------------------------------------------------------------------
// Left-off derivation (deficit: the persisted hand-off exists only
// when a session ended cleanly — a hunt with a long record but no
// persisted leftOff started cold).
// ---------------------------------------------------------------------------

/**
 * Rebuild a leftOff hand-off from the hunt's permanent record when
 * meta.humanLoop.leftOff is missing. Same shape humanLoop persists
 * ({ at, lastActions, lastNote, openThreads, lastThinking }) so the
 * existing renderer consumes it unchanged. Derived ONLY from what
 * the record shows — last reasoning rows for the action trail, the
 * last thinking event / note for the train of thought, and the
 * coverage ledger's own accounting for open threads. Returns null
 * when the record is empty (a genuinely young hunt has nothing to
 * hand off).
 */
export function deriveLeftOffFromRecord({ reasoningRows = [], events = [], coverage = null } = {}) {
  const rows = (reasoningRows || []).filter((r) => r && r.action !== 'hypothesis-retirement');
  const evs = events || [];
  if (!rows.length && !evs.length) return null;

  const lastActions = rows.slice(-5).map((r) => {
    const action = String(r.action || '');
    const sep = action.indexOf(':');
    const tool = sep > 0 ? action.slice(0, sep).trim() : action.trim();
    const detail = sep > 0 ? action.slice(sep + 1).trim() : '';
    return {
      tool: clip(tool, 60),
      detail: clip(detail, 160),
      result: clip(r.result || '', 220),
    };
  });

  let lastThinking = '';
  for (let i = evs.length - 1; i >= 0 && !lastThinking; i--) {
    const e = evs[i];
    if (e && e.type === 'thinking' && e.text) lastThinking = clip(e.text, 240);
  }
  if (!lastThinking && rows.length) {
    const last = rows[rows.length - 1];
    lastThinking = clip(last.why || last.learned || '', 240);
  }

  let lastNote = '';
  for (let i = rows.length - 1; i >= 0 && !lastNote; i--) {
    const r = rows[i];
    if (r && r.action === 'note to self') lastNote = clip(r.learned || r.why || '', 300);
  }
  if (!lastNote) {
    for (let i = evs.length - 1; i >= 0 && !lastNote; i--) {
      const e = evs[i];
      if (e && e.type === 'thinking' && String(e.text || '').startsWith('Note to self:')) {
        lastNote = clip(String(e.text).slice('Note to self:'.length), 300);
      }
    }
  }

  const openThreads = [];
  const cov = coverage && typeof coverage === 'object' ? coverage : { rows: [], researchDebt: {} };
  for (const [cls, d] of Object.entries(cov.researchDebt || {})) {
    if (openThreads.length >= 4) break;
    if (d && Number(d.researched) > 0 && !d.probed) {
      openThreads.push(`- ${classLabelFor(cls)}: researched ×${d.researched} across ${d.sessionsResearched || 1} session(s), never probed — still open.`);
    }
  }
  for (const r of cov.rows || []) {
    if (openThreads.length >= 6) break;
    if (r && r.outcome === 'open_gap') {
      openThreads.push(`- Open gap in your coverage ledger: ${r.surface} × ${classLabelFor(r.class)}.`);
    }
  }

  const lastRow = rows[rows.length - 1];
  const lastEv = evs[evs.length - 1];
  return {
    at: (lastRow && lastRow.at) || (lastEv && eventTs(lastEv)) || null,
    lastActions,
    lastNote,
    openThreads,
    lastThinking,
    derived: true,
  };
}

// ---------------------------------------------------------------------------
// The single read path.
// ---------------------------------------------------------------------------

function readDossierText(huntId) {
  try {
    return fs.readFileSync(path.join(dataDir(), 'hunts', String(huntId), 'DOSSIER.md'), 'utf8');
  } catch {
    return '';
  }
}

/**
 * One prior hunt's inheritance packet: what a new hunt on the same
 * target must open knowing. Confirmed facts come from the prior
 * dossier's validator-stamped section, filtered against the prior
 * hunt's own retraction events (a retracted stamp is never
 * inherited as knowledge). Everything bounded and best-effort.
 */
function priorHuntPacket(priorMeta) {
  const huntId = priorMeta.huntId;
  const dossierText = readDossierText(huntId);
  let events = [];
  try {
    events = readHuntEvents(huntId);
  } catch { /* best-effort */ }
  const retractedTitles = new Set(
    (events || []).filter((e) => e && e.type === 'retraction').map((e) => normTitle(e.findingTitle)).filter(Boolean),
  );
  const confirmedFacts = dossierSectionLines(dossierText, 'Confirmed facts')
    .map((line) => ({ line, title: dossierFactTitle(line) }))
    .filter((f) => f.title && !retractedTitles.has(normTitle(f.title)))
    .map((f) => f.title);
  let coverage = emptyCoverage();
  try {
    coverage = loadCoverage(huntId);
  } catch { /* best-effort */ }
  return {
    huntId,
    target: priorMeta.target || '',
    state: priorMeta.state || 'unknown',
    iteration: priorMeta.iteration ?? null,
    createdAt: priorMeta.createdAt || '',
    dossierBriefing: extractDossierBriefing(dossierText),
    confirmedFacts,
    ruledOut: dossierSectionLines(dossierText, 'Tried and ruled out'),
    openGaps: (coverage.rows || []).filter((r) => r.outcome === 'open_gap'),
  };
}

/**
 * Load and reconcile EVERY memory store for a hunt into one
 * snapshot. Never throws — each source degrades independently, so a
 * torn line or a missing file costs that source, never the memory.
 *
 * @param {string} huntId
 * @param {{target?: string, meta?: object}} [opts] — meta/target of
 *   the calling loop when it already holds them (the persisted meta
 *   file is the fallback, so a restart rebuilds the identical
 *   picture from disk alone).
 */
export function loadHuntMemory(huntId, { target = '', meta = null } = {}) {
  const id = String(huntId || '');
  const out = {
    huntId: id,
    target: String(target || ''),
    meta: meta && typeof meta === 'object' ? meta : null,
    reasoningRows: [],
    events: [],
    findings: [],
    retractedCount: 0,
    coverage: emptyCoverage(),
    ruledOut: [],
    hypothesisLedger: { verified: [], dead: [] },
    dossierText: '',
    dossierBriefing: '',
    leftOff: null,
    leftOffDerived: false,
    priorHunts: [],
  };
  if (!out.meta) {
    try {
      out.meta = readHuntMeta(id);
    } catch { /* meta is best-effort */ }
  }
  if (!out.target && out.meta) out.target = String(out.meta.target || out.meta.url || '');
  try {
    out.reasoningRows = getAllReasoning(id) || [];
  } catch { /* torn store degrades to empty */ }
  try {
    out.events = readHuntEvents(id) || [];
  } catch { /* torn store degrades to empty */ }
  out.findings = applyRetractions(out.events);
  out.retractedCount = retractedFindingCount(out.events);
  try {
    out.coverage = loadCoverage(id);
  } catch { /* ledger degrades to empty */ }
  try {
    out.ruledOut = getRuledOut(id, 200) || [];
  } catch { /* registry is best-effort (SQLite may be unavailable) */ }
  try {
    out.hypothesisLedger = getHypothesisLedger(id) || { verified: [], dead: [] };
  } catch { /* ledger is best-effort */ }
  out.dossierText = readDossierText(id);
  out.dossierBriefing = extractDossierBriefing(out.dossierText);

  // Left-off: the persisted hand-off wins; when it is absent (legacy
  // meta, crash before the first clean session end, lost write),
  // derive it from the permanent record so the hunter never starts
  // cold while a record exists.
  const persisted = out.meta && out.meta.humanLoop && typeof out.meta.humanLoop.leftOff === 'object'
    ? out.meta.humanLoop.leftOff
    : null;
  if (persisted && (persisted.lastThinking || persisted.lastNote ||
    (Array.isArray(persisted.lastActions) && persisted.lastActions.length) ||
    (Array.isArray(persisted.openThreads) && persisted.openThreads.length))) {
    out.leftOff = persisted;
  } else {
    const derived = deriveLeftOffFromRecord({
      reasoningRows: out.reasoningRows,
      events: out.events,
      coverage: out.coverage,
    });
    if (derived) {
      out.leftOff = derived;
      out.leftOffDerived = true;
    }
  }

  // Same-target inheritance: earlier hunts of this target (newest
  // first, at most 2 with anything to inherit).
  try {
    const myFolder = targetFolderName(out.target);
    if (myFolder && myFolder !== 'unknown-target') {
      const priors = (listHuntMetas() || []).filter((m) =>
        m && m.huntId && String(m.huntId) !== id &&
        targetFolderName(m.target || m.url || '') === myFolder);
      for (const pm of priors) {
        if (out.priorHunts.length >= 2) break;
        const packet = priorHuntPacket(pm);
        if (packet.dossierBriefing || packet.confirmedFacts.length || packet.ruledOut.length || packet.openGaps.length) {
          out.priorHunts.push(packet);
        }
      }
    }
  } catch { /* inheritance is best-effort */ }

  return out;
}

// ---------------------------------------------------------------------------
// State of mind — the hierarchical rendering of the snapshot.
// ---------------------------------------------------------------------------

function rowOutcome(r) {
  const res = String((r && r.result) || '');
  if (res.startsWith('VERIFIED')) return 'VERIFIED';
  if (/^RETIRED/.test(res)) return 'PIVOT';
  if (/no assessment|not verified/i.test(res)) return 'FAILED';
  return 'DONE';
}

function dedupeFindings(list) {
  const seen = new Map();
  for (const f of list || []) {
    if (!f) continue;
    const key = `${clip(f.title, 90)}|${f.severity || 'medium'}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  return [...seen.entries()].map(([key, n]) => {
    const [title, sev] = key.split('|');
    return { title, sev, n };
  });
}

/**
 * Render the state-of-mind block from a loadHuntMemory snapshot.
 * `topicStats` (researchedTopicStats output) and `endpoints`
 * (discoveredEndpoints output) are the caller's derivations over the
 * same record — humanLoop computes them with its existing machinery
 * and passes them in; both default to empty, in which case the
 * coverage ledger's own accounting still renders.
 *
 * Completeness contract: the WHAT I HAVE NOT DONE table and the
 * ruled-out list render IN FULL (deduped, one clipped line each) —
 * they are never sliced to a char budget. Returns [] when the hunt
 * has no record at all (a young hunt shows no placeholder).
 */
export function buildStateOfMind(memory, { topicStats = [], endpoints = [] } = {}) {
  if (!memory || typeof memory !== 'object') return [];
  const rows = memory.reasoningRows || [];
  const events = memory.events || [];
  const findings = memory.findings || [];
  const coverage = memory.coverage || { rows: [], researchDebt: {} };
  const covRows = Array.isArray(coverage.rows) ? coverage.rows : [];
  const debt = coverage.researchDebt || {};
  const hasHistory = rows.length > 0 || events.length > 0 || covRows.length > 0 ||
    findings.length > 0 || (memory.priorHunts || []).length > 0;
  if (!hasHistory) return [];

  const sections = [];

  // (a) WHERE I LEFT OFF — a one-line pointer (the full hand-off
  // block renders separately on the screen); present whenever a
  // hand-off exists, persisted or record-derived.
  const lo = memory.leftOff;
  if (lo) {
    const tail = lo.lastThinking || lo.lastNote || '';
    if (tail) {
      sections.push([`WHERE I LEFT OFF: ${clip(tail, 220)}${memory.leftOffDerived ? ' (hand-off rebuilt from your record — the last session ended before writing one)' : ''}`]);
    }
    if (Array.isArray(lo.openThreads) && lo.openThreads.length) {
      sections.push([`Open threads you left (${lo.openThreads.length}): ${lo.openThreads.slice(0, 3).map((t) => clip(String(t).replace(/^-\s*/, ''), 130)).join(' · ')}`]);
    }
  }

  // (b) WHAT I HAVE DONE SO FAR — rollups, not raw lines.
  const done = [];
  const toolCalls = events.filter((e) => e && e.type === 'tool_call');
  if (toolCalls.length || rows.length) {
    const byTool = new Map();
    for (const e of toolCalls) byTool.set(e.tool || '?', (byTool.get(e.tool || '?') || 0) + 1);
    const breakdown = [...byTool.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([t, n]) => `${t} ×${n}`).join(', ');
    done.push(`Actions on record: ${toolCalls.length}${breakdown ? ` (${breakdown})` : ''} · reasoning entries: ${rows.length}${memory.meta && memory.meta.iteration != null ? ` · hunt iteration: ${memory.meta.iteration}` : ''}`);
  }
  const testedRows = covRows.filter((r) => r.outcome === 'probed_clean' || r.outcome === 'confirmed');
  for (const r of testedRows) {
    done.push(`- Tested: ${r.surface} × ${classLabelFor(r.class)} → ${r.outcome}`);
  }
  const testedClasses = new Set(testedRows.map((r) => r.class));
  for (const s of topicStats || []) {
    if (s && s.probed && !testedClasses.has(s.topic.id)) {
      done.push(`- ${s.topic.label}: probed (payload actions in your record, researched ×${s.n})`);
    }
  }
  const epList = endpoints || [];
  for (const ep of epList.slice(0, 8)) {
    const probedFor = (ep.probedClasses || []).map((c) => classLabelFor(c)).join(', ');
    done.push(`- ${ep.url} — visited ×${ep.visits}${ep.params && ep.params.length ? `, inputs seen: ${ep.params.join(', ')}` : ''}${probedFor ? `, probed for: ${probedFor}` : ', no probe has reached it'}`);
  }
  if (epList.length > 8) done.push(`- …and ${epList.length - 8} more endpoint(s) you have touched (RECALL for the full list)`);
  const recent = rows.slice(-5);
  if (recent.length) {
    done.push('Most recent actions:');
    for (const r of recent) {
      done.push(`- [${rowOutcome(r)}] ${clip(r.action, 90)}${r.result ? ` — ${clip(r.result, 90)}` : ''}`);
    }
  }
  if (done.length) sections.push(['WHAT I HAVE DONE SO FAR:', ...done]);

  // (c) WHAT I KNOW — findings with retraction state, captured
  // artefacts (key presence only), the target fingerprint.
  const know = [];
  const verified = dedupeFindings(findings.filter((f) => f.verified));
  const unverified = dedupeFindings(findings.filter((f) => !f.verified));
  for (const d of verified) know.push(`- [VERIFIED] ${d.title} (${d.sev})${d.n > 1 ? ` ×${d.n}` : ''}`);
  for (const d of unverified) know.push(`- [claimed, NOT verified] ${d.title} (${d.sev})${d.n > 1 ? ` ×${d.n}` : ''}`);
  if (!verified.length && !unverified.length) know.push('- No findings recorded yet.');
  if (memory.retractedCount > 0) {
    know.push(`- (${memory.retractedCount} earlier claim(s) were retracted as false positives — they are not findings; the paths sit under ruled-out below.)`);
  }
  const meta = memory.meta || {};
  const chain = meta.chainContext && typeof meta.chainContext === 'object' ? meta.chainContext : null;
  if (chain && Object.keys(chain).length) {
    know.push(`- Captured artefacts on hand: ${Object.keys(chain).join(', ')} (values live in your workspace — read the artefact when you need one)`);
  }
  const fp = meta.appFingerprint;
  if (fp && (fp.appType || (Array.isArray(fp.techStack) && fp.techStack.length))) {
    know.push(`- Target fingerprint: ${fp.appType || 'unknown'}${Array.isArray(fp.techStack) && fp.techStack.length ? ` · ${fp.techStack.join(', ')}` : ''}`);
  }
  sections.push(['WHAT I KNOW:', ...know]);

  // (d) WHAT I HAVE NOT DONE YET — the complete outstanding table.
  // Rendered in full: open gaps, research debt, researched-not-
  // probed classes and discovered-but-unprobed endpoints are the
  // hunter's open obligations; cutting this list is how work gets
  // silently forgotten, so it is never sliced.
  const notDone = [];
  const gapClasses = new Set();
  for (const r of covRows) {
    if (r.outcome !== 'open_gap') continue;
    gapClasses.add(r.class);
    notDone.push(`- OPEN GAP: ${r.surface} × ${classLabelFor(r.class)}${r.evidence ? ` — ${clip(r.evidence, 110)}` : ''}`);
  }
  const debtListed = new Set();
  for (const [cls, d] of Object.entries(debt)) {
    if (!d || !(Number(d.researched) > 0) || d.probed) continue;
    if (gapClasses.has(cls)) continue;
    if (covRows.some((r) => r.class === cls)) continue;
    debtListed.add(cls);
    notDone.push(`- RESEARCHED, NEVER PROBED: ${classLabelFor(cls)} — researched ×${d.researched} across ${d.sessionsResearched || 1} session(s), no probe yet and no coverage row accounts for it`);
  }
  for (const s of topicStats || []) {
    if (!s || s.probed) continue;
    if (gapClasses.has(s.topic.id) || debtListed.has(s.topic.id)) continue;
    if (covRows.some((r) => r.class === s.topic.id)) continue;
    notDone.push(`- ${s.topic.label}: researched ×${s.n}, never probed`);
  }
  for (const ep of epList) {
    if (ep.probeActions > 0) continue;
    if (ep.path === '/' && !(ep.params && ep.params.length)) continue; // the lobby is not an obligation
    notDone.push(`- ${ep.url} — discovered (visited ×${ep.visits}) but never probed${ep.params && ep.params.length ? `; it takes inputs: ${ep.params.join(', ')}` : ''}`);
  }
  if (notDone.length) {
    sections.push(['WHAT I HAVE NOT DONE YET (complete — if it is not listed here, your record does not show it as outstanding):', ...notDone]);
  } else if (rows.length || events.length) {
    sections.push(['WHAT I HAVE NOT DONE YET: nothing outstanding in your record — every researched class has been probed or accounted for in your coverage ledger.']);
  }

  // (e) PATHS ALREADY RULED OUT — complete (deduped lessons +
  // rejected claims + dead premises), never the 8-line briefing cap.
  const dead = deadEndLines({ ruledOut: memory.ruledOut || [], events }, { limit: 500 });
  const deadHyps = ((memory.hypothesisLedger || {}).dead || [])
    .map((d) => `- Dead premise (failed ×${d.failed}): "${clip(d.text, 140)}"`);
  if (dead.length || deadHyps.length) {
    sections.push(['PATHS ALREADY RULED OUT (do not repeat these):', ...dead, ...deadHyps]);
  }

  // (f) Inheritance from earlier hunts of this same target.
  const priors = memory.priorHunts || [];
  if (priors.length) {
    const inh = [];
    for (const p of priors) {
      inh.push(`- Earlier hunt ${p.huntId} (${p.state}${p.iteration != null ? `, iteration ${p.iteration}` : ''}) on this target:`);
      for (const t of p.confirmedFacts.slice(0, 6)) inh.push(`  - Already proven on this target: ${clip(t, 150)}`);
      for (const t of p.ruledOut.slice(0, 6)) inh.push(`  - Ruled out there: ${clip(t, 150)}`);
      for (const r of p.openGaps.slice(0, 6)) inh.push(`  - Left open there: ${r.surface} × ${classLabelFor(r.class)} (open gap)`);
      if (p.dossierBriefing) {
        for (const line of p.dossierBriefing.split('\n')) {
          const t = line.trim();
          if (t && t !== 'Open threads:' && t !== 'Next step:') inh.push(`  - ${clip(t.replace(/^-\s*/, ''), 150)}`);
        }
      }
    }
    if (inh.length) sections.push(['FROM YOUR EARLIER HUNTS ON THIS TARGET:', ...inh]);
  }

  if (!sections.length) return [];
  return [
    '=== STATE OF MIND — YOUR COMPLETE MEMORY (rebuilt from your permanent record every turn; the essentials are never cut short) ===',
    ...sections.flatMap((s, i) => (i === 0 ? s : ['', ...s])),
  ];
}
