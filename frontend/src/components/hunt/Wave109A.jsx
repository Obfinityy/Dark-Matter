import React, { useMemo, useState } from 'react';
import {
  WAVE109_A_IDEAS,
  createNoteStore,
  addNote,
  listNotes,
  notesToMarkdown,
  createQuickNote,
  captureHuntObservation,
  parseTargetLinks,
  resolveLinks,
  setReminder,
  dueReminders,
  archiveNote,
  trashNote,
  restoreNote,
  purgeEligible,
  createPolicy,
  canCreate,
  canEdit,
  canDelete,
  annotateScopeRule,
  listScopeAnnotations,
  annotateFinding,
} from './wave109ACore.js';
import './Wave109A.css';

/**
 * Wave109A — Note management core demo panel (ideas 54321-54330).
 * Infinity AI branding only.
 */

const store = createNoteStore();
addNote(store, { targetId: 't1', author: 'ana', title: 'Access notes', body: 'VPN creds in [[t2]]. Rotate monthly.', tags: ['credentials'] });
addNote(store, { targetId: 't1', author: 'bob', title: 'Scope caveat', body: 'Staging is out of scope until Friday.', tags: ['scope'] });
const seededNote = addNote(store, { targetId: 't2', author: 'ana', title: 'Contact', body: 'Security lead: sec@acme.test', tags: ['contacts'] });
setReminder(seededNote, '2020-06-01T00:00:00.000Z');

const policy = createPolicy({ t9: { delete: ['analyst', 'owner'] } });
const scopeRule = { id: 'r1', pattern: '*.acme.com', annotations: [] };
const finding = { id: 'f1', title: 'Reflected XSS in /search' };

export default function Wave109A() {
  const [notes, setNotes] = useState(() => listNotes(store));
  const [body, setBody] = useState('');
  const [exported, setExported] = useState(null);
  const [annoText, setAnnoText] = useState('');
  const [annos, setAnnos] = useState([]);
  const [findText, setFindText] = useState('');

  const refresh = () => setNotes(listNotes(store));
  const active = useMemo(() => notes.filter((n) => n.status === 'active'), [notes]);
  const due = useMemo(() => dueReminders(notes), [notes]);
  const purgeable = useMemo(() => purgeEligible(notes), [notes]);

  const quickAdd = () => {
    if (!body.trim()) return;
    createQuickNote(store, { targetId: 't1', author: 'demo', body: body.trim() });
    setBody('');
    refresh();
  };

  const doExport = () => setExported(notesToMarkdown(notes, 't1', 'Acme Web'));

  const addAnnotation = () => {
    if (!annoText.trim()) return;
    annotateScopeRule(scopeRule, { text: annoText.trim(), author: 'demo' });
    setAnnos(listScopeAnnotations(scopeRule));
    setAnnoText('');
  };

  const addFindingNote = () => {
    if (!findText.trim()) return;
    annotateFinding(finding, { text: findText.trim(), author: 'demo' });
    setFindText('');
    refresh();
  };

  const linkDemo = useMemo(() => {
    const n = notes.find((x) => x.title === 'Access notes');
    return n ? resolveLinks(n, [{ id: 't2' }]) : { linked: [], unknown: [] };
  }, [notes]);

  return (
    <div className="wave109">
      <div className="wave109-head">
        <h2 className="wave109-title">Note management core</h2>
        <p className="wave109-sub">Infinity AI · Hunt notes · ideas 54321–54330</p>
      </div>

      <div className="wave109-card">
        <h3>Ideas in this panel</h3>
        <ul className="wave109-ideas">
          {WAVE109_A_IDEAS.map((i) => (
            <li key={i.id}><strong>{i.id}</strong> · {i.title}</li>
          ))}
        </ul>
      </div>

      <div className="wave109-card">
        <h3>Quick note (54322) + hunt capture (54323)</h3>
        <div className="wave109-row">
          <input
            className="wave109-input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a note, press N to focus…"
            aria-label="Quick note body"
          />
          <button className="wave109-btn" onClick={quickAdd}>Add note</button>
          <button
            className="wave109-btn wave109-btn-ghost"
            onClick={() => { captureHuntObservation(store, { targetId: 't1', author: 'demo', body: 'Saw interesting header at step 12', huntStep: 12 }); refresh(); }}
          >
            Capture hunt obs
          </button>
        </div>
        <ul className="wave109-list">
          {active.map((n) => (
            <li key={n.id} className="wave109-note">
              <strong>{n.title}</strong>
              <span className="wave109-muted"> {n.author} · {n.tags.join(', ')}</span>
              <div className="wave109-actions">
                <button className="wave109-link" onClick={() => { archiveNote(n); refresh(); }}>archive</button>
                <button className="wave109-link" onClick={() => { trashNote(n); refresh(); }}>trash</button>
                {n.status === 'trashed' && (
                  <button className="wave109-link" onClick={() => { restoreNote(n); refresh(); }}>restore</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="wave109-card">
        <h3>[[target]] linking (54324)</h3>
        <p className="wave109-muted">Parsed links: {parseTargetLinks('VPN creds in [[t2]]. Rotate monthly.').join(', ')}</p>
        <p className="wave109-muted">Resolved: linked {linkDemo.linked.join(', ') || '—'} · unknown {linkDemo.unknown.join(', ') || '—'}</p>
      </div>

      <div className="wave109-card">
        <h3>Reminders (54325) · Trash retention (54327)</h3>
        <p>Due reminders: <strong>{due.length}</strong> {due.map((n) => n.title).join(', ')}</p>
        <p>Purge-eligible (30d): <strong>{purgeable.length}</strong></p>
      </div>

      <div className="wave109-card">
        <h3>Permissions (54328)</h3>
        <p className="wave109-muted">
          analyst can create: {String(canCreate(policy, { roles: ['analyst'], targetId: 't1' }))} ·
          viewer can edit: {String(canEdit(policy, { roles: ['viewer'], targetId: 't1' }))} ·
          analyst can delete on t9: {String(canDelete(policy, { roles: ['analyst'], targetId: 't9' }))}
        </p>
      </div>

      <div className="wave109-card">
        <h3>Annotations (54329–54330)</h3>
        <div className="wave109-row">
          <input className="wave109-input" value={annoText} onChange={(e) => setAnnoText(e.target.value)} placeholder="Annotate scope rule *.acme.com" aria-label="Scope annotation" />
          <button className="wave109-btn" onClick={addAnnotation}>Annotate rule</button>
        </div>
        <ul className="wave109-list">{annos.map((a) => <li key={a.id}>{a.text} <span className="wave109-muted">— {a.author}</span></li>)}</ul>
        <div className="wave109-row">
          <input className="wave109-input" value={findText} onChange={(e) => setFindText(e.target.value)} placeholder="Add context to finding f1" aria-label="Finding context" />
          <button className="wave109-btn" onClick={addFindingNote}>Annotate finding</button>
        </div>
        <p className="wave109-muted">Finding f1 context notes: {(finding.contextNotes || []).length}</p>
      </div>

      <div className="wave109-card">
        <h3>Export (54321)</h3>
        <button className="wave109-btn" onClick={doExport}>Export t1 notes</button>
        {exported && (
          <div className="wave109-export">
            <p className="wave109-muted">{exported.filename} · {exported.noteCount} notes</p>
            <pre>{exported.markdown.slice(0, 600)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
