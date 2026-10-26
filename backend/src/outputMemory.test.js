// HUNTER-MIND lane (26 Oct 2026): completed work is never redone.
//
//   OM-1  an executed shell/search output is saved under its signature
//   OM-2  a lookup by the same signature returns the saved output
//   OM-3  the recall observation carries the output + when it ran +
//         the redo conditions and the force mechanism — never a reason
//         the loop invented
//   OM-4  a forced re-run overwrites the entry and is marked forced
//   OM-5  save/load round-trip; a corrupt ledger degrades to empty;
//         the entry cap keeps the most recent
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE the store is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-outmem-'));
process.env.DATA_DIR = tmpRoot;

const {
  emptyOutputs,
  loadOutputs,
  saveOutputs,
  recordOutput,
  findOutput,
  outputCount,
  recallObservation,
  OUTPUT_HEAD_CHARS,
  MAX_OUTPUT_ENTRIES,
} = await import('./outputMemory.js');

const HUNT = 'h_out_test';
const SIG = 'shell|nmap -sV scanme.nmap.org';
const OUT = 'Nmap scan report for scanme.nmap.org\nPORT STATE SERVICE\n22/tcp open ssh\n80/tcp open http';

// OM-1/OM-2: save under the signature, find it back.
test('OM-1: an executed output is saved and found by signature', () => {
  let data = emptyOutputs();
  assert.equal(findOutput(data, SIG), null);
  data = recordOutput(data, { signature: SIG, tool: 'shell', detail: 'nmap -sV scanme.nmap.org', output: OUT, at: '2026-10-26T10:00:00.000Z' });
  const hit = findOutput(data, SIG);
  assert.ok(hit);
  assert.equal(hit.output, OUT);
  assert.equal(hit.runs, 1);
  assert.equal(hit.tool, 'shell');
  assert.equal(outputCount(data), 1);
  // A different signature is a different entry — no false recall.
  assert.equal(findOutput(data, 'shell|nmap -sV other.example'), null);
  assert.equal(findOutput(data, 'search|nmap -sV scanme.nmap.org'), null, 'the tool is part of the identity');
});

// OM-3: the recall observation carries output + age + redo conditions.
test('OM-3: recall observation carries the saved output and the force mechanism', () => {
  let data = emptyOutputs();
  data = recordOutput(data, {
    signature: SIG, tool: 'shell', detail: 'nmap -sV scanme.nmap.org',
    output: OUT, artifact: 'output-20261026100000-ab12.log',
    at: '2026-10-26T10:00:00.000Z',
  });
  const obs = recallObservation(findOutput(data, SIG), { nowMs: Date.parse('2026-10-26T10:25:00.000Z') });
  assert.ok(obs.startsWith('RECALL — you already ran this'));
  assert.ok(obs.includes('22/tcp open ssh'), 'the saved output rides the observation');
  assert.ok(obs.includes('25 min ago'));
  assert.ok(obs.includes('output-20261026100000-ab12.log'), 'the full text stays one READ_ARTIFACT away');
  assert.ok(obs.includes('"force": true'), 'the redo mechanism is named');
  assert.ok(obs.includes('do not re-run it'), 'the default is act on the output, not re-run');
});

// OM-4: a forced re-run overwrites and is marked forced with its reason.
test('OM-4: a forced re-run overwrites the entry and keeps its reason', () => {
  let data = emptyOutputs();
  data = recordOutput(data, { signature: SIG, tool: 'shell', detail: 'nmap -sV scanme.nmap.org', output: OUT, at: '2026-10-26T10:00:00.000Z' });
  const NEW = 'Nmap scan report (second run)\nPORT STATE SERVICE\n22/tcp open ssh\n80/tcp open http\n443/tcp open https';
  data = recordOutput(data, {
    signature: SIG, tool: 'shell', detail: 'nmap -sV scanme.nmap.org',
    output: NEW, forced: true, why: 'the target added port 443 since the first run',
    at: '2026-10-26T11:00:00.000Z',
  });
  const hit = findOutput(data, SIG);
  assert.equal(hit.runs, 2);
  assert.equal(hit.forced, true);
  assert.equal(hit.why, 'the target added port 443 since the first run');
  assert.ok(hit.output.includes('443/tcp open https'));
});

// OM-5: persistence, corrupt tolerance, entry cap.
test('OM-5: ledger persists; corrupt file degrades to empty; cap keeps the most recent', () => {
  let data = emptyOutputs();
  data = recordOutput(data, { signature: SIG, tool: 'shell', detail: 'nmap -sV scanme.nmap.org', output: OUT });
  assert.equal(saveOutputs(HUNT, data), true);
  assert.equal(outputCount(loadOutputs(HUNT)), 1);
  assert.equal(outputCount(loadOutputs('h_no_such_hunt')), 0);
  fs.writeFileSync(path.join(tmpRoot, 'hunts', HUNT, 'outputs.json'), '{broken');
  assert.equal(outputCount(loadOutputs(HUNT)), 0, 'a corrupt ledger degrades to empty, never throws');
  // The cap keeps the most recent entries.
  let big = emptyOutputs();
  for (let i = 0; i < MAX_OUTPUT_ENTRIES + 5; i++) {
    big = recordOutput(big, { signature: `shell|cmd-${i}`, tool: 'shell', detail: `cmd-${i}`, output: `out-${i}`, at: `2026-10-26T10:${String(i).padStart(2, '0')}:00.000Z` });
  }
  assert.equal(outputCount(big), MAX_OUTPUT_ENTRIES);
  assert.equal(findOutput(big, 'shell|cmd-0'), null, 'the oldest entry is evicted');
  assert.ok(findOutput(big, `shell|cmd-${MAX_OUTPUT_ENTRIES + 4}`), 'the newest entry survives');
  // Long outputs are capped to the head.
  const long = 'x'.repeat(OUTPUT_HEAD_CHARS + 500);
  const capped = recordOutput(emptyOutputs(), { signature: 'shell|long', tool: 'shell', detail: 'long', output: long });
  assert.equal(findOutput(capped, 'shell|long').output.length, OUTPUT_HEAD_CHARS);
});
