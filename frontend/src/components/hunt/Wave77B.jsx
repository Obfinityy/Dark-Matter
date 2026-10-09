/**
 * Wave77B.jsx — Infinity AI · Dark-Matter · Wave 77
 * 20 working React components for stack-conditioned payload effectiveness, ideas 53061–53080. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XB from './wave77BCores.js';

const SAMPLE_ATTEMPTS = [
  { family: 'sqli', kind: 'sqli', stack: 'php-laravel', framework: 'Laravel', frameworkVersion: '11', version: '11', plugin: 'WooCommerce', pluginVersion: '8.0', waf: 'cloudflare', runtime: 'php', language: 'php', database: 'mysql', db: 'mysql', cloud: 'aws', provider: 'aws', cdn: true, viaCdn: true, proxy: 'nginx', appServer: 'php-fpm', gateway: 'kong', orchestration: 'kubernetes', platform: 'kubernetes', stackAgeMonths: 3, component: 'openssl', patchLevel: '3.0', patch: '3.0', tenant: 't1', edge: true, graphqlEngine: 'apollo', spa: 'react', cmsMode: 'headless', combo: 'php-laravel + mysql', success: true },
  { family: 'sqli', kind: 'sqli', stack: 'php-laravel', framework: 'Laravel', frameworkVersion: '11', version: '11', plugin: 'WooCommerce', pluginVersion: '8.0', waf: 'cloudflare', runtime: 'php', language: 'php', database: 'mysql', db: 'mysql', cloud: 'aws', provider: 'aws', cdn: true, viaCdn: true, proxy: 'nginx', appServer: 'php-fpm', gateway: 'kong', orchestration: 'kubernetes', platform: 'kubernetes', stackAgeMonths: 8, component: 'openssl', patchLevel: '3.0', patch: '3.0', tenant: 't1', success: false },
  { family: 'xss', kind: 'xss', stack: 'node-express', framework: 'Express', frameworkVersion: '4', version: '4', plugin: 'WooCommerce', pluginVersion: '7.0', waf: 'none', runtime: 'node', language: 'node', database: 'postgres', db: 'postgres', cloud: 'gcp', provider: 'gcp', proxy: 'caddy', appServer: 'node', gateway: 'apigee', orchestration: 'serverless', platform: 'serverless', stackAgeMonths: 30, component: 'openssl', patchLevel: '1.1.1', patch: '1.1.1', tenant: 't2', graphqlEngine: 'hasura', spa: 'vue', success: true },
  { family: 'dom', kind: 'dom', stack: 'node-express', framework: 'Express', frameworkVersion: '4', version: '4', waf: 'none', runtime: 'node', language: 'node', cloud: 'azure', provider: 'azure', proxy: 'caddy', appServer: 'node', gateway: 'apigee', orchestration: 'serverless', platform: 'serverless', stackAgeMonths: 30, component: 'openssl', patchLevel: '1.1.1', patch: '1.1.1', tenant: 't2', spa: 'vue', success: true },
];
const SAMPLE_SNAPSHOTS = [
  { at: '2026-10-08T00:00:00Z', headers: { server: 'nginx', 'x-powered-by': 'Express' } },
  { at: '2026-10-09T00:00:00Z', headers: { server: 'apache', 'x-powered-by': 'Express' } },
];

function Card({ title, note, children }) {
  return (
    <div className="w77b-card">
      <div className="w77b-title">{title}</div>
      {note ? <div className="w77b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w77b-badge w77b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w77b-kv">
      <span className="w77b-k">{k}</span>
      <span className="w77b-v">{String(v)}</span>
    </div>
  );
}

export function StackSpecificHitRateMatrix() {
  const v = XB.buildStackHitRateMatrix(SAMPLE_ATTEMPTS);
  return (
    <Card title="Stack-Specific Hit-Rate Matrix" note="Idea 53061">
      <Kv k="Cells" v={v.cellCount} />
      <Kv k="Best cell" v={v.bestCell ? v.bestCell.key : 'none'} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function FrameworkVersionSensitivityTracking() {
  const v = XB.trackFrameworkVersionSensitivity(SAMPLE_ATTEMPTS);
  return (
    <Card title="Framework Version Sensitivity Tracking" note="Idea 53062">
      <Kv k="Groups" v={v.count} />
      <Kv k="Version-dead" v={v.deadCount} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function CmsPluginPayloadLedger() {
  const v = XB.buildCmsPluginPayloadLedger(SAMPLE_ATTEMPTS);
  return (
    <Card title="CMS Plugin Payload Ledger" note="Idea 53063">
      <Kv k="Groups" v={v.count} />
      <Kv k="Proven" v={v.provenCount} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function WafFingerprintConditionedScores() {
  const v = XB.scoreWafConditionedPayloads(SAMPLE_ATTEMPTS);
  return (
    <Card title="WAF-Fingerprint-Conditioned Scores" note="Idea 53064">
      <Kv k="Groups" v={v.count} />
      <Kv k="Best" v={v.best ? v.best.key : 'none'} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function LanguageRuntimeEffectivenessSplit() {
  const v = XB.splitLanguageRuntimeEffectiveness(SAMPLE_ATTEMPTS);
  return (
    <Card title="Language-Runtime Effectiveness Split" note="Idea 53065">
      <Kv k="Runtimes" v={v.count} />
      <Kv k="Best" v={v.best ? v.best.key : 'none'} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function DatabaseBackendCorrelation() {
  const v = XB.correlateDatabaseBackend(SAMPLE_ATTEMPTS);
  return (
    <Card title="Database-Backend Correlation" note="Idea 53066">
      <Kv k="Backends" v={v.count} />
      <Kv k="Injection attempts" v={v.injectionAttempts} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function CloudProviderPayloadVariance() {
  const v = XB.compareCloudProviderVariance(SAMPLE_ATTEMPTS);
  return (
    <Card title="Cloud-Provider Payload Variance" note="Idea 53067">
      <Kv k="Providers" v={v.count} />
      <Kv k="Spread" v={v.spread} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function CdnLayerImpactAnalysis() {
  const v = XB.analyzeCdnLayerImpact(SAMPLE_ATTEMPTS);
  return (
    <Card title="CDN Layer Impact Analysis" note="Idea 53068">
      <Kv k="CDN rate" v={v.cdnRate} />
      <Kv k="Delta" v={v.delta} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function ServerHeaderEvolutionTracking() {
  const v = XB.trackServerHeaderEvolution(SAMPLE_SNAPSHOTS);
  return (
    <Card title="Server Header Evolution Tracking" note="Idea 53069">
      <Kv k="Snapshots" v={v.snapshots} />
      <Kv k="Changes" v={v.changeCount} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function MiddlewareStackFingerprintScoring() {
  const v = XB.scoreMiddlewareStackFingerprint(SAMPLE_ATTEMPTS);
  return (
    <Card title="Middleware Stack Fingerprint Scoring" note="Idea 53070">
      <Kv k="Stacks" v={v.count} />
      <Kv k="Best" v={v.best ? v.best.key : 'none'} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function HeadlessVsTraditionalCmsSplit() {
  const v = XB.splitHeadlessVsTraditionalCms(SAMPLE_ATTEMPTS);
  return (
    <Card title="Headless-vs-Traditional CMS Split" note="Idea 53071">
      <Kv k="Headless rate" v={v.headlessRate} />
      <Kv k="Traditional rate" v={v.traditionalRate} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function SpaFrameworkPayloadProfiles() {
  const v = XB.buildSpaFrameworkPayloadProfiles(SAMPLE_ATTEMPTS);
  return (
    <Card title="SPA Framework Payload Profiles" note="Idea 53072">
      <Kv k="Frameworks" v={v.count} />
      <Kv k="Client attempts" v={v.clientAttempts} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function ApiGatewayConditioning() {
  const v = XB.conditionApiGatewayScores(SAMPLE_ATTEMPTS);
  return (
    <Card title="API Gateway Conditioning" note="Idea 53073">
      <Kv k="Gateways" v={v.count} />
      <Kv k="Best" v={v.best ? v.best.key : 'none'} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function ContainerOrchestrationSignals() {
  const v = XB.recordContainerOrchestrationSignals(SAMPLE_ATTEMPTS);
  return (
    <Card title="Container Orchestration Signals" note="Idea 53074">
      <Kv k="Types" v={v.count} />
      <Kv k="Best" v={v.best ? v.best.key : 'none'} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function LegacyStackDecayCurves() {
  const v = XB.curveLegacyStackDecay(SAMPLE_ATTEMPTS);
  return (
    <Card title="Legacy Stack Decay Curves" note="Idea 53075">
      <Kv k="Buckets" v={v.count} />
      <Kv k="First bucket" v={v.rows.length ? v.rows[0].bucket : 'none'} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function StackComboRarityIndex() {
  const v = XB.indexStackComboRarity(SAMPLE_ATTEMPTS);
  return (
    <Card title="Stack Combo Rarity Index" note="Idea 53076">
      <Kv k="Combos" v={v.count} />
      <Kv k="Rarest" v={v.rarest ? v.rarest.combo : 'none'} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function PatchLevelGranularityTracking() {
  const v = XB.trackPatchLevelGranularity(SAMPLE_ATTEMPTS);
  return (
    <Card title="Patch-Level Granularity Tracking" note="Idea 53077">
      <Kv k="Groups" v={v.count} />
      <Kv k="Killed" v={v.killedCount} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function MultiTenantSaasNormalization() {
  const v = XB.normalizeMultiTenantSaaS(SAMPLE_ATTEMPTS);
  return (
    <Card title="Multi-Tenant SaaS Normalization" note="Idea 53078">
      <Kv k="Tenants" v={v.count} />
      <Kv k="Global rate" v={v.globalRate} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function EdgeComputePayloadBehavior() {
  const v = XB.trackEdgeComputePayloadBehavior(SAMPLE_ATTEMPTS);
  return (
    <Card title="Edge Compute Payload Behavior" note="Idea 53079">
      <Kv k="Edge rate" v={v.edgeRate} />
      <Kv k="Origin rate" v={v.originRate} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export function GraphqlEngineSpecificity() {
  const v = XB.splitGraphqlEngineSpecificity(SAMPLE_ATTEMPTS);
  return (
    <Card title="GraphQL Engine Specificity" note="Idea 53080">
      <Kv k="Engines" v={v.count} />
      <Kv k="GraphQL attempts" v={v.graphqlAttempts} />
      <div className="w77b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

const W77_B_GALLERY = [
  StackSpecificHitRateMatrix,
  FrameworkVersionSensitivityTracking,
  CmsPluginPayloadLedger,
  WafFingerprintConditionedScores,
  LanguageRuntimeEffectivenessSplit,
  DatabaseBackendCorrelation,
  CloudProviderPayloadVariance,
  CdnLayerImpactAnalysis,
  ServerHeaderEvolutionTracking,
  MiddlewareStackFingerprintScoring,
  HeadlessVsTraditionalCmsSplit,
  SpaFrameworkPayloadProfiles,
  ApiGatewayConditioning,
  ContainerOrchestrationSignals,
  LegacyStackDecayCurves,
  StackComboRarityIndex,
  PatchLevelGranularityTracking,
  MultiTenantSaasNormalization,
  EdgeComputePayloadBehavior,
  GraphqlEngineSpecificity,
];

/** Gallery: renders every Wave 77B component, export-only. */
export function Wave77BGallery() {
  return (
    <div className="w77b-gallery">
      {W77_B_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
