import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockComputerAdapter } from '../src/computer/mockComputerAdapter.js';
import { MockToolRunner } from '../src/services/mockToolRunner.js';
import {
  createInfinityModes,
  decomposeControlRequest,
  validateFileStep,
  validateToolStep,
  validatePlanSteps,
  runControlDeep,
  assertSafeRelPath,
  FILE_OPS
} from '../src/services/infinityModes.js';

function makeModes() {
  return createInfinityModes();
}

async function withTempWorkspace(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'ctrl-deep-test-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ── Deep decomposition ────────────────────────────────────────────────────

test('decomposeControlRequest: clipboard request → gui clipboard_set step', () => {
  const r = decomposeControlRequest('copy "hello world" to clipboard');
  assert.equal(r.ok, true);
  assert.equal(r.steps.length, 1);
  assert.equal(r.steps[0].kind, 'gui');
  assert.equal(r.steps[0].type, 'clipboard_set');
  assert.equal(r.steps[0].params.text, 'hello world');
});

test('decomposeControlRequest: file write request → file write_file step', () => {
  const r = decomposeControlRequest('write "my notes" to notes.txt');
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'file_write');
  assert.equal(r.steps[0].kind, 'file');
  assert.equal(r.steps[0].op, 'write_file');
  assert.equal(r.steps[0].path, 'notes.txt');
  assert.equal(r.steps[0].content, 'my notes');
});

test('decomposeControlRequest: file read request → file read_file step', () => {
  const r = decomposeControlRequest('read file notes.txt');
  assert.equal(r.ok, true);
  assert.equal(r.steps[0].kind, 'file');
  assert.equal(r.steps[0].op, 'read_file');
  assert.equal(r.steps[0].path, 'notes.txt');
});

test('decomposeControlRequest: workspace file list → file list_files step', () => {
  const r = decomposeControlRequest('list workspace files');
  assert.equal(r.ok, true);
  assert.equal(r.steps[0].kind, 'file');
  assert.equal(r.steps[0].op, 'list_files');
});

test('decomposeControlRequest: python run → tool python step', () => {
  const r = decomposeControlRequest('run python: print(2+2)');
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'tool_run');
  assert.equal(r.steps[0].kind, 'tool');
  assert.equal(r.steps[0].tool, 'python');
  assert.match(r.steps[0].code, /print\(2\+2\)/);
});

test('decomposeControlRequest: GUI fallback still handles app launch', () => {
  const r = decomposeControlRequest('open calculator');
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'open_app');
  assert.ok(r.steps.every((s) => s.kind === 'gui'));
});

test('decomposeControlRequest: gibberish is refused with guidance', () => {
  const r = decomposeControlRequest('flibberty gibbet zigzag');
  assert.equal(r.ok, false);
  assert.match(r.reason, /could not turn/);
});

// ── File step validation ──────────────────────────────────────────────────

test('validateFileStep: valid write passes', () => {
  const r = validateFileStep({ kind: 'file', op: 'write_file', path: 'notes.txt', content: 'hi' });
  assert.equal(r.valid, true);
});

test('validateFileStep: traversal is refused', () => {
  const r = validateFileStep({ kind: 'file', op: 'read_file', path: '../../etc/passwd' });
  assert.equal(r.valid, false);
  assert.ok(r.errors.join(' ').includes('escapes the agent workspace'));
});

test('validateFileStep: absolute path is refused', () => {
  const r = validateFileStep({ kind: 'file', op: 'write_file', path: '/etc/hosts', content: 'x' });
  assert.equal(r.valid, false);
});

test('validateFileStep: unknown op is refused', () => {
  const r = validateFileStep({ kind: 'file', op: 'delete_file', path: 'a.txt' });
  assert.equal(r.valid, false);
});

test('assertSafeRelPath: nested safe path passes, traversal fails', () => {
  assert.equal(assertSafeRelPath('docs/notes.txt').ok, true);
  assert.equal(assertSafeRelPath('../evil').ok, false);
  assert.equal(assertSafeRelPath('a/../../b').ok, false);
  assert.ok(FILE_OPS.includes('write_file'));
});

// ── Tool step validation ──────────────────────────────────────────────────

test('validateToolStep: python step with code passes against the real registry', () => {
  const r = validateToolStep({ kind: 'tool', tool: 'python', code: 'print(2+2)' });
  assert.equal(r.valid, true);
  assert.equal(r.tool.name, 'python');
});

test('validateToolStep: unknown tool is refused', () => {
  const r = validateToolStep({ kind: 'tool', tool: 'rm_rf_everything', code: 'x' });
  assert.equal(r.valid, false);
});

test('validateToolStep: empty code is refused', () => {
  const r = validateToolStep({ kind: 'tool', tool: 'python', code: '   ' });
  assert.equal(r.valid, false);
});

// ── Deep pipeline end-to-end ──────────────────────────────────────────────

test('runControlDeep: clipboard NL → validated gui step → mock adapter execution', async () => {
  const modes = makeModes();
  const adapter = new MockComputerAdapter();
  const result = await modes.runControl('copy "hello world" to clipboard', { adapter });
  assert.equal(result.ok, true);
  assert.equal(result.executed.length, 1);
  assert.equal(result.executed[0].kind, 'gui');
  assert.equal(result.executed[0].ok, true);
  assert.equal(adapter.clipboard, 'hello world');
  assert.ok(result.executed[0].observation.toLowerCase().includes('clipboard'));
});

test('runControlDeep: file write → sandboxed execution, file really exists', async () => {
  const modes = makeModes();
  const adapter = new MockComputerAdapter();
  const result = await modes.runControl('write "hello deep control" to memo.txt', { adapter });
  assert.equal(result.ok, true);
  assert.equal(result.executed[0].kind, 'file');
  assert.equal(result.executed[0].ok, true);
  assert.equal(result.executed[0].sandboxed, true);
  assert.equal(modes.workspace.readFile('memo.txt'), 'hello deep control');
});

test('runControlDeep: file write escapes are rejected at validation', async () => {
  const modes = makeModes();
  const validated = validatePlanSteps([{ kind: 'file', op: 'write_file', path: '../evil.txt', content: 'x' }]);
  assert.equal(validated[0].valid, false);
  void modes;
});

test('runControlDeep: write then read composes through the sandbox', async () => {
  await withTempWorkspace(async (dir) => {
    const modes = createInfinityModes({ workspaceRoot: dir });
    const write = await modes.runControl('write "round trip" to trip.txt', {});
    assert.equal(write.ok, true);
    const read = await modes.runControl('read file trip.txt', {});
    assert.equal(read.ok, true);
    assert.ok(read.executed[0].observation.includes('round trip'));
  });
});

test('runControlDeep: python tool step is validated but never executed', async () => {
  const modes = makeModes();
  const runner = new MockToolRunner();
  const result = await modes.runControl('run python: import os; os.system("rm -rf /")', { toolRunner: runner });
  assert.equal(result.ok, true);
  assert.equal(result.simulated, true);
  assert.equal(result.executed[0].kind, 'tool');
  assert.equal(result.executed[0].tool, 'python');
  assert.equal(result.executed[0].simulated, true);
  // The mock logged the call — nothing ran.
  assert.equal(runner.calls.length, 1);
  assert.equal(runner.calls[0].tool, 'python');
});

test('runControlDeep: dry run validates every kind, executes nothing', async () => {
  const modes = makeModes();
  const runner = new MockToolRunner();
  const adapter = new MockComputerAdapter();
  for (const instruction of ['copy "x" to clipboard', 'write "y" to y.txt', 'run python: print(1)']) {
    const result = await modes.runControl(instruction, { dryRun: true, adapter, toolRunner: runner });
    assert.equal(result.ok, true);
    assert.equal(result.dryRun, true);
    assert.equal(result.executed.length, 0);
  }
  assert.equal(runner.calls.length, 0);
  assert.equal(adapter.actionLog.length, 0);
});

test('runControlDeep: Word pipeline still flows through the deep runner', async () => {
  const modes = makeModes();
  const adapter = new MockComputerAdapter();
  const result = await modes.runControl('MS Word me leave application likho', { adapter });
  assert.equal(result.ok, true);
  assert.equal(result.executed.length, 9);
  assert.ok(result.executed.every((e) => e.kind === 'gui'));
  assert.ok(result.executed.every((e) => e.ok));
  const typed = result.executed.find((e) => e.type === 'type');
  assert.ok(typed && typed.observation.includes('Typed ') && typed.observation.includes('character(s)'));
});

test('MockToolRunner: returns simulated envelope, logs calls', async () => {
  const runner = new MockToolRunner();
  const result = await runner.run({ tool: 'python', code: 'print(1)', reason: 't' });
  assert.equal(result.ok, true);
  assert.equal(result.simulated, true);
  assert.equal(result.output.exitCode, 0);
  runner.reset();
  assert.equal(runner.calls.length, 0);
});
