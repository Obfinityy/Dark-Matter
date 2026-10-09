/**
 * wave88ACore.js — Infinity AI · Wave 88A
 * Knowledge base round 2, ideas 53481–53500: change notifications,
 * article bounties, quality rubrics, external sourcing with license
 * tracking, playbook redundancy delineation, search synonym expansion,
 * contribution onboarding, per-finding-type templates, annual audits,
 * staleness alerts, cross-linking suggestions, reading paths,
 * incident learnings, KB API rate limits, offline sync, contribution
 * recognition, difficulty labels, feedback triage, growth metrics,
 * and sunset archives.
 * Every helper takes explicit inputs, never mutates them, and
 * returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE88_A_IDEAS = [
  { id: 53481, title: 'KB Change Notifications', skip: false },
  { id: 53482, title: 'KB Article Bounties', skip: false },
  { id: 53483, title: 'KB Quality Rubrics', skip: false },
  { id: 53484, title: 'KB External Sourcing', skip: false },
  { id: 53485, title: 'KB Redundancy with Playbooks', skip: false },
  { id: 53486, title: 'KB Search Synonym Expansion', skip: false },
  { id: 53487, title: 'KB Contribution Onboarding', skip: false },
  { id: 53488, title: 'KB Article Templates per Finding Type', skip: false },
  { id: 53489, title: 'KB Annual Audits', skip: false },
  { id: 53490, title: 'KB Staleness Alerts', skip: false },
  { id: 53491, title: 'KB Cross-Linking Suggestions', skip: false },
  { id: 53492, title: 'KB Reading Paths', skip: false },
  { id: 53493, title: 'KB Incident Learnings Section', skip: false },
  { id: 53494, title: 'KB API Rate Limits', skip: false },
  { id: 53495, title: 'KB Offline Sync', skip: false },
  { id: 53496, title: 'KB Contribution Recognition', skip: false },
  { id: 53497, title: 'KB Article Difficulty Labels', skip: false },
  { id: 53498, title: 'KB Feedback Triage', skip: false },
  { id: 53499, title: 'KB Growth Metrics Dashboard', skip: false },
  { id: 53500, title: 'KB Sunset Archives', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function keyOf(it,fb='article'){return String(it.key||it.id||it.articleId||it.title||it.name||fb);}

/** Idea 53481 — KB Change Notifications. */
export function notifyKbChanges(changes = [], options = {}) {
  const threshold = num(options.significanceThreshold, 0.4);
  const rows = (changes || []).map(c => {
    const significance = clamp01(c.significance ?? c.changeScore ?? 0);
    const subscribers = Array.isArray(c.subscribers) ? c.subscribers.length : num(c.subscriberCount, 0);
    return { key: keyOf(c), title: String(c.title || keyOf(c)), significance, subscribers, notify: significance >= threshold && subscribers > 0 };
  }).sort((a, b) => b.significance - a.significance || String(a.key).localeCompare(String(b.key)));
  const notifyCount = rows.filter(r => r.notify).length;
  return { rows, count: rows.length, notifyCount, totalSubscribers: rows.reduce((s, r) => s + r.subscribers, 0), top: rows[0] || null, summary: `Infinity AI queued KB change notifications for ${notifyCount} significantly changed article(s).` };
}
/** Idea 53482 — KB Article Bounties. */
export function offerKbArticleBounties(gaps = [], options = {}) {
  const baseReward = num(options.baseReward, 100);
  const rows = (gaps || []).map(g => {
    const priority = clamp01(g.priority ?? g.gapScore ?? 0);
    const reward = round2(baseReward * (0.5 + priority));
    return { key: keyOf(g, 'gap'), topic: String(g.topic || g.title || keyOf(g, 'gap')), priority, reward, claimed: g.claimed === true };
  }).sort((a, b) => b.priority - a.priority || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, openCount: rows.filter(r => !r.claimed).length, totalReward: round2(rows.reduce((s, r) => s + r.reward, 0)), top: rows[0] || null, summary: `Infinity AI offers bounties on ${rows.filter(r => !r.claimed).length} high-priority KB gap(s).` };
}
/** Idea 53483 — KB Quality Rubrics. */
export function publishKbQualityRubrics(criteria = [], options = {}) {
  const rows = (criteria || []).map((c, i) => {
    const weight = num(c.weight, 1);
    return { key: String(c.key || c.name || `criterion-${i + 1}`), name: String(c.name || `Criterion ${i + 1}`), weight, maxScore: num(c.maxScore, 5), description: String(c.description || '') };
  }).sort((a, b) => b.weight - a.weight || String(a.key).localeCompare(String(b.key)));
  const totalWeight = round2(rows.reduce((s, r) => s + r.weight, 0));
  return { rows, count: rows.length, totalWeight, passingScore: num(options.passingScore, 3.5), top: rows[0] || null, summary: `Infinity AI publishes a KB quality rubric with ${rows.length} weighted criteria.` };
}
/** Idea 53484 — KB External Sourcing. */
export function importKbExternalSources(sources = [], options = {}) {
  const rows = (sources || []).map(s => {
    const license = String(s.license || 'unknown');
    const attributed = s.attributed === true || Boolean(s.attribution);
    const usable = license !== 'unknown' && attributed;
    return { key: keyOf(s, 'source'), title: String(s.title || keyOf(s, 'source')), license, attributed, usable, url: String(s.url || '') };
  }).sort((a, b) => Number(b.usable) - Number(a.usable) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, usableCount: rows.filter(r => r.usable).length, blockedCount: rows.filter(r => !r.usable).length, top: rows[0] || null, summary: `Infinity AI imported ${rows.filter(r => r.usable).length} properly licensed and attributed external source(s).` };
}
/** Idea 53485 — KB Redundancy with Playbooks. */
export function delineateKbVsPlaybooks(items = [], options = {}) {
  const rows = (items || []).map(it => {
    const procedural = num(it.proceduralSteps ?? it.steps, 0);
    const conceptual = num(it.concepts ?? it.conceptCount, 0);
    const home = procedural > conceptual ? 'playbook' : 'kb';
    return { key: keyOf(it, 'item'), title: String(it.title || keyOf(it, 'item')), procedural, conceptual, home, duplicateRisk: procedural > 0 && conceptual > 0 };
  }).sort((a, b) => String(a.home).localeCompare(String(b.home)) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, kbCount: rows.filter(r => r.home === 'kb').length, playbookCount: rows.filter(r => r.home === 'playbook').length, duplicateRiskCount: rows.filter(r => r.duplicateRisk).length, top: rows[0] || null, summary: `Infinity AI delineated ${rows.filter(r => r.home === 'kb').length} KB article(s) versus ${rows.filter(r => r.home === 'playbook').length} playbook(s).` };
}
/** Idea 53486 — KB Search Synonym Expansion. */
export function expandKbSearchSynonyms(searchLogs = [], options = {}) {
  const minCount = num(options.minCount, 2);
  const groups = new Map();
  for (const entry of searchLogs || []) {
    const term = String(entry.term || entry.query || '').toLowerCase().trim();
    if (!term) continue;
    const g = groups.get(term) || { term, count: 0, synonyms: new Set() };
    g.count += num(entry.count, 1);
    for (const syn of entry.clickedSynonyms || entry.synonyms || []) g.synonyms.add(String(syn).toLowerCase());
    groups.set(term, g);
  }
  const rows = [...groups.values()].map(g => ({ key: g.term, term: g.term, searches: g.count, synonyms: [...g.synonyms].sort(), expandable: g.count >= minCount && g.synonyms.size > 0 }))
    .sort((a, b) => b.searches - a.searches || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, expandableCount: rows.filter(r => r.expandable).length, top: rows[0] || null, summary: `Infinity AI learned synonym expansions for ${rows.filter(r => r.expandable).length} frequent KB search term(s).` };
}
/** Idea 53487 — KB Contribution Onboarding. */
export function onboardKbContributors(researchers = [], options = {}) {
  const steps = ['pick-hunt', 'draft-article', 'peer-review', 'publish'];
  const rows = (researchers || []).map(r => {
    const completed = Array.isArray(r.completedSteps) ? r.completedSteps.length : num(r.stepsDone, 0);
    return { key: String(r.name || r.key || 'researcher'), name: String(r.name || 'researcher'), completed, totalSteps: steps.length, progress: rate(completed, steps.length), ready: completed >= steps.length };
  }).sort((a, b) => b.progress - a.progress || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, readyCount: rows.filter(r => r.ready).length, steps, averageProgress: mean(rows.map(r => r.progress)), top: rows[0] || null, summary: `Infinity AI onboarded ${rows.filter(r => r.ready).length} researcher(s) to publish their first KB article.` };
}
/** Idea 53488 — KB Article Templates per Finding Type. */
export function templateKbArticlesByFindingType(findingTypes = [], options = {}) {
  const sectionsByType = { sqli: ['payload anatomy', 'detection', 'exploitation notes', 'remediation'], xss: ['context', 'payload anatomy', 'impact', 'remediation'], ssrf: ['target surface', 'bypass notes', 'impact', 'remediation'], default: ['overview', 'detection', 'impact', 'remediation'] };
  const rows = (findingTypes || []).map(t => {
    const type = String(t.type || t.findingType || 'default').toLowerCase();
    const sections = sectionsByType[type] || sectionsByType.default;
    return { key: String(t.key || type), findingType: type, sections: [...sections], sectionCount: sections.length };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, coveredTypes: rows.map(r => r.findingType), top: rows[0] || null, summary: `Infinity AI provides tailored KB article templates for ${rows.length} finding type(s).` };
}
/** Idea 53489 — KB Annual Audits. */
export function auditKbArticlesAnnually(articles = [], options = {}) {
  const sampleRate = clamp01(options.sampleRate ?? 0.2);
  const sorted = [...(articles || [])].sort((a, b) => String(keyOf(a)).localeCompare(String(keyOf(b))));
  const sampleSize = Math.max(1, Math.ceil(sorted.length * sampleRate));
  const sample = sorted.slice(0, sampleSize);
  const rows = sample.map(a => {
    const accurate = a.accurate === true || num(a.accuracyScore, 0) >= num(options.accuracyThreshold, 0.8);
    return { key: keyOf(a), title: String(a.title || keyOf(a)), accurate, lastHuntCheck: String(a.lastHuntCheck || 'never') };
  });
  return { rows, count: rows.length, sampledFrom: sorted.length, accurateCount: rows.filter(r => r.accurate).length, accuracyRate: rate(rows.filter(r => r.accurate).length, rows.length), top: rows[0] || null, summary: `Infinity AI audited ${rows.length} KB article(s) this year; ${rows.filter(r => r.accurate).length} remain accurate.` };
}
/** Idea 53490 — KB Staleness Alerts. */
export function alertKbStaleness(articles = [], options = {}) {
  const staleMonths = num(options.staleMonths, 12);
  const rows = (articles || []).map(a => {
    const months = num(a.monthsSinceHuntValidation ?? a.monthsStale, 0);
    return { key: keyOf(a), title: String(a.title || keyOf(a)), owner: String(a.owner || 'unassigned'), monthsSinceValidation: months, stale: months >= staleMonths };
  }).sort((a, b) => b.monthsSinceValidation - a.monthsSinceValidation || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, staleCount: rows.filter(r => r.stale).length, staleMonths, top: rows[0] || null, summary: `Infinity AI flagged ${rows.filter(r => r.stale).length} KB article(s) unvalidated by a hunt for ${staleMonths}+ months.` };
}
/** Idea 53491 — KB Cross-Linking Suggestions. */
export function suggestKbCrossLinks(articles = [], options = {}) {
  const threshold = num(options.minCoCitations, 2);
  const rows = [];
  const list = articles || [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const shared = num(list[i].coCitations?.[keyOf(list[j])] ?? list[i].sharedHunts ?? 0, 0);
      if (shared >= threshold) rows.push({ key: `${keyOf(list[i])}->${keyOf(list[j])}`, from: keyOf(list[i]), to: keyOf(list[j]), coCitations: shared, suggested: true });
    }
  }
  rows.sort((a, b) => b.coCitations - a.coCitations || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, suggestionCount: rows.length, top: rows[0] || null, summary: `Infinity AI suggested ${rows.length} KB cross-link(s) from co-citation patterns.` };
}
/** Idea 53492 — KB Reading Paths. */
export function buildKbReadingPaths(articles = [], options = {}) {
  const skillArea = String(options.skillArea || 'api-hunting');
  const levelRank = { beginner: 0, intermediate: 1, advanced: 2 };
  const rows = [...(articles || [])].sort((a, b) => (levelRank[String(a.difficulty || 'beginner')] ?? 0) - (levelRank[String(b.difficulty || 'beginner')] ?? 0) || String(keyOf(a)).localeCompare(String(keyOf(b))))
    .map((a, i) => ({ key: keyOf(a), title: String(a.title || keyOf(a)), difficulty: String(a.difficulty || 'beginner'), order: i + 1 }));
  return { rows, count: rows.length, skillArea, beginnerCount: rows.filter(r => r.difficulty === 'beginner').length, top: rows[0] || null, summary: `Infinity AI curated a ${rows.length}-article reading path for ${skillArea}.` };
}
/** Idea 53493 — KB Incident Learnings Section. */
export function collectKbIncidentLearnings(incidents = [], options = {}) {
  const rows = (incidents || []).map(inc => ({
    key: String(inc.id || inc.key || 'incident'), hunt: String(inc.hunt || inc.huntId || 'hunt'), lesson: String(inc.lesson || inc.learning || ''),
    severity: String(inc.severity || 'medium'), published: inc.published === true,
  })).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, publishedCount: rows.filter(r => r.published).length, top: rows[0] || null, summary: `Infinity AI maintains ${rows.filter(r => r.published).length} published incident learning(s) from hunts.` };
}
/** Idea 53494 — KB API Rate Limits. */
export function enforceKbApiRateLimits(requests = [], options = {}) {
  const agentLimit = num(options.agentLimitPerMinute, 60);
  const bySource = new Map();
  for (const r of requests || []) {
    const source = String(r.source || (r.agent === true ? 'agent' : 'human'));
    bySource.set(source, (bySource.get(source) || 0) + 1);
  }
  const rows = [...bySource.entries()].map(([source, count]) => ({ key: source, source, requests: count, limit: source === 'agent' ? agentLimit : num(options.humanLimitPerMinute, 600), throttled: source === 'agent' && count > agentLimit }))
    .sort((a, b) => b.requests - a.requests || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, throttledCount: rows.filter(r => r.throttled).length, agentLimit, top: rows[0] || null, summary: `Infinity AI rate-limits agent KB queries so human browsing stays responsive (${rows.filter(r => r.throttled).length} source(s) throttled).` };
}
/** Idea 53495 — KB Offline Sync. */
export function syncKbOffline(articles = [], options = {}) {
  const rows = (articles || []).map(a => {
    const localVersion = num(a.localVersion, 0);
    const remoteVersion = num(a.remoteVersion ?? a.version, 0);
    return { key: keyOf(a), title: String(a.title || keyOf(a)), localVersion, remoteVersion, needsSync: remoteVersion > localVersion };
  }).sort((a, b) => Number(b.needsSync) - Number(a.needsSync) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, pendingCount: rows.filter(r => r.needsSync).length, syncedCount: rows.filter(r => !r.needsSync).length, top: rows[0] || null, summary: `Infinity AI syncs ${rows.filter(r => r.needsSync).length} KB article(s) to researcher laptops for offline field work.` };
}
/** Idea 53496 — KB Contribution Recognition. */
export function recognizeKbContributions(contributors = [], options = {}) {
  const rows = (contributors || []).map(c => {
    const articles = num(c.articles ?? c.articleCount, 0);
    const citations = num(c.citations ?? c.huntCitations, 0);
    const score = round2(articles * 2 + citations);
    return { key: String(c.name || c.key || 'contributor'), name: String(c.name || 'contributor'), articles, citations, score, creditLine: `Infinity AI credits ${String(c.name || 'contributor')} for ${articles} KB article(s).` };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalArticles: rows.reduce((s, r) => s + r.articles, 0), top: rows[0] || null, summary: `Infinity AI publicly credits ${rows.length} KB author(s) in release notes.` };
}
/** Idea 53497 — KB Article Difficulty Labels. */
export function labelKbArticleDifficulty(articles = [], options = {}) {
  const rows = (articles || []).map(a => {
    const depth = num(a.depthScore ?? a.conceptCount, 0);
    const label = depth >= num(options.advancedAt, 8) ? 'advanced' : depth >= num(options.intermediateAt, 4) ? 'intermediate' : 'beginner';
    return { key: keyOf(a), title: String(a.title || keyOf(a)), depthScore: depth, label };
  }).sort((a, b) => b.depthScore - a.depthScore || String(a.key).localeCompare(String(b.key)));
  const counts = { beginner: 0, intermediate: 0, advanced: 0 };
  for (const r of rows) counts[r.label] += 1;
  return { rows, count: rows.length, counts, beginnerCount: counts.beginner, intermediateCount: counts.intermediate, advancedCount: counts.advanced, top: rows[0] || null, summary: `Infinity AI labeled ${rows.length} KB article(s) by difficulty (${counts.beginner} beginner, ${counts.intermediate} intermediate, ${counts.advanced} advanced).` };
}
/** Idea 53498 — KB Feedback Triage. */
export function triageKbFeedback(feedback = [], options = {}) {
  const quickThreshold = num(options.quickFixMaxEffort, 1);
  const rows = (feedback || []).map(f => {
    const effort = num(f.effortDays ?? f.effort, 1);
    return { key: String(f.id || f.key || 'feedback'), article: String(f.article || f.articleId || ''), note: String(f.note || f.text || ''), effort, lane: effort <= quickThreshold ? 'quick-fix' : 'major-revision' };
  }).sort((a, b) => a.effort - b.effort || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, quickFixCount: rows.filter(r => r.lane === 'quick-fix').length, majorRevisionCount: rows.filter(r => r.lane === 'major-revision').length, top: rows[0] || null, summary: `Infinity AI triaged KB feedback into ${rows.filter(r => r.lane === 'quick-fix').length} quick fix(es) and ${rows.filter(r => r.lane === 'major-revision').length} major revision(s).` };
}
/** Idea 53499 — KB Growth Metrics Dashboard. */
export function trackKbGrowthMetrics(snapshots = [], options = {}) {
  const rows = (snapshots || []).map(s => ({
    key: String(s.period || s.key || 'period'), period: String(s.period || ''), articles: num(s.articles ?? s.articleCount, 0),
    coverage: clamp01(s.coverage ?? 0), freshness: clamp01(s.freshness ?? 0), usage: num(s.usage ?? s.views, 0),
  })).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const latest = rows[rows.length - 1] || null;
  const growth = rows.length > 1 ? rows[rows.length - 1].articles - rows[0].articles : 0;
  return { rows, count: rows.length, latest, growth, averageFreshness: mean(rows.map(r => r.freshness)), top: latest, summary: `Infinity AI tracks KB growth: ${latest ? latest.articles : 0} article(s), net growth ${growth}.` };
}
/** Idea 53500 — KB Sunset Archives. */
export function archiveKbSunsetArticles(articles = [], options = {}) {
  const rows = (articles || []).map(a => {
    const deprecated = a.deprecated === true || String(a.status || '') === 'deprecated';
    return { key: keyOf(a), title: String(a.title || keyOf(a)), deprecated, readOnly: deprecated, archiveReason: String(a.archiveReason || (deprecated ? 'superseded' : '')) };
  }).sort((a, b) => Number(b.deprecated) - Number(a.deprecated) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, archivedCount: rows.filter(r => r.deprecated).length, activeCount: rows.filter(r => !r.deprecated).length, top: rows[0] || null, summary: `Infinity AI archived ${rows.filter(r => r.deprecated).length} deprecated KB article(s) read-only for historical reference.` };
}
