// Dark Matter — SKILL CARDS (Lane M, 22 Oct 2026).
//
// Procedure-shaped field cards for human mode, re-implemented by
// reference from the Strix repo's skill shape (Research Lane K,
// proposal P2) and authored entirely from our own material: the
// canonical first probes in humanLoop's PROBE_TOPICS (Lane J), the
// playbook rules the verifier has already earned, and our Payload
// Library knowledge. No Strix text or code is copied.
//
// The live failure this attacks (Ezviz diagnosis, Lane J): the brain
// researches a class with open-ended web searches — 53% of all tool
// calls, and after a search the next action was another search 62%
// of the time. A card replaces that: when the hunter opens a class
// it pulls ONE compact procedure (attack surface → detection
// channels → numbered steps → the proof bar our verifier applies →
// false positives) as a single action's observation. Research
// arrives as a procedure with an end state instead of a search loop.
//
// Discipline (8B brain, ~10k-char perception, num_ctx 16384):
//   * the card INDEX (name + one-liner per card) is all that sits on
//     the screen permanently — choosing costs little context;
//   * a card body (≤ SKILL_CARD_MAX_CHARS) is paid only when pulled,
//     arrives as ONE turn's observation, and never accumulates into
//     the briefing: at most one card is in play at a time;
//   * pulling is the hunter's own choice (the load_skill action) —
//     nothing here injects, stages, or executes anything.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL_CARD_MAX_CHARS = 2000;

const CARDS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'skill-cards');

// Display order for the index (roughly the order a hunter opens
// classes on a fresh web target). Membership comes from the card
// files themselves; this list only orders them.
const DISPLAY_ORDER = [
  'sqli', 'xss', 'cmdi', 'ssti', 'ssrf', 'xxe', 'lfi',
  'fileupload', 'jwt', 'cors', 'headers', 'openredirect', 'graphql',
];

// Names a hunter might plausibly ask for, folded onto the canonical
// card names (matching is case/punctuation-insensitive). An 8B brain
// says "sql_injection" at least as often as "sqli"; both must land
// on the same card instead of an error.
const ALIASES = {
  sqlinjection: 'sqli',
  sql: 'sqli',
  crosssitescripting: 'xss',
  commandinjection: 'cmdi',
  oscommandinjection: 'cmdi',
  xmlexternalentity: 'xxe',
  xmlexternalentityinjection: 'xxe',
  localfileinclusion: 'lfi',
  pathtraversal: 'lfi',
  directorytraversal: 'lfi',
  serversidetemplateinjection: 'ssti',
  templateinjection: 'ssti',
  serversiderequestforgery: 'ssrf',
  jsonwebtoken: 'jwt',
  jwtabuse: 'jwt',
  crossoriginresourcesharing: 'cors',
  securityheaders: 'headers',
  missingsecurityheaders: 'headers',
  unvalidatedredirect: 'openredirect',
  unrestrictedfileupload: 'fileupload',
  fileuploadvulnerability: 'fileupload',
};

function parseCard(fileName, text) {
  const name = fileName.replace(/\.md$/i, '');
  let description = '';
  let body = String(text || '');
  const fm = body.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    const desc = fm[1].match(/^description:\s*(.+)$/m);
    if (desc) description = desc[1].trim();
    body = body.slice(fm[0].length);
  }
  return { name, description, body: body.trim(), chars: String(text || '').length };
}

let cache = null;

/**
 * All cards on disk, parsed once: Map<name, {name, description,
 * body, chars}>. A broken or missing directory yields an empty map —
 * the loader degrades, it never throws into the hunt loop.
 */
export function loadSkillCards() {
  if (cache) return cache;
  const cards = new Map();
  try {
    for (const f of fs.readdirSync(CARDS_DIR)) {
      if (!/\.md$/i.test(f)) continue;
      try {
        const card = parseCard(f, fs.readFileSync(path.join(CARDS_DIR, f), 'utf8'));
        if (card.body) cards.set(card.name, card);
      } catch { /* one unreadable card must not take the index down */ }
    }
  } catch { /* no cards directory — the index is simply empty */ }
  cache = cards;
  return cards;
}

/**
 * The cheap index: [{ name, description }] in display order. This is
 * all the screen ever carries about the cards; bodies are pulled
 * one at a time via loadSkill.
 */
export function listSkills() {
  const cards = loadSkillCards();
  const names = [...cards.keys()].sort((a, b) => {
    const ia = DISPLAY_ORDER.indexOf(a);
    const ib = DISPLAY_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  return names.map((n) => ({ name: n, description: cards.get(n).description || '' }));
}

/** Fold a hunter-supplied name onto a canonical card name, or null. */
export function resolveSkillName(raw) {
  const key = String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!key) return null;
  const cards = loadSkillCards();
  if (cards.has(key)) return key;
  const aliased = ALIASES[key];
  return aliased && cards.has(aliased) ? aliased : null;
}

/**
 * The card body for `name` — the observation text for a load_skill
 * action. An unknown (or empty) name returns the index instead of
 * an error, so a mistyped pull costs one turn and teaches the list;
 * it never throws.
 */
export function loadSkill(name) {
  const cards = loadSkillCards();
  const key = resolveSkillName(name);
  if (key) return cards.get(key).body;
  const shown = String(name || '').trim().slice(0, 60);
  const list = listSkills().map((s) => `- ${s.name}: ${s.description}`).join('\n');
  if (!list) return 'No skill cards are available on this machine. Work from your briefing and leads.';
  return `${shown ? `No skill card named "${shown}". ` : ''}Available skill cards — pull one with {"action":"load_skill","skill":"<name>"}:\n${list}`;
}
