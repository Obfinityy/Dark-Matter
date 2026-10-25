// isInferenceActive — the brain-busy signal (CHAT-ANSWERS, 26 Oct 2026).
//
// chatWithOllama writes a heartbeat file carrying a deadline while a
// generation runs and deletes it when done. A fresh heartbeat means
// the one shared 8B is occupied — a chat question sent now would
// queue behind the running hunt turn and die at the deadline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isInferenceActive } from './llm.js';

function withHeartbeatFile(contents, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-hb-'));
  const file = path.join(dir, 'hb.json');
  if (contents !== null) fs.writeFileSync(file, contents);
  const prev = process.env.AI_HEARTBEAT_PATH;
  process.env.AI_HEARTBEAT_PATH = file;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.AI_HEARTBEAT_PATH;
    else process.env.AI_HEARTBEAT_PATH = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('fresh heartbeat means busy', () => {
  const fresh = withHeartbeatFile(
    JSON.stringify({ startedAt: new Date().toISOString(), deadline: Date.now() + 600000, huntId: 'h_x' }),
    () => isInferenceActive()
  );
  assert.equal(fresh, true);
});

test('stale heartbeat means not busy', () => {
  const stale = withHeartbeatFile(
    JSON.stringify({ startedAt: new Date().toISOString(), deadline: Date.now() - 1000, huntId: 'h_x' }),
    () => isInferenceActive()
  );
  assert.equal(stale, false);
});

test('missing, unreadable or malformed heartbeat means not busy', () => {
  assert.equal(withHeartbeatFile(null, () => isInferenceActive()), false);
  assert.equal(withHeartbeatFile('not json{', () => isInferenceActive()), false);
  assert.equal(withHeartbeatFile(JSON.stringify({ startedAt: 'x' }), () => isInferenceActive()), false);
});
