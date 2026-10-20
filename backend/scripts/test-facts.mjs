// Test for Job 6 stage 8 — bi-temporal facts.
// Run: node backend/scripts/test-facts.mjs
//
// Proves: (1) a fact is recorded and listed as current, (2) re-recording
// the same value is idempotent (no duplicate, no supersede), (3) a NEW
// value closes the old fact with valid_to + superseded_by pointing at
// the replacement — history is never edited or deleted, (4) hunts are
// isolated from each other.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-facts-'));
process.env.DATA_DIR = tmp;

const es = await import('../src/episodeStore.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

check('ledger enabled on this runtime', es.episodeLedgerEnabled());

const id1 = es.recordFact({ huntId: 'h_facts', subject: 'auth', predicate: 'jwt', object: 'absent' });
check('first fact recorded', !!id1);
let current = es.listFacts('h_facts');
check('one current fact', current.length === 1 && current[0].object === 'absent' && current[0].valid_to === null);

const idAgain = es.recordFact({ huntId: 'h_facts', subject: 'auth', predicate: 'jwt', object: 'absent' });
check('same value is idempotent', idAgain === id1 && es.listFacts('h_facts', { currentOnly: false }).length === 1);

const id2 = es.recordFact({ huntId: 'h_facts', subject: 'auth', predicate: 'jwt', object: 'present (captured from verified finding)' });
check('new value creates a new fact', !!id2 && id2 !== id1);
current = es.listFacts('h_facts');
check('current view shows only the new value', current.length === 1 && current[0].id === id2);
const history = es.listFacts('h_facts', { currentOnly: false });
check('history keeps both facts', history.length === 2);
const old = history.find((f) => f.id === id1);
check('old fact closed with superseded_by -> new id', !!old.valid_to && old.superseded_by === id2);

es.recordFact({ huntId: 'h_other', subject: 'auth', predicate: 'jwt', object: 'absent' });
check('hunts are isolated', es.listFacts('h_facts').length === 1 && es.listFacts('h_other').length === 1);

es.recordFact({ huntId: 'h_facts', subject: 'vuln', predicate: 'xxe', object: 'verified' });
check('different predicate coexists', es.listFacts('h_facts').length === 2);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
