/**
 * identifierRecon.test.js — tests for the identifier-scheme + state-machine
 * reconnaissance engine (idea-bank ideas 1261-1270).
 *
 * Run: node --test backend/src/engines/identifierRecon.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE1261_COVERAGE,
  ideaFunctions,
  evaluateUuidStrictness,
  mapIdFormats,
  mapSlugToIdResolution,
  analyzeNumericIdPredictability,
  extractUlidTimestamp,
  analyzeObjectIdComponents,
  attemptHashidDecode,
  analyzeBase64IdIntegrity,
  mapHypermediaTransitions,
  assessTransitionGuards,
} from './identifierRecon.js';

describe('module registry', () => {
  it('covers ideas 1261-1270', () => {
    assert.deepEqual(WAVE1261_COVERAGE, [1261, 1262, 1263, 1264, 1265, 1266, 1267, 1268, 1269, 1270]);
  });

  it('maps every idea to its function', () => {
    const map = ideaFunctions();
    assert.equal(Object.keys(map).length, 10);
    assert.equal(map[1261], 'evaluateUuidStrictness');
    assert.equal(map[1270], 'assessTransitionGuards');
  });
});

describe('1261 evaluateUuidStrictness', () => {
  it('PASS when every probe is rejected', () => {
    const r = evaluateUuidStrictness({
      rejectedMalformed: true, rejectedNonV4: true, rejectedNil: true, rejectedVersionMarker: true,
    });
    assert.equal(r.verdict, 'PASS');
    assert.equal(r.score, 100);
    assert.ok(r.findings.length > 0);
  });

  it('FAIL when malformed UUIDs are accepted', () => {
    const r = evaluateUuidStrictness({ rejectedMalformed: false, rejectedNil: false });
    assert.equal(r.verdict, 'FAIL');
    assert.ok(r.score < 50);
    assert.ok(r.findings.some((f) => /malformed/i.test(f)));
  });

  it('WEAK when only the format check is lax', () => {
    const r = evaluateUuidStrictness({ rejectedMalformed: false });
    assert.equal(r.verdict, 'WEAK');
    assert.equal(r.score, 50);
  });
});

describe('1262 mapIdFormats', () => {
  it('maps a single accepted format with no reveal', () => {
    const r = mapIdFormats([{ resource: '/orders', accepted: { uuid: true } }]);
    assert.deepEqual(r.formats['/orders'], ['uuid']);
    assert.equal(r.schemeReveals, 0);
  });

  it('flags resources accepting multiple formats', () => {
    const r = mapIdFormats([{ resource: '/orders', accepted: { numeric: true, uuid: true, slug: true } }]);
    assert.equal(r.schemeReveals, 1);
    assert.ok(r.findings.some((f) => /multiple identifier formats/i.test(f)));
  });

  it('flags docs that underspecify the real surface', () => {
    const r = mapIdFormats([{ resource: '/orders', accepted: { numeric: true }, docsClaim: 'uuid' }]);
    assert.ok(r.findings.some((f) => /underspecify/i.test(f)));
  });
});

describe('1263 mapSlugToIdResolution', () => {
  it('PASS on authz parity', () => {
    const r = mapSlugToIdResolution([
      { slugPath: '/p/blue-widget', idPath: '/products/42', slugAuthz: 'denied', idAuthz: 'denied' },
    ]);
    assert.equal(r.verdict, 'PASS');
    assert.equal(r.mismatches, 0);
  });

  it('FAIL when the slug path skips ID-path authz', () => {
    const r = mapSlugToIdResolution([
      { slugPath: '/p/blue-widget', idPath: '/products/42', slugAuthz: 'allowed', idAuthz: 'denied' },
    ]);
    assert.equal(r.verdict, 'FAIL');
    assert.equal(r.mismatches, 1);
    assert.ok(r.findings.some((f) => /skip the authz/i.test(f)));
  });
});

describe('1264 analyzeNumericIdPredictability', () => {
  it('FAIL on sequential IDs', () => {
    const r = analyzeNumericIdPredictability([101, 102, 103, 104]);
    assert.equal(r.verdict, 'FAIL');
    assert.equal(r.stats.sequentialPairs, 3);
    assert.equal(r.stats.monotonic, true);
  });

  it('PASS on large unpredictable gaps', () => {
    const r = analyzeNumericIdPredictability([100, 5000, 9000]);
    assert.equal(r.verdict, 'PASS');
    assert.equal(r.stats.maxGap, 4900);
  });

  it('WEAK on small enumerable gaps', () => {
    const r = analyzeNumericIdPredictability([100, 150, 200]);
    assert.equal(r.verdict, 'WEAK');
    assert.ok(r.findings.some((f) => /enumerat/i.test(f)));
  });
});

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function ulidWithTime(tsMs) {
  let n = tsMs;
  let time = '';
  for (let i = 0; i < 10; i += 1) {
    time = CROCKFORD[n % 32] + time;
    n = Math.floor(n / 32);
  }
  return time + '0'.repeat(16);
}

describe('1265 extractUlidTimestamp', () => {
  it('decodes the timestamp from a valid ULID', () => {
    const r = extractUlidTimestamp(['01ARZ3NDEKTSV4RRFFQ69G5FAV']);
    assert.equal(r.decoded.length, 1);
    assert.ok(r.decoded[0].timestampMs > 0);
    assert.ok(!Number.isNaN(Date.parse(r.decoded[0].iso)));
  });

  it('detects creation ordering across ULIDs', () => {
    const a = ulidWithTime(1_700_000_000_000);
    const b = ulidWithTime(1_700_000_060_000);
    const r = extractUlidTimestamp([a, b]);
    assert.equal(r.orderedByCreation, true);
    assert.equal(r.timeSpanMs, 60_000);
    assert.ok(r.findings.some((f) => /creation order/i.test(f)));
  });

  it('reports undecodable input', () => {
    const r = extractUlidTimestamp(['not-a-ulid']);
    assert.equal(r.decoded.length, 0);
    assert.ok(r.findings.some((f) => /not a valid ULID/i.test(f)));
  });
});

describe('1266 analyzeObjectIdComponents', () => {
  it('parses timestamp, machine, pid and counter', () => {
    const r = analyzeObjectIdComponents(['507f1f77bcf86cd799439011']);
    assert.equal(r.parsed.length, 1);
    const p = r.parsed[0];
    assert.equal(p.createdAt, '2012-10-17T21:13:27.000Z');
    assert.equal(p.machineId, 'bcf86c');
    assert.equal(p.processId, 'd799');
    assert.equal(p.counter, 0x439011);
  });

  it('fingerprints a single-host deployment', () => {
    const r = analyzeObjectIdComponents(['507f1f77bcf86cd799439011', '507f1f78bcf86cd799439012']);
    assert.deepEqual(r.machineIds, ['bcf86c']);
    assert.ok(r.findings.some((f) => /single-host/i.test(f)));
  });

  it('skips malformed input with a finding', () => {
    const r = analyzeObjectIdComponents(['xyz']);
    assert.equal(r.parsed.length, 0);
    assert.ok(r.findings.some((f) => /not a 24-hex-char ObjectId/i.test(f)));
  });
});

describe('1267 attemptHashidDecode', () => {
  it('decodes a default-config Hashid (obfuscation, not protection)', () => {
    const r = attemptHashidDecode('jR', []);
    assert.equal(r.decodable, true);
    assert.deepEqual(r.decoded, [1]);
    assert.equal(r.verdict, 'FAIL');
    assert.equal(r.usedConfig, 'default (empty salt)');
  });

  it('decodes the well-known example-salt vector (obfuscation, not protection)', () => {
    // 'NkK9' is the canonical Hashids example encoding of 12345 with the
    // publicly documented example salt 'this is my salt'.
    const r = attemptHashidDecode('NkK9', []);
    assert.equal(r.decodable, true);
    assert.deepEqual(r.decoded, [12345]);
    assert.equal(r.usedConfig, "well-known example salt 'this is my salt'");
    assert.equal(r.verdict, 'FAIL');
  });

  it('rejects alphabet-valid lookalikes via round-trip verification', () => {
    const r = attemptHashidDecode('gYbYNNqM6', []);
    assert.equal(r.decodable, false);
    assert.equal(r.verdict, 'PASS');
  });

  it('rejects non-alphabet input', () => {
    const r = attemptHashidDecode('not-a-hashid!!!', []);
    assert.equal(r.decodable, false);
    assert.equal(r.usedConfig, null);
  });
});

describe('1268 analyzeBase64IdIntegrity', () => {
  const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

  it('FAIL on structured JSON with no integrity field', () => {
    const r = analyzeBase64IdIntegrity(b64(JSON.stringify({ id: 42, role: 'user' })));
    assert.equal(r.decodable, true);
    assert.equal(r.kind, 'json');
    assert.equal(r.hasIntegrityField, false);
    assert.equal(r.verdict, 'FAIL');
  });

  it('PASS on JSON carrying a signature field', () => {
    const r = analyzeBase64IdIntegrity(b64(JSON.stringify({ id: 42, sig: 'abc123' })));
    assert.equal(r.hasIntegrityField, true);
    assert.equal(r.verdict, 'PASS');
  });

  it('WEAK on plaintext and PASS on opaque bytes', () => {
    assert.equal(analyzeBase64IdIntegrity(b64('hello world')).verdict, 'WEAK');
    assert.equal(analyzeBase64IdIntegrity('!!!not-base64!!!').kind, 'invalid');
  });
});

describe('1269 mapHypermediaTransitions', () => {
  it('flags late-stage actions exposed from early states', () => {
    const r = mapHypermediaTransitions([
      { state: 'created', allowedActions: ['cancel', 'ship'] },
      { state: 'shipped', allowedActions: [], terminal: true },
    ]);
    assert.deepEqual(r.transitions.created, ['cancel', 'ship']);
    assert.equal(r.skippableSteps.length, 1);
    assert.equal(r.skippableSteps[0].action, 'ship');
  });

  it('flags actions on terminal states', () => {
    const r = mapHypermediaTransitions([{ state: 'delivered', allowedActions: ['refund'], terminal: true }]);
    assert.ok(r.findings.some((f) => /Terminal state/i.test(f)));
  });

  it('builds a clean map with no findings when nothing is skippable', () => {
    const r = mapHypermediaTransitions([
      { state: 'created', allowedActions: ['pay', 'cancel'] },
      { state: 'paid', allowedActions: ['ship'] },
    ]);
    assert.equal(r.skippableSteps.length, 0);
    assert.deepEqual(Object.keys(r.transitions), ['created', 'paid']);
  });
});

describe('1270 assessTransitionGuards', () => {
  it('FAIL when a jump succeeds outside the documented API', () => {
    const r = assessTransitionGuards([
      { from: 'created', to: 'shipped', via: 'ui-only', result: 'allowed' },
    ]);
    assert.equal(r.verdict, 'FAIL');
    assert.equal(r.bypasses, 1);
    assert.ok(r.findings.some((f) => /client-side only/i.test(f)));
  });

  it('PASS when every out-of-band jump is rejected', () => {
    const r = assessTransitionGuards([
      { from: 'created', to: 'shipped', via: 'direct-call', result: 'rejected' },
      { from: 'paid', to: 'delivered', via: 'ui-only', result: 'rejected' },
    ]);
    assert.equal(r.verdict, 'PASS');
    assert.equal(r.guardCoverage, 1);
  });

  it('handles empty observations gracefully', () => {
    const r = assessTransitionGuards([]);
    assert.equal(r.bypasses, 0);
    assert.ok(r.findings.some((f) => /cannot be assessed/i.test(f)));
  });
});
