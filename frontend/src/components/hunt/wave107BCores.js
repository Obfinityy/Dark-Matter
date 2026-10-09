// Wave 107B core logic — change feed + risk scoring foundation (ideas 54251-54260).
// Pure JS: no JSX, no side effects, deterministic. Plain objects in, plain objects out.

export const WAVE107_B_IDEAS = [
  { id: 54251, title: 'Change filters by type' },
  { id: 54252, title: 'Cross-target change correlation' },
  { id: 54253, title: 'Change-to-finding linkage' },
  { id: 54254, title: 'Quiet-hours change batching' },
  { id: 54255, title: 'Composite risk score 0–100' },
  { id: 54256, title: 'Attack surface size factor' },
  { id: 54257, title: 'Technology risk factor' },
  { id: 54258, title: 'Exposure factor' },
  { id: 54259, title: 'Data sensitivity factor' },
  { id: 54260, title: 'Bounty value factor' },
];

// Valid change categories for the change feed.
export const CHANGE_TYPES = ['dns', 'cert', 'content', 'tech', 'network'];

// 54251 — Narrows the change feed to DNS, cert, content, tech, or network categories.
// changes: [{ id, target, type, at, summary }]; type: string | string[]
// Returns only changes whose type is in the requested set. Unknown types => [].
export function filterChangesByType(changes, type) {
  const wanted = new Set(Array.isArray(type) ? type : [type]);
  const known = CHANGE_TYPES.filter((t) => wanted.has(t));
  if (known.length === 0) return [];
  const allowed = new Set(known);
  return (changes || []).filter((c) => c && allowed.has(c.type));
}

// 54252 — Groups simultaneous similar changes across targets as likely platform-wide deploys.
// changes: [{ id, target, type, at, summary }]
// Returns [{ key, type, at (earliest), targets: [...], changes: [...] }] with >=2 targets,
// where same-type changes occurred within windowMs of each other.
export function correlateCrossTarget(changes, windowMs = 15 * 60 * 1000) {
  const list = (changes || []).filter((c) => c && c.target && c.type && c.at != null);
  const byType = {};
  for (const c of list) {
    (byType[c.type] = byType[c.type] || []).push(c);
  }
  const groups = [];
  for (const [type, items] of Object.entries(byType)) {
    const sorted = [...items].sort((a, b) => a.at - b.at);
    let bucket = [];
    for (const c of sorted) {
      if (bucket.length > 0 && c.at - bucket[bucket.length - 1].at > windowMs) {
        bucket = [];
      }
      if (bucket.length === 0) {
        // Only start a new bucket if this change could seed a multi-target group.
        bucket = [c];
      } else {
        bucket.push(c);
      }
      const targets = new Set(bucket.map((x) => x.target));
      const last = groups[groups.length - 1];
      if (targets.size >= 2 && (!last || last.type !== type || bucket.length === 1)) {
        groups.push({
          key: `${type}:${bucket[0].at}`,
          type,
          at: bucket[0].at,
          targets: [...targets].sort(),
          changes: bucket.map((x) => ({ id: x.id, target: x.target, at: x.at })),
        });
      } else if (targets.size >= 2 && last && last.type === type) {
        last.targets = [...targets].sort();
        last.changes = bucket.map((x) => ({ id: x.id, target: x.target, at: x.at }));
      }
    }
  }
  return groups;
}

// 54253 — Links findings discovered shortly after a change to that change for root-cause context.
// findings: [{ id, target, foundAt, title }]; changes: [{ id, target, at, summary }]
// Returns [{ ...finding, linkedChangeIds: [...] }]; a finding links to changes on the same
// target that happened within windowMs BEFORE the finding.
export function linkFindingsToChange(findings, changes, windowMs = 24 * 60 * 60 * 1000) {
  const byTarget = {};
  for (const c of changes || []) {
    if (!c || !c.target || c.at == null) continue;
    (byTarget[c.target] = byTarget[c.target] || []).push(c);
  }
  return (findings || []).map((f) => {
    const candidates = (byTarget[f.target] || []).filter(
      (c) => f.foundAt >= c.at && f.foundAt - c.at <= windowMs,
    );
    return {
      ...f,
      linkedChangeIds: candidates
        .sort((a, b) => b.at - a.at)
        .map((c) => c.id),
    };
  });
}

// 54254 — Holds low-severity change alerts overnight and delivers one morning summary.
// alerts: [{ id, severity, at, summary }]; options: { quietStartHour, quietEndHour, now, lowSeverities }
// Returns { immediate: [...], held: [...], morningSummary } — high-severity alerts always
// pass through; low-severity alerts inside quiet hours are held and rolled into a summary.
export function batchQuietHours(
  alerts,
  { quietStartHour = 22, quietEndHour = 7, now = 0, lowSeverities = ['low', 'info'] } = {},
) {
  const low = new Set(lowSeverities);
  const hourOf = (at) => new Date(at).getUTCHours();
  const inQuiet = (at) => {
    const h = hourOf(at);
    if (quietStartHour <= quietEndHour) return h >= quietStartHour && h < quietEndHour;
    return h >= quietStartHour || h < quietEndHour; // overnight window
  };
  const immediate = [];
  const held = [];
  for (const a of alerts || []) {
    if (!a) continue;
    if (low.has(a.severity) && inQuiet(a.at)) held.push(a);
    else immediate.push(a);
  }
  const morningSummary =
    held.length === 0
      ? null
      : {
          generatedAt: now,
          count: held.length,
          byType: held.reduce((acc, a) => {
            acc[a.type || 'unknown'] = (acc[a.type || 'unknown'] || 0) + 1;
            return acc;
          }, {}),
          heldIds: held.map((a) => a.id),
        };
  return { immediate, held, morningSummary };
}

// ---- Risk scoring factors (each returns 0–100) ----

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

// 54256 — Weighs subdomain, endpoint, and port counts so sprawling targets score higher.
// Logarithmic normalization: 10 items ≈ 50, 100 ≈ 75, 1000+ ≈ 100 per dimension.
export function surfaceSizeFactor({ subdomains = 0, endpoints = 0, ports = 0 } = {}) {
  const dims = [subdomains, endpoints, ports].map((n) =>
    clamp01(Math.log10(1 + Math.max(0, n)) / 3),
  );
  const avg = dims.reduce((a, b) => a + b, 0) / dims.length;
  return Math.round(avg * 100);
}

// 54257 — Raises scores for EOL frameworks, old CMS versions, and risky default stacks.
// stack: [{ name, version, eol, riskyDefault }] — eol: true or 'YYYY-MM-DD' (past = EOL).
export function technologyRiskFactor(stack = [], now = 0) {
  if (!Array.isArray(stack) || stack.length === 0) return 0;
  const EOL_HITS = [
    /angularjs/i,
    /jquery.*1\./i,
    /python 2/i,
    /php 5/i,
    /php 7\.[0-3]/i,
    /node 1[0-6]/i,
    /wordpress 4/i,
    /drupal 7/i,
    /joomla 3/i,
    /struts 2/i,
  ];
  const per = stack.map((item) => {
    const s = item ? `${item.name || ''} ${item.version || ''}` : '';
    let score = 0;
    if (item && item.eol === true) score = 90;
    else if (typeof item.eol === 'string' && item.eol < new Date(now).toISOString().slice(0, 10))
      score = 90;
    if (score === 0 && EOL_HITS.some((re) => re.test(s))) score = 75;
    if (item && item.riskyDefault) score = Math.max(score, 60);
    if (score === 0) score = 10; // known but current
    return score;
  });
  return Math.round(per.reduce((a, b) => a + b, 0) / per.length);
}

// 54258 — Scores internet-facing production higher than staging or internal assets.
// environment: 'production' | 'staging' | 'development' | 'internal'; internetFacing: boolean.
export function exposureFactor({ environment = 'staging', internetFacing = true } = {}) {
  const envWeight = {
    production: 1,
    staging: 0.45,
    development: 0.25,
    internal: 0.1,
  }[environment] ?? 0.35;
  const facing = internetFacing ? 1 : 0.4;
  return Math.round(clamp01(envWeight * facing) * 100);
}

// 54259 — Boosts targets handling payments, health, identity, or financial data.
// dataTypes: array of strings. weights: payments/health/financial > identity > pii > none.
export function dataSensitivityFactor({ dataTypes = [] } = {}) {
  const weights = {
    payments: 100,
    payment: 100,
    health: 100,
    financial: 95,
    identity: 85,
    pii: 60,
    behavioral: 30,
    analytics: 15,
  };
  if (!Array.isArray(dataTypes) || dataTypes.length === 0) return 0;
  const scores = dataTypes.map(
    (t) => weights[String(t).toLowerCase().replace(/[^a-z]/g, '')] ?? 20,
  );
  return Math.round(Math.max(...scores));
}

// 54260 — Incorporates program reward ranges so high-payout targets rank higher.
// rewardMin/rewardMax in USD. 0/0 => 0. Scales log-wise up to ~$100k.
export function bountyValueFactor({ rewardMin = 0, rewardMax = 0 } = {}) {
  const top = Math.max(0, rewardMax, rewardMin);
  if (top <= 0) return 0;
  return Math.round(clamp01(Math.log10(1 + top) / Math.log10(1 + 100000)) * 100);
}

// 54255 — Combines surface, tech, exposure, and history factors into one sortable score.
// Returns 0–100 (rounded). Accepts either raw target data (factors computed internally)
// or precomputed factor values under `factors`. Missing input data contributes 0.
export function computeCompositeScore(input = {}) {
  const factors = input.factors || {};
  const surface =
    factors.surface != null
      ? factors.surface
      : input.surfaceSize
        ? surfaceSizeFactor(input.surfaceSize)
        : 0;
  const tech =
    factors.technology != null
      ? factors.technology
      : input.technologyStack
        ? technologyRiskFactor(input.technologyStack, input.now || 0)
        : 0;
  const exposure =
    factors.exposure != null
      ? factors.exposure
      : input.exposure
        ? exposureFactor(input.exposure)
        : 0;
  const sensitivity =
    factors.sensitivity != null
      ? factors.sensitivity
      : input.dataSensitivity
        ? dataSensitivityFactor(input.dataSensitivity)
        : 0;
  const bounty =
    factors.bounty != null
      ? factors.bounty
      : input.bountyValue
        ? bountyValueFactor(input.bountyValue)
        : 0;

  const weights = { surface: 0.25, tech: 0.2, exposure: 0.2, sensitivity: 0.2, bounty: 0.15 };
  const clamp = (v) => Math.min(100, Math.max(0, Number(v) || 0));
  const total =
    clamp(surface) * weights.surface +
    clamp(tech) * weights.tech +
    clamp(exposure) * weights.exposure +
    clamp(sensitivity) * weights.sensitivity +
    clamp(bounty) * weights.bounty;

  const bounded = Math.round(Math.min(100, Math.max(0, total)));
  return {
    score: bounded,
    band: bounded >= 80 ? 'critical' : bounded >= 60 ? 'high' : bounded >= 40 ? 'medium' : 'low',
    factors: {
      surface: Math.round(clamp(surface)),
      technology: Math.round(clamp(tech)),
      exposure: Math.round(clamp(exposure)),
      sensitivity: Math.round(clamp(sensitivity)),
      bounty: Math.round(clamp(bounty)),
    },
  };
}
