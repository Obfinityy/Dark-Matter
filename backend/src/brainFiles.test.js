// BRAIN FILES — unit tests (28 Oct 2026, owner order).
//
// The three files (memory.json titles+hashes, process.json full
// detail + in_process, output.json results-by-hash) are the brain's
// context architecture. Tests run against a temp DATA_DIR — no EC2,
// no Meta, no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-files-'));
process.env.DATA_DIR = tmpRoot;

const {
  startProcess,
  appendProcessLine,
  completeProcess,
  failProcessFile,
  recordBrainOutput,
  recallBrainOutput,
  recordRecall,
  readMemoryFile,
  readProcessFile,
  readOutputFile,
  renderBrainFilesScreen,
  normaliseTask,
} = await import('./brainFiles.js');

test('BF-1: a new process starts with in_process true; same task continues it', () => {
  const h = 'h_bf1';
  startProcess(h, { task: 'Intercept the login request', goal: 'Capture it', progress: 'proxy started' });
  let proc = readProcessFile(h);
  assert.equal(proc.in_process, true);
  assert.equal(proc.task, 'Intercept the login request');
  appendProcessLine(h, 'I opened the proxy');
  appendProcessLine(h, 'the login request was captured');
  startProcess(h, { task: 'intercept the login request', goal: 'Capture it', progress: 'captured' });
  proc = readProcessFile(h);
  assert.equal(proc.in_process, true);
  assert.equal(proc.lines.length, 2, 'same task = same process, lines keep appending');
});

test('BF-2: a different task closes the old process into history and starts a new one', () => {
  const h = 'h_bf2';
  startProcess(h, { task: 'Intercept the login request', goal: '', progress: '' });
  appendProcessLine(h, 'captured the request');
  startProcess(h, { task: 'JWT token attack on the captured request', goal: '', progress: '' });
  const proc = readProcessFile(h);
  assert.equal(proc.in_process, true);
  assert.equal(proc.task, 'JWT token attack on the captured request');
  assert.equal(proc.lines.length, 0, 'a new process starts with no lines');
  assert.equal(proc.history.length, 1);
  assert.equal(proc.history[0].task, 'Intercept the login request');
  assert.equal(proc.history[0].lines.length, 1);
});

test('BF-3: completing a process flips in_process false and lands title + hash in memory (no result)', () => {
  const h = 'h_bf3';
  startProcess(h, { task: 'Probe stored XSS', goal: '', progress: '' });
  appendProcessLine(h, 'posted the marker');
  completeProcess(h, { title: 'Probe stored XSS', hash: 'abc123def456' });
  const proc = readProcessFile(h);
  assert.equal(proc.in_process, false);
  assert.equal(proc.history.length, 1);
  assert.equal(proc.history[0].status, 'complete');
  const mem = readMemoryFile(h);
  assert.equal(mem.entries.length, 1);
  assert.equal(mem.entries[0].title, 'Probe stored XSS');
  assert.equal(mem.entries[0].hash, 'abc123def456');
  assert.ok(!JSON.stringify(mem).includes('posted the marker'), 'the memory file holds titles only — never lines/results');
});

test('BF-4: a failed process is recorded as failed in memory, so it is never retried blind', () => {
  const h = 'h_bf4';
  startProcess(h, { task: 'Try the admin panel', goal: '', progress: '' });
  failProcessFile(h, { title: 'Try the admin panel', hash: 'deadbeef0001', error: '404' });
  const proc = readProcessFile(h);
  assert.equal(proc.in_process, false);
  const mem = readMemoryFile(h);
  assert.equal(mem.entries[0].status, 'failed');
});

test('BF-5: outputs are saved by hash and recalled by hash — nothing else lists them', () => {
  const h = 'h_bf5';
  recordBrainOutput(h, { hash: 'feedface0001', title: 'UNION dump', output: '5 users with hashes' });
  const rec = recallBrainOutput(h, 'feedface0001');
  assert.equal(rec.output, '5 users with hashes');
  assert.equal(recallBrainOutput(h, 'nope'), null);
  const screen = renderBrainFilesScreen(h);
  assert.ok(!screen.includes('5 users with hashes'), 'the output value is never in the per-turn screen');
});

test('BF-6: recall records the request, the gift, and the reason in the process file', () => {
  const h = 'h_bf6';
  startProcess(h, { task: 'Reuse the UNION payload', goal: '', progress: '' });
  recordRecall(h, { hash: 'feedface0001', reason: 'I need the exact UNION payload to reuse it on the next endpoint', found: true, title: 'UNION dump' });
  recordRecall(h, { hash: 'missing0000', reason: 'checking whether I already tried this', found: false });
  const proc = readProcessFile(h);
  const text = proc.lines.map((l) => l.line).join('\n');
  assert.match(text, /recall requested: hash feedface0001 — why: I need the exact UNION payload/);
  assert.match(text, /recall given: UNION dump/);
  assert.match(text, /recall requested: hash missing0000 — why: checking whether I already tried this/);
  assert.match(text, /recall NOT FOUND: hash missing0000/);
});

test('BF-7: the per-turn screen carries memory + process, budgeted, and never the output values', () => {
  const h = 'h_bf7';
  for (let i = 1; i <= 30; i++) {
    startProcess(h, { task: `Probe ${i}`, goal: '', progress: '' });
    appendProcessLine(h, `did probe ${i}`);
    completeProcess(h, { title: `Probe ${i}`, hash: `hash${String(i).padStart(4, '0')}abcdef` });
  }
  recordBrainOutput(h, { hash: 'hash0030abcdef', title: 'Probe 30', output: 'SECRET-RESULT-VALUE' });
  const screen = renderBrainFilesScreen(h, { memoryBudget: 400, processBudget: 400 });
  assert.match(screen, /MEMORY FILE/);
  assert.match(screen, /PROCESS FILE — in_process: false/);
  assert.match(screen, /Probe 30/);
  assert.ok(screen.includes('earlier entr'), 'older memory collapses to a count under budget');
  assert.ok(!screen.includes('SECRET-RESULT-VALUE'), 'output values never reach the screen');
  // The files on disk are still A-to-Z complete.
  assert.equal(readMemoryFile(h).entries.length, 30);
});

test('BF-8: normaliseTask folds case and whitespace for process identity', () => {
  assert.equal(normaliseTask('  Intercept   the LOGIN request '), normaliseTask('intercept the login request'));
});

test('BF-9: missing files read as empty — a fresh hunt has no files yet', () => {
  const h = 'h_bf9_fresh';
  assert.deepEqual(readMemoryFile(h), { entries: [] });
  assert.equal(readProcessFile(h).in_process, false);
  assert.equal(renderBrainFilesScreen(h), '');
});
