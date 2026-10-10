/**
 * tripleBrainOrchestrator.grounding.test.js — Bug 6: when the owner disables
 * the grounding brain, click/ground actions must NOT die silently.
 *
 *  - no grounding provider + vision provider present → act() routes through
 *    the vision brain's grounding capability and reports
 *    source 'vision-driven' explicitly;
 *  - neither grounding nor vision → { ok:false } with an explicit reason
 *    (no swallowed error);
 *  - a configured grounding brain is still preferred (source unchanged).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TripleBrainOrchestrator } from './tripleBrainOrchestrator.js';

const quiet = { info: () => {}, warn: () => {}, error: () => {} };

const visionProvider = {
  generateStructured: async () => ({ x: 512, y: 300, confidence: 0.9 }),
};

const groundingProvider = {
  generateStructured: async () => ({ x: 100, y: 200, confidence: 0.99 }),
};

describe('act() grounding fallback', () => {
  test('no grounding brain → vision brain drives the click, source is explicit', async () => {
    const orch = new TripleBrainOrchestrator({
      providers: { vision: visionProvider },
      logger: quiet,
    });
    const result = await orch.act({ element: 'the Submit button' });
    assert.equal(result.ok, true);
    assert.equal(result.source, 'vision-driven');
    assert.equal(result.x, 512);
    assert.equal(result.y, 300);
  });

  test('neither grounding nor vision → explicit failure, not a silent dead-end', async () => {
    const orch = new TripleBrainOrchestrator({ providers: {}, logger: quiet });
    const result = await orch.act({ element: 'the Submit button' });
    assert.equal(result.ok, false);
    assert.match(result.reason, /grounding brain missing/);
    assert.match(result.reason, /no vision brain/);
  });

  test('configured grounding brain is still preferred', async () => {
    const orch = new TripleBrainOrchestrator({
      providers: { vision: visionProvider, grounding: groundingProvider },
      logger: quiet,
    });
    const result = await orch.act({ element: 'the Submit button' });
    assert.equal(result.ok, true);
    assert.equal(result.source, 'injected');
    assert.equal(result.x, 100);
  });

  test('missing element description → explicit failure', async () => {
    const orch = new TripleBrainOrchestrator({
      providers: { vision: visionProvider },
      logger: quiet,
    });
    const result = await orch.act({ element: '   ' });
    assert.equal(result.ok, false);
    assert.match(result.reason, /no element description/);
  });

  test('unusable coordinates from vision → explicit failure with reason', async () => {
    const orch = new TripleBrainOrchestrator({
      providers: {
        vision: { generateStructured: async () => ({ x: 'nowhere', y: null }) },
      },
      logger: quiet,
    });
    const result = await orch.act({ element: 'the Submit button' });
    assert.equal(result.ok, false);
    assert.equal(result.source, 'vision-driven');
    assert.match(result.reason, /unusable coordinates/);
  });
});
