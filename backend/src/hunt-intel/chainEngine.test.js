// Tests for the chain engine capability map — the primitives each finding
// class grants, and the chains they feed.
//
// Log poisoning (14 Nov 2026, coverage row #337): the probe confirms
// code execution through an included log file, so the class carries
// both primitives — file_read (the LFI include) and code_exec (the
// executed PHP). Without the entry, capabilitiesOf() returns [] and the
// finding is invisible to every chain equation, including the
// file_read → code_exec 'log poisoning / LFI-to-RCE' transition that
// already exists in PRIMITIVE_TRANSITIONS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPABILITY_MAP, findChains } from './chainEngine.js';

test('log_poisoning carries file_read + code_exec (row #337: LFI-to-RCE leg)', () => {
  assert.deepEqual(CAPABILITY_MAP.log_poisoning, ['file_read', 'code_exec']);
});

test('a log_poisoning finding feeds the upload→RCE chain equation via code_exec', () => {
  const chains = findChains([
    { class: 'log_poisoning', id: 'lp1', title: 'Log poisoning to remote code execution', url: 'http://172.17.0.1/view.php' },
    { class: 'file_upload', id: 'fu1', title: 'Unrestricted file upload', url: 'http://172.17.0.1/upload.php' },
  ]);
  const rce = chains.find((c) => c.title === 'Unrestricted upload → RCE');
  assert.ok(rce, 'file_write (upload) + code_exec (log poisoning) must satisfy the equation');
  assert.deepEqual(
    rce.findings.map((f) => f.id).sort(),
    ['fu1', 'lp1']
  );
});
