// Lane llm heartbeat path (6 Nov 2026) — hardcoded install-root default.
//
// llm.js built the inference-heartbeat path from the literal
// '/opt/Dark-Matter/.ai-inference-active' in two places
// (isInferenceActive + chatWithOllama). The heartbeat is GLOBAL — one
// shared 8B model, one file, read by the ollama-watchdog too — NOT
// hunt-scoped, so the fix routes it through config, not dataDir:
// config.aiHeartbeatPath derives the default from the checkout root
// (byte-identical to the old literal on EC2, where the checkout root
// IS the install root, so the installed watchdog keeps agreeing with
// the backend), and AI_HEARTBEAT_PATH still overrides at call time.
// A dataDir default was considered and REJECTED: it would move the
// EC2 path to backend/data/.ai-inference-active while the installed
// watchdog still reads the old path, and the deploy workflow never
// reinstalls the watchdog — the 18-Oct healthy-server murder would
// return.
//
// Tests point AI_HEARTBEAT_PATH at temp files (the established
// pattern), so nothing here writes to the real tree. The HB-ISO
// guard (last) proves it.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import {
  getInferenceHeartbeatPath,
  isInferenceActive,
  writeInferenceHeartbeat,
} from './llm.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(here, '..');
const repoRoot = path.join(here, '..', '..');

function withEnvHeartbeat(file, fn) {
  const prev = process.env.AI_HEARTBEAT_PATH;
  process.env.AI_HEARTBEAT_PATH = file;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.AI_HEARTBEAT_PATH;
    else process.env.AI_HEARTBEAT_PATH = prev;
  }
}

function withoutEnvHeartbeat(fn) {
  const prev = process.env.AI_HEARTBEAT_PATH;
  delete process.env.AI_HEARTBEAT_PATH;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.AI_HEARTBEAT_PATH;
    else process.env.AI_HEARTBEAT_PATH = prev;
  }
}

test('HB-1: no hardcoded install-root heartbeat path in llm.js', () => {
  const src = fs.readFileSync(path.join(here, 'llm.js'), 'utf8');
  assert.equal(
    src.includes('/opt/Dark-Matter'),
    false,
    'llm.js must not contain the hardcoded /opt/Dark-Matter heartbeat path'
  );
  assert.equal(
    src.includes('AI_HEARTBEAT_PATH'),
    true,
    'the env override must still be referenced'
  );
});

test('HB-2: AI_HEARTBEAT_PATH override wins at call time', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-hb-override-'));
  try {
    const file = path.join(dir, 'hb.json');
    assert.equal(withEnvHeartbeat(file, () => getInferenceHeartbeatPath()), file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('HB-3: default is the config-derived checkout-root path, not a literal', () => {
  const resolved = withoutEnvHeartbeat(() => getInferenceHeartbeatPath());
  assert.equal(resolved, config.aiHeartbeatPath);
  assert.equal(resolved, path.join(repoRoot, '.ai-inference-active'));
  assert.ok(resolved.endsWith('.ai-inference-active'));
  assert.equal(
    resolved.includes('backend/data'),
    false,
    'the heartbeat is global, deliberately NOT under dataDir (watchdog contract)'
  );
});

test('HB-4: heartbeat write/read round-trips through the override path (wire-up)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-hb-wire-'));
  const file = path.join(dir, 'hb.json');
  try {
    withEnvHeartbeat(file, () => {
      assert.equal(getInferenceHeartbeatPath(), file);
      assert.equal(
        writeInferenceHeartbeat(getInferenceHeartbeatPath(), Date.now() + 600000, 'h_wire'),
        true
      );
      assert.equal(fs.existsSync(file), true);
      const written = JSON.parse(fs.readFileSync(file, 'utf8'));
      assert.equal(written.huntId, 'h_wire');
      assert.equal(isInferenceActive(), true);
      // Stale deadline (after deleting the fresh file — the never-shorten
      // rule keeps a longer deadline, so a fresh file must go first).
      fs.unlinkSync(file);
      assert.equal(
        writeInferenceHeartbeat(getInferenceHeartbeatPath(), Date.now() - 1000, 'h_wire'),
        true
      );
      assert.equal(isInferenceActive(), false);
    });
    // Nothing was written to the default path.
    assert.equal(
      fs.existsSync(config.aiHeartbeatPath),
      false,
      'wire-up must not touch the default-path heartbeat'
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('HB-ISO: no heartbeat trace in the real backend/data tree or at the default path', () => {
  assert.equal(
    fs.existsSync(path.join(backendDir, 'data', '.ai-inference-active')),
    false,
    'no heartbeat file may land in the real backend/data tree'
  );
  assert.equal(
    fs.existsSync(config.aiHeartbeatPath),
    false,
    'no test in this file may write the default-path heartbeat'
  );
});
