// Dark Matter — Procedural memory (Job 6, stage 5).
//
// Research report §5 item 5 (Voyager skill library + LangMem procedural
// memory + Strix's ≤5-at-a-time skill injection), re-implemented:
//
//   * PLAYBOOK.md (in the repo, git-versioned) holds one rule per line.
//     Rules are EARNED: the seeded lines cite the verified episode that
//     proved them.
//   * The agent may PROPOSE rules at any time (PROPOSE_PLAYBOOK: command).
//     Proposals are inert data (data/playbook-proposals.jsonl).
//   * PROMOTION IS A CODE GATE: a proposal becomes a live rule only when
//     a validator-confirmed (verified) finding episode exists AFTER the
//     proposal whose title shares a significant keyword with it. No
//     verified success → no promotion, ever. Promotions are appended to
//     data/playbook-promotions.jsonl with their evidence episode id; the
//     solver folds them into PLAYBOOK.md so git keeps the audit trail.
//   * SKILLS are small field guides (backend/skills/*.md with front
//     matter). At most MAX_SKILLS are injected per planning prompt,
//     selected by code on fingerprint/tag overlap — never by the model.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { getVerifiedFindingsSince, flushHuntEpisodes } from './episodeStore.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PLAYBOOK_FILE = path.join(here, '..', 'PLAYBOOK.md');
const SKILLS_DIR = path.join(here, '..', 'skills');
export const MAX_SKILLS = 5;

const STOPWORDS = new Set([
  'the', 'a', 'an', 'on', 'of', 'to', 'in', 'for', 'with', 'and', 'or', 'is',
  'it', 'this', 'that', 'when', 'from', 'into', 'your', 'you', 'are', 'was',
  'were', 'then', 'than', 'over', 'under', 'per', 'via',
]);

function proposalsFile() {
  return path.join(config.dataDir, 'playbook-proposals.jsonl');
}
function promotionsFile() {
  return path.join(config.dataDir, 'playbook-promotions.jsonl');
}

function readJsonl(file) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}
function appendJsonl(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(obj) + '\n');
}

const clip = (s, n) => {
  const str = String(s || '').replace(/\s+/g, ' ').trim();
  return str.length > n ? str.slice(0, n) : str;
};

function keywords(text) {
  return new Set(
    (String(text || '').toLowerCase().match(/[a-z][a-z0-9_-]{3,}/g) || []).filter((w) => !STOPWORDS.has(w))
  );
}

// ---- Playbook rules -----------------------------------------------------------

export function parsePlaybookRules(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).trim());
}

export function loadPromotions() {
  return readJsonl(promotionsFile());
}

/** All live rules: the repo playbook plus gate-promoted rules. */
export function loadPlaybookRules() {
  let repo = [];
  try {
    repo = parsePlaybookRules(fs.readFileSync(PLAYBOOK_FILE, 'utf8'));
  } catch { /* playbook file is best-effort */ }
  const promoted = loadPromotions().map((p) => p.rule);
  return [...repo, ...promoted];
}

// ---- Proposals + promotion gate -------------------------------------------------

export function proposePlaybook({ huntId, rule, why = '' }) {
  const clean = clip(rule, 240);
  if (!clean) return null;
  const id = `prop-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  appendJsonl(proposalsFile(), {
    id,
    ts: new Date().toISOString(),
    huntId: String(huntId || ''),
    rule: clean,
    why: clip(why, 200),
    status: 'pending',
  });
  return id;
}

export function loadProposals() {
  return readJsonl(proposalsFile());
}

/**
 * The promotion gate. For every pending proposal, look for a
 * validator-confirmed finding episode recorded AFTER the proposal that
 * shares a significant keyword with the proposed rule. Promote on the
 * first such evidence; otherwise the proposal stays inert.
 */
export function evaluatePromotions() {
  const proposals = loadProposals();
  const promotedIds = new Set(loadPromotions().map((p) => p.proposalId));
  let promoted = 0;
  for (const p of proposals) {
    if (p.status !== 'pending' || promotedIds.has(p.id)) continue;
    try { flushHuntEpisodes(p.huntId); } catch { /* best-effort */ }
    const evidence = getVerifiedFindingsSince(p.ts, 200);
    const ruleKeys = keywords(p.rule);
    const hit = evidence.find((e) => {
      const titleKeys = keywords(e.title);
      for (const k of ruleKeys) if (titleKeys.has(k)) return true;
      return false;
    });
    if (!hit) continue;
    const ruleLine = `${p.rule} (promoted: verified episode #${hit.id} — "${clip(hit.title, 80)}")`;
    appendJsonl(promotionsFile(), {
      ts: new Date().toISOString(),
      proposalId: p.id,
      rule: ruleLine,
      evidenceEpisodeId: hit.id,
      evidenceHuntId: hit.hunt_id,
    });
    p.status = 'promoted';
    promoted++;
  }
  if (promoted) {
    // Persist status flips (small file; atomic rewrite).
    const file = proposalsFile();
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, proposals.map((p) => JSON.stringify(p)).join('\n') + '\n');
    fs.renameSync(tmp, file);
  }
  return { promoted };
}

// ---- Skills -----------------------------------------------------------------------

export function loadSkills() {
  const out = [];
  let names = [];
  try {
    names = fs.readdirSync(SKILLS_DIR).filter((n) => n.endsWith('.md'));
  } catch {
    return out;
  }
  for (const name of names) {
    try {
      const raw = fs.readFileSync(path.join(SKILLS_DIR, name), 'utf8');
      const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
      if (!m) continue;
      const meta = {};
      for (const line of m[1].split('\n')) {
        const kv = /^([a-z_]+):\s*(.*)$/.exec(line.trim());
        if (kv) meta[kv[1]] = kv[2].trim();
      }
      out.push({
        name: meta.name || name.replace(/\.md$/, ''),
        description: meta.description || '',
        tags: (meta.tags || '').split(',').map((s) => s.trim()).filter(Boolean),
        targets: (meta.targets || '').split(',').map((s) => s.trim()).filter(Boolean),
        lastVerified: meta.last_verified || '',
        body: m[2].trim(),
      });
    } catch { /* skip unreadable skill */ }
  }
  return out;
}

/** Score skills against a fingerprint + free-text query. Code decides. */
export function selectSkills({ appType = '', techStack = [], query = '' } = {}, limit = MAX_SKILLS) {
  const want = new Set([
    String(appType || '').toLowerCase(),
    ...techStack.map((t) => String(t).toLowerCase()),
    ...keywords(query),
  ]);
  return loadSkills()
    .map((s) => {
      let score = 0;
      for (const t of s.targets) if (want.has(t.toLowerCase())) score += 2;
      for (const t of s.tags) if (want.has(t.toLowerCase())) score += 1;
      return { skill: s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || String(b.skill.lastVerified).localeCompare(String(a.skill.lastVerified)))
    .slice(0, limit)
    .map((x) => x.skill);
}

// ---- Prompt surface -----------------------------------------------------------------

export function formatPlaybookForPrompt({ appType = '', techStack = [], query = '' } = {}, { rulesBudget = 1800, skillsBudget = 2600 } = {}) {
  const rules = loadPlaybookRules();
  const skills = selectSkills({ appType, techStack, query });
  if (!rules.length && !skills.length) return '';
  const lines = ['\n--- PLAYBOOK (your proven techniques — every rule was earned by a validator-confirmed success) ---'];
  let used = lines[0].length;
  for (const r of rules) {
    const line = `- ${r}`;
    if (used + line.length + 1 > rulesBudget) break;
    lines.push(line);
    used += line.length + 1;
  }
  if (skills.length) {
    lines.push(`SKILLS FOR THIS TARGET (at most ${MAX_SKILLS}):`);
    let sUsed = 0;
    for (const s of skills) {
      const block = `▸ ${s.name}: ${s.description}\n${clip(s.body, 500)}`;
      if (sUsed + block.length + 1 > skillsBudget) break;
      lines.push(block);
      sUsed += block.length + 1;
    }
  }
  return lines.join('\n');
}
