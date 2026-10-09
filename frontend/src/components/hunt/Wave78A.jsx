/**
 * Wave78A.jsx — Infinity AI · Dark-Matter · Wave 78
 * 20 working React components for stack-conditioned payload effectiveness round 3, ideas 53081–53100. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XA from './wave78ACore.js';

const SAMPLE_ATTEMPTS = [
  { family: 'sqli', kind: 'sqli', orm: 'sequelize', templateEngine: 'jinja2', templateVersion: '2.11', serializationLibrary: 'pickle', authStack: 'auth0', baas: 'firebase', firmwareBase: 'openwrt-22', ecommercePlatform: 'shopify', commercePlatform: 'shopify', rendered: true, requiresJs: true, renderMode: 'headless', protocol: 'HTTP/3', httpVersion: 'HTTP/3', timingMs: 320, wsServer: 'socket.io', websocketServer: 'socket.io', grpcFramework: 'grpc-go', reflection: true, platform: 'lambda', coldStartMs: 420, stackConfidence: 0.9, confidence: 0.9, paymentProvider: 'stripe', paymentStack: 'stripe', searchBackend: 'elasticsearch', searchEngine: 'elasticsearch', cache: 'redis', cacheLayer: 'redis', surface: 'main', queue: 'kafka', messageQueue: 'kafka', asyncFinding: true, success: true },
  { family: 'template', kind: 'ssti', orm: 'sequelize', templateEngine: 'jinja2', templateVersion: '2.11', serializationLibrary: 'pickle', authStack: 'auth0', baas: 'supabase', firmwareBase: 'openwrt-22', ecommercePlatform: 'shopify', commercePlatform: 'shopify', protocol: 'HTTP/2', httpVersion: 'HTTP/2', timingMs: 210, wsServer: 'socket.io', websocketServer: 'socket.io', grpcFramework: 'grpc-go', stackConfidence: 0.7, confidence: 0.7, paymentProvider: 'stripe', paymentStack: 'stripe', searchBackend: 'elasticsearch', searchEngine: 'elasticsearch', cache: 'redis', cacheLayer: 'redis', surface: 'main', queue: 'kafka', messageQueue: 'kafka', success: false, bypassSuccess: true },
  { family: 'deserialization', kind: 'deserialization', orm: 'eloquent', templateEngine: 'twig', templateVersion: '3', serializationLibrary: 'jackson', authStack: 'cognito', baas: 'appwrite', firmwareBase: 'yocto', ecommercePlatform: 'magento', commercePlatform: 'magento', protocol: 'HTTP/1.1', httpVersion: 'HTTP/1.1', timingMs: 180, wsServer: 'ws', websocketServer: 'ws', grpcFramework: 'grpc-java', stackConfidence: 0.5, confidence: 0.5, paymentProvider: 'adyen', paymentStack: 'adyen', searchBackend: 'algolia', searchEngine: 'algolia', surface: 'cicd', queue: 'rabbitmq', messageQueue: 'rabbitmq', success: true },
  { family: 'auth', kind: 'auth', orm: 'hibernate', templateEngine: 'thymeleaf', templateVersion: '3', serializationLibrary: 'jackson', serializationLib: 'jackson', authStack: 'keycloak', identityStack: 'keycloak', baas: 'firebase', firmwareBase: 'yocto', ecommercePlatform: 'woocommerce', commercePlatform: 'woocommerce', rendered: true, protocol: 'HTTP/3', timingMs: 300, wsServer: 'django-channels', grpcFramework: 'grpc-java', reflection: true, stackConfidence: 0.8, paymentProvider: 'razorpay', searchBackend: 'solr', cache: 'varnish', surface: 'main', queue: 'sqs', success: true },
];
const SAMPLE_QUEUE_RECORDS = [
  { queue: 'kafka', messageQueue: 'kafka', attempts: 10, asyncFindings: 4, findings: 6 },
  { queue: 'rabbitmq', messageQueue: 'rabbitmq', attempts: 10, asyncFindings: 2, findings: 5 },
  { queue: 'sqs', messageQueue: 'sqs', attempts: 5, asyncFindings: 1, findings: 2 },
];
const SAMPLE_TIMING = [
  { platform: 'lambda', serverlessPlatform: 'lambda', coldStartMs: 420, timingMs: 420 },
  { platform: 'lambda', serverlessPlatform: 'lambda', coldStartMs: 500, timingMs: 500 },
  { platform: 'cloud-run', serverlessPlatform: 'cloud-run', coldStartMs: 250, timingMs: 250 },
];
const SAMPLE_STACKS = [
  { stack: 'legacy-php-5', name: 'legacy-php-5', version: '5.6', endOfLife: true, eol: true, dataAgeDays: 120, dataPoints: 40 },
  { stack: 'node-20', name: 'node-20', version: '20', dataAgeDays: 10, dataPoints: 80 },
];
const SAMPLE_MIGRATIONS = [
  { target: 'shop.example.com', fromStack: 'php-7', toStack: 'node-20', before: [{ success: true }, { success: false }], after: [{ success: true }, { success: true }] },
  { target: 'api.example.com', fromStack: 'java-11', toStack: 'java-21', beforeRate: 0.5, afterRate: 0.4 },
];

function Card({ title, note, children }) {
  return (
    <div className="w78a-card">
      <div className="w78a-title">{title}</div>
      {note ? <div className="w78a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w78a-badge w78a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w78a-kv">
      <span className="w78a-k">{k}</span>
      <span className="w78a-v">{String(v)}</span>
    </div>
  );
}

export function OrmLayerAttribution() {
  const v = XA.attributeOrmLayer(SAMPLE_ATTEMPTS);
  return (<Card title="ORM-Layer Attribution" note="Idea 53081"><Kv k="ORM layers" v={v.count} /><Kv k="Best" v={v.best ? v.best.key : 'none'} /><div className="w78a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function TemplateEngineMapping() {
  const v = XA.mapTemplateEngine(SAMPLE_ATTEMPTS);
  return (<Card title="Template Engine Mapping" note="Idea 53082"><Kv k="Groups" v={v.count} /><Kv k="Attempts" v={v.templateAttempts} /><div className="w78a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function SerializationLibraryTracking() {
  const v = XA.trackSerializationLibrary(SAMPLE_ATTEMPTS);
  return (<Card title="Serialization Library Tracking" note="Idea 53083"><Kv k="Libraries" v={v.count} /><Kv k="Probes" v={v.serializationAttempts} /><div className="w78a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function AuthenticationStackConditioning() {
  const v = XA.conditionAuthStackScores(SAMPLE_ATTEMPTS);
  return (<Card title="Authentication Stack Conditioning" note="Idea 53084"><Kv k="Identity stacks" v={v.count} /><Kv k="Best" v={v.best ? v.best.key : 'none'} /><div className="w78a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function PaymentStackPayloadProfiles() {
  const v = XA.buildPaymentStackPayloadProfiles(SAMPLE_ATTEMPTS);
  return (<Card title="Payment Stack Payload Profiles" note="Idea 53085"><Kv k="Payment stacks" v={v.count} /><Kv k="Attempts" v={v.paymentAttempts} /><div className="w78a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function SearchEngineBackendSplit() {
  const v = XA.splitSearchEngineBackend(SAMPLE_ATTEMPTS);
  return (<Card title="Search Engine Backend Split" note="Idea 53086"><Kv k="Backends" v={v.count} /><Kv k="Best" v={v.best ? v.best.key : 'none'} /><div className="w78a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function MessageQueueInfluence() {
  const v = XA.recordMessageQueueInfluence(SAMPLE_QUEUE_RECORDS);
  return (<Card title="Message Queue Influence" note="Idea 53087"><Kv k="Queues" v={v.count} /><Kv k="Best" v={v.best ? v.best.key : 'none'} /><div className="w78a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function CacheLayerMaskingDetection() {
  const v = XA.detectCacheLayerMasking(SAMPLE_ATTEMPTS);
  return (<Card title="Cache Layer Masking Detection" note="Idea 53088"><Kv k="Masked" v={v.maskedCount} /><Kv k="Cached attempts" v={v.cachedAttempts} /><div className="w78a-row"><Badge tone="warn">Infinity AI</Badge></div></Card>);
}

export function CicdExposedSurfaceTracking() {
  const v = XA.trackCicdExposedSurface(SAMPLE_ATTEMPTS);
  return (<Card title="CI/CD-Exposed Surface Tracking" note="Idea 53089"><Kv k="CI/CD attempts" v={v.cicdAttempts} /><Kv k="CI/CD rate" v={v.cicdRate} /><div className="w78a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function MobileBackendBaasProfiles() {
  const v = XA.buildMobileBackendProfiles(SAMPLE_ATTEMPTS);
  return (<Card title="Mobile Backend (BaaS) Profiles" note="Idea 53090"><Kv k="Providers" v={v.count} /><Kv k="Attempts" v={v.baasAttempts} /><div className="w78a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function IotFirmwareStackLedger() {
  const v = XA.buildIotFirmwareStackLedger(SAMPLE_ATTEMPTS);
  return (<Card title="IoT Firmware Stack Ledger" note="Idea 53091"><Kv k="Firmware bases" v={v.count} /><Kv k="Attempts" v={v.firmwareAttempts} /><div className="w78a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function EcommercePlatformMatrix() {
  const v = XA.buildEcommercePlatformMatrix(SAMPLE_ATTEMPTS);
  return (<Card title="E-commerce Platform Matrix" note="Idea 53092"><Kv k="Cells" v={v.cellCount} /><Kv k="Platforms" v={v.platformCount} /><div className="w78a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function HeadlessBrowserRenderingEffects() {
  const v = XA.measureHeadlessBrowserRenderingEffects(SAMPLE_ATTEMPTS);
  return (<Card title="Headless Browser Rendering Effects" note="Idea 53093"><Kv k="Rendered rate" v={v.renderedRate} /><Kv k="Delta" v={v.delta} /><div className="w78a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function Http3AndQuicVariance() {
  const v = XA.trackHttp3QuicVariance(SAMPLE_ATTEMPTS);
  return (<Card title="HTTP/3 and QUIC Variance" note="Idea 53094"><Kv k="Protocols" v={v.count} /><Kv k="Timing delta ms" v={v.timingDeltaMs} /><div className="w78a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function WebSocketServerImplementationSplit() {
  const v = XA.splitWebSocketServerImplementation(SAMPLE_ATTEMPTS);
  return (<Card title="WebSocket Server Implementation Split" note="Idea 53095"><Kv k="Implementations" v={v.count} /><Kv k="Attempts" v={v.websocketAttempts} /><div className="w78a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function GrpcFrameworkConditioning() {
  const v = XA.conditionGrpcFramework(SAMPLE_ATTEMPTS);
  return (<Card title="gRPC Framework Conditioning" note="Idea 53096"><Kv k="Groups" v={v.count} /><Kv k="Probes" v={v.grpcAttempts} /><div className="w78a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ServerlessColdStartTimingProfiles() {
  const v = XA.buildServerlessColdStartTimingProfiles(SAMPLE_TIMING);
  return (<Card title="Serverless Cold-Start Timing Profiles" note="Idea 53097"><Kv k="Platforms" v={v.count} /><Kv k="Fastest" v={v.fastest ? v.fastest.key : 'none'} /><div className="w78a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function StackConfidenceWeighting() {
  const v = XA.weightStackConfidence(SAMPLE_ATTEMPTS);
  return (<Card title="Stack Confidence Weighting" note="Idea 53098"><Kv k="Stacks" v={v.count} /><Kv k="Total weight" v={v.totalWeight} /><div className="w78a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function DeprecatedStackSunsetAlerts() {
  const v = XA.alertDeprecatedStackSunset(SAMPLE_STACKS);
  return (<Card title="Deprecated Stack Sunset Alerts" note="Idea 53099"><Kv k="Alerts" v={v.alertCount} /><Kv k="Stacks" v={v.count} /><div className="w78a-row"><Badge tone="warn">Infinity AI</Badge></div></Card>);
}

export function StackMigrationImpactNotes() {
  const v = XA.noteStackMigrationImpact(SAMPLE_MIGRATIONS);
  return (<Card title="Stack Migration Impact Notes" note="Idea 53100"><Kv k="Migrations" v={v.count} /><Kv k="Improved" v={v.improvedCount} /><div className="w78a-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

const W78_A_GALLERY = [
  OrmLayerAttribution,
  TemplateEngineMapping,
  SerializationLibraryTracking,
  AuthenticationStackConditioning,
  PaymentStackPayloadProfiles,
  SearchEngineBackendSplit,
  MessageQueueInfluence,
  CacheLayerMaskingDetection,
  CicdExposedSurfaceTracking,
  MobileBackendBaasProfiles,
  IotFirmwareStackLedger,
  EcommercePlatformMatrix,
  HeadlessBrowserRenderingEffects,
  Http3AndQuicVariance,
  WebSocketServerImplementationSplit,
  GrpcFrameworkConditioning,
  ServerlessColdStartTimingProfiles,
  StackConfidenceWeighting,
  DeprecatedStackSunsetAlerts,
  StackMigrationImpactNotes,
];

/** Gallery: renders every Wave 78A component, export-only. */
export function Wave78AGallery() {
  return (
    <div className="w78a-gallery">
      {W78_A_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
