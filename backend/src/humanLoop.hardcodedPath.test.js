// Hardcoded hunt path (6 Nov 2026) — humanLoop.js built hunt file
// paths from the literal '/opt/Dark-Matter/backend/data/hunts/'
// prefix in four places (stuck_recall_count.txt, two isDuplicate
// calls, the history-proof events.jsonl read). That bypassed
// config.dataDir, so in tests — and on any non-EC2 install — those
// reads/writes hit the wrong tree (or a nonexistent absolute path)
// instead of the hunt's real dir.
//
// Fix: every site now goes through store.js huntDir() /
// readHuntEvents(), which resolve under config.dataDir. These tests
// prove (a) the literal is gone from humanLoop.js source, (b) the
// call sites use the helpers, and (c) a real recall turn writes the
// stuck counter under the temp DATA_DIR and nowhere else.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// DATA_DIR isolation (fixture-pollution fix, 6 Nov 2026): config
// resolves dataDir at import time, so the temp dir must be set
// BEFORE the dynamic imports below. Without this, the wire-up test's
// hunt dir + episodes.db land in the REAL backend/data tree.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-path-'));
process.env.DATA_DIR = tmpRoot;

const { humanIteration } = await import('./humanLoop.js');
const { huntDir } = await import('./store.js');

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(srcDir, '..');
const realDataDir = path.join(backendDir, 'data');
const humanLoopSrc = fs.readFileSync(path.join(srcDir, 'humanLoop.js'), 'utf8');

test('HL-PATH-1: no hardcoded /opt/Dark-Matter hunt path in humanLoop.js', () => {
  assert.ok(
    !humanLoopSrc.includes('/opt/Dark-Matter/backend/data/hunts'),
    'humanLoop.js must not contain the hardcoded /opt/Dark-Matter hunt prefix'
  );
});

test('HL-PATH-2: stuck counter is built from huntDir() and ensured on write', () => {
  assert.match(humanLoopSrc, /import \{[^}]*\bhuntDir\b[^}]*\} from '\.\/store\.js'/);
  assert.match(humanLoopSrc, /import \{[^}]*\bensureHuntDir\b[^}]*\} from '\.\/store\.js'/);
  assert.ok(
    humanLoopSrc.includes("path.join(huntDir(huntId), 'stuck_recall_count.txt')"),
    'stuckCounterPath must be path.join(huntDir(huntId), ...)'
  );
  assert.ok(
    humanLoopSrc.includes('ensureHuntDir(huntId); fs.writeFileSync(stuckCounterPath'),
    'setStuckCount must ensure the hunt dir before writing (huntDir() never mkdirs)'
  );
});

test('HL-PATH-3: both isDuplicate calls pass huntDir(huntId)', () => {
  const wired = humanLoopSrc.match(/isDuplicate\(huntDir\(huntId\)/g) || [];
  assert.equal(wired.length, 2, 'exactly two isDuplicate(huntDir(huntId), ...) call sites');
  assert.ok(!humanLoopSrc.includes('isDuplicate(`/opt'), 'no isDuplicate call may use the old literal path');
});

test('HL-PATH-4: history-proof reads events through readHuntEvents()', () => {
  assert.ok(
    humanLoopSrc.includes('readHuntEvents(huntId)'),
    'history-proof must read events via the store helper'
  );
  assert.ok(
    !humanLoopSrc.includes('/events.jsonl`'),
    'no hardcoded events.jsonl path literal may remain in humanLoop.js'
  );
});

test('HL-PATH-5 (wire-up): a recall turn writes the stuck counter under DATA_DIR', async () => {
  const huntId = 'h_test_hp';
  const replies = ['Recalling the earlier probe.\n{"action":"recall","id":"#1"}'];
  let n = 0;
  const recorded = [];
  await humanIteration(huntId, 'https://ksuite.infomaniak.com', {
    turns: 1,
    deps: {
      chat: async () => replies[n++],
      gui: {
        open: async () => ({ observation: 'opened' }),
        snapshot: async () => ({ observation: 'snapshot ok' }),
        click: async () => ({ observation: 'clicked' }),
        type: async () => ({ observation: 'Typed.' }),
        screenshot: async () => ({ observation: 'shot' }),
      },
      execRaw: async () => ({ stdout: '', stderr: '' }),
      record: (h, e) => { recorded.push(e); },
      recordNote: () => {},
      readMeta: () => ({}),
      readEvents: () => [],
      buildBriefing: async () => '',
      assess: null,
    },
  });
  const counterFile = path.join(tmpRoot, 'hunts', huntId, 'stuck_recall_count.txt');
  assert.ok(fs.existsSync(counterFile), 'recall turn must create the stuck counter file');
  assert.equal(fs.readFileSync(counterFile, 'utf8').trim(), '1', 'one recall action counts as 1');
  assert.equal(
    huntDir(huntId),
    path.join(tmpRoot, 'hunts', huntId),
    'huntDir() must resolve under the temp DATA_DIR'
  );
});

// HL-PATH-ISO (guard, keep last): the wire-up run above must not
// have touched the real backend/data tree at all.
test('HL-PATH-ISO: real backend/data holds no trace of the wire-up hunt', () => {
  assert.ok(
    !fs.existsSync(path.join(realDataDir, 'hunts', 'h_test_hp')),
    'no h_test_hp dir may appear in the real backend/data tree'
  );
  assert.ok(
    !fs.existsSync(path.join(realDataDir, 'episodes.db')),
    'no episodes.db may appear in the real backend/data tree'
  );
});
