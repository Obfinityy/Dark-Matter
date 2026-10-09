/**
 * wave87BCores.js — Infinity AI · Wave 87B
 * Knowledge base growth round, ideas 53461–53480:
 * multilingual growth, search relevance tuning, hunt attribution,
 * orphan adoption, peer review workflow, confidence badges,
 * deprecation process, graph relationships, export packages,
 * API for agents, feedback buttons, curation sprints, article
 * lifecycles, duplicate detection, visual learning aids,
 * accessibility standards, translation memory, author analytics,
 * replay integration, and quiz generation.
 * Every helper takes explicit inputs, never mutates them, and
 * returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE87_B_IDEAS = [
  { id: 53461, title: 'KB Multilingual Growth', skip: false },
  { id: 53462, title: 'KB Search Relevance Tuning', skip: false },
  { id: 53463, title: 'KB-to-Hunt Attribution', skip: false },
  { id: 53464, title: 'KB Orphan Article Adoption', skip: false },
  { id: 53465, title: 'KB Peer Review Workflow', skip: false },
  { id: 53466, title: 'KB Confidence Badges', skip: false },
  { id: 53467, title: 'KB Deprecation Process', skip: false },
  { id: 53468, title: 'KB Graph Relationships', skip: false },
  { id: 53469, title: 'KB Export Packages', skip: false },
  { id: 53470, title: 'KB API for Agents', skip: false },
  { id: 53471, title: 'KB Feedback Buttons', skip: false },
  { id: 53472, title: 'KB Curation Sprints', skip: false },
  { id: 53473, title: 'KB Article Lifecycles', skip: false },
  { id: 53474, title: 'KB Duplicate Detection', skip: false },
  { id: 53475, title: 'KB Visual Learning Aids', skip: false },
  { id: 53476, title: 'KB Accessibility Standards', skip: false },
  { id: 53477, title: 'KB Translation Memory', skip: false },
  { id: 53478, title: 'KB Analytics for Authors', skip: false },
  { id: 53479, title: 'KB Integration with Replays', skip: false },
  { id: 53480, title: 'KB Quiz Generation', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function keyOf(it,fb='benchmark'){return String(it.key||it.id||it.benchmarkId||it.title||it.name||fb);}

/** Idea 53461 — KB Multilingual Growth. */
export function growKbMultilingual(coverage = [], options = {}) {
  const rows = (coverage || []).map(c => {
    const total = num(c.totalArticles ?? c.total, 0);
    const translated = num(c.translated ?? c.translatedCount, 0);
    return { key: String(c.language || c.lang || c.key || 'language'), language: String(c.language || c.lang || c.key || 'language'), total, translated, coverageRatio: total ? rate(translated, total) : 0, priority: total > 0 && translated / total < 0.3 };
  }).sort((a, b) => b.total - a.total || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, languageCount: rows.length, priorityCount: rows.filter(r => r.priority).length, top: rows[0] || null, summary: `Infinity AI tracks knowledge base coverage across ${rows.length} language(s); ${rows.filter(r => r.priority).length} need translation priority.` };
}
/** Idea 53462 — KB Search Relevance Tuning. */
export function tuneKbSearchRelevance(searches = [], options = {}) {
  const rows = (searches || []).map(s => {
    const clicks = num(s.clicks ?? s.clickCount, 0);
    const impressions = num(s.impressions ?? s.searches, 0);
    const ctr = impressions ? rate(clicks, impressions) : 0;
    return { key: String(s.query || s.term || s.key || 'query'), query: String(s.query || s.term || s.key || 'query'), clicks, impressions, ctr, needsTuning: impressions >= 5 && ctr < 0.2 };
  }).sort((a, b) => b.impressions - a.impressions || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, tuningCount: rows.filter(r => r.needsTuning).length, avgCtr: mean(rows.map(r => r.ctr)), top: rows[0] || null, summary: `Infinity AI tuned knowledge base search relevance from ${rows.length} hunt quer${rows.length === 1 ? 'y' : 'ies'}.` };
}
/** Idea 53463 — KB-to-Hunt Attribution. */
export function attributeKbToHunts(hunts = [], options = {}) {
  const rows = (hunts || []).map(h => {
    const articles = Array.isArray(h.articles) ? h.articles.map(String) : (h.article ? [String(h.article)] : []);
    return { key: String(h.id || h.huntId || h.key || 'hunt'), hunt: String(h.id || h.huntId || h.key || 'hunt'), articles, articleCount: articles.length, attributed: articles.length > 0 };
  }).sort((a, b) => b.articleCount - a.articleCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, attributedCount: rows.filter(r => r.attributed).length, totalAttributions: rows.reduce((s, r) => s + r.articleCount, 0), top: rows[0] || null, summary: `Infinity AI attributed knowledge base influence in ${rows.filter(r => r.attributed).length} of ${rows.length} hunt(s).` };
}
/** Idea 53464 — KB Orphan Article Adoption. */
export function adoptKbOrphanArticles(articles = [], options = {}) {
  const rows = (articles || []).map(a => {
    const owner = a.owner ? String(a.owner) : null;
    const orphan = !owner || a.orphan === true;
    return { key: String(a.id || a.key || a.title || 'article'), title: String(a.title || a.id || 'article'), owner, orphan, adoptedBy: a.adoptedBy ? String(a.adoptedBy) : null, adopted: Boolean(a.adoptedBy) };
  }).sort((a, b) => Number(b.orphan) - Number(a.orphan) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, orphanCount: rows.filter(r => r.orphan).length, adoptedCount: rows.filter(r => r.adopted).length, top: rows[0] || null, summary: `Infinity AI found ${rows.filter(r => r.orphan).length} orphan knowledge base article(s) for adoption.` };
}
/** Idea 53465 — KB Peer Review Workflow. */
export function workflowKbPeerReview(submissions = [], options = {}) {
  const rows = (submissions || []).map(s => {
    const reviewers = num(s.reviewers ?? s.reviewerCount, 0);
    const approved = s.approved === true || String(s.status || '') === 'approved';
    const live = approved && reviewers >= 1;
    return { key: String(s.id || s.key || s.title || 'submission'), title: String(s.title || s.id || 'submission'), author: s.author ? String(s.author) : null, reviewers, approved, live, stage: live ? 'live' : reviewers > 0 ? 'in-review' : 'awaiting-review' };
  }).sort((a, b) => Number(b.live) - Number(a.live) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, liveCount: rows.filter(r => r.live).length, reviewCount: rows.filter(r => r.stage === 'in-review').length, top: rows[0] || null, summary: `Infinity AI moved ${rows.filter(r => r.live).length} knowledge base article(s) live through peer review.` };
}
/** Idea 53466 — KB Confidence Badges. */
export function badgeKbConfidence(articles = [], options = {}) {
  const rows = (articles || []).map(a => {
    const hunts = num(a.supportingHunts ?? a.hunts, 0);
    const badge = hunts >= 10 ? 'canonical' : hunts >= 3 ? 'validated' : 'emerging';
    return { key: String(a.id || a.key || a.title || 'article'), title: String(a.title || a.id || 'article'), hunts, badge };
  }).sort((a, b) => b.hunts - a.hunts || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, canonicalCount: rows.filter(r => r.badge === 'canonical').length, validatedCount: rows.filter(r => r.badge === 'validated').length, emergingCount: rows.filter(r => r.badge === 'emerging').length, top: rows[0] || null, summary: `Infinity AI labelled ${rows.length} knowledge base article(s) with confidence badges.` };
}
/** Idea 53467 — KB Deprecation Process. */
export function processKbDeprecation(articles = [], options = {}) {
  const rows = (articles || []).map(a => {
    const superseded = a.superseded === true || Boolean(a.supersededBy) || String(a.status || '') === 'deprecated';
    return { key: String(a.id || a.key || a.title || 'article'), title: String(a.title || a.id || 'article'), supersededBy: a.supersededBy ? String(a.supersededBy) : null, deprecated: superseded, action: superseded ? 'deprecate' : 'keep' };
  }).sort((a, b) => Number(b.deprecated) - Number(a.deprecated) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, deprecatedCount: rows.filter(r => r.deprecated).length, activeCount: rows.filter(r => !r.deprecated).length, top: rows[0] || null, summary: `Infinity AI processed deprecation for ${rows.length} knowledge base article(s); ${rows.filter(r => r.deprecated).length} deprecated.` };
}
/** Idea 53468 — KB Graph Relationships. */
export function buildKbGraphRelationships(nodes = [], options = {}) {
  const rows = (nodes || []).map(n => {
    const prereqs = Array.isArray(n.prerequisites) ? n.prerequisites.map(String) : [];
    const alternatives = Array.isArray(n.alternatives) ? n.alternatives.map(String) : [];
    const combos = Array.isArray(n.combinations) ? n.combinations.map(String) : [];
    return { key: String(n.id || n.key || n.title || 'article'), title: String(n.title || n.id || 'article'), prerequisites: prereqs, alternatives, combinations: combos, linkCount: prereqs.length + alternatives.length + combos.length };
  }).sort((a, b) => b.linkCount - a.linkCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalLinks: rows.reduce((s, r) => s + r.linkCount, 0), connectedCount: rows.filter(r => r.linkCount > 0).length, top: rows[0] || null, summary: `Infinity AI linked ${rows.length} knowledge base article(s) into a graph with ${rows.reduce((s, r) => s + r.linkCount, 0)} relationship(s).` };
}
/** Idea 53469 — KB Export Packages. */
export function exportKbPackages(requests = [], options = {}) {
  const format = String(options.format || 'zip');
  const rows = (requests || []).map(r => {
    const articles = Array.isArray(r.articles) ? r.articles.length : num(r.articleCount ?? r.count, 0);
    return { key: String(r.id || r.key || r.team || 'package'), team: String(r.team || r.name || r.id || 'team'), articleCount: articles, format, ready: articles > 0 };
  }).sort((a, b) => b.articleCount - a.articleCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, readyCount: rows.filter(r => r.ready).length, totalArticles: rows.reduce((s, r) => s + r.articleCount, 0), format, top: rows[0] || null, summary: `Infinity AI prepared ${rows.filter(r => r.ready).length} knowledge base export package(s) in ${format} format.` };
}
/** Idea 53470 — KB API for Agents. */
export function serveKbApiForAgents(articles = [], query = {}, options = {}) {
  const term = query.term ? String(query.term).toLowerCase() : '';
  const limit = num(query.limit ?? options.limit, 5);
  const filtered = (articles || []).filter(a => !term || String(a.title || '').toLowerCase().includes(term) || String(a.technique || '').toLowerCase().includes(term));
  const rows = filtered.map(a => ({ key: String(a.id || a.key || a.title || 'article'), title: String(a.title || a.id || 'article'), relevance: num(a.relevance ?? a.score, 0), technique: String(a.technique || 'general') })).sort((a, b) => b.relevance - a.relevance || String(a.key).localeCompare(String(b.key))).slice(0, limit);
  return { rows, count: (articles || []).length, resultCount: rows.length, term, latencyMs: num(options.latencyMs, 12), top: rows[0] || null, summary: `Infinity AI served ${rows.length} knowledge base article(s) to hunting agents.` };
}
/** Idea 53471 — KB Feedback Buttons. */
export function collectKbFeedbackButtons(feedback = [], options = {}) {
  const rows = (feedback || []).map(f => {
    const helpful = num(f.helpful, 0);
    const notHelpful = num(f.notHelpful ?? f.unhelpful, 0);
    const total = helpful + notHelpful;
    return { key: String(f.articleId || f.article || f.key || 'article'), article: String(f.articleId || f.article || f.key || 'article'), helpful, notHelpful, total, ratio: total ? rate(helpful, total) : 0, needsRevision: total >= 3 && helpful / total < 0.5 };
  }).sort((a, b) => b.total - a.total || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, revisionCount: rows.filter(r => r.needsRevision).length, totalVotes: rows.reduce((s, r) => s + r.total, 0), top: rows[0] || null, summary: `Infinity AI collected reader feedback for ${rows.length} knowledge base article(s); ${rows.filter(r => r.needsRevision).length} need revision.` };
}
/** Idea 53472 — KB Curation Sprints. */
export function scheduleKbCurationSprints(gaps = [], options = {}) {
  const capacity = num(options.capacity, 5);
  const sorted = [...(gaps || [])].map(g => ({ key: String(g.technique || g.name || g.key || 'gap'), technique: String(g.technique || g.name || g.key || 'gap'), priority: num(g.priority ?? g.findings, 0), findings: num(g.findings, 0) })).sort((a, b) => b.priority - a.priority || String(a.key).localeCompare(String(b.key)));
  const rows = sorted.slice(0, capacity);
  return { rows, count: (gaps || []).length, sprintCount: rows.length, capacity, totalGaps: (gaps || []).length, top: rows[0] || null, summary: `Infinity AI scheduled a knowledge base curation sprint for ${rows.length} high-priority gap(s).` };
}
/** Idea 53473 — KB Article Lifecycles. */
export function manageKbArticleLifecycles(articles = [], options = {}) {
  const stages = ['draft', 'review', 'canonical', 'archived'];
  const rows = (articles || []).map(a => {
    const stage = stages.includes(String(a.stage || a.status || '')) ? String(a.stage || a.status) : 'draft';
    return { key: String(a.id || a.key || a.title || 'article'), title: String(a.title || a.id || 'article'), stage, stageIndex: stages.indexOf(stage), terminal: stage === 'archived' };
  }).sort((a, b) => b.stageIndex - a.stageIndex || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, canonicalCount: rows.filter(r => r.stage === 'canonical').length, archivedCount: rows.filter(r => r.stage === 'archived').length, stages, top: rows[0] || null, summary: `Infinity AI tracks ${rows.length} knowledge base article(s) across the article lifecycle.` };
}
/** Idea 53474 — KB Duplicate Detection. */
export function detectKbDuplicates(articles = [], options = {}) {
  const byTitle = new Map();
  for (const a of articles || []) {
    const norm = String(a.title || a.id || '').toLowerCase().trim();
    const arr = byTitle.get(norm) || [];
    arr.push(a);
    byTitle.set(norm, arr);
  }
  const rows = [...byTitle.entries()].filter(([, v]) => v.length > 1).map(([norm, v]) => ({ key: norm || 'article', title: String(v[0].title || v[0].id || 'article'), copies: v.length, duplicate: true, mergeTarget: String(v[0].id || v[0].key || norm) })).sort((a, b) => b.copies - a.copies || String(a.key).localeCompare(String(b.key)));
  return { rows, count: (articles || []).length, duplicateGroups: rows.length, duplicateCount: rows.reduce((s, r) => s + r.copies, 0), top: rows[0] || null, summary: `Infinity AI found ${rows.length} duplicate knowledge base article group(s) for merging.` };
}
/** Idea 53475 — KB Visual Learning Aids. */
export function trackKbVisualLearningAids(articles = [], options = {}) {
  const rows = (articles || []).map(a => {
    const diagrams = num(a.diagrams, 0);
    const screenshots = num(a.screenshots, 0);
    const visuals = diagrams + screenshots;
    return { key: String(a.id || a.key || a.title || 'article'), title: String(a.title || a.id || 'article'), diagrams, screenshots, visuals, qualityScore: Math.min(100, visuals * 25), rich: visuals >= 2 };
  }).sort((a, b) => b.visuals - a.visuals || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, richCount: rows.filter(r => r.rich).length, totalVisuals: rows.reduce((s, r) => s + r.visuals, 0), top: rows[0] || null, summary: `Infinity AI tracks visual learning aids in ${rows.length} knowledge base article(s); ${rows.filter(r => r.rich).length} are visually rich.` };
}
/** Idea 53476 — KB Accessibility Standards. */
export function auditKbAccessibilityStandards(articles = [], options = {}) {
  const rows = (articles || []).map(a => {
    const readingLevel = num(a.readingLevel ?? a.grade, 8);
    const altText = a.altText === true;
    const headings = a.headings === true || num(a.headingCount, 0) >= 2;
    const passed = readingLevel <= 10 && altText && headings;
    return { key: String(a.id || a.key || a.title || 'article'), title: String(a.title || a.id || 'article'), readingLevel, altText, headings, passed };
  }).sort((a, b) => Number(b.passed) - Number(a.passed) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, passedCount: rows.filter(r => r.passed).length, accessible: rows.length > 0 && rows.every(r => r.passed), top: rows[0] || null, summary: `Infinity AI audited ${rows.length} knowledge base article(s) against accessibility standards; ${rows.filter(r => r.passed).length} pass.` };
}
/** Idea 53477 — KB Translation Memory. */
export function applyKbTranslationMemory(segments = [], options = {}) {
  const rows = (segments || []).map(s => {
    const source = String(s.source || s.text || '');
    const reuse = s.memoryHit === true || s.reused === true;
    return { key: String(s.id || s.key || source.slice(0, 24) || 'segment'), source, target: String(s.target || s.translation || ''), reused: reuse, language: String(s.language || 'en') };
  }).sort((a, b) => Number(b.reused) - Number(a.reused) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, reusedCount: rows.filter(r => r.reused).length, reuseRatio: rows.length ? rate(rows.filter(r => r.reused).length, rows.length) : 0, top: rows[0] || null, summary: `Infinity AI reuses translation memory for ${rows.filter(r => r.reused).length} of ${rows.length} knowledge base segment(s).` };
}
/** Idea 53478 — KB Analytics for Authors. */
export function analyticsKbForAuthors(authors = [], options = {}) {
  const rows = (authors || []).map(a => {
    const views = num(a.views, 0);
    const citations = num(a.citations ?? a.huntCitations, 0);
    return { key: String(a.name || a.author || a.key || 'author'), author: String(a.name || a.author || a.key || 'author'), articles: num(a.articles, 0), views, citations, impact: round2(views * 0.1 + citations * 5) };
  }).sort((a, b) => b.impact - a.impact || String(a.key).localeCompare(String(b.key)));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return { rows, count: rows.length, totalViews: rows.reduce((s, r) => s + r.views, 0), totalCitations: rows.reduce((s, r) => s + r.citations, 0), top: rows[0] || null, summary: `Infinity AI shows knowledge base analytics for ${rows.length} author(s).` };
}
/** Idea 53479 — KB Integration with Replays. */
export function integrateKbWithReplays(articles = [], options = {}) {
  const rows = (articles || []).map(a => {
    const replays = Array.isArray(a.replays) ? a.replays.length : num(a.replayCount, 0);
    return { key: String(a.id || a.key || a.title || 'article'), title: String(a.title || a.id || 'article'), replayCount: replays, linked: replays > 0, bestReplay: Array.isArray(a.replays) && a.replays.length ? String(a.replays[0]) : null };
  }).sort((a, b) => b.replayCount - a.replayCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, linkedCount: rows.filter(r => r.linked).length, totalReplays: rows.reduce((s, r) => s + r.replayCount, 0), top: rows[0] || null, summary: `Infinity AI linked ${rows.filter(r => r.linked).length} knowledge base article(s) to hunt replays.` };
}
/** Idea 53480 — KB Quiz Generation. */
export function generateKbQuizzes(articles = [], options = {}) {
  const perArticle = num(options.questionsPerArticle, 3);
  const rows = (articles || []).map(a => {
    const sections = Array.isArray(a.sections) ? a.sections.length : num(a.sectionCount, 1);
    const questions = Math.max(1, Math.min(perArticle, sections || 1));
    return { key: String(a.id || a.key || a.title || 'article'), title: String(a.title || a.id || 'article'), questions, generated: true };
  }).sort((a, b) => b.questions - a.questions || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalQuestions: rows.reduce((s, r) => s + r.questions, 0), quizCount: rows.length, top: rows[0] || null, summary: `Infinity AI generated quizzes for ${rows.length} knowledge base article(s) with ${rows.reduce((s, r) => s + r.questions, 0)} question(s).` };
}
