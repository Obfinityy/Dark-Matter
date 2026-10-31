/**
 * Tests for container init (zombie reaping) fix (1 Nov 2026)
 *
 * Root cause: Hunt containers used 'sleep infinity' as PID 1, which never
 * calls wait(), causing XFCE desktop children to accumulate as zombies.
 * Fix: Add --init flag to use tini as PID 1, which reaps zombies.
 *
 * Evidence: 514 zombies on EC2 (31 Oct 2026), parents were sleep infinity PIDs.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHuntContainerRunArgs } from './huntRunner.js';

describe('Container Init (Zombie Prevention)', () => {
  it('includes --init flag to use tini as PID 1', () => {
    const args = buildHuntContainerRunArgs('h_test123', 'http://example.com', {});
    assert.ok(args.includes('--init'), 'Should include --init flag');
  });

  it('--init comes before image name', () => {
    const args = buildHuntContainerRunArgs('h_test123', 'http://example.com', {});
    const initIdx = args.indexOf('--init');
    // Image is the last arg
    assert.ok(initIdx > 0 && initIdx < args.length - 1, '--init should be before image');
  });

  it('works with egress options', () => {
    const args = buildHuntContainerRunArgs('h_test123', 'http://example.com', {
      egressProxy: { gatewayIp: '10.0.0.1', proxyPort: 8080 },
    });
    assert.ok(args.includes('--init'), 'Should include --init with egress');
  });
});
