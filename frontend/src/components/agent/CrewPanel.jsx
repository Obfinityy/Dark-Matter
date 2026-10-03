/**
 * CrewPanel — Infinity Crew: persistent AI coworkers inside Control mode.
 *
 * Each crew member is a named AI coworker (name, role, instructions, allowed
 * tools) with its own computer. The section sits ABOVE the one-shot computer
 * task panel in Control mode — that flow is untouched.
 *
 * Everything here calls the real backend (POST /api/v1/crew + SSE).
 * No mock UI, no simulated runs.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Users, Plus, X, Trash2, Send, Monitor, Terminal, FolderOpen,
  Loader2, Square, Bot
} from 'lucide-react';
import {
  listCrews, createCrew, deleteCrew,
  chatWithCrew, stopCrewRun, subscribeToCrewEvents
} from '../../services/api';
import { LiveScreenViewer } from './LiveScreenViewer';

const ALL_TOOLS = [
  { id: 'computer', label: 'Computer', icon: Monitor, hint: 'See and operate the desktop' },
  { id: 'shell', label: 'Shell', icon: Terminal, hint: 'Run terminal commands' },
  { id: 'files', label: 'Files', icon: FolderOpen, hint: 'Read and write files' }
];

const STATUS_META = {
  idle: { label: 'Idle', dot: 'idle' },
  running: { label: 'Working', dot: 'running' },
  waiting_brain: { label: 'No brain connected', dot: 'waiting_brain' }
};

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function describeCrewAction(ev) {
  const data = ev.data || {};
  const action = data.action || ev.action;
  if (!action) return ev.message || ev.text || 'Working…';
  const label = action.type ? action.type.replace(/_/g, ' ') : 'action';
  const p = action.params || {};
  const detail = p.text
    ? `: "${String(p.text).slice(0, 60)}"`
    : p.url
      ? ` → ${p.url}`
      : p.name
        ? `: ${p.name}`
        : p.command
          ? `: ${String(p.command).slice(0, 60)}`
          : '';
  return `${label}${detail}`;
}

/* ── One run event, rendered by type ─────────────────────────────────────── */
function CrewEventRow({ ev, crewName }) {
  const type = ev.__sseType;
  const text = ev.message || ev.text || '';

  if (type === 'user') {
    return (
      <div className="sg-crew-msg user"><span>{text}</span></div>
    );
  }
  if (type === 'reply') {
    return (
      <div className="sg-crew-msg crew">
        <div className="sg-crew-msg-head">{crewName}</div>
        <span>{text}</span>
      </div>
    );
  }
  if (type === 'thinking') {
    return <div className="sg-crew-thinking">💭 {text || 'Thinking…'}</div>;
  }
  if (type === 'action') {
    return (
      <div className="sg-crew-action">
        <span className="sg-chip"><Bot size={12} /> {describeCrewAction(ev)}</span>
      </div>
    );
  }
  if (type === 'observation') {
    return (
      <details className="sg-crew-obs">
        <summary>👁️ Observation — {text ? String(text).slice(0, 60) : 'see details'}</summary>
        <pre>{text || JSON.stringify(ev.data || ev, null, 2)}</pre>
      </details>
    );
  }
  if (type === 'waiting') {
    return (
      <div className="sg-crew-notice warn" role="alert">
        ⚠️ No brain configured — connect a model on the Models page.
      </div>
    );
  }
  if (type === 'done') {
    return <div className="sg-crew-notice ok">✅ {text || 'Run completed.'}</div>;
  }
  if (type === 'error') {
    return <div className="sg-crew-notice bad" role="alert">❌ {text || 'Something went wrong.'}</div>;
  }
  if (type === 'stopped') {
    return <div className="sg-crew-notice">🛑 {text || 'Run stopped.'}</div>;
  }
  return <div className="sg-crew-row">{text || type}</div>;
}

/* ── One crew member card ────────────────────────────────────────────────── */
function CrewCard({ crew, status, selected, deleting, onSelect, onDelete }) {
  const meta = STATUS_META[status] || STATUS_META.idle;
  return (
    <div
      className={`sg-crew-card${selected ? ' selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
      title={`${crew.name} — ${meta.label}. Click to chat.`}
    >
      <div className="sg-crew-avatar" aria-hidden="true">{initials(crew.name)}</div>
      <div className="sg-crew-card-body">
        <div className="sg-crew-card-name">{crew.name}</div>
        <div className="sg-crew-card-role">{crew.role}</div>
      </div>
      <span className={`sg-status-dot ${meta.dot}`} title={meta.label} aria-label={`Status: ${meta.label}`} />
      <button
        className="sg-chip-x"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        disabled={deleting}
        title={`Remove ${crew.name}`}
        aria-label={`Remove ${crew.name}`}
      >
        {deleting ? <Loader2 size={13} className="sg-spin" /> : <Trash2 size={13} />}
      </button>
    </div>
  );
}

/* ── Collapsible "new crew member" form ───────────────────────────────────── */
function CrewForm({ onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [instructions, setInstructions] = useState('');
  const [tools, setTools] = useState(['computer', 'shell', 'files']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleTool = (id) =>
    setTools((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const submit = async () => {
    if (!name.trim() || !role.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await createCrew({
        name: name.trim(),
        role: role.trim(),
        instructions: instructions.trim(),
        toolsAllowed: tools
      });
      onCreated(res?.crew || null);
    } catch (err) {
      setError(err.message || 'Could not create the crew member.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sg-crew-form">
      <div className="sg-crew-field">
        <label htmlFor="crew-name">Name</label>
        <input
          id="crew-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Nova"
          maxLength={60}
        />
      </div>
      <div className="sg-crew-field">
        <label htmlFor="crew-role">Role</label>
        <input
          id="crew-role"
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. Research assistant — gathers data from the web"
          maxLength={120}
        />
      </div>
      <div className="sg-crew-field">
        <label htmlFor="crew-instructions">Instructions (optional)</label>
        <textarea
          id="crew-instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="How should this coworker behave? What should it always do or never do?"
          maxLength={2000}
        />
      </div>
      <div className="sg-crew-field">
        <label>Tools allowed</label>
        <div className="sg-crew-tools">
          {ALL_TOOLS.map(({ id, label, icon: Icon, hint }) => (
            <label key={id} className={`sg-crew-tool${tools.includes(id) ? ' on' : ''}`} title={hint}>
              <input
                type="checkbox"
                checked={tools.includes(id)}
                onChange={() => toggleTool(id)}
              />
              <Icon size={14} />
              {label}
            </label>
          ))}
        </div>
      </div>
      {error && <div className="sg-auth-error" role="alert">{error}</div>}
      <div className="sg-crew-form-actions">
        <button className="sg-btn sg-btn-ghost sg-btn-sm" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          className="sg-btn sg-btn-primary sg-btn-sm"
          onClick={submit}
          disabled={!name.trim() || !role.trim() || saving}
        >
          {saving ? <Loader2 size={14} className="sg-spin" /> : <Plus size={14} />}
          {saving ? 'Adding…' : 'Add crew member'}
        </button>
      </div>
    </div>
  );
}

/* ── Per-crew chat + live computer view ──────────────────────────────────── */
function CrewChat({ crew, onClose, onStatus }) {
  const [events, setEvents] = useState([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const unsubRef = useRef(null);
  const endRef = useRef(null);

  const pushEvent = (ev) => setEvents((prev) => [...prev.slice(-300), ev]);

  const handleEvent = useCallback((ev) => {
    const type = ev.__sseType;
    pushEvent({ ...ev, id: ev.id || `ev-${Date.now()}-${Math.random()}`, at: ev.at || new Date().toISOString() });
    if (type === 'waiting') {
      setRunning(false);
      onStatus('waiting_brain');
    } else if (type === 'done' || type === 'stopped' || type === 'error') {
      setRunning(false);
      onStatus('idle');
    } else if (type === 'thinking' || type === 'action' || type === 'observation' || type === 'reply') {
      setRunning(true);
      onStatus('running');
    }
  }, [onStatus]);

  useEffect(() => {
    const unsub = subscribeToCrewEvents(crew.id, {
      onEvent: handleEvent,
      onError: () => {}
    });
    unsubRef.current = unsub;
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
      onStatus('idle');
    };
  }, [crew.id, handleEvent, onStatus]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [events]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || sending) return;
    setSending(true);
    setError('');
    pushEvent({ __sseType: 'user', message: msg, at: new Date().toISOString() });
    setInput('');
    try {
      await chatWithCrew(crew.id, msg);
      setRunning(true);
      onStatus('running');
    } catch (err) {
      setError(err.message || 'Could not send the message.');
    } finally {
      setSending(false);
    }
  };

  const stop = async () => {
    try {
      await stopCrewRun(crew.id);
    } catch {
      /* run may already be finished */
    }
  };

  return (
    <div className="sg-crew-chat">
      <div className="sg-crew-chat-head">
        <div className="sg-crew-avatar sm" aria-hidden="true">{initials(crew.name)}</div>
        <div className="sg-crew-chat-head-text">
          <strong>{crew.name}</strong>
          <div className="sg-small">{crew.role}</div>
        </div>
        {running && (
          <span className="sg-chip">
            <Loader2 size={12} className="sg-spin" /> Working…
          </span>
        )}
        <button className="sg-btn sg-btn-ghost sg-btn-sm" onClick={onClose}>
          <X size={14} /> Close
        </button>
      </div>

      <div className="sg-crew-workspace">
        <div className="sg-crew-thread">
          <div className="sg-crew-events" aria-live="polite">
            {events.length === 0 ? (
              <div className="sg-crew-empty-events">
                Say hello — {crew.name} will start working on its own computer.
              </div>
            ) : (
              events.map((ev, i) => (
                <CrewEventRow key={ev.id || i} ev={ev} crewName={crew.name} />
              ))
            )}
            <div ref={endRef} />
          </div>

          <div className="sg-chat-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder={`Message ${crew.name}…`}
              aria-label={`Message ${crew.name}`}
            />
            {running ? (
              <button
                onClick={stop}
                aria-label={`Stop ${crew.name}`}
                title={`Stop ${crew.name}'s run`}
                className="sg-crew-stop-pulse"
              >
                <Square size={16} />
              </button>
            ) : (
              <button
                onClick={send}
                disabled={!input.trim() || sending}
                aria-label="Send message"
                title="Send message"
              >
                <Send size={16} />
              </button>
            )}
          </div>
          {error && <div className="sg-auth-error" role="alert">{error}</div>}
        </div>

        {running && (
          <div className="sg-crew-viewer">
            <LiveScreenViewer
              assessmentId={crew.id}
              subscribe={(id, handlers) => subscribeToCrewEvents(id, handlers)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── The section itself ──────────────────────────────────────────────────── */
export function CrewPanel() {
  const [crews, setCrews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [statuses, setStatuses] = useState({}); // crewId -> live status

  const refresh = useCallback(async () => {
    try {
      setError('');
      const res = await listCrews();
      setCrews(res?.crews || []);
    } catch (err) {
      setError(err.message || 'Could not load crew members.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreated = (crew) => {
    setFormOpen(false);
    refresh();
    if (crew?.id) setSelectedId(crew.id);
  };

  const handleDelete = async (crew) => {
    if (!window.confirm(`Remove ${crew.name} from the crew?`)) return;
    setDeletingId(crew.id);
    try {
      // Best-effort: stop an active run before removing the member.
      try { await stopCrewRun(crew.id); } catch { /* not running */ }
      await deleteCrew(crew.id);
      if (selectedId === crew.id) setSelectedId(null);
      setStatuses((prev) => {
        const next = { ...prev };
        delete next[crew.id];
        return next;
      });
      refresh();
    } catch (err) {
      setError(err.message || 'Could not remove the crew member.');
    } finally {
      setDeletingId(null);
    }
  };

  const statusFor = (crew) => statuses[crew.id] || crew.status || 'idle';
  const selected = crews.find((c) => c.id === selectedId) || null;

  return (
    <div className="sg-crew-section">
      <div className="sg-crew-head">
        <div>
          <h3 className="sg-crew-title"><Users size={18} /> Infinity Crew</h3>
          <p className="sg-small">
            Your persistent AI coworkers — each with its own computer.
            Pick one to chat and put it to work.
          </p>
        </div>
        <button
          className="sg-btn sg-btn-primary sg-btn-sm"
          onClick={() => setFormOpen((o) => !o)}
          aria-expanded={formOpen}
        >
          {formOpen ? <X size={14} /> : <Plus size={14} />}
          {formOpen ? 'Close' : 'New crew member'}
        </button>
      </div>

      {error && <div className="sg-auth-error" role="alert">{error}</div>}

      {formOpen && <CrewForm onCreated={handleCreated} onCancel={() => setFormOpen(false)} />}

      {loading ? (
        <div className="sg-loading-box"><Loader2 size={20} className="sg-spin" /> Loading your crew…</div>
      ) : crews.length === 0 && !formOpen ? (
        <div className="sg-crew-empty">
          No crew members yet — add your first coworker above.
        </div>
      ) : (
        <div className="sg-crew-list">
          {crews.map((crew) => (
            <CrewCard
              key={crew.id}
              crew={crew}
              status={statusFor(crew)}
              selected={crew.id === selectedId}
              deleting={deletingId === crew.id}
              onSelect={() => setSelectedId(crew.id === selectedId ? null : crew.id)}
              onDelete={() => handleDelete(crew)}
            />
          ))}
        </div>
      )}

      {selected && (
        <CrewChat
          key={selected.id}
          crew={selected}
          onClose={() => setSelectedId(null)}
          onStatus={(s) => setStatuses((prev) => ({ ...prev, [selected.id]: s }))}
        />
      )}
    </div>
  );
}
