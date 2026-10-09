/**
 * Wave75A.jsx — Infinity AI · Dark-Matter · Wave 75
 * 20 working React components for the template ecosystem,
 * ideas 52961–52980. Export-only module: components are not
 * mounted anywhere. Pure presentational, props-driven.
 */
import React from 'react';
import * as XA from './wave75ACore.js';

const NOW = '2026-10-09T00:00:00Z';

const SAMPLE_TEMPLATE = {
  id: 'tpl-shop-baseline', templateId: 'tpl-shop-baseline', name: 'Shop baseline',
  scope: { include: ['shop.example.com', 'api.example.com'], exclude: ['admin.example.com'] },
  engines: [{ id: 'recon', version: '2.1' }, { id: 'vuln-scan', version: '4.0' }],
  payloadProfile: { aggressiveness: 'balanced', payloadSets: ['standard'], stealth: false, rateLimitPerMinute: 60 },
  schedule: { cadence: 'weekly', window: 'business-hours', timezone: 'UTC' },
  triageRules: [{ id: 'r1', when: 'severity is critical', assign: 'lead-1', severity: 'critical' }],
  tags: ['web', 'shop'], vertical: 'retail', assetType: 'web',
  versions: [
    { version: 1, at: '2026-09-01T09:00:00Z', by: 'lead-1', note: 'Initial template.' },
    { version: 2, at: '2026-09-15T09:00:00Z', by: 'lead-1', note: 'Tightened payload rate.' },
  ],
  uses: 7, notifications: { onComplete: true, channels: ['in-app', 'email'] },
};

const SAMPLE_HUNTS = [
  { huntId: 'hunt-42', target: 'shop.example.com', findings: [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }], engines: ['recon', 'vuln-scan'], scope: { include: ['shop.example.com'], exclude: [] } },
  { huntId: 'hunt-43', target: 'api.example.com', findings: [{ id: 'f4' }], engines: ['vuln-scan'], scope: { include: ['api.example.com'], exclude: [] } },
];

function Card({ title, note, children }) {
  return (
    <div className="w75a-card">
      <div className="w75a-title">{title}</div>
      {note ? <div className="w75a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w75a-badge w75a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w75a-kv">
      <span className="w75a-k">{k}</span>
      <span className="w75a-v">{String(v)}</span>
    </div>
  );
}

export function TemplateImportExport() {
  const v = XA.exchangeTemplatePackage(SAMPLE_TEMPLATE, null, {});
  return (
    <Card title="Template import/export (post-hunt)" note="Idea 52961">
      <Kv k="Format" v={v.descriptor.format} />
      <Kv k="Checksum" v={v.checksum.slice(0, 8)} />
    </Card>
  );
}

export function AutoSuggestTemplateFromBestHunt() {
  const v = XA.suggestTemplateFromBestHunt(SAMPLE_HUNTS, {});
  return (
    <Card title="Auto-suggest template from best hunt" note="Idea 52962">
      <Kv k="Best hunt" v={v.best ? v.best.huntId : 'none'} />
      <Kv k="Score" v={v.best ? v.best.score : 0} />
    </Card>
  );
}

export function TemplateCategories() {
  const v = XA.classifyTemplateCategory(SAMPLE_TEMPLATE, {});
  return (
    <Card title="Template categories (post-hunt)" note="Idea 52963">
      <Kv k="Category" v={v.category} />
      <Kv k="Template" v={v.templateId || 'none'} />
    </Card>
  );
}

export function TemplateSearchAndTags() {
  const v = XA.searchTemplatesWithTags([SAMPLE_TEMPLATE], 'shop', { tags: ['web'] });
  return (
    <Card title="Template search and tags" note="Idea 52964">
      <Kv k="Matched" v={v.count} />
      <Kv k="Top" v={v.results[0] ? v.results[0].templateId : 'none'} />
    </Card>
  );
}

export function CrossTargetTemplateCloning() {
  const v = XA.cloneTemplateAcrossTargets(SAMPLE_TEMPLATE, { host: 'store.example.com' }, {});
  return (
    <Card title="Cross-target template cloning" note="Idea 52965">
      <Kv k="Clone" v={v.cloneId} />
      <Kv k="Hosts" v={v.remappedCount} />
    </Card>
  );
}

export function ParameterizedTargetVariables() {
  const v = XA.applyTemplateVariables({ name: 'Hunt {{target}}', scope: { include: ['{{target}}'] }, engines: [] }, { target: 'shop.example.com' });
  return (
    <Card title="Parameterized target variables" note="Idea 52966">
      <Kv k="Complete" v={String(v.complete)} />
      <Kv k="Vars" v={v.required.join(', ') || 'none'} />
      <div className="w75a-row"><Badge tone={v.complete ? 'ok' : 'warn'}>{v.complete ? 'resolved' : 'missing'}</Badge></div>
    </Card>
  );
}

export function SecretsPlaceholders() {
  const v = XA.redactTemplateSecrets({ id: 'tpl-x', config: 'api_key=sk-1234567890abcdef' }, {});
  return (
    <Card title="Secrets placeholders" note="Idea 52967">
      <Kv k="Safe" v={String(v.safe)} />
      <Kv k="Flagged" v={v.findingCount} />
      <div className="w75a-row"><Badge tone={v.safe ? 'ok' : 'danger'}>{v.safe ? 'clean' : 'flagged'}</Badge></div>
    </Card>
  );
}

export function TemplateApprovalWorkflow() {
  const v = XA.runTemplateApprovalWorkflow({ id: 'tpl-shop-baseline', approvalState: 'pending' }, { type: 'approve', role: 'lead' }, {});
  return (
    <Card title="Template approval workflow (post-hunt)" note="Idea 52968">
      <Kv k="From" v={v.from} />
      <Kv k="To" v={v.to} />
    </Card>
  );
}

export function TemplateDeprecation() {
  const v = XA.evaluateTemplateDeprecation(SAMPLE_TEMPLATE, { uses: 7, averageYield: 1.8, fpRate: 0.1 }, {});
  return (
    <Card title="Template deprecation (post-hunt)" note="Idea 52969">
      <Kv k="Deprecated" v={String(v.deprecated)} />
      <Kv k="Reasons" v={v.reasons.join(', ') || 'none'} />
    </Card>
  );
}

export function TemplateChangelog() {
  const v = XA.buildTemplateChangelog(SAMPLE_TEMPLATE, {});
  return (
    <Card title="Template changelog (post-hunt)" note="Idea 52970">
      <Kv k="Entries" v={v.entryCount} />
      <div className="w75a-note">{v.entries[0] ? `v${v.entries[0].version}` : 'none'}</div>
    </Card>
  );
}

export function TemplateDiffViewer() {
  const v = XA.diffTemplateVersions(SAMPLE_TEMPLATE, { ...SAMPLE_TEMPLATE, name: 'Shop baseline v2', scope: { include: ['shop.example.com', 'api.example.com', 'cdn.example.com'], exclude: [] } }, {});
  return (
    <Card title="Template diff viewer (post-hunt)" note="Idea 52971">
      <Kv k="Changes" v={v.changeCount} />
      <Kv k="Identical" v={String(v.identical)} />
    </Card>
  );
}

export function TemplateDryRunTest() {
  const v = XA.dryRunTemplate(SAMPLE_TEMPLATE, {});
  return (
    <Card title="Template dry-run test" note="Idea 52972">
      <Kv k="Verdict" v={v.verdict} />
      <Kv k="Checks" v={v.checks.length} />
      <div className="w75a-row"><Badge tone={v.verdict === 'pass' ? 'ok' : 'warn'}>{v.verdict}</Badge></div>
    </Card>
  );
}

export function TemplateCostEstimator() {
  const v = XA.estimateTemplateCost(SAMPLE_TEMPLATE, { targets: 2, depth: 'balanced' }, {});
  return (
    <Card title="Template cost estimator" note="Idea 52973">
      <Kv k="Minutes" v={v.estimatedMinutes} />
      <Kv k="Units" v={v.computeUnits} />
    </Card>
  );
}

export function VerticalSpecificTemplates() {
  const v = XA.filterVerticalTemplates([SAMPLE_TEMPLATE], 'retail', {});
  return (
    <Card title="Vertical-specific templates" note="Idea 52974">
      <Kv k="Matched" v={v.count} />
      <Kv k="Vertical" v={v.vertical || 'none'} />
    </Card>
  );
}

export function AssetTypeTemplates() {
  const v = XA.filterAssetTypeTemplates([SAMPLE_TEMPLATE], 'web', {});
  return (
    <Card title="Asset-type templates" note="Idea 52975">
      <Kv k="Matched" v={v.count} />
      <Kv k="Asset" v={v.assetType || 'none'} />
    </Card>
  );
}

export function BountyProgramTemplates() {
  const v = XA.buildBountyProgramTemplate({ name: 'Shop program', inScope: ['shop.example.com'], outOfScope: ['admin.example.com'], rewards: { min: 50, max: 5000 } }, {});
  return (
    <Card title="Bounty-program templates" note="Idea 52976">
      <Kv k="Template" v={v.templateId} />
      <Kv k="Scope" v={v.scopeCount} />
    </Card>
  );
}

export function RegressionTemplates() {
  const v = XA.buildRegressionTemplate({ huntId: 'hunt-42', findings: [{ id: 'f1', title: 'SQLi in checkout', severity: 'critical', target: 'shop.example.com/checkout' }] }, {});
  return (
    <Card title="Regression templates" note="Idea 52977">
      <Kv k="Checks" v={v.checkCount} />
      <Kv k="Template" v={v.templateId} />
    </Card>
  );
}

export function ComplianceAuditTemplates() {
  const v = XA.buildComplianceAuditTemplate({ name: 'PCI review', controls: ['access-control', 'logging'] }, {});
  return (
    <Card title="Compliance-audit templates" note="Idea 52978">
      <Kv k="Controls" v={v.controlCount} />
      <Kv k="Template" v={v.templateId} />
    </Card>
  );
}

export function TemplateNotificationDefaults() {
  const v = XA.resolveNotificationDefaults(SAMPLE_TEMPLATE, {}, {});
  return (
    <Card title="Template notification defaults" note="Idea 52979">
      <Kv k="Channels" v={v.channelCount} />
      <Kv k="On complete" v={String(v.notifications.onComplete)} />
    </Card>
  );
}

export function TemplateStakeholderViewDefaults() {
  const v = XA.resolveStakeholderViewDefaults(SAMPLE_TEMPLATE, {});
  return (
    <Card title="Template stakeholder-view defaults" note="Idea 52980">
      <Kv k="Views" v={v.viewCount} />
      <Kv k="First" v={v.views[0] ? v.views[0].audience : 'none'} />
      <div className="w75a-row"><Badge tone="info">{`checked ${NOW.slice(0, 10)}`}</Badge></div>
    </Card>
  );
}

/** Gallery list: all 20 idea-52961–52980 components, export-only. */
export const W75_A_GALLERY = [
  TemplateImportExport,
  AutoSuggestTemplateFromBestHunt,
  TemplateCategories,
  TemplateSearchAndTags,
  CrossTargetTemplateCloning,
  ParameterizedTargetVariables,
  SecretsPlaceholders,
  TemplateApprovalWorkflow,
  TemplateDeprecation,
  TemplateChangelog,
  TemplateDiffViewer,
  TemplateDryRunTest,
  TemplateCostEstimator,
  VerticalSpecificTemplates,
  AssetTypeTemplates,
  BountyProgramTemplates,
  RegressionTemplates,
  ComplianceAuditTemplates,
  TemplateNotificationDefaults,
  TemplateStakeholderViewDefaults,
];

/** Gallery: renders every Wave 75A component, export-only. */
export function Wave75AGallery() {
  return (
    <div className="w75a-gallery">
      {W75_A_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
