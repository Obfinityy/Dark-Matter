/**
 * Wave102B.jsx — Infinity AI · Wave 102
 * 20 working React components for wave 102, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useMemo, useState } from 'react';
import * as X102B from './wave102BCores.js';

function Card({ title, note, children }) {
  return (
    <div className="w102b-card">
      <div className="w102b-title">{title}</div>
      {note ? <div className="w102b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w102b-badge w102b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w102b-kv">
      <span className="w102b-k">{k}</span>
      <span className="w102b-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w102b-bar-row">
      <span className="w102b-k">{label}</span>
      <div className="w102b-bar"><div className="w102b-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w102b-v">{value}</span>
    </div>
  );
}

export function HttpMethodScoping() {
  const data = [{ method: 'GET', allowedMethods: ['GET', 'POST'] }, { method: 'DELETE', allowedMethods: ['GET', 'POST'] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.matchHttpMethodScope(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="HttpMethodScoping" note="Idea 54061">
      <Kv k="Result" v={v.matchedCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function VisualScopeTree() {
  const data = [{ target: 'shop', rules: [{ pattern: '*.example.com', pathPrefix: '/', methods: ['GET'] }, { pattern: 'api.example.com', pathPrefix: '/v1', methods: ['GET', 'POST'] }] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.buildVisualScopeTree(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="VisualScopeTree" note="Idea 54062">
      <Kv k="Result" v={v.treedCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function IsThisUrlInScopeTester() {
  const data = [{ url: 'https://api.example.com/v1/users', method: 'GET', rules: [{ id: 'r1', pattern: '*.example.com', pathPrefix: '/v1', methods: ['GET'], type: 'include' }] }, { url: 'https://api.example.com/admin', method: 'GET', rules: [{ id: 'r1', pattern: '*.example.com', pathPrefix: '/v1', methods: ['GET'], type: 'include' }] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.testUrlInScope(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="IsThisUrlInScopeTester" note="Idea 54063">
      <Kv k="Result" v={v.inScopeCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function WildcardExpansionPreview() {
  const data = [{ pattern: '*.example.com', knownSubdomains: ['api.example.com', 'web.example.com', 'other.org'] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.previewWildcardExpansion(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="WildcardExpansionPreview" note="Idea 54064">
      <Kv k="Result" v={v.totalCovered} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function OverbroadWildcardWarnings() {
  const data = [{ pattern: '*' }, { pattern: '*.example.com' }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.warnOverbroadWildcard(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="OverbroadWildcardWarnings" note="Idea 54065">
      <Kv k="Result" v={v.dangerousCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function ExclusionReasonCodes() {
  const data = [{ pattern: '*.example.com', pathPrefix: '/logout', reasonCode: 'DESTRUCTIVE' }, { pattern: '*.example.com', pathPrefix: '/pay', reasonCode: '' }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.enforceExclusionReasonCodes(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ExclusionReasonCodes" note="Idea 54066">
      <Kv k="Result" v={v.enforcedCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function ExclusionTemplatesLibrary() {
  const data = [{ templateId: 'tpl-logout' }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.getExclusionTemplates(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ExclusionTemplatesLibrary" note="Idea 54067">
      <Kv k="Result" v={v.count} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function ScopeSyntaxValidator() {
  const data = [{ pattern: '*.example.com', pathPrefix: '/v1', methods: ['GET'] }, { pattern: 'https://bad host', pathPrefix: 'v1', methods: ['FETCH'] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.validateScopeSyntax(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScopeSyntaxValidator" note="Idea 54068">
      <Kv k="Result" v={v.validCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function ScopeRuleDragDropReorder() {
  const data = [{ target: 'shop', rules: [{ id: 'r1', pattern: '*.example.com', pathPrefix: '/', methods: ['GET'], type: 'include' }, { id: 'r2', pattern: '*.example.com', pathPrefix: '/logout', methods: ['*'], type: 'exclude' }], order: ['r2', 'r1'] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.reorderScopeRules(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScopeRuleDragDropReorder" note="Idea 54069">
      <Kv k="Result" v={v.totalRules} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function RuleShadowingIndicator() {
  const data = [{ target: 'shop', rules: [{ id: 'r1', pattern: '*.example.com', pathPrefix: '/', methods: ['*'], type: 'include' }, { id: 'r2', pattern: '*.example.com', pathPrefix: '/', methods: ['*'], type: 'include' }] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.detectRuleShadowing(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="RuleShadowingIndicator" note="Idea 54070">
      <Kv k="Result" v={v.totalFindings} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function ScopeVersionHistory() {
  const data = [{ target: 'shop', versions: [{ version: 1, author: 'ana', timestamp: '2026-10-01T10:00:00Z', summary: 'Initial scope', rules: [] }, { version: 2, author: 'bob', timestamp: '2026-10-05T10:00:00Z', summary: 'Added api host', rules: [] }] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.keepScopeVersionHistory(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScopeVersionHistory" note="Idea 54071">
      <Kv k="Result" v={v.totalVersions} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function ScopeDiffViewer() {
  const data = [{ target: 'shop', before: [{ id: 'r1', pattern: 'a.example.com', pathPrefix: '/', methods: ['GET'], type: 'include' }], after: [{ id: 'r1', pattern: 'a.example.com', pathPrefix: '/', methods: ['GET'], type: 'include' }, { id: 'r2', pattern: 'b.example.com', pathPrefix: '/', methods: ['GET'], type: 'include' }] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.viewScopeDiff(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScopeDiffViewer" note="Idea 54072">
      <Kv k="Result" v={v.changedCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function ScopeChangeApprovalFlow() {
  const data = [{ changeId: 'c-1', changeRisk: 20, requestedBy: 'ana', approver: '', widening: false }, { changeId: 'c-2', changeRisk: 85, requestedBy: 'bob', approver: '', widening: true }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.runScopeChangeApprovalFlow(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScopeChangeApprovalFlow" note="Idea 54073">
      <Kv k="Result" v={v.autoApprovedCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function ScopeRollback() {
  const data = [{ target: 'shop', targetVersion: 1, versions: [{ version: 1, author: 'ana', timestamp: '2026-10-01T10:00:00Z', rules: [{ pattern: 'a.example.com', pathPrefix: '/', methods: ['GET'], type: 'include' }] }, { version: 2, author: 'bob', timestamp: '2026-10-05T10:00:00Z', rules: [] }] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.rollbackScopeToVersion(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScopeRollback" note="Idea 54074">
      <Kv k="Result" v={v.readyCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function ScopeImportFromProgram() {
  const data = [{ target: 'shop', programText: 'api.example.com\nexclude status.example.com\nnot-a-host' }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.importScopeFromProgramText(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScopeImportFromProgram" note="Idea 54075">
      <Kv k="Result" v={v.totalRules} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function ScopeExportAsJson() {
  const data = [{ target: 'shop', version: 3, rules: [{ pattern: 'a.example.com', pathPrefix: '/', methods: ['GET'], type: 'include' }] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.exportScopeAsJson(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScopeExportAsJson" note="Idea 54076">
      <Kv k="Result" v={v.totalRules} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function CopyScopeBetweenTargets() {
  const data = [{ target: 'blog', sourceRules: [{ pattern: 'a.example.com', pathPrefix: '/', methods: ['GET'], type: 'include' }], targetRules: [{ pattern: 'a.example.com', pathPrefix: '/', methods: ['GET'], type: 'exclude' }] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.copyScopeBetweenTargets(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="CopyScopeBetweenTargets" note="Idea 54077">
      <Kv k="Result" v={v.cleanCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function ScopeTemplatesLibrary() {
  const data = [{ templateId: 'api-only' }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.getScopeTemplates(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScopeTemplatesLibrary" note="Idea 54078">
      <Kv k="Result" v={v.count} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function ScopeInheritanceFromProgram() {
  const data = [{ target: 'shop', programRules: [{ pattern: '*.example.com', pathPrefix: '/', methods: ['GET'], type: 'include' }, { pattern: '*.example.com', pathPrefix: '/admin', methods: ['GET'], type: 'include' }], overrides: [{ pattern: '*.example.com', pathPrefix: '/admin', methods: ['*'], type: 'exclude' }] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.applyScopeInheritance(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScopeInheritanceFromProgram" note="Idea 54079">
      <Kv k="Result" v={v.totalEffective} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function PerRuleEnableToggle() {
  const data = [{ target: 'shop', toggleRuleId: 'r1', testUrl: 'https://api.example.com/v1/users', rules: [{ id: 'r1', pattern: '*.example.com', pathPrefix: '/v1', methods: ['GET'], type: 'include', enabled: true }] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102B.toggleScopeRuleEnabled(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="PerRuleEnableToggle" note="Idea 54080">
      <Kv k="Result" v={v.changedCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}

export const WAVE102_B_COMPONENTS = [HttpMethodScoping, VisualScopeTree, IsThisUrlInScopeTester, WildcardExpansionPreview, OverbroadWildcardWarnings, ExclusionReasonCodes, ExclusionTemplatesLibrary, ScopeSyntaxValidator, ScopeRuleDragDropReorder, RuleShadowingIndicator, ScopeVersionHistory, ScopeDiffViewer, ScopeChangeApprovalFlow, ScopeRollback, ScopeImportFromProgram, ScopeExportAsJson, CopyScopeBetweenTargets, ScopeTemplatesLibrary, ScopeInheritanceFromProgram, PerRuleEnableToggle];

export function Wave102BGallery() {
  return (
    <div className="w102b-gallery">
      {WAVE102_B_COMPONENTS.map((C, i) => (<C key={i} />))}
      <div className="w102b-row"><Badge tone="info">Infinity AI</Badge></div>
    </div>
  );
}
