/**
 * Wave74B.jsx — Infinity AI · Dark-Matter · Wave 74
 * 20 working React components for reopen integrations and
 * hunt templates, ideas 52941–52960. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XB from './wave74BCores.js';

const NOW = '2026-10-09T00:00:00Z';

const DEMO_HUNT = {
  huntId: 'hunt-42',
  target: 'shop.example.com',
  status: 'open',
  closedAt: '2026-09-20T09:00:00Z',
  createdAt: '2026-09-01T09:00:00Z',
  owner: 'lead-1',
  watchers: ['lead-1', 'analyst-1'],
  assignees: ['meera'],
  reopenCount: 1,
  lastReopenedAt: '2026-10-05T09:00:00Z',
  reopenHistory: [
    { at: '2026-10-05T09:00:00Z', reason: 'Regression detected in checkout after the deploy.', category: 'regression' },
    { at: '2026-09-28T09:00:00Z', reason: 'New threat intel matches this stack.', category: 'new-intel' },
  ],
  chapters: [
    { number: 1, kind: 'original', openedAt: '2026-09-01T09:00:00Z', closedAt: '2026-09-20T09:00:00Z', findingCount: 2 },
  ],
  findings: [
    { id: 'f1', title: 'SQLi in checkout', severity: 'critical', target: 'shop.example.com/checkout', engine: 'vuln-scan' },
    { id: 'f3', title: 'IDOR in invoices', severity: 'high', target: 'api.example.com/invoices/1001', engine: 'vuln-scan' },
  ],
  decisions: [{ findingId: 'f1', decision: 'confirmed' }, { findingId: 'f3', decision: 'triaged' }],
  scope: { include: ['shop.example.com', 'api.example.com'], exclude: ['admin.example.com'] },
  engines: ['recon', 'vuln-scan'],
  techStack: ['node', 'postgres'],
  snapshot: { huntId: 'hunt-42', closedAt: '2026-09-20T09:00:00Z', findings: [{ id: 'f1' }, { id: 'f3' }], decisions: [{ findingId: 'f1', decision: 'confirmed' }], findingCount: 2 },
  stats: { requests: 1240, durationMinutes: 95, engines: ['recon', 'vuln-scan'] },
};

const DEMO_TEMPLATE = {
  id: 'tpl-shop-baseline',
  templateId: 'tpl-shop-baseline',
  name: 'Shop baseline',
  scope: { include: ['shop.example.com', 'api.example.com'], exclude: ['admin.example.com'] },
  engines: [{ id: 'recon', version: '2.1' }, { id: 'vuln-scan', version: '4.0' }],
  payloadProfile: { aggressiveness: 'balanced', payloadSets: ['standard'], stealth: false, rateLimitPerMinute: 60 },
  schedule: { cadence: 'weekly', window: 'business-hours', timezone: 'UTC' },
  triageRules: [{ id: 'r1', when: 'severity is critical', assign: 'lead-1' }],
  versions: [{ version: 1, at: '2026-09-01T09:00:00Z', by: 'lead-1', note: 'Initial template.' }],
  ratingCount: 4,
  ratingAvg: 4.5,
  uses: 7,
};

const DEMO_TEMPLATES = [
  DEMO_TEMPLATE,
  { id: 'tpl-api-sweep', name: 'API sweep', scope: { include: ['api.example.com'], exclude: [] }, engines: [{ id: 'vuln-scan', version: '4.0' }], uses: 3, rating: 4.2, tags: ['api'] },
];

const DEMO_HUNTS_FOR_STATS = [
  { huntId: 'hunt-50', templateId: 'tpl-shop-baseline', findings: [{ id: 'f1' }, { id: 'f2' }] },
  { huntId: 'hunt-51', templateId: 'tpl-shop-baseline', findings: [{ id: 'f3' }] },
  { huntId: 'hunt-52', templateId: 'tpl-api-sweep', findings: [{ id: 'f4' }, { id: 'f5' }, { id: 'f6' }] },
];

function Card({ title, note, children }) {
  return (
    <div className="w74b-card">
      <div className="w74b-title">{title}</div>
      {note ? <div className="w74b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w74b-badge w74b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w74b-kv">
      <span className="w74b-k">{k}</span>
      <span className="w74b-v">{String(v)}</span>
    </div>
  );
}

export function ReopenWebhooks() {
  const v = XB.buildReopenWebhookPayload(DEMO_HUNT, { actor: 'lead-1', reason: 'Regression detected in checkout.' }, { now: NOW, endpoints: ['https://hooks.example.com/hunts'] });
  return (
    <Card title="Reopen webhooks" note="Idea 52941">
      <Kv k="Event" v={v.payload.event} />
      <Kv k="Endpoints" v={v.deliveryCount} />
      <div className="w74b-row"><Badge tone={v.valid ? 'ok' : 'warn'}>{v.valid ? 'ready' : 'incomplete'}</Badge></div>
    </Card>
  );
}

export function ReopenKeyboardShortcut() {
  const v = XB.describeReopenShortcut({ keys: 'ctrl+shift+r', huntState: 'closed', inInput: false }, {});
  return (
    <Card title="Reopen keyboard shortcut" note="Idea 52942">
      <Kv k="Shortcut" v={v.shortcut} />
      <Kv k="Triggers" v={String(v.triggers)} />
      <div className="w74b-note">{v.action}</div>
    </Card>
  );
}

export function ReopenConfirmationDetails() {
  const v = XB.buildReopenConfirmation(DEMO_HUNT, {});
  return (
    <Card title="Reopen confirmation details" note="Idea 52943">
      <Kv k="Items" v={v.totalItems} />
      <Kv k="From" v={v.previousState} />
      <div className="w74b-presig">{v.willRestore.map(w => `${w.item}:${w.count}`).join(' ')}</div>
    </Card>
  );
}

export function TeamNoteOnReopen() {
  const v = XB.buildTeamNoteOnReopen(DEMO_HUNT, { author: 'lead-1', text: 'Reopening to verify the checkout fix with fresh proof.' }, {});
  return (
    <Card title="Team note on reopen" note="Idea 52944">
      <Kv k="Recipients" v={v.recipientCount} />
      <Kv k="Valid" v={String(v.valid)} />
      <div className="w74b-note">{v.text.slice(0, 56)}</div>
    </Card>
  );
}

export function ActivityFeedReopenEntry() {
  const v = XB.buildActivityFeedReopenEntry(DEMO_HUNT, { actor: 'lead-1', reason: 'Regression detected in checkout.' }, { now: NOW });
  return (
    <Card title="Activity-feed reopen entry" note="Idea 52945">
      <Kv k="Kind" v={v.entry.kind} />
      <Kv k="Prominence" v={v.entry.prominence} />
      <div className="w74b-note">{v.entry.link}</div>
    </Card>
  );
}

export function ReopenReasonAnalytics() {
  const v = XB.analyzeReopenReasons([DEMO_HUNT], {});
  return (
    <Card title="Reopen reason analytics" note="Idea 52946">
      <Kv k="Total" v={v.totalReopens} />
      <Kv k="Top" v={v.topReason ? v.topReason.category : 'none'} />
      <div className="w74b-note">{v.topWords[0] ? v.topWords[0].word : 'none'}</div>
    </Card>
  );
}

export function PostReopenHealthCheck() {
  const v = XB.runPostReopenHealthCheck(DEMO_HUNT, DEMO_HUNT.snapshot, {});
  return (
    <Card title="Post-reopen health check" note="Idea 52947">
      <Kv k="Healthy" v={String(v.healthy)} />
      <Kv k="Issues" v={v.issueCount} />
      <div className="w74b-row"><Badge tone={v.healthy ? 'ok' : 'danger'}>{v.healthy ? 'passed' : 'issues'}</Badge></div>
    </Card>
  );
}

export function SaveHuntAsTemplate() {
  const v = XB.saveHuntAsTemplate(DEMO_HUNT, { name: 'Shop baseline', createdBy: 'lead-1' });
  return (
    <Card title={'Save hunt as template'} note="Idea 52948">
      <Kv k="Template" v={v.templateId} />
      <Kv k="Sections" v={v.sectionCount} />
      <div className="w74b-note">{v.template.name}</div>
    </Card>
  );
}

export function TemplateCapturesScope() {
  const v = XB.captureTemplateScope(DEMO_TEMPLATE, {});
  return (
    <Card title="Template captures scope" note="Idea 52949">
      <Kv k="Includes" v={v.includeCount} />
      <Kv k="Excludes" v={v.excludeCount} />
      <div className="w74b-note">{v.include.join(', ')}</div>
    </Card>
  );
}

export function TemplateCapturesEngineSelection() {
  const v = XB.captureTemplateEngines(DEMO_TEMPLATE, {});
  return (
    <Card title="Template captures engine selection" note="Idea 52950">
      <Kv k="Engines" v={v.engineCount} />
      <Kv k="First" v={v.engines[0] ? v.engines[0].id : 'none'} />
    </Card>
  );
}

export function TemplateCapturesPayloadProfile() {
  const v = XB.captureTemplatePayloadProfile(DEMO_TEMPLATE, {});
  return (
    <Card title="Template captures payload profile" note="Idea 52951">
      <Kv k="Mode" v={v.profile.aggressiveness} />
      <Kv k="Sets" v={v.profile.payloadSets.length} />
      <Kv k="Rate" v={v.profile.rateLimitPerMinute} />
    </Card>
  );
}

export function TemplateCapturesSchedule() {
  const v = XB.captureTemplateSchedule(DEMO_TEMPLATE, {});
  return (
    <Card title="Template captures schedule" note="Idea 52952">
      <Kv k="Cadence" v={v.schedule.cadence} />
      <Kv k="Window" v={v.schedule.window} />
    </Card>
  );
}

export function TemplateCapturesTriageRules() {
  const v = XB.captureTemplateTriageRules(DEMO_TEMPLATE, {});
  return (
    <Card title="Template captures triage rules" note="Idea 52953">
      <Kv k="Rules" v={v.ruleCount} />
      <Kv k="First" v={v.rules[0] ? v.rules[0].id : 'none'} />
    </Card>
  );
}

export function TemplateLibraryBrowser() {
  const v = XB.browseTemplateLibrary(DEMO_TEMPLATES, 'shop', {});
  return (
    <Card title="Template library browser" note="Idea 52954">
      <Kv k="Matched" v={v.count} />
      <Kv k="Top" v={v.templates[0] ? v.templates[0].id : 'none'} />
      <Kv k="Total" v={v.total} />
    </Card>
  );
}

export function TeamTemplateSharing() {
  const v = XB.shareTemplateWithTeam(DEMO_TEMPLATE, { description: 'Proven checkout baseline for the shop target.', owner: 'lead-1', visibility: 'workspace' }, { now: NOW });
  return (
    <Card title="Team template sharing (post-hunt)" note="Idea 52955">
      <Kv k="Shared" v={String(v.shared)} />
      <Kv k="Owner" v={v.owner} />
      <div className="w74b-note">{v.description.slice(0, 48)}</div>
    </Card>
  );
}

export function TemplateVersioning() {
  const v = XB.versionTemplate(DEMO_TEMPLATE, { by: 'lead-1', note: 'Tightened payload rate after review.' }, { now: NOW });
  return (
    <Card title="Template versioning (post-hunt)" note="Idea 52956">
      <Kv k="Version" v={v.currentVersion} />
      <Kv k="History" v={v.versionCount} />
    </Card>
  );
}

export function TemplateForking() {
  const v = XB.forkTemplate(DEMO_TEMPLATE, { name: 'Shop baseline EU', owner: 'analyst-1' }, {});
  return (
    <Card title="Template forking (post-hunt)" note="Idea 52957">
      <Kv k="Fork" v={v.forkId} />
      <Kv k="From" v={v.originalId || 'none'} />
      <div className="w74b-note">{v.template.name}</div>
    </Card>
  );
}

export function TemplateRatings() {
  const v = XB.rateTemplate(DEMO_TEMPLATE, { stars: 5 }, {});
  return (
    <Card title="Template ratings (post-hunt)" note="Idea 52958">
      <Kv k="Average" v={v.average} />
      <Kv k="Ratings" v={v.ratingCount} />
      <div className="w74b-row"><Badge tone="info">{`${v.stars} stars`}</Badge></div>
    </Card>
  );
}

export function TemplateUsageStatistics() {
  const v = XB.computeTemplateUsageStats(DEMO_TEMPLATES, DEMO_HUNTS_FOR_STATS, {});
  return (
    <Card title="Template usage statistics (post-hunt)" note="Idea 52959">
      <Kv k="Templates" v={v.templateCount} />
      <Kv k="Top uses" v={v.topTemplate ? v.topTemplate.uses : 0} />
      <div className="w74b-note">{v.topTemplate ? v.topTemplate.templateId : 'none'}</div>
    </Card>
  );
}

export function TemplatePreview() {
  const v = XB.previewTemplate(DEMO_TEMPLATE, {});
  return (
    <Card title="Template preview (post-hunt)" note="Idea 52960">
      <Kv k="Scope" v={v.scopeInclude.length} />
      <Kv k="Engines" v={v.engines.length} />
      <Kv k="Complete" v={String(v.complete)} />
      <div className="w74b-row"><Badge tone="info">{`checked ${NOW.slice(0, 10)}`}</Badge></div>
    </Card>
  );
}

/** Gallery list: all 20 idea-52941–52960 components, export-only. */
export const W74_B_GALLERY = [
  ReopenWebhooks,
  ReopenKeyboardShortcut,
  ReopenConfirmationDetails,
  TeamNoteOnReopen,
  ActivityFeedReopenEntry,
  ReopenReasonAnalytics,
  PostReopenHealthCheck,
  SaveHuntAsTemplate,
  TemplateCapturesScope,
  TemplateCapturesEngineSelection,
  TemplateCapturesPayloadProfile,
  TemplateCapturesSchedule,
  TemplateCapturesTriageRules,
  TemplateLibraryBrowser,
  TeamTemplateSharing,
  TemplateVersioning,
  TemplateForking,
  TemplateRatings,
  TemplateUsageStatistics,
  TemplatePreview,
];

/** Gallery: renders every Wave 74B component, export-only. */
export function Wave74BGallery() {
  return (
    <div className="w74b-gallery">
      {W74_B_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
