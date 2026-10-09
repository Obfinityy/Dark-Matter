/**
 * wave76ACore.js — Infinity AI · Dark-Matter · Wave 76A
 * Template sharing and hunt learning foundations, ideas 53001–53020.
 * Pure logic for template link sharing, scheduled review, retirement
 * archive, playbook export, contribution breakdown, payload honor
 * roll, first-click analysis, strategy attribution, recon payoff,
 * technique yield, false starts, lucky hits, pivot log, hunch
 * register, timeboxing, depth-vs-breadth tradeoff, authentication
 * lift, human-touch delta, reproducibility check, and diminishing
 * returns curve. Every helper takes explicit inputs, returns a
 * structured view model, and never mutates arguments.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE76_A_IDEAS = [
  { id: 53001, title: 'Template sharing via link', skip: false },
  { id: 53002, title: 'Template scheduled review (post-hunt)', skip: false },
  { id: 53003, title: 'Template retirement archive', skip: false },
  { id: 53004, title: 'Template-to-playbook export', skip: false },
  { id: 53005, title: 'Per-Hunt Contribution Breakdown', skip: false },
  { id: 53006, title: 'Winning Payload Roll of Honor', skip: false },
  { id: 53007, title: 'First-Click Analysis', skip: false },
  { id: 53008, title: 'Strategy Attribution Ledger', skip: false },
  { id: 53009, title: 'Recon Payoff Audit', skip: false },
  { id: 53010, title: 'Technique Yield Ranking', skip: false },
  { id: 53011, title: 'False-Start Counter', skip: false },
  { id: 53012, title: 'Lucky Hit Separator', skip: false },
  { id: 53013, title: 'Pivoting Moment Log', skip: false },
  { id: 53014, title: 'Hunches-Validated Register', skip: false },
  { id: 53015, title: 'Timeboxing Effectiveness Score', skip: false },
  { id: 53016, title: 'Depth-vs-Breadth Tradeoff Analysis', skip: false },
  { id: 53017, title: 'Authentication Lift Measurement', skip: false },
  { id: 53018, title: 'Human-Touch Delta', skip: false },
  { id: 53019, title: 'Re-run Reproducibility Check', skip: false },
  { id: 53020, title: 'Diminishing Returns Curve', skip: false },
];

function hashText(text) {
  let h = 0;
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}
function slug(text) {
  return String(text || 'template').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 44) || 'template';
}

/** Share a template through a deterministic link (idea 53001). */
export function createTemplateShareLink(template = {}, options = {}) {
  const templateId = template.id || template.templateId || 'tpl-unknown';
  const name = template.name || 'Untitled template';
  const expiresDays = Math.max(1, Number(options.expiresDays || 7));
  const permissionScope = ['view', 'run'].includes(String(options.permission || '').toLowerCase()) ? String(options.permission).toLowerCase() : 'view';
  const code = hashText(`${templateId}|${name}|${expiresDays}|${permissionScope}`);
  const shareLink = `https://link.infinity-ai.example/t/${slug(templateId)}/${code}`;
  return { templateId, templateName: name, shareLink, code, expiresDays, permissionScope, summary: `Infinity AI created a ${permissionScope} share link for ${templateId} valid ${expiresDays} day(s).` };
}

/** Schedule the post-hunt template review (idea 53002). */
export function scheduleTemplateReview(template = {}, hunt = {}, options = {}) {
  const templateId = template.id || template.templateId || null;
  const cadenceDays = Math.max(1, Number(options.cadenceDays || template.reviewCadenceDays || 30));
  const completedAt = hunt.completedAt || '2026-10-09T00:00:00Z';
  const base = Date.parse(completedAt);
  const dueAtMs = Number.isFinite(base) ? base + cadenceDays * 86400000 : Date.parse('2026-11-08T00:00:00Z');
  const dueAt = new Date(dueAtMs).toISOString();
  const overdue = Date.parse(hunt.now || '2026-10-09T00:00:00Z') > dueAtMs;
  return { templateId, huntId: hunt.huntId || hunt.id || null, cadenceDays, dueAt, overdue, summary: `Infinity AI scheduled a review for ${templateId || 'the template'} in ${cadenceDays} day(s) (due ${dueAt.slice(0, 10)}).` };
}

/** Archive a retired template with reason (idea 53003). */
export function archiveRetiredTemplate(template = {}, stats = {}, options = {}) {
  const templateId = template.id || template.templateId || null;
  const uses = Number(stats.uses ?? template.uses ?? 0);
  const reason = String(options.reason || (uses === 0 ? 'never used' : 'manual retirement')).slice(0, 120);
  const archiveId = `arc-${slug(templateId || 'template')}-${hashText(templateId || 'x').slice(0, 6)}`;
  const frozen = { templateId, name: template.name || 'Untitled template', uses, reason, archived: true };
  return { templateId, archiveId, frozen, reason, summary: `Infinity AI archived ${templateId || 'the template'} (${reason}) as ${archiveId}.` };
}

/** Export a template as a runnable playbook (idea 53004). */
export function exportTemplateToPlaybook(template = {}, findings = [], options = {}) {
  const templateId = template.id || template.templateId || null;
  const steps = (findings || []).map((f, i) => ({ step: i + 1, check: f.title || 'Untitled finding', findingId: f.id || null, target: f.target || null }));
  const playbook = { id: `pb-${slug(templateId || 'template')}`, templateId, name: `${template.name || 'Template'} playbook`, steps, format: 'infinity-playbook-v1' };
  return { templateId, playbook, playbookId: playbook.id, stepCount: steps.length, summary: `Infinity AI exported ${templateId || 'the template'} as playbook ${playbook.id} with ${steps.length} step(s).` };
}

/** Break down who contributed what in one hunt (idea 53005). */
export function breakdownHuntContributions(hunt = {}, contributions = [], options = {}) {
  const rows = (contributions || []).map(c => ({ contributor: c.contributor || c.agent || 'unknown', findings: Number(c.findings || 0), probes: Number(c.probes || 0), verified: Number(c.verified || 0) }));
  const totalFindings = rows.reduce((s, r) => s + r.findings, 0);
  const enriched = rows.map(r => ({ ...r, sharePct: totalFindings ? Math.round((r.findings / totalFindings) * 1000) / 10 : 0 })).sort((a, b) => b.findings - a.findings || String(a.contributor).localeCompare(String(b.contributor)));
  return { huntId: hunt.huntId || hunt.id || null, rows: enriched, count: enriched.length, totalFindings, top: enriched[0] || null, summary: `Infinity AI broke down contributions for ${hunt.huntId || 'the hunt'} across ${enriched.length} contributor(s).` };
}

/** Build the roll of honor for winning payloads (idea 53006). */
export function buildWinningPayloadHonorRoll(hunt = {}, payloads = [], options = {}) {
  const winners = (payloads || []).filter(p => p.success === true || p.won === true || Number(p.score || 0) >= 10).map(p => ({ payloadId: p.id || p.payloadId || null, name: p.name || 'Untitled payload', score: Number(p.score || 0), target: p.target || null })).sort((a, b) => b.score - a.score || String(a.payloadId).localeCompare(String(b.payloadId)));
  return { huntId: hunt.huntId || hunt.id || null, winners, winnerCount: winners.length, top: winners[0] || null, summary: `Infinity AI placed ${winners.length} winning payload(s) on the honor roll for ${hunt.huntId || 'the hunt'}.` };
}

/** Analyze the first meaningful click in a hunt (idea 53007). */
export function analyzeFirstClick(events = [], options = {}) {
  const sorted = [...(events || [])].sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  const first = sorted.find(e => e.type === 'click' || e.action === 'click') || sorted[0] || null;
  const deltaSeconds = first && sorted[0] ? Math.max(0, Math.round((Date.parse(first.at || '') - Date.parse(sorted[0].at || '')) / 1000) || 0) : 0;
  return { first, firstAction: first ? (first.label || first.target || 'click') : null, eventCount: sorted.length, delaySeconds: deltaSeconds, summary: `Infinity AI found the first click (${first ? (first.label || first.target || 'click') : 'none'}) after ${deltaSeconds}s across ${sorted.length} event(s).` };
}

/** Attribute findings to strategies in a ledger (idea 53008). */
export function buildStrategyAttributionLedger(hunt = {}, strategies = [], options = {}) {
  const entries = (strategies || []).map(s => ({ strategyId: s.id || s.strategyId || null, name: s.name || 'Untitled strategy', findings: Number(s.findings || 0), falsePositives: Number(s.falsePositives || 0) })).map(s => ({ ...s, netYield: s.findings - s.falsePositives })).sort((a, b) => b.netYield - a.netYield);
  const totalNet = entries.reduce((s, e) => s + e.netYield, 0);
  return { huntId: hunt.huntId || hunt.id || null, entries, count: entries.length, totalNetYield: totalNet, best: entries[0] || null, summary: `Infinity AI attributed ${totalNet} net finding(s) across ${entries.length} strategy(ies) for ${hunt.huntId || 'the hunt'}.` };
}

/** Audit whether reconnaissance paid off (idea 53009). */
export function auditReconPayoff(hunt = {}, reconSteps = [], options = {}) {
  const steps = (reconSteps || []).map(r => ({ stepId: r.id || r.stepId || null, name: r.name || 'Recon step', costMinutes: Number(r.costMinutes || 0), findings: Number(r.findings || 0) })).map(r => ({ ...r, yieldPerMinute: r.costMinutes ? Math.round((r.findings / r.costMinutes) * 100) / 100 : 0 }));
  const totalCost = steps.reduce((s, r) => s + r.costMinutes, 0);
  const totalFindings = steps.reduce((s, r) => s + r.findings, 0);
  const paidOff = steps.filter(s => s.findings > 0);
  return { huntId: hunt.huntId || hunt.id || null, steps, stepCount: steps.length, totalCostMinutes: totalCost, totalFindings, payoffRatio: steps.length ? Math.round((paidOff.length / steps.length) * 100) / 100 : 0, summary: `Infinity AI audited recon payoff for ${hunt.huntId || 'the hunt'}: ${paidOff.length}/${steps.length} step(s) produced findings.` };
}

/** Rank hunting techniques by yield (idea 53010). */
export function rankTechniqueYield(techniques = [], findings = [], options = {}) {
  const rows = (techniques || []).map(t => {
    const mine = (findings || []).filter(f => f.techniqueId === t.id || f.technique === t.id || f.techniqueId === t.techniqueId);
    return { techniqueId: t.id || t.techniqueId || null, name: t.name || 'Untitled technique', attempts: Number(t.attempts || 0), findings: mine.length, yieldRate: Number(t.attempts || 0) ? Math.round((mine.length / Number(t.attempts || 0)) * 100) / 100 : 0 };
  }).sort((a, b) => b.yieldRate - a.yieldRate || b.findings - a.findings);
  return { rows, count: rows.length, best: rows[0] || null, summary: `Infinity AI ranked ${rows.length} technique(s); best is ${rows[0] ? rows[0].techniqueId : 'none'} (yield ${rows[0] ? rows[0].yieldRate : 0}).` };
}

/** Count probes that never produced value (idea 53011). */
export function countFalseStarts(probes = [], options = {}) {
  const list = probes || [];
  const falseStarts = list.filter(p => p.abandoned === true || p.result === 'abandoned' || Number(p.findings || 0) === 0 && String(p.status || '').toLowerCase() === 'stopped');
  const ratio = list.length ? Math.round((falseStarts.length / list.length) * 100) / 100 : 0;
  return { totalProbes: list.length, falseStartCount: falseStarts.length, falseStartRatio: ratio, summary: `Infinity AI counted ${falseStarts.length} false start(s) out of ${list.length} probe(s) (${ratio}).` };
}

/** Separate lucky hits from systematic wins (idea 53012). */
export function separateLuckyHits(findings = [], options = {}) {
  const minHits = Number(options.minHitsForPattern || 2);
  const groups = {};
  for (const f of findings || []) {
    const key = f.techniqueId || f.technique || f.type || 'unknown';
    groups[key] = (groups[key] || 0) + 1;
  }
  const lucky = (findings || []).filter(f => (groups[f.techniqueId || f.technique || f.type || 'unknown'] || 0) < minHits).map(f => ({ findingId: f.id || null, technique: f.techniqueId || f.technique || f.type || 'unknown' }));
  const systematic = (findings || []).filter(f => (groups[f.techniqueId || f.technique || f.type || 'unknown'] || 0) >= minHits).map(f => ({ findingId: f.id || null, technique: f.techniqueId || f.technique || f.type || 'unknown' }));
  return { lucky, systematic, luckyCount: lucky.length, systematicCount: systematic.length, summary: `Infinity AI separated ${lucky.length} lucky hit(s) from ${systematic.length} systematic finding(s).` };
}

/** Log the moments where the hunt changed direction (idea 53013). */
export function logPivotingMoments(events = [], options = {}) {
  const pivots = (events || []).filter(e => e.pivot === true || e.type === 'pivot' || /pivot|shift|redirect/i.test(String(e.label || ''))).map(e => ({ at: e.at || null, label: String(e.label || 'pivot').slice(0, 120), from: e.from || null, to: e.to || null })).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return { pivots, pivotCount: pivots.length, summary: `Infinity AI logged ${pivots.length} pivoting moment(s) in the hunt.` };
}

/** Register hunches that were later validated (idea 53014). */
export function registerValidatedHunches(hunches = [], findings = [], options = {}) {
  const findingIds = new Set((findings || []).map(f => f.id));
  const entries = (hunches || []).map(h => ({ hunchId: h.id || h.hunchId || null, guess: String(h.guess || h.text || '').slice(0, 120), validated: Boolean(h.validated === true || findingIds.has(h.linkedFindingId) || h.status === 'validated'), linkedFindingId: h.linkedFindingId || null })).sort((a, b) => String(a.hunchId).localeCompare(String(b.hunchId)));
  const validated = entries.filter(e => e.validated);
  const accuracy = entries.length ? Math.round((validated.length / entries.length) * 100) / 100 : 0;
  return { entries, count: entries.length, validatedCount: validated.length, accuracy, summary: `Infinity AI registered ${validated.length}/${entries.length} validated hunch(es) (accuracy ${accuracy}).` };
}

/** Score how well timeboxes worked (idea 53015). */
export function scoreTimeboxingEffectiveness(phases = [], options = {}) {
  const rows = (phases || []).map(p => ({ phaseId: p.id || p.phaseId || null, name: p.name || 'Phase', plannedMinutes: Number(p.plannedMinutes || 0), actualMinutes: Number(p.actualMinutes || 0), findings: Number(p.findings || 0) })).map(p => ({ ...p, adherence: p.plannedMinutes ? Math.round((1 - Math.abs(p.actualMinutes - p.plannedMinutes) / p.plannedMinutes) * 100) / 100 : 0 }));
  const avgAdherence = rows.length ? Math.round((rows.reduce((s, r) => s + r.adherence, 0) / rows.length) * 100) / 100 : 0;
  const score = Math.max(0, Math.min(1, avgAdherence));
  return { rows, count: rows.length, averageAdherence: avgAdherence, score, summary: `Infinity AI scored timeboxing effectiveness at ${score} across ${rows.length} phase(s).` };
}

/** Compare depth-first versus breadth-first tradeoffs (idea 53016). */
export function analyzeDepthVsBreadth(probes = [], options = {}) {
  const deep = (probes || []).filter(p => String(p.mode || '').toLowerCase() === 'deep');
  const broad = (probes || []).filter(p => String(p.mode || '').toLowerCase() === 'broad');
  const sumFindings = arr => arr.reduce((s, x) => s + Number(x.findings || 0), 0);
  const deepFindings = sumFindings(deep);
  const broadFindings = sumFindings(broad);
  const winner = deepFindings === broadFindings ? 'tie' : deepFindings > broadFindings ? 'deep' : 'broad';
  return { deep: { count: deep.length, findings: deepFindings }, broad: { count: broad.length, findings: broadFindings }, winner, summary: `Infinity AI depth-vs-breadth: deep ${deepFindings} vs broad ${broadFindings} (winner ${winner}).` };
}

/** Measure how much authentication changed results (idea 53017). */
export function measureAuthLift(hunt = {}, options = {}) {
  const anon = Number(hunt.anonymousFindings ?? hunt.anonFindings ?? 0);
  const authed = Number(hunt.authenticatedFindings ?? hunt.authedFindings ?? 0);
  const lift = anon > 0 ? Math.round(((authed - anon) / anon) * 100) / 100 : (authed > 0 ? 1 : 0);
  const liftPct = Math.round(lift * 100);
  return { huntId: hunt.huntId || hunt.id || null, anonymousFindings: anon, authenticatedFindings: authed, lift, liftPct, summary: `Infinity AI measured auth lift for ${hunt.huntId || 'the hunt'} at ${liftPct}% (${anon} to ${authed} finding(s)).` };
}

/** Measure the delta added by human input (idea 53018). */
export function measureHumanTouchDelta(hunts = [], options = {}) {
  const human = (hunts || []).filter(h => h.humanAssisted === true || h.withHuman === true);
  const auto = (hunts || []).filter(h => !(h.humanAssisted === true || h.withHuman === true));
  const avg = arr => arr.length ? Math.round(((arr.reduce((s, x) => s + Number((x.findings || []).length || x.findingCount || 0), 0) / arr.length) * 10) / 10) : 0;
  const humanAvg = avg(human);
  const autoAvg = avg(auto);
  const delta = Math.round((humanAvg - autoAvg) * 10) / 10;
  return { humanAvg, autoAvg, delta, humanCount: human.length, autoCount: auto.length, summary: `Infinity AI human-touch delta is ${delta} finding(s) per hunt (${humanAvg} human vs ${autoAvg} automated).` };
}

/** Verify a hunt reproduces on re-run (idea 53019). */
export function checkRerunReproducibility(runs = [], options = {}) {
  const list = runs || [];
  const sets = list.map(r => [...new Set((r.findings || []).map(f => f.id || f.title || '').map(String))].sort());
  const first = sets[0] || [];
  const stable = sets.every(s => s.join('|') === first.join('|'));
  const overlap = sets.length > 1 ? Math.round((first.filter(id => sets.every(s => s.includes(id))).length / (first.length || 1)) * 100) / 100 : 1;
  return { runCount: list.length, stable, overlapRatio: overlap, summary: `Infinity AI reproducibility across ${list.length} run(s): ${stable ? 'stable' : 'drift detected'} (overlap ${overlap}).` };
}

/** Build the diminishing returns curve for a hunt (idea 53020). */
export function computeDiminishingReturnsCurve(phases = [], options = {}) {
  const ordered = [...(phases || [])].sort((a, b) => Number(a.order || 0) - Number(b.order || 0)).map((p, i) => ({ phase: p.name || p.id || `phase-${i + 1}`, minutes: Number(p.minutes || 0), findings: Number(p.findings || 0), cumulativeFindings: 0 }));
  let acc = 0;
  for (const row of ordered) { acc += row.findings; row.cumulativeFindings = acc; }
  const marginal = ordered.map((r, i) => ({ phase: r.phase, marginal: r.findings, cumulative: r.cumulativeFindings }));
  const kneeIndex = marginal.findIndex((m, i) => i > 0 && m.marginal <= (marginal[0]?.marginal || 0) * 0.25);
  return { curve: marginal, totalFindings: acc, kneeIndex: kneeIndex === -1 ? ordered.length - 1 : kneeIndex, summary: `Infinity AI built the diminishing returns curve (${acc} finding(s), knee at index ${kneeIndex === -1 ? ordered.length - 1 : kneeIndex}).` };
}
