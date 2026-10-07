/**
 * Tests for ideas 00651–00660: dnsSecurityRecon.js and routingSecurityRecon.js.
 *
 * 00651 zone-transfer scheduling · 00652 NSEC3 opt-out · 00653 DNSSEC rollover ·
 * 00654 TLSA rotation · 00655 SSHFP rotation · 00656 BGP hijack alerts ·
 * 00657 RPKI validation · 00658 looking-glass paths · 00659 traceroute topology ·
 * 00660 MPLS inference
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  planAxfrSchedule,
  analyzeNsec3OptOut,
  monitorKeyRollover,
  trackTlsaRotation,
  monitorSshfpRotation,
} from '../src/engines/dnsSecurityRecon.js';

import {
  detectOriginHijack,
  flagRpkiInvalid,
  analyzeLgPaths,
  buildTopology,
  inferMpls,
} from '../src/engines/routingSecurityRecon.js';

// ---------------------------------------------------------------- 00651
describe('idea 00651 — planAxfrSchedule', () => {
  it('refuses to schedule when the target is not authorized', () => {
    const plan = planAxfrSchedule({
      zone: 'example.com',
      nameservers: ['ns1.example.com'],
      soaHistory: [{ serial: 1, observedAt: '2026-10-01T00:00:00Z' }],
      authorized: false,
    });
    assert.equal(plan.authorized, false);
    assert.match(plan.reason, /not marked as authorized/);
    assert.equal(plan.attempts, undefined);
  });

  it('clusters attempts around the expected serial increment', () => {
    const plan = planAxfrSchedule({
      zone: 'example.com',
      nameservers: ['ns1.example.com', 'ns2.example.com'],
      soaHistory: [
        { serial: 2026100101, observedAt: '2026-10-01T00:00:00Z' },
        { serial: 2026100102, observedAt: '2026-10-01T12:00:00Z' },
        { serial: 2026100103, observedAt: '2026-10-02T00:00:00Z' },
      ],
      authorized: true,
      asOf: '2026-10-02T00:00:00Z',
      maxAttemptsPerDay: 4,
    });
    assert.equal(plan.authorized, true);
    assert.equal(plan.avgChangeIntervalHours, 12);
    assert.equal(plan.expectedNextChangeAt, '2026-10-02T12:00:00.000Z');
    assert.equal(plan.attempts.length, 8); // 4 per nameserver
    assert.ok(plan.attempts.every((a) => a.kind === 'serial-refresh'));
    const times = plan.attempts.map((a) => new Date(a.scheduledAt).getTime());
    assert.deepEqual([...times].sort((a, b) => a - b), times, 'attempts are time-sorted');
    for (const a of plan.attempts) {
      assert.ok(Math.abs(new Date(a.scheduledAt) - new Date(plan.expectedNextChangeAt)) < 4 * 3_600_000,
        'attempt lands near the expected increment');
      assert.equal(a.maxRetries, 2);
      assert.equal(a.cooldownMinutes, 30);
    }
  });

  it('falls back to even polling when serial cadence is unknown', () => {
    const plan = planAxfrSchedule({
      zone: 'example.com',
      authorized: true,
      asOf: '2026-10-02T00:00:00Z',
      maxAttemptsPerDay: 2,
    });
    assert.equal(plan.avgChangeIntervalHours, null);
    assert.ok(plan.attempts.every((a) => a.kind === 'baseline-poll'));
  });
});

// ---------------------------------------------------------------- 00652
describe('idea 00652 — analyzeNsec3OptOut', () => {
  const zone = 'example.com';
  it('flags unsigned delegations in an opt-out zone, ordered by risk', () => {
    const r = analyzeNsec3OptOut({
      zone,
      nsec3Params: [{ algorithm: 1, flags: 1, iterations: 10, salt: 'aabb' }],
      delegations: [
        { name: 'cdn.example.com', nsTargets: ['ns1.cdnprovider.net'], hasDs: false },
        { name: 'deep.sub.example.com', nsTargets: ['ns1.example.com'], hasDs: false },
        { name: 'signed.example.com', nsTargets: ['ns1.example.com'], hasDs: true },
      ],
    });
    assert.equal(r.optOutEnabled, true);
    assert.equal(r.unsignedCount, 2);
    // deep.sub has in-bailiwick NS (+15) and depth >= 4 (+20) → 85 high
    assert.equal(r.unsignedDelegations[0].name, 'deep.sub.example.com');
    assert.equal(r.unsignedDelegations[0].severity, 'high');
    assert.ok(r.unsignedDelegations[0].risk >= 70);
    assert.ok(r.unsignedDelegations[0].reasons.length >= 2);
    assert.ok(!r.unsignedDelegations.some((d) => d.name === 'signed.example.com'), 'signed delegations are skipped');
  });

  it('reports cleanly when opt-out is not enabled', () => {
    const r = analyzeNsec3OptOut({
      zone,
      nsec3Params: [{ algorithm: 1, flags: 0, iterations: 10, salt: 'aabb' }],
      delegations: [{ name: 'cdn.example.com', hasDs: false }],
    });
    assert.equal(r.optOutEnabled, false);
    assert.equal(r.unsignedCount, 0);
    assert.match(r.summary, /not enabled/);
  });
});

// ---------------------------------------------------------------- 00653
describe('idea 00653 — monitorKeyRollover', () => {
  const zsk = (keyTag, publicKey = 'k') => ({ keyTag, algorithm: 8, flags: 256, publicKey });

  it('detects double-signature phase and completes the rollover', () => {
    const r = monitorKeyRollover({
      zone: 'example.com',
      snapshots: [
        { observedAt: '2026-10-01T00:00:00Z', dnskeys: [zsk(100)] },
        { observedAt: '2026-10-02T00:00:00Z', dnskeys: [zsk(100), zsk(200)] },
        { observedAt: '2026-10-03T00:00:00Z', dnskeys: [zsk(200)] },
      ],
    });
    const types = r.events.map((e) => e.type);
    assert.ok(types.includes('key-introduced'), 'new key introduction');
    assert.ok(types.includes('double-signature-phase'), 'overlap phase detected');
    const removal = r.events.find((e) => e.type === 'key-removed' && e.keyTag === 100);
    assert.match(removal.detail, /rollover complete/);
    assert.equal(r.gaps.length, 0, 'clean rollover has no validation gaps');
    assert.equal(r.currentKeys.length, 1);
  });

  it('flags a validation gap when the last signing key is removed', () => {
    const r = monitorKeyRollover({
      zone: 'example.com',
      snapshots: [
        { observedAt: '2026-10-01T00:00:00Z', dnskeys: [zsk(100)] },
        { observedAt: '2026-10-02T00:00:00Z', dnskeys: [] },
      ],
    });
    const gap = r.gaps.find((g) => g.type === 'validation-gap-no-zsk');
    assert.ok(gap, 'gap event exists');
    assert.equal(gap.severity, 'critical');
    assert.ok(r.gaps.some((g) => g.type === 'zone-unsigned-window'));
  });
});

// ---------------------------------------------------------------- 00654
describe('idea 00654 — trackTlsaRotation', () => {
  const rec = (data) => ({ usage: 3, selector: 1, matchingType: 1, associationData: data });

  it('detects rotations and flags DANE mismatch windows', () => {
    const r = trackTlsaRotation({
      service: '_443._tcp.example.com',
      snapshots: [
        { observedAt: '2026-10-01T00:00:00Z', records: [rec('AAAA')], servedSpki: 'AAAA' },
        { observedAt: '2026-10-02T00:00:00Z', records: [rec('BBBB')], servedSpki: 'AAAA' },
        { observedAt: '2026-10-03T00:00:00Z', records: [rec('BBBB')], servedSpki: 'BBBB' },
      ],
    });
    assert.equal(r.rotations.length, 1);
    assert.equal(r.rotations[0].kind, 'rotation');
    assert.equal(r.correlations[0].matchesPublishedTlsa, true);
    assert.equal(r.correlations[1].matchesPublishedTlsa, false);
    assert.equal(r.gaps.length, 1);
    assert.equal(r.gaps[0].type, 'dane-mismatch-window');
    assert.equal(r.gaps[0].severity, 'high');
  });
});

// ---------------------------------------------------------------- 00655
describe('idea 00655 — monitorSshfpRotation', () => {
  const rec = (algorithm, fingerprint) => ({ algorithm, fpType: 2, fingerprint });

  it('classifies a planned rotation and flags an algorithm downgrade', () => {
    const r = monitorSshfpRotation({
      hostname: 'ssh.example.com',
      snapshots: [
        { observedAt: '2026-10-01T00:00:00Z', records: [rec(4, 'aaa'), rec(1, 'bbb')] },
        { observedAt: '2026-10-08T00:00:00Z', records: [rec(4, 'ccc'), rec(1, 'bbb')] },
        { observedAt: '2026-10-15T00:00:00Z', records: [rec(1, 'bbb')] },
      ],
    });
    const rotation = r.events.find((e) => e.type === 'planned-rotation');
    assert.ok(rotation, 'rotation event exists');
    assert.equal(rotation.algorithm, 4);
    const downgrade = r.anomalies.find((a) => a.type === 'algorithm-downgrade');
    assert.ok(downgrade, 'downgrade anomaly exists');
    assert.equal(downgrade.severity, 'high');
    assert.equal(r.currentRecords.length, 1);
  });

  it('flags rapid key flapping', () => {
    const r = monitorSshfpRotation({
      hostname: 'ssh.example.com',
      snapshots: [
        { observedAt: '2026-10-01T00:00:00Z', records: [rec(4, 'aaa')] },
        { observedAt: '2026-10-01T06:00:00Z', records: [rec(4, 'bbb')] },
        { observedAt: '2026-10-01T12:00:00Z', records: [rec(4, 'ccc')] },
      ],
    });
    const flap = r.anomalies.find((a) => a.type === 'rapid-key-flap');
    assert.ok(flap, 'flap anomaly exists');
    assert.equal(flap.severity, 'medium');
  });
});

// ---------------------------------------------------------------- 00656
describe('idea 00656 — detectOriginHijack', () => {
  const mk = (originAs, collector) => ({ originAs, asPath: `100 200 ${originAs}`, collector, observedAt: '2026-10-02T00:00:00Z' });

  it('raises a high-severity hijack suspect for a widely seen new origin', () => {
    const r = detectOriginHijack({
      prefix: '203.0.113.0/24',
      baseline: { originAses: [64500] },
      announcements: [mk(64500, 'rrc00'), mk(64666, 'rrc00'), mk(64666, 'rrc01'), mk(64666, 'rrc02')],
    });
    const alert = r.alerts.find((a) => a.type === 'hijack-suspect');
    assert.ok(alert, 'hijack suspect raised');
    assert.equal(alert.originAs, 64666);
    assert.equal(alert.severity, 'high');
    assert.equal(r.allClear, false);
    assert.match(r.summary, /highest severity: high/);
  });

  it('stays quiet for baseline origins and authorized migrations', () => {
    const r = detectOriginHijack({
      prefix: '203.0.113.0/24',
      baseline: { originAses: [64500], authorizedAses: [64600] },
      announcements: [mk(64500, 'rrc00'), mk(64600, 'rrc00')],
    });
    assert.equal(r.alerts.filter((a) => a.severity !== 'info').length, 0);
    assert.equal(r.allClear, true);
    assert.ok(r.alerts.some((a) => a.type === 'authorized-migration'));
  });

  it('classifies simultaneous unexpected origins as a MOAS event', () => {
    const r = detectOriginHijack({
      prefix: '203.0.113.0/24',
      baseline: { originAses: [64500] },
      announcements: [mk(64666, 'rrc00'), mk(64677, 'rrc01')],
    });
    assert.ok(r.alerts.every((a) => a.type === 'moas-event'));
    assert.ok(r.alerts.every((a) => a.severity === 'medium'));
  });
});

// ---------------------------------------------------------------- 00657
describe('idea 00657 — flagRpkiInvalid', () => {
  const roas = [{ prefix: '203.0.113.0/24', maxLength: 24, asn: 64500 }];

  it('validates valid, invalid, and not-found announcements', () => {
    const r = flagRpkiInvalid({
      announcements: [
        { prefix: '203.0.113.0/24', originAs: 64500 },
        { prefix: '203.0.113.0/24', originAs: 64666 },
        { prefix: '198.51.100.0/24', originAs: 64500 },
        { prefix: '203.0.113.0/25', originAs: 64500 },
      ],
      roas,
    });
    const byKey = (p, o) => r.results.find((x) => x.prefix === p && x.originAs === o);
    assert.equal(byKey('203.0.113.0/24', 64500).state, 'valid');
    assert.equal(byKey('203.0.113.0/24', 64666).state, 'invalid');
    assert.match(byKey('203.0.113.0/24', 64666).reason, /hijack signature/);
    assert.equal(byKey('198.51.100.0/24', 64500).state, 'not-found');
    assert.equal(byKey('203.0.113.0/25', 64500).state, 'invalid', 'more-specific than maxLength is invalid');
    assert.equal(r.invalid.length, 2);
  });
});

// ---------------------------------------------------------------- 00658
describe('idea 00658 — analyzeLgPaths', () => {
  it('infers the primary upstream from looking-glass AS paths', () => {
    const r = analyzeLgPaths({
      prefix: '203.0.113.0/24',
      paths: [
        { lg: 'lg-eu', asPath: '100 200 300 64500' },
        { lg: 'lg-us', asPath: '101 200 300 64500' },
        { lg: 'lg-as', asPath: '102 300 64500' },
      ],
    });
    assert.equal(r.primaryUpstream, 300);
    assert.equal(r.upstreams[0].share, 1.0);
    assert.equal(r.upstreams[0].confidence, 'high');
    assert.deepEqual(r.transitAsns, [200, 300]);
    assert.equal(r.pathCount, 3);
    assert.equal(r.pathDiversity, 1.0);
    assert.equal(r.multihomed, false);
  });

  it('detects multi-homing when paths end at different origins', () => {
    const r = analyzeLgPaths({
      prefix: '203.0.113.0/24',
      paths: [
        { lg: 'lg-eu', asPath: '100 200 64500' },
        { lg: 'lg-us', asPath: '101 300 64600' },
      ],
    });
    assert.equal(r.multihomed, true);
    assert.equal(r.upstreams.length, 2);
  });
});

// ---------------------------------------------------------------- 00659
describe('idea 00659 — buildTopology', () => {
  it('merges hops across vantage points into one graph', () => {
    const r = buildTopology({
      traces: [
        { vantage: 'eu', hops: [{ ttl: 1, ip: '10.0.0.1' }, { ttl: 2, ip: '10.0.0.2' }, { ttl: 3, ip: '203.0.113.1' }] },
        { vantage: 'us', hops: [{ ttl: 1, ip: '10.1.0.1' }, { ttl: 2, ip: '10.0.0.2' }, { ttl: 3, ip: '203.0.113.1' }] },
      ],
    });
    assert.equal(r.stats.routerCount, 4, 'shared router 10.0.0.2 is one node');
    assert.equal(r.stats.vantageCount, 2);
    const shared = r.nodes.find((n) => n.ip === '10.0.0.2');
    assert.deepEqual(shared.observedBy.sort(), ['eu', 'us']);
    assert.ok(shared.degree >= 3, 'shared router has the highest degree');
    assert.equal(r.multipath.length, 0);
  });

  it('detects equal-cost multi-path', () => {
    const r = buildTopology({
      traces: [
        { vantage: 'eu', hops: [{ ttl: 1, ip: '10.0.0.1' }, { ttl: 2, ip: '10.0.0.2' }] },
        { vantage: 'eu', hops: [{ ttl: 1, ip: '10.0.0.1' }, { ttl: 2, ip: '10.0.0.3' }] },
      ],
    });
    assert.equal(r.multipath.length, 1);
    assert.deepEqual(r.multipath[0].ips.sort(), ['10.0.0.2', '10.0.0.3']);
  });
});

// ---------------------------------------------------------------- 00660
describe('idea 00660 — inferMpls', () => {
  it('decodes explicit RFC 4950 label stacks with high confidence', () => {
    const r = inferMpls({
      traces: [{
        vantage: 'eu',
        hops: [
          { ttl: 1, ip: '10.0.0.1' },
          {
            ttl: 2, ip: '10.0.0.2',
            labelStack: [
              { label: 16001, exp: 0, s: 0, ttl: 254 },
              { label: 3, exp: 0, s: 1, ttl: 254 },
            ],
          },
        ],
      }],
    });
    assert.equal(r.mplsLikely, true);
    assert.equal(r.confidence, 'high');
    assert.equal(r.labelStacks[0].depth, 2);
    assert.ok(r.labelStacks[0].bottomOfStack);
    assert.ok(r.indicators.some((i) => i.type === 'explicit-label-stack' && /implicit-null/.test(i.detail)));
  });

  it('infers MPLS from TTL-propagation gaps with medium confidence', () => {
    const r = inferMpls({
      traces: [{
        vantage: 'eu',
        hops: [
          { ttl: 1, ip: '10.0.0.1' },
          { ttl: 4, ip: '10.0.0.9' },
        ],
      }],
    });
    assert.equal(r.mplsLikely, true);
    assert.equal(r.confidence, 'medium');
    assert.ok(r.indicators.some((i) => i.type === 'ttl-propagation-gap' && /2 hidden hop/.test(i.detail)));
  });

  it('reports no MPLS when traces are clean', () => {
    const r = inferMpls({
      traces: [{
        vantage: 'eu',
        hops: [{ ttl: 1, ip: '10.0.0.1' }, { ttl: 2, ip: '10.0.0.2' }, { ttl: 3, ip: '10.0.0.3' }],
      }],
    });
    assert.equal(r.mplsLikely, false);
    assert.equal(r.confidence, 'low');
  });
});
