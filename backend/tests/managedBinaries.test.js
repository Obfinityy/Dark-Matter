/**
 * managedBinaries.test.js — offline unit tests for the GitHub-release
 * binary manager (nuclei / subfinder / katana download-on-demand).
 *
 * No network, no downloads, no extraction — pure URL/path/selection logic.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MANAGED_TOOLS,
  releasePlatform,
  assetUrl,
  binaryPath,
  describeTools,
} from '../src/tools/managedBinaries.js';

describe('managed tool catalog', () => {
  test('covers nuclei, subfinder and katana with rebranded display names', () => {
    for (const name of ['nuclei', 'subfinder', 'katana']) {
      assert.ok(MANAGED_TOOLS[name], `${name} missing from catalog`);
      assert.ok(MANAGED_TOOLS[name].displayName.startsWith('Infinity'),
        `${name} display name must be rebranded, got: ${MANAGED_TOOLS[name].displayName}`);
      assert.ok(MANAGED_TOOLS[name].repo.startsWith('projectdiscovery/'));
      assert.match(MANAGED_TOOLS[name].version, /^v\d/);
    }
    // Upstream names never leak into product-facing display names.
    const names = Object.values(MANAGED_TOOLS).map((t) => t.displayName.toLowerCase());
    for (const n of names) {
      assert.ok(!n.includes('nuclei') && !n.includes('subfinder') && !n.includes('katana'));
    }
  });
});

describe('releasePlatform', () => {
  test('maps node platform/arch to release naming', () => {
    assert.deepEqual(releasePlatform('linux', 'x64'), { os: 'linux', arch: 'amd64' });
    assert.deepEqual(releasePlatform('linux', 'arm64'), { os: 'linux', arch: 'arm64' });
    assert.deepEqual(releasePlatform('win32', 'x64'), { os: 'windows', arch: 'amd64' });
    assert.deepEqual(releasePlatform('darwin', 'arm64'), { os: 'macOS', arch: 'arm64' });
    assert.deepEqual(releasePlatform('darwin', 'x64'), { os: 'macOS', arch: 'amd64' });
  });

  test('rejects unsupported platforms with a clear error', () => {
    assert.throws(() => releasePlatform('sunos', 'x64'), /Unsupported platform/);
    assert.throws(() => releasePlatform('linux', 'ppc64'), /Unsupported platform/);
  });
});

describe('assetUrl', () => {
  test('builds exact ProjectDiscovery release URLs', () => {
    assert.equal(
      assetUrl('nuclei', 'linux', 'x64'),
      'https://github.com/projectdiscovery/nuclei/releases/download/v3.11.1/nuclei_3.11.1_linux_amd64.zip'
    );
    assert.equal(
      assetUrl('subfinder', 'win32', 'x64'),
      'https://github.com/projectdiscovery/subfinder/releases/download/v2.17.0/subfinder_2.17.0_windows_amd64.zip'
    );
    assert.equal(
      assetUrl('katana', 'darwin', 'arm64'),
      'https://github.com/projectdiscovery/katana/releases/download/v1.8.0/katana_1.8.0_macOS_arm64.zip'
    );
  });

  test('unknown tool throws', () => {
    assert.throws(() => assetUrl('nope'), /Unknown managed tool/);
  });
});

describe('binaryPath', () => {
  test('points under ~/.darkmatter/tools/<name> with correct exe name', async () => {
    const os = await import('node:os');
    const path = await import('node:path');
    const home = os.homedir();
    assert.equal(binaryPath('nuclei', 'linux', 'x64'), path.join(home, '.darkmatter', 'tools', 'nuclei', 'nuclei'));
    assert.equal(binaryPath('nuclei', 'win32', 'x64'), path.join(home, '.darkmatter', 'tools', 'nuclei', 'nuclei.exe'));
    assert.equal(binaryPath('subfinder', 'darwin', 'arm64'), path.join(home, '.darkmatter', 'tools', 'subfinder', 'subfinder'));
  });
});

describe('describeTools', () => {
  test('reports catalog without downloading anything', () => {
    const tools = describeTools();
    assert.equal(tools.length, 3);
    for (const t of tools) {
      assert.ok(t.name && t.displayName && t.version);
      assert.equal(typeof t.installed, 'boolean');
    }
  });
});
