// Test for Job 6 stage 5 — procedural memory: PLAYBOOK.md + skill library.
// Run: node backend/scripts/test-playbook.mjs
//
// Proves: (1) the seeded playbook parses (rules cite their evidence),
// (2) the skill library loads with front matter and selection respects
// the MAX_SKILLS cap and fingerprint matching, (3) THE GATE: a proposal
// with no validator-confirmed success behind it is NEVER promoted and
// never reaches the prompt, (4) once a matching verified finding episode
// exists (recorded after the proposal), the gate promotes it with its
// evidence episode id and the rule becomes live, (5) promotion is
// idempotent.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-playbook-'));
process.env.DATA_DIR = tmp;

const pb = await import('../src/playbook.js');
const episodes = await import('../src/episodeStore.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

// --- Seeded artefacts --------------------------------------------------------
const rules = pb.loadPlaybookRules();
check('seeded playbook parses (>=5 rules)', rules.length >= 5);
check('seeded rules cite earned evidence', rules.every((r) => /earned:|promoted:/.test(r)));
const skills = pb.loadSkills();
check('skill library loads (>=4 skills with front matter)', skills.length >= 4 && skills.every((s) => s.name && s.description && s.lastVerified));

// --- Selection: fingerprint match + cap ---------------------------------------
const sel = pb.selectSkills({ appType: 'ecommerce', techStack: ['angular'], query: 'login page http://172.17.0.1:3000' });
check('selection returns matched skills within the cap', sel.length >= 1 && sel.length <= pb.MAX_SKILLS);
check('sqli-login-bypass is selected for an ecommerce login target', sel.some((s) => s.name === 'sqli-login-bypass'));
const none = pb.selectSkills({ appType: 'blockchain-node', techStack: ['substrate'], query: 'parachain runtime' });
check('no fingerprint overlap -> no skills injected', none.length === 0);

// --- The gate: no verified success, no promotion --------------------------------
const H = 'h_playbook_test';
const pid = pb.proposePlaybook({ huntId: H, rule: 'Always sweep the /ftp directory for exposed backup archives early' });
check('proposal recorded with an id', !!pid);
const g0 = pb.evaluatePromotions();
check('gate promotes nothing without evidence', g0.promoted === 0);
check('unpromoted proposal does NOT reach the prompt', !pb.formatPlaybookForPrompt({ appType: 'ecommerce', techStack: [], query: 'ftp' }).includes('sweep the /ftp'));

// --- Evidence arrives -> promotion ------------------------------------------------
const dir = path.join(tmp, 'hunts', H);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'events.jsonl'), JSON.stringify({
  type: 'finding', class: 'agent_finding', title: 'FTP directory listing exposes backup archives', severity: 'low',
  verified: true, verification: 'confirmed (all 4 steps passed)', evidence: {}, cachedAt: new Date(Date.now() + 5000).toISOString(),
}) + '\n');
episodes.flushHuntEpisodes(H);
const g1 = pb.evaluatePromotions();
check('gate promotes the proposal on validator-confirmed evidence', g1.promoted === 1);
const promos = pb.loadPromotions();
check('promotion records its evidence episode id', promos.length === 1 && promos[0].evidenceEpisodeId != null && promos[0].proposalId === pid);
check('promoted rule is now live in the playbook', pb.loadPlaybookRules().some((r) => /sweep the \/ftp/.test(r)));
check('promoted rule reaches the prompt', pb.formatPlaybookForPrompt({ appType: 'ecommerce', techStack: [], query: '' }).includes('sweep the /ftp'));
const g2 = pb.evaluatePromotions();
check('promotion is idempotent', g2.promoted === 0 && pb.loadPromotions().length === 1);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
