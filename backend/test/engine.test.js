import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlowInput } from '../src/engine.js';

test('resumed flow input carries checkpoint summary and scope', () => {
  const input = buildFlowInput('https://example.com', ['example.com/api'], {
    summary: 'Completed recon; found exposed staging endpoint.',
  });
  assert.match(input, /TARGET: https:\/\/example\.com/);
  assert.match(input, /example\.com\/api/);
  assert.match(input, /Completed recon; found exposed staging endpoint\./);
  assert.match(input, /do not repeat completed steps/i);
});
