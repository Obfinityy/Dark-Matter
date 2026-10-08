/**
 * snapshotCore.js — wave 41 (ideas 51621–51640): mid-hunt snapshot engine
 * for Infinity AI.
 *
 * Pure logic for capturing and sharing hunt state mid-run: one-click and
 * scheduled snapshots, diffing, timelines, sharing links, PDF export
 * descriptors, annotations, watermarking, deltas, executive and technical
 * summary modes, subscriptions, approval, retention, search, branded
 * templates, language variants, live previews, completeness metering, and
 * finding-state tracking.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic: no Date.now(), no Math.random(); time is
 * always passed in as an argument.
 */

export const WAVE41_SN_START = 51621;
export const WAVE41_SN_END = 51640;

/** Registry of the 20 mid-hunt snapshot ideas — completeness is testable. */
export const WAVE41_SN_IDEAS = [
  [51621, 'one-click snapshot', 'Capture a full report draft at any moment mid-hunt'],
  [51622, 'scheduled snapshots', 'Auto-generate snapshots at intervals you configure'],
  [
    51623,
    'snapshot comparison (mid-hunt)',
    'Diff any two snapshots to see how the hunt progressed',
  ],
  [51624, 'snapshot timeline', 'All snapshots arranged on a scrubbable timeline'],
  [
    51625,
    'snapshot sharing',
    'Send a snapshot link to stakeholders without exposing live controls',
  ],
  [51626, 'snapshot PDF export', 'Download any snapshot as a polished PDF instantly'],
  [
    51627,
    'snapshot annotations (mid-hunt)',
    'Add your notes on top of a snapshot for stakeholders',
  ],
  [51628, 'snapshot watermarking', 'Snapshots stamped with draft status and generation time'],
  [51629, 'snapshot deltas', "Each snapshot highlights what's new since the previous one"],
  [51630, 'executive snapshot mode', 'A one-page business summary generated mid-hunt'],
  [51631, 'technical snapshot mode', 'Full evidence detail for engineering audiences'],
  [51632, 'snapshot subscriptions', "Stakeholders auto-receive new snapshots as they're taken"],
  [51633, 'snapshot approval', "Mark a snapshot as reviewed before it's shared externally"],
  [51634, 'snapshot retention', 'Old snapshots auto-archived per your policy'],
  [51635, 'snapshot search', 'Find any snapshot by date, finding, or note'],
  [51636, 'snapshot templates', 'Your branded layout applied to every snapshot'],
  [51637, 'snapshot language options', 'Generate snapshots in any supported language'],
  [51638, 'live snapshot preview', 'See the draft report updating in real time as findings land'],
  [51639, 'snapshot completeness meter', 'How close the snapshot is to a final-report standard'],
  [
    51640,
    'snapshot finding states',
    'Findings marked draft, validating, or confirmed within snapshots',
  ],
];

/** Sanctioned finding states inside a snapshot (idea 51640). */
export const FINDING_STATES = ['draft', 'validating', 'confirmed'];

/* --- shared helpers ---------------------------------------------------------- */

/** FNV-1a 32-bit hash, used for deterministic snapshot IDs and share tokens. */
function fnv1a(str) {
  let h = 0x811c9dc5;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function clamp(n, lo, hi) {
  const v = Number(n);
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

export function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* --- 51621 one-click snapshot ------------------------------------------------------ */

export function snapshotId(huntId, takenAtMs) {
  return (
    'SNP-' +
    fnv1a(String(huntId) + '|' + String(takenAtMs))
      .toString(16)
      .padStart(8, '0')
  );
}

export function takeSnapshot(hunt, takenAtMs) {
  const h = hunt || {};
  const findings = Array.isArray(h.findings) ? h.findings : [];
  const bySeverity = {};
  for (const f of findings) {
    const sev = String(f.severity || 'info').toLowerCase();
    bySeverity[sev] = (bySeverity[sev] || 0) + 1;
  }
  return {
    id: snapshotId(h.id || 'hunt', takenAtMs),
    huntId: String(h.id || ''),
    target: String(h.target || ''),
    takenAtMs: Number(takenAtMs) || 0,
    findings: findings.map(f => ({ ...f })),
    findingCount: findings.length,
    bySeverity,
    phase: String(h.phase || 'in-progress'),
    approved: false,
    approvedBy: null,
    approvedAtMs: null,
    annotations: [],
    stateOverrides: {},
    watermark: null,
    language: 'en',
    template: 'standard',
  };
}

/* --- 51622 scheduled snapshots --------------------------------------------------------- */

export function scheduleSnapshot(schedules, config) {
  const list = Array.isArray(schedules) ? schedules : [];
  const cfg = config || {};
  const intervalMs = Math.max(60000, Number(cfg.intervalMs) || 15 * 60000);
  const fromMs = Number(cfg.fromMs) || 0;
  const rule = {
    id: 'SCH-' + fnv1a(String(cfg.label || '') + '|' + String(intervalMs)).toString(16),
    label: String(cfg.label || 'recurring snapshot'),
    intervalMs,
    fromMs,
    nextAtMs: fromMs + intervalMs,
    enabled: cfg.enabled !== false,
    createdBy: String(cfg.createdBy || 'owner'),
  };
  return list.concat([rule]);
}

export function dueScheduledSnapshots(schedules, nowMs) {
  const list = Array.isArray(schedules) ? schedules : [];
  return list.filter(r => r.enabled && r.nextAtMs <= (Number(nowMs) || 0));
}

export function advanceSchedule(rule, takenAtMs) {
  const r = { ...(rule || {}) };
  r.nextAtMs = (Number(takenAtMs) || 0) + (Number(r.intervalMs) || 15 * 60000);
  r.lastTakenAtMs = Number(takenAtMs) || 0;
  return r;
}

/* --- 51623 snapshot comparison (mid-hunt) ---------------------------------------------------- */

export function diffSnapshots(a, b) {
  const sa = a || { findings: [] };
  const sb = b || { findings: [] };
  const idsA = new Set(sa.findings.map(f => f.id));
  const idsB = new Set(sb.findings.map(f => f.id));
  const mapA = new Map(sa.findings.map(f => [f.id, f]));
  const added = sb.findings.filter(f => !idsA.has(f.id));
  const removed = sa.findings.filter(f => !idsB.has(f.id));
  const changed = sb.findings.filter(f => {
    if (!idsA.has(f.id)) return false;
    const prev = mapA.get(f.id);
    return (
      prev.severity !== f.severity || prev.confidence !== f.confidence || prev.title !== f.title
    );
  });
  return {
    fromId: sa.id || null,
    toId: sb.id || null,
    addedCount: added.length,
    removedCount: removed.length,
    changedCount: changed.length,
    addedIds: added.map(f => f.id),
    removedIds: removed.map(f => f.id),
    changedIds: changed.map(f => f.id),
  };
}

/* --- 51624 snapshot timeline ------------------------------------------------------------------------ */

export function snapshotTimeline(snapshots) {
  const list = (Array.isArray(snapshots) ? snapshots : [])
    .slice()
    .sort((x, y) => (x.takenAtMs || 0) - (y.takenAtMs || 0));
  return list.map((s, i) => ({
    id: s.id,
    takenAtMs: s.takenAtMs,
    findingCount: s.findingCount || 0,
    index: i,
    gapSincePrevMs: i === 0 ? 0 : (s.takenAtMs || 0) - (list[i - 1].takenAtMs || 0),
    approved: !!s.approved,
  }));
}

/* --- 51625 snapshot sharing ------------------------------------------------------------------------------ */

export function shareSnapshotLink(snapshot, audience) {
  const s = snapshot || {};
  const token = fnv1a(String(s.id) + '|' + String(audience))
    .toString(16)
    .padStart(8, '0');
  return {
    snapshotId: s.id || null,
    audience: String(audience || 'stakeholder'),
    token,
    url: 'https://infinity-ai.app/s/' + token,
    liveControlsExposed: false,
    expiresInDays: 14,
  };
}

/* --- 51626 snapshot PDF export ------------------------------------------------------------------------------------ */

export function pdfExportDescriptor(snapshot) {
  const s = snapshot || {};
  const findings = Array.isArray(s.findings) ? s.findings : [];
  const sections = ['cover', 'executive-summary', 'findings', 'evidence-appendix'];
  const pages = 2 + findings.length;
  return {
    snapshotId: s.id || null,
    filename: (s.id || 'snapshot') + '-report.pdf',
    pages,
    sections,
    watermarkApplied: !!s.watermark,
    language: s.language || 'en',
  };
}

/* --- 51627 snapshot annotations (mid-hunt) ------------------------------------------------------------------------------- */

export function annotateSnapshot(snapshot, note, author, atMs) {
  const s = { ...(snapshot || {}) };
  const annotations = Array.isArray(s.annotations) ? s.annotations : [];
  return {
    ...s,
    annotations: annotations.concat([
      {
        id: 'ANN-' + fnv1a(String(note) + '|' + String(atMs)).toString(16),
        note: String(note || ''),
        author: String(author || 'owner'),
        atMs: Number(atMs) || 0,
      },
    ]),
  };
}

/* --- 51628 snapshot watermarking ------------------------------------------------------------------------------------------------ */

export function snapshotWatermark(text, style) {
  const s = style || {};
  return {
    text: String(text || 'DRAFT'),
    style: {
      fontSizePx: clamp(s.fontSizePx, 24, 96) || 48,
      opacity: clamp(s.opacity, 0.05, 0.4) || 0.12,
      rotationDeg: Number(s.rotationDeg) || -30,
      color: String(s.color || '#ffffff'),
    },
    appliedAtMs: null,
  };
}

export function applySnapshotWatermark(snapshot, watermark, atMs) {
  const s = { ...(snapshot || {}) };
  return {
    ...s,
    watermark: { ...(watermark || snapshotWatermark()), appliedAtMs: Number(atMs) || 0 },
  };
}

/* --- 51629 snapshot deltas ----------------------------------------------------------------------------------------------------------- */

export function snapshotDeltas(snapshot, previousSnapshot) {
  const diff = diffSnapshots(previousSnapshot || { findings: [] }, snapshot || { findings: [] });
  const current = snapshot || {};
  const byId = new Map((current.findings || []).map(f => [f.id, f]));
  const highlights = diff.addedIds
    .map(id => {
      const f = byId.get(id) || {};
      return { id, kind: 'new-finding', title: f.title || id, severity: f.severity || 'info' };
    })
    .concat(
      diff.changedIds.map(id => {
        const f = byId.get(id) || {};
        return {
          id,
          kind: 'updated-finding',
          title: f.title || id,
          severity: f.severity || 'info',
        };
      })
    );
  return {
    snapshotId: current.id || null,
    previousId: (previousSnapshot || {}).id || null,
    ...diff,
    highlights,
    headline: diff.addedCount + ' new, ' + diff.changedCount + ' updated since previous snapshot',
  };
}

/* --- 51630 executive snapshot mode -------------------------------------------------------------------------------------------------------- */

export function executiveSummary(snapshot) {
  const s = snapshot || {};
  const findings = Array.isArray(s.findings) ? s.findings : [];
  const criticals = findings.filter(f =>
    ['critical', 'high'].includes(String(f.severity || '').toLowerCase())
  );
  const topRisks = criticals
    .slice(0, 5)
    .map(f => ({ id: f.id, title: f.title, severity: f.severity }));
  return {
    snapshotId: s.id || null,
    mode: 'executive',
    pages: 1,
    headline: criticals.length + ' high-impact issues found on ' + (s.target || 'target'),
    topRisks,
    businessImpact: criticals.length
      ? 'Immediate review recommended: ' +
        criticals.length +
        ' findings carry business-critical exposure.'
      : 'No business-critical exposure detected so far.',
    nextSteps: criticals.length
      ? ['Triage the top risks', 'Schedule remediation']
      : ['Continue monitoring'],
  };
}

/* --- 51631 technical snapshot mode ------------------------------------------------------------------------------------------------------------- */

export function technicalSummary(snapshot) {
  const s = snapshot || {};
  const findings = Array.isArray(s.findings) ? s.findings : [];
  return {
    snapshotId: s.id || null,
    mode: 'technical',
    findings: findings.map(f => ({
      id: f.id,
      title: f.title,
      type: f.type || 'unknown',
      severity: f.severity || 'info',
      confidence: f.confidence != null ? f.confidence : null,
      evidence: f.evidence || f.details || 'pending',
      asset: f.asset || s.target || '',
      state: (s.stateOverrides || {})[f.id] || 'draft',
    })),
    techniqueNotes: findings.length
      ? 'Evidence captured per finding; states reflect validation progress.'
      : 'No findings captured yet.',
  };
}

/* --- 51632 snapshot subscriptions ----------------------------------------------------------------------------------------------------------------------- */

export function subscribeSnapshot(subs, contact) {
  const list = Array.isArray(subs) ? subs : [];
  const c = contact || {};
  const id = 'SUB-' + fnv1a(String(c.email || '') + '|' + String(c.role || '')).toString(16);
  if (list.some(s => s.id === id)) return list;
  return list.concat([
    {
      id,
      email: String(c.email || ''),
      role: String(c.role || 'stakeholder'),
      active: true,
    },
  ]);
}

export function notifySnapshotSubscribers(subs, snapshot) {
  const list = (Array.isArray(subs) ? subs : []).filter(s => s.active);
  return list.map(s => ({
    subscriberId: s.id,
    email: s.email,
    snapshotId: (snapshot || {}).id || null,
    channel: 'email',
    queued: true,
  }));
}

/* --- 51633 snapshot approval ----------------------------------------------------------------------------------------------------------------------------------- */

export function approveSnapshot(snapshot, approver, atMs) {
  const s = { ...(snapshot || {}) };
  return {
    ...s,
    approved: true,
    approvedBy: String(approver || 'owner'),
    approvedAtMs: Number(atMs) || 0,
  };
}

export function shareableExternally(snapshot) {
  const s = snapshot || {};
  return !!s.approved;
}

/* --- 51634 snapshot retention ----------------------------------------------------------------------------------------------------------------------------------------- */

export function applySnapshotRetention(snapshots, policy, nowMs) {
  const list = Array.isArray(snapshots) ? snapshots : [];
  const p = policy || {};
  const retainDays = Math.max(1, Number(p.retainDays) || 30);
  const cutoffMs = (Number(nowMs) || 0) - retainDays * 86400000;
  const archived = [];
  const kept = [];
  for (const s of list) {
    if ((s.takenAtMs || 0) < cutoffMs) archived.push({ ...s, archived: true });
    else kept.push(s);
  }
  return { kept, archived, retainDays };
}

/* --- 51635 snapshot search ------------------------------------------------------------------------------------------------------------------------------------------------- */

export function searchSnapshots(snapshots, query) {
  const list = Array.isArray(snapshots) ? snapshots : [];
  const needle = String(query || '')
    .trim()
    .toLowerCase();
  if (!needle) return [];
  return list.filter(s => {
    const notes = (s.annotations || []).map(a => a.note).join(' ');
    const titles = (s.findings || []).map(f => f.title).join(' ');
    const hay = (
      (s.id || '') +
      ' ' +
      (s.target || '') +
      ' ' +
      titles +
      ' ' +
      notes +
      ' ' +
      new Date(s.takenAtMs || 0).toISOString().slice(0, 10)
    ).toLowerCase();
    return hay.includes(needle);
  });
}

/* --- 51636 snapshot templates ------------------------------------------------------------------------------------------------------------------------------------------------------- */

export const SNAPSHOT_TEMPLATES = {
  standard: {
    header: 'Infinity AI · Hunt Snapshot',
    accent: '#7c6cff',
    footer: 'Generated by Infinity AI',
  },
  executive: {
    header: 'Executive Security Brief',
    accent: '#0ea5e9',
    footer: 'Confidential — Infinity AI',
  },
  branded: {
    header: 'Infinity AI · {org}',
    accent: '#10b981',
    footer: 'Infinity AI security report',
  },
};

export function applySnapshotTemplate(templateKey, fields) {
  const t = SNAPSHOT_TEMPLATES[String(templateKey)] || SNAPSHOT_TEMPLATES.standard;
  const f = fields || {};
  return {
    template: String(templateKey || 'standard'),
    header: t.header.replace('{org}', String(f.org || 'your team')),
    accent: t.accent,
    footer: t.footer,
    layout: 'single-column',
  };
}

/* --- 51637 snapshot language options ------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function snapshotLanguageLabels() {
  return {
    en: {
      snapshot: 'Snapshot',
      findings: 'Findings',
      executiveSummary: 'Executive summary',
      generatedAt: 'Generated at',
    },
    hi: {
      snapshot: 'स्नैपशॉट',
      findings: 'निष्कर्ष',
      executiveSummary: 'कार्यकारी सारांश',
      generatedAt: 'निर्माण समय',
    },
    es: {
      snapshot: 'Instantánea',
      findings: 'Hallazgos',
      executiveSummary: 'Resumen ejecutivo',
      generatedAt: 'Generado el',
    },
  };
}

export function labelForLanguage(dict, lang, key) {
  const table = (dict || {})[lang] || (dict || {}).en || {};
  return table[key] || key;
}

/* --- 51638 live snapshot preview ------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function livePreviewDescriptor(snapshot) {
  const s = snapshot || {};
  return {
    snapshotId: s.id || null,
    live: true,
    findingCount: s.findingCount || 0,
    completeness: null,
    renderedAtMs: null,
    note: 'Preview updates as new findings land; nothing is persisted until you save.',
  };
}

/* --- 51639 snapshot completeness meter ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function snapshotCompleteness(snapshot) {
  const s = snapshot || {};
  const findings = Array.isArray(s.findings) ? s.findings : [];
  const checks = [
    { key: 'has-target', label: 'Target recorded', met: !!s.target },
    { key: 'has-findings', label: 'Findings captured', met: findings.length > 0 },
    {
      key: 'evidence-complete',
      label: 'All findings carry evidence',
      met: findings.length > 0 && findings.every(f => f.evidence || f.details),
    },
    {
      key: 'states-set',
      label: 'Finding states assigned',
      met: findings.length > 0 && findings.every(f => (s.stateOverrides || {})[f.id] || f.state),
    },
    { key: 'reviewed', label: 'Snapshot reviewed', met: !!s.approved },
  ];
  const met = checks.filter(c => c.met).length;
  const pct = Math.round((met / checks.length) * 100);
  return {
    pct,
    met,
    total: checks.length,
    missing: checks.filter(c => !c.met).map(c => c.label),
    checks,
  };
}

/* --- 51640 snapshot finding states --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function markFindingState(snapshot, findingId, state) {
  const s = { ...(snapshot || {}) };
  if (!FINDING_STATES.includes(state)) return { ...s, invalid: true };
  return {
    ...s,
    stateOverrides: { ...(s.stateOverrides || {}), [String(findingId)]: state },
    invalid: false,
  };
}

export function findingsByState(snapshot) {
  const s = snapshot || {};
  const byState = { draft: [], validating: [], confirmed: [] };
  for (const f of s.findings || []) {
    const st = (s.stateOverrides || {})[f.id] || f.state || 'draft';
    (byState[st] || byState.draft).push(f.id);
  }
  return byState;
}
