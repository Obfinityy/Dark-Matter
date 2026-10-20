#!/usr/bin/env node
// Dark Matter — human-mode driver.
//
// Runs ONE human-mode session (perceive -> think -> act -> observe,
// hunter-chosen actions only) against an already-created hunt, from
// the command line. The hunt loop (huntAgent) calls the same
// humanIteration() for hunts flagged meta.humanMode / mode 'human';
// this driver exists for manual testing and smoke runs.
//
// Usage:
//   node scripts/drive-human.mjs <huntId> <target> [turns]
//
// - If the hunt has no meta yet, a minimal human-mode meta is created
//   (scope parsed from DM_SCOPE env text, if given).
// - If Docker is available and the hunt container is not running, it
//   is spawned via huntRunner. An already-running container is left
//   exactly as it is.
// - Shell actions run through the pipeline's executeWithEvasion and
//   claimed findings through the pipeline's assessResult — the same
//   verification a pipeline hunt gets. Nothing here verifies itself.

import { spawnHuntContainer, dockerAvailable, huntContainerRunning } from '../src/huntRunner.js';
import { readHuntMeta, writeHuntMeta } from '../src/store.js';
import { parseScope } from '../src/scopeParser.js';
import { humanIteration } from '../src/humanLoop.js';
import { assessResult, executeWithEvasion } from '../src/huntAgent.js';

const [huntId, target, turnsArg] = process.argv.slice(2);
if (!huntId || !target) {
  console.error('usage: node scripts/drive-human.mjs <huntId> <target> [turns]');
  process.exit(2);
}
const turns = Math.max(1, parseInt(turnsArg || '6', 10) || 6);

let meta = readHuntMeta(huntId);
if (!meta) {
  meta = {
    huntId,
    target,
    mode: 'human',
    humanMode: true,
    state: 'running',
    createdAt: new Date().toISOString(),
    parsedScope: parseScope(target, process.env.DM_SCOPE || ''),
  };
  writeHuntMeta(huntId, meta);
  console.log(`[drive-human] created human-mode meta for ${huntId}`);
}

if (await dockerAvailable()) {
  let running = false;
  try {
    running = await huntContainerRunning(huntId);
  } catch { /* treat as not running */ }
  if (!running) {
    const { container } = await spawnHuntContainer(huntId, target, { mode: 'human' });
    console.log(`[drive-human] spawned container ${container}`);
  } else {
    console.log('[drive-human] hunt container already running — using it as-is');
  }
} else {
  console.log('[drive-human] WARNING: Docker unavailable — shell/GUI actions will report failures; search/note actions still work.');
}

const findings = [];
const res = await humanIteration(huntId, target, {
  turns,
  findings,
  deps: {
    assess: assessResult,
    exec: (h, t, c) => executeWithEvasion(h, t, c),
  },
});

console.log('[drive-human] session result:', JSON.stringify({ aiOk: res.aiOk, failKind: res.failKind || null, turnsRun: res.turnsRun, actionsRun: res.actionsRun }));
for (const entry of res.log) {
  console.log(`  turn ${entry.turn}: ${entry.action} -> ${String(entry.observation).slice(0, 160)}`);
}
console.log(`[drive-human] findings this session: ${findings.length} (${findings.filter((f) => f.verified).length} verified by the pipeline verifier)`);
