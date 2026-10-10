import React, { useMemo, useState } from 'react';
import {
  WAVE109_B_IDEAS,
  annotateChange,
  changeAnnotationSummary,
  recordRootCause,
  incidentPostmortem,
  addShape,
  createVoiceNote,
  voiceNoteLabel,
  summarizeNotes,
  duplicateNote,
  bulkExportNotes,
  printableBriefing,
  DEFAULT_NOTE_SHORTCUT,
  parseShortcut,
  isReservedShortcut,
} from './wave109BCore.js';
import './Wave109B.css';

/**
 * Wave109B — Annotation & capture demo panel (ideas 54331-54340).
 * Infinity AI branding only.
 */

const SAMPLE_NOTES = [
  { targetId: 't1', status: 'active', title: 'XSS probe', body: 'The /search endpoint reflects the q parameter without encoding. Confirmed with a harmless marker string.' },
  { targetId: 't1', status: 'active', title: 'WAF note', body: 'Most endpoints return 403 from the WAF. Only /api/v2 is reachable directly.' },
];

const change = { id: 'chg-1', description: 'New endpoint /api/v2/users appeared' };
annotateChange(change, { kind: 'investigating', text: 'Check if deployed by the dev team', author: 'ana' });

const incident = { id: 'inc-1', title: 'Dashboard 500s' };
recordRootCause(incident, { cause: 'Bad migration on the jobs table', author: 'ops', actionItems: [{ text: 'Roll back migration', owner: 'ops', done: true }] });

const shot = { id: 'shot-1', shapes: [] };
addShape(shot, { type: 'arrow', x1: 120, y1: 80, x2: 420, y2: 300, label: 'injection point' });

export default function Wave109B() {
  const [annoKind, setAnnoKind] = useState('investigating');
  const [annoText, setAnnoText] = useState('');
  const [summary, setSummary] = useState(() => changeAnnotationSummary(change));
  const [shapes, setShapes] = useState(() => shot.shapes);
  const [voice, setVoice] = useState(null);
  const [brief, setBrief] = useState(() => summarizeNotes(SAMPLE_NOTES, { maxSentences: 2 }));
  const [bulk, setBulk] = useState(null);
  const [dupMsg, setDupMsg] = useState('');

  const addAnno = () => {
    if (!annoText.trim()) return;
    annotateChange(change, { kind: annoKind, text: annoText.trim(), author: 'demo' });
    setSummary(changeAnnotationSummary(change));
    setAnnoText('');
  };

  const addBox = () => {
    addShape(shot, { type: 'box', x1: 50, y1: 50, x2: 350, y2: 250, label: 'form' });
    setShapes([...shot.shapes]);
  };

  const recordVoice = () => setVoice(createVoiceNote({ noteId: 'n1', author: 'demo', durationSec: 42 }));

  const doBulk = () => setBulk(bulkExportNotes(SAMPLE_NOTES, { targetIds: ['t1'], format: 'md' }));

  const doDup = () => {
    const note = { id: 'n9', targetId: 't1', author: 'ana', title: 'VPN setup', body: 'Steps…', status: 'active', history: [] };
    const d = duplicateNote(note, { targetId: 't2', author: 'demo' });
    setDupMsg(`Duplicated ${d.id} → target ${d.targetId}`);
  };

  const printTxt = useMemo(() => printableBriefing(SAMPLE_NOTES, { title: 'Field briefing' }).text, []);
  const parsed = useMemo(() => parseShortcut(DEFAULT_NOTE_SHORTCUT), []);

  return (
    <div className="wave109">
      <div className="wave109-head">
        <h2 className="wave109-title">Annotation &amp; capture</h2>
        <p className="wave109-sub">Infinity AI · notes · ideas 54331–54340</p>
      </div>

      <div className="wave109-card">
        <h3>Ideas in this panel</h3>
        <ul className="wave109-ideas">
          {WAVE109_B_IDEAS.map((i) => (
            <li key={i.id}><strong>{i.id}</strong> · {i.title}</li>
          ))}
        </ul>
      </div>

      <div className="wave109-card">
        <h3>Change annotation (54331)</h3>
        <p className="wave109-muted">{change.description} — expected-deploy: {summary['expected-deploy']}, investigating: {summary.investigating}, false-positive: {summary['false-positive']}</p>
        <div className="wave109-row">
          <select className="wave109-input" value={annoKind} onChange={(e) => setAnnoKind(e.target.value)} aria-label="Annotation kind">
            <option value="expected-deploy">expected-deploy</option>
            <option value="investigating">investigating</option>
            <option value="false-positive">false-positive</option>
          </select>
          <input className="wave109-input" value={annoText} onChange={(e) => setAnnoText(e.target.value)} placeholder="Annotation text" aria-label="Annotation text" />
          <button className="wave109-btn" onClick={addAnno}>Annotate</button>
        </div>
      </div>

      <div className="wave109-card">
        <h3>Incident postmortem (54332)</h3>
        <pre className="wave109-pre">{incidentPostmortem(incident)}</pre>
      </div>

      <div className="wave109-card">
        <h3>Screenshot drawing (54333) · Voice note (54334)</h3>
        <p className="wave109-muted">Shapes: {shapes.map((s) => `${s.type}(${s.label})`).join(', ')}</p>
        <div className="wave109-row">
          <button className="wave109-btn wave109-btn-ghost" onClick={addBox}>Add box</button>
          <button className="wave109-btn wave109-btn-ghost" onClick={recordVoice}>Attach 42s voice note</button>
        </div>
        {voice && <p className="wave109-muted">Voice note {voiceNoteLabel(voice.durationSec)} · id {voice.id}</p>}
      </div>

      <div className="wave109-card">
        <h3>Summarization (54335)</h3>
        <p>{brief.summary}</p>
        <p className="wave109-muted">{brief.sentenceCount} sentences from {brief.noteCount} notes</p>
      </div>

      <div className="wave109-card">
        <h3>Duplicate (54336) · Move (54337) · Bulk export (54338)</h3>
        <div className="wave109-row">
          <button className="wave109-btn wave109-btn-ghost" onClick={doDup}>Duplicate note → t2</button>
          <button className="wave109-btn wave109-btn-ghost" onClick={doBulk}>Bulk export t1 (md)</button>
        </div>
        {dupMsg && <p className="wave109-muted">{dupMsg}</p>}
        {bulk && <p className="wave109-muted">{bulk.filename} · {bulk.count} notes</p>}
      </div>

      <div className="wave109-card">
        <h3>Print view (54339) · Shortcut (54340)</h3>
        <pre className="wave109-pre">{printTxt.slice(0, 320)}</pre>
        <p className="wave109-muted">
          Default shortcut: {DEFAULT_NOTE_SHORTCUT} · parsed: {parsed.ctrl ? 'ctrl+' : ''}{parsed.shift ? 'shift+' : ''}{parsed.key} · reserved: {String(isReservedShortcut(DEFAULT_NOTE_SHORTCUT))}
        </p>
      </div>
    </div>
  );
}
