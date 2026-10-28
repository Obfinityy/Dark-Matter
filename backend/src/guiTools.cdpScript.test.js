// cdp.mjs syntax regression guard (28 Oct 2026, 20:04 IST).
//
// The 28 Oct lane shipped a stray `}` at the end of the `type` branch of
// the generated CDP driver script while the suite was 621/621 green:
// every GUI test extracts only FRAGMENTS of CDP_SCRIPT (the click/type
// expressions) and runs them in a vm sandbox, so no test ever parsed the
// whole generated script. The deployed GUI control then failed with
// "cdp.mjs:302 SyntaxError: Unexpected token '}'".
//
// This test parses the WHOLE CDP_SCRIPT — the exact string the backend
// writes to cdp.mjs — with `node --check`, so a stray brace anywhere in
// the generated script fails the suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CDP_SCRIPT } from './guiTools.js';

test('CDP-1: the whole generated CDP_SCRIPT parses (node --check)', async () => {
  assert.equal(typeof CDP_SCRIPT, 'string');
  // Guard against the test silently passing on an empty or fragment
  // string if the export ever changes shape.
  assert.ok(CDP_SCRIPT.length > 1000, 'CDP_SCRIPT must be the full driver script, not a fragment');
  assert.ok(CDP_SCRIPT.includes('screenshot'), 'CDP_SCRIPT must contain the screenshot branch');
  assert.ok(CDP_SCRIPT.includes('process.argv[2]'), 'CDP_SCRIPT must be the action-dispatch driver');
  const dir = await mkdtemp(join(tmpdir(), 'cdp-script-check-'));
  try {
    const file = join(dir, 'cdp.mjs');
    await writeFile(file, CDP_SCRIPT, 'utf8');
    await new Promise((resolve, reject) => {
      execFile(process.execPath, ['--check', file], (err, _stdout, stderr) => {
        if (err) {
          reject(new Error(`node --check failed on the generated CDP_SCRIPT:\n${stderr || err.message}`));
        } else {
          resolve();
        }
      });
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
