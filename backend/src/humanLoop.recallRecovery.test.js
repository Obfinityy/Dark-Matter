import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverRecallLoopSqli } from './humanLoop.js';

test('recall loop proof recovery requires consecutive recalls and recorded SQLi hashes', () => {
  const events = [
    { type: 'tool_call', tool: 'shell', detail: "curl 'http://lab/vulnerabilities/sqli/?id=1 UNION SELECT user,password FROM users'" },
    { type: 'observation', text: 'admin 5f4dcc3b5aa765d61d8327deb882cf99' },
    { type: 'observation', text: 'gordon e99a18c428cb38d5f260853678922e03' },
    { type: 'tool_call', tool: 'recall', detail: 'SQLi hashes' },
    { type: 'tool_call', tool: 'recall', detail: 'SQLi hashes' },
    { type: 'tool_call', tool: 'recall', detail: 'SQLi hashes' },
  ];
  const proof = recoverRecallLoopSqli(events);
  assert.ok(proof);
  assert.equal(proof.recalls, 3);
  assert.equal(proof.hashes.length, 2);
  assert.match(proof.command, /UNION SELECT/i);
  assert.match(proof.evidence, /5f4dcc3b5aa765d61d8327deb882cf99/);
});

test('recall loop proof recovery rejects narration-only hashes and non-consecutive recalls', () => {
  const noProbe = [
    { type: 'observation', text: 'SQLi proven; hashes 5f4dcc3b5aa765d61d8327deb882cf99 e99a18c428cb38d5f260853678922e03' },
    ...Array.from({ length: 3 }, () => ({ type: 'tool_call', tool: 'recall', detail: 'again' })),
  ];
  assert.equal(recoverRecallLoopSqli(noProbe), null);
  const interrupted = [
    { type: 'tool_call', tool: 'recall', detail: 'a' },
    { type: 'tool_call', tool: 'shell', detail: 'echo unrelated' },
    { type: 'tool_call', tool: 'recall', detail: 'b' },
    { type: 'tool_call', tool: 'recall', detail: 'c' },
  ];
  assert.equal(recoverRecallLoopSqli(interrupted), null);
});
