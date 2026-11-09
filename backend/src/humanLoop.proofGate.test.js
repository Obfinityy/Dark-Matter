// Proof-complete gate (gate-replay lane, 28 Oct 2026) — tests
// through a stubbed humanIteration.
//
// The live DVWA hunt's reflected-XSS claim was re-proved 9 times
// with a fresh marker each time (ZXSS987654, ZXQ9777, QXZ7719,
// HXQ/BBT999z, RXS2810B) and never filed: the dedup gate keys on
// the EXACT action signature, so each re-proof looked new. The
// proof gate keys on the CLAIM (endpoint + payload class) instead:
// after PROOF_THRESHOLD (3) consistent re-proofs of the same
// claim, the next probe is blocked and the brain is told to FILE
// the claim. A rejected claim resets the count, so the brain
// needs new evidence instead of re-proving the same thing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE humanLoop (via store/config) is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-proofgate-'));
process.env.DATA_DIR = tmpRoot;
const {
  humanIteration,
  proofEndpointOfCommand,
  proofSignatureFor,
  probeProvesClaim,
  proofGateHit,
  proofFileObservation,
  PROOF_THRESHOLD,
} = await import('./humanLoop.js');

const TARGET = 'http://172.17.0.1:3100/';
const XSS_URL = 'http://172.17.0.1:3100/vulnerabilities/xss_r/';
const XSS_KEY = '172.17.0.1/vulnerabilities/xss_r|xss';

const XSS_SNAP = {
  url: XSS_URL,
  title: 'XSS reflected',
  text: 'Hello',
  elements: [],
};

// Pure: endpoint extraction, signature, proof judgement, gate, nudge.

test('proofEndpointOfCommand extracts host+path from a probe URL and strips the query', () => {
  assert.equal(
    proofEndpointOfCommand("curl -sk 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=QXZ7719<sCrIpT>alert(1)</sCrIpT>'"),
    '172.17.0.1/vulnerabilities/xss_r',
  );
  assert.equal(proofEndpointOfCommand('python3 /opt/hunt/sqli_final.py'), '', 'a script invocation carries no endpoint');
  assert.equal(proofEndpointOfCommand(''), '');
});

test('proofSignatureFor keys a shell XSS probe on the claim, not the marker wording', () => {
  const sigA = proofSignatureFor('shell', { command: "curl -sk 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=ZXSS987654<sCrIpT>alert(1)</sCrIpT>'" });
  const sigB = proofSignatureFor('shell', { command: "curl -sk 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=QXZ7719<sCrIpT>alert(1)</sCrIpT>'" });
  assert.equal(sigA.key, XSS_KEY);
  assert.equal(sigB.key, XSS_KEY, 'a fresh marker is the SAME claim — the dedup gate cannot see this');
  assert.equal(sigA.endpoint, '172.17.0.1/vulnerabilities/xss_r');
  assert.equal(sigA.payloadClass, 'xss');
});

test('proofSignatureFor returns null for credentials and for script probes with no endpoint', () => {
  assert.equal(proofSignatureFor('shell', { command: "curl -sk 'http://172.17.0.1:3100/login.php'" }), null, 'a login curl is a credential, not a probe');
  assert.equal(proofSignatureFor('shell', { command: 'python3 /opt/hunt/sqli_final.py' }), null, 'no endpoint to key on');
  assert.equal(proofSignatureFor('search', { query: 'DVWA reflected XSS' }), null, 'search is not a probe');
});

test('proofSignatureFor keys a browser_type probe on the current page', () => {
  const sig = proofSignatureFor('browser_type', { text: '<script>alert(1)</script>' }, { page: XSS_URL });
  assert.equal(sig.key, XSS_KEY);
  assert.equal(proofSignatureFor('browser_type', { text: 'admin' }, { page: XSS_URL }), null, 'typing a credential is not a probe');
});

test('probeProvesClaim accepts reflected output, rejects error pages and signal-free output', () => {
  const cmd = "curl -sk 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=QXZ7719<sCrIpT>alert(1)</sCrIpT>'";
  assert.equal(probeProvesClaim({ output: 'Hello QXZ7719<sCrIpT>alert(1)</sCrIpT>', command: cmd }), true);
  assert.equal(probeProvesClaim({ output: '<!DOCTYPE HTML><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1></body></html>', command: cmd }), false);
  assert.equal(probeProvesClaim({ output: 'no results', command: cmd }), false, 'no signal, no proof');
  assert.equal(probeProvesClaim({ output: '', command: cmd }), false);
});

test('proofGateHit fires at the threshold and not before; plain-object counts work', () => {
  assert.equal(PROOF_THRESHOLD, 3);
  const action = { command: "curl -sk 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=QXZ7719<sCrIpT>alert(1)</sCrIpT>'" };
  assert.equal(proofGateHit('shell', action, {}, {}), null);
  assert.equal(proofGateHit('shell', action, { [XSS_KEY]: 2 }, {}), null);
  const hit = proofGateHit('shell', action, { [XSS_KEY]: 3 }, {});
  assert.ok(hit, 'three proofs complete the claim');
  assert.equal(hit.count, 3);
  assert.equal(hit.endpoint, '172.17.0.1/vulnerabilities/xss_r');
  assert.equal(hit.payloadClass, 'xss');
  const hitMap = proofGateHit('shell', action, new Map([[XSS_KEY, 4]]), {});
  assert.equal(hitMap.count, 4, 'a Map counts the same as a plain object');
});

test('proofFileObservation names the claim and the filing move', () => {
  const obs = proofFileObservation({ endpoint: '172.17.0.1/vulnerabilities/xss_r', payloadClass: 'xss', count: 3 });
  assert.match(obs, /PROOF COMPLETE — FILE IT NOW/);
  assert.match(obs, /claim_finding/);
  assert.match(obs, /172\.17\.0\.1\/vulnerabilities\/xss_r/);
  assert.match(obs, /3 times/);
});

// Integration: stubbed humanIteration.

function stubProofSession(replies, { meta = {}, assessImpl = undefined } = {}) {
  const recorded = [];
  const execCalls = [];
  let n = 0;
  let metaStore = { ...meta };
  const exec = async (h, t, cmd) => {
    execCalls.push(String(cmd || ''));
    const m = /name=([A-Za-z0-9]+)<sCrIpT>/i.exec(String(cmd || ''));
    const marker = m ? m[1] : 'UNKNOWN';
    // The mock target reflects the marker with the script tag intact.
    return { stdout: `Hello ${marker}<sCrIpT>alert(1)</sCrIpT>`, stderr: '', code: 0 };
  };
  return {
    recorded,
    execCalls,
    get meta() { return metaStore; },
    run: (turns) => humanIteration('h_test_proofgate', TARGET, {
      turns: turns ?? replies.length,
      deps: {
        chat: async () => replies[n++],
        gui: {
          open: async () => ({ observation: 'opened', snapshot: XSS_SNAP }),
          snapshot: async () => ({ observation: `Page: ${XSS_URL}\nHello`, snapshot: XSS_SNAP }),
          click: async () => ({ ok: true, observation: 'clicked', snapshot: XSS_SNAP }),
          type: async () => ({ ok: true, observation: 'Typed.', snapshot: XSS_SNAP }),
          screenshot: async () => ({ observation: 'shot', snapshot: XSS_SNAP }),
        },
        exec,
        execRaw: async () => ({ stdout: '', stderr: '' }),
        record: (h, e) => { recorded.push(e); },
        recordNote: () => {},
        readMeta: () => metaStore,
        writeMeta: (h, patch) => { metaStore = { ...metaStore, ...(patch || {}) }; return metaStore; },
        readEvents: () => [],
        buildBriefing: async () => '',
        machineControlled: () => false,
        assess: assessImpl === undefined ? null : assessImpl,
      },
    }),
  };
}

const probeReply = (marker) => `Probing reflected XSS with a fresh marker.\n${JSON.stringify({
  action: 'shell',
  command: `curl -sk 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=${marker}<sCrIpT>alert(1)</sCrIpT>'`,
})}`;

test('PG-1: three re-proofs of the same XSS claim execute; the fourth is blocked with a file nudge', async () => {
  const markers = ['ZXSS987654', 'ZXQ9777', 'QXZ7719', 'RXS2810B'];
  const s = stubProofSession(markers.map(probeReply));
  const res = await s.run();
  assert.equal(res.turnsRun, 4);
  assert.equal(s.execCalls.length, 3, 'the fourth probe must never execute');
  assert.equal(s.meta.proofCounts[XSS_KEY], 3, 'the proof count persists to meta');
  // Turns 1-3 executed and returned the reflection.
  for (let i = 0; i < 3; i++) {
    assert.match(res.log[i].observation, /Hello .*<sCrIpT>alert\(1\)<\/sCrIpT>/, `turn ${i + 1} executes and returns the reflection`);
  }
  // Turn 4 is the proof-complete block.
  assert.match(res.log[3].observation, /PROOF COMPLETE — FILE IT NOW/);
  assert.match(res.log[3].observation, /claim_finding/);
  const nudge = s.recorded.find((e) => e.type === 'proof_file_nudge');
  assert.ok(nudge, 'a proof_file_nudge event must be recorded');
  assert.equal(nudge.count, 3);
  assert.equal(nudge.tool, 'shell');
  assert.match(nudge.detail, /xss on 172\.17\.0\.1\/vulnerabilities\/xss_r/);
});

test('PG-2: a rejected claim resets the proof count, and the next probe executes again', async () => {
  const claim = `Filing the XSS claim with the exact reflected output.\n${JSON.stringify({
    action: 'claim_finding',
    title: 'Reflected XSS in /vulnerabilities/xss_r/ name parameter',
    class: 'xss',
    severity: 'high',
    command: "curl -sk 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=QXZ7719<sCrIpT>alert(1)</sCrIpT>'",
    evidence: 'Hello QXZ7719<sCrIpT>alert(1)</sCrIpT> — the marker and script tag are reflected raw in the response.',
    counterevidence: 'The reflection was confirmed on three separate runs with three different markers.',
    confidence: 'high',
  })}`;
  const s = stubProofSession(
    [claim, probeReply('NEW9999')],
    {
      meta: { proofCounts: { [XSS_KEY]: 3 } },
      assessImpl: async () => ({
        verified: false,
        verification: 'false_positive (exploit_confirmation: the second run differed)',
        title: 'Reflected XSS in /vulnerabilities/xss_r/ name parameter',
        severity: 'high',
      }),
    },
  );
  // Drive the two turns as separate sessions (the meta store is
  // shared across runs, so the reset is observable between them).
  const claimRes = await s.run(1);
  assert.equal(claimRes.turnsRun, 1);
  assert.match(claimRes.log[0].observation, /NOT verified/, 'the rejected claim is reported as not verified');
  assert.equal(s.meta.proofCounts[XSS_KEY], undefined, 'the rejection resets the count for this claim');
  const probeRes = await s.run(1);
  assert.equal(probeRes.turnsRun, 1);
  assert.equal(s.execCalls.length, 1, 'the next probe executes — it is no longer proof-blocked');
  assert.match(probeRes.log[0].observation, /Hello NEW9999<sCrIpT>alert\(1\)<\/sCrIpT>/);
  assert.equal(s.meta.proofCounts[XSS_KEY], 1, 'the fresh probe starts a new count');
  assert.ok(!s.recorded.some((e) => e.type === 'proof_file_nudge'), 'no file nudge on a fresh count');
});
