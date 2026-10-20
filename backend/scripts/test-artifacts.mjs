// Test for solver #459 — total permanent memory + file-backed artifacts.
// Run: node backend/scripts/test-artifacts.mjs
//
// Owner order (20 Oct 2026): everything the agent thinks and does is
// preserved FOREVER in full, and thinking/doing is effectively unlimited
// despite the 8B context — a >10k-char script must survive end-to-end.
// Pre-fix destruction points this suite pins shut:
//   (a) think() sliced the permanent thinking record to 2,000 chars;
//   (b) the episode ledger clipped bodies to 4,000 (finding response to
//       1,200) even when events.jsonl kept more;
//   (c) chatWithOllama sliced every message to 8,000 chars, so the
//       55k-char full-history planning prompt never reached the model;
//   (d) plan commands were truncated to 500 chars at execution and no
//       file path existed for long artifacts at all.
// Proves: full-fidelity think + episode bodies; the Ollama message cap
// follows num_ctx; a >12k-char script assembled from WRITE/APPEND chunks
// (the model's per-reply output budget forces chunking), read back
// byte-identical, executed by path via RUN_ARTIFACT, its full output
// spilled to an .out artifact and retrievable by handle; name traversal
// refused; non-artifact commands untouched (null).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-artifacts-'));
process.env.DATA_DIR = tmp;
process.env.OLLAMA_NUM_CTX = '16384';

const store = await import('../src/store.js');
const ha = await import('../src/huntAgent.js');
const es = await import('../src/episodeStore.js');
const llm = await import('../src/llm.js');
const art = await import('../src/artifacts.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const H = 'h_artifacts';

// (a) think() stores the FULL thought
const longThought = 'reasoning '.repeat(1300) + 'ENDMARKER'; // 11,709 chars
ha.think(H, longThought);
const thoughts = store.readHuntEvents(H).filter((e) => e.type === 'thinking');
check('think() records full text (>11k chars, no 2000 slice)', thoughts.length === 1 && thoughts[0].text === longThought);

// (b) episode bodies are full-fidelity
const thinkEp = es.episodeFromEvent(H, 0, { type: 'thinking', text: longThought, cachedAt: new Date().toISOString() });
check('episode body keeps full thinking text', thinkEp.body === longThought);
const bigResponse = 'R'.repeat(9000);
const findEp = es.episodeFromEvent(H, 1, {
  type: 'finding', title: 't', class: 'sqli', verified: true,
  evidence: { request: 'q'.repeat(3000), response: bigResponse, impact_demo: 'i'.repeat(1500) },
  poc_output: 'P'.repeat(2500), cachedAt: new Date().toISOString(),
});
const parsedBody = JSON.parse(findEp.body);
check('episode body keeps full finding response (9000 chars)', parsedBody.response === bigResponse);
check('episode body keeps full request + poc_output + impact_demo',
  parsedBody.request.length === 3000 && parsedBody.poc_output.length === 2500 && parsedBody.impact_demo.length === 1500);

// (c) Ollama message cap follows the context window
check('ollama cap at num_ctx 16384 is 57344 (55k prompt fits)', llm.ollamaMessageCharCap() === 57344);
process.env.OLLAMA_NUM_CTX = '2048';
check('ollama cap floors at 8000 for small windows', llm.ollamaMessageCharCap() === 8000);
process.env.OLLAMA_NUM_CTX = '16384';

// (d) chunked artifact assembly of a >12k script
const tail = 'echo ARTIFACT-TAIL-REACHED';
const script = '#!/bin/sh\necho ARTIFACT-RUN-OK\n# ' + 'A'.repeat(12500) + '\n' + tail + '\n';
check('fixture script really is >12k chars', script.length > 12000);
const CHUNK = 1900; // under the model's ~600-token per-reply budget
let first = true;
for (let i = 0; i < script.length; i += CHUNK) {
  const verb = first ? 'WRITE_ARTIFACT' : 'APPEND_ARTIFACT';
  first = false;
  const res = await art.handleArtifactCommand(H, `${verb}: big.sh\n${script.slice(i, i + CHUNK)}`);
  if (!res || res.exitCode !== 0) { check(`chunk at ${i} accepted`, false); break; }
}
const back = art.readArtifact(H, 'big.sh', 0, script.length + 10);
check('assembled artifact is byte-identical to the source script', back.text === script && back.totalChars === script.length);
check('artifact listed in the hunt workspace', art.listArtifacts(H).some((a) => a.name === 'big.sh' && a.bytes === Buffer.byteLength(script)));

// slice reads via the grammar
const sliceRes = await art.handleArtifactCommand(H, 'READ_ARTIFACT: big.sh 5000:5100');
check('READ_ARTIFACT returns the requested slice', !!sliceRes && sliceRes.stdout.includes(script.slice(5000, 5100)) && sliceRes.stdout.includes(String(script.length)));

// name safety
check('traversal name refused by the grammar', (await art.handleArtifactCommand(H, 'WRITE_ARTIFACT: ../evil.sh\nx'))?.exitCode === 1);
check('path separator refused', art.safeArtifactName('a/b.sh') === null && art.safeArtifactName('..') === null);
check('normal command is not an artifact command', (await art.handleArtifactCommand(H, 'curl -s http://127.0.0.1:3000/')) === null && !art.isArtifactCommand('nmap -sV 127.0.0.1'));

// RUN_ARTIFACT end-to-end with a local executor (same code path; only the
// container hop is swapped for a host sh — the EC2 live smoke covers the
// real container path)
const localRun = async (huntId, name) => {
  const info = art.artifactInfo(huntId, name);
  return new Promise((resolve) => {
    execFile('sh', [info.path], { timeout: 30000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ stdout: String(stdout || ''), stderr: String(stderr || ''), code: err ? (typeof err.code === 'number' ? err.code : 1) : 0 });
    });
  });
};
const runRes = await art.handleArtifactCommand(H, 'RUN_ARTIFACT: big.sh', { run: localRun });
check('RUN_ARTIFACT executes the assembled script', !!runRes && runRes.exitCode === 0 && runRes.stdout.includes('ARTIFACT-RUN-OK') && runRes.stdout.includes('ARTIFACT-TAIL-REACHED'));
const outMatch = /saved as artifact (\S+)/.exec(runRes.stdout || '');
const outArt = outMatch && art.listArtifacts(H).find((a) => a.name === outMatch[1]);
check('RUN_ARTIFACT spills full output to a named artifact', !!outArt);
if (outArt) {
  const spill = art.readArtifact(H, outArt.name, 0, outArt.bytes + 10);
  check('spilled run output is complete (both markers, untruncated)', spill.text.includes('ARTIFACT-RUN-OK') && spill.text.includes('ARTIFACT-TAIL-REACHED'));
}
check('RUN of a missing artifact fails honestly', (await art.handleArtifactCommand(H, 'RUN_ARTIFACT: nope.sh', { run: localRun }))?.exitCode === 1);

// output spill helper (the executeWithEvasion auto-spill uses this)
const bigOut = 'line\n'.repeat(3000); // 15,000 chars
const spillName = art.spillOutput(H, bigOut);
const spillBack = art.readArtifact(H, spillName, 0, bigOut.length + 1);
check('spilled output read back in full via its handle', spillBack.text === bigOut);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
