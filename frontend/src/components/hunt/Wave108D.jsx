import React, { useMemo, useState } from 'react';
import {
  WAVE108_D_IDEAS,
  ATTACHMENT_ALLOWLIST,
  MAX_ATTACHMENT_BYTES,
  createNote,
  attachFile,
  canAccess,
  createSnippet,
  tokenizeSnippet,
  checklistFromLines,
  toggleChecklistItem,
  checklistProgress,
  parseMentions,
  buildMentionNotifications,
  addComment,
  resolveComment,
  saveRevision,
  restoreRevision,
  revisionDiff,
  searchNotes,
  tagNote,
  filterNotesByTag,
  SUGGESTED_TAGS,
  setVisibility,
  canView,
  authorshipLine,
} from './wave108DCores.js';
import './Wave108D.css';

/**
 * Wave 108D — Notes & collaboration workspace demo panel.
 * Infinity AI branding only. Demonstrates ideas 54311–54320.
 */

const DEMO_USERS = [
  { id: 'u-ana', handle: 'ana', name: 'Ana', roles: ['analyst'] },
  { id: 'u-raj', handle: 'raj', name: 'Raj', roles: ['analyst', 'lead'] },
];

const SAMPLE_SNIPPET_CODE = `curl -X POST https://target.example/api/v1/orders \\
  -H "Authorization: Bearer $TOKEN" \\
  -H 'Content-Type: application/json' \\
  --data '{"item_id": 7, "qty": 1}' # replay the order request`;

function buildSampleNotes() {
  // Note 1 — shared scope note with an attachment, a snippet and a checklist.
  let n1 = createNote({
    id: 'note-1',
    title: 'Acme Corp — scope letter',
    body: 'In-scope: *.acme.example, api.acme.example. Out of scope: payments.acme.example.\nDoS and social engineering are out of scope. @raj please confirm the VPN details.',
    authorId: 'u-ana',
    authorName: 'Ana',
    now: '2026-10-09T10:00:00.000Z',
  });
  n1 = tagNote(tagNote(n1, 'scope'), 'contact');
  ({ note: n1 } = attachFile(n1, {
    name: 'acme-scope-letter.pdf',
    mime: 'application/pdf',
    size: 184320,
    access: { level: 'roles', roles: ['analyst'] },
  }));
  n1 = {
    ...n1,
    snippets: [...n1.snippets, createSnippet('curl', SAMPLE_SNIPPET_CODE)],
    checklist: checklistFromLines([
      'Confirm scope letter signed',
      'Provision VPN credentials',
      'Create test accounts',
      'Share safe-harbor wording with legal',
    ]),
  };

  // Note 2 — private credential note with a comment thread.
  let n2 = createNote({
    id: 'note-2',
    title: 'VPN credentials handoff',
    body: 'WireGuard config received from the client. Rotate after the engagement ends.',
    authorId: 'u-raj',
    authorName: 'Raj',
    now: '2026-10-09T14:30:00.000Z',
  });
  n2 = tagNote(tagNote(n2, 'credential'), 'access');
  n2 = setVisibility(n2, 'private');
  ({ note: n2 } = attachFile(n2, {
    name: 'acme-vpn.conf',
    mime: 'text/plain',
    size: 2411,
    access: { level: 'roles', roles: ['lead'] },
  }));
  n2 = addComment(n2, { author: 'Ana', body: 'Config validated on my side — tunnel comes up clean.' });
  n2 = addComment(n2, { author: 'Raj', body: 'Confirmed. I will rotate the keys on Friday.' });

  // Note 3 — shared payload scratchpad with a revision history.
  let n3 = createNote({
    id: 'note-3',
    title: 'SQLi payload scratchpad',
    body: "Parameter q on /search reflects input.\nTry: ' OR '1'='1",
    authorId: 'u-ana',
    authorName: 'Ana',
    now: '2026-10-08T09:15:00.000Z',
  });
  n3 = tagNote(n3, 'scope');
  n3 = saveRevision(n3, "Parameter q on /search reflects input.\nTry: ' OR '1'='1\nAlso test time-based: ' OR SLEEP(5)-- -", 'Ana');
  n3 = saveRevision(n3, "Parameter q on /search reflects input.\nConfirmed boolean-based blind SQLi.\nPoC: ' OR (SELECT 1 FROM (SELECT SLEEP(5))x)-- -", 'Raj');

  return [n1, n2, n3];
}

/** Renders <<highlighted>> markers from search snippets as <mark>. */
function renderHighlight(text) {
  const parts = String(text).split(/<<|>>/);
  return parts.map((part, idx) =>
    idx % 2 === 1
      ? <mark key={idx} className="wave108d-mark">{part}</mark>
      : <span key={idx}>{part}</span>
  );
}

function tokenClass(kind) {
  switch (kind) {
    case 'comment': return 'wave108d-tok-comment';
    case 'string': return 'wave108d-tok-string';
    case 'flag': return 'wave108d-tok-flag';
    case 'keyword': return 'wave108d-tok-keyword';
    default: return 'wave108d-tok-plain';
  }
}

export default function Wave108D() {
  const [notes, setNotes] = useState(buildSampleNotes);
  const [activeNoteId, setActiveNoteId] = useState('note-1');
  const [viewerId, setViewerId] = useState('u-ana');
  const [attachError, setAttachError] = useState(null);
  const [snippetLang, setSnippetLang] = useState('curl');
  const [snippetCode, setSnippetCode] = useState(SAMPLE_SNIPPET_CODE);
  const [mentionText, setMentionText] = useState('Reviewing this with @raj before the kickoff.');
  const [mentionNotes, setMentionNotes] = useState([]);
  const [commentBody, setCommentBody] = useState('');
  const [revisionBody, setRevisionBody] = useState('');
  const [diffFor, setDiffFor] = useState(null);
  const [query, setQuery] = useState('scope');
  const [tagInput, setTagInput] = useState('');
  const [tagFilter, setTagFilter] = useState(null);

  const viewer = DEMO_USERS.find((u) => u.id === viewerId);
  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];
  const viewerCanSee = canView(activeNote, viewer);

  const updateActiveNote = (fn) => {
    setNotes((prev) => prev.map((n) => (n.id === activeNoteId ? fn(n) : n)));
  };

  const tryAttach = (file) => {
    setAttachError(null);
    try {
      const { note } = attachFile(activeNote, file);
      setNotes((prev) => prev.map((n) => (n.id === activeNoteId ? note : n)));
    } catch (err) {
      setAttachError(err.message);
    }
  };

  const allTags = useMemo(() => {
    const set = new Set();
    notes.forEach((n) => (n.tags || []).forEach((t) => set.add(t)));
    return [...set];
  }, [notes]);

  const visibleNotes = useMemo(() => notes.filter((n) => canView(n, viewer)), [notes, viewer]);
  const filteredNotes = tagFilter ? filterNotesByTag(visibleNotes, tagFilter) : visibleNotes;
  const searchHits = useMemo(() => searchNotes(visibleNotes, query), [visibleNotes, query]);
  const progress = checklistProgress(activeNote.checklist);
  const parsedMentions = parseMentions(mentionText);
  const diff = diffFor ? revisionDiff(
    activeNote.revisions.find((r) => r.id === diffFor)?.body ?? '',
    activeNote.body
  ) : null;

  return (
    <div className="wave108d">
      <header className="wave108d-head">
        <h2 className="wave108d-title">Notes &amp; Collaboration — Infinity AI</h2>
        <p className="wave108d-sub">Wave 108D · ideas 54311–54320 · hunt notes workspace</p>
        <div className="wave108d-viewer">
          <span className="wave108d-muted">Viewing as</span>
          {DEMO_USERS.map((u) => (
            <button
              key={u.id}
              className={`wave108d-btn ${u.id === viewerId ? '' : 'wave108d-btn-ghost'}`}
              onClick={() => setViewerId(u.id)}
            >
              {u.name}
            </button>
          ))}
        </div>
      </header>

      {/* Notes overview with authorship (54320) + visibility (54319) */}
      <section className="wave108d-card">
        <h3>Notes inventory</h3>
        <div className="wave108d-grid">
          {notes.map((note) => {
            const allowed = canView(note, viewer);
            return (
              <button
                key={note.id}
                className={`wave108d-note-card ${note.id === activeNoteId ? 'wave108d-note-card-active' : ''}`}
                onClick={() => setActiveNoteId(note.id)}
              >
                <span className="wave108d-note-title">{note.title}</span>
                <span className="wave108d-muted">{authorshipLine(note)}</span>
                <span className="wave108d-badges">
                  <span className={`wave108d-badge ${note.visibility.mode === 'private' ? 'wave108d-badge-private' : ''}`}>
                    {note.visibility.mode === 'private' ? 'private' : 'shared'}
                  </span>
                  {!allowed && <span className="wave108d-badge wave108d-badge-locked">locked for {viewer.name}</span>}
                </span>
                <span className="wave108d-tags">
                  {(note.tags || []).map((t) => <span key={t} className="wave108d-tag">#{t}</span>)}
                </span>
              </button>
            );
          })}
        </div>
        {!viewerCanSee && (
          <p className="wave108d-warn">
            This note is private to its author — switch the viewer to the author to open it.
          </p>
        )}
      </section>

      {viewerCanSee && (
        <>
          {/* 54311 File attachments */}
          <section className="wave108d-card">
            <h3>{WAVE108_D_IDEAS[0].title}</h3>
            <ul className="wave108d-list">
              {activeNote.attachments.map((att) => (
                <li key={att.id} className="wave108d-attach">
                  <span className="wave108d-attach-name">{att.name}</span>
                  <span className="wave108d-muted">{(att.size / 1024).toFixed(1)} KB · .{att.ext}</span>
                  <span className={`wave108d-badge ${att.access.level === 'roles' ? 'wave108d-badge-private' : ''}`}>
                    {att.access.level === 'roles' ? `roles: ${att.access.roles.join(', ')}` : 'anyone'}
                  </span>
                  {!canAccess(att, viewer) && <span className="wave108d-badge wave108d-badge-locked">no access</span>}
                </li>
              ))}
              {activeNote.attachments.length === 0 && <li className="wave108d-muted">No attachments yet.</li>}
            </ul>
            <div className="wave108d-actions">
              <button className="wave108d-btn" onClick={() => tryAttach({ name: 'updated-scope.pdf', mime: 'application/pdf', size: 96200, access: { level: 'roles', roles: ['analyst'] } })}>
                Attach PDF
              </button>
              <button className="wave108d-btn" onClick={() => tryAttach({ name: 'client.ovpn', mime: 'application/octet-stream', size: 3100, access: { level: 'anyone' } })}>
                Attach VPN config
              </button>
              <button className="wave108d-btn wave108d-btn-ghost" onClick={() => tryAttach({ name: 'payload.exe', mime: 'application/octet-stream', size: 1200 })}>
                Try .exe (blocked)
              </button>
              <button className="wave108d-btn wave108d-btn-ghost" onClick={() => tryAttach({ name: 'evidence.pdf', mime: 'application/pdf', size: MAX_ATTACHMENT_BYTES + 1 })}>
                Try 25MB+ file (blocked)
              </button>
            </div>
            {attachError && <p className="wave108d-warn">{attachError}</p>}
            <p className="wave108d-muted">Allowed: {ATTACHMENT_ALLOWLIST.map((e) => `.${e}`).join(' ')} · max 25 MB per file.</p>
          </section>

          {/* 54312 Code snippet blocks */}
          <section className="wave108d-card">
            <h3>{WAVE108_D_IDEAS[1].title}</h3>
            {activeNote.snippets.map((snippet) => (
              <pre key={snippet.id} className="wave108d-pre">
                <div className="wave108d-snippet-lang">{snippet.language}</div>
                <code>
                  {tokenizeSnippet(snippet.code, snippet.language).map((tok, idx) => (
                    <span key={idx} className={tokenClass(tok.kind)}>{tok.text}</span>
                  ))}
                </code>
              </pre>
            ))}
            <div className="wave108d-form">
              <select className="wave108d-input wave108d-select" value={snippetLang} onChange={(e) => setSnippetLang(e.target.value)}>
                <option value="curl">curl</option>
                <option value="bash">bash</option>
                <option value="sql">sql</option>
                <option value="python">python</option>
                <option value="http">http</option>
                <option value="json">json</option>
              </select>
              <textarea
                className="wave108d-textarea"
                rows={4}
                value={snippetCode}
                onChange={(e) => setSnippetCode(e.target.value)}
                placeholder="Paste a curl command, config or payload…"
              />
              <button
                className="wave108d-btn"
                onClick={() => {
                  try {
                    const block = createSnippet(snippetLang, snippetCode);
                    updateActiveNote((n) => ({ ...n, snippets: [...n.snippets, block] }));
                  } catch (err) {
                    setAttachError(err.message);
                  }
                }}
              >
                Add snippet
              </button>
            </div>
          </section>

          {/* 54313 Checklists inside notes */}
          <section className="wave108d-card">
            <h3>{WAVE108_D_IDEAS[2].title}</h3>
            <div className="wave108d-progress">
              <div className="wave108d-progress-bar" style={{ width: `${progress}%` }} />
              <span className="wave108d-progress-label">{progress}% complete</span>
            </div>
            <ul className="wave108d-list">
              {activeNote.checklist.map((item) => (
                <li key={item.id}>
                  <label className="wave108d-check">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => updateActiveNote((n) => ({ ...n, checklist: toggleChecklistItem(n.checklist, item.id) }))}
                    />
                    <span className={item.done ? 'wave108d-done' : ''}>{item.text}</span>
                  </label>
                </li>
              ))}
              {activeNote.checklist.length === 0 && <li className="wave108d-muted">No checklist on this note.</li>}
            </ul>
          </section>

          {/* 54314 @mentions in notes */}
          <section className="wave108d-card">
            <h3>{WAVE108_D_IDEAS[3].title}</h3>
            <textarea className="wave108d-textarea" rows={2} value={mentionText} onChange={(e) => setMentionText(e.target.value)} />
            <div className="wave108d-actions">
              {parsedMentions.map((m) => <span key={m} className="wave108d-mention">{m}</span>)}
              {parsedMentions.length === 0 && <span className="wave108d-muted">No @mentions detected.</span>}
            </div>
            <button
              className="wave108d-btn"
              onClick={() => setMentionNotes(buildMentionNotifications({ ...activeNote, body: `${activeNote.body}\n${mentionText}` }, DEMO_USERS))}
            >
              Send mention notifications
            </button>
            <ul className="wave108d-list">
              {mentionNotes.map((notif) => (
                <li key={notif.userId} className="wave108d-muted">
                  → <b>{notif.handle}</b>: {notif.message} <span className="wave108d-faint">({notif.excerpt})</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 54315 Note comment threads */}
          <section className="wave108d-card">
            <h3>{WAVE108_D_IDEAS[4].title}</h3>
            <ul className="wave108d-list">
              {activeNote.comments.map((comment) => (
                <li key={comment.id} className={`wave108d-comment ${comment.resolved ? 'wave108d-comment-resolved' : ''}`}>
                  <b>{comment.author}</b>
                  {comment.resolved && <span className="wave108d-badge">resolved by {comment.resolvedBy}</span>}
                  <p>{comment.body}</p>
                  {!comment.resolved && (
                    <button
                      className="wave108d-btn wave108d-btn-ghost wave108d-btn-sm"
                      onClick={() => updateActiveNote((n) => resolveComment(n, comment.id, viewer.name))}
                    >
                      Resolve thread
                    </button>
                  )}
                </li>
              ))}
              {activeNote.comments.length === 0 && <li className="wave108d-muted">No comments yet.</li>}
            </ul>
            <div className="wave108d-form">
              <input
                className="wave108d-input"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder={`Comment as ${viewer.name}…`}
              />
              <button
                className="wave108d-btn"
                onClick={() => {
                  if (!commentBody.trim()) return;
                  updateActiveNote((n) => addComment(n, { author: viewer.name, body: commentBody.trim() }));
                  setCommentBody('');
                }}
              >
                Add comment
              </button>
            </div>
          </section>

          {/* 54316 Note version history */}
          <section className="wave108d-card">
            <h3>{WAVE108_D_IDEAS[5].title}</h3>
            <div className="wave108d-form">
              <textarea
                className="wave108d-textarea"
                rows={3}
                value={revisionBody || activeNote.body}
                onChange={(e) => setRevisionBody(e.target.value)}
                placeholder="Edit note body…"
              />
              <button
                className="wave108d-btn"
                onClick={() => {
                  const body = (revisionBody || activeNote.body).trim();
                  updateActiveNote((n) => saveRevision(n, body, viewer.name));
                  setRevisionBody('');
                  setDiffFor(null);
                }}
              >
                Save revision
              </button>
            </div>
            <ul className="wave108d-list">
              {activeNote.revisions.map((rev) => (
                <li key={rev.id} className="wave108d-rev">
                  <span className="wave108d-muted"><code>{rev.id}</code> · {rev.author}</span>
                  <span className="wave108d-actions">
                    <button className="wave108d-btn wave108d-btn-ghost wave108d-btn-sm" onClick={() => setDiffFor(diffFor === rev.id ? null : rev.id)}>
                      {diffFor === rev.id ? 'Hide diff' : 'Diff vs current'}
                    </button>
                    <button
                      className="wave108d-btn wave108d-btn-ghost wave108d-btn-sm"
                      onClick={() => {
                        updateActiveNote((n) => restoreRevision(n, rev.id, viewer.name).note);
                        setDiffFor(null);
                      }}
                    >
                      Restore
                    </button>
                  </span>
                </li>
              ))}
              {activeNote.revisions.length === 0 && <li className="wave108d-muted">No revisions yet.</li>}
            </ul>
            {diff && (
              <pre className="wave108d-pre wave108d-diff">
                {diff.segments.map((seg, idx) => (
                  <div key={idx} className={seg.type === 'add' ? 'wave108d-diff-add' : seg.type === 'del' ? 'wave108d-diff-del' : 'wave108d-diff-same'}>
                    {seg.type === 'add' ? '+ ' : seg.type === 'del' ? '− ' : '  '}{seg.line}
                  </div>
                ))}
              </pre>
            )}
          </section>

          {/* 54317 Full-text note search */}
          <section className="wave108d-card">
            <h3>{WAVE108_D_IDEAS[6].title}</h3>
            <input className="wave108d-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes…" />
            <ul className="wave108d-list">
              {searchHits.map((hit) => (
                <li key={hit.note.id} className="wave108d-hit">
                  <b>{hit.note.title}</b>
                  <span className="wave108d-muted"> · matched {hit.field} · score {hit.score}</span>
                  <p className="wave108d-snippet">{renderHighlight(hit.snippet)}</p>
                </li>
              ))}
              {searchHits.length === 0 && <li className="wave108d-muted">No matches.</li>}
            </ul>
          </section>

          {/* 54318 Note tags */}
          <section className="wave108d-card">
            <h3>{WAVE108_D_IDEAS[7].title}</h3>
            <div className="wave108d-actions">
              {(activeNote.tags || []).map((t) => <span key={t} className="wave108d-tag">#{t}</span>)}
              {(activeNote.tags || []).length === 0 && <span className="wave108d-muted">No tags.</span>}
            </div>
            <div className="wave108d-form">
              <input className="wave108d-input" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Add tag (e.g. credential)" />
              <button
                className="wave108d-btn"
                onClick={() => {
                  if (!tagInput.trim()) return;
                  updateActiveNote((n) => tagNote(n, tagInput.trim()));
                  setTagInput('');
                }}
              >
                Add tag
              </button>
            </div>
            <div className="wave108d-actions">
              <span className="wave108d-muted">Suggested:</span>
              {SUGGESTED_TAGS.map((t) => (
                <button key={t} className="wave108d-btn wave108d-btn-ghost wave108d-btn-sm" onClick={() => updateActiveNote((n) => tagNote(n, t))}>
                  #{t}
                </button>
              ))}
            </div>
            <div className="wave108d-actions">
              <span className="wave108d-muted">Filter inventory:</span>
              <button className={`wave108d-btn wave108d-btn-sm ${tagFilter ? 'wave108d-btn-ghost' : ''}`} onClick={() => setTagFilter(null)}>All</button>
              {allTags.map((t) => (
                <button
                  key={t}
                  className={`wave108d-btn wave108d-btn-sm ${tagFilter === t ? '' : 'wave108d-btn-ghost'}`}
                  onClick={() => setTagFilter(t)}
                >
                  #{t}
                </button>
              ))}
            </div>
            {tagFilter && (
              <p className="wave108d-muted">
                Notes tagged <b>#{tagFilter}</b>: {filteredNotes.map((n) => n.title).join(', ') || 'none'}
              </p>
            )}
          </section>

          {/* 54319 Private vs shared notes */}
          <section className="wave108d-card">
            <h3>{WAVE108_D_IDEAS[8].title}</h3>
            <p className="wave108d-muted">
              Current visibility: <b>{activeNote.visibility.mode}</b>
              {activeNote.visibility.roles.length > 0 && ` (roles: ${activeNote.visibility.roles.join(', ')})`}
            </p>
            <div className="wave108d-actions">
              <button className="wave108d-btn" onClick={() => updateActiveNote((n) => setVisibility(n, 'shared'))}>
                Make shared
              </button>
              <button className="wave108d-btn" onClick={() => updateActiveNote((n) => setVisibility(n, 'shared', ['lead']))}>
                Share with leads only
              </button>
              <button className="wave108d-btn wave108d-btn-ghost" onClick={() => updateActiveNote((n) => setVisibility(n, 'private'))}>
                Make private
              </button>
            </div>
            <p className="wave108d-muted">
              Access check — Ana: {canView(activeNote, DEMO_USERS[0]) ? 'can view' : 'blocked'} ·
              Raj: {canView(activeNote, DEMO_USERS[1]) ? 'can view' : 'blocked'}
            </p>
          </section>

          {/* 54320 Note authorship display */}
          <section className="wave108d-card">
            <h3>{WAVE108_D_IDEAS[9].title}</h3>
            <p className="wave108d-authorship">{authorshipLine(activeNote)}</p>
            <p className="wave108d-muted">
              Created {new Date(activeNote.createdAt).toLocaleString()} ·
              last updated {new Date(activeNote.updatedAt).toLocaleString()}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
