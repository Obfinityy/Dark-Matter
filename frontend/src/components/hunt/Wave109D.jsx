import React, { useMemo, useState } from 'react';
import {
  WAVE109_D_IDEAS,
  anchorNote,
  notesForUrl,
  setSeverity,
  sortBySeverity,
  severityCounts,
  searchAllNotes,
  suggestNoteTypes,
  completenessScore,
  createClientFolder,
  assignTargetToClient,
  clientDashboard,
  createProgramFolder,
  assignTargetToProgram,
  effectiveRules,
  createGroup,
  addToGroup,
  reorderGroup,
  createNode,
  addChild,
  breadcrumbs,
  flattenHierarchy,
  createSmartGroup,
  evaluateSmartGroup,
  createTagGroup,
  syncTagGroups,
} from './wave109DCore.js';
import './Wave109D.css';

/**
 * Wave109D — Target organization demo panel (ideas 54351-54360).
 * Infinity AI branding only.
 */

const SAMPLE_NOTES = [
  { id: 'n1', targetId: 't1', title: 'Login note', body: 'SQLi probe on the login form returned a generic error.', status: 'active', tags: ['credentials'], severity: 'warning', urlAnchors: [] },
  { id: 'n2', targetId: 't1', title: 'WAF note', body: 'WAF blocks most paths; /api/v2 is open.', status: 'active', tags: [], severity: 'info', urlAnchors: [] },
  { id: 'n3', targetId: 't2', title: 'API keys', body: 'Found staging API keys in JS bundle.', status: 'active', tags: ['credentials'], severity: 'blocker', urlAnchors: [] },
];

const SAMPLE_TARGETS = [
  { id: 't1', name: 'Acme Web', score: 92, findings: 4, tags: ['apac', 'retail'] },
  { id: 't2', name: 'Acme API', score: 58, findings: 1, tags: ['emea'] },
  { id: 't3', name: 'Docs', score: 84, findings: 0, tags: ['apac'] },
];

const folder = createClientFolder({ name: 'Acme Corp' });
assignTargetToClient(folder, 't1');
assignTargetToClient(folder, 't2');
const program = createProgramFolder({ name: 'Acme BBP', rules: [{ key: 'scope', value: 'in-scope only' }] });
assignTargetToProgram(program, 't1');

const root = createNode({ name: 'Acme Corp', type: 'client' });
const progNode = createNode({ name: 'Acme BBP', type: 'program' });
const envNode = createNode({ name: 'Production', type: 'environment' });
addChild(root, progNode);
addChild(progNode, envNode);
const byId = new Map([root, progNode, envNode].map((n) => [n.id, n]));

export default function Wave109D() {
  const [notes, setNotes] = useState(SAMPLE_NOTES);
  const [search, setSearch] = useState('api');
  const [group] = useState(() => {
    const g = createGroup({ name: 'Q4 focus' });
    addToGroup(g, 't1');
    addToGroup(g, 't2');
    return g;
  });
  const [order, setOrder] = useState(group.memberIds);
  const [smart] = useState(() => evaluateSmartGroup(createSmartGroup({ name: 'High risk', query: { field: 'score', op: 'gte', value: 80 } }), SAMPLE_TARGETS));
  const [tagGroups] = useState(() => syncTagGroups([createTagGroup({ name: 'APAC', tag: 'apac' })], SAMPLE_TARGETS));

  const doAnchor = () => {
    const n = notes.map((x) => (x.id === 'n1' ? anchorNote({ ...x }, 'https://acme.test/login#frag') : x));
    setNotes(n);
  };

  const doSeverity = (sev) => {
    setNotes(notes.map((x) => (x.id === 'n2' ? setSeverity({ ...x }, sev) : x)));
  };

  const doReorder = () => {
    reorderGroup(group, 't2', 0);
    setOrder([...group.memberIds]);
  };

  const results = useMemo(() => searchAllNotes(notes, search), [notes, search]);
  const sorted = useMemo(() => sortBySeverity(notes), [notes]);
  const counts = useMemo(() => severityCounts(notes), [notes]);
  const anchored = useMemo(() => notesForUrl(notes, 'https://acme.test/login'), [notes]);
  const suggestions = useMemo(() => suggestNoteTypes(notes, 't1'), [notes]);
  const score = useMemo(() => completenessScore(notes, 't1'), [notes]);
  const dash = useMemo(() => clientDashboard(folder, SAMPLE_TARGETS, notes), [notes]);
  const rules = useMemo(() => effectiveRules(program, [{ key: 'scope', value: 'staging excluded', inherited: false }]), []);

  return (
    <div className="wave109">
      <div className="wave109-head">
        <h2 className="wave109-title">Target organization</h2>
        <p className="wave109-sub">Infinity AI · inventory · ideas 54351–54360</p>
      </div>

      <div className="wave109-card">
        <h3>Ideas in this panel</h3>
        <ul className="wave109-ideas">
          {WAVE109_D_IDEAS.map((i) => (
            <li key={i.id}><strong>{i.id}</strong> · {i.title}</li>
          ))}
        </ul>
      </div>

      <div className="wave109-card">
        <h3>URL anchors (54351) · Severity (54352)</h3>
        <div className="wave109-row">
          <button className="wave109-btn wave109-btn-ghost" onClick={doAnchor}>Anchor n1 → /login</button>
          <button className="wave109-btn wave109-btn-ghost" onClick={() => doSeverity('blocker')}>Flag n2 blocker</button>
        </div>
        <p className="wave109-muted">Anchored to /login: {anchored.map((n) => n.title).join(', ') || '—'}</p>
        <p className="wave109-muted">Severity order: {sorted.map((n) => n.title).join(' › ')} · blockers: {counts.blocker}, warnings: {counts.warning}, info: {counts.info}</p>
      </div>

      <div className="wave109-card">
        <h3>Cross-target search (54353) · Completeness (54354)</h3>
        <input className="wave109-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search all notes" aria-label="Cross-target note search" />
        <ul className="wave109-list">
          {results.map((r) => (
            <li key={r.noteId} className="wave109-note"><strong>[{r.targetId}]</strong> {r.title}<br /><span className="wave109-muted">{r.snippet}</span></li>
          ))}
        </ul>
        <p className="wave109-muted">t1 completeness: {score}% · missing: {suggestions.map((s) => s.type).join(', ') || 'none'}</p>
      </div>

      <div className="wave109-card">
        <h3>Client folders (54355) · Program folders (54356)</h3>
        <p className="wave109-muted">{dash.clientName}: {dash.targetCount} targets · {dash.noteCount} notes · {dash.findingCount} findings</p>
        <p className="wave109-muted">Effective scope rule: {rules.find((r) => r.key === 'scope')?.value} (inherited: {String(rules.find((r) => r.key === 'scope')?.inherited)})</p>
      </div>

      <div className="wave109-card">
        <h3>Custom groups (54357) · Hierarchy (54358)</h3>
        <p className="wave109-muted">Q4 focus order: {order.join(', ')}</p>
        <button className="wave109-btn wave109-btn-ghost" onClick={doReorder}>Move t2 to top</button>
        <p className="wave109-muted">Breadcrumb: {breadcrumbs(envNode.id, byId).join(' › ')}</p>
        <p className="wave109-muted">Flattened: {flattenHierarchy(root).map((f) => `${'·'.repeat(f.depth)}${f.node.name}`).join(' / ')}</p>
      </div>

      <div className="wave109-card">
        <h3>Smart groups (54359–54360)</h3>
        <p className="wave109-muted">High risk (score ≥ 80): {smart.memberIds.join(', ')}</p>
        <p className="wave109-muted">APAC tag group: {tagGroups[0].memberIds.join(', ')}</p>
      </div>
    </div>
  );
}
