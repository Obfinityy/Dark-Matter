// Dark Matter — OUTPUT MEMORY (HUNTER-MIND lane, 26 Oct 2026).
//
// The owner's order (21 Oct 2026, MEMORY MUST STOP REPEATS, and
// 26 Oct 2026, HUNTER-MIND): "this work is done, next time this work
// will not happen again; next time if it thinks, brother, this output
// already came." Prompt-shown recall is not enough — enforcement must
// be deterministic. The dedupe gate (Lane F) only stops an EXACT
// repeat from its THIRD run: the first re-ask still executes, and a
// blocked repeat's observation carries only a 220-char last-result
// stub, not the output itself. So the hunter re-ran nmap, re-ran the
// same search, and re-derived the same premise every session.
//
// This module is the OUTPUT LEDGER: every executed shell/search
// action's output is saved (outputs.json in the hunt record, the
// coverage-ledger idiom — atomic tmp+rename write, tolerant read),
// keyed by the same action signature the dedupe gate uses, so the
// ledger and the gate can never disagree about identity. Before a
// shell/search action executes, the loop looks the signature up:
// a hit is answered from the saved output instead of re-running.
// A redo is possible only when the brain says why — "force": true
// with a "why" — and the forced re-run is recorded as such, so the
// ledger shows what was re-run and why. The module never chooses
// an action and never invents a reason: it only remembers outputs
// and answers repeats with them.

import fs from 'node:fs';
import path from 'node:path';

import { huntDir, ensureHuntDir } from './store.js';

export const OUTPUTS_VERSION = 1;
/** Saved output per entry — the head the brain acts on; the full text lives in the artifact when spilled. */
export const OUTPUT_HEAD_CHARS = 1500;
export const MAX_OUTPUT_ENTRIES = 40; // most recent wins; the ledger is a working notebook, not an archive
/** The repeatable, output-producing actions the ledger covers. Browser actions are covered by dedupe + page state. */
export const OUTPUT_RECALL_TOOLS = new Set(['shell', 'search']);

/** Empty ledger. */
export function emptyOutputs() {
  return { version: OUTPUTS_VERSION, entries: {} };
}

function outputsFile(huntId) {
  return path.join(huntDir(String(huntId)), 'outputs.json');
}

export function loadOutputs(huntId) {
  try {
    const raw = fs.readFileSync(outputsFile(huntId), 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !data.entries || typeof data.entries !== 'object') return emptyOutputs();
    return { ...emptyOutputs(), ...data };
  } catch {
    return emptyOutputs();
  }
}

export function saveOutputs(huntId, data) {
  try {
    ensureHuntDir(huntId);
    const file = outputsFile(huntId);
    const tmp = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

function cleanSignature(s) {
  return String(s || '').trim().slice(0, 400);
}

/**
 * Save one executed action's output under its signature. The saved
 * head is what the brain acts on; a spilled artifact handle keeps
 * the full text one READ_ARTIFACT away. A forced re-run overwrites
 * the entry and is marked as forced, with its reason kept. Pure —
 * returns a fresh ledger (the caller saves it).
 */
export function recordOutput(prev, { signature, tool = '', detail = '', output = '', artifact = '', forced = false, why = '', at = new Date().toISOString() } = {}) {
  const data = prev && typeof prev === 'object' && prev.entries && typeof prev.entries === 'object'
    ? JSON.parse(JSON.stringify(prev))
    : emptyOutputs();
  const sig = cleanSignature(signature);
  if (!sig) return data;
  const prior = data.entries[sig];
  data.entries[sig] = {
    signature: sig,
    tool: String(tool || '').toLowerCase(),
    detail: String(detail || '').slice(0, 300),
    output: String(output || '').slice(0, OUTPUT_HEAD_CHARS),
    artifact: String(artifact || '').slice(0, 120),
    at,
    runs: (prior && prior.runs ? prior.runs : 0) + 1,
    forced: Boolean(forced),
    why: forced ? String(why || '').slice(0, 200) : (prior ? prior.why || '' : ''),
  };
  // Evict the oldest entries past the cap — the ledger is a working
  // notebook; the hunt's permanent record (events + reasoning rows)
  // keeps the full history regardless.
  const keys = Object.keys(data.entries);
  if (keys.length > MAX_OUTPUT_ENTRIES) {
    keys
      .sort((a, b) => String(data.entries[a].at || '').localeCompare(String(data.entries[b].at || '')))
      .slice(0, keys.length - MAX_OUTPUT_ENTRIES)
      .forEach((k) => delete data.entries[k]);
  }
  return data;
}

/** Look one signature up. Pure — null when this hunt never ran it. */
export function findOutput(data, signature) {
  const sig = cleanSignature(signature);
  if (!sig || !data || !data.entries || typeof data.entries !== 'object') return null;
  return data.entries[sig] || null;
}

/** How many outputs this hunt has saved. Pure. */
export function outputCount(data) {
  if (!data || !data.entries || typeof data.entries !== 'object') return 0;
  return Object.keys(data.entries).length;
}

function relativeAge(at, nowMs = Date.now()) {
  const t = Date.parse(String(at || ''));
  if (!t) return '';
  const mins = Math.max(0, Math.round((nowMs - t) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

/**
 * The RECALL observation — what the brain gets INSTEAD of a
 * re-run. It carries the saved output (the head), the artifact
 * handle for the full text, when it ran, and the only conditions
 * under which a re-run is justified — with the exact mechanism
 * ("force": true + "why") for one. The observation never invents
 * a reason to re-run: the brain supplies the reason, or it acts
 * on what it already has.
 */
export function recallObservation(entry, { nowMs = Date.now() } = {}) {
  if (!entry) return '';
  const age = relativeAge(entry.at, nowMs);
  const lines = [
    `RECALL — you already ran this (${entry.tool || 'action'}: ${String(entry.detail || '').slice(0, 160)})${age ? ` ${age}` : ''}. Its saved output:`,
    String(entry.output || '(the saved output is empty — the command ran and printed nothing)').slice(0, OUTPUT_HEAD_CHARS),
  ];
  if (entry.artifact) {
    lines.push(`[full output is saved as artifact ${entry.artifact} — read it with a shell action: READ_ARTIFACT: ${entry.artifact}]`);
  }
  lines.push(
    'This work is DONE — do not re-run it. Act on this output instead. Re-run ONLY if something changed since then (the target changed, you need a different flag or scope, or this saved output is incomplete for what you need now) — and say why: repeat the action with "force": true and "why": "<your reason>". A re-run without a reason is refused.',
  );
  return lines.join('\n');
}
