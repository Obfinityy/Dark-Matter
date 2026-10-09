import React, { useMemo, useRef, useState } from 'react';
import './Wave108C.css';
import {
  WAVE108_C_IDEAS,
  portExposureScore,
  listRecalcTriggers,
  registerRecalcTrigger,
  shouldRecalc,
  buildScoreApiResponse,
  scoreBand,
  provisionalScore,
  ONBOARDING_SIGNALS,
  createRichDoc,
  addHeading,
  addParagraph,
  addList,
  addCallout,
  addLink,
  richDocToMarkdown,
  markdownToHtmlLite,
  pinNote,
  unpinNote,
  isNotePinned,
  listNoteTemplates,
  noteFromTemplate,
  annotateTimelineEvent,
  annotationsForEvent,
  attachScreenshot,
  removeScreenshot,
} from './wave108CCores.js';

/**
 * Wave 108C — Target scoring factors + analyst notes demo panel.
 * Infinity AI branding only. Demonstrates ideas 54301–54310.
 */

const SAMPLE_PORTS = [
  { port: 80, service: 'HTTP' },
  { port: 443, service: 'HTTPS' },
  { port: 3306, service: 'MySQL' },
  { port: 6379, service: 'Redis' },
  { port: 22, service: 'SSH' },
];

const SAMPLE_EVENTS = [
  { id: 'evt-101', time: '2026-10-10 09:12', label: 'Hunt completed — acme-web' },
  { id: 'evt-102', time: '2026-10-10 10:03', label: 'New subdomain discovered — api.acme-web' },
  { id: 'evt-103', time: '2026-10-10 10:47', label: 'Scope edited — added /api/v2' },
];

const EMPTY_SIGNALS = { domainVerified: false, scopeDefined: false, assetInventory: false, techStack: false, priorReports: false };

function badgeClass(band) {
  return `wave108-badge wave108-badge-${band}`;
}

export default function Wave108C() {
  /* 54301 — port exposure */
  const [ports] = useState(SAMPLE_PORTS);
  const [expectedInput, setExpectedInput] = useState('80,443,HTTP,HTTPS');
  const [exposure, setExposure] = useState(null);

  /* 54302 — recalc triggers */
  const [triggers, setTriggers] = useState(() => listRecalcTriggers());
  const [customType, setCustomType] = useState('credential-leak');
  const [recalcChecks, setRecalcChecks] = useState([]);

  /* 54303 — score API */
  const [apiPayload, setApiPayload] = useState(null);

  /* 54304 — provisional scoring */
  const [signals, setSignals] = useState({ ...EMPTY_SIGNALS, domainVerified: true, scopeDefined: true });
  const provisional = useMemo(() => provisionalScore(signals), [signals]);

  /* 54305 — rich-text doc */
  const [richDoc, setRichDoc] = useState(() =>
    addLink(
      addCallout(
        addList(
          addParagraph(addHeading(createRichDoc('Acme-web recon notes'), 2, 'Recon summary'), 'Subdomain takeover check passed.'),
          ['api.acme-web', 'shop.acme-web', 'cdn.acme-web'],
          false
        ),
        'warning',
        'Admin panel reachable on :8080 — verify with the client before testing.'
      ),
      'https://acme-web.example',
      'Target login page'
    )
  );

  /* 54306/54307/54308/54310 — notes composer */
  const [noteTitle, setNoteTitle] = useState('First impressions');
  const [noteBody, setNoteBody] = useState('# First impressions\n\n**Acme Web** looks *interesting* — try:\n\n- `nmap -sV` on edge hosts\n- Check [login page](https://acme-web.example/login)\n\n```bash\ncurl -I https://acme-web.example\n```');
  const [notes, setNotes] = useState([]);
  const [templates] = useState(() => listNoteTemplates());
  const [shotError, setShotError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [pendingShots, setPendingShots] = useState([]);
  const fileInputRef = useRef(null);

  /* 54309 — timeline annotations */
  const [events] = useState(SAMPLE_EVENTS);
  const [activeEvent, setActiveEvent] = useState('evt-102');
  const [annotationText, setAnnotationText] = useState('Subdomain serves the old Angular build — retest for outdated deps.');
  const [annotations, setAnnotations] = useState([]);
  const annotationSeq = useRef(1);

  const previewHtml = useMemo(() => markdownToHtmlLite(noteBody), [noteBody]);

  const runExposure = () => {
    const expected = expectedInput.split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => (/^\d+$/.test(s) ? Number(s) : s));
    setExposure(portExposureScore(ports, expected));
  };

  const addCustomTrigger = () => {
    registerRecalcTrigger(customType.trim() || 'custom-event', 'registered from the Wave 108C panel');
    setTriggers(listRecalcTriggers());
  };

  const checkEvent = (eventType) => {
    const verdict = shouldRecalc(eventType);
    setRecalcChecks((c) => [{ eventType, ...verdict, at: new Date().toISOString() }, ...c].slice(0, 8));
  };

  const buildApi = () => {
    const factors = [
      { name: 'port-exposure', score: exposure ? exposure.factor : 0, weight: 0.35 },
      { name: 'vuln-findings', score: 72, weight: 0.45 },
      { name: 'change-velocity', score: 25, weight: 0.2 },
    ];
    const score = Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0));
    setApiPayload(buildScoreApiResponse({ id: 'acme-web', name: 'Acme Web', score, factors }));
  };

  const saveNote = () => {
    const note = {
      id: `note:custom:${Date.now()}`,
      title: noteTitle.trim() || 'Untitled note',
      body: noteBody,
      format: 'markdown',
      pinned: false,
      pinnedAt: null,
      createdAt: new Date().toISOString(),
      attachments: [],
    };
    const withShots = pendingShots.reduce((n, s) => {
      try {
        return attachScreenshot(n, { dataUrl: s.dataUrl, caption: s.caption });
      } catch {
        return n;
      }
    }, note);
    setNotes((ns) => [withShots, ...ns]);
    setPendingShots([]);
    setShotError(null);
  };

  const startFromTemplate = (key) => {
    const note = noteFromTemplate(key);
    setNoteTitle(note.title);
    setNoteBody(note.body);
  };

  const readFiles = (files) => {
    setShotError(null);
    const list = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) {
      setShotError('Drop an image file (PNG/JPG) to attach a screenshot.');
      return;
    }
    for (const file of list) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const dataUrl = String(reader.result);
          const probe = { id: 'probe', attachments: [] };
          attachScreenshot(probe, { dataUrl, caption: file.name });
          setPendingShots((s) => [...s, { dataUrl, caption: file.name }].slice(0, 6));
        } catch (err) {
          setShotError(err.message);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const addAnnotation = () => {
    if (!annotationText.trim()) return;
    const ann = annotateTimelineEvent(activeEvent, annotationText, {
      author: 'analyst',
      sequence: annotationSeq.current,
    });
    annotationSeq.current += 1;
    setAnnotations((a) => [...a, ann]);
    setAnnotationText('');
  };

  return (
    <div className="wave108 wave108-c">
      <header className="wave108-head">
        <h2 className="wave108-title">Target Scoring &amp; Analyst Notes — Infinity AI</h2>
        <p className="wave108-sub">Wave 108C · ideas 54301–54310 · score factors and the target notes toolkit</p>
      </header>

      <div className="wave108-grid-2">
        {/* 54301 Port exposure factor */}
        <section className="wave108-card" id="wave108-port-exposure">
          <h3>{WAVE108_C_IDEAS[0].title}</h3>
          <input
            className="wave108-input"
            style={{ width: '100%' }}
            value={expectedInput}
            onChange={(e) => setExpectedInput(e.target.value)}
            placeholder="expected services, comma-separated"
          />
          <button className="wave108-btn" onClick={runExposure}>Compute exposure factor</button>
          {exposure && (
            <div>
              <p className="wave108-muted">
                Factor <b>{exposure.factor}/{exposure.factorMax}</b> · {exposure.totalOpen} open ports ·{' '}
                {exposure.unexpected.length} unexpected
              </p>
              <ul className="wave108-list">
                {exposure.unexpected.map((u) => (
                  <li key={u.port}>
                    <code>:{u.port}</code> {u.service}{' '}
                    <span className={`wave108-risk wave108-risk-${u.risk}`}>{u.risk}</span>{' '}
                    <span className="wave108-muted">+{u.weight} — {u.reason}</span>
                  </li>
                ))}
                {exposure.unexpected.length === 0 && <li>No unexpected open services.</li>}
              </ul>
            </div>
          )}
        </section>

        {/* 54302 Score recalculation triggers */}
        <section className="wave108-card" id="wave108-recalc-triggers">
          <h3>{WAVE108_C_IDEAS[1].title}</h3>
          <input className="wave108-input" value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="custom event type" />
          <button className="wave108-btn wave108-btn-ghost" onClick={addCustomTrigger}>Register trigger</button>
          <div style={{ marginBottom: '0.5rem' }}>
            <button className="wave108-btn wave108-btn-sm" onClick={() => checkEvent('hunt-completed')}>hunt-completed</button>
            <button className="wave108-btn wave108-btn-sm" onClick={() => checkEvent('change-detected')}>change-detected</button>
            <button className="wave108-btn wave108-btn-sm" onClick={() => checkEvent('scope-edited')}>scope-edited</button>
            <button className="wave108-btn wave108-btn-sm wave108-btn-ghost" onClick={() => checkEvent('note-saved')}>note-saved</button>
          </div>
          <ul className="wave108-list">
            {triggers.map((t) => (
              <li key={t.eventType}><code>{t.eventType}</code> <span className="wave108-muted">— {t.reason}{t.custom ? ' (custom)' : ''}</span></li>
            ))}
          </ul>
          {recalcChecks.length > 0 && (
            <ul className="wave108-list">
              {recalcChecks.map((c, i) => (
                <li key={`${c.at}-${i}`}>
                  <code>{c.eventType}</code>: {c.recalc ? <b>recompute</b> : <span className="wave108-muted">skip</span>}
                  {c.reason && <span className="wave108-muted"> — {c.reason}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 54303 Score API */}
        <section className="wave108-card" id="wave108-score-api">
          <h3>{WAVE108_C_IDEAS[2].title}</h3>
          <button className="wave108-btn" onClick={buildApi}>Build score API response</button>
          {apiPayload && (
            <div>
              <p className="wave108-muted">
                <b>{apiPayload.score}</b> <span className={badgeClass(apiPayload.band)}>{apiPayload.band}</span>{' '}
                <span className="wave108-muted">model {apiPayload.modelVersion}</span>
              </p>
              {apiPayload.factors.map((f) => (
                <div className="wave108-factor" key={f.name}>
                  <span>{f.name}</span>
                  <div className="wave108-bar"><span style={{ width: `${f.score}%` }} /></div>
                  <span className="wave108-muted">{f.score}</span>
                </div>
              ))}
              <pre className="wave108-pre">{JSON.stringify(apiPayload, null, 2)}</pre>
            </div>
          )}
        </section>

        {/* 54304 New-target provisional scoring */}
        <section className="wave108-card" id="wave108-provisional">
          <h3>{WAVE108_C_IDEAS[3].title}</h3>
          <div style={{ marginBottom: '0.5rem' }}>
            {ONBOARDING_SIGNALS.map((key) => (
              <label key={key} className="wave108-muted" style={{ marginRight: '0.8rem', display: 'inline-block' }}>
                <input
                  type="checkbox"
                  checked={Boolean(signals[key])}
                  onChange={(e) => setSignals((s) => ({ ...s, [key]: e.target.checked }))}
                />{' '}
                {key}
              </label>
            ))}
          </div>
          <p className="wave108-muted">
            Score <b>{provisional.score}</b> <span className={badgeClass(provisional.band)}>{provisional.band}</span>
            {provisional.provisional && <span className="wave108-provisional">provisional</span>}
            {!provisional.provisional && <span className="wave108-badge wave108-badge-low">confirmed</span>}
          </p>
          {provisional.missingSignals.length > 0 && (
            <p className="wave108-muted">Waiting on: {provisional.missingSignals.join(', ')}</p>
          )}
        </section>
      </div>

      {/* 54305 Rich-text notes editor */}
      <section className="wave108-card" id="wave108-rich-editor">
        <h3>{WAVE108_C_IDEAS[4].title}</h3>
        <div style={{ marginBottom: '0.5rem' }}>
          <button className="wave108-btn wave108-btn-sm" onClick={() => setRichDoc((d) => addCallout(d, 'info', 'New callout: scope confirmed with the client.'))}>Add callout</button>
          <button className="wave108-btn wave108-btn-sm wave108-btn-ghost" onClick={() => setRichDoc((d) => addList(d, ['Check DNS history', 'Enumerate vhosts'], true))}>Add checklist</button>
          <button className="wave108-btn wave108-btn-sm wave108-btn-ghost" onClick={() => setRichDoc((d) => addHeading(d, 3, 'Next session'))}>Add heading</button>
        </div>
        <p className="wave108-muted">{richDoc.title} · {richDoc.blocks.length} blocks</p>
        <pre className="wave108-pre">{richDocToMarkdown(richDoc)}</pre>
        <div className="wave108-preview" dangerouslySetInnerHTML={{ __html: markdownToHtmlLite(richDocToMarkdown(richDoc)) }} />
      </section>

      {/* 54306 Markdown composer + 54307 pinning + 54308 templates + 54310 screenshots */}
      <section className="wave108-card" id="wave108-notes">
        <h3>{WAVE108_C_IDEAS[5].title} · {WAVE108_C_IDEAS[7].title}</h3>
        <div style={{ marginBottom: '0.5rem' }}>
          {templates.map((t) => (
            <button key={t.key} className="wave108-btn wave108-btn-sm wave108-btn-ghost" onClick={() => startFromTemplate(t.key)} title={t.description}>
              {t.title}
            </button>
          ))}
        </div>
        <input className="wave108-input" style={{ width: '100%' }} value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="note title" />
        <div className="wave108-compose">
          <div>
            <div className="wave108-pane-label">Markdown source</div>
            <textarea className="wave108-textarea" value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
          </div>
          <div>
            <div className="wave108-pane-label">Live preview</div>
            <div className="wave108-pane wave108-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>

        <div
          className={`wave108-dropzone${dragging ? ' dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); readFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
        >
          Drag &amp; drop screenshots here, or click to attach (5 MB limit each)
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => readFiles(e.target.files)}
          />
        </div>
        {pendingShots.length > 0 && (
          <div className="wave108-shots">
            {pendingShots.map((s, i) => (
              <figure className="wave108-shot" key={i}>
                <img src={s.dataUrl} alt={s.caption || `screenshot ${i + 1}`} />
                <button onClick={() => setPendingShots((p) => p.filter((_, j) => j !== i))} aria-label="remove screenshot">✕</button>
                <figcaption>{s.caption || `screenshot ${i + 1}`}</figcaption>
              </figure>
            ))}
          </div>
        )}
        {shotError && <p className="wave108-error">{shotError}</p>}
        <div style={{ marginTop: '0.75rem' }}>
          <button className="wave108-btn" onClick={saveNote}>Save note</button>
        </div>

        <div className="wave108-notes">
          {notes.map((note) => (
            <article key={note.id} className={`wave108-note${isNotePinned(note) ? ' wave108-note-pinned' : ''}`}>
              <div className="wave108-note-head">
                <p className="wave108-note-title">
                  {isNotePinned(note) && <span className="wave108-pin-flag">Pinned</span>}
                  {note.title}
                </p>
                <div className="wave108-note-actions">
                  {isNotePinned(note)
                    ? <button className="wave108-btn wave108-btn-sm wave108-btn-ghost" onClick={() => setNotes((ns) => unpinNote(ns, note.id))}>Unpin</button>
                    : <button className="wave108-btn wave108-btn-sm wave108-btn-ghost" onClick={() => setNotes((ns) => pinNote(ns, note.id))}>Pin to top</button>}
                </div>
              </div>
              <div className="wave108-preview" dangerouslySetInnerHTML={{ __html: markdownToHtmlLite(note.body) }} />
              {note.attachments && note.attachments.length > 0 && (
                <div className="wave108-shots">
                  {note.attachments.map((a) => (
                    <figure className="wave108-shot" key={a.id}>
                      <img src={a.dataUrl} alt={a.caption || 'screenshot'} />
                      <button onClick={() => setNotes((ns) => ns.map((n) => (n.id === note.id ? removeScreenshot(n, a.id) : n)))} aria-label="remove screenshot">✕</button>
                      <figcaption>{a.caption || 'screenshot'}</figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </article>
          ))}
          {notes.length === 0 && <p className="wave108-muted">No notes yet — compose above, or start from a template.</p>}
        </div>
      </section>

      {/* 54309 Timestamped annotations */}
      <section className="wave108-card" id="wave108-annotations">
        <h3>{WAVE108_C_IDEAS[8].title}</h3>
        <div className="wave108-timeline">
          {events.map((evt) => (
            <div key={evt.id} className={`wave108-event${activeEvent === evt.id ? ' active' : ''}`}>
              <span className="wave108-event-time">{evt.time}</span>
              <span style={{ flex: 1 }}>{evt.label}</span>
              <button className="wave108-btn wave108-btn-sm wave108-btn-ghost" onClick={() => setActiveEvent(evt.id)}>Annotate</button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '0.6rem' }}>
          <input
            className="wave108-input"
            style={{ width: '60%' }}
            value={annotationText}
            onChange={(e) => setAnnotationText(e.target.value)}
            placeholder="annotation note"
          />
          <button className="wave108-btn" onClick={addAnnotation}>Attach to {activeEvent}</button>
        </div>
        <div className="wave108-annotations">
          {events.map((evt) => {
            const anns = annotationsForEvent(annotations, evt.id);
            if (anns.length === 0) return null;
            return (
              <ul className="wave108-list" key={evt.id}>
                {anns.map((a) => (
                  <li key={a.id}>
                    <code>{a.eventId}</code> <span className="wave108-muted">{a.createdAt}</span> — <b>{a.author}</b>: {a.text}
                  </li>
                ))}
              </ul>
            );
          })}
          {annotations.length === 0 && <p className="wave108-muted">Pick a timeline event and attach a timestamped note.</p>}
        </div>
      </section>

      {/* Score band reference */}
      <section className="wave108-card">
        <h3>Score bands</h3>
        <p className="wave108-muted">
          {[95, 70, 50, 30, 10].map((s) => (
            <span key={s} style={{ marginRight: '0.75rem' }}>
              <code>{s}</code> <span className={badgeClass(scoreBand(s))}>{scoreBand(s)}</span>
            </span>
          ))}
        </p>
      </section>
    </div>
  );
}
