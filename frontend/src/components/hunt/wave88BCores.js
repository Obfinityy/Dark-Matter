/**
 * wave88BCores.js — Infinity AI · Wave 88B
 * Knowledge base governance and failure analysis, ideas 53501–53520:
 * legal review queue, community contributions, article impact scores,
 * semantic deduplication, onboarding checklists, hunt-citation
 * requirements, knowledge graph data, annual growth report, failure
 * taxonomy, near-miss payload detection, blocked-vs-patched
 * differentiation, filter fingerprinting, failure clustering, payload
 * autopsy reports, failure cost accounting, survivorship bias
 * correction, failure-driven mutation suggestions, time-to-failure
 * analysis, failure signal libraries, and false-negative reviews.
 * Every helper takes explicit inputs, never mutates them, and
 * returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE88_B_IDEAS = [
  { id: 53501, title: 'KB Legal Review Queue', skip: false },
  { id: 53502, title: 'KB Community Contributions', skip: false },
  { id: 53503, title: 'KB Article Impact Scores', skip: false },
  { id: 53504, title: 'KB Semantic Deduplication', skip: false },
  { id: 53505, title: 'KB Onboarding Checklists', skip: false },
  { id: 53506, title: 'KB Hunt-Citation Requirements', skip: false },
  { id: 53507, title: 'KB Knowledge Graph Visualizations', skip: false },
  { id: 53508, title: 'KB Annual Growth Report', skip: false },
  { id: 53509, title: 'Failure Taxonomy', skip: false },
  { id: 53510, title: 'Near-Miss Payload Detection', skip: false },
  { id: 53511, title: 'Blocked-vs-Patched Differentiation', skip: false },
  { id: 53512, title: 'Filter Fingerprinting from Failures', skip: false },
  { id: 53513, title: 'Failure Clustering', skip: false },
  { id: 53514, title: 'Payload Autopsy Reports', skip: false },
  { id: 53515, title: 'Failure Cost Accounting', skip: false },
  { id: 53516, title: 'Survivorship Bias Correction', skip: false },
  { id: 53517, title: 'Failure-Driven Mutation Suggestions', skip: false },
  { id: 53518, title: 'Time-to-Failure Analysis', skip: false },
  { id: 53519, title: 'Failure Signal Libraries', skip: false },
  { id: 53520, title: 'False-Negative Failure Reviews', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function keyOf(it,fb='item'){return String(it.key||it.id||it.articleId||it.payloadId||it.title||it.name||fb);}

/** Idea 53501 — KB Legal Review Queue. */
export function queueKbLegalReviews(articles = [], options = {}) {
  const sensitiveTerms = options.sensitiveTerms || ['exploit', 'credential', 'zero-day'];
  const rows = (articles || []).map(a => {
    const text = String(a.title || '') + ' ' + String(a.body || '');
    const hits = sensitiveTerms.filter(t => text.toLowerCase().includes(String(t).toLowerCase()));
    return { key: keyOf(a), title: String(a.title || keyOf(a)), sensitiveHits: hits, needsLegalReview: hits.length > 0, status: hits.length > 0 ? 'queued' : 'clear' };
  }).sort((a, b) => b.sensitiveHits.length - a.sensitiveHits.length || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, queuedCount: rows.filter(r => r.needsLegalReview).length, top: rows[0] || null, summary: `Infinity AI routed ${rows.filter(r => r.needsLegalReview).length} sensitive KB article(s) through legal review.` };
}
/** Idea 53502 — KB Community Contributions. */
export function moderateKbCommunityContributions(contributions = [], options = {}) {
  const rows = (contributions || []).map(c => {
    const spamScore = clamp01(c.spamScore ?? 0);
    const approved = c.approved === true || (spamScore < num(options.spamThreshold, 0.5) && c.reviewed === true);
    return { key: String(c.id || c.key || 'contribution'), author: String(c.author || 'external'), title: String(c.title || ''), spamScore, status: approved ? 'approved' : 'pending-moderation', attribution: String(c.author || 'external') };
  }).sort((a, b) => a.spamScore - b.spamScore || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, approvedCount: rows.filter(r => r.status === 'approved').length, pendingCount: rows.filter(r => r.status !== 'approved').length, top: rows[0] || null, summary: `Infinity AI moderated ${rows.length} community KB contribution(s) with attribution.` };
}
/** Idea 53503 — KB Article Impact Scores. */
export function scoreKbArticleImpact(articles = [], options = {}) {
  const rows = (articles || []).map(a => {
    const huntsImproved = num(a.huntsImproved ?? a.downstreamHunts, 0);
    const findingsEnabled = num(a.findingsEnabled ?? a.findings, 0);
    const impact = round2(huntsImproved * 3 + findingsEnabled * 2);
    return { key: keyOf(a), title: String(a.title || keyOf(a)), huntsImproved, findingsEnabled, impact };
  }).sort((a, b) => b.impact - a.impact || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalImpact: round2(rows.reduce((s, r) => s + r.impact, 0)), top: rows[0] || null, summary: `Infinity AI scored KB article impact by downstream hunt improvements (top: ${rows[0] ? rows[0].title : 'none'}).` };
}
/** Idea 53504 — KB Semantic Deduplication. */
export function deduplicateKbSemantically(articles = [], options = {}) {
  const threshold = num(options.similarityThreshold, 0.9);
  const rows = [];
  const list = articles || [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const sim = clamp01(list[i].similarity?.[keyOf(list[j])] ?? list[i].pairSimilarity ?? 0);
      if (sim >= threshold) rows.push({ key: `${keyOf(list[i])}~${keyOf(list[j])}`, a: keyOf(list[i]), b: keyOf(list[j]), similarity: sim, nearDuplicate: true });
    }
  }
  rows.sort((x, y) => y.similarity - x.similarity || String(x.key).localeCompare(String(y.key)));
  return { rows, count: rows.length, pairCount: rows.length, top: rows[0] || null, summary: `Infinity AI caught ${rows.length} near-duplicate KB article pair(s) via semantic similarity.` };
}
/** Idea 53505 — KB Onboarding Checklists. */
export function buildKbOnboardingChecklists(members = [], options = {}) {
  const checklistSize = num(options.checklistSize, 10);
  const rows = (members || []).map(m => {
    const read = num(m.articlesRead ?? m.readCount, 0);
    return { key: String(m.name || m.key || 'member'), name: String(m.name || 'member'), read, checklistSize, progress: rate(read, checklistSize), complete: read >= checklistSize };
  }).sort((a, b) => b.progress - a.progress || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, completeCount: rows.filter(r => r.complete).length, checklistSize, top: rows[0] || null, summary: `Infinity AI tracks first-month KB reading checklists for ${rows.length} new team member(s).` };
}
/** Idea 53506 — KB Hunt-Citation Requirements. */
export function enforceKbHuntCitations(reports = [], options = {}) {
  const rows = (reports || []).map(r => {
    const citations = Array.isArray(r.kbCitations) ? r.kbCitations.length : num(r.citationCount, 0);
    return { key: String(r.id || r.key || 'report'), hunt: String(r.hunt || r.huntId || ''), citations, compliant: citations > 0 };
  }).sort((a, b) => b.citations - a.citations || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, compliantCount: rows.filter(r => r.compliant).length, missingCount: rows.filter(r => !r.compliant).length, complianceRate: rate(rows.filter(r => r.compliant).length, rows.length), top: rows[0] || null, summary: `Infinity AI requires hunt reports to cite informing KB articles (${rows.filter(r => r.compliant).length}/${rows.length} compliant).` };
}
/** Idea 53507 — KB Knowledge Graph Visualizations. */
export function buildKbKnowledgeGraph(articles = [], options = {}) {
  const nodes = (articles || []).map(a => ({ key: keyOf(a), title: String(a.title || keyOf(a)), links: Array.isArray(a.links) ? a.links.length : num(a.linkCount, 0) }));
  const edges = [];
  for (const a of articles || []) {
    for (const target of a.links || []) edges.push({ key: `${keyOf(a)}->${String(target)}`, from: keyOf(a), to: String(target) });
  }
  nodes.sort((x, y) => y.links - x.links || String(x.key).localeCompare(String(y.key)));
  return { rows: nodes, nodes, count: nodes.length, edgeCount: edges.length, edges, top: nodes[0] || null, summary: `Infinity AI visualizes the KB as an explorable graph of ${nodes.length} article(s) and ${edges.length} link(s).` };
}
/** Idea 53508 — KB Annual Growth Report. */
export function reportKbAnnualGrowth(yearly = [], options = {}) {
  const rows = (yearly || []).map(y => ({
    key: String(y.year || y.key || 'year'), year: num(y.year, 0), articles: num(y.articles ?? y.articleCount, 0),
    gapsClosed: num(y.gapsClosed, 0), topArticle: String(y.topArticle || ''),
  })).sort((a, b) => a.year - b.year || String(a.key).localeCompare(String(b.key)));
  const latest = rows[rows.length - 1] || null;
  const growth = rows.length > 1 ? latest.articles - rows[0].articles : 0;
  return { rows, count: rows.length, latest, growth, totalGapsClosed: rows.reduce((s, r) => s + r.gapsClosed, 0), top: latest, summary: `Infinity AI published the annual KB growth report: ${growth >= 0 ? '+' : ''}${growth} article(s) net growth.` };
}
/** Idea 53509 — Failure Taxonomy. */
export function classifyFailureTaxonomy(failures = [], options = {}) {
  const classes = ['blocked', 'filtered', 'mis-targeted', 'patched', 'malformed'];
  const rows = (failures || []).map(f => {
    const raw = String(f.failureClass || f.reason || '').toLowerCase();
    const failureClass = classes.includes(raw) ? raw : (f.status === 403 ? 'blocked' : 'mis-targeted');
    return { key: keyOf(f, 'failure'), payload: String(f.payload || f.payloadId || ''), failureClass, consistent: true };
  }).sort((a, b) => String(a.failureClass).localeCompare(String(b.failureClass)) || String(a.key).localeCompare(String(b.key)));
  const counts = Object.fromEntries(classes.map(c => [c, rows.filter(r => r.failureClass === c).length]));
  return { rows, count: rows.length, counts, classes, top: rows[0] || null, summary: `Infinity AI classified ${rows.length} failed payload(s) consistently across ${classes.length} failure classes.` };
}
/** Idea 53510 — Near-Miss Payload Detection. */
export function detectNearMissPayloads(failures = [], options = {}) {
  const threshold = num(options.nearMissThreshold, 0.6);
  const rows = (failures || []).map(f => {
    const signal = clamp01(f.partialSignal ?? f.signalScore ?? 0);
    return { key: keyOf(f, 'payload'), payload: String(f.payload || ''), partialSignal: signal, nearMiss: signal >= threshold, priorityMutation: signal >= threshold };
  }).sort((a, b) => b.partialSignal - a.partialSignal || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, nearMissCount: rows.filter(r => r.nearMiss).length, top: rows[0] || null, summary: `Infinity AI flagged ${rows.filter(r => r.nearMiss).length} near-miss payload(s) for priority mutation.` };
}
/** Idea 53511 — Blocked-vs-Patched Differentiation. */
export function differentiateBlockedVsPatched(failures = [], options = {}) {
  const rows = (failures || []).map(f => {
    const wafHeader = Boolean(f.wafHeader || f.defenseHeader);
    const status = num(f.status, 0);
    const verdict = wafHeader || status === 403 ? 'waf-block' : status === 404 || status === 400 ? 'patched' : 'inconclusive';
    return { key: keyOf(f, 'payload'), status, wafHeader, verdict, confidence: verdict === 'inconclusive' ? 0.3 : 0.9 };
  }).sort((a, b) => b.confidence - a.confidence || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, wafBlockCount: rows.filter(r => r.verdict === 'waf-block').length, patchedCount: rows.filter(r => r.verdict === 'patched').length, top: rows[0] || null, summary: `Infinity AI differentiated WAF blocks from real patches for ${rows.length} failed payload(s).` };
}
/** Idea 53512 — Filter Fingerprinting from Failures. */
export function fingerprintFiltersFromFailures(failures = [], options = {}) {
  const groups = new Map();
  for (const f of failures || []) {
    const sig = String(f.blockedToken || f.filterSignature || 'unknown-filter');
    const g = groups.get(sig) || { key: sig, signature: sig, failures: 0, strippedTokens: new Set() };
    g.failures += 1;
    for (const t of f.strippedTokens || []) g.strippedTokens.add(String(t));
    groups.set(sig, g);
  }
  const rows = [...groups.values()].map(g => ({ key: g.key, signature: g.signature, failures: g.failures, strippedTokens: [...g.strippedTokens].sort(), ruleGuess: `blocks: ${[...g.strippedTokens].sort().join(', ') || 'unknown'}` }))
    .sort((a, b) => b.failures - a.failures || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, fingerprintCount: rows.length, top: rows[0] || null, summary: `Infinity AI reverse-engineered ${rows.length} filter fingerprint(s) from failed payloads.` };
}
/** Idea 53513 — Failure Clustering. */
export function clusterFailures(failures = [], options = {}) {
  const groups = new Map();
  for (const f of failures || []) {
    const clusterKey = `${String(f.target || 'target')}|${String(f.contentType || f.payloadKind || 'generic')}`;
    const g = groups.get(clusterKey) || { key: clusterKey, target: String(f.target || 'target'), kind: String(f.contentType || f.payloadKind || 'generic'), members: 0 };
    g.members += 1;
    groups.set(clusterKey, g);
  }
  const rows = [...groups.values()].map(g => ({ ...g, systemic: g.members >= num(options.systemicAt, 3) }))
    .sort((a, b) => b.members - a.members || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalFailures: rows.reduce((s, r) => s + r.members, 0), systemicCount: rows.filter(r => r.systemic).length, top: rows[0] || null, summary: `Infinity AI clustered failures into ${rows.length} group(s); ${rows.filter(r => r.systemic).length} look systemic.` };
}
/** Idea 53514 — Payload Autopsy Reports. */
export function generatePayloadAutopsies(failures = [], options = {}) {
  const rows = (failures || []).map(f => ({
    key: keyOf(f, 'payload'), payload: String(f.payload || ''),
    stoppedBy: String(f.stoppedBy || f.defense || (num(f.status, 0) === 403 ? 'waf' : 'application')),
    transformation: String(f.transformation || f.mutationApplied || 'none'),
    stage: String(f.stage || 'delivery'),
    verdict: String(f.verdict || 'failed'),
  })).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, autopsyCount: rows.length, top: rows[0] || null, summary: `Infinity AI generated ${rows.length} per-payload autopsy report(s) showing exactly what stopped each payload.` };
}
/** Idea 53515 — Failure Cost Accounting. */
export function accountFailureCosts(failures = [], options = {}) {
  const costPerRequest = num(options.costPerRequest, 1);
  const rows = (failures || []).map(f => {
    const requests = num(f.requests ?? f.attempts, 1);
    const doomed = f.doomed === true || clamp01(f.successProbability ?? 1) < num(options.doomedBelow, 0.1);
    return { key: keyOf(f, 'payload'), requests, cost: round2(requests * costPerRequest), doomed, wasted: doomed ? round2(requests * costPerRequest) : 0 };
  }).sort((a, b) => b.cost - a.cost || String(a.key).localeCompare(String(b.key)));
  const totalCost = round2(rows.reduce((s, r) => s + r.cost, 0));
  const wastedCost = round2(rows.reduce((s, r) => s + r.wasted, 0));
  return { rows, count: rows.length, totalCost, wastedCost, doomedCount: rows.filter(r => r.doomed).length, top: rows[0] || null, summary: `Infinity AI tracked ${wastedCost} wasted request(s) on doomed payloads to justify smarter selection.` };
}
/** Idea 53516 — Survivorship Bias Correction. */
export function correctSurvivorshipBias(scores = [], options = {}) {
  const rows = (scores || []).map(s => {
    const raw = clamp01(s.effectiveness ?? s.score ?? 0);
    const tested = num(s.timesTested ?? s.tests, 0);
    const survived = num(s.timesSurvived ?? s.survivals, 0);
    const survivalRate = rate(survived, tested);
    const adjusted = round2(raw * (0.5 + 0.5 * (tested ? survivalRate : 1)));
    return { key: keyOf(s, 'technique'), technique: String(s.technique || s.name || keyOf(s, 'technique')), raw, tested, survived, survivalRate, adjusted };
  }).sort((a, b) => b.adjusted - a.adjusted || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, averageRaw: mean(rows.map(r => r.raw)), averageAdjusted: mean(rows.map(r => r.adjusted)), top: rows[0] || null, summary: `Infinity AI corrected effectiveness scores for survivorship bias across ${rows.length} technique(s).` };
}
/** Idea 53517 — Failure-Driven Mutation Suggestions. */
export function suggestFailureDrivenMutations(failures = [], options = {}) {
  const byDefense = { waf: ['encode payload', 'split tokens', 'switch content-type'], patched: ['target sibling endpoint', 'vary parameter'], filtered: ['case mutation', 'comment injection', 'double encoding'], default: ['encode payload', 'vary parameter'] };
  const rows = (failures || []).map(f => {
    const defense = String(f.defense || f.stoppedBy || 'default').toLowerCase();
    const suggestions = byDefense[defense] || byDefense.default;
    return { key: keyOf(f, 'payload'), defense, suggestions: [...suggestions], topSuggestion: suggestions[0] };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, suggestionCount: rows.reduce((s, r) => s + r.suggestions.length, 0), top: rows[0] || null, summary: `Infinity AI suggested targeted mutations for ${rows.length} failed payload(s) based on the observed defense.` };
}
/** Idea 53518 — Time-to-Failure Analysis. */
export function analyzeTimeToFailure(failures = [], options = {}) {
  const fastMs = num(options.fastFailMs, 2000);
  const rows = (failures || []).map(f => {
    const ms = num(f.timeToFailureMs ?? f.durationMs, 0);
    return { key: keyOf(f, 'payload'), timeToFailureMs: ms, fastFail: ms > 0 && ms <= fastMs, hopeless: f.hopeless === true };
  }).sort((a, b) => a.timeToFailureMs - b.timeToFailureMs || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, fastFailCount: rows.filter(r => r.fastFail).length, averageMs: mean(rows.map(r => r.timeToFailureMs)), top: rows[0] || null, summary: `Infinity AI measures time-to-failure so hopeless payloads fail fast (avg ${mean(rows.map(r => r.timeToFailureMs))}ms).` };
}
/** Idea 53519 — Failure Signal Libraries. */
export function buildFailureSignalLibraries(signals = [], options = {}) {
  const groups = new Map();
  for (const s of signals || []) {
    const product = String(s.product || s.defenseProduct || 'generic-waf');
    const g = groups.get(product) || { key: product, product, signatures: new Set() };
    g.signatures.add(String(s.signature || s.pattern || 'block-page'));
    groups.set(product, g);
  }
  const rows = [...groups.values()].map(g => ({ key: g.key, product: g.product, signatures: [...g.signatures].sort(), signatureCount: g.signatures.size }))
    .sort((a, b) => b.signatureCount - a.signatureCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, productCount: rows.length, totalSignatures: rows.reduce((s, r) => s + r.signatureCount, 0), top: rows[0] || null, summary: `Infinity AI maintains WAF-block signal libraries for ${rows.length} defense product(s).` };
}
/** Idea 53520 — False-Negative Failure Reviews. */
export function reviewFalseNegativeFailures(reviews = [], options = {}) {
  const rows = (reviews || []).map(r => ({
    key: String(r.id || r.key || 'review'), target: String(r.target || ''), payload: String(r.payload || ''),
    laterFoundManually: r.laterFoundManually === true || Boolean(r.manualFinding),
    originalVerdict: String(r.originalVerdict || 'failed'),
    falseNegative: (r.laterFoundManually === true || Boolean(r.manualFinding)) && String(r.originalVerdict || 'failed') === 'failed',
  })).sort((a, b) => Number(b.falseNegative) - Number(a.falseNegative) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, falseNegativeCount: rows.filter(r => r.falseNegative).length, reviewedCount: rows.length, top: rows[0] || null, summary: `Infinity AI re-examined ${rows.length} failure(s) and found ${rows.filter(r => r.falseNegative).length} false negative(s) worth retesting.` };
}
