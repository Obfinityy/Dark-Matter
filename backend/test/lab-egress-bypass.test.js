import test from 'node:test';
import assert from 'node:assert/strict';
import { isLabLoopbackTarget } from '../src/huntRunner.js';

test('lab egress bypass accepts only exact configured loopback hosts', () => {
  for (const target of ['http://localhost', 'https://127.0.0.1:3000', 'http://172.17.0.1', 'localhost:3000']) {
    assert.equal(isLabLoopbackTarget(target), true, target);
  }
  for (const target of [
    'https://localhost.attacker.example',
    'https://127.0.0.1.attacker.example',
    'https://172.17.0.1.attacker.example',
    'https://attacker.example/?next=localhost',
    'not a url localhost',
  ]) {
    assert.equal(isLabLoopbackTarget(target), false, target);
  }
});
