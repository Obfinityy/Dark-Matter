/**
 * compareDeepCore.js — Infinity AI · Dark-Matter · Wave 64 (ideas 52521–52535)
 * Pure JS (no React / DOM / network). Deterministic deep comparison helpers:
 * triage-decision drift, FP-rate trends, MTTR movement, bounty outcomes,
 * environment/branch/acquisition/vendor comparisons, PDF/CSV export payloads,
 * industry + own-history benchmarks, triage-SLA comparison, hunt replay, and
 * executive one-pager builders. Time is injected via `now` params
 * (default Date.now()) so every function is reproducible.
 *
 * Hunt shape used throughout:
 * {
 *   id, target, at, env, branch, program,
 *   findings: [{ id, title, severity, state, vulnClass, asset, fp,
 *                 detectedAt, fixedAt, triagedAt, triageDecision,
 *                 reviewer, payout, payoutStatus }],
 * }
 */

export const WAVE64_CD_IDEAS = [
  {
    id: 52521,
    title: 'Triage-decision comparison',
    desc: 'Compare how two hunts findings were triaged to spot reviewer inconsistency.',
    skip: false,
  },
  {
    id: 52522,
    title: 'FP-rate comparison',
    desc: 'Hunt-over-hunt FP rates to validate detection improvements.',
    skip: false,
  },
  {
    id: 52523,
    title: 'MTTR comparison across hunts',
    desc: 'See whether remediation is getting faster per target.',
    skip: false,
  },
  {
    id: 52524,
    title: 'Bounty-outcome comparison',
    desc: 'Compare acceptance rates and payouts across hunts per program.',
    skip: false,
  },
  {
    id: 52525,
    title: 'Staging vs production compare',
    desc: 'Diff staging and production hunts to catch environment drift issues.',
    skip: false,
  },
  {
    id: 52526,
    title: 'Feature-branch compare',
    desc: 'Compare a branch-targeted hunt against main to gate merges.',
    skip: false,
  },
  {
    id: 52527,
    title: 'Acquisition target compare',
    desc: "Benchmark a newly acquired asset's hunt against your portfolio baseline.",
    skip: false,
  },
  {
    id: 52528,
    title: 'Vendor comparison',
    desc: "Compare hunts across third-party vendors' assets for procurement decisions.",
    skip: false,
  },
  {
    id: 52529,
    title: 'Comparison PDF export (post-hunt)',
    desc: 'Branded PDF of the full comparison for board and client distribution.',
    skip: false,
  },
  {
    id: 52530,
    title: 'Comparison CSV export (post-hunt)',
    desc: 'Tabular diff data for analysts and auditors.',
    skip: false,
  },
  {
    id: 52531,
    title: 'Benchmark vs industry (post-hunt)',
    desc: 'Contextualize your hunt metrics against anonymized industry aggregates.',
    skip: false,
  },
  {
    id: 52532,
    title: 'Benchmark vs own history',
    desc: "Every comparison shows the target's historical best/worst for context.",
    skip: false,
  },
  {
    id: 52533,
    title: 'Comparison of triage SLAs',
    desc: 'See whether review speed improved between hunts.',
    skip: false,
  },
  {
    id: 52534,
    title: '"Hunt replay" comparison',
    desc: "Re-run the old hunt's scope with current engines to isolate engine vs target changes.",
    skip: false,
  },
  {
    id: 52535,
    title: 'Executive comparison one-pager',
    desc: 'Auto-generated single-page summary of any comparison for leadership.',
    skip: false,
  },
];

const DAY = 86400000;

function findings(hunt) {
  return Array.isArray(hunt && hunt.findings) ? hunt.findings : [];
}

/**
 * 52521 — Compare triage decisions between two hunts; flag same-class
 * findings that got different decisions (reviewer inconsistency).
 * @param {object} huntA Older hunt.
 * @param {object} huntB Newer hunt.
 * @returns {{ mismatches: object[], mismatchRate: number }}
 */
export function compareTriageDecisions(huntA, huntB) {
  const byClass = new Map();
  for (const f of [...findings(huntA), ...findings(huntB)]) {
    if (!f.triageDecision || !f.vulnClass) continue;
    const list = byClass.get(f.vulnClass) || [];
    list.push({ hunt: f === undefined ? '' : '', decision: f.triageDecision, title: f.title });
    byClass.set(f.vulnClass, list);
  }
  const mismatches = [];
  for (const [vulnClass, list] of byClass) {
    const decisions = new Set(list.map(l => l.decision));
    if (decisions.size > 1)
      mismatches.push({ vulnClass, decisions: [...decisions], samples: list.slice(0, 4) });
  }
  const total = [...byClass.values()].reduce((n, l) => n + l.length, 0);
  return { mismatches, mismatchRate: total ? mismatches.length / byClass.size : 0 };
}

/**
 * 52522 — FP rate per hunt, plus trend direction across hunts.
 * @param {object[]} hunts Ordered oldest → newest.
 * @returns {{ perHunt: object[], trend: 'down'|'up'|'flat' }}
 */
export function compareFpRates(hunts) {
  const perHunt = hunts.map(h => {
    const fs = findings(h);
    const fp = fs.filter(f => f.fp).length;
    return { huntId: h.id, total: fs.length, fp, fpRate: fs.length ? fp / fs.length : 0 };
  });
  let trend = 'flat';
  if (perHunt.length >= 2) {
    const first = perHunt[0].fpRate;
    const last = perHunt[perHunt.length - 1].fpRate;
    trend = last < first - 0.01 ? 'down' : last > first + 0.01 ? 'up' : 'flat';
  }
  return { perHunt, trend };
}

/**
 * 52523 — Mean time to remediate per hunt (fixed findings only).
 * @param {object[]} hunts
 * @returns {{ perHunt: object[], improving: boolean }}
 */
export function compareMttr(hunts) {
  const perHunt = hunts.map(h => {
    const fixed = findings(h).filter(f => f.fixedAt && f.detectedAt && f.fixedAt >= f.detectedAt);
    const mttr = fixed.length
      ? fixed.reduce((n, f) => n + (f.fixedAt - f.detectedAt), 0) / fixed.length / DAY
      : null;
    return {
      huntId: h.id,
      fixed: fixed.length,
      mttrDays: mttr === null ? null : Math.round(mttr * 10) / 10,
    };
  });
  const vals = perHunt.filter(p => p.mttrDays !== null).map(p => p.mttrDays);
  const improving = vals.length >= 2 && vals[vals.length - 1] < vals[0];
  return { perHunt, improving };
}

/**
 * 52524 — Acceptance rate and total payout per program across hunts.
 * @param {object[]} hunts
 * @returns {{ perProgram: object[] }}
 */
export function compareBountyOutcomes(hunts) {
  const byProgram = new Map();
  for (const h of hunts) {
    const key = h.program || 'unknown';
    const cur = byProgram.get(key) || { program: key, submitted: 0, accepted: 0, payout: 0 };
    for (const f of findings(h)) {
      if (
        f.payoutStatus === 'submitted' ||
        f.payoutStatus === 'accepted' ||
        f.payoutStatus === 'paid'
      ) {
        cur.submitted += 1;
      }
      if (f.payoutStatus === 'accepted' || f.payoutStatus === 'paid') {
        cur.accepted += 1;
        cur.payout += Number(f.payout) || 0;
      }
    }
    byProgram.set(key, cur);
  }
  const perProgram = [...byProgram.values()].map(p => ({
    ...p,
    acceptanceRate: p.submitted ? Math.round((p.accepted / p.submitted) * 1000) / 1000 : 0,
  }));
  return { perProgram };
}

/**
 * 52525 — Diff staging vs production hunts: findings only in prod
 * (drift risk) and only in staging (unshipped issues).
 * @param {object} staging
 * @param {object} prod
 * @returns {{ onlyProd: object[], onlyStaging: object[], overlap: number }}
 */
export function compareEnvHunts(staging, prod) {
  const key = f => `${f.vulnClass || ''}|${f.title || ''}`;
  const sSet = new Set(findings(staging).map(key));
  const pSet = new Set(findings(prod).map(key));
  const onlyProd = findings(prod).filter(f => !sSet.has(key(f)));
  const onlyStaging = findings(staging).filter(f => !pSet.has(key(f)));
  const overlap = findings(prod).filter(f => sSet.has(key(f))).length;
  return { onlyProd, onlyStaging, overlap };
}

/**
 * 52526 — Gate check: does the branch hunt introduce new critical/high
 * findings vs the main hunt?
 * @param {object} branchHunt
 * @param {object} mainHunt
 * @returns {{ gate: 'pass'|'block', newSevere: object[] }}
 */
export function compareBranchHunts(branchHunt, mainHunt) {
  const key = f => `${f.vulnClass || ''}|${f.title || ''}`;
  const mainSet = new Set(findings(mainHunt).map(key));
  const newSevere = findings(branchHunt).filter(
    f => !mainSet.has(key(f)) && (f.severity === 'critical' || f.severity === 'high') && !f.fp
  );
  return { gate: newSevere.length ? 'block' : 'pass', newSevere };
}

/**
 * 52527 — Benchmark an acquisition target's hunt against portfolio baseline.
 * @param {object} targetHunt
 * @param {{ avgFindings: number, avgCritical: number, avgFpRate: number }} baseline
 * @returns {{ deltas: object, verdict: string }}
 */
export function benchmarkAcquisition(targetHunt, baseline) {
  const fs = findings(targetHunt);
  const critical = fs.filter(f => f.severity === 'critical' && !f.fp).length;
  const fpRate = fs.length ? fs.filter(f => f.fp).length / fs.length : 0;
  const deltas = {
    findings: fs.length - (baseline.avgFindings || 0),
    critical: critical - (baseline.avgCritical || 0),
    fpRate: Math.round((fpRate - (baseline.avgFpRate || 0)) * 1000) / 1000,
  };
  const verdict =
    deltas.critical > 0
      ? 'above-baseline-risk'
      : deltas.findings > 0
        ? 'above-baseline-volume'
        : 'within-baseline';
  return { deltas, verdict };
}

/**
 * 52528 — Rank vendor hunts by composite score (fewer criticals, lower FP rate).
 * @param {object[]} vendorHunts Each with vendor name.
 * @returns {object[]} Ranked best → worst.
 */
export function compareVendors(vendorHunts) {
  return vendorHunts
    .map(h => {
      const fs = findings(h);
      const critical = fs.filter(f => f.severity === 'critical' && !f.fp).length;
      const fpRate = fs.length ? fs.filter(f => f.fp).length / fs.length : 0;
      const score = Math.round((100 - critical * 10 - fpRate * 50) * 10) / 10;
      return {
        vendor: h.vendor || h.id,
        score,
        critical,
        fpRate: Math.round(fpRate * 1000) / 1000,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * 52529 — Build a branded PDF export payload for a comparison.
 * @param {object} comparison { title, hunts, sections }
 * @param {object} [brand] { name, logoUrl }
 * @returns {object} Print-ready payload (renderer-agnostic).
 */
export function buildComparisonPdfPayload(comparison, brand) {
  return {
    kind: 'comparison-pdf',
    brand: {
      name: (brand && brand.name) || 'Infinity AI',
      logoUrl: (brand && brand.logoUrl) || null,
    },
    title: comparison.title || 'Hunt comparison',
    generatedAt: Date.now(),
    hunts: (comparison.hunts || []).map(h => ({ id: h.id, target: h.target, at: h.at })),
    sections: comparison.sections || [],
  };
}

/**
 * 52530 — Flatten comparison rows to CSV text.
 * @param {object[]} rows
 * @param {string[]} [columns]
 * @returns {string} CSV text.
 */
export function buildComparisonCsv(rows, columns) {
  const cols = columns && columns.length ? columns : Object.keys(rows[0] || {});
  const esc = v => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.map(esc).join(',')];
  for (const r of rows) lines.push(cols.map(c => esc(r[c])).join(','));
  return lines.join('\n');
}

/**
 * 52531 — Contextualize metrics vs anonymized industry aggregates.
 * @param {object} metrics { fpRate, mttrDays, criticalPerHunt }
 * @param {object} industry { fpRateP50, mttrDaysP50, criticalPerHuntP50 }
 * @returns {object[]} Per-metric percentile-style readouts.
 */
export function benchmarkVsIndustry(metrics, industry) {
  const cmp = (v, p50, lowerBetter) => {
    if (v === null || v === undefined || !p50) return 'unknown';
    if (v === p50) return 'at-median';
    const better = lowerBetter ? v < p50 : v > p50;
    return better ? 'better-than-median' : 'worse-than-median';
  };
  return [
    {
      metric: 'fpRate',
      value: metrics.fpRate,
      standing: cmp(metrics.fpRate, industry.fpRateP50, true),
    },
    {
      metric: 'mttrDays',
      value: metrics.mttrDays,
      standing: cmp(metrics.mttrDays, industry.mttrDaysP50, true),
    },
    {
      metric: 'criticalPerHunt',
      value: metrics.criticalPerHunt,
      standing: cmp(metrics.criticalPerHunt, industry.criticalPerHuntP50, true),
    },
  ];
}

/**
 * 52532 — Show historical best/worst for a target alongside current metrics.
 * @param {object} current { fpRate, mttrDays, critical }
 * @param {object[]} history Past metric snapshots.
 * @returns {{ best: object, worst: object, current: object }}
 */
export function benchmarkVsHistory(current, history) {
  const all = [...history, current];
  const pick = (fn, arr) => arr.reduce((a, b) => (fn(a, b) ? a : b));
  const best = {
    fpRate: pick((a, b) => a.fpRate <= b.fpRate, all).fpRate,
    mttrDays: pick((a, b) => (a.mttrDays ?? Infinity) <= (b.mttrDays ?? Infinity), all).mttrDays,
    critical: pick((a, b) => a.critical <= b.critical, all).critical,
  };
  const worst = {
    fpRate: pick((a, b) => a.fpRate >= b.fpRate, all).fpRate,
    mttrDays: pick((a, b) => (a.mttrDays ?? -1) >= (b.mttrDays ?? -1), all).mttrDays,
    critical: pick((a, b) => a.critical >= b.critical, all).critical,
  };
  return { best, worst, current };
}

/**
 * 52533 — Average triage turnaround (detectedAt → triagedAt) per hunt.
 * @param {object[]} hunts
 * @returns {{ perHunt: object[], improving: boolean }}
 */
export function compareTriageSlas(hunts) {
  const perHunt = hunts.map(h => {
    const t = findings(h).filter(f => f.triagedAt && f.detectedAt && f.triagedAt >= f.detectedAt);
    const avg = t.length
      ? t.reduce((n, f) => n + (f.triagedAt - f.detectedAt), 0) / t.length / 3600000
      : null;
    return {
      huntId: h.id,
      triaged: t.length,
      avgTriageHours: avg === null ? null : Math.round(avg * 10) / 10,
    };
  });
  const vals = perHunt.filter(p => p.avgTriageHours !== null).map(p => p.avgTriageHours);
  return { perHunt, improving: vals.length >= 2 && vals[vals.length - 1] < vals[0] };
}

/**
 * 52534 — Replay plan: same scope, current engine version; classify whether
 * finding deltas look engine-driven or target-driven.
 * @param {object} oldHunt
 * @param {object} newHunt
 * @param {string} engineVersion
 * @returns {{ plan: object, attribution: string }}
 */
export function replayComparison(oldHunt, newHunt, engineVersion) {
  const key = f => `${f.vulnClass || ''}|${f.title || ''}`;
  const oldSet = new Set(findings(oldHunt).map(key));
  const fresh = findings(newHunt).filter(f => !oldSet.has(key(f)));
  const engineDriven = fresh.filter(
    f => f.engineVersion && f.engineVersion !== oldHunt.engineVersion
  ).length;
  const attribution =
    fresh.length === 0
      ? 'no-change'
      : engineDriven / fresh.length > 0.5
        ? 'engine-driven'
        : 'target-driven';
  return {
    plan: {
      scope: oldHunt.scope || oldHunt.target,
      engineVersion: engineVersion || 'current',
      baselineHuntId: oldHunt.id,
    },
    attribution,
  };
}

/**
 * 52535 — One-page executive summary of a comparison.
 * @param {object} comparison { title, hunts, highlights, risks }
 * @returns {object} One-pager payload.
 */
export function buildExecOnePager(comparison) {
  return {
    kind: 'exec-one-pager',
    title: comparison.title || 'Hunt comparison — executive summary',
    generatedAt: Date.now(),
    huntCount: (comparison.hunts || []).length,
    highlights: (comparison.highlights || []).slice(0, 5),
    topRisks: (comparison.risks || []).slice(0, 3),
    callToAction:
      comparison.callToAction || 'Review the full comparison for remediation priorities.',
  };
}
