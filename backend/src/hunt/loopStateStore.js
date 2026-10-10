/**
 * loopStateStore.js — per-hunt persistence for the continuous autonomous
 * hunt loop (issue #298).
 *
 * Mirrors the persistence convention of hunt/planner.js: each hunt owns a
 * directory under backend/data/hunts/<huntId>/, and the loop's full machine
 * state is kept in loop.json. Pause freezes the tick driver and this file
 * holds everything needed to resume later: machine state, findings so far,
 * the current hunt angle, tick count, think-aloud trace, and the severity
 * tally.
 *
 * Pure file I/O — no brain, no network. Defensive framing only.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_LOOP_DATA_DIR = path.resolve(here, '..', '..', 'data', 'hunts');

const LOOP_FILE = 'loop.json';

function now() {
  return new Date().toISOString();
}

/** The canonical empty severity tally. */
export function emptyTally() {
  return { critical: 0, high: 0, medium: 0, low: 0, informational: 0, total: 0 };
}

/**
 * Build a fresh loop state for a hunt that has not run before.
 * @param {string} huntId
 * @param {string} target — declared authorized target
 */
export function newLoopState(huntId, target) {
  if (!huntId || !target) throw new Error('newLoopState requires { huntId, target }');
  return {
    version: 1,
    huntId: String(huntId),
    target: String(target),
    state: 'UNDERSTANDING',
    /** State to resume into after a pause (the state active when pause() ran). */
    prevState: null,
    tick: 0,
    /** How many times the machine has looped REPLAN → UNDERSTANDING. */
    cycle: 1,
    findings: [],
    angle: '',
    anglesTried: [],
    trace: [],
    tally: emptyTally(),
    /** How the hunt was started — always explicit, never automatic. */
    startedBy: 'user',
    createdAt: now(),
    updatedAt: now(),
  };
}

export function loopDir(huntId, dataDir = DEFAULT_LOOP_DATA_DIR) {
  return path.join(dataDir, String(huntId));
}

export function loopFile(huntId, dataDir = DEFAULT_LOOP_DATA_DIR) {
  return path.join(loopDir(huntId, dataDir), LOOP_FILE);
}

/** Persist the full loop state (atomic-ish: write tmp + rename). */
export async function saveLoopState(state, dataDir = DEFAULT_LOOP_DATA_DIR) {
  const dir = loopDir(state.huntId, dataDir);
  await fs.mkdir(dir, { recursive: true });
  const file = loopFile(state.huntId, dataDir);
  const tmp = `${file}.tmp`;
  const stamped = { ...state, updatedAt: now() };
  await fs.writeFile(tmp, JSON.stringify(stamped, null, 2), 'utf8');
  await fs.rename(tmp, file);
  return stamped;
}

/** Load persisted loop state. Returns null when the hunt has no loop state. */
export async function loadLoopState(huntId, dataDir = DEFAULT_LOOP_DATA_DIR) {
  try {
    const raw = await fs.readFile(loopFile(huntId, dataDir), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** True when a persisted loop state exists for the hunt. */
export async function hasLoopState(huntId, dataDir = DEFAULT_LOOP_DATA_DIR) {
  try {
    await fs.access(loopFile(huntId, dataDir));
    return true;
  } catch {
    return false;
  }
}

/** Remove the persisted loop state (used only on explicit force-stop cleanup). */
export async function deleteLoopState(huntId, dataDir = DEFAULT_LOOP_DATA_DIR) {
  try {
    await fs.unlink(loopFile(huntId, dataDir));
    return true;
  } catch {
    return false;
  }
}

export default {
  newLoopState,
  saveLoopState,
  loadLoopState,
  hasLoopState,
  deleteLoopState,
  emptyTally,
  DEFAULT_LOOP_DATA_DIR,
};
