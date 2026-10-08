// Infinity AI — Wave 48 (ideas 51881–51895): fleet operations pure logic.
// Who-did-what audit, cost rollup, ETA board, scope-conflict detection,
// hunt merge/split, pause presets, resume ordering, keyboard shortcuts,
// voice switching resolution, mobile card payloads, widget payloads,
// dark-mode parity audit, onboarding tour, fleet retrospective.
// Pure functions only: no DOM, no network, no side effects.

export const WAVE48_FLEET_IDEAS = [
  51881, 51882, 51883, 51884, 51885, 51886, 51887, 51888, 51889, 51890, 51891, 51892, 51893, 51894,
  51895,
];

const clampStr = v => (typeof v === 'string' ? v : '');
const clampNum = (v, d = 0) => (Number.isFinite(v) ? v : d);
const clampArr = v => (Array.isArray(v) ? v : []);

// ---- 51881: Hunt audit log — who did what across all hunts, in one log ----
export function buildAuditLog(events, { actor, huntId, kind, since } = {}) {
  const rows = clampArr(events).map((e, i) => ({
    id: e && e.id != null ? e.id : `evt-${i}`,
    ts: clampNum(e && (e.ts || e.time), 0),
    actor: clampStr(e && e.actor) || 'system',
    huntId: clampStr(e && e.huntId),
    kind: clampStr(e && e.kind) || 'note',
    summary: clampStr(e && (e.summary || e.action || e.kind)),
  }));
  return rows
    .filter(
      r =>
        (!actor || r.actor === actor) &&
        (!huntId || r.huntId === huntId) &&
        (!kind || r.kind === kind) &&
        (!since || r.ts >= since)
    )
    .sort((a, b) => b.ts - a.ts);
}

export function auditSummary(events) {
  const rows = buildAuditLog(events);
  const byActor = {};
  const byKind = {};
  for (const r of rows) {
    byActor[r.actor] = (byActor[r.actor] || 0) + 1;
    byKind[r.kind] = (byKind[r.kind] || 0) + 1;
  }
  return { total: rows.length, byActor, byKind };
}

// ---- 51882: Hunt cost rollup — total spend with per-hunt breakdown ----
export function costRollup(hunts) {
  const perHunt = clampArr(hunts).map(h => ({
    huntId: clampStr(h && (h.id || h.huntId)),
    name: clampStr(h && h.name),
    spend: clampNum(h && (h.spend ?? h.cost), 0),
    currency: clampStr((h && h.currency) || 'USD'),
  }));
  const total = perHunt.reduce((s, p) => s + p.spend, 0);
  return {
    total: Math.round(total * 100) / 100,
    currency: (perHunt[0] && perHunt[0].currency) || 'USD',
    perHunt: perHunt.sort((a, b) => b.spend - a.spend),
  };
}

// ---- 51883: Hunt ETA board — all hunts' completion estimates on one board ----
export function etaBoard(hunts, nowMs = Date.now()) {
  return clampArr(hunts)
    .map(h => {
      const etaMs = clampNum(h && h.etaMs, 0);
      const done = clampNum(h && h.done, 0);
      const totalSteps = clampNum(h && h.totalSteps, 0);
      const remaining = etaMs > 0 ? Math.max(0, etaMs - nowMs) : null;
      return {
        huntId: clampStr(h && (h.id || h.huntId)),
        name: clampStr(h && h.name),
        status: clampStr(h && h.status) || 'running',
        etaMs,
        remainingMs: remaining,
        progress: totalSteps > 0 ? Math.min(1, done / totalSteps) : 0,
        overdue: etaMs > 0 && etaMs < nowMs && clampStr(h && h.status) === 'running',
      };
    })
    .sort(
      (a, b) =>
        (a.remainingMs == null ? 1 : 0) - (b.remainingMs == null ? 1 : 0) ||
        (a.remainingMs || 0) - (b.remainingMs || 0)
    );
}

// ---- 51884: Hunt conflict detection — overlapping scope warnings ----
function normScope(s) {
  return clampStr(s)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
}
export function detectConflicts(hunts) {
  const list = clampArr(hunts);
  const warnings = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = new Set(clampArr(list[i] && list[i].scope).map(normScope));
      const b = new Set(clampArr(list[j] && list[j].scope).map(normScope));
      const overlap = [...a].filter(x => x && b.has(x));
      if (overlap.length > 0) {
        warnings.push({
          huntA: clampStr(list[i] && (list[i].id || list[i].huntId)),
          huntB: clampStr(list[j] && (list[j].id || list[j].huntId)),
          overlapping: overlap,
          severity: overlap.length >= 3 ? 'high' : 'medium',
        });
      }
    }
  }
  return warnings;
}

// ---- 51885: Hunt merge — combine two hunts of the same target into one ----
export function mergeHunts(huntA, huntB) {
  if (!huntA || !huntB) return { ok: false, error: 'two hunts required' };
  const findings = [...clampArr(huntA.findings), ...clampArr(huntB.findings)];
  const seen = new Set();
  const deduped = findings.filter(f => {
    const key = clampStr(f && (f.signature || f.title || f.id));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    ok: true,
    merged: {
      id: clampStr(huntA.id || huntA.huntId),
      name: clampStr(huntA.name),
      scope: [...new Set([...clampArr(huntA.scope), ...clampArr(huntB.scope)])],
      findings: deduped,
      mergedFrom: [clampStr(huntB.id || huntB.huntId)],
      mergedAt: Date.now(),
    },
    dedupedCount: findings.length - deduped.length,
  };
}

// ---- 51886: Hunt split — split one hunt's scope into two parallel hunts ----
export function splitHunt(hunt, splitSpec) {
  if (!hunt || !splitSpec) return { ok: false, error: 'hunt and split spec required' };
  const scopeA = clampArr(splitSpec.scopeA);
  const scopeB = clampArr(splitSpec.scopeB);
  if (scopeA.length === 0 || scopeB.length === 0) {
    return { ok: false, error: 'both scopes must be non-empty' };
  }
  const belongsTo = (f, scope) =>
    scope.some(
      s =>
        normScope(f && f.target).includes(normScope(s)) ||
        normScope(s).includes(normScope(f && f.target))
    );
  const findingsA = clampArr(hunt.findings).filter(f => belongsTo(f, scopeA));
  const findingsB = clampArr(hunt.findings).filter(
    f => belongsTo(f, scopeB) && !belongsTo(f, scopeA)
  );
  return {
    ok: true,
    huntA: {
      ...hunt,
      id: `${clampStr(hunt.id || hunt.huntId)}-a`,
      scope: scopeA,
      findings: findingsA,
    },
    huntB: {
      ...hunt,
      id: `${clampStr(hunt.id || hunt.huntId)}-b`,
      scope: scopeB,
      findings: findingsB,
    },
  };
}

// ---- 51887: Hunt pause presets — "pause everything except client X" in one tap ----
export function pausePreset(hunts, preset) {
  const list = clampArr(hunts);
  const exceptClient = preset && preset.exceptClient ? clampStr(preset.exceptClient) : null;
  const exceptHunt = preset && preset.exceptHunt ? clampStr(preset.exceptHunt) : null;
  return list.map(h => {
    const keep =
      (exceptClient && clampStr(h.client) === exceptClient) ||
      (exceptHunt && clampStr(h.id || h.huntId) === exceptHunt);
    return {
      huntId: clampStr(h && (h.id || h.huntId)),
      action: keep ? 'keep-running' : 'pause',
      reason: keep ? 'preset exception' : 'preset pause',
    };
  });
}

// ---- 51888: Hunt resume ordering — choose the sequence when restarting ----
export function resumeOrder(hunts, orderIds) {
  const list = clampArr(hunts);
  const byId = new Map(list.map(h => [clampStr(h && (h.id || h.huntId)), h]));
  const ordered = [];
  for (const id of clampArr(orderIds)) {
    if (byId.has(id)) {
      ordered.push(byId.get(id));
      byId.delete(id);
    }
  }
  for (const h of byId.values()) ordered.push(h);
  return ordered.map((h, idx) => ({
    huntId: clampStr(h && (h.id || h.huntId)),
    resumeSequence: idx + 1,
  }));
}

// ---- 51889: Hunt keyboard shortcuts — switch and command hunts without mouse ----
export const FLEET_SHORTCUTS = [
  { key: 'g 1..9', action: 'switch-to-hunt', label: 'Switch to hunt 1–9' },
  { key: 'g 0', action: 'switch-to-fleet', label: 'Back to fleet overview' },
  { key: 'p', action: 'pause-current', label: 'Pause current hunt' },
  { key: 'r', action: 'resume-current', label: 'Resume current hunt' },
  { key: 'a', action: 'pause-all', label: 'Pause all hunts' },
  { key: 'Shift+A', action: 'resume-all', label: 'Resume all hunts' },
  { key: 'f', action: 'focus-fleet', label: 'Focus hunt search' },
  { key: 'n', action: 'next-alert', label: 'Next attention item' },
];
export function resolveFleetShortcut(key) {
  const k = clampStr(key);
  const hit = FLEET_SHORTCUTS.find(s => s.key === k);
  const num = /^g\s+([1-9])$/.exec(k);
  if (num)
    return { action: 'switch-to-hunt', index: Number(num[1]), label: `Switch to hunt ${num[1]}` };
  return hit ? { ...hit } : { action: 'unknown', key: k, label: 'Unbound key' };
}

// ---- 51890: Hunt voice switching — resolve "switch to the API hunt" ----
export function resolveVoiceSwitch(transcript, hunts) {
  const t = clampStr(transcript).toLowerCase();
  const list = clampArr(hunts);
  const want = t
    .replace(/^switch to (the )?/, '')
    .replace(/( hunt)?$/, '')
    .trim();
  if (!want) return { ok: false, error: 'no target in transcript' };
  const hit = list.find(h => {
    const name = clampStr(h && h.name).toLowerCase();
    return name && (name.includes(want) || want.includes(name.split(' ')[0]));
  });
  return hit
    ? { ok: true, huntId: clampStr(hit.id || hit.huntId), name: clampStr(hit.name), heard: t }
    : { ok: false, error: `no hunt matches "${want}"`, heard: t };
}

// ---- 51891: Hunt mobile cards — swipeable card payload ----
export function mobileCardPayload(hunt) {
  if (!hunt) return null;
  const findings = clampArr(hunt.findings);
  const crit = findings.filter(f => /crit|high/i.test(clampStr(f && f.severity))).length;
  return {
    huntId: clampStr(hunt.id || hunt.huntId),
    name: clampStr(hunt.name),
    status: clampStr(hunt.status) || 'running',
    progress: clampNum(hunt.progress, 0),
    findings: findings.length,
    criticalHigh: crit,
    etaMs: clampNum(hunt.etaMs, 0),
    swipeActions: ['pause', 'resume', 'snapshot', 'findings'],
  };
}

// ---- 51892: Hunt widgets — home-screen widget payload ----
export function widgetPayload(scope, data) {
  const hunts = clampArr(data && data.hunts);
  const running = hunts.filter(h => clampStr(h.status) === 'running').length;
  const findings = hunts.reduce((s, h) => s + clampArr(h.findings).length, 0);
  return {
    scope: scope === 'fleet' ? 'fleet' : 'hunt',
    huntId: scope === 'fleet' ? null : clampStr(data && (data.huntId || '')),
    updatedAt: Date.now(),
    running,
    findings,
    title: scope === 'fleet' ? 'Infinity AI · Fleet' : clampStr(data && data.name),
  };
}

// ---- 51893: Hunt dark-mode parity — audit that views carry both themes ----
export function darkModeParityAudit(views) {
  return clampArr(views).map(v => {
    const tokens = clampArr(v && v.tokens);
    const hasLight = tokens.some(t => /light|day/i.test(clampStr(t)));
    const hasDark = tokens.some(t => /dark|night/i.test(clampStr(t)));
    const issues = [];
    if (!hasLight) issues.push('missing light-theme tokens');
    if (!hasDark) issues.push('missing dark-theme tokens');
    if (clampArr(v && v.hardcodedColors).length > 0) issues.push('hardcoded colors bypass theme');
    return { view: clampStr(v && v.view), parity: issues.length === 0, issues };
  });
}

// ---- 51894: Hunt onboarding tour — guided first multi-hunt run ----
export function tourSteps() {
  return [
    {
      id: 'fleet-overview',
      title: 'Fleet overview',
      body: 'Every hunt on one board — status, ETA, findings at a glance.',
    },
    {
      id: 'hunt-switcher',
      title: 'Hunt switcher',
      body: 'Jump between hunts with the switcher bar or press g then a number.',
    },
    {
      id: 'command-center',
      title: 'Command center',
      body: 'Pause, resume, steer, or approve — fleet-wide commands live here.',
    },
    {
      id: 'cross-hunt-feed',
      title: 'Cross-hunt feed',
      body: 'Findings from all hunts flow into one deduplicated feed.',
    },
    {
      id: 'health-scores',
      title: 'Health scores',
      body: 'Stalled or ailing hunts raise alerts before you notice them.',
    },
  ];
}

// ---- 51895: Fleet retrospective — post-campaign review across all hunts ----
export function fleetRetrospective(hunts) {
  const list = clampArr(hunts);
  const findings = list.flatMap(h => clampArr(h && h.findings));
  const bySeverity = {};
  for (const f of findings) {
    const sev = clampStr(f && f.severity).toLowerCase() || 'unknown';
    bySeverity[sev] = (bySeverity[sev] || 0) + 1;
  }
  const durations = list.map(h => clampNum(h && h.durationMs, 0)).filter(Boolean);
  const avgDurationMs = durations.length
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;
  return {
    hunts: list.length,
    totalFindings: findings.length,
    bySeverity,
    avgDurationMs: Math.round(avgDurationMs),
    cost: costRollup(list),
    topHunts: list
      .map(h => ({
        huntId: clampStr(h && (h.id || h.huntId)),
        name: clampStr(h && h.name),
        findings: clampArr(h && h.findings).length,
      }))
      .sort((a, b) => b.findings - a.findings)
      .slice(0, 5),
  };
}
