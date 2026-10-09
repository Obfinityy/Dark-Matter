/**
 * wave77BCores.js — Infinity AI · Dark-Matter · Wave 77B
 * Stack-conditioned payload effectiveness, ideas 53061–53080.
 * Pure logic for stack hit-rate matrix, framework version
 * sensitivity, CMS plugin ledger, WAF-conditioned scores, language
 * runtime split, database correlation, cloud variance, CDN impact,
 * server header evolution, middleware fingerprint scoring, headless
 * versus traditional CMS split, SPA payload profiles, API gateway
 * conditioning, container signals, legacy decay curves, stack combo
 * rarity, patch-level granularity, multi-tenant normalization, edge
 * compute behavior, and GraphQL engine specificity. Every helper
 * takes explicit inputs, never mutates them, and returns structured
 * view models.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE77_B_IDEAS = [
  { id: 53061, title: 'Stack-Specific Hit-Rate Matrix', skip: false },
  { id: 53062, title: 'Framework Version Sensitivity Tracking', skip: false },
  { id: 53063, title: 'CMS Plugin Payload Ledger', skip: false },
  { id: 53064, title: 'WAF-Fingerprint-Conditioned Scores', skip: false },
  { id: 53065, title: 'Language-Runtime Effectiveness Split', skip: false },
  { id: 53066, title: 'Database-Backend Correlation', skip: false },
  { id: 53067, title: 'Cloud-Provider Payload Variance', skip: false },
  { id: 53068, title: 'CDN Layer Impact Analysis', skip: false },
  { id: 53069, title: 'Server Header Evolution Tracking', skip: false },
  { id: 53070, title: 'Middleware Stack Fingerprint Scoring', skip: false },
  { id: 53071, title: 'Headless-vs-Traditional CMS Split', skip: false },
  { id: 53072, title: 'SPA Framework Payload Profiles', skip: false },
  { id: 53073, title: 'API Gateway Conditioning', skip: false },
  { id: 53074, title: 'Container Orchestration Signals', skip: false },
  { id: 53075, title: 'Legacy Stack Decay Curves', skip: false },
  { id: 53076, title: 'Stack Combo Rarity Index', skip: false },
  { id: 53077, title: 'Patch-Level Granularity Tracking', skip: false },
  { id: 53078, title: 'Multi-Tenant SaaS Normalization', skip: false },
  { id: 53079, title: 'Edge Compute Payload Behavior', skip: false },
  { id: 53080, title: 'GraphQL Engine Specificity', skip: false },
];

function rate(part, whole) { return whole ? Math.round((part / whole) * 100) / 100 : 0; }
function groupRates(attempts, keyFn) {
  const groups = new Map();
  for (const a of attempts || []) {
    const key = keyFn(a);
    if (!key) continue;
    const g = groups.get(key) || { key, attempts: 0, successes: 0 };
    g.attempts += 1;
    if (a.success === true) g.successes += 1;
    groups.set(key, g);
  }
  return [...groups.values()].map(g => ({ ...g, hitRate: rate(g.successes, g.attempts) })).sort((a, b) => b.hitRate - a.hitRate || b.attempts - a.attempts || String(a.key).localeCompare(String(b.key)));
}

/** Build the payload-family by stack hit-rate matrix (idea 53061). */
export function buildStackHitRateMatrix(attempts = [], options = {}) {
  const cells = groupRates(attempts, a => `${a.family || 'family'} @ ${a.stack || 'stack'}`);
  const families = [...new Set((attempts || []).map(a => a.family || 'family'))];
  const stacks = [...new Set((attempts || []).map(a => a.stack || 'stack'))];
  return { cells, cellCount: cells.length, families, stacks, bestCell: cells[0] || null, summary: `Infinity AI built a ${families.length} by ${stacks.length} stack hit-rate matrix (${cells.length} cell(s)).` };
}

/** Track payload success across framework versions (idea 53062). */
export function trackFrameworkVersionSensitivity(attempts = [], options = {}) {
  const rows = groupRates(attempts, a => `${a.framework || 'framework'} ${a.frameworkVersion || a.version || '?'}`);
  const dead = rows.filter(r => r.attempts >= 3 && r.hitRate === 0);
  return { rows, count: rows.length, deadPayloadGroups: dead, deadCount: dead.length, best: rows[0] || null, summary: `Infinity AI tracked ${rows.length} framework-version group(s); ${dead.length} version-dead.` };
}

/** Ledger payloads per CMS plugin version (idea 53063). */
export function buildCmsPluginPayloadLedger(attempts = [], options = {}) {
  const rows = groupRates(attempts, a => `${a.plugin || 'plugin'} ${a.pluginVersion || a.version || '?'}`);
  const proven = rows.filter(r => r.successes > 0);
  return { rows, count: rows.length, provenCount: proven.length, best: rows[0] || null, summary: `Infinity AI ledgered ${rows.length} CMS plugin payload group(s); ${proven.length} proven.` };
}

/** Condition payload scores on the observed WAF (idea 53064). */
export function scoreWafConditionedPayloads(attempts = [], options = {}) {
  const rows = groupRates(attempts, a => `${a.family || 'family'} via ${a.waf || 'no-waf'}`);
  const byWaf = groupRates(attempts, a => a.waf || 'no-waf');
  return { rows, count: rows.length, byWaf, best: rows[0] || null, summary: `Infinity AI conditioned ${rows.length} payload group(s) on WAF fingerprints.` };
}

/** Split payload results by backend language runtime (idea 53065). */
export function splitLanguageRuntimeEffectiveness(attempts = [], options = {}) {
  const rows = groupRates(attempts, a => a.runtime || a.language || null);
  return { rows, count: rows.length, best: rows[0] || null, worst: rows[rows.length - 1] || null, summary: `Infinity AI split payload effectiveness across ${rows.length} language runtime(s).` };
}

/** Correlate injection outcomes with the database engine (idea 53066). */
export function correlateDatabaseBackend(attempts = [], options = {}) {
  const injection = (attempts || []).filter(a => /inject|sqli/i.test(String(a.family || a.kind || '')));
  const rows = groupRates(injection, a => a.database || a.db || null);
  return { rows, count: rows.length, injectionAttempts: injection.length, best: rows[0] || null, summary: `Infinity AI correlated ${injection.length} injection attempt(s) across ${rows.length} database backend(s).` };
}

/** Compare payload success across cloud providers (idea 53067). */
export function compareCloudProviderVariance(attempts = [], options = {}) {
  const rows = groupRates(attempts, a => a.cloud || a.provider || null);
  const rates = rows.map(r => r.hitRate);
  const variance = rates.length ? Math.round(((Math.max(...rates) - Math.min(...rates))) * 100) / 100 : 0;
  return { rows, count: rows.length, spread: variance, best: rows[0] || null, summary: `Infinity AI cloud-provider payload spread is ${variance} across ${rows.length} provider(s).` };
}

/** Measure CDN presence impact on payload effectiveness (idea 53068). */
export function analyzeCdnLayerImpact(attempts = [], options = {}) {
  const withCdn = (attempts || []).filter(a => a.cdn === true || a.viaCdn === true);
  const direct = (attempts || []).filter(a => !(a.cdn === true || a.viaCdn === true));
  const cdnRate = rate(withCdn.filter(a => a.success === true).length, withCdn.length);
  const directRate = rate(direct.filter(a => a.success === true).length, direct.length);
  return { cdnAttempts: withCdn.length, directAttempts: direct.length, cdnRate, directRate, delta: Math.round((directRate - cdnRate) * 100) / 100, summary: `Infinity AI CDN impact delta is ${Math.round((directRate - cdnRate) * 100) / 100} (direct ${directRate} vs CDN ${cdnRate}).` };
}

/** Track server header evolution against payload decay (idea 53069). */
export function trackServerHeaderEvolution(snapshots = [], options = {}) {
  const sorted = [...(snapshots || [])].sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  const changes = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].headers || {};
    const cur = sorted[i].headers || {};
    for (const k of Object.keys(cur)) if (prev[k] !== cur[k]) changes.push({ at: sorted[i].at || null, header: k, from: prev[k] || null, to: cur[k] });
  }
  return { snapshots: sorted.length, changes, changeCount: changes.length, summary: `Infinity AI tracked ${changes.length} server header change(s) across ${sorted.length} snapshot(s).` };
}

/** Score payloads against full middleware stack fingerprints (idea 53070). */
export function scoreMiddlewareStackFingerprint(attempts = [], options = {}) {
  const rows = groupRates(attempts, a => [a.proxy, a.appServer, a.framework].filter(Boolean).join(' + ') || null);
  return { rows, count: rows.length, best: rows[0] || null, summary: `Infinity AI scored payloads against ${rows.length} full middleware stack(s).` };
}

/** Split payload effectiveness headless versus traditional CMS (idea 53071). */
export function splitHeadlessVsTraditionalCms(attempts = [], options = {}) {
  const headless = (attempts || []).filter(a => a.cmsMode === 'headless');
  const traditional = (attempts || []).filter(a => a.cmsMode !== 'headless');
  const headlessRate = rate(headless.filter(a => a.success === true).length, headless.length);
  const traditionalRate = rate(traditional.filter(a => a.success === true).length, traditional.length);
  return { headlessAttempts: headless.length, traditionalAttempts: traditional.length, headlessRate, traditionalRate, delta: Math.round((headlessRate - traditionalRate) * 100) / 100, summary: `Infinity AI headless rate ${headlessRate} versus traditional ${traditionalRate}.` };
}

/** Build per-SPA-framework client payload profiles (idea 53072). */
export function buildSpaFrameworkPayloadProfiles(attempts = [], options = {}) {
  const client = (attempts || []).filter(a => /client|xss|dom/i.test(String(a.family || a.kind || '')) || a.spa);
  const rows = groupRates(client, a => a.spa || a.framework || null);
  return { rows, count: rows.length, clientAttempts: client.length, best: rows[0] || null, summary: `Infinity AI profiled ${client.length} client payload attempt(s) across ${rows.length} SPA framework(s).` };
}

/** Condition API payload scores on the detected gateway (idea 53073). */
export function conditionApiGatewayScores(attempts = [], options = {}) {
  const rows = groupRates(attempts, a => a.gateway || null);
  return { rows, count: rows.length, best: rows[0] || null, strictest: rows[rows.length - 1] || null, summary: `Infinity AI conditioned API payload scores on ${rows.length} gateway(s).` };
}

/** Record container orchestration signal differences (idea 53074). */
export function recordContainerOrchestrationSignals(attempts = [], options = {}) {
  const rows = groupRates(attempts, a => a.orchestration || a.platform || null);
  return { rows, count: rows.length, best: rows[0] || null, summary: `Infinity AI recorded payload signals across ${rows.length} orchestration type(s).` };
}

/** Curve payload decay as a stack ages unpatched (idea 53075). */
export function curveLegacyStackDecay(attempts = [], options = {}) {
  const buckets = new Map();
  for (const a of attempts || []) {
    const age = Number(a.stackAgeMonths || 0);
    const bucket = age < 6 ? '0-5mo' : age < 12 ? '6-11mo' : age < 24 ? '12-23mo' : '24mo+';
    const g = buckets.get(bucket) || { bucket, attempts: 0, successes: 0 };
    g.attempts += 1;
    if (a.success === true) g.successes += 1;
    buckets.set(bucket, g);
  }
  const rows = [...buckets.values()].map(g => ({ ...g, hitRate: rate(g.successes, g.attempts) })).sort((a, b) => a.bucket.localeCompare(b.bucket));
  return { rows, count: rows.length, summary: `Infinity AI plotted legacy stack decay across ${rows.length} age bucket(s).` };
}

/** Weight lessons from rare stack combinations higher (idea 53076). */
export function indexStackComboRarity(attempts = [], options = {}) {
  const counts = new Map();
  for (const a of attempts || []) { const k = a.combo || [a.stack, a.framework].filter(Boolean).join(' + '); if (k) counts.set(k, (counts.get(k) || 0) + 1); }
  const total = [...counts.values()].reduce((s, v) => s + v, 0);
  const rows = [...counts.entries()].map(([combo, count]) => ({ combo, count, rarityWeight: total ? Math.round((1 - count / total) * 100) / 100 : 0 })).sort((a, b) => b.rarityWeight - a.rarityWeight || String(a.combo).localeCompare(String(b.combo)));
  return { rows, count: rows.length, rarest: rows[0] || null, summary: `Infinity AI rarity-indexed ${rows.length} stack combination(s).` };
}

/** Tie payload outcomes to detected patch levels (idea 53077). */
export function trackPatchLevelGranularity(attempts = [], options = {}) {
  const rows = groupRates(attempts, a => `${a.component || 'component'} ${a.patchLevel || a.patch || '?'}`);
  const killed = rows.filter(r => r.attempts >= 2 && r.hitRate === 0);
  return { rows, count: rows.length, killedCount: killed.length, killed, best: rows[0] || null, summary: `Infinity AI tracked ${rows.length} patch-level group(s); ${killed.length} payload death(s) attributed.` };
}

/** Normalize payload scores per tenant in multi-tenant SaaS (idea 53078). */
export function normalizeMultiTenantSaaS(attempts = [], options = {}) {
  const rows = groupRates(attempts, a => a.tenant || null);
  const globalRate = rate((attempts || []).filter(a => a.success === true).length, (attempts || []).length);
  const normalized = rows.map(r => ({ ...r, deltaVsGlobal: Math.round((r.hitRate - globalRate) * 100) / 100 }));
  return { rows: normalized, count: normalized.length, globalRate, summary: `Infinity AI normalized payload scores for ${normalized.length} tenant(s) against a global rate of ${globalRate}.` };
}

/** Track edge runtime payload behavior versus origin (idea 53079). */
export function trackEdgeComputePayloadBehavior(attempts = [], options = {}) {
  const edge = (attempts || []).filter(a => a.edge === true || a.runtime === 'edge');
  const origin = (attempts || []).filter(a => !(a.edge === true || a.runtime === 'edge'));
  const edgeRate = rate(edge.filter(a => a.success === true).length, edge.length);
  const originRate = rate(origin.filter(a => a.success === true).length, origin.length);
  return { edgeAttempts: edge.length, originAttempts: origin.length, edgeRate, originRate, delta: Math.round((edgeRate - originRate) * 100) / 100, summary: `Infinity AI edge payload rate ${edgeRate} versus origin ${originRate}.` };
}

/** Separate payload effectiveness by GraphQL engine (idea 53080). */
export function splitGraphqlEngineSpecificity(attempts = [], options = {}) {
  const gql = (attempts || []).filter(a => a.graphqlEngine || /graphql/i.test(String(a.family || a.kind || '')));
  const rows = groupRates(gql, a => a.graphqlEngine || null);
  return { rows, count: rows.length, graphqlAttempts: gql.length, best: rows[0] || null, summary: `Infinity AI split ${gql.length} GraphQL attempt(s) across ${rows.length} engine(s).` };
}
