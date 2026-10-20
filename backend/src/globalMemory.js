// Dark Matter — Global Memory.
// Cross-hunt compounding knowledge: every hunt learns, every future hunt
// starts smarter. A human elite hunter carries lessons from every target
// they have ever touched; this is that memory, shared across all hunts.
//
// Unlike reasoning.jsonl (per-hunt), this store is GLOBAL — one file for
// every hunt on this backend. The model's weights never change (8B, no
// training budget) — the intelligence compounds HERE instead.
//
// Design notes:
// - Entries are deduplicated by (type, technique, appType): repeat outcomes
//   increment attempts/successes counters instead of duplicating rows.
// - Retrieval is relevance-scored against the current target's fingerprint
//   (appType + tech stack) so the prompt only carries what matters.
// - All writes are best-effort and atomic (temp file + rename); a memory
//   failure must never break a hunt.

import fs from 'fs';
import path from 'path';
import { dataDir } from './store.js';

const MAX_ENTRIES = 500;

function globalMemoryFile() {
  return path.join(dataDir(), 'global-memory.jsonl');
}

function readAll() {
  try {
    const content = fs.readFileSync(globalMemoryFile(), 'utf8');
    return content.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

function writeAll(entries) {
  const file = globalMemoryFile();
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
  fs.renameSync(tmp, file);
}

function dedupKey(e) {
  return [e.type, e.technique, e.appType].join('|').toLowerCase();
}

/**
 * Map free text (test names, finding titles) to a canonical technique key.
 * Returns 'other' when nothing matches — callers should skip 'other' for
 * failure signals to avoid polluting the counters with noise.
 */
export function inferTechnique(text = '') {
  const t = String(text).toLowerCase();
  if (/\bsqli\b|sql injection|sql-injection|' or 1=1|union select/.test(t)) return 'sqli';
  if (/\bnosqli\b|no-sql|\$where|\$ne\b/.test(t)) return 'nosqli';
  if (/\bxss\b|cross.?site|alert\(1\)|<script/.test(t)) return 'xss';
  if (/\bidor\b|insecure direct object|object.level/.test(t)) return 'idor';
  if (/\bssrf\b|server.side request/.test(t)) return 'ssrf';
  if (/\blfi\b|rfi\b|local file|path traversal|\.\.\//.test(t)) return 'lfi';
  if (/\brce\b|remote code|command injection|;\s*id\b|\|\s*whoami/.test(t)) return 'rce';
  if (/\bssti\b|template injection|{{7\*7}}/.test(t)) return 'ssti';
  if (/\bjwt\b|token/i.test(t) && /priv|admin|esc|confus|none\b/.test(t)) return 'jwt';
  if (/\bcsrf\b|cross.site request/.test(t)) return 'csrf';
  if (/\bauth\b|login|password|credential|session/.test(t)) return 'auth';
  if (/price|basket|checkout|coupon|business.logic|logic flaw/.test(t)) return 'business-logic';
  if (/\bchain\b|pursuit/.test(t)) return 'chain';
  return 'other';
}

/**
 * Record a learning. Successes and failures for the same
 * (type, technique, appType) merge into counters — the memory learns
 * rates ("SQLi on ecommerce logins: 1/3") not anecdotes.
 */
export function recordGlobalLearning(entry) {
  try {
    const now = new Date().toISOString();
    const rec = {
      at: now,
      firstSeen: now,
      lastSeen: now,
      type: entry.type || 'technique',
      technique: entry.technique || 'other',
      target: String(entry.target || '').slice(0, 120),
      appType: entry.appType || 'unknown',
      techStack: Array.isArray(entry.techStack) ? entry.techStack.slice(0, 8) : [],
      success: !!entry.success,
      attempts: 1,
      successes: entry.success ? 1 : 0,
      payload: String(entry.payload || '').slice(0, 300),
      context: String(entry.context || '').slice(0, 200),
      note: String(entry.note || '').slice(0, 300),
    };
    const all = readAll();
    const key = dedupKey(rec);
    const existing = all.find((e) => dedupKey(e) === key);
    if (existing) {
      existing.attempts = (existing.attempts || 1) + 1;
      existing.successes = (existing.successes || 0) + (rec.success ? 1 : 0);
      existing.lastSeen = now;
      // Union the tech stacks so the fingerprint coverage grows.
      const seen = new Set((existing.techStack || []).map((s) => String(s).toLowerCase()));
      for (const s of rec.techStack) {
        if (!seen.has(String(s).toLowerCase())) {
          existing.techStack.push(s);
          seen.add(String(s).toLowerCase());
        }
      }
      // Keep the most informative note (prefer notes from successes).
      if (rec.success && rec.note) existing.note = rec.note;
      if (rec.payload && !existing.payload) existing.payload = rec.payload;
      if (rec.context && !existing.context) existing.context = rec.context;
    } else {
      all.push(rec);
    }
    // Prune: drop the lowest-value entries past the cap — single-attempt
    // failures with no successes, oldest first.
    if (all.length > MAX_ENTRIES) {
      all.sort((a, b) => {
        const va = (a.successes || 0) * 10 + (a.attempts || 0);
        const vb = (b.successes || 0) * 10 + (b.attempts || 0);
        return va - vb || new Date(a.lastSeen) - new Date(b.lastSeen);
      });
      all.splice(0, all.length - MAX_ENTRIES);
    }
    writeAll(all);
    return true;
  } catch {
    return false;
  }
}

/**
 * Score entries by relevance to the current target's fingerprint.
 * fingerprint = { appType, techStack: [] }
 */
/** All stored global memories (RECALL search reads the whole store). */
export function readAllGlobalMemories() {
  return readAll();
}

export function getRelevantMemories(fingerprint = {}, limit = 8) {
  try {
    const all = readAll();
    if (all.length === 0) return [];
    const appType = String(fingerprint.appType || 'unknown').toLowerCase();
    const techs = (fingerprint.techStack || []).map((s) => String(s).toLowerCase());
    const scored = all.map((e) => {
      let score = 0;
      const eApp = String(e.appType || 'unknown').toLowerCase();
      if (eApp !== 'unknown' && eApp === appType) score += 3;
      else if (eApp === 'unknown') score += 0.5; // generic knowledge, weak signal
      const eTechs = (e.techStack || []).map((s) => String(s).toLowerCase());
      let overlap = 0;
      for (const t of techs) {
        if (eTechs.some((et) => et.includes(t) || t.includes(et))) overlap++;
      }
      score += Math.min(overlap, 3);
      if ((e.successes || 0) > 0) score += 2; // proven to work — lead with it
      // A technique that failed repeatedly is still relevant: it warns.
      if ((e.attempts || 0) >= 3 && (e.successes || 0) === 0) score += 1;
      // Probe-quality warnings are actionable NOW: malformed commands are the
      // dominant failure mode, so the hygiene warning must survive the
      // 500-char prompt cap — boost it near the top.
      if (e.type === 'probe-quality' && (e.attempts || 0) >= 2) score += 2;
      return { e, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.filter((s) => s.score > 0).slice(0, limit).map((s) => s.e);
  } catch {
    return [];
  }
}

/**
 * Concise, actionable prompt section. The model gets directives, not data
 * dumps — each line is a "try this first" or "don't waste time on this".
 */
export function formatGlobalMemoryForPrompt(memories) {
  if (!memories || memories.length === 0) return '';
  const lines = memories.map((m) => {
    const rate = `${m.successes || 0}/${m.attempts || 0}`;
    if (m.type === 'chain') {
      return `\u2022 Chain pattern [${m.appType}] (${rate} worked): ${m.context} — ${m.note}`;
    }
    if (m.type === 'fingerprint') {
      return `\u2022 Lesson: ${m.note}`;
    }
    // PROBE QUALITY (19 Oct 2026, solver #121): malformed probes are a
    // command-construction signal, not a technique verdict. Rendered as a
    // distinct, compounding hygiene warning — the dominant failure mode for
    // business-logic probes, and a static note was not enough.
    if (m.type === 'probe-quality') {
      const n = m.attempts || 0;
      return `\u2022 COMMAND HYGIENE [${m.appType}]: ${n} recent ${m.technique.toUpperCase()} probe(s) were malformed and never reached the target. Fix command construction FIRST — ground every URL to recon-discovered endpoints before attacking.`;
    }
    const verdict = (m.successes || 0) > 0
      ? 'try early'
      : (m.attempts || 0) >= 3 ? 'deprioritise until a new approach' : 'worth trying';
    const where = m.context ? ` — ${m.context}` : '';
    return `\u2022 ${m.technique.toUpperCase()} [${m.appType}] (${rate} succeeded): ${verdict}${where}.`;
  });
  return `\n--- GLOBAL MEMORY (lessons from ALL past hunts — start smarter) ---\n` +
    lines.join('\n');
}

/**
 * Seed the store with what the team learned on 19 Oct 2026 (Juice Shop
 * benchmark era). Idempotent: does nothing when the file already has data.
 */
export function seedGlobalMemory() {
  try {
    if (readAll().length > 0) return false;
    const seeds = [
      {
        type: 'technique', technique: 'sqli', target: 'Juice Shop lab',
        appType: 'ecommerce', techStack: ['Node.js', 'Express'],
        success: true, attempts: 3, successes: 1,
        payload: `{"email":"admin@juice-sh.op' OR 1=1--","password":"x"}`,
        context: 'POST /rest/user/login (Juice Shop)',
        note: 'SQLi auth bypass returned a valid admin JWT. Try first on login forms.',
        firstSeen: '2026-10-19T09:29:45.689Z',
      },
      {
        type: 'chain', technique: 'chain', target: 'Juice Shop lab',
        appType: 'ecommerce', techStack: ['Node.js', 'Express'],
        success: true, attempts: 1, successes: 1,
        payload: '',
        context: 'SQLi → JWT extraction → priv-esc/IDOR probes',
        note: 'Chain pattern proven end-to-end: a verified finding yielded an admin JWT and chain-pursuit tests executed with it. Reuse whenever you hold a fresh artifact.',
        firstSeen: '2026-10-19T12:25:47.000Z',
      },
      {
        type: 'technique', technique: 'xss', target: 'Juice Shop lab',
        appType: 'ecommerce', techStack: ['Node.js', 'Express'],
        success: false, attempts: 12, successes: 0,
        payload: '',
        context: 'GET /rest/products/search (Juice Shop)',
        note: 'Reflected XSS on search endpoints: 0/12 — deprioritise until a new approach.',
        firstSeen: '2026-10-19T00:00:00.000Z',
      },
      {
        type: 'fingerprint', technique: 'placeholder', target: '',
        appType: 'unknown', techStack: [],
        success: false, attempts: 5, successes: 0,
        payload: '',
        context: 'model command generation',
        note: 'The model sometimes emits literal placeholders ([target], <target>, {target}, http://target, http://TARGET, http://app) instead of the concrete target URL. Deterministic substitution resolves these before execution — if a command fails on DNS, check for a missed placeholder spelling.',
        firstSeen: '2026-10-19T00:00:00.000Z',
      },
      {
        type: 'technique', technique: 'business-logic', target: 'Juice Shop lab',
        appType: 'ecommerce', techStack: ['Node.js', 'Express'],
        success: false, attempts: 6, successes: 0,
        payload: '',
        context: 'price manipulation probes (Juice Shop basket)',
        note: 'Business-logic probes often ship with malformed URLs (fake domains, bare hostnames). Ground every command to recon-discovered endpoints before executing.',
        firstSeen: '2026-10-19T00:00:00.000Z',
      },
    ];
    const now = new Date().toISOString();
    writeAll(seeds.map((s) => ({
      at: s.firstSeen || now,
      lastSeen: now,
      ...s,
    })));
    return true;
  } catch {
    return false;
  }
}
