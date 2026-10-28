// BRAIN FILES (28 Oct 2026, owner order) — the three files that ARE
// the brain's context architecture. Explicit files on disk, per hunt,
// in DATA_DIR/hunts/<huntId>/ (per-hunt isolated: x.com's files are
// x.com's only — never shared, never global):
//
//   memory.json  — titles + hashes ONLY. What was done, NOT the
//                  results. Sent to the brain every turn. A-to-Z
//                  complete on disk (no cap — everything the brain
//                  did is remembered, so it NEVER repeats work).
//   process.json — the current process: what task it is performing,
//                  what it has done so far IN that process, and the
//                  in_process boolean (true while it runs, false when
//                  it finishes). FULL DETAIL: every line goes in while
//                  a process runs ("I opened this, this happened").
//                  Sent to the brain every turn, beside the memory
//                  file. When a process finishes it closes into
//                  history and the brain thinks of a NEW process.
//   output.json  — the results: how/why/what was found. STAYS ON THE
//                  BACKEND. The brain never gets it every turn; it
//                  fetches ONE result by hash/id on demand (recall),
//                  and then it must say WHY it needs it (recall
//                  carries a reason — recorded here, in the process
//                  file: data requested, data given, why).
//
// WHY FILES, NOT JUST events.jsonl (reason recorded): the record
// already existed implicitly in events + the reasoning ledger, but
// nothing said "this is the memory, this is the process" — the brain
// was sent a rebuilt briefing each turn instead of ITS OWN files. The
// files make the contract explicit and auditable: the parent-as-API
// can open them and see exactly what the brain will be told.
// The prompt stays predefined (identity + process rules); the file
// values (memory + process) ride with it every turn; the brain
// replies with clean structured JSON (task, goal, progress, action,
// recall); the backend executes it, saves the output by hash,
// updates the process file, and updates the memory file (title +
// hash) on task completion.
//
// WHAT ALREADY EXISTED (built on, not rebuilt): the brain-json lane's
// action index (hashes), output-by-hash, per-hunt isolation, and
// save-on-completion. These files are the explicit form of that
// shape — the index entries ARE the memory file's rows, the
// output-by-hash store IS the output file.
//
// DESIGN NOTE — the per-turn screen is BUDGETED, the files are NOT:
// the memory file on disk is A-to-Z complete, but the block sent
// every turn renders it budgeted (distinct-action rollup + most
// recent entries), so the prompt budget holds. The process file
// likewise renders its most recent lines in full with a count of
// earlier ones. If the parent wants the full file sent every turn
// instead, that is a prompt-budget decision to make explicitly —
// the files themselves never lose anything.
import fs from 'node:fs';
import path from 'node:path';
import { huntDir } from './store.js';
import { contentHash } from './actionIndex.js';

const MEMORY_FILE = 'memory.json';
const PROCESS_FILE = 'process.json';
const OUTPUT_FILE = 'output.json';

const MEMORY_BUDGET = 2500; // chars of the memory block sent per turn
const PROCESS_BUDGET = 2500; // chars of the process block sent per turn

function filePath(huntId, name) {
  return path.join(huntDir(huntId), name);
}

function readFile(huntId, name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath(huntId, name), 'utf8'));
  } catch {
    return fallback;
  }
}

function writeFileAtomic(huntId, name, obj) {
  try {
    const file = filePath(huntId, name);
    const tmp = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
    fs.renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

const nowIso = () => new Date().toISOString();

/** The normalised identity of a process: same task string = same process. */
export function normaliseTask(task) {
  return String(task || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function emptyMemoryFile() {
  return { entries: [] };
}

export function emptyProcessFile() {
  return { in_process: false, task: '', goal: '', progress: '', status: 'idle', startedAt: '', updatedAt: '', lines: [], history: [] };
}

export function emptyOutputFile() {
  return { byHash: {} };
}

export function readMemoryFile(huntId) {
  const f = readFile(huntId, MEMORY_FILE, null);
  return f && Array.isArray(f.entries) ? f : emptyMemoryFile();
}

export function readProcessFile(huntId) {
  const f = readFile(huntId, PROCESS_FILE, null);
  if (!f || typeof f !== 'object' || !Array.isArray(f.lines) || !Array.isArray(f.history)) return emptyProcessFile();
  return {
    in_process: f.in_process === true,
    task: typeof f.task === 'string' ? f.task : '',
    goal: typeof f.goal === 'string' ? f.goal : '',
    progress: typeof f.progress === 'string' ? f.progress : '',
    status: typeof f.status === 'string' ? f.status : 'idle',
    startedAt: typeof f.startedAt === 'string' ? f.startedAt : '',
    updatedAt: typeof f.updatedAt === 'string' ? f.updatedAt : '',
    lines: f.lines,
    history: f.history,
  };
}

export function readOutputFile(huntId) {
  const f = readFile(huntId, OUTPUT_FILE, null);
  return f && f.byHash && typeof f.byHash === 'object' ? f : emptyOutputFile();
}

/**
 * Start (or continue) the process named by the task block. Same
 * normalised task string = the SAME process (lines keep appending);
 * a different task closes the current process into history
 * (in_process false) and starts a new one (in_process true).
 * Returns the process file.
 */
export function startProcess(huntId, taskBlock = {}) {
  const proc = readProcessFile(huntId);
  const task = String(taskBlock.task || '').trim();
  const goal = String(taskBlock.goal || '').trim();
  const progress = String(taskBlock.progress || '').trim();
  if (proc.in_process && normaliseTask(proc.task) === normaliseTask(task) && task) {
    proc.goal = goal || proc.goal;
    proc.progress = progress || proc.progress;
    proc.updatedAt = nowIso();
    writeFileAtomic(huntId, PROCESS_FILE, proc);
    return proc;
  }
  if (proc.in_process || proc.task) {
    proc.history.push({
      task: proc.task, goal: proc.goal, progress: proc.progress,
      status: proc.status || 'complete', startedAt: proc.startedAt,
      endedAt: nowIso(), lines: proc.lines,
    });
  }
  const next = {
    in_process: true,
    task, goal, progress,
    status: 'in_progress',
    startedAt: nowIso(),
    updatedAt: nowIso(),
    lines: [],
    history: proc.history,
  };
  writeFileAtomic(huntId, PROCESS_FILE, next);
  return next;
}

/** Append one line to the running process (full detail, every line). */
export function appendProcessLine(huntId, line) {
  const proc = readProcessFile(huntId);
  if (!proc.in_process) {
    // No open process — open one for the steps, named plainly, so no
    // line is ever dropped silently.
    startProcess(huntId, { task: '(open steps)', goal: '', progress: '' });
    return appendProcessLine(huntId, line);
  }
  proc.lines.push({ at: nowIso(), line: String(line || '').slice(0, 500) });
  proc.updatedAt = nowIso();
  writeFileAtomic(huntId, PROCESS_FILE, proc);
  return proc;
}

function closeProcess(huntId, status, memoryEntry) {
  const proc = readProcessFile(huntId);
  if (proc.in_process || proc.task) {
    proc.history.push({
      task: proc.task, goal: proc.goal, progress: proc.progress,
      status, startedAt: proc.startedAt, endedAt: nowIso(), lines: proc.lines,
    });
  }
  const next = { ...emptyProcessFile(), history: proc.history };
  writeFileAtomic(huntId, PROCESS_FILE, next);
  if (memoryEntry) {
    const mem = readMemoryFile(huntId);
    mem.entries.push({ n: mem.entries.length + 1, ...memoryEntry, at: nowIso() });
    writeFileAtomic(huntId, MEMORY_FILE, mem);
  }
  return next;
}

/**
 * A process finished: in_process flips to false, the process closes
 * into history, and the memory file gains the title + hash (what was
 * done, NOT the result — the result stays in output.json).
 */
export function completeProcess(huntId, { title, hash, status = 'complete' } = {}) {
  return closeProcess(huntId, status, title && hash ? { title: String(title).slice(0, 200), hash: String(hash), status } : null);
}

/** A process failed: same close, recorded as failed so it is never retried blind. */
export function failProcessFile(huntId, { title, hash, error = '' } = {}) {
  const proc = readProcessFile(huntId);
  if (proc.in_process) appendProcessLine(huntId, `failed: ${String(error || '').slice(0, 200)}`);
  return closeProcess(huntId, 'failed', title && hash ? { title: String(title).slice(0, 200), hash: String(hash), status: 'failed' } : null);
}

/** Save an action's output by hash — the OUTPUT file, backend only. */
export function recordBrainOutput(huntId, { hash, title, output } = {}) {
  if (!hash) return null;
  const out = readOutputFile(huntId);
  out.byHash[String(hash)] = {
    hash: String(hash),
    title: String(title || '').slice(0, 200),
    output: String(output || '').slice(0, 20000),
    at: nowIso(),
  };
  writeFileAtomic(huntId, OUTPUT_FILE, out);
  return out.byHash[String(hash)];
}

/** Fetch ONE output by hash — the recall path. Null when unknown. */
export function recallBrainOutput(huntId, hash) {
  if (!hash) return null;
  const out = readOutputFile(huntId);
  return out.byHash[String(hash)] || null;
}

/**
 * RECALL WITH A REASON (28 Oct 2026, owner order): when the brain
 * needs the output of something it did before, it gives the hash and
 * says WHY it needs it. The process file records all three: the data
 * was requested, the data was given (or not found), and why it was
 * asked for. `reason` is required by the caller (the validator asks
 * for it); a missing reason is recorded as '(no reason given)'.
 */
export function recordRecall(huntId, { hash = '', id = null, reason = '', found = false, title = '' } = {}) {
  const what = hash ? `hash ${String(hash).slice(0, 16)}` : `#${id}`;
  appendProcessLine(huntId, `recall requested: ${what} — why: ${String(reason || '(no reason given)').slice(0, 200)}`);
  appendProcessLine(huntId, found
    ? `recall given: ${String(title || what).slice(0, 160)} (${what})`
    : `recall NOT FOUND: ${what} — nothing was given`);
  return { hash, id, reason, found };
}

/** Hash for a step's memory entry — the same content hash as the action index. */
export function hashForStep(tool, detail) {
  return contentHash(tool, String(detail || '').slice(0, 300));
}

/**
 * The per-turn rendering: the MEMORY block (titles + hashes only) and
 * the PROCESS block (current process, full detail) — the two files
 * sent to the brain every turn. Budgeted: the files on disk are
 * A-to-Z complete, but the screen renders a rollup + the most recent
 * entries/lines so the prompt budget holds. The OUTPUT file is never
 * rendered here — it stays on the backend, recalled by hash.
 */
export function renderBrainFilesScreen(huntId, { memoryBudget = MEMORY_BUDGET, processBudget = PROCESS_BUDGET } = {}) {
  const mem = readMemoryFile(huntId);
  const proc = readProcessFile(huntId);
  const blocks = [];

  if (mem.entries.length) {
    const lines = [];
    lines.push(`MEMORY FILE — ${mem.entries.length} thing(s) done in this hunt (titles + hashes only — the results stay on the backend; recall one by hash when you need it). NEVER repeat work listed here:`);
    // Most recent first, budgeted; older work collapses to a count.
    let used = 0;
    const shown = [];
    for (let i = mem.entries.length - 1; i >= 0; i--) {
      const e = mem.entries[i];
      const line = `  #${e.n} [${String(e.hash || '').slice(0, 12)}] ${e.title}${e.status && e.status !== 'complete' ? ` (${e.status})` : ''}`;
      if (used + line.length + 1 > memoryBudget && shown.length) break;
      shown.push(line);
      used += line.length + 1;
    }
    lines.push(...shown.reverse());
    if (shown.length < mem.entries.length) {
      lines.push(`  …and ${mem.entries.length - shown.length} earlier entr${mem.entries.length - shown.length === 1 ? 'y' : 'ies'} (oldest first in the file)`);
    }
    blocks.push(lines.join('\n'));
  }

  if (proc.task || proc.lines.length || proc.history.length) {
    const lines = [];
    lines.push(`PROCESS FILE — in_process: ${proc.in_process ? 'true' : 'false'}${proc.task ? ` — current process: "${proc.task}"` : ''}`);
    if (proc.goal) lines.push(`  goal: ${proc.goal}`);
    if (proc.progress) lines.push(`  progress: ${proc.progress}`);
    if (proc.lines.length) {
      lines.push('  what has happened in this process (most recent last):');
      let used = 0;
      const shown = [];
      for (let i = proc.lines.length - 1; i >= 0; i--) {
        const l = proc.lines[i];
        const line = `    - ${l.line}`;
        if (used + line.length + 1 > processBudget && shown.length) break;
        shown.push(line);
        used += line.length + 1;
      }
      lines.push(...shown.reverse());
      if (shown.length < proc.lines.length) {
        lines.push(`    …and ${proc.lines.length - shown.length} earlier line(s) in this process`);
      }
    }
    if (!proc.in_process) {
      lines.push('  (no process running — think of a NEW process: a new vulnerability to try, a new curiosity, a new variety.)');
    }
    if (proc.history.length) {
      const done = proc.history.slice(-5).map((h) => `  - ${h.task || '(unnamed)'} — ${h.status}`).join('\n');
      lines.push(`  finished processes (most recent):\n${done}`);
    }
    blocks.push(lines.join('\n'));
  }

  return blocks.join('\n\n');
}
