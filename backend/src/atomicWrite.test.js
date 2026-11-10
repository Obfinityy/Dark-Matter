// ATOMIC WRITE tests (professionalization lane P7, 9 Nov 2026).
//
// The shared atomicWrite helpers replace the hand-rolled `${file}.${pid}.tmp`
// + rename pattern that 17 persistence modules used to repeat. These tests
// pin the contract the call sites rely on: exact bytes, no temp file left
// behind, chmod honoured, and a missing directory still throws (callers
// that must never throw keep their own try/catch).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { atomicWrite, atomicWriteJson, atomicWriteNdjson } from './atomicWrite.js';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'atomic-write-'));
const file = (name) => path.join(tmpRoot, name);

test('atomicWriteJson writes indented JSON and leaves no temp file', () => {
  const target = file('a.json');
  atomicWriteJson(target, { b: 1 });
  assert.equal(fs.readFileSync(target, 'utf8'), JSON.stringify({ b: 1 }, null, 2));
  assert.deepEqual(fs.readdirSync(tmpRoot).filter((n) => n.includes('.tmp')), []);
});

test('atomicWriteJson replaces existing content in full', () => {
  const target = file('b.json');
  fs.writeFileSync(target, 'stale-content-that-is-longer-than-the-replacement');
  atomicWriteJson(target, { ok: true });
  assert.equal(fs.readFileSync(target, 'utf8'), JSON.stringify({ ok: true }, null, 2));
});

test('atomicWriteJson honours space 0 (compact) and space 1', () => {
  const compact = file('c.json');
  atomicWriteJson(compact, { a: 1 }, { space: 0 });
  assert.equal(fs.readFileSync(compact, 'utf8'), '{"a":1}');
  const one = file('d.json');
  atomicWriteJson(one, { a: 1 }, { space: 1 });
  assert.equal(fs.readFileSync(one, 'utf8'), JSON.stringify({ a: 1 }, null, 1));
});

test('atomicWriteNdjson writes one object per line with a trailing newline', () => {
  const target = file('e.jsonl');
  atomicWriteNdjson(target, [{ a: 1 }, { b: 2 }]);
  assert.equal(fs.readFileSync(target, 'utf8'), '{"a":1}\n{"b":2}\n');
});

test('atomicWrite honours mode on the target (vault 0600 behaviour)', () => {
  const target = file('f.json');
  atomicWrite(target, '{}', { mode: 0o600 });
  assert.equal(fs.statSync(target).mode & 0o777, 0o600);
});

test('atomicWrite throws when the directory does not exist', () => {
  assert.throws(() => atomicWriteJson(path.join(tmpRoot, 'no-such-dir', 'g.json'), {}));
});
