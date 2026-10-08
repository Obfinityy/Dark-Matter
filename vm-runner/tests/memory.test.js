import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import {
  writeNote,
  readNote,
  listNotes,
  appendTranscript,
  readTranscript,
  writeFindings,
  readFindings,
} from '../src/memory.js';

let home;
before(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), 'vm-mem-test-'));
});

describe('memory notes', () => {
  it('writes and reads a note', async () => {
    await writeNote(home, 's1', 'plan', '# plan\nstep one');
    assert.equal(await readNote(home, 's1', 'plan'), '# plan\nstep one');
    assert.equal(await readNote(home, 's1', 'plan.md'), '# plan\nstep one');
  });

  it('lists newest notes first', async () => {
    await writeNote(home, 's2', 'aaa', 'old');
    await new Promise((r) => setTimeout(r, 15));
    await writeNote(home, 's2', 'bbb', 'new');
    const notes = await listNotes(home, 's2');
    assert.equal(notes[0].name, 'bbb.md');
    assert.equal(notes[0].content, 'new');
  });

  it('rejects unsafe note names', async () => {
    await assert.rejects(() => writeNote(home, 's1', '../evil', 'x'), /unsafe note name/);
    await assert.rejects(() => writeNote(home, 's1', '', 'x'), /non-empty/);
  });

  it('returns empty list for unknown sessions', async () => {
    assert.deepEqual(await listNotes(home, 'nope'), []);
  });
});

describe('transcript', () => {
  it('appends JSONL records and reads them back', async () => {
    await appendTranscript(home, 's1', { kind: 'action', text: 'nmap scan' });
    await appendTranscript(home, 's1', { kind: 'observation', text: 'done' });
    const rows = await readTranscript(home, 's1');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].kind, 'action');
    assert.ok(rows[0].ts);
  });

  it('returns empty for unknown sessions', async () => {
    assert.deepEqual(await readTranscript(home, 'nope'), []);
  });
});

describe('findings', () => {
  it('round-trips findings', async () => {
    await writeFindings(home, 's1', [{ type: 'xss', severity: 'high' }]);
    const f = await readFindings(home, 's1');
    assert.equal(f.findings[0].type, 'xss');
    assert.ok(f.updatedAt);
  });

  it('returns empty findings for unknown sessions', async () => {
    assert.deepEqual(await readFindings(home, 'nope'), { updatedAt: null, findings: [] });
  });
});
