/**
 * explainabilityRound3Core.js — wave 37 (ideas 51441–51452): explainability
 * round 3 — pure logic.
 *
 * FAQ generation, explanation diffing, confidence-to-clarity meters,
 * plain-language titles, one-line takeaways, sharing controls, audio
 * scripts, explanation analytics, live updates, cross-finding summaries,
 * citations, and explain-while-you-watch narration. Template-driven from
 * the finding's own fields — never canned filler.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic: no Date.now(), no Math.random().
 *
 * finding: { id, type, severity, title, location, evidence?, firstSeen?,
 *            confidence?, businessUnit? }
 * type is a kebab-case key like 'sql-injection'.
 */

export const WAVE37_EX_START = 51441;
export const WAVE37_EX_END = 51452;

/** Registry of the 12 explainability-round-3 ideas — completeness is testable. */
export const WAVE37_EX_IDEAS = [
  [51441, 'faq generator', 'Anticipated stakeholder questions answered for each finding'],
  [51442, 'explanation diff', 'See how the explanation changed as evidence grew'],
  [51443, 'confidence-to-clarity meter', 'How solid the evidence is, expressed without jargon'],
  [51444, 'plain-language titles', 'A non-technical headline next to every technical name'],
  [51445, 'one-line takeaways', 'The single most important sentence about each finding'],
  [51446, 'explanation sharing controls', 'Choose which explanation depth each stakeholder receives'],
  [51447, 'audio explanation clips', 'Short listenable summaries per finding for busy stakeholders'],
  [51448, 'explanation analytics', 'Which explanations stakeholders actually opened and understood'],
  [51449, 'live explanation updates', 'Explanations refresh automatically as confidence changes'],
  [51450, 'cross-finding plain summaries', '"Overall, your login system has…" synthesis in plain words'],
  [51451, 'explanation citations', 'Sources and evidence listed in reader-friendly form'],
  [51452, 'explain-while-you-watch', 'Explanations generated live as you watch the proof build'],
];

/* --- shared vocabulary ------------------------------------------------------ */

const SEVERITY_WORDS = {
  critical: 'an urgent problem that needs fixing right away',
  high: 'a serious problem worth fixing soon',
  medium: 'a real problem that should be scheduled',
  low: 'a minor issue worth knowing about',
  info: 'something worth knowing, not a vulnerability by itself',
};

const TYPE_WORDS = {
  'sql-injection': 'the database behind the site could be tricked into giving up data',
  'xss': 'attackers could run their own scripts in other people\'s browsers',
  'ssrf': 'the server could be tricked into opening connections it should not',
  'idor': 'one user could see or change another user\'s data',
  'cors-misconfiguration': 'other websites might be able to read data meant only for yours',
  'open-redirect': 'attackers could craft links that send your users to fake sites',
  'jwt-weakness': 'the login tokens protecting the site have a flaw',
  'secret-exposure': 'a private key or password was left somewhere it should not be',
  'subdomain-takeover': 'an attacker could take over a piece of your domain',
};

export function severityWord(severity) {
  return SEVERITY_WORDS[String(severity || '').toLowerCase()] || 'an issue worth reviewing';
}

export function typeWord(type) {
  return TYPE_WORDS[String(type || '').toLowerCase()] || 'a security issue was found';
}

export function locOf(f) {
  return f.location || f.url || 'the tested target';
}

/* --- 51441 · FAQ generator -------------------------------------------------- */

export function faqForFinding(f) {
  const sev = severityWord(f.severity);
  const typ = typeWord(f.type);
  const loc = locOf(f);
  return [
    {
      q: 'What does this mean in plain words?',
      a: `It means ${typ}. In practical terms: ${loc} has ${sev}.`,
    },
    {
      q: 'How sure are we?',
      a: confidenceWord(f.confidence),
    },
    {
      q: 'What could an attacker actually do?',
      a: `With this weakness, an attacker who knows how would act against ${loc}. The finding includes proof steps showing it is real, not theoretical.`,
    },
    {
      q: 'What should we do about it?',
      a: `Confirm the fix with your development team, then ask for a re-test of ${loc} so the finding can be closed with evidence.`,
    },
    {
      q: 'Does this affect our customers?',
      a: f.businessUnit
        ? `It sits in the ${f.businessUnit} area — the customer-facing impact depends on which data that area handles.`
        : 'That depends on which data the affected area handles — worth asking the team that owns it.',
    },
  ];
}

function confidenceWord(c) {
  const n = Number(c);
  if (!Number.isFinite(n)) return 'Confidence has not been scored yet — treat this as an early signal.';
  if (n >= 80) return `Very confident (${n}%). The evidence directly proves the issue.`;
  if (n >= 50) return `Moderately confident (${n}%). The evidence is strong but could use one more confirmation.`;
  return `Early signal (${n}%). Worth a look, but more evidence is needed before acting.`;
}

/* --- 51442 · explanation diff ----------------------------------------------- */

export function diffExplanations(oldText, newText) {
  const oldLines = String(oldText || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const newLines = String(newText || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  const added = newLines.filter((l) => !oldSet.has(l));
  const removed = oldLines.filter((l) => !newSet.has(l));
  return {
    added,
    removed,
    unchanged: newLines.filter((l) => oldSet.has(l)),
    changed: added.length > 0 || removed.length > 0,
  };
}

/* --- 51443 · confidence-to-clarity meter -------------------------------------- */

export const CLARITY_BANDS = [
  { min: 80, label: 'Rock solid', sentence: 'The proof is direct — you can trust this one.' },
  { min: 60, label: 'Strong', sentence: 'Good evidence, nearly complete.' },
  { min: 40, label: 'Building', sentence: 'Promising leads, still gathering proof.' },
  { min: 0, label: 'Early signal', sentence: 'Something looks off — investigating.' },
];

export function clarityMeter(finding) {
  const n = Math.max(0, Math.min(100, Number(finding.confidence) || 0));
  const band = CLARITY_BANDS.find((b) => n >= b.min) || CLARITY_BANDS[CLARITY_BANDS.length - 1];
  return { score: n, label: band.label, sentence: band.sentence };
}

/* --- 51444 · plain-language titles -------------------------------------------- */

export function plainTitle(f) {
  const loc = locOf(f);
  return `${titleCase(String(f.type || 'issue').replace(/-/g, ' '))} found at ${loc}`;
}

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/* --- 51445 · one-line takeaways ---------------------------------------------- */

export function oneLineTakeaway(f) {
  return `${plainTitle(f)} — ${severityWord(f.severity)}.`;
}

/* --- 51446 · explanation sharing controls ------------------------------------- */

export const SHARE_LEVELS = [
  { id: 'exec', label: 'Executive', description: 'One-liner + severity only' },
  { id: 'team', label: 'Team', description: 'Plain title + takeaway + what to do' },
  { id: 'tech', label: 'Technical', description: 'Full detail with evidence links' },
];

export function sharePackage(f, levelId) {
  const level = SHARE_LEVELS.find((l) => l.id === levelId) || SHARE_LEVELS[1];
  const pkg = { level: level.id, levelLabel: level.label, takeaway: oneLineTakeaway(f) };
  if (level.id === 'team' || level.id === 'tech') {
    pkg.title = plainTitle(f);
    pkg.faq = faqForFinding(f).slice(0, 3);
  }
  if (level.id === 'tech') {
    pkg.evidence = f.evidence || [];
    pkg.clarity = clarityMeter(f);
  }
  return pkg;
}

/* --- 51447 · audio explanation clips ------------------------------------------ */

export const AUDIO_WPM = 150;

export function audioScript(f) {
  const script = [
    `Finding: ${plainTitle(f)}.`,
    oneLineTakeaway(f),
    `Confidence: ${clarityMeter(f).label} — ${clarityMeter(f).sentence}`,
    'Next step: confirm the fix with your team and request a re-test.',
  ].join(' ');
  const seconds = Math.max(1, Math.round((script.split(/\s+/).length / AUDIO_WPM) * 60));
  return { script, seconds };
}

/* --- 51448 · explanation analytics --------------------------------------------- */

export function recordExplanationEvent(store, findingId, event) {
  if (!store[ findingId ]) store[ findingId ] = { opened: 0, understood: 0, shared: 0 };
  if (event in store[ findingId ]) store[ findingId ][ event ] += 1;
  return store[ findingId ];
}

export function analyticsSummary(store) {
  const ids = Object.keys(store);
  const totals = { opened: 0, understood: 0, shared: 0 };
  ids.forEach((id) => {
    totals.opened += store[ id ].opened;
    totals.understood += store[ id ].understood;
    totals.shared += store[ id ].shared;
  });
  return {
    findings: ids.length,
    totals,
    comprehension: totals.opened > 0 ? Math.round((totals.understood / totals.opened) * 100) : 0,
  };
}

/* --- 51449 · live explanation updates ------------------------------------------ */

export function explanationStaleness(oldF, newF) {
  const changed = [];
  if (oldF.confidence !== newF.confidence) changed.push('confidence');
  if (oldF.severity !== newF.severity) changed.push('severity');
  if (JSON.stringify(oldF.evidence || []) !== JSON.stringify(newF.evidence || [])) changed.push('evidence');
  return { stale: changed.length > 0, changed };
}

/* --- 51450 · cross-finding plain summaries ------------------------------------- */

export function crossFindingSummary(findings, systemName) {
  const list = Array.isArray(findings) ? findings : [];
  if (list.length === 0) return `Overall, ${systemName || 'the system'} looks clean — no findings to report.`;
  const bySev = {};
  list.forEach((f) => {
    const s = String(f.severity || 'info').toLowerCase();
    bySev[ s ] = (bySev[ s ] || 0) + 1;
  });
  const parts = Object.entries(bySev).map(([s, n]) => `${n} ${s}`);
  const types = [...new Set(list.map((f) => String(f.type || 'issue').replace(/-/g, ' ')))];
  return (
    `Overall, ${systemName || 'the system'} has ${list.length} finding${list.length === 1 ? '' : 's'} ` +
    `(${parts.join(', ')}). The main themes are: ${types.slice(0, 3).join(', ')}. ` +
    `${bySev.critical ? 'The critical ones need attention first.' : 'Nothing needs emergency attention.'}`
  );
}

/* --- 51451 · explanation citations ---------------------------------------------- */

export function citationsFor(f) {
  const ev = Array.isArray(f.evidence) ? f.evidence : [];
  return ev.map((e, i) => ({
    n: i + 1,
    text: typeof e === 'string' ? e : e.summary || e.description || String(e),
    kind: typeof e === 'string' ? 'note' : e.kind || 'note',
  }));
}

/* --- 51452 · explain-while-you-watch -------------------------------------------- */

export function watchNarration(steps, index) {
  const s = (steps || [])[ index ];
  if (!s) return { done: true, text: 'Proof complete — all steps shown.' };
  return {
    done: false,
    step: index + 1,
    of: steps.length,
    text: `Step ${index + 1} of ${steps.length}: ${s}`,
  };
}
