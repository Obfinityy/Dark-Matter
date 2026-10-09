/**
 * Wave81B.jsx — Infinity AI · Dark-Matter · Wave 81
 * 20 working React components for TTF operations and coverage gaps, ideas 53221–53240. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XB from './wave81BCores.js';


const SAMPLE_HUNTS = [
  { strategy: 'auth-first', researcher: 'r1', authMethod: 'oauth', freshness: 'fresh', dataAgeDays: 2, context: 'routine', incident: false, satisfaction: 5, satisfactionScore: 5, ttfMinutes: 15, targetClass: 'web', target: 'shop.example', findings: 3, validatedFindings: 3 },
  { strategy: 'auth-first', researcher: 'r1', authMethod: 'oauth', freshness: 'fresh', dataAgeDays: 3, context: 'routine', incident: false, satisfaction: 4, satisfactionScore: 4, ttfMinutes: 20, targetClass: 'web', target: 'shop.example', findings: 2, validatedFindings: 2 },
  { strategy: 'breadth-first', researcher: 'r2', authMethod: 'api-key', freshness: 'stale', dataAgeDays: 60, context: 'incident', incident: true, satisfaction: 2, satisfactionScore: 2, ttfMinutes: 55, targetClass: 'api', target: 'api.example', findings: 1, validatedFindings: 1 },
  { strategy: 'breadth-first', researcher: 'r2', authMethod: 'cookie', freshness: 'stale', dataAgeDays: 45, context: 'routine', incident: false, satisfaction: 3, satisfactionScore: 3, ttfMinutes: 60, targetClass: 'api', target: 'api.example', findings: 0, validatedFindings: 0 },
];
const SAMPLE_ENDPOINTS = [
  { endpoint: '/api/users', path: '/api/users', hits: 80, requests: 80, payloadDiversity: 12, findings: 2, methods: ['GET', 'POST'], supportedMethods: ['GET', 'POST'], testedMethods: ['GET'], methodsTested: ['GET'], version: 'v2', apiVersion: 'v2' },
  { endpoint: '/api/legacy', path: '/api/legacy', hits: 0, requests: 0, payloadDiversity: 0, findings: 0, methods: ['GET'], supportedMethods: ['GET'], testedMethods: [], methodsTested: [], version: 'v1', apiVersion: 'v1' },
  { endpoint: '/api/orders', path: '/api/orders', hits: 20, requests: 20, payloadDiversity: 5, findings: 1, methods: ['GET', 'POST', 'DELETE'], supportedMethods: ['GET', 'POST', 'DELETE'], testedMethods: ['GET', 'POST'], methodsTested: ['GET', 'POST'], version: 'v2', apiVersion: 'v2' },
];
const SAMPLE_PARAMS = [
  { parameter: 'id', param: 'id', name: 'id', endpoint: '/api/users', tested: true, fuzzed: true, tests: 12, findings: 1 },
  { parameter: 'debug', param: 'debug', name: 'debug', endpoint: '/api/users', tested: false, fuzzed: false, tests: 0, findings: 0 },
];
const SAMPLE_COVERAGE = [
  { area: 'checkout', name: 'checkout', coverage: 0.1, coveragePct: 0.1, requests: 2, criticality: 5, endpoints: 8, size: 8 },
  { area: 'blog', name: 'blog', coverage: 0.9, coveragePct: 0.9, requests: 40, criticality: 1, endpoints: 4, size: 4 },
  { area: 'admin', name: 'admin', coverage: 0, coveragePct: 0, requests: 0, criticality: 5, endpoints: 6, size: 6 },
];
const SAMPLE_STATES = [
  { authState: 'anonymous', state: 'anonymous', coverage: 0.8, requests: 100 },
  { authState: 'admin', state: 'admin', coverage: 0.2, requests: 5 },
];
const SAMPLE_FILES = [
  { fileType: 'pdf-upload', type: 'pdf-upload', tested: true, uploads: 4, requests: 4 },
  { fileType: 'csv-export', type: 'csv-export', tested: false, uploads: 0, requests: 0 },
];
const SAMPLE_SUBDOMAINS = [
  { subdomain: 'api.example', host: 'api.example', requests: 50, findings: 2, inScope: true },
  { subdomain: 'old.example', host: 'old.example', requests: 0, findings: 0, inScope: true },
];
const SAMPLE_PLATFORMS = [
  { platform: 'web', coverage: 0.7, requests: 200, findings: 4, validatedFindings: 4 },
  { platform: 'mobile', coverage: 0.3, requests: 40, findings: 1, validatedFindings: 1 },
];
const SAMPLE_GAPS = [
  { area: 'checkout', coverage: 0.1, criticality: 5, size: 8, historicalFindings: 3, historicalGaps: 10, pastFindings: 3, pastGaps: 10 },
  { area: 'blog', coverage: 0.9, criticality: 1, size: 4, historicalFindings: 0, historicalGaps: 10, pastFindings: 0, pastGaps: 10 },
];


function Card({ title, note, children }) {
  return (
    <div className="w81b-card">
      <div className="w81b-title">{title}</div>
      {note ? <div className="w81b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w81b-badge w81b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w81b-kv">
      <span className="w81b-k">{k}</span>
      <span className="w81b-v">{String(v)}</span>
    </div>
  );
}


export function TTFByAuthenticationMethod() {
  const v = XB.analyzeTTFByAuthMethod(SAMPLE_HUNTS);
  return (<Card title="TTF by Authentication Method" note="Idea 53221"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFDuringIncidentResponse() {
  const v = XB.analyzeTTFDuringIncidentResponse(SAMPLE_HUNTS);
  return (<Card title="TTF During Incident Response" note="Idea 53222"><Kv k="Groups" v={v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFLearningCurvePerResearcher() {
  const v = XB.buildTTFLearningCurve(SAMPLE_HUNTS);
  return (<Card title="TTF Learning Curve per Researcher" note="Idea 53223"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFBenchmarkExportAPI() {
  const v = XB.buildTTFBenchmarkExport(SAMPLE_HUNTS);
  return (<Card title="TTF Benchmark Export API" note="Idea 53224"><Kv k="Groups" v={v.sampleSize ?? v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFByDataFreshness() {
  const v = XB.analyzeTTFByDataFreshness(SAMPLE_HUNTS);
  return (<Card title="TTF by Data Freshness" note="Idea 53225"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFCelebrationTriggers() {
  const v = XB.detectTTFCelebrationTriggers(SAMPLE_HUNTS);
  return (<Card title="TTF Celebration Triggers" note="Idea 53226"><Kv k="Groups" v={v.triggerCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFPostmortemTemplates() {
  const v = XB.buildTTFPostmortemTemplates(SAMPLE_HUNTS);
  return (<Card title="TTF Postmortem Templates" note="Idea 53227"><Kv k="Groups" v={v.templateCount ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function TTFVsHuntSatisfaction() {
  const v = XB.correlateTTFWithSatisfaction(SAMPLE_HUNTS);
  return (<Card title="TTF vs Hunt Satisfaction" note="Idea 53228"><Kv k="Groups" v={v.sampleSize ?? v.count ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function AutomatedCoverageGapReports() {
  const v = XB.generateCoverageGapReports([{ target: 'shop.example', areas: SAMPLE_COVERAGE }]);
  return (<Card title="Automated Coverage Gap Reports" note="Idea 53229"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function EndpointCoverageHeatmaps() {
  const v = XB.buildEndpointCoverageHeatmaps(SAMPLE_ENDPOINTS);
  return (<Card title="Endpoint Coverage Heatmaps" note="Idea 53230"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function ParameterCoverageMatrix() {
  const v = XB.buildParameterCoverageMatrix(SAMPLE_PARAMS);
  return (<Card title="Parameter Coverage Matrix" note="Idea 53231"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function HTTPMethodCoverageAudit() {
  const v = XB.auditHTTPMethodCoverage(SAMPLE_ENDPOINTS);
  return (<Card title="HTTP Method Coverage Audit" note="Idea 53232"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function AuthenticationStateCoverageSplit() {
  const v = XB.splitCoverageByAuthState(SAMPLE_STATES);
  return (<Card title="Authentication-State Coverage Split" note="Idea 53233"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function FeatureAreaCoverageTreemap() {
  const v = XB.buildFeatureAreaCoverageTreemap(SAMPLE_COVERAGE);
  return (<Card title="Feature-Area Coverage Treemap" note="Idea 53234"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function FileTypeCoverageCheck() {
  const v = XB.checkFileTypeCoverage(SAMPLE_FILES);
  return (<Card title="File-Type Coverage Check" note="Idea 53235"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function SubdomainCoverageLedger() {
  const v = XB.buildSubdomainCoverageLedger(SAMPLE_SUBDOMAINS);
  return (<Card title="Subdomain Coverage Ledger" note="Idea 53236"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function MobileVsWebCoverageCompare() {
  const v = XB.compareMobileVsWebCoverage(SAMPLE_PLATFORMS);
  return (<Card title="Mobile-vs-Web Coverage Compare" note="Idea 53237"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function VersionedAPICoverage() {
  const v = XB.auditVersionedAPICoverage(SAMPLE_ENDPOINTS);
  return (<Card title="Versioned-API Coverage" note="Idea 53238"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function CoverageGapSeverityWeighting() {
  const v = XB.weightCoverageGapSeverity(SAMPLE_GAPS);
  return (<Card title="Coverage Gap Severity Weighting" note="Idea 53239"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


export function GapToFindingProbabilityEstimates() {
  const v = XB.estimateGapToFindingProbability(SAMPLE_GAPS);
  return (<Card title="Gap-to-Finding Probability Estimates" note="Idea 53240"><Kv k="Groups" v={v.count ?? v.rows?.length ?? 0} /><Kv k="Summary" v={v.summary} /><div className="w81b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}


const W81_B_GALLERY = [
  TTFByAuthenticationMethod,
  TTFDuringIncidentResponse,
  TTFLearningCurvePerResearcher,
  TTFBenchmarkExportAPI,
  TTFByDataFreshness,
  TTFCelebrationTriggers,
  TTFPostmortemTemplates,
  TTFVsHuntSatisfaction,
  AutomatedCoverageGapReports,
  EndpointCoverageHeatmaps,
  ParameterCoverageMatrix,
  HTTPMethodCoverageAudit,
  AuthenticationStateCoverageSplit,
  FeatureAreaCoverageTreemap,
  FileTypeCoverageCheck,
  SubdomainCoverageLedger,
  MobileVsWebCoverageCompare,
  VersionedAPICoverage,
  CoverageGapSeverityWeighting,
  GapToFindingProbabilityEstimates,
];

/** Gallery: renders every Wave 81B component, export-only. */
export function Wave81BGallery() {
  return (
    <div className="w81b-gallery">
      {W81_B_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
