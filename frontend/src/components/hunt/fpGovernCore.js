/**
 * fpGovernCore.js — Infinity AI · Dark-Matter · Wave 53
 * Pure logic (no React, no DOM, no network) backing false-positive
 * governance: idea-bank ideas 52101–52120. Every exported function is pure
 * and deterministic; time is injected via `now` parameters (defaults to
 * Date.now()).
 */

export const WAVE53_FP_GOVERN_IDEAS = [
  { id: 52101, title: '"Same as previous FP" one-click' },
  { id: 52102, title: 'FP review queue' },
  { id: 52103, title: 'FP bulk import' },
  { id: 52104, title: 'FP custom reason fields' },
  { id: 52105, title: 'FP notification to hunt owner' },
  { id: 52106, title: 'FP changelog per finding' },
  { id: 52107, title: 'Screenshot attach on FP justification' },
  { id: 52108, title: '"Likely FP — needs human check" state' },
  { id: 52109, title: 'FP training-data export' },
  { id: 52110, title: 'FP stats on team dashboard' },
  { id: 52111, title: 'FP reason analytics by reviewer' },
  { id: 52112, title: 'FP review calibration sessions' },
  { id: 52113, title: 'FP impact on agent scoring' },
  { id: 52114, title: 'FP pattern clustering' },
  { id: 52115, title: 'FP audit export for compliance' },
  { id: 52116, title: 'FP by detection engine' },
  { id: 52117, title: 'FP comment threads' },
  { id: 52118, title: '"Not a vuln but hardening note" middle state' },
  { id: 52119, title: 'FP severity-downgrade alternative' },
  { id: 52120, title: 'FP notification digest controls' },
];

// 52101 — "Same as previous FP" one-click: apply a previous dismissal's
// reason to a matching finding in one step.
export function sameAsPreviousFp(finding, previousMarking, markedBy, now = Date.now()) {
  const prev = previousMarking || {};
  if (!prev.reasonId) return { ok: false, reason: 'previous marking has no reason to copy' };
  const sameSig = String((finding || {}).signature || '') === String(prev.signature || '');
  return {
    ok: true,
    findingId: (finding || {}).findingId,
    signature: String(prev.signature || ''),
    reasonId: prev.reasonId,
    reasonLabel: prev.reasonLabel || prev.reasonId,
    justification: prev.justification || '',
    markedBy: String(markedBy || 'unknown'),
    markedAt: Number(now),
    copiedFrom: prev.findingId,
    signatureMatch: sameSig,
  };
}

// 52102 — FP review queue: dedicated queue of pending FP decisions for leads.
export function buildFpReviewQueue(markings) {
  const pending = (markings || []).filter(m =>
    ['pending-second-review', 'disputed', 'likely-fp'].includes(String(m.status || ''))
  );
  const rank = { disputed: 0, 'pending-second-review': 1, 'likely-fp': 2 };
  const sevRank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return pending
    .map(m => ({
      findingId: m.findingId,
      title: m.title,
      status: m.status,
      severity: m.severity,
      markedBy: m.markedBy,
      markedAt: m.markedAt,
    }))
    .sort(
      (a, b) =>
        rank[String(a.status)] - rank[String(b.status)] ||
        (sevRank[String(a.severity || '').toLowerCase()] ?? 9) -
          (sevRank[String(b.severity || '').toLowerCase()] ?? 9) ||
        Number(a.markedAt || 0) - Number(b.markedAt || 0)
    );
}

// 52103 — FP bulk import: import decisions from external reviews with reason
// mapping. Row shape: { findingId, externalReason, justification, markedBy }.
export function importFpDecisions(rows, reasonMap) {
  const map = reasonMap || {};
  const imported = [];
  const rejected = [];
  for (const row of rows || []) {
    const r = row || {};
    if (!r.findingId) {
      rejected.push({ row: r, reason: 'missing findingId' });
      continue;
    }
    const mapped = map[String(r.externalReason || '')];
    if (!mapped) {
      rejected.push({ row: r, reason: `unmapped external reason "${r.externalReason}"` });
      continue;
    }
    imported.push({
      findingId: r.findingId,
      reasonId: mapped,
      justification: String(r.justification || ''),
      markedBy: String(r.markedBy || 'bulk-import'),
      status: 'false-positive',
      imported: true,
    });
  }
  return { imported, rejected, importedCount: imported.length, rejectedCount: rejected.length };
}

// 52104 — FP custom reason fields: admins extend the reason taxonomy.
export function extendReasonTaxonomy(baseReasons, customReasons) {
  const base = Array.isArray(baseReasons) ? baseReasons : [];
  const ids = new Set(base.map(r => String(r.id)));
  const added = [];
  const rejected = [];
  for (const c of customReasons || []) {
    const id = String((c || {}).id || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-');
    const label = String((c || {}).label || '').trim();
    if (!id || !label) {
      rejected.push({ ...c, reason: 'id and label required' });
      continue;
    }
    if (ids.has(id)) {
      rejected.push({ ...c, reason: `id "${id}" already exists` });
      continue;
    }
    ids.add(id);
    added.push({ id, label, custom: true });
  }
  return { taxonomy: [...base, ...added], added, rejected };
}

// 52105 — FP notification to hunt owner: alert the requester with the reason.
export function notifyHuntOwnerPayload(decision, owner) {
  const d = decision || {};
  const o = owner || {};
  return {
    channel: 'in-app',
    to: String(o.userId || o.email || 'hunt-owner'),
    title: `Finding dismissed as false positive — ${d.findingId || 'unknown'}`,
    body: `Marked by ${d.markedBy || 'unknown'}. Reason: ${d.reasonLabel || d.reasonId || 'unspecified'}.`,
    findingId: d.findingId,
    reasonId: d.reasonId,
    cta: 'review-dismissal',
    urgent: ['critical', 'high'].includes(String(d.severity || '').toLowerCase()),
  };
}

// 52106 — FP changelog per finding: every mark/unmark/reason-edit/dispute in
// the finding's history.
export const FP_CHANGELOG_EVENTS = [
  'marked-fp',
  'unmarked-fp',
  'reason-edited',
  'dispute-opened',
  'dispute-resolved',
  'downgraded',
];
export function logFpChange(history, eventType, actor, details, now = Date.now()) {
  if (!FP_CHANGELOG_EVENTS.includes(String(eventType))) {
    return { history: history || [], ok: false, reason: `unknown event type "${eventType}"` };
  }
  const entry = {
    event: String(eventType),
    actor: String(actor || 'unknown'),
    at: Number(now),
    details: details || {},
  };
  return { history: [...(history || []), entry], ok: true, entry };
}
export function fpChangelogSummary(history) {
  const h = history || [];
  const counts = {};
  for (const e of h) counts[String(e.event)] = (counts[String(e.event)] || 0) + 1;
  return {
    total: h.length,
    counts,
    firstAt: h.length ? h[0].at : null,
    lastAt: h.length ? h[h.length - 1].at : null,
  };
}

// 52107 — Screenshot attach on FP justification: proof attached to dismissal.
const SCREENSHOT_MIME = ['image/png', 'image/jpeg', 'image/webp'];
export function attachScreenshot(marking, file) {
  const m = marking || {};
  const f = file || {};
  if (!SCREENSHOT_MIME.includes(String(f.mimeType || ''))) {
    return { ...m, ok: false, reason: `unsupported type "${f.mimeType}" — use PNG/JPEG/WebP` };
  }
  if (Number(f.sizeBytes || 0) > 5 * 1024 * 1024) {
    return { ...m, ok: false, reason: 'screenshot over 5 MB' };
  }
  const shots = [
    ...(m.screenshots || []),
    {
      name: String(f.name || 'screenshot'),
      mimeType: f.mimeType,
      sizeBytes: Number(f.sizeBytes || 0),
      caption: String(f.caption || ''),
      attachedAt: f.attachedAt != null ? Number(f.attachedAt) : Date.now(),
    },
  ];
  return { ...m, ok: true, screenshots: shots };
}

// 52108 — "Likely FP — needs human check" state: agent-suspected FPs stay
// visible until a human confirms or clears them.
export function markLikelyFp(finding, probability, now = Date.now()) {
  const f = finding || {};
  return {
    ...f,
    ok: true,
    status: 'likely-fp',
    likelyFp: {
      probability: Number(probability),
      markedAt: Number(now),
      confirmedBy: null,
      confirmedAt: null,
    },
  };
}
export function confirmLikelyFp(marking, confirmedBy, isFp, justification, now = Date.now()) {
  const m = marking || {};
  if (String(m.status || '') !== 'likely-fp')
    return { ...m, ok: false, reason: 'not in likely-fp state' };
  const base = { ...m };
  delete base.ok;
  return {
    ...base,
    ok: true,
    status: isFp ? 'false-positive' : 'open',
    likelyFp: {
      ...(m.likelyFp || {}),
      confirmedBy: String(confirmedBy || 'unknown'),
      confirmedAt: Number(now),
      justification: String(justification || ''),
    },
  };
}

// 52109 — FP training-data export: labeled FP/TP pairs in ML-ready format.
export function exportTrainingData(labeledFindings) {
  const rows = [];
  const skipped = [];
  for (const f of labeledFindings || []) {
    const g = f || {};
    if (g.isFalsePositive !== true && g.isFalsePositive !== false) {
      skipped.push({ findingId: g.findingId, reason: 'no label' });
      continue;
    }
    rows.push({
      finding_id: String(g.findingId || ''),
      signature: String(g.signature || g.vulnClass || ''),
      severity: String(g.severity || ''),
      endpoint: String(g.endpoint || ''),
      has_evidence: Array.isArray(g.evidence) && g.evidence.length > 0,
      label: g.isFalsePositive ? 'FP' : 'TP',
      reason_id: String(g.reasonId || ''),
    });
  }
  return {
    format: 'jsonl',
    rows,
    skipped,
    fpCount: rows.filter(r => r.label === 'FP').length,
    tpCount: rows.filter(r => r.label === 'TP').length,
  };
}

// 52110 — FP stats on team dashboard: this week's count, top reasons,
// dismissals pending second review.
export function dashboardFpStats(decisions, now = Date.now()) {
  const weekAgo = Number(now) - 7 * 86400e3;
  const week = (decisions || []).filter(d => Number(d.markedAt || 0) >= weekAgo);
  const byReason = {};
  for (const d of week) {
    const r = String(d.reasonId || 'unspecified');
    byReason[r] = (byReason[r] || 0) + 1;
  }
  const topReasons = Object.entries(byReason)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reasonId, count]) => ({ reasonId, count }));
  const pendingSecondReview = (decisions || []).filter(
    d => String(d.status || '') === 'pending-second-review'
  ).length;
  return { weekCount: week.length, topReasons, pendingSecondReview, generatedAt: Number(now) };
}

// 52111 — FP reason analytics by reviewer: dismissals and overturn rate.
export function reviewerFpAnalytics(decisions) {
  const byReviewer = {};
  for (const d of decisions || []) {
    const who = String(d.markedBy || 'unknown');
    if (!byReviewer[who])
      byReviewer[who] = { reviewer: who, dismissals: 0, overturned: 0, upheld: 0 };
    byReviewer[who].dismissals += 1;
    const res = String((d.dispute || {}).resolution || '');
    if (res === 'overturned') byReviewer[who].overturned += 1;
    if (res === 'upheld') byReviewer[who].upheld += 1;
  }
  return Object.values(byReviewer)
    .map(r => ({
      ...r,
      overturnRate: r.dismissals ? Math.round((r.overturned / r.dismissals) * 1000) / 1000 : 0,
      upheldRate: r.dismissals ? Math.round((r.upheld / r.dismissals) * 1000) / 1000 : 0,
    }))
    .sort((a, b) => b.dismissals - a.dismissals);
}

// 52112 — FP review calibration sessions: joint-review sample workflow.
export function planCalibrationSession(decisions, sampleSize = 10, now = Date.now()) {
  const pool = (decisions || []).filter(
    d => d.isFalsePositive === true || String(d.status || '') === 'false-positive'
  );
  const sorted = [...pool].sort((a, b) =>
    String(a.findingId || '').localeCompare(String(b.findingId || ''))
  );
  const sample = sorted.slice(0, Math.max(1, Number(sampleSize)));
  return {
    sessionId: `cal-${Number(now)}`,
    scheduledAt: Number(now),
    sampleSize: sample.length,
    items: sample.map(d => ({
      findingId: d.findingId,
      title: d.title,
      reasonId: d.reasonId,
      markedBy: d.markedBy,
      verdicts: [],
    })),
    status: 'planned',
  };
}
export function recordCalibrationVerdict(session, findingId, reviewer, agree, note) {
  const s = session || {};
  const items = (s.items || []).map(it =>
    String(it.findingId) === String(findingId)
      ? {
          ...it,
          verdicts: [
            ...(it.verdicts || []),
            {
              reviewer: String(reviewer || 'unknown'),
              agree: Boolean(agree),
              note: String(note || ''),
            },
          ],
        }
      : it
  );
  const voted = items.filter(it => (it.verdicts || []).length > 0);
  return { ...s, items, status: voted.length === items.length ? 'complete' : 'in-progress' };
}
export function calibrationAgreement(session) {
  const items = (session || {}).items || [];
  let agree = 0;
  let total = 0;
  for (const it of items) {
    for (const v of it.verdicts || []) {
      total += 1;
      if (v.agree) agree += 1;
    }
  }
  return {
    votes: total,
    agree,
    agreementRate: total ? Math.round((agree / total) * 1000) / 1000 : 0,
  };
}

// 52113 — FP impact on agent scoring: FP rates feed the per-engine scorecard.
export function agentFpScorecard(decisions, engines) {
  const eng = engines || {};
  return Object.entries(eng)
    .map(([engineId, meta]) => {
      const produced = (decisions || []).filter(d => String(d.engine || '') === engineId);
      const fps = produced.filter(
        d => d.isFalsePositive === true || String(d.status || '') === 'false-positive'
      );
      const overturned = fps.filter(
        d => String((d.dispute || {}).resolution || '') === 'overturned'
      );
      const fpRate = produced.length ? Math.round((fps.length / produced.length) * 1000) / 1000 : 0;
      return {
        engineId,
        model: (meta || {}).model || 'unknown',
        version: (meta || {}).version || 'unknown',
        findings: produced.length,
        falsePositives: fps.length,
        fpRate,
        overturned: overturned.length,
        qualityScore: Math.round((1 - fpRate) * 1000) / 1000,
      };
    })
    .sort((a, b) => b.qualityScore - a.qualityScore);
}

// 52114 — FP pattern clustering: group similar dismissals by signature
// similarity (Jaccard over token sets of signature + endpoint + reason).
export function signatureTokens(rec) {
  const r = rec || {};
  return new Set(
    String(`${r.signature || ''} ${r.endpoint || ''} ${r.reasonId || ''}`)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(t => t.length > 2)
  );
}
export function jaccardSimilarity(a, b) {
  const A = a instanceof Set ? a : new Set(a);
  const B = b instanceof Set ? b : new Set(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  return union ? Math.round((inter / union) * 1000) / 1000 : 0;
}
export function clusterFpPatterns(fpRecords, threshold = 0.4) {
  const recs = fpRecords || [];
  const clusters = [];
  for (const r of recs) {
    const toks = signatureTokens(r);
    let placed = false;
    for (const c of clusters) {
      if (jaccardSimilarity(toks, c.centroid) >= threshold) {
        c.members.push(r);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ id: clusters.length + 1, centroid: toks, members: [r] });
  }
  return clusters
    .map(c => ({
      clusterId: c.id,
      size: c.members.length,
      members: c.members.map(m => ({
        findingId: m.findingId,
        signature: m.signature,
        endpoint: m.endpoint,
        reasonId: m.reasonId,
      })),
      topReason: mostCommon(c.members.map(m => String(m.reasonId || 'unspecified'))),
      representativeSignature: mostCommon(c.members.map(m => String(m.signature || 'unknown'))),
    }))
    .sort((a, b) => b.size - a.size);
}
function mostCommon(values) {
  const counts = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : null;
}

// 52115 — FP audit export for compliance: who/when/why rows.
export function buildFpAuditExport(decisions, exportedBy, now = Date.now()) {
  const rows = (decisions || []).map(d => ({
    finding_id: String(d.findingId || ''),
    decision: 'false-positive',
    reason_id: String(d.reasonId || 'unspecified'),
    justification: String(d.justification || ''),
    marked_by: String(d.markedBy || 'unknown'),
    marked_at: d.markedAt != null ? Number(d.markedAt) : null,
    dispute: d.dispute
      ? { by: d.dispute.challengedBy, resolution: d.dispute.resolution || 'open' }
      : null,
    screenshots: Array.isArray(d.screenshots) ? d.screenshots.length : 0,
  }));
  return {
    generatedBy: String(exportedBy || 'unknown'),
    generatedAt: Number(now),
    rowCount: rows.length,
    columns: [
      'finding_id',
      'decision',
      'reason_id',
      'justification',
      'marked_by',
      'marked_at',
      'dispute',
      'screenshots',
    ],
    rows,
  };
}

// 52116 — FP by detection engine: filter analytics by producing engine.
export function filterFpByEngine(decisions, engineId) {
  return (decisions || []).filter(d => String(d.engine || '') === String(engineId));
}
export function fpRatesByEngine(decisions) {
  const byEngine = {};
  for (const d of decisions || []) {
    const e = String(d.engine || 'unknown');
    if (!byEngine[e]) byEngine[e] = { engine: e, findings: 0, fps: 0 };
    byEngine[e].findings += 1;
    if (d.isFalsePositive === true || String(d.status || '') === 'false-positive')
      byEngine[e].fps += 1;
  }
  return Object.values(byEngine)
    .map(r => ({ ...r, fpRate: r.findings ? Math.round((r.fps / r.findings) * 1000) / 1000 : 0 }))
    .sort((a, b) => b.fpRate - a.fpRate);
}

// 52117 — FP comment threads: discuss a dismissal before it becomes final.
export function newFpThread(findingId, openedBy, now = Date.now()) {
  return {
    findingId: String(findingId),
    openedBy: String(openedBy || 'unknown'),
    openedAt: Number(now),
    status: 'open',
    comments: [],
  };
}
export function addFpComment(thread, author, text, now = Date.now()) {
  const t = thread || {};
  if (String(t.status || '') !== 'open') return { ...t, ok: false, reason: 'thread is closed' };
  if (!String(text || '').trim()) return { ...t, ok: false, reason: 'comment text required' };
  const comment = { author: String(author || 'unknown'), text: String(text), at: Number(now) };
  return { ...t, ok: true, comments: [...(t.comments || []), comment] };
}
export function closeFpThread(thread, closedBy, now = Date.now()) {
  return {
    ...(thread || {}),
    ok: true,
    status: 'closed',
    closedBy: String(closedBy || 'unknown'),
    closedAt: Number(now),
  };
}

// 52118 — "Not a vuln but hardening note" middle state: dismiss as FP but
// keep a hardening recommendation attached.
export function dismissWithHardeningNote(
  finding,
  reasonId,
  hardeningNote,
  markedBy,
  now = Date.now()
) {
  const f = finding || {};
  if (!String(hardeningNote || '').trim())
    return { ...f, ok: false, reason: 'hardening note required' };
  return {
    ...f,
    ok: true,
    status: 'fp-hardening-note',
    isFalsePositive: true,
    reasonId: String(reasonId || 'expected-behavior'),
    hardeningNote: String(hardeningNote),
    markedBy: String(markedBy || 'unknown'),
    markedAt: Number(now),
  };
}

// 52119 — FP severity-downgrade alternative: downgrade instead of dismissal.
const SEV_ORDER = ['info', 'low', 'medium', 'high', 'critical'];
export function downgradeSeverity(finding, toSeverity, reason, markedBy, now = Date.now()) {
  const f = finding || {};
  const from = String(f.severity || 'medium').toLowerCase();
  const to = String(toSeverity || '').toLowerCase();
  if (!SEV_ORDER.includes(to))
    return { ...f, ok: false, reason: `unknown severity "${toSeverity}"` };
  if (SEV_ORDER.indexOf(to) >= SEV_ORDER.indexOf(from)) {
    return { ...f, ok: false, reason: 'downgrade target must be lower than current severity' };
  }
  if (!String(reason || '').trim()) return { ...f, ok: false, reason: 'downgrade reason required' };
  return {
    ...f,
    ok: true,
    severity: to,
    status: 'severity-downgraded',
    downgrade: {
      from,
      to,
      reason: String(reason),
      markedBy: String(markedBy || 'unknown'),
      at: Number(now),
    },
  };
}

// 52120 — FP notification digest controls: choose which FP events notify.
export const FP_NOTIFY_EVENTS = [
  'fp-marked',
  'fp-disputed',
  'fp-overturned',
  'fp-expiring',
  'digest-weekly',
  'owner-alert',
];
export function fpDigestControls(events, prefs) {
  const p = prefs || {};
  return (events || []).map(e => {
    const id = String(e);
    const setting = p[id];
    const enabled =
      setting === true || (setting == null && ['fp-disputed', 'digest-weekly'].includes(id));
    return { event: id, enabled, known: FP_NOTIFY_EVENTS.includes(id) };
  });
}
export function shouldNotifyFpEvent(event, prefs) {
  const id = String(event);
  if (!FP_NOTIFY_EVENTS.includes(id)) return false;
  const setting = (prefs || {})[id];
  if (setting != null) return Boolean(setting);
  return ['fp-disputed', 'digest-weekly'].includes(id);
}
