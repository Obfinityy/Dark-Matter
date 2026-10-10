/**
 * queryOperatorRecon.test.js — tests for queryOperatorRecon.js (ideas 01226–01230).
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  responseSignature,
  signaturesDiffer,
  buildSearchOperatorProbe,
  analyzeSearchOperators,
  buildFilterOperatorProbe,
  analyzeFilterOperators,
  buildSortFieldProbe,
  analyzeSortFields,
  buildSparseFieldsetProbe,
  analyzeSparseFieldsets,
  buildIncludeExpansionProbe,
  analyzeIncludeExpansion,
  queryOperatorSummary,
} from './queryOperatorRecon.js';

const base = { status: 200, headers: {}, body: JSON.stringify({ data: [{ id: 1, name: 'a' }] }) };
const changed = {
  status: 200,
  headers: {},
  body: JSON.stringify({ data: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] }),
};

test('signatures: baseline vs probe differential', () => {
  const b = responseSignature(base);
  assert.equal(b.count, 1);
  assert.deepEqual(signaturesDiffer(b, responseSignature(base)).changed, false);
  const d = signaturesDiffer(b, responseSignature(changed));
  assert.equal(d.changed, true);
  assert.ok(d.differences.some((x) => x.includes('count')));
});

test('1226: discovers live search parameters', () => {
  assert.ok(buildSearchOperatorProbe().probes.length >= 16);
  const r = analyzeSearchOperators({
    baseline: base,
    probes: [
      { param: 'q', value: 'infinity', response: changed },
      { param: 'keyword', value: 'infinity', response: base },
    ],
  });
  assert.equal(r.verdict, 'operators-found');
  assert.equal(r.discovered.length, 1);
  assert.equal(r.discovered[0].param, 'q');
  const none = analyzeSearchOperators({
    baseline: base,
    probes: [{ param: 'q', value: 'x', response: base }],
  });
  assert.equal(none.verdict, 'none');
});

test('1227: maps filter operator surface and flags risk signals', () => {
  assert.ok(buildFilterOperatorProbe('name').probes.length >= 10);
  const r = analyzeFilterOperators({
    baseline: base,
    probes: [
      { param: 'name[regex]', value: '^inf', response: changed },
      { param: 'name[gt]', value: 'a', response: base },
    ],
  });
  assert.equal(r.verdict, 'operators-supported');
  assert.equal(r.supported.length, 1);
  assert.ok(r.riskSignals.includes('name[regex]'));
});

test('1228: enumerates sortable fields', () => {
  assert.ok(buildSortFieldProbe().probes.length >= 16);
  const r = analyzeSortFields({
    baseline: base,
    probes: [
      { param: 'sort', value: 'name', response: changed },
      { param: 'sort', value: '-email', response: base },
    ],
  });
  assert.equal(r.verdict, 'columns-confirmed');
  assert.ok(r.sortable.includes('name'));
  assert.ok(!r.sortable.includes('email'));
});

test('1229: detects sparse-fieldset support', () => {
  const narrow = { status: 200, headers: {}, body: JSON.stringify({ data: [{ id: 1, name: 'a' }] }) };
  const wide = {
    status: 200,
    headers: {},
    body: JSON.stringify({ data: [{ id: 1, name: 'a', email: 'x@y.z', ssn: '1' }] }),
  };
  assert.ok(buildSparseFieldsetProbe(['id', 'name']).probes.length >= 4);
  const r = analyzeSparseFieldsets({
    baseline: wide,
    requestedFields: ['id', 'name'],
    probes: [
      { params: { fields: 'id,name' }, response: narrow },
      { params: { select: 'id,name' }, response: wide },
    ],
  });
  assert.equal(r.verdict, 'fieldsets-supported');
  assert.equal(r.harvestable, true);
  assert.equal(r.supportedSyntax.length, 1);
});

test('1230: measures include-expansion depth ceiling', () => {
  assert.equal(buildIncludeExpansionProbe(['author'], 3).probes.length, 3);
  const r = analyzeIncludeExpansion({
    probes: [
      { depth: 1, value: 'author', response: { status: 200, headers: {}, body: JSON.stringify({ data: { author: { id: 9 } } }) } },
      { depth: 2, value: 'author.comments', response: { status: 200, headers: {}, body: JSON.stringify({ data: { author: { comments: { id: 2 } } } }) } },
      { depth: 3, value: 'author.comments.profile', response: { status: 200, headers: {}, body: JSON.stringify({ data: { author: { comments: { profile: { id: 1 } } } } }) } },
      { depth: 4, value: 'author.comments.profile.x', response: { status: 200, headers: {}, body: JSON.stringify({ data: { id: 1 } }) } },
    ],
  });
  assert.equal(r.maxDepth, 3);
  assert.equal(r.verdict, 'deep-expansion');
  const none = analyzeIncludeExpansion({
    probes: [{ depth: 1, value: 'author', response: { status: 200, headers: {}, body: JSON.stringify({ data: { id: 1 } }) } }],
  });
  assert.equal(none.verdict, 'none');
  assert.equal(typeof queryOperatorSummary({ findings: [] }), 'string');
});
