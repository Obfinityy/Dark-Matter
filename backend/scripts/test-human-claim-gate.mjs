// Test for the human-mode COMPLETE-THE-PROOF GATE on claim_finding
// (Lane N, 22 Oct 2026 — Lane K's Strix P3, re-implemented).
//
// Before this lane, claim_finding recorded (or sent to assessResult)
// whatever title/evidence/command the brain supplied: a claim could
// reach the verifier as a bare assertion with no control result, no
// confidence, and no runnable reproduction beyond a hand-wave. The
// gate is the deterministic completeness contract at the recording
// point: title + class + a runnable reproduction (exact command, or
// a "poc" artefact that really exists in this hunt) + evidence (real
// output, not an assertion) + counterevidence (the control/baseline
// that could have disproved it) + confidence (rationale required
// when not high). Incomplete claims are NOT recorded and the
// verifier never sees them; the brain gets one observation naming
// every missing piece, and the refusal is a countable claim_bounce
// event. The gate judges completeness only — assessResult stays the
// sole judge of truth.
//
// This suite proves:
//   (a) gate units — each missing piece bounces with the piece named;
//       a complete package passes; the class falls back to a topic
//       match on the title; confidence rationale is required only
//       when confidence is not high; an artefact PoC with no command
//       passes, a fabricated artefact handle bounces;
//   (b) end-to-end through humanIteration — a bounced claim records
//       a claim_bounce event and NO finding; a complete claim records
//       exactly as before (UNVERIFIED with no verifier wired); an
//       artefact-PoC claim records; a ghost-PoC claim bounces;
//   (c) the system prompt's claim_finding doc names the new fields.
//
// Run: node backend/scripts/test-human-claim-gate.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-lane-n-'));
process.env.DATA_DIR = tmp;

const { humanIteration, claimGateCheck, claimClassFromTitle } = await import('../src/humanLoop.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const TARGET = 'https://t.test';
const fields = (gate) => gate.missing.map((m) => m.field);

// ---------------------------------------------------------------------------
// (a) gate units
// ---------------------------------------------------------------------------
const COMPLETE = {
  title: 'SQL injection in the login form',
  cls: 'sqli',
  command: "curl -s -d 'username=x&password=y' https://t.test/rest/user/login",
  poc: '',
  pocExists: false,
  evidence: 'Login response returned the full admin row {"id":1,"username":"admin","role":"admin"} for a wrong password',
  counterevidence: "The same request with ' OR 1=2 in the password returned 401 invalid credentials; only the true condition logged in",
  confidence: 'high',
  rationale: '',
};
check('unit: a complete package passes', claimGateCheck(COMPLETE).ok === true);
check('unit: missing title bounces, named', fields(claimGateCheck({ ...COMPLETE, title: '  ' })).includes('title'));
check('unit: missing class bounces, named',
  fields(claimGateCheck({ ...COMPLETE, cls: '', title: 'Something odd happened on the page' })).includes('class'));
check('unit: class falls back to a topic match on the title (loop resolves cls before the gate)',
  claimGateCheck({ ...COMPLETE, cls: claimClassFromTitle(COMPLETE.title) }).ok === true
    && claimClassFromTitle('SQL injection in the login form') === 'sqli');
check('unit: title topic match covers other classes',
  claimClassFromTitle('Reflected XSS in the search box') === 'xss' && claimClassFromTitle('Something odd happened') === '');
check('unit: no command and no poc bounces, named', fields(claimGateCheck({ ...COMPLETE, command: '' })).includes('command'));
check('unit: a trivial command does not count as a reproduction',
  fields(claimGateCheck({ ...COMPLETE, command: 'curl' })).includes('command'));
check('unit: an artefact poc with no command passes',
  claimGateCheck({ ...COMPLETE, command: '', poc: 'poc.py', pocExists: true }).ok === true);
check('unit: a fabricated artefact handle bounces, named',
  fields(claimGateCheck({ ...COMPLETE, command: '', poc: 'ghost.py', pocExists: false })).includes('poc'));
check('unit: bare-assertion evidence bounces, named',
  fields(claimGateCheck({ ...COMPLETE, evidence: 'it worked' })).includes('evidence'));
check('unit: missing counterevidence bounces, named',
  fields(claimGateCheck({ ...COMPLETE, counterevidence: '' })).includes('counterevidence'));
check('unit: a placeholder counterevidence bounces',
  fields(claimGateCheck({ ...COMPLETE, counterevidence: 'n/a' })).includes('counterevidence'));
check('unit: missing confidence bounces, named',
  fields(claimGateCheck({ ...COMPLETE, confidence: '' })).includes('confidence'));
check('unit: an unknown confidence value bounces',
  fields(claimGateCheck({ ...COMPLETE, confidence: 'certain' })).includes('confidence'));
check('unit: confidence is case-insensitive', claimGateCheck({ ...COMPLETE, confidence: 'HIGH' }).ok === true);
check('unit: medium confidence without rationale bounces, named',
  fields(claimGateCheck({ ...COMPLETE, confidence: 'medium', rationale: '' })).includes('confidence_rationale'));
check('unit: medium confidence with rationale passes',
  claimGateCheck({ ...COMPLETE, confidence: 'medium', rationale: 'Only one endpoint tested so far' }).ok === true);
check('unit: low confidence with rationale passes',
  claimGateCheck({ ...COMPLETE, confidence: 'low', rationale: 'Could not repeat it a second time' }).ok === true);
check('unit: several missing pieces are ALL named in one bounce',
  (() => {
    const f = fields(claimGateCheck({ title: '', cls: '', command: '', evidence: '', counterevidence: '', confidence: '' }));
    return ['title', 'class', 'command', 'evidence', 'counterevidence', 'confidence'].every((x) => f.includes(x));
  })());

// ---------------------------------------------------------------------------
// fake deps for the humanIteration-level checks
// ---------------------------------------------------------------------------
function fakeDeps({ script = [], artefacts = new Set() } = {}) {
  const screens = [];
  const systems = [];
  const state = { meta: {}, recorded: [] };
  const queue = [...script];
  return {
    screens,
    systems,
    state,
    deps: {
      chat: async (msgs, system) => {
        screens.push(msgs[0].text);
        systems.push(system);
        return queue.length ? queue.shift() : 'Thinking.\n{"action":"note","text":"ok"}';
      },
      execRaw: async () => ({ stdout: '/root', stderr: '', code: 0 }),
      exec: async () => ({ stdout: '', stderr: '', code: 0 }),
      search: async () => [],
      writeFile: async () => ({ name: 'x', chars: 0 }),
      spill: () => '',
      record: (h, e) => { state.recorded.push(e); },
      readMeta: () => state.meta,
      writeMeta: (h, m) => { state.meta = m; },
      readEvents: () => [],
      recordNote: () => {},
      pocExists: (h, name) => artefacts.has(name),
      assess: null,
      sleep: async () => {},
      buildBriefing: async () => 'BRIEFING-BODY',
    },
  };
}
const bounces = (s) => s.state.recorded.filter((e) => e.type === 'claim_bounce');
const findings = (s) => s.state.recorded.filter((e) => e.type === 'finding');

// ---------------------------------------------------------------------------
// (b) bounce then complete claim, through humanIteration (no verifier)
// ---------------------------------------------------------------------------
{
  const s = fakeDeps({
    script: [
      'Claiming.\n{"action":"claim_finding","title":"SQL injection in the login form","command":"curl -s -d \'username=x&password=y\' https://t.test/rest/user/login","evidence":"Login response returned the full admin row for a wrong password, session cookie issued"}',
      'Claiming properly this time.\n{"action":"claim_finding","title":"Reflected XSS in the search box","class":"xss","command":"curl -s \'https://t.test/search?q=marker123\'","evidence":"The response body contains <script>alert(1)</script> reflected verbatim, unencoded, inside the results div","counterevidence":"A control query with a plain word returned no script tag anywhere in the body; the marker only appears when injected","confidence":"high"}',
    ],
  });
  const res = await humanIteration('h_lane_n_bounce', TARGET, { turns: 2, deps: s.deps });
  const obs = res.log.map((l) => l.observation);
  check('e2e: incomplete claim bounces with CLAIM NOT RECORDED', /CLAIM NOT RECORDED/.test(obs[0] || ''));
  check('e2e: the bounce names the missing fields (full text on the next screen; the log truncates)',
    (s.screens[1] || '').includes('"counterevidence"') && (s.screens[1] || '').includes('"confidence"'));
  check('e2e: the class came from the title fallback (not named missing)',
    !bounces(s)[0].missing.includes('class'));
  check('e2e: the bounce is a countable claim_bounce event',
    bounces(s).length === 1 && bounces(s)[0].tool === 'claim_finding'
      && bounces(s)[0].missing.includes('counterevidence') && bounces(s)[0].missing.includes('confidence'));
  check('e2e: the bounced claim recorded NO finding (the only finding is the later complete claim)',
    findings(s).length === 1 && findings(s)[0].title === 'Reflected XSS in the search box');
  check('e2e: a complete claim records as UNVERIFIED, exactly as before',
    /UNVERIFIED/.test(obs[1] || '') && findings(s).length === 1 && findings(s)[0].verified === false);
  check('e2e: the complete claim produced no further bounce', bounces(s).length === 1);
  check('prompt: the claim_finding doc names the new required fields',
    (s.systems[0] || '').includes('"counterevidence"') && (s.systems[0] || '').includes('"confidence"') && (s.systems[0] || '').includes('complete-the-proof'));
}

// ---------------------------------------------------------------------------
// (b2) artefact PoC: real handle records, ghost handle bounces
// ---------------------------------------------------------------------------
{
  const s = fakeDeps({
    artefacts: new Set(['poc.py']),
    script: [
      'Claiming with my saved script.\n{"action":"claim_finding","title":"SSRF in the avatar fetcher","class":"ssrf","poc":"poc.py","evidence":"The fetcher returned the cloud metadata body including the instance role name when given the metadata URL","counterevidence":"The same fetcher given an external example URL returned that page normally; only the metadata address exposed internals","confidence":"medium","confidence_rationale":"Only the metadata endpoint was reachable in the time available"}',
      'Claiming with a script I did not save.\n{"action":"claim_finding","title":"XXE in the invoice import","class":"xxe","poc":"ghost.py","evidence":"The import response echoed root:x:0:0 from the passwd file after the entity was declared in the XML body","counterevidence":"A plain XML invoice without the entity imported normally and echoed no file content at all","confidence":"high"}',
    ],
  });
  const res = await humanIteration('h_lane_n_poc', TARGET, { turns: 2, deps: s.deps });
  const obs = res.log.map((l) => l.observation);
  check('e2e poc: a claim whose poc artefact exists records (no command needed)',
    findings(s).length === 1 && /UNVERIFIED/.test(obs[0] || ''));
  check('e2e poc: a claim naming a non-existent artefact bounces, naming "poc"',
    /CLAIM NOT RECORDED/.test(obs[1] || '') && (obs[1] || '').includes('"poc"') && findings(s).length === 1);
  check('e2e poc: the ghost bounce is counted', bounces(s).length === 1 && bounces(s)[0].missing.includes('poc'));
}

// ---------------------------------------------------------------------------
// (b3) rationale enforcement through the loop
// ---------------------------------------------------------------------------
{
  const s = fakeDeps({
    script: [
      'Claiming, medium confidence.\n{"action":"claim_finding","title":"Open redirect in the logout flow","class":"openredirect","command":"curl -s -o /dev/null -w \'%{url_effective}\' \'https://t.test/logout?next=https://example.com\'","evidence":"The effective URL after the logout redirect is https://example.com/ — the browser leaves the site entirely","counterevidence":"With no next parameter the logout lands on the site home page; the external landing only happens when the parameter is supplied","confidence":"medium"}',
    ],
  });
  const res = await humanIteration('h_lane_n_rationale', TARGET, { turns: 1, deps: s.deps });
  const obs = res.log.map((l) => l.observation);
  check('e2e rationale: medium confidence without rationale bounces, naming "confidence_rationale"',
    /CLAIM NOT RECORDED/.test(obs[0] || '') && (obs[0] || '').includes('"confidence_rationale"')
      && bounces(s).length === 1 && bounces(s)[0].missing.includes('confidence_rationale') && findings(s).length === 0);
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
