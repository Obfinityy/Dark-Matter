import React, { useMemo, useState } from 'react';
import {
  WAVE109_C_IDEAS,
  noteStats,
  recentlyEdited,
  createSession,
  joinSession,
  leaveSession,
  activeCursors,
  hasConflict,
  resolveConflict,
  apiCreateNote,
  apiNoteList,
  parseApiFilters,
  logActivity,
  activitySummary,
  translateNote,
  bestText,
  pinnedDigest,
  createTemplate,
  applyTemplate,
  staleNotePrompts,
} from './wave109CCore.js';
import './Wave109C.css';

/**
 * Wave109C — Note collaboration demo panel (ideas 54341-54350).
 * Infinity AI branding only.
 */

const session = createSession('note-1');
joinSession(session, { userId: 'u1', userName: 'Ana', cursor: { line: 4, col: 12 } });
joinSession(session, { userId: 'u2', userName: 'Bob', cursor: { line: 4, col: 20 } });

const base = { body: 'Rotate creds monthly.', rev: 1 };
const local = { body: 'Rotate creds weekly.', rev: 2, author: 'ana', updatedAt: '2026-10-10T10:00:00.000Z' };
const remote = { body: 'Rotate creds monthly, store in vault.', rev: 2, author: 'bob', updatedAt: '2026-10-10T11:00:00.000Z' };

const template = createTemplate({ name: 'Handoff', body: 'Target: {{target}}\nAccess: {{access}}\nCaveats: {{caveats}}' });

export default function Wave109C() {
  const [note, setNote] = useState({ id: 'n1', title: 'Access notes', body: 'The VPN credentials are stored in the vault. Rotate them every month and confirm with the client contact.', author: 'ana', updatedAt: new Date().toISOString(), status: 'active', pinned: true });
  const [conflict, setConflict] = useState(hasConflict(base, local, remote));
  const [merged, setMerged] = useState(null);
  const [lang, setLang] = useState('hi');
  const [tplVars, setTplVars] = useState({ target: 'acme-web', access: 'VPN + bastion', caveats: 'staging excluded' });
  const [activity, setActivity] = useState({ view: 0, edit: 0, share: 0 });

  const stats = useMemo(() => noteStats(note), [note]);
  const recent = useMemo(() => recentlyEdited([note, { title: 'Old', updatedAt: '2026-01-01T00:00:00.000Z' }]), [note]);
  const others = useMemo(() => activeCursors(session, 'u1'), []);
  const digest = useMemo(() => pinnedDigest([note], { since: '2026-01-01T00:00:00.000Z', recipients: ['owner@acme.test'] }), [note]);
  const prompts = useMemo(() => staleNotePrompts([{ id: 'n2', title: 'VPN setup', author: 'ana', status: 'active', updatedAt: '2026-08-01T00:00:00.000Z' }], new Date(), 30), []);

  const doResolve = (strategy) => setMerged(resolveConflict(base, local, remote, strategy));

  const doTranslate = () => {
    const n = { ...note };
    translateNote(n, { lang, text: lang === 'hi' ? 'क्रेडेंशियल हर महीने घुमाएँ।' : 'Rotate credentials every month.' });
    setNote(n);
  };

  const doActivity = (action) => {
    const n = { ...note };
    logActivity(n, { action, actor: 'demo' });
    setNote(n);
    setActivity(activitySummary(n));
  };

  const apiDemo = useMemo(() => {
    const p = apiCreateNote({ targetId: 't1', title: 'API note', body: 'from automation', tags: ['auto'] });
    const f = parseApiFilters({ targetId: 't1', limit: '10' });
    return { payload: p, filtered: apiNoteList([{ targetId: 't1', tags: [], status: 'active' }, { targetId: 't2', tags: [], status: 'active' }], f).length };
  }, []);

  return (
    <div className="wave109">
      <div className="wave109-head">
        <h2 className="wave109-title">Note collaboration</h2>
        <p className="wave109-sub">Infinity AI · notes · ideas 54341–54350</p>
      </div>

      <div className="wave109-card">
        <h3>Ideas in this panel</h3>
        <ul className="wave109-ideas">
          {WAVE109_C_IDEAS.map((i) => (
            <li key={i.id}><strong>{i.id}</strong> · {i.title}</li>
          ))}
        </ul>
      </div>

      <div className="wave109-card">
        <h3>Word count (54341) · Last-edited (54342)</h3>
        <p className="wave109-muted">Words: {stats.words} · chars: {stats.chars} · ~{stats.readingSec}s read</p>
        <p className="wave109-muted">Recently edited: {recent.map((n) => n.title).join(', ') || '—'}</p>
      </div>

      <div className="wave109-card">
        <h3>Collaborative editing (54343)</h3>
        <p className="wave109-muted">Live cursors (as seen by Ana): {others.map((c) => `${c.userName} @ L${c.cursor.line}:C${c.cursor.col}`).join(', ')}</p>
        <div className="wave109-row">
          <button className="wave109-btn wave109-btn-ghost" onClick={() => { leaveSession(session, 'u2'); }}>Bob leaves</button>
        </div>
      </div>

      <div className="wave109-card">
        <h3>Conflict resolution (54344)</h3>
        <p className="wave109-muted">Conflict detected: {String(conflict)}</p>
        <div className="wave109-row">
          <button className="wave109-btn wave109-btn-ghost" onClick={() => doResolve('newest-wins')}>Newest wins</button>
          <button className="wave109-btn wave109-btn-ghost" onClick={() => doResolve('manual-merge')}>Manual merge</button>
        </div>
        {merged && <pre className="wave109-pre">{merged.body}</pre>}
      </div>

      <div className="wave109-card">
        <h3>Notes API (54345) · Activity log (54346)</h3>
        <p className="wave109-muted">API payload validated: targetId={apiDemo.payload.targetId} · filtered list size: {apiDemo.filtered}</p>
        <div className="wave109-row">
          <button className="wave109-btn wave109-btn-ghost" onClick={() => doActivity('view')}>Log view</button>
          <button className="wave109-btn wave109-btn-ghost" onClick={() => doActivity('edit')}>Log edit</button>
          <button className="wave109-btn wave109-btn-ghost" onClick={() => doActivity('share')}>Log share</button>
        </div>
        <p className="wave109-muted">views {activity.view} · edits {activity.edit} · shares {activity.share}</p>
      </div>

      <div className="wave109-card">
        <h3>Translation (54347)</h3>
        <div className="wave109-row">
          <select className="wave109-input" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">
            <option value="hi">Hindi</option>
            <option value="es">Spanish</option>
          </select>
          <button className="wave109-btn" onClick={doTranslate}>Translate</button>
        </div>
        <p>{bestText(note, lang)}</p>
        <p className="wave109-muted">Original preserved: {(note.translations || {})[lang] ? 'yes' : 'not yet'}</p>
      </div>

      <div className="wave109-card">
        <h3>Digest (54348) · Templates (54349) · Prompts (54350)</h3>
        <p className="wave109-muted">{digest.subject} → {digest.recipients.join(', ')}</p>
        <pre className="wave109-pre">{applyTemplate(template, tplVars)}</pre>
        <p className="wave109-muted">Stale prompts: {prompts.map((p) => `${p.title} (${p.daysStale}d)`).join(', ')}</p>
      </div>
    </div>
  );
}
