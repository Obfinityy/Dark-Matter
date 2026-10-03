/**
 * recursiveLearner.js — The agent teaches itself, recursively, on-device.
 *
 * LOCAL-ONLY: all learning state lives in ~/.darkmatter/recursive/ on the
 * user's own machine. Nothing is sent to any cloud. Kaggle/remote brains
 * do NOT participate — this is the local model's private evolution.
 *
 * How it works (recursive loop):
 *   1. OBSERVE — after every hunt, extract: findings, payloads that worked,
 *      payloads that were filtered, time-to-first-finding, tech-stack signals.
 *   2. MUTATE — take successful payloads and generate variants (encoding
 *      mutations, case variations, comment injections, polyglot hybrids).
 *   3. SCORE — track hit-rate per payload/strategy/tech-stack over time.
 *   4. EVOLVE — promote high-scoring variants to the active arsenal; retire
 *      payloads with 0 hits after N uses. Strategies that find bugs faster
 *      get higher priority in the next hunt's plan.
 *   5. RECURSE — the next hunt uses the evolved arsenal, producing new
 *      observations, which feed back into step 1. The agent gets smarter
 *      every hunt, forever, on its own.
 *
 * This is what makes the local agent eventually outperform static scanners
 * and match elite human intuition: it builds its own private exploit
 * intuition from experience.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const LEARN_DIR = path.join(os.homedir(), '.darkmatter', 'recursive');
const ARSENAL_FILE = path.join(LEARN_DIR, 'arsenal.json');
const STRATEGY_FILE = path.join(LEARN_DIR, 'strategies.json');
const META_FILE = path.join(LEARN_DIR, 'meta.json');

// Payload mutation operators — applied to successful payloads to breed variants.
const MUTATORS = [
  // Case variation
  (p) => p.split('').map((c) => (Math.random() < 0.3 ? c.toUpperCase() : c.toLowerCase())).join(''),
  // URL encoding (single)
  (p) => encodeURIComponent(p),
  // URL encoding (double)
  (p) => encodeURIComponent(encodeURIComponent(p)),
  // HTML entity encoding
  (p) => p.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  // Comment injection (SQL/XSS)
  (p) => p.replace(/ /g, '/**/'),
  // Tab/newline whitespace swap
  (p) => p.replace(/ /g, '\t'),
  // Null byte suffix
  (p) => p + '%00',
  // Polyglot wrapper
  (p) => `'"--></script></style></textarea>${p}<!--`,
  // Unicode overlong encoding for < >
  (p) => p.replace(/</g, '%c0%bc').replace(/>/g, '%c0%be'),
];

function ensureDir() {
  fs.mkdirSync(LEARN_DIR, { recursive: true });
}

function loadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveJson(file, data) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/**
 * Observe a completed hunt. Extract learnings into the arsenal.
 * Call this after every hunt completes (success or failure — both teach).
 */
export function observeHunt({ target, techStack = [], findings = [], payloadsTried = [], durationMs = 0 }) {
  const arsenal = loadJson(ARSENAL_FILE, { payloads: {}, version: 1 });
  const meta = loadJson(META_FILE, { huntsObserved: 0, totalFindings: 0, generations: 0 });

  meta.huntsObserved += 1;
  meta.totalFindings += findings.length;
  meta.lastHuntAt = new Date().toISOString();

  // Record which payloads were tried and which produced findings.
  const successPayloads = new Set(findings.map((f) => f.payload).filter(Boolean));
  for (const p of payloadsTried) {
    const key = p.payload || p;
    if (!arsenal.payloads[key]) {
      arsenal.payloads[key] = { uses: 0, hits: 0, firstSeen: new Date().toISOString(), techStacks: [] };
    }
    const rec = arsenal.payloads[key];
    rec.uses += 1;
    rec.lastUsed = new Date().toISOString();
    if (successPayloads.has(key)) rec.hits += 1;
    for (const t of techStack) {
      if (!rec.techStacks.includes(t)) rec.techStacks.push(t);
    }
  }

  // EVOLVE: breed variants from payloads that scored hits.
  let newVariants = 0;
  for (const [payload, rec] of Object.entries(arsenal.payloads)) {
    if (rec.hits > 0 && rec.uses >= 2) {
      const hitRate = rec.hits / rec.uses;
      if (hitRate >= 0.3) {
        // High performer — breed 3 mutated children.
        for (let i = 0; i < 3; i++) {
          const mutator = MUTATORS[Math.floor(Math.random() * MUTATORS.length)];
          try {
            const variant = mutator(payload);
            if (variant !== payload && !arsenal.payloads[variant]) {
              arsenal.payloads[variant] = {
                uses: 0, hits: 0, parent: payload,
                firstSeen: new Date().toISOString(), techStacks: [...rec.techStacks],
              };
              newVariants += 1;
            }
          } catch { /* bad mutation, skip */ }
        }
      }
    }
    // RETIRE: 0 hits after 10+ uses → mark dormant (not deleted, just deprioritized).
    if (rec.uses >= 10 && rec.hits === 0 && !rec.dormant) {
      rec.dormant = true;
    }
  }

  if (newVariants > 0) meta.generations += 1;
  meta.lastEvolutionAt = new Date().toISOString();

  saveJson(ARSENAL_FILE, arsenal);
  saveJson(META_FILE, meta);

  // Update strategy scores.
  evolveStrategies({ findings, techStack, durationMs });

  return { huntsObserved: meta.huntsObserved, newVariants, totalPayloads: Object.keys(arsenal.payloads).length };
}

/**
 * Evolve hunt strategies based on what finds bugs fastest.
 */
function evolveStrategies({ findings, techStack, durationMs }) {
  const strategies = loadJson(STRATEGY_FILE, {});
  const findingTypes = findings.map((f) => f.type || f.category || 'unknown');
  const key = techStack.sort().join('+') || 'generic';

  if (!strategies[key]) {
    strategies[key] = { hunts: 0, totalFindings: 0, totalDurationMs: 0, findingTypes: {}, score: 0 };
  }
  const s = strategies[key];
  s.hunts += 1;
  s.totalFindings += findings.length;
  s.totalDurationMs += durationMs;
  for (const t of findingTypes) s.findingTypes[t] = (s.findingTypes[t] || 0) + 1;
  // Score: findings per minute, weighted by hunt count (confidence).
  const minutes = Math.max(s.totalDurationMs / 60000, 0.1);
  s.score = (s.totalFindings / minutes) * Math.min(s.hunts / 5, 1);
  s.updatedAt = new Date().toISOString();

  saveJson(STRATEGY_FILE, strategies);
}

/**
 * Get the evolved payload arsenal, sorted by hit-rate (best first).
 * The hunt planner calls this to prioritize what to try.
 */
export function getEvolvedArsenal({ techStack = [], limit = 50 } = {}) {
  const arsenal = loadJson(ARSENAL_FILE, { payloads: {} });
  const entries = Object.entries(arsenal.payloads)
    .filter(([, rec]) => !rec.dormant)
    .map(([payload, rec]) => ({
      payload,
      hitRate: rec.uses > 0 ? rec.hits / rec.uses : 0,
      uses: rec.uses,
      hits: rec.hits,
      techMatch: techStack.filter((t) => rec.techStacks.includes(t)).length,
    }))
    // Prioritize: tech-stack match first, then hit-rate, then unexplored.
    .sort((a, b) => (b.techMatch - a.techMatch) || (b.hitRate - a.hitRate) || (a.uses - b.uses));
  return entries.slice(0, limit);
}

/**
 * Get strategy guidance for a tech stack: what worked before, how fast.
 */
export function getStrategyGuidance(techStack = []) {
  const strategies = loadJson(STRATEGY_FILE, {});
  const key = [...techStack].sort().join('+') || 'generic';
  const exact = strategies[key];
  // Fall back to best generic strategy.
  const all = Object.entries(strategies).sort(([, a], [, b]) => b.score - a.score);
  const best = all[0]?.[1];
  return {
    forStack: key,
    hunts: exact?.hunts || 0,
    topFindingTypes: Object.entries(exact?.findingTypes || best?.findingTypes || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count })),
    recommendation: exact && exact.hunts >= 3
      ? `Based on ${exact.hunts} past hunts on this stack, prioritize: ${Object.keys(exact.findingTypes).slice(0, 3).join(', ')}.`
      : 'No local history for this stack yet — running full methodology.',
  };
}

/**
 * Stats for the UI: show the user their agent is evolving.
 */
export function getEvolutionStats() {
  const meta = loadJson(META_FILE, { huntsObserved: 0, totalFindings: 0, generations: 0 });
  const arsenal = loadJson(ARSENAL_FILE, { payloads: {} });
  const payloads = Object.values(arsenal.payloads);
  return {
    ...meta,
    totalPayloads: payloads.length,
    activePayloads: payloads.filter((p) => !p.dormant).length,
    dormantPayloads: payloads.filter((p) => p.dormant).length,
    avgHitRate: payloads.length
      ? (payloads.reduce((s, p) => s + (p.uses ? p.hits / p.uses : 0), 0) / payloads.length).toFixed(3)
      : 0,
  };
}
