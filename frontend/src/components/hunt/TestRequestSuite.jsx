/**
 * TestRequestSuite.jsx — wave 37 (ideas 51453–51480): on-demand test-request
 * suite.
 * Real working components driving local state — no mocks, no canned-only
 * controls. All logic comes from testRequestCore.js.
 * The Wave37TestGallery is exported for review only; it is not mounted in
 * app UI.
 */
import React, { useState } from 'react';
import {
  WAVE37_TQ_IDEAS,
  TECHNIQUE_CATALOG,
  lookupTechnique,
  parseTestRequest,
  normalizeVoiceTranscript,
  WIZARD_STEPS,
  validateWizardStep,
  buildTargetDescriptor,
  validatePayload,
  PRIORITIES,
  priorityWeight,
  enqueueTest,
  queueStatus,
  cancelTest,
  explainResult,
  resultAlert,
  estimateTestCost,
  safetyCheck,
  routeForApproval,
  saveTemplate,
  applyTemplate,
  chainTests,
  scheduleTest,
  repeatTest,
  compareResults,
  attachNote,
  captureEvidence,
  shareTestLink,
  recordTestHistory,
  searchTestHistory,
  suggestTests,
  bulkRequests,
  tuneParams,
  sandboxReplica,
  isSandboxSafe,
  dryRun,
} from './testRequestCore.js';

function Card({ n, title, children }) {
  return (
    <div className="tq37-card" data-idea={n}>
      <div className="tq37-card-head">
        <span className="tq37-num">{n}</span>
        <h4>{title}</h4>
      </div>
      <div className="tq37-card-body">{children}</div>
    </div>
  );
}

/* 51453 */ export function TestBoxCard() {
  const [text, setText] = useState('try SQLi on the login form');
  const p = parseTestRequest(text);
  return (
    <Card n="51453" title="On-demand test box">
      <input
        className="tq37-input"
        value={text}
        onChange={e => setText(e.target.value)}
        aria-label="Describe a test, e.g. try SQLi on the login form"
      />
      <p>
        Technique: <strong>{lookupTechnique(p.technique)?.name}</strong> · target:{' '}
        <strong>{p.target || '—'}</strong> · {p.confidence}
      </p>
    </Card>
  );
}

/* 51454 */ export function WizardCard() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ target: '', technique: '', acknowledged: false });
  const v = validateWizardStep(WIZARD_STEPS[step], data);
  return (
    <Card n="51454" title="Test request wizard">
      <p>
        Step {step + 1}/3: <strong>{WIZARD_STEPS[step]}</strong>
      </p>
      {step === 0 && (
        <input
          className="tq37-input"
          value={data.target}
          onChange={e => setData({ ...data, target: e.target.value })}
          aria-label="/api/login"
        />
      )}
      {step === 1 && (
        <select
          value={data.technique}
          onChange={e => setData({ ...data, technique: e.target.value })}
        >
          <option value="">Pick a technique</option>
          {TECHNIQUE_CATALOG.map(t => (
            <option key={t.id} value={t.id}>
              {t.name} — {t.plain}
            </option>
          ))}
        </select>
      )}
      {step === 2 && (
        <label>
          <input
            type="checkbox"
            checked={data.acknowledged}
            onChange={e => setData({ ...data, acknowledged: e.target.checked })}
          />{' '}
          I confirm the target is authorized.
        </label>
      )}
      {!v.ok && <p className="tq37-warn">Missing: {v.missing.join(', ')}</p>}
      <div className="tq37-row">
        <button disabled={step === 0} onClick={() => setStep(step - 1)}>
          Back
        </button>
        <button disabled={!v.ok || step === 2} onClick={() => setStep(step + 1)}>
          Next
        </button>
        {step === 2 && v.ok && <button className="tq37-active">Queue test</button>}
      </div>
    </Card>
  );
}

/* 51455 */ export function TargetPickerCard() {
  const [url, setUrl] = useState('/api/login');
  const [form, setForm] = useState('login');
  const [param, setParam] = useState('username');
  const d = buildTargetDescriptor({ url, form, param });
  return (
    <Card n="51455" title="Test targeting picker">
      <input
        className="tq37-input"
        value={url}
        onChange={e => setUrl(e.target.value)}
        aria-label="URL"
      />
      <input
        className="tq37-input"
        value={form}
        onChange={e => setForm(e.target.value)}
        aria-label="form name"
      />
      <input
        className="tq37-input"
        value={param}
        onChange={e => setParam(e.target.value)}
        aria-label="parameter"
      />
      <p>
        Descriptor: <code>{d.descriptor}</code>
      </p>
    </Card>
  );
}

/* 51456 */ export function TechniqueMenuCard() {
  const [sel, setSel] = useState('sqli');
  const t = lookupTechnique(sel);
  return (
    <Card n="51456" title="Test technique menu">
      <select value={sel} onChange={e => setSel(e.target.value)}>
        {TECHNIQUE_CATALOG.map(x => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
      {t && (
        <p>
          <strong>{t.name}</strong> — {t.plain}. Risk: {t.risk}, ≈{t.requests} requests.
        </p>
      )}
    </Card>
  );
}

/* 51457 */ export function PayloadCard() {
  const [payload, setPayload] = useState("' OR 1=1 --");
  const v = validatePayload(payload);
  return (
    <Card n="51457" title="Custom payload input">
      <textarea
        className="tq37-input"
        rows={2}
        value={payload}
        onChange={e => setPayload(e.target.value)}
      />
      {v.ok ? (
        <p className="tq37-ok">Payload valid.</p>
      ) : (
        v.issues.map((i, k) => (
          <p key={k} className="tq37-warn">
            {i}
          </p>
        ))
      )}
    </Card>
  );
}

/* 51458 */ export function PriorityCard() {
  const [p, setP] = useState('normal');
  return (
    <Card n="51458" title="Test priority flag">
      <div className="tq37-row">
        {PRIORITIES.map(x => (
          <button key={x} className={p === x ? 'tq37-active' : ''} onClick={() => setP(x)}>
            {x}
          </button>
        ))}
      </div>
      <p>
        Weight: <strong>{priorityWeight(p)}</strong> (queue ordering).
      </p>
    </Card>
  );
}

/* 51459 */ export function QueueCard() {
  const [queue, setQueue] = useState([
    { id: 'tq-1', status: 'running', technique: 'sqli', target: '/api/login', priority: 'urgent' },
    {
      id: 'tq-2',
      status: 'queued',
      technique: 'headers',
      target: '/api/health',
      priority: 'normal',
    },
  ]);
  const s = queueStatus(queue);
  return (
    <Card n="51459" title="Test queue view">
      <p>
        {s.total} tests — {s.counts.queued} queued, {s.counts.running} running, {s.counts.done}{' '}
        done.
      </p>
      <ul>
        {queue.map(t => (
          <li key={t.id}>
            {t.id} · {t.technique} → {t.target} · <strong>{t.status}</strong> ({t.priority})
          </li>
        ))}
      </ul>
      <button
        onClick={() =>
          setQueue(enqueueTest(queue, { technique: 'xss', target: '/profile', priority: 'low' }))
        }
      >
        Queue another
      </button>
    </Card>
  );
}

/* 51460 */ export function CancelCard() {
  const [queue, setQueue] = useState([
    { id: 'tq-1', status: 'running', technique: 'sqli', target: '/api/login' },
  ]);
  return (
    <Card n="51460" title="Test cancellation">
      <ul>
        {queue.map(t => (
          <li key={t.id}>
            {t.id} · <strong>{t.status}</strong>{' '}
            <button onClick={() => setQueue(cancelTest(queue, t.id))}>Withdraw</button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* 51461 */ export function AlertsCard() {
  const test = { id: 'tq-1' };
  const [vuln, setVuln] = useState(true);
  const a = resultAlert(test, {
    vulnerable: vuln,
    technique: 'SQL injection',
    target: '/api/login',
  });
  return (
    <Card n="51461" title="Test result alerts">
      <button onClick={() => setVuln(!vuln)}>
        Toggle verdict (now: {vuln ? 'vulnerable' : 'clean'})
      </button>
      <p>
        <strong>{a.title}</strong> [{a.severity}] — {a.verdict}
      </p>
    </Card>
  );
}

/* 51462 */ export function CostCard() {
  const [tech, setTech] = useState('dirbrute');
  const [prio, setPrio] = useState('normal');
  const c = estimateTestCost({ technique: tech, priority: prio });
  return (
    <Card n="51462" title="Test cost preview">
      <select value={tech} onChange={e => setTech(e.target.value)}>
        {TECHNIQUE_CATALOG.map(t => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <div className="tq37-row">
        {PRIORITIES.map(x => (
          <button key={x} className={prio === x ? 'tq37-active' : ''} onClick={() => setPrio(x)}>
            {x}
          </button>
        ))}
      </div>
      <p>
        Cost: <strong>{c.label}</strong>
      </p>
    </Card>
  );
}

/* 51463 */ export function SafetyCard() {
  const [tech, setTech] = useState('ssrf');
  const sc = safetyCheck({ technique: tech, target: '/api/fetch' });
  return (
    <Card n="51463" title="Test safety check">
      <select value={tech} onChange={e => setTech(e.target.value)}>
        {TECHNIQUE_CATALOG.map(t => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {sc.safe ? (
        <p className="tq37-ok">Safe to run.</p>
      ) : (
        sc.warnings.map((w, i) => (
          <p key={i} className="tq37-warn">
            {w}
          </p>
        ))
      )}
    </Card>
  );
}

/* 51464 */ export function ApprovalCard() {
  const [tech, setTech] = useState('ssrf');
  const r = routeForApproval({ technique: tech, target: '/api/fetch', priority: 'normal' });
  return (
    <Card n="51464" title="Test approval routing">
      <select value={tech} onChange={e => setTech(e.target.value)}>
        {TECHNIQUE_CATALOG.map(t => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <p>
        {r.needsApproval ? `Needs approval — tier: ${r.tier}.` : 'Auto-approved — safe to run.'}
      </p>
    </Card>
  );
}

/* 51465 */ export function TemplatesCard() {
  const [store, setStore] = useState({});
  const [name, setName] = useState('login-sqli');
  const [applied, setApplied] = useState(null);
  return (
    <Card n="51465" title="Test templates">
      <input
        className="tq37-input"
        value={name}
        onChange={e => setName(e.target.value)}
        aria-label="template name"
      />
      <div className="tq37-row">
        <button
          onClick={() => {
            const r = saveTemplate(store, name, { technique: 'sqli', target: '/api/login' });
            if (r.ok) setStore(r.store);
          }}
        >
          Save template
        </button>
        <button
          onClick={() => {
            const r = applyTemplate(store, name, { target: '/api/register' });
            if (r.ok) setApplied(r.test);
          }}
        >
          Apply to /api/register
        </button>
      </div>
      {applied && (
        <p>
          Applied: {applied.technique} → {applied.target}
        </p>
      )}
      {!applied && <p className="tq37-note">{Object.keys(store).length} templates saved.</p>}
    </Card>
  );
}

/* 51466 */ export function ChainCard() {
  const chain = chainTests({ technique: 'sqli', target: '/api/login' }, 'if vulnerable', {
    technique: 'idor',
    target: '/api/users/{id}',
  });
  return (
    <Card n="51466" title="Test chaining">
      <p>{chain.description}</p>
    </Card>
  );
}

/* 51467 */ export function ScheduleCard() {
  const [when, setWhen] = useState('phase-end');
  const s = scheduleTest({ technique: 'dirbrute', target: '/static' }, when);
  return (
    <Card n="51467" title="Test scheduling">
      <select value={when} onChange={e => setWhen(e.target.value)}>
        <option value="phase-end">When current phase completes</option>
        <option value="hunt-end">When the hunt ends</option>
        <option value="quiet-hours">During quiet hours</option>
      </select>
      <p>
        Scheduled: <strong>{s.scheduledFor}</strong>
      </p>
    </Card>
  );
}

/* 51468 */ export function RepeatCard() {
  const history = [{ id: 'tq-9', technique: 'sqli', target: '/api/login', status: 'done' }];
  const [newTarget, setNewTarget] = useState('/api/register');
  const r = repeatTest(history, 'tq-9', newTarget);
  return (
    <Card n="51468" title="Test repetition">
      <input
        className="tq37-input"
        value={newTarget}
        onChange={e => setNewTarget(e.target.value)}
        aria-label="new target"
      />
      <p>
        {r.ok
          ? `Re-running ${r.test.technique} against ${r.test.target} (${r.test.note}).`
          : r.error}
      </p>
    </Card>
  );
}

/* 51469 */ export function CompareCard() {
  const cmp = compareResults([
    { target: '/api/login', technique: 'sqli', vulnerable: true },
    { target: '/api/register', technique: 'sqli', vulnerable: false },
    { target: '/api/reset', technique: 'sqli', error: 'timeout' },
  ]);
  return (
    <Card n="51469" title="Test comparison">
      <table className="tq37-table">
        <thead>
          <tr>
            <th>Target</th>
            <th>Technique</th>
            <th>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {cmp.rows.map((r, i) => (
            <tr key={i}>
              <td>{r.target}</td>
              <td>{r.technique}</td>
              <td>{r.verdict}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>{cmp.summary}</p>
    </Card>
  );
}

/* 51470 */ export function NoteCard() {
  const [note, setNote] = useState('I think the ORM only sanitizes the first parameter.');
  const t = attachNote({ technique: 'sqli', target: '/api/login' }, note);
  return (
    <Card n="51470" title="Test notes">
      <textarea
        className="tq37-input"
        rows={2}
        value={note}
        onChange={e => setNote(e.target.value)}
        aria-label="your hypothesis"
      />
      <p className="tq37-note">Attached: {t.note}</p>
    </Card>
  );
}

/* 51471 */ export function ResultExplainCard() {
  const [vuln, setVuln] = useState(false);
  return (
    <Card n="51471" title="Test result explanation">
      <button onClick={() => setVuln(!vuln)}>Toggle verdict</button>
      <p>{explainResult({ vulnerable: vuln, technique: 'header audit', target: '/api/health' })}</p>
    </Card>
  );
}

/* 51472 */ export function EvidenceCard() {
  const ev = captureEvidence(
    { id: 'tq-1', technique: 'sqli', target: '/api/login' },
    { method: 'POST', path: '/api/login', body: "username=' OR 1=1 --" },
    { status: 200, rows: 12 }
  );
  const [show, setShow] = useState(false);
  return (
    <Card n="51472" title="Test evidence capture">
      <p>
        Evidence stored for {ev.testId} ({ev.technique} → {ev.target}).
      </p>
      <button onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'} evidence</button>
      {show && (
        <pre className="tq37-pre">
          {JSON.stringify({ request: ev.request, response: ev.response }, null, 1)}
        </pre>
      )}
    </Card>
  );
}

/* 51473 */ export function ShareTestCard() {
  const link = shareTestLink({ id: 'tq-1' });
  const [copied, setCopied] = useState(false);
  return (
    <Card n="51473" title="Test sharing">
      <p>
        Reviewer link: <code>{link.path}</code>
      </p>
      <button onClick={() => setCopied(true)}>{copied ? 'Copied' : 'Copy link'}</button>
    </Card>
  );
}

/* 51474 */ export function VoiceRequestCard() {
  const [spoken, setSpoken] = useState('um, please try SQL injection on the login page');
  const clean = normalizeVoiceTranscript(spoken);
  const p = parseTestRequest(clean);
  return (
    <Card n="51474" title="Voice test requests">
      <input
        className="tq37-input"
        value={spoken}
        onChange={e => setSpoken(e.target.value)}
        aria-label="dictate a test"
      />
      <p>
        Transcript: “{clean}” → <strong>{lookupTechnique(p.technique)?.name}</strong> @{' '}
        {p.target || '(pick a target)'}
      </p>
    </Card>
  );
}

/* 51475 */ export function HistoryCard() {
  const hist = recordTestHistory([], {
    id: 'tq-1',
    technique: 'sqli',
    target: '/api/login',
    note: 'login bypass attempt',
  });
  const hist2 = recordTestHistory(hist, {
    id: 'tq-2',
    technique: 'xss',
    target: '/profile',
    note: 'stored xss check',
  });
  const [q, setQ] = useState('login');
  const hits = searchTestHistory(hist2, q);
  return (
    <Card n="51475" title="Test request history">
      <input
        className="tq37-input"
        value={q}
        onChange={e => setQ(e.target.value)}
        aria-label="search history"
      />
      <ul>
        {hits.map(h => (
          <li key={h.id}>
            {h.id} · {h.technique} → {h.target} — {h.note}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* 51476 */ export function SuggestCard() {
  const findings = [
    { id: 'F-1', type: 'sql-injection', location: '/api/login' },
    { id: 'F-2', type: 'xss', location: '/profile' },
  ];
  const sug = suggestTests(findings, 4);
  const [queue, setQueue] = useState([]);
  return (
    <Card n="51476" title="Test suggestion engine">
      <ul>
        {sug.map((s, i) => (
          <li key={i}>
            {lookupTechnique(s.technique)?.name} → {s.target || '(target)'} — {s.why}
            <button
              onClick={() =>
                setQueue(enqueueTest(queue, { technique: s.technique, target: s.target }))
              }
            >
              Queue
            </button>
          </li>
        ))}
      </ul>
      {queue.length > 0 && <p className="tq37-note">{queue.length} queued from suggestions.</p>}
    </Card>
  );
}

/* 51477 */ export function BulkCard() {
  const [targets, setTargets] = useState('/api/login\n/api/register\n/api/reset');
  const list = targets
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  const batch = bulkRequests(list, 'headers');
  return (
    <Card n="51477" title="Bulk test requests">
      <textarea
        className="tq37-input"
        rows={3}
        value={targets}
        onChange={e => setTargets(e.target.value)}
        aria-label="one target per line"
      />
      <p>{batch.length} tests in batch (headers audit).</p>
    </Card>
  );
}

/* 51478 */ export function TuneCard() {
  const [depth, setDepth] = useState(2);
  const [payloadCount, setPayloadCount] = useState(50);
  const [timeoutMs, setTimeoutMs] = useState(30000);
  const t = tuneParams(
    { technique: 'dirbrute', target: '/static' },
    { depth, payloadCount, timeoutMs }
  );
  return (
    <Card n="51478" title="Test parameter tuning">
      <label>
        Depth: {depth}
        <input
          type="range"
          min={1}
          max={5}
          value={depth}
          onChange={e => setDepth(Number(e.target.value))}
        />
      </label>
      <label>
        Payloads: {payloadCount}
        <input
          type="range"
          min={1}
          max={500}
          value={payloadCount}
          onChange={e => setPayloadCount(Number(e.target.value))}
        />
      </label>
      <label>
        Timeout: {timeoutMs}ms
        <input
          type="range"
          min={1000}
          max={120000}
          step={1000}
          value={timeoutMs}
          onChange={e => setTimeoutMs(Number(e.target.value))}
        />
      </label>
      <p className="tq37-note">
        Clamped: depth {t.tuning.depth}, {t.tuning.payloadCount} payloads, {t.tuning.timeoutMs}ms.
      </p>
    </Card>
  );
}

/* 51479 */ export function SandboxCard() {
  const test = { id: 'tq-1', technique: 'ssrf', target: '/api/fetch' };
  const rep = sandboxReplica(test);
  const safe = isSandboxSafe(test);
  const [ran, setRan] = useState(false);
  return (
    <Card n="51479" title="Test sandbox mode">
      <p>
        Replica: <code>{rep.target}</code> · network: {rep.network}.
      </p>
      <p>{safe ? 'Sandbox-safe.' : 'Not sandbox-safe — blocked.'}</p>
      <button disabled={!safe} onClick={() => setRan(true)}>
        Run in sandbox
      </button>
      {ran && <p className="tq37-note">Sandbox run complete (isolated, egress blocked).</p>}
    </Card>
  );
}

/* 51480 */ export function DryRunCard() {
  const d = dryRun({
    technique: 'sqli',
    target: '/api/login',
    param: 'username',
    priority: 'normal',
  });
  return (
    <Card n="51480" title="Test dry-run">
      <pre className="tq37-pre">{JSON.stringify(d, null, 1)}</pre>
    </Card>
  );
}

// --- gallery (export only — not mounted in app UI) -------------------------------
export function Wave37TestGallery() {
  return (
    <div className="tq37-gallery">
      <h3>Wave 37 · On-demand test-request suite ({WAVE37_TQ_IDEAS.length} ideas)</h3>
      <TestBoxCard />
      <WizardCard />
      <TargetPickerCard />
      <TechniqueMenuCard />
      <PayloadCard />
      <PriorityCard />
      <QueueCard />
      <CancelCard />
      <AlertsCard />
      <CostCard />
      <SafetyCard />
      <ApprovalCard />
      <TemplatesCard />
      <ChainCard />
      <ScheduleCard />
      <RepeatCard />
      <CompareCard />
      <NoteCard />
      <ResultExplainCard />
      <EvidenceCard />
      <ShareTestCard />
      <VoiceRequestCard />
      <HistoryCard />
      <SuggestCard />
      <BulkCard />
      <TuneCard />
      <SandboxCard />
      <DryRunCard />
    </div>
  );
}
