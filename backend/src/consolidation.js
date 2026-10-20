// Dark Matter — Consolidation ("sleep") jobs + per-target dossier.
// Job 6, stage 3 (research report §5 item 3: Anthropic compaction +
// structured note-taking, Letta sleeptime consolidation, LangMem's
// background memory manager — re-implemented).
//
// Between phases, code — never the model — writes a fixed-template dossier
// for the target: GOAL / CONFIRMED FACTS / TRIED AND RULED OUT / OPEN
// THREADS / CAPTURED STATE / NEXT STEP. Every fact is copied verbatim from
// validator-stamped structured records (episode rows, the hypothesis
// ledger, hunt meta) and carries its episode id, so the dossier can never
// invent a fact and every line is traceable to the raw log, which is
// always retained underneath.
//
// SECRETS: dossier lines use titles/urls/severities only — never episode
// bodies (a finding's response body can contain captured tokens), and
// chainContext is reported as KEY PRESENCE ONLY, never values.
//
// The consolidation itself is appended to the hunt's event stream as a
// first-class 'consolidation' event, so the episode mirror picks it up
// (rule importance 7) and retrieval can surface "you consolidated this
// target up to episode N" like any other memory.

import fs from 'node:fs';
import path from 'node:path';
import { appendHuntEvent, readHuntMeta, huntDir, listHuntMetas } from './store.js';
import { getHypothesisLedger, getAllReasoning } from './reasoningMemory.js';
import { queryEpisodes, maxSourceIdx, lastConsolidationIdx, flushHuntEpisodes } from './episodeStore.js';

const squash = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// Finding bodies are JSON snapshots written by episodeStore.bodyFor; they
// can be truncated at the body cap, so fields are pulled by regex rather
// than JSON.parse (robust to a cut-off tail).
function bodyField(body, key) {
  const m = new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`).exec(String(body || ''));
  return m ? m[1] : '';
}

/** Assemble the dossier text for a hunt from structured records only. */
export function buildDossierText(huntId) {
  const meta = readHuntMeta(huntId) || {};
  const target = meta.target || meta.url || '(unknown target)';
  const verified = queryEpisodes(huntId, { kind: 'finding', outcome: 'verified', limit: 60 });
  const rejected = queryEpisodes(huntId, { kind: 'finding', outcome: 'rejected', limit: 40 });
  const open = queryEpisodes(huntId, { kind: 'finding', outcome: 'unverified', limit: 20 });
  const thinking = queryEpisodes(huntId, { kind: 'thinking', limit: 3 });
  const ledger = (() => { try { return getHypothesisLedger(huntId); } catch { return { verified: [], dead: [] }; } })();
  const reasoning = (() => { try { return getAllReasoning(huntId); } catch { return []; } })();
  const lastStep = reasoning[reasoning.length - 1] || {};
  const maxIdx = maxSourceIdx(huntId);
  const nowIso = new Date().toISOString();

  const lines = [];
  lines.push(`# Target dossier — ${target}`);
  lines.push(`- Hunt: ${huntId} · State: ${meta.state || 'unknown'} · Iteration: ${meta.iteration ?? '?'}`);
  lines.push(`- Consolidated: ${nowIso} · Episodes covered: 0–${maxIdx} (${maxIdx + 1} episodes)`);
  lines.push('');
  lines.push('## Goal');
  lines.push(`Hunt ${target} for exploitable vulnerabilities; only validator-confirmed findings count.`);
  lines.push('');
  lines.push('## Confirmed facts (validator-stamped only)');
  if (!verified.length) lines.push('- (none yet)');
  for (const f of verified) {
    const sev = bodyField(f.body, 'severity') || 'unrated';
    const url = bodyField(f.body, 'url');
    lines.push(`- [verified · ${sev}] ${squash(f.title, 140)}${url ? ` — ${url}` : ''} (episode #${f.id})`);
  }
  lines.push('');
  lines.push('## Tried and ruled out');
  if (!rejected.length && !ledger.dead.length) lines.push('- (nothing ruled out yet)');
  for (const f of rejected) {
    const why = bodyField(f.body, 'verification');
    lines.push(`- ${squash(f.title, 120)} — rejected${why ? `: ${squash(why, 120)}` : ''} (episode #${f.id})`);
  }
  for (const d of ledger.dead) {
    lines.push(`- DEAD hypothesis (failed ${d.failed}×): ${squash(d.text, 140)}`);
  }
  lines.push('');
  lines.push('## Open threads');
  if (!open.length && !thinking.length) lines.push('- (none recorded)');
  for (const f of open) lines.push(`- Unverified lead: ${squash(f.title, 120)} (episode #${f.id})`);
  for (const t of thinking) lines.push(`- Recent thinking: ${squash(t.title, 140)}`);
  lines.push('');
  lines.push('## Captured state (key presence only — values never printed)');
  const chain = meta.chainContext && typeof meta.chainContext === 'object' ? meta.chainContext : null;
  if (chain && Object.keys(chain).length) {
    for (const k of Object.keys(chain)) lines.push(`- ${k}: present`);
  } else {
    lines.push('- (no chain artefacts captured)');
  }
  lines.push('');
  lines.push('## Next step');
  lines.push(`- ${squash(lastStep.followUp || lastStep.action || '(no next step recorded)', 200)}`);
  lines.push('');
  return { text: lines.join('\n'), counts: { verified: verified.length, rejected: rejected.length, open: open.length, dead: ledger.dead.length, maxIdx } };
}

/**
 * Run one consolidation for a hunt if enough new episodes accumulated
 * since the last one (or when forced). Writes DOSSIER.md into the hunt
 * dir and appends the 'consolidation' event to the hunt stream.
 */
export function runConsolidation(huntId, { minNewEpisodes = 150, force = false } = {}) {
  flushHuntEpisodes(huntId);
  const maxIdx = maxSourceIdx(huntId);
  if (maxIdx < 0) return { done: false, reason: 'no-episodes' };
  const lastIdx = lastConsolidationIdx(huntId);
  const newSince = maxIdx - lastIdx;
  if (!force && newSince < minNewEpisodes) {
    return { done: false, reason: 'below-threshold', newSince };
  }
  const { text, counts } = buildDossierText(huntId);
  const file = path.join(huntDir(huntId), 'DOSSIER.md');
  fs.writeFileSync(file, text);
  appendHuntEvent(huntId, {
    type: 'consolidation',
    text: `Consolidated episodes ${lastIdx + 1}–${maxIdx} into DOSSIER.md (${counts.verified} verified facts, ${counts.rejected} rejected, ${counts.dead} dead hypotheses, ${counts.open} open leads).`,
    episodesFrom: lastIdx + 1,
    episodesTo: maxIdx,
    dossier: 'DOSSIER.md',
  });
  flushHuntEpisodes(huntId);
  return { done: true, covered: [lastIdx + 1, maxIdx], newSince, file };
}

/**
 * Periodic driver: consolidate at most ONE hunt per call (bounded work).
 * Running hunts consolidate every `runningThreshold` new episodes; paused
 * hunts at a lower threshold (they no longer grow). Stopped/finished hunts
 * are never touched.
 */
export function maybeConsolidateAll({ runningThreshold = 150, pausedThreshold = 25 } = {}) {
  let metas = [];
  try {
    metas = listHuntMetas();
  } catch {
    return { done: false, reason: 'no-metas' };
  }
  for (const meta of metas) {
    if (!meta || !meta.huntId) continue;
    if (meta.state !== 'running' && meta.state !== 'paused') continue;
    const threshold = meta.state === 'paused' ? pausedThreshold : runningThreshold;
    const r = runConsolidation(meta.huntId, { minNewEpisodes: threshold });
    if (r.done) return { done: true, huntId: meta.huntId, ...r };
  }
  return { done: false, reason: 'nothing-due' };
}
