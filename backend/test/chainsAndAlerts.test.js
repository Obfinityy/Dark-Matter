/**
 * Chain builder + alert hook tests.
 *
 * Vulnerability chaining: the brain can propose multi-finding attack chains,
 * but a chain is only FILED after strict validation — every referenced
 * finding must exist, belong to THIS hunt, and be CONFIRMED. Severity
 * escalates to the highest component severity. Garbage in → rejected loudly,
 * never silently filed.
 *
 * Alert hooks: critical findings and hunt completion notify the user's
 * alerts inbox via AlertService.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryDatabase } from '../src/models/database.js';
import { buildBrainChain, suggestChains } from '../src/services/chainService.js';
import { AlertService } from '../src/services/alertService.js';
import { AlertModel } from '../src/models/alertModel.js';

const JOB_ID = 'job_chain_1';
const confirmed = (id, severity, category) => ({
  id, jobId: JOB_ID, assessmentId: 'a1', status: 'confirmed',
  severity, category, title: `${category} on /page`, endpoint: '/page',
  reproductionSteps: [`step for ${id}`]
});

function findingsById(list) {
  return new Map(list.map((f) => [f.id, f]));
}

test('buildBrainChain: files a validated chain with escalated severity', async () => {
  const f1 = confirmed('f1', 'medium', 'xss');
  const f2 = confirmed('f2', 'high', 'missing-csp');
  const chain = buildBrainChain({
    jobId: JOB_ID,
    chain: { chainOf: ['f1', 'f2'], title: 'XSS via missing CSP' },
    findingsById: findingsById([f1, f2])
  });
  assert.equal(chain.category, 'vulnerability-chain');
  // The chain-escalation principle: a working chain is rated ONE rank above
  // its strongest link (medium + high → critical), because combined impact
  // exceeds any single component.
  assert.equal(chain.severity, 'critical', 'chain escalates one rank above the strongest link');
  assert.equal(chain.title, 'XSS via missing CSP');
  assert.deepEqual(chain.metadata.chainOf, ['f1', 'f2']);
  assert.ok(chain.reproductionSteps.length >= 2, 'reproduction steps merge from components');
  assert.ok(chain.impact.includes('CRITICAL'));
});

test('buildBrainChain: rejects unknown / cross-hunt / unconfirmed findings', async () => {
  const f1 = confirmed('f1', 'medium', 'xss');
  const byId = findingsById([f1]);

  // Unknown id
  assert.throws(
    () => buildBrainChain({ jobId: JOB_ID, chain: { chainOf: ['f1', 'nope'] }, findingsById: byId }),
    /unknown finding/
  );
  // Cross-hunt reference
  const foreign = { ...confirmed('fx', 'high', 'sqli'), jobId: 'other_job' };
  assert.throws(
    () => buildBrainChain({ jobId: JOB_ID, chain: { chainOf: ['f1', 'fx'] }, findingsById: findingsById([f1, foreign]) }),
    /another hunt/
  );
  // Unconfirmed finding
  const draft = { ...confirmed('fd', 'low', 'info'), status: 'draft' };
  assert.throws(
    () => buildBrainChain({ jobId: JOB_ID, chain: { chainOf: ['f1', 'fd'] }, findingsById: findingsById([f1, draft]) }),
    /unconfirmed/
  );
  // Single finding is not a chain
  assert.throws(
    () => buildBrainChain({ jobId: JOB_ID, chain: { chainOf: ['f1'] }, findingsById: byId }),
    /at least two/
  );
});

test('suggestChains: proposes complementary pairs without duplicates', async () => {
  const f1 = confirmed('f1', 'medium', 'xss');
  const f2 = confirmed('f2', 'medium', 'open-redirect');
  const suggestions = suggestChains([f1, f2], []);
  assert.ok(suggestions.length >= 1, 'xss + open-redirect is a known complementary pair');
  const again = suggestChains([f1, f2], [{ metadata: { chainOf: ['f1', 'f2'] } }]);
  assert.equal(again.length, 0, 'already-chained pairs are not re-suggested');
});

test('alerts: critical findings and hunt completion land in the inbox', async () => {
  const database = new MemoryDatabase();
  const alertService = new AlertService({
    alertModel: new AlertModel(database),
    eventService: null,
    logger: { warn() {}, error() {}, log() {} }
  });

  const job = { id: JOB_ID, target: 'example.com' };
  await alertService.notifyCriticalFinding({
    userId: 'u1',
    job,
    finding: { id: 'f9', title: 'RCE via upload', severity: 'critical', cvssMetrics: { baseScore: 9.8 } }
  });
  await alertService.notifyHuntComplete({
    userId: 'u1',
    job,
    stats: { total: 3, critical: 1, high: 1 }
  });

  const alerts = await alertService.list('u1');
  assert.equal(alerts.length, 2);
  const types = alerts.map((a) => a.type).sort();
  assert.deepEqual(types, ['critical_finding', 'hunt_complete']);
  const critical = alerts.find((a) => a.type === 'critical_finding');
  assert.ok(critical.title.includes('RCE via upload'));
  assert.equal(critical.metadata.severity, 'critical');
  assert.equal(critical.read, false);

  const unread = await alertService.list('u1', { unreadOnly: true });
  assert.equal(unread.length, 2);
  await alertService.markRead('u1', critical.id);
  assert.equal((await alertService.list('u1', { unreadOnly: true })).length, 1);

  // Isolation: another user sees nothing.
  assert.equal((await alertService.list('u2')).length, 0);
});
