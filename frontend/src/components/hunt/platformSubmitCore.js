/**
 * platformSubmitCore.js — Infinity AI · Dark-Matter · Wave 58 (ideas 52300–52320)
 * Pure JS (no React / DOM / network). Deterministic bug-bounty platform
 * submission models: per-platform draft generators (HackerOne, Bugcrowd,
 * Intigriti, YesWeHack), field mapping, severity mapping, copyable reports,
 * approval-gated submission and status state machines, pre-submission
 * checklists, duplicate checks, scope validation, bounty estimates, PoC
 * manifests, screenshot/video attachments, CVSS translation, CWE tagging,
 * asset auto-fill, step formatting and impact statements. Time is injected
 * via `now` params (default Date.now()) so every function is reproducible.
 */

export const WAVE58_PS_IDEAS = [
  { id: 52300, title: 'HackerOne draft generator', skip: false },
  { id: 52301, title: 'Bugcrowd draft generator', skip: false },
  { id: 52302, title: 'Intigriti draft generator', skip: false },
  { id: 52303, title: 'YesWeHack draft generator', skip: false },
  { id: 52304, title: 'Per-platform field mapping table', skip: false },
  {
    id: 52305,
    title: 'Platform severity auto-mapping (internal/CVSS to platform scales)',
    skip: false,
  },
  { id: 52306, title: 'One-click copy formatted report (markdown-preserving)', skip: false },
  { id: 52307, title: 'Approval-gated API submission state machine', skip: false },
  { id: 52308, title: 'Submission draft status tracker (draft to paid)', skip: false },
  { id: 52309, title: 'Pre-submission checklist per platform', skip: false },
  { id: 52310, title: 'Duplicate check (history + disclosed reports)', skip: false },
  { id: 52311, title: 'Platform scope validation', skip: false },
  {
    id: 52312,
    title: 'Bounty estimate display (historical payout range by vuln class)',
    skip: false,
  },
  { id: 52313, title: 'Auto-attached PoC files manifest (curl/Python + evidence)', skip: false },
  { id: 52314, title: 'Screenshot attachment pack collector', skip: false },
  { id: 52315, title: 'Video PoC attachment descriptor with file-size handling', skip: false },
  { id: 52316, title: 'CVSS-to-platform severity translator with explanation', skip: false },
  { id: 52317, title: 'CWE auto-tagging', skip: false },
  { id: 52318, title: 'Affected-asset auto-fill from finding endpoint data', skip: false },
  {
    id: 52319,
    title: 'Steps-to-reproduce formatter (numbered, minimal from PoC trace)',
    skip: false,
  },
  { id: 52320, title: 'Impact statement generator', skip: false },
];

export const PLATFORMS = ['hackerone', 'bugcrowd', 'intigriti', 'yeswehack'];

const SEVERITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function tokenFor(scope, id, now) {
  const raw = `${scope}:${id}:${now}`;
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
  return `ps_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

function summaryLine(finding) {
  return `[${finding.severity || 'unknown'}] ${finding.title || finding.id}`;
}

function stepsArray(finding) {
  if (Array.isArray(finding.pocTrace) && finding.pocTrace.length)
    return finding.pocTrace.map(String);
  if (finding.poc) return [String(finding.poc)];
  if (finding.description) return [String(finding.description)];
  return ['No reproduction steps recorded.'];
}

/* 52300 — HackerOne draft generator. */
export function buildHackerOneDraft(finding) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  return {
    ok: true,
    platform: 'hackerone',
    draft: {
      title: finding.title || `Finding ${finding.id}`,
      summary: summaryLine(finding),
      vulnerability_information: [
        `Description: ${finding.description || 'n/a'}`,
        `Impact: ${finding.impact || generateImpact(finding).impact}`,
      ].join('\n'),
      steps_to_reproduce: formatSteps(stepsArray(finding)).steps,
      weakness: (tagCwe(finding).cwes[0] || {}).id || null,
      severity: mapSeverity(finding.severity, finding.cvss, 'hackerone').label,
      attachments: buildPocManifest(finding).manifest.map(m => m.name),
    },
  };
}

/* 52301 — Bugcrowd draft generator. */
export function buildBugcrowdDraft(finding) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  return {
    ok: true,
    platform: 'bugcrowd',
    draft: {
      title: finding.title || `Finding ${finding.id}`,
      vulnerability_type: mapSeverity(finding.severity, finding.cvss, 'bugcrowd').label,
      summary: summaryLine(finding),
      description: finding.description || 'n/a',
      reproduction_steps: formatSteps(stepsArray(finding)).steps,
      impact: finding.impact || generateImpact(finding).impact,
      references: Array.isArray(finding.references) ? finding.references : [],
      cwe: (tagCwe(finding).cwes[0] || {}).id || null,
    },
  };
}

/* 52302 — Intigriti draft generator. */
export function buildIntigritiDraft(finding) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  return {
    ok: true,
    platform: 'intigriti',
    draft: {
      title: finding.title || `Finding ${finding.id}`,
      severity: mapSeverity(finding.severity, finding.cvss, 'intigriti').label,
      summary: summaryLine(finding),
      poc: formatSteps(stepsArray(finding)).text,
      impact: finding.impact || generateImpact(finding).impact,
      affected_endpoint: (fillAsset(finding).asset || {}).url || null,
      cwe: (tagCwe(finding).cwes[0] || {}).id || null,
    },
  };
}

/* 52303 — YesWeHack draft generator. */
export function buildYesWeHackDraft(finding) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  return {
    ok: true,
    platform: 'yeswehack',
    draft: {
      title: finding.title || `Finding ${finding.id}`,
      criticality: mapSeverity(finding.severity, finding.cvss, 'yeswehack').label,
      summary: summaryLine(finding),
      technical_description: finding.description || 'n/a',
      reproduction_steps: formatSteps(stepsArray(finding)).steps,
      impact: finding.impact || generateImpact(finding).impact,
      remediation: finding.remediation || null,
    },
  };
}

/* 52304 — Per-platform field mapping table. */
export const PLATFORM_FIELD_MAP = {
  hackerone: {
    id: 'id',
    title: 'title',
    summary: 'summary',
    description: 'vulnerability_information',
    steps: 'steps_to_reproduce',
    impact: 'vulnerability_information',
    severity: 'severity',
    cwe: 'weakness',
    asset: 'asset_identifier',
    poc: 'attachments',
  },
  bugcrowd: {
    id: 'id',
    title: 'title',
    summary: 'summary',
    description: 'description',
    steps: 'reproduction_steps',
    impact: 'impact',
    severity: 'vulnerability_type',
    cwe: 'cwe',
    asset: 'target_url',
    poc: 'attachments',
  },
  intigriti: {
    id: 'id',
    title: 'title',
    summary: 'summary',
    description: 'summary',
    steps: 'poc',
    impact: 'impact',
    severity: 'severity',
    cwe: 'cwe',
    asset: 'affected_endpoint',
    poc: 'attachments',
  },
  yeswehack: {
    id: 'id',
    title: 'title',
    summary: 'summary',
    description: 'technical_description',
    steps: 'reproduction_steps',
    impact: 'impact',
    severity: 'criticality',
    cwe: 'cwe',
    asset: 'affected_scope',
    poc: 'attachments',
  },
};

export function mapFindingFields(finding, platform) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  const table = PLATFORM_FIELD_MAP[platform];
  if (!table) return { ok: false, reason: `unknown platform: ${platform}` };
  const mapped = {};
  for (const [field, platformField] of Object.entries(table)) {
    mapped[platformField] = finding[field] !== undefined ? finding[field] : null;
  }
  return { ok: true, platform, mapped, mapping: table };
}

/* 52305 — Platform severity auto-mapping (internal severity/CVSS → platform scales). */
const PLATFORM_SEVERITY_SCALES = {
  hackerone: [
    { label: 'Critical', min: 9.0 },
    { label: 'High', min: 7.0 },
    { label: 'Medium', min: 4.0 },
    { label: 'Low', min: 0.1 },
    { label: 'None', min: 0 },
  ],
  bugcrowd: [
    { label: 'P1', min: 9.0 },
    { label: 'P2', min: 7.0 },
    { label: 'P3', min: 4.0 },
    { label: 'P4', min: 0.1 },
    { label: 'P5', min: 0 },
  ],
  intigriti: [
    { label: 'Exceptional', min: 9.5 },
    { label: 'Critical', min: 9.0 },
    { label: 'High', min: 7.0 },
    { label: 'Medium', min: 4.0 },
    { label: 'Low', min: 0 },
  ],
  yeswehack: [
    { label: 'Critical', min: 9.0 },
    { label: 'High', min: 7.0 },
    { label: 'Medium', min: 4.0 },
    { label: 'Low', min: 0 },
  ],
};

const INTERNAL_TO_CVSS = { critical: 9.5, high: 8.0, medium: 5.5, low: 2.5, info: 0 };

export function mapSeverity(severity, cvss, platform) {
  const scale = PLATFORM_SEVERITY_SCALES[platform];
  if (!scale) return { ok: false, reason: `unknown platform: ${platform}` };
  let score = typeof cvss === 'number' ? cvss : null;
  if (score == null)
    score = INTERNAL_TO_CVSS[severity] !== undefined ? INTERNAL_TO_CVSS[severity] : null;
  if (score == null) return { ok: false, reason: 'no severity or cvss to map from' };
  const entry = scale.find(s => score >= s.min) || scale[scale.length - 1];
  return {
    ok: true,
    platform,
    label: entry.label,
    cvss: score,
    fromInternal: typeof cvss !== 'number',
  };
}

/* 52306 — One-click copy formatted report (markdown-preserving string). */
export function buildCopyableReport(finding) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  const md = [
    `# ${finding.title || finding.id}`,
    '',
    `**Severity:** ${finding.severity || 'unknown'}${finding.cvss != null ? ` (CVSS ${finding.cvss})` : ''}`,
    `**Target:** ${(fillAsset(finding).asset || {}).url || finding.target || 'n/a'}`,
    `**CWE:** ${
      tagCwe(finding)
        .cwes.map(c => c.id)
        .join(', ') || 'n/a'
    }`,
    '',
    '## Summary',
    summaryLine(finding),
    '',
    '## Steps to reproduce',
    formatSteps(stepsArray(finding)).text,
    '',
    '## Impact',
    finding.impact || generateImpact(finding).impact,
    '',
    '## Remediation',
    finding.remediation || 'Follow vendor hardening guidance.',
    '',
    '_Generated by Infinity AI · Dark-Matter_',
  ].join('\n');
  return { ok: true, markdown: md, length: md.length };
}

/* 52307 — Approval-gated API submission state machine.
 * Human approves the EXACT payload before anything may be sent.
 * This module performs NO network calls; transitions model the gate. */
export const SUBMISSION_STATES = [
  'draft',
  'pending-approval',
  'approved',
  'sending',
  'submitted',
  'rejected',
];

export function createSubmission(input = {}, now = Date.now()) {
  if (!PLATFORMS.includes(input.platform))
    return { ok: false, reason: `platform must be ${PLATFORMS.join('|')}` };
  if (!input.finding || !input.finding.id) return { ok: false, reason: 'finding with id required' };
  if (!input.payload || typeof input.payload !== 'object')
    return { ok: false, reason: 'payload object required' };
  return {
    ok: true,
    submission: {
      id: `sub_${tokenFor('sub', `${input.platform}:${input.finding.id}`, now)}`,
      platform: input.platform,
      findingId: input.finding.id,
      payload: input.payload,
      payloadHash: payloadHash(input.payload),
      state: 'draft',
      approvals: [],
      createdAt: now,
      updatedAt: now,
      networkCalls: 0, // hard invariant: this model never performs sends
    },
  };
}

function payloadHash(payload) {
  const raw = JSON.stringify(payload);
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
  return `ph_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

export function submissionReducer(submission, action = {}, now = Date.now()) {
  if (!submission || !submission.id) return { ok: false, reason: 'submission required' };
  const stamp = { ...submission, updatedAt: now };
  switch (submission.state) {
    case 'draft':
      if (action.type === 'REQUEST_APPROVAL') {
        return { ok: true, submission: { ...stamp, state: 'pending-approval' } };
      }
      return { ok: false, reason: `no transition ${action.type} from draft` };
    case 'pending-approval':
      if (action.type === 'APPROVE') {
        // Approver must confirm the exact payload hash they reviewed.
        if (action.payloadHash !== submission.payloadHash) {
          return { ok: false, reason: 'payload changed since review — re-request approval' };
        }
        // The stored payload must still match the hash from request time:
        // any mutation in between blocks approval.
        if (payloadHash(submission.payload) !== submission.payloadHash) {
          return {
            ok: false,
            reason: 'payload mutated after review was requested — re-request approval',
          };
        }
        return {
          ok: true,
          submission: {
            ...stamp,
            state: 'approved',
            approvals: [
              ...submission.approvals,
              { by: action.by || 'owner', at: now, payloadHash: action.payloadHash },
            ],
          },
        };
      }
      if (action.type === 'REJECT') {
        return {
          ok: true,
          submission: {
            ...stamp,
            state: 'rejected',
            rejectedBy: action.by || 'owner',
            rejectReason: action.reason || null,
          },
        };
      }
      return { ok: false, reason: `no transition ${action.type} from pending-approval` };
    case 'approved':
      if (action.type === 'MARK_SENT') {
        // External sender reports completion; this module still makes zero calls.
        if (action.payloadHash !== submission.payloadHash) {
          return { ok: false, reason: 'payload changed after approval — submission blocked' };
        }
        if (payloadHash(submission.payload) !== submission.payloadHash) {
          return { ok: false, reason: 'payload mutated after approval — submission blocked' };
        }
        return { ok: true, submission: { ...stamp, state: 'submitted', submittedAt: now } };
      }
      return { ok: false, reason: `no transition ${action.type} from approved` };
    default:
      return { ok: false, reason: `terminal state ${submission.state}` };
  }
}

/* 52308 — Submission draft status tracker: draft → submitted → triaged → resolved → paid. */
export const TRACKER_STATES = ['draft', 'submitted', 'triaged', 'resolved', 'paid'];

export function createSubmissionTracker(findingId, platform, now = Date.now()) {
  if (!findingId) return { ok: false, reason: 'findingId required' };
  if (!PLATFORMS.includes(platform))
    return { ok: false, reason: `platform must be ${PLATFORMS.join('|')}` };
  return {
    ok: true,
    tracker: {
      id: `trk_${tokenFor('trk', `${platform}:${findingId}`, now)}`,
      findingId,
      platform,
      state: 'draft',
      history: [{ state: 'draft', at: now, note: 'draft created' }],
      payout: null,
    },
  };
}

export function draftStatusReducer(tracker, action = {}, now = Date.now()) {
  if (!tracker || !tracker.id) return { ok: false, reason: 'tracker required' };
  const order = { draft: 0, submitted: 1, triaged: 2, resolved: 3, paid: 4 };
  const target = action.to;
  if (!TRACKER_STATES.includes(target)) return { ok: false, reason: `unknown state ${target}` };
  if (order[target] !== order[tracker.state] + 1) {
    return { ok: false, reason: `illegal jump ${tracker.state} → ${target}` };
  }
  const history = [...tracker.history, { state: target, at: now, note: action.note || null }];
  const patch = { state: target, history, updatedAt: now };
  if (target === 'paid' && action.payout != null) patch.payout = action.payout;
  return { ok: true, tracker: { ...tracker, ...patch } };
}

/* 52309 — Pre-submission checklist per platform. */
export const SUBMISSION_CHECKLISTS = {
  hackerone: [
    'title-under-140-chars',
    'weakness-set',
    'steps-numbered',
    'impact-present',
    'asset-identifier-set',
  ],
  bugcrowd: [
    'vulnerability-type-set',
    'target-url-set',
    'steps-numbered',
    'impact-present',
    'references-or-poc',
  ],
  intigriti: ['severity-mapped', 'affected-endpoint-set', 'poc-present', 'impact-present'],
  yeswehack: [
    'criticality-mapped',
    'technical-description-present',
    'reproduction-steps-present',
    'impact-present',
  ],
};

export function runChecklist(finding, platform) {
  const checks = SUBMISSION_CHECKLISTS[platform];
  if (!checks) return { ok: false, reason: `unknown platform: ${platform}` };
  const results = checks.map(check => {
    let pass = false;
    switch (check) {
      case 'title-under-140-chars':
        pass =
          typeof finding.title === 'string' &&
          finding.title.length > 0 &&
          finding.title.length <= 140;
        break;
      case 'weakness-set':
      case 'severity-mapped':
      case 'criticality-mapped':
      case 'vulnerability-type-set':
        pass = mapSeverity(finding.severity, finding.cvss, platform).ok;
        break;
      case 'steps-numbered':
      case 'reproduction-steps-present':
      case 'poc-present':
        pass = stepsArray(finding).length > 0;
        break;
      case 'impact-present':
        pass = Boolean(finding.impact || generateImpact(finding).impact);
        break;
      case 'asset-identifier-set':
      case 'target-url-set':
      case 'affected-endpoint-set':
        pass = Boolean((fillAsset(finding).asset || {}).url);
        break;
      case 'technical-description-present':
        pass = typeof finding.description === 'string' && finding.description.length > 0;
        break;
      case 'references-or-poc':
        pass =
          (Array.isArray(finding.references) && finding.references.length > 0) ||
          Boolean(finding.poc);
        break;
      default:
        pass = false;
    }
    return { check, pass };
  });
  const failed = results.filter(r => !r.pass).map(r => r.check);
  return { ok: true, platform, results, failed, passed: failed.length === 0 };
}

/* 52310 — Duplicate check (search history + disclosed reports for likely duplicates). */
function tokenize(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(t => t.length > 2)
  );
}

function jaccard(a, b) {
  const ia = new Set([...a].filter(t => b.has(t)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : ia.size / union.size;
}

export function checkDuplicates(finding, history = [], disclosed = []) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  const hay = new Map();
  for (const h of Array.isArray(history) ? history : [])
    hay.set(h.id, {
      source: 'history',
      title: h.title,
      description: h.description,
      asset: h.asset,
    });
  for (const d of Array.isArray(disclosed) ? disclosed : [])
    hay.set(d.id, {
      source: 'disclosed',
      title: d.title,
      description: d.description,
      asset: d.asset,
    });
  const mine = tokenize(`${finding.title} ${finding.description} ${finding.endpoint || ''}`);
  const candidates = [];
  for (const [id, doc] of hay) {
    if (id === finding.id) continue;
    const score = jaccard(mine, tokenize(`${doc.title} ${doc.description} ${doc.asset || ''}`));
    const sameAsset =
      finding.endpoint && doc.asset && String(finding.endpoint).includes(String(doc.asset));
    const final = sameAsset ? Math.min(1, score + 0.25) : score;
    if (final >= 0.35)
      candidates.push({
        id,
        source: doc.source,
        title: doc.title,
        score: Math.round(final * 100) / 100,
      });
  }
  candidates.sort((a, b) => b.score - a.score);
  return {
    ok: true,
    duplicates: candidates,
    likelyDuplicate: candidates.length > 0,
    highestScore: candidates.length ? candidates[0].score : 0,
  };
}

/* 52311 — Platform scope validation. */
export function validateScope(finding, program) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  if (!program || !Array.isArray(program.inScope))
    return { ok: false, reason: 'program with inScope array required' };
  const asset = String(
    (fillAsset(finding).asset || {}).url || finding.endpoint || finding.target || ''
  );
  const inScope = program.inScope.some(entry => asset.includes(String(entry)));
  const outOfScope =
    Array.isArray(program.outOfScope) &&
    program.outOfScope.some(entry => asset.includes(String(entry)));
  if (outOfScope) return { ok: true, inScope: false, reason: 'explicitly out of scope', asset };
  return { ok: true, inScope, reason: inScope ? 'in scope' : 'not in declared scope', asset };
}

/* 52312 — Bounty estimate display (historical payout range by vuln class). */
const PAYOUT_TABLE = {
  xss: { critical: [1500, 5000], high: [500, 1500], medium: [150, 500], low: [50, 150] },
  sqli: { critical: [3000, 10000], high: [1000, 3000], medium: [300, 1000], low: [100, 300] },
  idor: { critical: [2000, 7500], high: [750, 2000], medium: [200, 750], low: [75, 200] },
  ssrf: { critical: [2500, 8000], high: [800, 2500], medium: [250, 800], low: [100, 250] },
  rce: { critical: [5000, 20000], high: [2000, 5000], medium: [500, 2000], low: [200, 500] },
  csrf: { high: [300, 1000], medium: [100, 300], low: [50, 100] },
  default: { critical: [1000, 5000], high: [400, 1200], medium: [100, 400], low: [40, 100] },
};

export function estimateBounty(vulnClass, severity) {
  const table = PAYOUT_TABLE[String(vulnClass || '').toLowerCase()] || PAYOUT_TABLE.default;
  const range = table[severity] || table.medium || [50, 200];
  return {
    ok: true,
    vulnClass: vulnClass || 'default',
    severity,
    estimate: { low: range[0], high: range[1], currency: 'USD' },
    note: 'Historical payout range; actual bounties vary by program.',
  };
}

/* 52313 — Auto-attached PoC files manifest (curl/Python + evidence). */
export function buildPocManifest(finding) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  const manifest = [];
  if (finding.poc)
    manifest.push({ name: `poc-${finding.id}.sh`, kind: 'curl', source: 'finding.poc' });
  if (finding.pocPython)
    manifest.push({ name: `poc-${finding.id}.py`, kind: 'python', source: 'finding.pocPython' });
  if (Array.isArray(finding.evidence)) {
    finding.evidence.forEach((e, i) =>
      manifest.push({
        name: `evidence-${finding.id}-${i + 1}.${e.kind === 'screenshot' ? 'png' : 'txt'}`,
        kind: 'evidence',
        source: `finding.evidence[${i}]`,
      })
    );
  }
  return { ok: true, manifest, count: manifest.length };
}

/* 52314 — Screenshot attachment pack collector. */
export function collectScreenshots(evidence = [], opts = {}) {
  const items = (Array.isArray(evidence) ? evidence : [])
    .filter(e => e && e.kind === 'screenshot')
    .map((e, i) => ({
      name: e.name || `screenshot-${i + 1}.png`,
      sizeBytes: typeof e.sizeBytes === 'number' ? e.sizeBytes : 0,
      caption: e.caption || e.summary || null,
    }));
  const totalBytes = items.reduce((a, s) => a + s.sizeBytes, 0);
  const maxTotal = typeof opts.maxTotalBytes === 'number' ? opts.maxTotalBytes : 25 * 1024 * 1024;
  return {
    ok: true,
    pack: {
      items,
      totalBytes,
      count: items.length,
      withinLimit: totalBytes <= maxTotal,
      maxTotalBytes: maxTotal,
    },
  };
}

/* 52315 — Video PoC attachment descriptor with file-size handling. */
export function buildVideoPoC(input = {}, opts = {}) {
  if (!input.path && !input.url) return { ok: false, reason: 'video path or url required' };
  const sizeBytes = typeof input.sizeBytes === 'number' ? input.sizeBytes : null;
  const maxBytes = typeof opts.maxBytes === 'number' ? opts.maxBytes : 100 * 1024 * 1024;
  const withinLimit = sizeBytes == null ? null : sizeBytes <= maxBytes;
  return {
    ok: true,
    video: {
      path: input.path || null,
      url: input.url || null,
      format: input.format || (input.path ? input.path.split('.').pop() : null),
      durationSec: typeof input.durationSec === 'number' ? input.durationSec : null,
      sizeBytes,
      maxBytes,
      withinLimit,
      recommendation:
        withinLimit === false
          ? 'Compress or trim the video, or host it externally and link it.'
          : null,
    },
  };
}

/* 52316 — CVSS-to-platform severity translator with explanation. */
export function translateCvss(cvss, platform) {
  if (typeof cvss !== 'number' || Number.isNaN(cvss) || cvss < 0 || cvss > 10) {
    return { ok: false, reason: 'cvss must be a number 0–10' };
  }
  const r = mapSeverity(null, cvss, platform);
  if (!r.ok) return r;
  return {
    ok: true,
    platform,
    cvss,
    label: r.label,
    explanation: `CVSS ${cvss} → ${r.label} on ${platform} (from CVSS, not internal severity).`,
  };
}

/* 52317 — CWE auto-tagging. */
const CWE_RULES = [
  {
    match: ['xss', 'cross-site scripting', 'reflected', 'stored xss', 'dom xss'],
    id: 'CWE-79',
    name: 'Cross-site Scripting',
  },
  { match: ['sql injection', 'sqli', 'blind sql'], id: 'CWE-89', name: 'SQL Injection' },
  {
    match: ['idor', 'insecure direct object'],
    id: 'CWE-639',
    name: 'Authorization Bypass Through User-Controlled Key',
  },
  {
    match: ['ssrf', 'server-side request forgery'],
    id: 'CWE-918',
    name: 'Server-Side Request Forgery',
  },
  {
    match: ['csrf', 'cross-site request forgery'],
    id: 'CWE-352',
    name: 'Cross-Site Request Forgery',
  },
  {
    match: ['rce', 'remote code execution', 'command injection', 'os command'],
    id: 'CWE-78',
    name: 'OS Command Injection',
  },
  { match: ['xxe', 'xml external entity'], id: 'CWE-611', name: 'XXE' },
  {
    match: ['lfi', 'local file inclusion', 'path traversal', 'directory traversal'],
    id: 'CWE-22',
    name: 'Path Traversal',
  },
  { match: ['open redirect'], id: 'CWE-601', name: 'Open Redirect' },
  {
    match: ['jwt', 'json web token'],
    id: 'CWE-347',
    name: 'Improper Verification of Cryptographic Signature',
  },
  { match: ['cors'], id: 'CWE-942', name: 'Permissive CORS Policy' },
  { match: ['subdomain takeover'], id: 'CWE-350', name: 'Reliance on Reverse DNS' },
  {
    match: ['secret', 'api key', 'credential', 'hardcoded'],
    id: 'CWE-798',
    name: 'Hard-coded Credentials',
  },
];

export function tagCwe(finding) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  const hay =
    `${finding.title || ''} ${finding.description || ''} ${finding.vulnClass || ''}`.toLowerCase();
  const cwes = [];
  for (const rule of CWE_RULES) {
    if (rule.match.some(m => hay.includes(m)) && !cwes.some(c => c.id === rule.id)) {
      cwes.push({ id: rule.id, name: rule.name });
    }
  }
  return { ok: true, cwes };
}

/* 52318 — Affected-asset auto-fill from finding endpoint data. */
export function fillAsset(finding) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  const endpoint = finding.endpoint || finding.url || finding.target || null;
  let host = null;
  try {
    if (endpoint && /^https?:\/\//i.test(endpoint)) host = new URL(endpoint).host;
  } catch {
    host = null;
  }
  return {
    ok: true,
    asset: {
      url: endpoint,
      host,
      type: host ? 'web' : endpoint ? 'other' : null,
      fromField: finding.endpoint
        ? 'endpoint'
        : finding.url
          ? 'url'
          : finding.target
            ? 'target'
            : null,
    },
  };
}

/* 52319 — Steps-to-reproduce formatter (numbered, minimal from PoC trace). */
export function formatSteps(trace) {
  const raw = Array.isArray(trace) ? trace : [trace];
  const steps = raw
    .map(s => String(s || '').trim())
    .filter(s => s.length > 0)
    .slice(0, 20)
    .map((s, i) => `${i + 1}. ${s}`);
  return { ok: true, steps, text: steps.join('\n') };
}

/* 52320 — Impact statement generator. */
const IMPACT_TEMPLATES = {
  xss: f =>
    `An attacker can execute arbitrary JavaScript in victim browsers via ${f.endpoint || 'the vulnerable page'}, enabling session theft and account takeover.`,
  sqli: f =>
    `The injectable query exposes backend database contents, allowing data exfiltration${f.endpoint ? ` through ${f.endpoint}` : ''} and potential authentication bypass.`,
  idor: f =>
    `Object references are enumerable, letting any authenticated user read or modify other users' data.`,
  ssrf: f =>
    `The server can be coerced into internal requests, risking cloud metadata access and internal network pivoting.`,
  rce: f =>
    `Remote command execution grants full control of the affected host to an unauthenticated attacker.`,
  csrf: f => `Victims can be tricked into performing state-changing actions without their consent.`,
};

export function generateImpact(finding) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  const key = String(finding.vulnClass || '').toLowerCase();
  const template = IMPACT_TEMPLATES[key];
  const impact = template
    ? template(finding)
    : `A ${finding.severity || 'medium'}-severity weakness${finding.endpoint ? ` at ${finding.endpoint}` : ''} was confirmed; ${finding.description || 'it should be remediated before exploitation in the wild.'}`;
  return { ok: true, impact, templated: Boolean(template) };
}
