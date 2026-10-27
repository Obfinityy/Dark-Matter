// Shared target intel is keyed by ORIGIN (zero-genuine lane,
// 27 Oct 2026): two apps on one host with different ports are
// different targets and must never share endpoints, technologies,
// or lessons. Asserted here:
//   - DVWA (:3100) and Juice Shop (:3000) on the same host get
//     different folders — the leak that modelled DVWA as ecommerce.
//   - Default ports keep the old plain-host folder name.
//   - Empty/odd input still degrades to 'unknown-target'.
import test from 'node:test';
import assert from 'node:assert/strict';
import { targetFolderName } from './store.js';

test('same host, different ports are different targets', () => {
  assert.equal(targetFolderName('http://172.17.0.1:3100/'), '172.17.0.1-3100');
  assert.equal(targetFolderName('http://172.17.0.1:3000/'), '172.17.0.1-3000');
  assert.notEqual(
    targetFolderName('http://172.17.0.1:3100/'),
    targetFolderName('http://172.17.0.1:3000/')
  );
});

test('default ports keep the plain-host folder name', () => {
  assert.equal(targetFolderName('https://example.com/'), 'example.com');
  assert.equal(targetFolderName('https://example.com:443/x'), 'example.com');
  assert.equal(targetFolderName('http://example.com:80/'), 'example.com');
  assert.equal(targetFolderName('http://example.com:8080/'), 'example.com-8080');
});

test('odd input degrades safely', () => {
  assert.equal(targetFolderName(''), 'unknown-target');
  assert.equal(targetFolderName(null), 'unknown-target');
  assert.equal(targetFolderName('HTTPS://Example.COM:3100/Path'), 'example.com-3100');
});
