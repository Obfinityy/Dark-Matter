/**
 * TestLifecycleRound2.jsx — wave 38 (ideas 51481–51508): test-request
 * lifecycle round 2.
 * Real working components driving local state — no canned-only controls.
 * All logic comes from testLifecycleCore.js.
 * The TestLifecycleRound2Gallery is exported for review only; it is not
 * mounted in app UI.
 */
import React, { useState } from 'react';
import {
  stepRendererState,
  killSwitchRequest, applyKill,
  followUpRequest,
  promoteTestToFinding,
  labelTest,
  newCommentThread, addComment, resolveComment,
  requestApiPayload, validateApiPayload,
  quotaStatus,
  TECHNIQUE_INFO, techniqueInfo, riskBadge,
  rollbackPlan,
  exportTestEvidence,
  replayTest,
  diffTestResults,
  newChatThread, addChatMessage,
  autoDocEntries,
  recordTestOutcome, successMetrics,
  addIdea, claimIdea,
  queueReorder,
  ENVIRONMENTS, environmentDescriptor,
  credentialDescriptor,
  recordSession,
  shareTestLink,
  recordFeedback, feedbackSummary,
  TEMPLATE_GALLERY, installTemplate,
  dependencyGraph,
  predictOutcome,
  archiveTest, restoreTest,
} from './testLifecycleCore.js';

function Card({ n, title, children }) {
  return (
    <div className="tl38-card" data-idea={n}>
      <div className="tl38-card-head"><span className="tl38-num">{n}</span><h4>{title}</h4></div>
      <div className="tl38-card-body">{children}</div>
    </div>
  );
}

/* 51481 */ export function StreamCard() {
  const steps = ['Resolve target', 'Send payloads', 'Collect responses', 'Analyze results'];
  const [activeIndex, setActiveIndex] = useState(0);
  const states = stepRendererState(steps, activeIndex);
  const finished = activeIndex >= steps.length;
  return (
    <Card n="51481" title="Test result streaming">
      <ul className="tl38-steps">
        {states.map((s, i) => <li key={i} className={`tl38-step ${s.state}`}>{i + 1}. {s.label} — {s.state}</li>)}
      </ul>
      <div className="tl38-row">
        <button className="tl38-btn" disabled={activeIndex === 0} onClick={() => setActiveIndex(activeIndex - 1)}>Previous step</button>
        <button className="tl38-btn tl38-btn-primary" disabled={finished} onClick={() => setActiveIndex(activeIndex + 1)}>Next step</button>
        {finished && <button className="tl38-btn" onClick={() => setActiveIndex(0)}>Restart</button>}
      </div>
    </Card>
  );
}

/* 51482 */ export function KillSwitchCard() {
  const [tests, setTests] = useState([{ id: 'tq-7', technique: 'ssrf', target: '/api/fetch', status: 'running' }]);
  const [reason, setReason] = useState('payload hitting production endpoint');
  const [request, setRequest] = useState(null);
  const kill = () => {
    const req = killSwitchRequest('tq-7', reason);
    setRequest(req);
    setTests(applyKill(tests, 'tq-7', req.reason));
  };
  const t = tests[0];
  return (
    <Card n="51482" title="Test interruption kill switch">
      <p>{t.id} · {t.technique} → {t.target} · <strong>{t.status}</strong></p>
      <input className="tl38-input" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="kill reason" />
      <div className="tl38-row">
        <button className="tl38-btn tl38-btn-primary" disabled={t.status !== 'running'} onClick={kill}>Kill test</button>
      </div>
      {request && <p className="tl38-warn">Kill requested — {request.reason}. Test status: {t.status}.</p>}
    </Card>
  );
}

/* 51483 */ export function FollowUpCard() {
  const test = { id: 'tq-8', technique: 'sqli', target: '/api/login', status: 'done' };
  const [focus, setFocus] = useState('boolean-based payloads on the password field');
  const [queue, setQueue] = useState([]);
  return (
    <Card n="51483" title="Test follow-ups">
      <p>{test.id} · {test.technique} → {test.target} · {test.status}</p>
      <input className="tl38-input" value={focus} onChange={(e) => setFocus(e.target.value)} aria-label="follow-up focus" />
      <div className="tl38-row">
        <button className="tl38-btn tl38-btn-primary" onClick={() => setQueue([...queue, followUpRequest(test, focus)])}>Request follow-up</button>
      </div>
      {queue.length > 0 && (
        <ul className="tl38-list">
          {queue.map((f, i) => <li key={i}>→ {f.technique} @ {f.target} · focus: {f.focus} · {f.status}</li>)}
        </ul>
      )}
    </Card>
  );
}

/* 51484 */ export function PromoteCard() {
  const test = { id: 'tq-9', technique: 'sqli', target: '/api/login', status: 'done' };
  const result = { vulnerable: true, severity: 'high', evidence: ['MySQL error in response body', 'Response delay matched sleep(5) payload'] };
  const [draft, setDraft] = useState(null);
  return (
    <Card n="51484" title="Test-to-finding promotion">
      <p>{test.id} · {test.technique} → {test.target} · vulnerable: {result.vulnerable ? 'yes' : 'no'}</p>
      <div className="tl38-row">
        <button className="tl38-btn tl38-btn-primary" onClick={() => setDraft(promoteTestToFinding(test, result))}>Promote to finding</button>
      </div>
      {draft && (
        <div>
          <p><strong>{draft.title}</strong></p>
          <p>Severity: <span className="tl38-badge tl38-risk-destructive">{draft.severity}</span> · status: {draft.status}</p>
          <ul className="tl38-list">{draft.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
    </Card>
  );
}

/* 51485 */ export function LabelCard() {
  const [test, setTest] = useState({ id: 'tq-10', technique: 'xss', target: '/profile', labels: ['auth-flow'] });
  const [label, setLabel] = useState('');
  return (
    <Card n="51485" title="Test labeling">
      <p>{test.id} · {test.technique} → {test.target}</p>
      <div>{(test.labels || []).map((l) => <span key={l} className="tl38-tag">{l}</span>)}</div>
      <div className="tl38-row">
        <input className="tl38-input" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="new label" />
        <button className="tl38-btn" onClick={() => { if (label.trim()) { setTest(labelTest(test, [label.trim()])); setLabel(''); } }}>Add</button>
      </div>
    </Card>
  );
}

/* 51486 */ export function CommentsCard() {
  const [thread, setThread] = useState(newCommentThread('tq-11'));
  const [author, setAuthor] = useState('hunter-1');
  const [text, setText] = useState('');
  return (
    <Card n="51486" title="Test collaboration comments">
      <input className="tl38-input" value={author} onChange={(e) => setAuthor(e.target.value)} aria-label="author" />
      <input className="tl38-input" value={text} onChange={(e) => setText(e.target.value)} aria-label="comment text" />
      <div className="tl38-row">
        <button className="tl38-btn" onClick={() => { if (text.trim()) { setThread(addComment(thread, author, text)); setText(''); } }}>Add comment</button>
      </div>
      <div className="tl38-thread">
        {thread.comments.map((c) => (
          <div key={c.id} className={`tl38-comment${c.resolved ? ' resolved' : ''}`}>
            <strong>{c.author}</strong>: {c.text}
            {!c.resolved && (
              <div className="tl38-row"><button className="tl38-btn" onClick={() => setThread(resolveComment(thread, c.id))}>Resolve</button></div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* 51487 */ export function ApiBuilderCard() {
  const [technique, setTechnique] = useState('ssrf');
  const [target, setTarget] = useState('/api/fetch');
  const [param, setParam] = useState('url');
  const [priority, setPriority] = useState('normal');
  const [environment, setEnvironment] = useState('staging');
  const payload = requestApiPayload({ technique, target, param, priority, environment });
  const v = validateApiPayload(payload);
  return (
    <Card n="51487" title="Test request API builder">
      <input className="tl38-input" value={technique} onChange={(e) => setTechnique(e.target.value)} aria-label="technique" />
      <input className="tl38-input" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="target" />
      <input className="tl38-input" value={param} onChange={(e) => setParam(e.target.value)} aria-label="parameter" />
      <div className="tl38-row">
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">low</option><option value="normal">normal</option><option value="urgent">urgent</option>
        </select>
        <select value={environment} onChange={(e) => setEnvironment(e.target.value)}>
          {ENVIRONMENTS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
      </div>
      <pre className="tl38-pre">{JSON.stringify(payload, null, 2)}</pre>
      {!v.ok && <p className="tl38-warn">Missing: {v.missing.join(', ')}</p>}
    </Card>
  );
}

/* 51488 */ export function QuotaCard() {
  const [used, setUsed] = useState(37);
  const [total, setTotal] = useState(50);
  const q = quotaStatus(used, total);
  return (
    <Card n="51488" title="Test quota display">
      <div className="tl38-row">
        <label>Used <input type="range" min={0} max={100} value={used} onChange={(e) => setUsed(Number(e.target.value))} /></label>
        <label>Total <input type="range" min={1} max={100} value={total} onChange={(e) => setTotal(Number(e.target.value))} /></label>
      </div>
      <div className="tl38-meter"><div className="tl38-meter-fill" style={{ width: `${q.percentUsed}%` }} /></div>
      <p>{q.used}/{q.total} used · {q.remaining} remaining · {q.percentUsed}%</p>
      {q.exhausted && <p className="tl38-warn">Quota exhausted — no on-demand tests left in the hunt budget.</p>}
    </Card>
  );
}

/* 51489 */ export function TechniqueInfoCard() {
  const [sel, setSel] = useState('sqli');
  const t = techniqueInfo(sel);
  const b = riskBadge(sel);
  return (
    <Card n="51489" title="Test technique info cards">
      <select value={sel} onChange={(e) => setSel(e.target.value)}>
        {TECHNIQUE_INFO.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      {t && (
        <div>
          <h4>{t.name} <span className={`tl38-badge ${b.className}`}>{b.label}</span></h4>
          <p className="tl38-note">{t.plain}</p>
          <p><strong>What it does:</strong> {t.whatItDoes}</p>
          <p><strong>Why it matters:</strong> {t.whyItMatters}</p>
        </div>
      )}
    </Card>
  );
}

/* 51490 */ export function RiskBadgeCard() {
  const [sel, setSel] = useState('ssrf');
  const b = riskBadge(sel);
  return (
    <Card n="51490" title="Test risk badges">
      <select value={sel} onChange={(e) => setSel(e.target.value)}>
        {TECHNIQUE_INFO.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <p><span className={`tl38-badge ${b.className}`}>{b.label}</span></p>
      <p className="tl38-note">Every request is labeled up front: safe, cautious, or destructive.</p>
    </Card>
  );
}

/* 51491 */ export function RollbackCard() {
  const test = { id: 'tq-12', technique: 'idor', target: '/api/orders/4521' };
  const [plan, setPlan] = useState(null);
  return (
    <Card n="51491" title="Test state rollback">
      <p>{test.id} · {test.technique} → {test.target}</p>
      <div className="tl38-row">
        <button className="tl38-btn tl38-btn-primary" onClick={() => setPlan(rollbackPlan(test))}>Build rollback plan</button>
      </div>
      {plan && (
        <ol>{plan.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      )}
    </Card>
  );
}

/* 51492 */ export function ExportCard() {
  const test = { id: 'tq-13', technique: 'sqli', target: '/api/login' };
  const result = { vulnerable: true, evidence: ['MySQL error in response body', 'Response delay matched sleep(5) payload'] };
  const [format, setFormat] = useState('json');
  const [exp, setExp] = useState(null);
  return (
    <Card n="51492" title="Test result export">
      <div className="tl38-row">
        <select value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="json">json</option><option value="markdown">markdown</option>
        </select>
        <button className="tl38-btn tl38-btn-primary" onClick={() => setExp(exportTestEvidence(test, result, format))}>Build export</button>
      </div>
      {exp && (
        <div>
          <p>File: <code>{exp.filename}</code></p>
          <pre className="tl38-pre">{exp.content}</pre>
        </div>
      )}
    </Card>
  );
}

/* 51493 */ export function ReplayCard() {
  const test = { id: 'tq-14', technique: 'xss', target: '/search', status: 'done' };
  const [replay, setReplay] = useState(null);
  return (
    <Card n="51493" title="Test replay">
      <p>{test.id} · {test.technique} → {test.target} · {test.status}</p>
      <div className="tl38-row">
        <button className="tl38-btn tl38-btn-primary" onClick={() => setReplay(replayTest(test))}>Replay</button>
      </div>
      {replay && <p>Queued replay: <code>{replay.id}</code> (replayOf <code>{replay.replayOf}</code>, status: {replay.status})</p>}
    </Card>
  );
}

/* 51494 */ export function DiffCard() {
  const [before, setBefore] = useState('200 OK\nCSP header present');
  const [after, setAfter] = useState('200 OK\nCSP header missing');
  const [diff, setDiff] = useState(null);
  const compare = () => {
    const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
    setDiff(diffTestResults(lines(before), lines(after)));
  };
  return (
    <Card n="51494" title="Test result diffing">
      <textarea className="tl38-input" rows={2} value={before} onChange={(e) => setBefore(e.target.value)} aria-label="before evidence, one line each" />
      <textarea className="tl38-input" rows={2} value={after} onChange={(e) => setAfter(e.target.value)} aria-label="after evidence, one line each" />
      <div className="tl38-row">
        <button className="tl38-btn tl38-btn-primary" onClick={compare}>Compare</button>
      </div>
      {diff && (
        <div>
          <p>Changed: {diff.changed ? 'yes' : 'no'}</p>
          <div className="tl38-kv"><span>Added</span><span>{diff.added.join(' | ') || '—'}</span></div>
          <div className="tl38-kv"><span>Removed</span><span>{diff.removed.join(' | ') || '—'}</span></div>
          <div className="tl38-kv"><span>Unchanged</span><span>{diff.unchanged.join(' | ') || '—'}</span></div>
        </div>
      )}
    </Card>
  );
}

/* 51495 */ export function ChatCard() {
  const [thread, setThread] = useState(newChatThread('tq-15'));
  const [role, setRole] = useState('hunter');
  const [text, setText] = useState('');
  return (
    <Card n="51495" title="Test request chat">
      <div className="tl38-row">
        <button className={`tl38-btn${role === 'hunter' ? ' tl38-btn-primary' : ''}`} onClick={() => setRole('hunter')}>hunter</button>
        <button className={`tl38-btn${role === 'agent' ? ' tl38-btn-primary' : ''}`} onClick={() => setRole('agent')}>agent</button>
      </div>
      <input className="tl38-input" value={text} onChange={(e) => setText(e.target.value)} aria-label="chat message" />
      <div className="tl38-row">
        <button className="tl38-btn" onClick={() => { if (text.trim()) { setThread(addChatMessage(thread, role, text)); setText(''); } }}>Send</button>
      </div>
      <ul className="tl38-list">
        {thread.messages.map((m) => <li key={m.id}><strong>{m.role}:</strong> {m.text}</li>)}
      </ul>
    </Card>
  );
}

/* 51496 */ export function AutoDocCard() {
  const tests = [
    { id: 'tq-16', technique: 'sqli', target: '/api/login', vulnerable: true },
    { id: 'tq-17', technique: 'headers', target: '/api/health', vulnerable: false },
  ];
  const [entries, setEntries] = useState([]);
  return (
    <Card n="51496" title="Test auto-documentation">
      <div className="tl38-row">
        <button className="tl38-btn tl38-btn-primary" onClick={() => setEntries(autoDocEntries(tests))}>Generate entries</button>
      </div>
      {entries.map((e) => (
        <div key={e.id}>
          <h4>{e.heading}</h4>
          <p className="tl38-note">{e.body}</p>
        </div>
      ))}
    </Card>
  );
}

/* 51497 */ export function MetricsCard() {
  const tests = [
    { id: 'tq-18', technique: 'sqli', target: '/api/login' },
    { id: 'tq-19', technique: 'xss', target: '/search' },
    { id: 'tq-20', technique: 'idor', target: '/api/orders' },
  ];
  const [store, setStore] = useState({});
  const m = successMetrics(store);
  return (
    <Card n="51497" title="Test success metrics">
      <ul className="tl38-list">
        {tests.map((t) => (
          <li key={t.id}>{t.id} · {t.technique} → {t.target}
            <div className="tl38-row">
              <button className="tl38-btn" onClick={() => setStore(recordTestOutcome(store, t.id, true))}>Found issue</button>
              <button className="tl38-btn" onClick={() => setStore(recordTestOutcome(store, t.id, false))}>No issue</button>
            </div>
          </li>
        ))}
      </ul>
      <p>Total: {m.total} · found: {m.found} · missed: {m.missed} · hit rate: {m.rate}%</p>
    </Card>
  );
}

/* 51498 */ export function InboxCard() {
  const [inbox, setInbox] = useState([]);
  const [idea, setIdea] = useState('');
  return (
    <Card n="51498" title="Test idea inbox">
      <div className="tl38-row">
        <input className="tl38-input" value={idea} onChange={(e) => setIdea(e.target.value)} aria-label="new test idea" />
        <button className="tl38-btn" onClick={() => { if (idea.trim()) { setInbox(addIdea(inbox, idea)); setIdea(''); } }}>Add</button>
      </div>
      {inbox.length === 0 && <p className="tl38-empty">Inbox is empty — jot an idea for the agent to pick up.</p>}
      <ul className="tl38-list">
        {inbox.map((i) => (
          <li key={i.id}>{i.text}
            <span className="tl38-tag">{i.status}</span>
            {i.status === 'open' && <button className="tl38-btn" onClick={() => setInbox(claimIdea(inbox, i.id))}>Claim</button>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* 51499 */ export function QueueCard() {
  const [queue, setQueue] = useState([
    { id: 'tq-21', technique: 'sqli', target: '/api/login' },
    { id: 'tq-22', technique: 'xss', target: '/profile' },
    { id: 'tq-23', technique: 'ssrf', target: '/api/fetch' },
    { id: 'tq-24', technique: 'idor', target: '/api/users/3' },
  ]);
  return (
    <Card n="51499" title="Test priority queue controls">
      <ol>
        {queue.map((t, i) => (
          <li key={t.id}>{t.id} · {t.technique} → {t.target}
            <div className="tl38-row">
              <button className="tl38-btn" disabled={i === 0} onClick={() => setQueue(queueReorder(queue, i, i - 1))}>Move up</button>
              <button className="tl38-btn" disabled={i === queue.length - 1} onClick={() => setQueue(queueReorder(queue, i, i + 1))}>Move down</button>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* 51500 */ export function EnvCard() {
  const [env, setEnv] = useState('staging');
  const d = environmentDescriptor(env);
  return (
    <Card n="51500" title="Test environment selector">
      <select value={env} onChange={(e) => setEnv(e.target.value)}>
        {ENVIRONMENTS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
      </select>
      {d && (
        <div>
          <p>Environment: <strong>{d.label}</strong></p>
          <p className={d.id === 'production' ? 'tl38-warn' : 'tl38-note'}>{d.warning}</p>
        </div>
      )}
    </Card>
  );
}

/* 51501 */ export function CredentialCard() {
  const [username, setUsername] = useState('hunter@test.io');
  const [vaultRef, setVaultRef] = useState('vault://hunts/tester-1');
  const [scope, setScope] = useState('read-only');
  const d = credentialDescriptor({ username, vaultRef, scope });
  return (
    <Card n="51501" title="Test credential descriptor">
      <input className="tl38-input" value={username} onChange={(e) => setUsername(e.target.value)} aria-label="username" />
      <input className="tl38-input" value={vaultRef} onChange={(e) => setVaultRef(e.target.value)} aria-label="vault reference" />
      <input className="tl38-input" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="scope" />
      <pre className="tl38-pre">{JSON.stringify(d, null, 2)}</pre>
      <p className="tl38-note">The secret is shown as {d.secret} — raw secrets are never stored in this UI; the vault supplies them at run time.</p>
    </Card>
  );
}

/* 51502 */ export function RecordCard() {
  const [testId, setTestId] = useState('tq-25');
  const [stepsText, setStepsText] = useState('resolve target\nsend boolean payloads\nverify timing difference');
  const [session, setSession] = useState(null);
  const record = () => {
    const steps = stepsText.split('\n').map((s) => s.trim()).filter(Boolean);
    setSession(recordSession(testId, steps));
  };
  return (
    <Card n="51502" title="Test session recording">
      <input className="tl38-input" value={testId} onChange={(e) => setTestId(e.target.value)} aria-label="test id" />
      <textarea className="tl38-input" rows={3} value={stepsText} onChange={(e) => setStepsText(e.target.value)} aria-label="session steps, one per line" />
      <div className="tl38-row">
        <button className="tl38-btn tl38-btn-primary" onClick={record}>Record session</button>
      </div>
      {session && (
        <div>
          <p>Session: <code>{session.sessionId}</code></p>
          <ol>{session.steps.map((s) => <li key={s.n}>{s.step}</li>)}</ol>
        </div>
      )}
    </Card>
  );
}

/* 51503 */ export function ShareCard() {
  const [testId, setTestId] = useState('tq-26');
  const [link, setLink] = useState(null);
  return (
    <Card n="51503" title="Test result sharing">
      <input className="tl38-input" value={testId} onChange={(e) => setTestId(e.target.value)} aria-label="test id" />
      <div className="tl38-row">
        <button className="tl38-btn tl38-btn-primary" onClick={() => setLink(shareTestLink(testId))}>Build link</button>
      </div>
      {link && (
        <div>
          <p>Path: <code>{link.path}</code></p>
          <p>Token: <code>{link.token}</code></p>
        </div>
      )}
    </Card>
  );
}

/* 51504 */ export function FeedbackCard() {
  const test = { id: 'tq-27', technique: 'dirbrute', target: '/static' };
  const [store, setStore] = useState({});
  const s = feedbackSummary(store);
  return (
    <Card n="51504" title="Test feedback loop">
      <p>{test.id} · {test.technique} → {test.target}</p>
      <div className="tl38-row">
        {[1, 2, 3, 4, 5].map((r) => (
          <button key={r} className={`tl38-btn${store[test.id] === r ? ' tl38-btn-primary' : ''}`} onClick={() => setStore(recordFeedback(store, test.id, r))}>{r}</button>
        ))}
      </div>
      <p>Count: {s.count} · average: {s.average} · weight: {s.weight}</p>
      <p className="tl38-note">Distribution: {Object.entries(s.distribution).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
    </Card>
  );
}

/* 51505 */ export function TemplatesCard() {
  const [installed, setInstalled] = useState([]);
  return (
    <Card n="51505" title="Test templates gallery">
      <ul className="tl38-list">
        {TEMPLATE_GALLERY.map((t) => (
          <li key={t.id}>
            <strong>{t.name}</strong> — {t.description}
            <div className="tl38-row">
              <button className="tl38-btn" onClick={() => { const r = installTemplate(t.id); if (r.ok) setInstalled([...installed, { ...r.test, id: `tq-tpl-${installed.length + 1}` }]); }}>Install</button>
            </div>
          </li>
        ))}
      </ul>
      {installed.length > 0 && (
        <div>
          <p className="tl38-note">{installed.length} installed:</p>
          <ul className="tl38-list">{installed.map((t) => <li key={t.id}>{t.id} · {t.technique} → {t.target} ({t.status})</li>)}</ul>
        </div>
      )}
    </Card>
  );
}

/* 51506 */ export function DepCard() {
  const tests = [
    { id: 'tq-28', technique: 'sqli', target: '/api/login' },
    { id: 'tq-29', technique: 'idor', target: '/api/users/3', dependsOn: ['tq-28'] },
    { id: 'tq-30', technique: 'jwt', target: '/api/login' },
    { id: 'tq-31', technique: 'cors', target: '/api', dependsOn: ['tq-30'] },
  ];
  const [graph, setGraph] = useState(null);
  return (
    <Card n="51506" title="Test dependency mapping">
      <div className="tl38-row">
        <button className="tl38-btn tl38-btn-primary" onClick={() => setGraph(dependencyGraph(tests))}>Build graph</button>
      </div>
      {graph && (
        <div>
          <p className="tl38-note">Nodes:</p>
          <ul className="tl38-list">{graph.nodes.map((n) => <li key={n.id}>{n.id} · {n.label}</li>)}</ul>
          <p className="tl38-note">Edges:</p>
          <ul className="tl38-list">{graph.edges.map((e, i) => <li key={i}>{e.from} → {e.to}</li>)}</ul>
        </div>
      )}
    </Card>
  );
}

/* 51507 */ export function PredictCard() {
  const test = { technique: 'sqli', target: '/api/register' };
  const history = [
    { technique: 'sqli', foundIssue: true },
    { technique: 'sqli', foundIssue: false },
    { technique: 'sqli', foundIssue: true },
    { technique: 'xss', foundIssue: true },
  ];
  const [pred, setPred] = useState(null);
  return (
    <Card n="51507" title="Test outcome predictions">
      <p>{test.technique} → {test.target}</p>
      <div className="tl38-row">
        <button className="tl38-btn tl38-btn-primary" onClick={() => setPred(predictOutcome(test, history))}>Predict</button>
      </div>
      {pred && (
        <div>
          <p>Score: <strong>{pred.score}%</strong> · likelihood: <strong>{pred.likelihood}</strong></p>
          <ul className="tl38-list">{pred.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}
    </Card>
  );
}

/* 51508 */ export function ArchiveCard() {
  const [active, setActive] = useState([
    { id: 'tq-32', technique: 'sqli', target: '/api/login' },
    { id: 'tq-33', technique: 'headers', target: '/' },
  ]);
  const [archive, setArchive] = useState([]);
  const move = (fn, id) => { const r = fn(); if (r.ok) { setArchive(r.archive); setActive(r.active); } };
  return (
    <Card n="51508" title="Test request archiving">
      <p className="tl38-note">Active:</p>
      <ul className="tl38-list">
        {active.map((t) => (
          <li key={t.id}>{t.id} · {t.technique} → {t.target}
            <div className="tl38-row"><button className="tl38-btn" onClick={() => move(() => archiveTest(archive, active, t.id), t.id)}>Archive</button></div>
          </li>
        ))}
      </ul>
      <p className="tl38-note">Archived:</p>
      <ul className="tl38-list">
        {archive.map((t) => (
          <li key={t.id}>{t.id} · {t.technique} → {t.target}
            <div className="tl38-row"><button className="tl38-btn" onClick={() => move(() => restoreTest(archive, active, t.id), t.id)}>Restore</button></div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// --- gallery (export only — not mounted in app UI) -------------------------------
export function TestLifecycleRound2Gallery() {
  return (
    <div className="tl38-gallery">
      <h3>Wave 38 · Test lifecycle round 2 (28 ideas)</h3>
      <StreamCard /><KillSwitchCard /><FollowUpCard /><PromoteCard />
      <LabelCard /><CommentsCard /><ApiBuilderCard /><QuotaCard />
      <TechniqueInfoCard /><RiskBadgeCard /><RollbackCard /><ExportCard />
      <ReplayCard /><DiffCard /><ChatCard /><AutoDocCard />
      <MetricsCard /><InboxCard /><QueueCard /><EnvCard />
      <CredentialCard /><RecordCard /><ShareCard /><FeedbackCard />
      <TemplatesCard /><DepCard /><PredictCard /><ArchiveCard />
    </div>
  );
}
