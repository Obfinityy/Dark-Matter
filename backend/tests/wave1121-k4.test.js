/**
 * Tests for paginationBatchRecon.js — ideas 01151–01160.
 * Executed directly with `node backend/tests/wave1121-k4.test.js`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  caseVariantPath,
  buildPathCasingBypassProbes,
  classifyPathCasingResponses,
  buildQueryJunkBypassProbes,
  classifyQueryJunkResponses,
  buildPaginationAbuseProbes,
  classifyPaginationAbuseResponses,
  buildOffsetOverflowProbes,
  classifyOffsetOverflowResponses,
  decodeCursorToken,
  analyzeCursorToken,
  extractAndAnalyzeCursors,
  extractTotalCountDisclosure,
  totalCountDisclosureFinding,
  listBatchEndpointCandidates,
  buildBatchDiscoveryProbes,
  classifyBatchDiscoveryResponses,
  buildMixedOperationBatchProbes,
  classifyMixedOperationResponses,
  analyzeBatchPartialFailures,
  buildPartialFailureOracleBatch,
  listWebhookReceiverCandidates,
  buildWebhookReceiverProbes,
  classifyWebhookReceiverResponses,
  paginationBatchReconFinding,
  PAGINATION_BATCH_RECON,
  IDEA_TECHNIQUES,
} from '../src/engines/paginationBatchRecon.js';

describe('idea registry coverage (01151–01160)', () => {
  it('maps every idea number 1151–1160 to a technique function', () => {
    for (let n = 1151; n <= 1160; n += 1) {
      assert.equal(typeof IDEA_TECHNIQUES[n], 'function', `idea ${n} missing from IDEA_TECHNIQUES`);
    }
    assert.equal(Object.keys(IDEA_TECHNIQUES).length, 10);
  });

  it('PAGINATION_BATCH_RECON exports every technique', () => {
    for (const fn of Object.values(IDEA_TECHNIQUES)) {
      assert.ok(Object.values(PAGINATION_BATCH_RECON).includes(fn));
    }
  });
});

describe('01151 — path casing bypass', () => {
  it('generates case variants of path segments', () => {
    assert.equal(caseVariantPath('/api/v1/users', 'upper'), '/API/V1/USERS');
    assert.equal(caseVariantPath('/Api/V1/Users', 'lower'), '/api/v1/users');
    assert.equal(caseVariantPath('/api/users', 'first-upper'), '/Api/Users');
    const alt = caseVariantPath('/api', 'alternating');
    assert.equal(alt, '/ApI');
  });

  it('builds one probe per variant per path', () => {
    const probes = buildPathCasingBypassProbes(['/api/v1/users'], { variants: ['upper', 'lower'] });
    assert.equal(probes.length, 2);
    assert.equal(probes[0].path, '/API/V1/USERS');
    assert.ok(probes.every((p) => p.method === 'GET' && p.detect.length > 0));
  });

  it('flags independent quotas when a cased variant succeeds after a 429', () => {
    const out = classifyPathCasingResponses([
      { path: '/api/v1/users', logicalPath: '/api/v1/users', variant: 'lower', status: 429 },
      { path: '/API/V1/USERS', logicalPath: '/api/v1/users', variant: 'upper', status: 200 },
    ]);
    assert.equal(out.independentQuotas, true);
    assert.equal(out.findings.length, 1);
    assert.ok(out.findings[0].evidence.includes('raw path'));
  });

  it('stays quiet when no split behavior is observed', () => {
    const out = classifyPathCasingResponses([
      { path: '/api/v1/users', logicalPath: '/api/v1/users', variant: 'lower', status: 200 },
      { path: '/API/V1/USERS', logicalPath: '/api/v1/users', variant: 'upper', status: 200 },
    ]);
    assert.equal(out.independentQuotas, false);
    assert.equal(out.findings.length, 0);
  });
});

describe('01152 — query junk bypass', () => {
  it('appends distinct junk query params per variant', () => {
    const probes = buildQueryJunkBypassProbes(['/api/v1/search'], { variants: 3 });
    assert.equal(probes.length, 3);
    const signatures = probes.map((p) => `${p.path}?${Object.keys(p.query)[0]}=${Object.values(p.query)[0]}`);
    assert.equal(new Set(signatures).size, 3, 'each junk variant must produce a distinct URL shape');
  });

  it('each variant carries a non-empty query string token', () => {
    const probes = buildQueryJunkBypassProbes(['/api/v1/search'], { variants: 2 });
    for (const p of probes) {
      assert.equal(Object.keys(p.query).length, 1);
      assert.ok(Object.values(p.query)[0].length >= 8);
    }
  });

  it('detects quota reset when junk variants succeed after a plain 429', () => {
    const out = classifyQueryJunkResponses([
      { path: '/api/v1/search', queryJunk: false, status: 429 },
      { path: '/api/v1/search', queryJunk: true, status: 200 },
    ]);
    assert.equal(out.resetsQuota, true);
    assert.equal(out.findings.length, 1);
  });

  it('does not flag when plain requests never hit 429', () => {
    const out = classifyQueryJunkResponses([{ path: '/a', queryJunk: false, status: 200 }]);
    assert.equal(out.resetsQuota, false);
  });
});

describe('01153 — pagination abuse sweep', () => {
  it('covers negative/zero/huge/string pagination values', () => {
    const probes = buildPaginationAbuseProbes(['/api/v1/items']);
    assert.ok(probes.length >= 8);
    const labels = probes.map((p) => p.label);
    assert.ok(labels.some((l) => l.includes('negative-page')));
    assert.ok(labels.some((l) => l.includes('page-zero')));
    assert.ok(labels.some((l) => l.includes('huge-limit')));
  });

  it('flags server errors and unenforced bounds', () => {
    const out = classifyPaginationAbuseResponses([
      { endpoint: '/api/v1/items', caseName: 'page-zero', status: 500 },
      { endpoint: '/api/v1/items', caseName: 'negative-page', status: 200, body: { items: [1, 2], total: 2 } },
      { endpoint: '/api/v1/items', caseName: 'limit-string', status: 400 },
    ]);
    assert.ok(out.serverErrors.includes('/api/v1/items:page-zero'));
    assert.ok(out.missingBounds.includes('/api/v1/items:negative-page'));
    assert.equal(out.findings.length, 2);
  });
});

describe('01154 — offset overflow', () => {
  it('builds extreme-offset probes', () => {
    const probes = buildOffsetOverflowProbes(['/api/v1/items']);
    assert.ok(probes.length >= 4);
    assert.ok(probes.every((p) => Number.isFinite(Number(p.query.offset))));
  });

  it('detects wraparound when the first row matches the baseline', () => {
    const out = classifyOffsetOverflowResponses([
      { endpoint: '/api/v1/items', offset: 2147483647, status: 200, body: { items: [{ id: 1 }] }, baselineFirstRow: { id: 1 } },
      { endpoint: '/api/v1/items', offset: 4294967296, status: 500 },
    ]);
    assert.equal(out.wrapArounds.length, 1);
    assert.equal(out.errors.length, 1);
    assert.equal(out.findings.length, 2);
  });
});

describe('01155 — cursor token decode', () => {
  it('decodes base64 cursors and spots embedded IDs/timestamps', () => {
    const raw = JSON.stringify({ id: 'user-123', created: '2026-01-01T00:00:00' });
    const cursor = Buffer.from(raw, 'utf8').toString('base64');
    const a = analyzeCursorToken(cursor);
    assert.equal(a.decoded, true);
    assert.equal(a.encoding, 'base64');
    assert.equal(a.signals.hasRawId, true);
    assert.equal(a.signals.hasTimestamp, true);
    assert.equal(a.sensitive, true);
    assert.equal(a.findings.length, 1);
  });

  it('flags SQL fragments inside cursors', () => {
    const cursor = Buffer.from('SELECT * FROM users ORDER BY id LIMIT 10', 'utf8').toString('base64');
    const a = analyzeCursorToken(cursor);
    assert.equal(a.signals.hasSqlFragment, true);
    assert.equal(a.sensitive, true);
  });

  it('handles url-safe and double-encoded tokens', () => {
    const inner = Buffer.from('{"offset":50}', 'utf8').toString('base64url');
    const outer = Buffer.from(inner, 'utf8').toString('base64');
    const d = decodeCursorToken(outer);
    assert.equal(d.decoded, true);
    assert.equal(d.layers, 2);
    assert.ok(d.text.includes('offset'));
  });

  it('leaves opaque tokens undecoded', () => {
    const a = analyzeCursorToken('!!!not-base64!!!');
    assert.equal(a.decoded, false);
    assert.equal(a.sensitive, false);
  });

  it('scans response bodies for cursor fields', () => {
    const cursor = Buffer.from('{"id":"abc-1"}', 'utf8').toString('base64');
    const { cursors, sensitiveCount } = extractAndAnalyzeCursors({ nextCursor: cursor, data: [1] });
    assert.equal(cursors.length, 1);
    assert.equal(sensitiveCount, 1);
    assert.ok(cursors[0].field.includes('nextCursor'));
  });
});

describe('01156 — total count disclosure', () => {
  it('extracts total/hits fields from nested bodies', () => {
    const out = extractTotalCountDisclosure({ items: [], meta: { total: 4521, page: 1 } });
    assert.equal(out.disclosed, true);
    assert.equal(out.maxTotal, 4521);
    assert.ok(out.fields.some((f) => f.path === 'meta.total'));
  });

  it('reports nothing when no totals are present', () => {
    const out = extractTotalCountDisclosure({ items: [1, 2] });
    assert.equal(out.disclosed, false);
    assert.equal(totalCountDisclosureFinding('/x', out), null);
  });

  it('builds a finding when totals are disclosed', () => {
    const extraction = extractTotalCountDisclosure({ totalHits: 9000 });
    const f = totalCountDisclosureFinding('/api/v1/search', extraction);
    assert.ok(f);
    assert.ok(f.evidence.includes('9000'));
    assert.ok(f.recommendation.length > 0);
  });
});

describe('01157 — batch endpoint discovery', () => {
  it('lists candidate batch paths', () => {
    const list = listBatchEndpointCandidates();
    assert.ok(list.includes('/batch'));
    assert.ok(list.includes('/bulk'));
    assert.ok(list.includes('/multi'));
    assert.ok(list.includes('/compose'));
    assert.ok(list.length >= 10);
  });

  it('builds OPTIONS + POST discovery probes per candidate', () => {
    const probes = buildBatchDiscoveryProbes({ extra: ['/test-batch'] });
    assert.ok(probes.some((p) => p.path === '/test-batch' && p.method === 'OPTIONS'));
    assert.ok(probes.some((p) => p.path === '/batch' && p.method === 'POST'));
  });

  it('classifies live vs dead batch endpoints', () => {
    const out = classifyBatchDiscoveryResponses([
      { path: '/batch', method: 'POST', status: 207, body: { responses: [{ status: 200 }] } },
      { path: '/bulk', method: 'GET', status: 404 },
      { path: '/multi', method: 'POST', status: 403 },
    ]);
    assert.deepEqual(out.live, ['/batch']);
    assert.deepEqual(out.dead, ['/bulk']);
    assert.deepEqual(out.maybe, ['/multi']);
    assert.equal(out.findings.length, 1);
  });
});

describe('01158 — mixed-operation batch abuse', () => {
  it('builds GET+DELETE mixed batch bodies', () => {
    const probes = buildMixedOperationBatchProbes('/batch');
    assert.ok(probes.length >= 2);
    const del = probes.find((p) => p.label.includes('DELETE-after-get'));
    assert.ok(del);
    assert.equal(del.body.requests[0].method, 'GET');
    assert.equal(del.body.requests[1].method, 'DELETE');
  });

  it('flags weaker per-item authorization inside batches', () => {
    const out = classifyMixedOperationResponses([
      { batchPath: '/batch', item: { method: 'DELETE', path: '/api/v1/users/9' }, batchStatus: 200, standaloneStatus: 403 },
      { batchPath: '/batch', item: { method: 'GET', path: '/api/v1/users/me' }, batchStatus: 200, standaloneStatus: 200 },
    ]);
    assert.equal(out.weakerInBatch.length, 1);
    assert.equal(out.findings.length, 1);
    assert.ok(out.findings[0].evidence.includes('per-item authorization'));
  });

  it('returns nothing for an empty batch path', () => {
    assert.deepEqual(buildMixedOperationBatchProbes(''), []);
  });
});

describe('01159 — partial-failure oracle', () => {
  it('maps per-item verdicts and spots split boundaries', () => {
    const out = analyzeBatchPartialFailures([
      {
        batchPath: '/batch',
        items: [
          { method: 'GET', path: '/api/v1/admin', status: 200 },
          { method: 'DELETE', path: '/api/v1/admin', status: 403 },
          { method: 'GET', path: '/api/v1/public', status: 200 },
        ],
      },
    ]);
    assert.equal(out.boundaryMap.length, 3);
    assert.equal(out.allowed.length, 2);
    assert.equal(out.denied.length, 1);
    assert.equal(out.findings.length, 1); // split verdict on /api/v1/admin
    assert.ok(out.findings[0].evidence.includes('split verdicts'));
  });

  it('builds an oracle batch body matrix', () => {
    const body = buildPartialFailureOracleBatch(['/a', '/b'], { methods: ['GET', 'DELETE'] });
    assert.equal(body.requests.length, 4);
    assert.ok(body.requests.some((r) => r.method === 'DELETE' && r.path === '/a'));
  });
});

describe('01160 — webhook receiver discovery', () => {
  it('lists webhook receiver candidates', () => {
    const list = listWebhookReceiverCandidates();
    assert.ok(list.includes('/webhooks'));
    assert.ok(list.includes('/hooks'));
    assert.ok(list.includes('/callbacks'));
  });

  it('builds GET + unsigned-POST probes without forged signatures', () => {
    const probes = buildWebhookReceiverProbes();
    const unsigned = probes.filter((p) => p.label.includes('unsigned-post'));
    assert.ok(unsigned.length > 0);
    assert.ok(unsigned.every((p) => p.method === 'POST'));
    assert.ok(unsigned.every((p) => !JSON.stringify(p.body).toLowerCase().includes('signature')));
  });

  it('flags receivers that accept unsigned posts', () => {
    const out = classifyWebhookReceiverResponses([
      { path: '/webhooks', method: 'GET', status: 200 },
      { path: '/webhooks', method: 'POST', status: 200, body: { ok: true } },
      { path: '/hooks', method: 'GET', status: 404 },
      { path: '/callbacks', method: 'GET', status: 200 },
      { path: '/callbacks', method: 'POST', status: 401, body: 'invalid signature' },
    ]);
    assert.deepEqual(out.unverified, ['/webhooks']);
    assert.deepEqual(out.verified, ['/callbacks']);
    assert.ok(!out.receivers.some((r) => r.path === '/hooks'));
    const unsignedFinding = out.findings.find((f) => f.title.includes('unsigned'));
    assert.ok(unsignedFinding);
    assert.equal(unsignedFinding.confidence, 'high');
  });
});

describe('report helper', () => {
  it('builds a uniform finding with recommendation fallback', () => {
    const f = paginationBatchReconFinding({ title: 'x', evidence: 'e', targets: ['/a'] });
    assert.ok(f.title.startsWith('Pagination/batch recon —'));
    assert.equal(f.severity, 'Info');
    assert.ok(f.recommendation.includes('cursor'));
  });
});
