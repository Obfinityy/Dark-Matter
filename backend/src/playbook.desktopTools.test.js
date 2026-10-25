// Desktop-tools skill card tests.
//
// The card (backend/skills/desktop-tools.md) is knowledge for the hunt
// brain, loaded through the SAME mechanism as the SQLi card:
// loadSkills() reads backend/skills/*.md, selectSkills() scores by
// fingerprint/tag overlap, formatPlaybookForPrompt() injects at most
// MAX_SKILLS with each body clipped to 500 chars. These tests run the
// REAL loader — no mocks — and prove what the brain actually sees.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSkills, selectSkills, formatPlaybookForPrompt, MAX_SKILLS } from './playbook.js';

const KSUITE = { appType: 'webapp', techStack: [], query: 'https://ksuite.infomaniak.com' };

// Every tool the card must cover: already in the hunt image + the set the
// parallel Kali-tools lane is installing (owner order 25 Oct 2026).
const REQUIRED_TOOLS = [
  // already present in the hunt image
  'nmap', 'nikto', 'sqlmap', 'burpsuite', 'wireshark', 'nuclei', 'gobuster',
  'hydra', 'john', 'hashcat', 'amass', 'subfinder', 'mitmproxy',
  // being installed by the parallel Kali-tools lane
  'metasploit', 'ffuf', 'dirb', 'enum4linux', 'smbmap', 'netexec', 'responder',
  'impacket', 'zaproxy', 'wpscan', 'theharvester', 'recon-ng', 'httpx',
  'katana', 'dalfox', 'xsstrike', 'commix', 'tshark', 'aircrack-ng',
  'ncrack', 'bloodhound',
];

test('desktop-tools card loads through the real loader', () => {
  const skills = loadSkills();
  const card = skills.find((s) => s.name === 'desktop-tools');
  assert.ok(card, 'desktop-tools must be in backend/skills/');
  assert.match(card.description, /toolbox|phase/i);
  assert.ok(card.targets.length > 0, 'card needs targets to be selectable');
});

test('desktop-tools covers the full Kali toolset (file body)', () => {
  const card = loadSkills().find((s) => s.name === 'desktop-tools');
  const body = card.body.toLowerCase();
  for (const tool of REQUIRED_TOOLS) {
    assert.ok(body.includes(tool.toLowerCase()), `card body must mention ${tool}`);
  }
});

test('desktop-tools is selected for the live Infomaniak fingerprint', () => {
  const selected = selectSkills(KSUITE).map((s) => s.name);
  assert.ok(selected.includes('desktop-tools'), `webapp/kSuite must select desktop-tools (got: ${selected})`);
  assert.ok(selected.length <= MAX_SKILLS);
});

test('desktop-tools is selected across app types', () => {
  for (const appType of ['saas', 'ecommerce', 'content', 'api', 'unknown']) {
    const selected = selectSkills({ appType, techStack: [], query: 'https://example.com' }).map((s) => s.name);
    assert.ok(selected.includes('desktop-tools'), `${appType} must select desktop-tools`);
  }
});

test('the brain actually sees the web tools (500-char clip)', () => {
  const out = formatPlaybookForPrompt(KSUITE);
  assert.ok(out.includes('desktop-tools'), 'formatted prompt must include the card');
  // The loader clips each body to 500 chars: the opener + WEB line must
  // survive the clip, since those are the tools a web hunt needs first.
  for (const seen of ['Burp Suite', 'mitmproxy', 'nuclei', 'sqlmap', 'ffuf', 'gobuster', 'katana', 'dalfox']) {
    assert.ok(out.includes(seen), `clipped prompt must still show ${seen}`);
  }
  assert.ok(out.includes('full Kali desktop'), 'opener must survive the clip');
});

test('desktop-tools does not crowd out the SQLi card on a SaaS hunt', () => {
  const out = formatPlaybookForPrompt({ appType: 'saas', techStack: [], query: 'https://ksuite.infomaniak.com' });
  assert.ok(out.includes('desktop-tools'), 'saas prompt must include desktop-tools');
  assert.ok(out.includes('sqli-login-bypass'), 'saas prompt must still include the SQLi card');
});
