// Lane AL (25 Oct 2026) — write_file observation names the container-local
// path and states the file is NOT on the target.
//
// Observed failure (Infomaniak hunt, live): the hunter kept trying to
// download its own write_file script FROM the target website —
// `curl -O https://ksuite.infomaniak.com/login_curl.sh`, `wget` the same URL,
// `browser_open` the same URL — dedupe-blocked 28x overnight. The file was
// created by write_file inside the hunt container; it was never on the
// target. The old observation said only "Saved X in your hunt workspace",
// never where the file lives or that it is not on the target.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// DATA_DIR isolation (fixture-pollution fix, 6 Nov 2026): humanIteration
// writes hunt meta into config.dataDir and records episodes into
// episodes.db, and config resolves dataDir at import time — so the
// temp dir must be set BEFORE the dynamic imports below (artifacts
// pulls in store.js too). Without this, the h_test_al dir +
// episodes.db land in the REAL backend/data tree on every suite run.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-al-'));
process.env.DATA_DIR = tmpRoot;

const { writeFileObservation, artifactNotOnTargetNote, handleArtifactCommand, CONTAINER_ARTIFACT_DIR } = await import('./artifacts.js');
const { humanIteration } = await import('./humanLoop.js');
const { huntDir } = await import('./store.js');

const NAME = 'login_curl.sh';

test('AL-1: observation names the exact container-local path', () => {
  const obs = writeFileObservation(NAME, 1234);
  assert.match(obs, /\/tmp\/dm-artifacts\/login_curl\.sh/);
  assert.equal(CONTAINER_ARTIFACT_DIR, '/tmp/dm-artifacts');
});

test('AL-2: observation states the file lives ONLY inside the hunt container', () => {
  const obs = writeFileObservation(NAME, 1234);
  assert.match(obs, /ONLY inside your hunt container/);
});

test('AL-3: observation states the file is NOT on the target website', () => {
  const obs = writeFileObservation(NAME, 1234);
  assert.match(obs, /NOT on the target website/);
  assert.match(obs, /NOT served at any target URL/);
});

test('AL-4: observation forbids fetching it from the target (curl/wget/browser_open)', () => {
  const obs = writeFileObservation(NAME, 1234);
  assert.match(obs, /NEVER download it from the target with curl, wget, or browser_open/);
});

test('AL-5: observation points at the local RUN_ARTIFACT route', () => {
  const obs = writeFileObservation(NAME, 1234);
  assert.match(obs, /RUN_ARTIFACT: login_curl\.sh/);
  assert.match(obs, /Run it locally/);
});

test('AL-6: path + not-on-target + prohibition all fit in the 300-char persisted note', () => {
  // The reasoning note truncates observations to 300 chars; the live screen
  // carries the full text, but the facts must survive truncation too.
  const head = writeFileObservation(NAME, 1234).slice(0, 300);
  assert.match(head, /\/tmp\/dm-artifacts\/login_curl\.sh/);
  assert.match(head, /NOT on the target website/);
  assert.match(head, /NEVER download it from the target/);
});

test('AL-7: the shared not-on-target note carries the prohibition on its own', () => {
  const note = artifactNotOnTargetNote();
  assert.match(note, /ONLY inside your hunt container/);
  assert.match(note, /NOT on the target website/);
  assert.match(note, /NEVER download it from the target with curl, wget, or browser_open/);
});

test('AL-8 (wire-up): a stubbed session renders the Lane AL observation for write_file', async () => {
  const written = [];
  const recorded = [];
  const replies = [
    'I will save the login script.\n{"action":"write_file","name":"login_curl.sh","content":"echo hi"}',
  ];
  let n = 0;
  const res = await humanIteration('h_test_al', 'https://ksuite.infomaniak.com', {
    turns: 1,
    deps: {
      chat: async () => replies[n++],
      writeFile: async (huntId, name, content) => {
        written.push({ huntId, name, content });
        return { name, chars: content.length };
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
  assert.equal(written.length, 1, 'deps.writeFile must run once');
  assert.equal(written[0].name, NAME);
  const turn = res.log.find((e) => e.action === 'write_file');
  assert.ok(turn, 'a write_file turn must be logged');
  assert.match(turn.observation, /\/tmp\/dm-artifacts\/login_curl\.sh/);
  assert.match(turn.observation, /ONLY inside your hunt container/);
  assert.match(turn.observation, /NOT on the target website/);
  assert.match(turn.observation, /NEVER download it from the target/);
});

test('AL-9 (shell path): WRITE_ARTIFACT stdout carries the same path + prohibition', async () => {
  const huntId = 'h_test_al_shell';
  try {
    const res = await handleArtifactCommand(huntId, 'WRITE_ARTIFACT: login_curl.sh\necho hi');
    assert.equal(res.exitCode, 0);
    assert.match(res.stdout, /\/tmp\/dm-artifacts\/login_curl\.sh/);
    assert.match(res.stdout, /ONLY inside your hunt container/);
    assert.match(res.stdout, /NOT on the target website/);
    assert.match(res.stdout, /NEVER download it from the target with curl, wget, or browser_open/);
  } finally {
    // Test hunt dir lives under gitignored backend/data/; remove it anyway.
    // (With DATA_DIR isolation this resolves into the temp dir.)
    try { fs.rmSync(huntDir(huntId), { recursive: true, force: true }); } catch { /* best-effort */ }
  }
});

// Regression guard (fixture-pollution fix, 6 Nov 2026): if the
// DATA_DIR isolation above ever regresses, the AL wire-up test
// writes h_test_al meta + episodes.db into the REAL backend/data
// tree. This test fails loudly instead of silently re-polluting it.
// (h_test_al_shell is cleaned up by AL-9 itself, so it is not
// asserted here — its absence in the real tree proves nothing.)
test('AL-ISO: no fixture writes land in the real backend/data tree', async () => {
  const { config } = await import('./config.js');
  assert.equal(config.dataDir, tmpRoot, 'DATA_DIR isolation must be active in this process');
  const realData = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
  assert.equal(fs.existsSync(path.join(realData, 'hunts', 'h_test_al')), false, 'real backend/data must not contain h_test_al');
  assert.ok(fs.existsSync(path.join(tmpRoot, 'hunts', 'h_test_al', 'meta.json')), 'wire-up writes for h_test_al must land in the temp dir, not vanish');
  assert.equal(fs.existsSync(path.join(realData, 'episodes.db')), false, 'real backend/data must not contain episodes.db');
});
