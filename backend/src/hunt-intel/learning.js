// Dark Matter hunt-intel — learning loop (ORIGINAL IMPLEMENTATION).
//
// Research verdict (round 2, 13 Oct 2026): NO KNOWN REPO implements "a pentest
// agent that gets better at offensive strategy from each hunt." Components
// exist (mem0 memory API, hindsight reflection, pentestagent shadow graph)
// but nobody does the CLOSED LOOP. This module is that loop, built from
// scratch:
//
//   1. RECORD   — every hunt persists (target profile → techniques tried →
//                 what yielded findings) to experience.jsonl
//   2. REFLECT  — post-hunt pass distills "what worked" into playbook.json
//                 (strategy lessons, not raw findings)
//   3. REPLAY   — next hunt loads lessons for similar targets BEFORE planning
//                 and replays successful sequences first
//
// This is how Dark Matter compounds: hunt #100 starts smarter than hunt #1.

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

function expFile() {
  return path.join(config.dataDir, 'experience.jsonl');
}
function playbookFile() {
  return path.join(config.dataDir, 'playbook.json');
}

function readJsonl(file) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

function readPlaybook() {
  try {
    return JSON.parse(fs.readFileSync(playbookFile(), 'utf8'));
  } catch {
    return { lessons: [] };
  }
}

function writePlaybook(pb) {
  try {
    fs.mkdirSync(path.dirname(playbookFile()), { recursive: true });
    fs.writeFileSync(playbookFile(), JSON.stringify(pb, null, 2));
  } catch { /* best-effort */ }
}

/**
 * Target profile: coarse fingerprint used to match similar targets.
 * e.g. { stack: 'laravel', hasApi: true, hasAuth: true, appType: 'ecommerce' }
 */
export function recordHuntExperience({ huntId, target, profile, techniques, findings }) {
  const entry = {
    huntId,
    target,
    profile: profile || {},
    techniques: techniques || [], // [{name, triedAt}]
    yields: (findings || []).map((f) => ({
      technique: f.technique || f.source || 'unknown',
      class: f.class || f.type || 'unknown',
      severity: f.severity || f.exploitability || 'unknown',
    })),
    at: new Date().toISOString(),
  };
  try {
    fs.mkdirSync(path.dirname(expFile()), { recursive: true });
    fs.appendFileSync(expFile(), JSON.stringify(entry) + '\n');
  } catch { /* best-effort */ }
  return entry;
}

/**
 * Post-hunt reflection: which techniques actually yielded findings?
 * Distills into playbook lessons: "for {profile} targets, {technique}
 * yielded {n} findings (hit rate {x})".
 */
export function reflectHunt(huntId) {
  const exps = readJsonl(expFile());
  const exp = exps.find((e) => e.huntId === huntId);
  if (!exp) return null;
  const byTech = {};
  for (const y of exp.yields) {
    const t = y.technique;
    byTech[t] = byTech[t] || { technique: t, findings: 0, high: 0 };
    byTech[t].findings += 1;
    if (['critical', 'high', 'LIKELY_EXPLOITABLE'].includes(String(y.severity))) {
      byTech[t].high += 1;
    }
  }
  const tried = new Set((exp.techniques || []).map((t) => t.name || t));
  const lessons = Object.values(byTech).map((b) => ({
    profile: exp.profile,
    technique: b.technique,
    findings: b.findings,
    high: b.high,
    hitRate: tried.size ? Number((b.findings / tried.size).toFixed(2)) : 0,
    at: new Date().toISOString(),
  }));
  // Merge into playbook (upsert by profile+technique).
  const pb = readPlaybook();
  for (const l of lessons) {
    const key = JSON.stringify([l.profile.appType || '', l.profile.stack || '', l.technique]);
    const idx = pb.lessons.findIndex(
      (x) => JSON.stringify([x.profile.appType || '', x.profile.stack || '', x.technique]) === key
    );
    if (idx >= 0) {
      const prev = pb.lessons[idx];
      pb.lessons[idx] = {
        ...prev,
        findings: prev.findings + l.findings,
        high: prev.high + l.high,
        hunts: (prev.hunts || 1) + 1,
        at: l.at,
      };
    } else {
      pb.lessons.push({ ...l, hunts: 1 });
    }
  }
  writePlaybook(pb);
  return lessons;
}

function profileMatch(lessonProfile, targetProfile) {
  let score = 0;
  if (lessonProfile.appType && lessonProfile.appType === targetProfile.appType) score += 3;
  if (lessonProfile.stack && lessonProfile.stack === targetProfile.stack) score += 2;
  if (lessonProfile.hasApi === targetProfile.hasApi) score += 1;
  if (lessonProfile.hasAuth === targetProfile.hasAuth) score += 1;
  return score;
}

/**
 * Before planning a hunt: retrieve lessons for similar targets,
 * ranked by (profile match × historical yield). The planner replays
 * the winners first.
 */
export function getPlaybook(targetProfile = {}) {
  const pb = readPlaybook();
  return pb.lessons
    .map((l) => ({
      ...l,
      relevance: profileMatch(l.profile || {}, targetProfile) * (1 + (l.high || 0)),
    }))
    .filter((l) => l.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 10)
    .map((l) => ({
      technique: l.technique,
      why: `yielded ${l.findings} findings (${l.high} high) across ${l.hunts} similar hunt(s)`,
      profile: l.profile,
    }));
}

/** Human-readable playbook summary for reports / chat. */
export function playbookSummary() {
  const pb = readPlaybook();
  if (!pb.lessons.length) return 'Playbook is empty — it fills as hunts complete.';
  const top = [...pb.lessons].sort((a, b) => (b.high || 0) - (a.high || 0)).slice(0, 5);
  return (
    `Learned across hunts: ` +
    top.map((l) => `${l.technique} (${l.high} high in ${l.hunts} hunts)`).join('; ')
  );
}
