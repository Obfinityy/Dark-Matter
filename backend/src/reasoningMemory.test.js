// Hypothesis ledger — wrong-target guard (zero-genuine lane,
// 27 Oct 2026). Asserted here (reasoning file under a tmp
// DATA_DIR, no network, no Meta):
//   - (d) Five failures of "SQLi on login", ALL against the WRONG
//     endpoint (/rest/user/login on a DVWA target), retire the
//     premise WITHOUT the guard — and do NOT retire it WITH the
//     guard (knownApp 'dvwa'): the failures never tested the real
//     target, so wrongTargetSkipped is 5 and dead is empty.
//   - The same five failures against the REAL login (/login.php)
//     still retire the premise with the guard on.
//   - buildFullHistoryLedger mirrors the rule in its DEAD ENDS +
//     stats, and names the wrong-target rows in the text.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE reasoningMemory (via store/config)
// is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-ledger-'));
process.env.DATA_DIR = tmpRoot;

const {
  recordReasoning,
  getHypothesisLedger,
  buildFullHistoryLedger,
  formatLedgerForPrompt,
} = await import('./reasoningMemory.js');

const WRONG_CMD = 'shell: curl -sk -X POST "http://172.17.0.1:3100/rest/user/login" -H "Content-Type: application/json" -d \'{"email":"x"}\' | head -c 2000';
const RIGHT_CMD = 'shell: curl -sk -X POST "http://172.17.0.1:3100/login.php" -d "username=x&password=y&Login=Login" | head -c 2000';
const HYP = 'Login endpoint may be vulnerable to SQL injection';

function seedFailures(huntId, action, n = 5) {
  // recordReasoning appends to the hunt dir — it must exist first
  // (the append is best-effort and silently drops rows otherwise).
  fs.mkdirSync(path.join(tmpRoot, 'hunts', huntId), { recursive: true });
  for (let i = 0; i < n; i++) {
    recordReasoning(huntId, {
      hypothesis: HYP,
      action,
      why: 'testing the login form',
      result: 'no assessment — nothing interesting in the response',
      learned: '',
      followUp: '',
    });
  }
}

test('wrong-target failures retire the premise without the guard', () => {
  seedFailures('h_wrong_plain', WRONG_CMD);
  const { dead, wrongTargetSkipped } = getHypothesisLedger('h_wrong_plain');
  assert.equal(dead.length, 1);
  assert.equal(dead[0].failed, 5);
  assert.equal(wrongTargetSkipped, 0);
});

test('wrong-target failures do NOT retire the premise with the guard', () => {
  seedFailures('h_wrong_guarded', WRONG_CMD);
  const { dead, wrongTargetSkipped } = getHypothesisLedger('h_wrong_guarded', { knownApp: 'dvwa' });
  assert.equal(dead.length, 0);
  assert.equal(wrongTargetSkipped, 5);
  const prompt = formatLedgerForPrompt('h_wrong_guarded', { knownApp: 'dvwa' });
  assert.equal(prompt.includes('DEAD'), false);
  assert.ok(prompt.includes('another app'));
});

test('real-target failures still retire the premise with the guard on', () => {
  seedFailures('h_right_guarded', RIGHT_CMD);
  const { dead, wrongTargetSkipped } = getHypothesisLedger('h_right_guarded', { knownApp: 'dvwa' });
  assert.equal(dead.length, 1);
  assert.equal(wrongTargetSkipped, 0);
});

test('buildFullHistoryLedger mirrors the guard in DEAD ENDS + stats', () => {
  const rows = [];
  for (let i = 0; i < 5; i++) {
    rows.push({ hypothesis: HYP, action: WRONG_CMD, why: 'testing', result: 'no assessment', learned: '' });
  }
  const plain = buildFullHistoryLedger({ reasoningRows: rows, findings: [] });
  assert.equal(plain.stats.deadEnds, 1);
  const guarded = buildFullHistoryLedger({ reasoningRows: rows, findings: [], knownApp: 'dvwa' });
  assert.equal(guarded.stats.deadEnds, 0);
  assert.equal(guarded.stats.wrongTargetSkipped, 5);
  assert.ok(guarded.text.includes('WRONG-TARGET ROWS (5)'));
  assert.equal(guarded.text.includes('DEAD ENDS'), false);
});
