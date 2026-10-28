// 'Interesting' pre-filter tests (28 Oct 2026, gate-interesting-xss lane, W6).
//
// The parent, acting as the hunt brain, reproduced a live reflected XSS
// on DVWA (fresh marker PBRN7719) and filed it through assessResult.
// The gate returned NULL — validation verdict 'not-interesting', detail
// 'no signal in output' — because the pre-filter was a hardcoded
// keyword regex only, and a clean reflected-XSS proof contains none of
// those words. The fix adds a signal-based path (evidenceSignalIds —
// the same signal source the rest of the pipeline trusts) alongside
// the keyword regex and the weird-score path.
import test from 'node:test';
import assert from 'node:assert/strict';

import { isInterestingEvidence } from './huntAgent.js';

// The parent's live XSS evidence (28 Oct 2026, h_830317bdc184, iter 247).
const XSS_COMMAND = 'python3 /opt/hunt/parent_brain_xss.py PBRN7719';
const XSS_EVIDENCE = [
  'xss_r 200 len 4388',
  'RAW marker present: True | script tag present: True',
  'REFLECTED LINE: <pre>Hello PBRN7719<sCrIpT>alert(1)</sCrIpT></pre>',
].join('\n');
// The control probe (plain marker, no script tag) — the baseline.
const CONTROL_EVIDENCE = [
  'xss_r 200 len 4363',
  'RAW marker present: True | script tag present: False',
  'REFLECTED LINE: <pre>Hello PBRN7719</pre>',
].join('\n');

test('W6-1: the parent live XSS evidence is interesting (signal path)', () => {
  // weird.score was < 40 live (that is why the old filter rejected it);
  // the xss-reflect signal alone must carry it.
  assert.equal(isInterestingEvidence(XSS_EVIDENCE, XSS_COMMAND, 0), true);
  assert.equal(isInterestingEvidence(XSS_EVIDENCE, XSS_COMMAND, 8), true);
});

test('W6-2: the control (plain marker, no script tag) is NOT interesting', () => {
  // A baseline is not a finding: no signal, no keyword.
  assert.equal(isInterestingEvidence(CONTROL_EVIDENCE, XSS_COMMAND, 0), false);
});

test('W6-3: a probe echoing its own banner is NOT interesting', () => {
  // The /ftp probe's unconditional echo banner carries a dir-listing
  // signal, but the line is verbatim in the command (its own framing),
  // so evidenceSignalIds excludes it — and the keyword regex does not
  // match 'directory listing' either.
  const command = 'echo "--- /ftp/ directory listing ---"; curl -s http://172.17.0.1/ftp/';
  const output = [
    '--- /ftp/ directory listing ---',
    'file1.txt (1024 bytes)',
    'file2.txt (2048 bytes)',
    'checked 2 entries, all present',
  ].join('\n');
  assert.ok(output.trim().length >= 50, 'fixture must clear the length gate');
  assert.equal(isInterestingEvidence(output, command, 0), false);
});

test('W6-4: a negated verdict line is NOT interesting', () => {
  // 'directory listing' is a signal pattern, but the negation cue 'no'
  // precedes it, so the signal is excluded — and the keyword regex does
  // not match 'directory listing' either.
  const output = 'probe complete: no directory listing found on the target host, every path returned a normal page with no listing present';
  assert.ok(output.trim().length >= 50, 'fixture must clear the length gate');
  assert.equal(isInterestingEvidence(output, 'curl -s http://172.17.0.1/', 0), false);
});

test('W6-5: empty / short output is NOT interesting', () => {
  assert.equal(isInterestingEvidence('', XSS_COMMAND, 0), false);
  assert.equal(isInterestingEvidence('   \n', XSS_COMMAND, 0), false);
  // Even a signal-bearing line under 50 chars is rejected by the
  // length gate — the pre-filter still rejects noise.
  assert.equal(isInterestingEvidence('<script>alert(1)</script>', XSS_COMMAND, 0), false);
});

test('W6-6: the old keyword cases still pass', () => {
  const withPassword = 'login response 200, user admin, password hash 5f4dcc3b5aa765d61d8327deb882cf99 returned in the body, session active';
  assert.equal(isInterestingEvidence(withPassword, 'curl http://x/login', 0), true);
  const withInjection = 'probe: SQL injection confirmed, the parameter returns a syntax error on a single quote';
  assert.equal(isInterestingEvidence(withInjection, 'curl http://x/sqli', 0), true);
});

test('W6-7: the weird-score (curiosity) path is intact', () => {
  // No signal, no keyword — but a high weirdness score still carries it.
  const bland = 'response 200, length 4120, timing 1840ms, headers present, body looks ordinary and unremarkable';
  assert.equal(isInterestingEvidence(bland, 'curl http://x/', 50), true);
  assert.equal(isInterestingEvidence(bland, 'curl http://x/', 39), false);
});
