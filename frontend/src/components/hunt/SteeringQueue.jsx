/**
 * SteeringQueue.jsx — wave 40 (ideas 51581–51600): proactive steering
 * prompt engine (part 2).
 * Real working components driving local state — no canned-only controls.
 * All logic comes from steeringQueueCore.js.
 * The SteeringQueueGallery is exported for review only; it is not
 * mounted in app UI.
 */
import React, { useState } from 'react';
import {
  URGENCY_ORDER,
  createQueue,
  enqueue,
  dequeueNext,
  duePrompts,
  triageOrder,
  snoozeUntil,
  snoozeByMinutes,
  isSnoozed,
  wakeSnoozed,
  queueSummary,
  defaultInterruptPrefs,
  learnInterruptionPref,
  interruptionMode,
  notificationPrefPrompt,
  handoffQuestion,
  retestProposal,
  collaborationPrompt,
  learningQuestion,
  recordLearningAnswer,
  learningSummary,
  assumptionDisclosure,
  planReviewPrompt,
  checkpointQuestion,
  anomalyQuestion,
  coverageQuestion,
  toolChoiceQuestion,
  evidenceQuestion,
  timingQuestion,
  parallelismQuestion,
  DATA_HANDLING_OPTIONS,
  dataHandlingQuestion,
  disclosureQuestion,
  steeringFeedbackRequest,
  recordSteeringFeedback,
  steeringFeedbackSummary,
  goalAlignmentCheck,
} from './steeringQueueCore.js';

function Card({ n, title, children }) {
  return (
    <div className="sq40-card" data-idea={n}>
      <div className="sq40-card-head">
        <span className="sq40-num">{n}</span>
        <h4>{title}</h4>
      </div>
      <div className="sq40-card-body">{children}</div>
    </div>
  );
}

function QCard({ n, title, prompt }) {
  const [p, setP] = useState(prompt);
  if (!p)
    return (
      <Card n={n} title={title}>
        <div className="sq40-meta">no prompt due right now</div>
      </Card>
    );
  return (
    <Card n={n} title={title}>
      <div className="sq40-prompt-title">{p.title}</div>
      <div className="sq40-prompt-body">{p.body}</div>
      <div className="sq40-opts">
        {(p.options || []).map(o => (
          <button
            key={o.key}
            className={'sq40-opt' + (p.answerKey === o.key ? ' sq40-opt-picked' : '')}
            onClick={() => setP({ ...p, status: 'answered', answerKey: o.key })}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="sq40-row">
        <button className="sq40-opt" onClick={() => setP(snoozeByMinutes(p, 15, 0))}>
          snooze 15m
        </button>
        <div className="sq40-meta">
          status: {p.status}
          {p.answerKey ? ' → ' + p.answerKey : ''} · urgency: {p.urgency}
          {p.snoozedUntilMs ? ' · snoozed' : ''}
        </div>
      </div>
    </Card>
  );
}

const F = {
  id: 'F-201',
  title: 'IDOR in /api/orders',
  type: 'idor',
  severity: 'critical',
  confidence: 91,
  asset: 'app.example.com/api/orders',
};

/** 51581 — the agent learns when to interrupt. */
export function NotificationPrefCard() {
  const [prefs, setPrefs] = useState(defaultInterruptPrefs());
  const [crit, setCrit] = useState('high');
  return (
    <Card n={51581} title="Notification preference checks">
      <div className="sq40-meta">
        mode for {crit}: <b>{interruptionMode(prefs, crit)}</b>
      </div>
      <div className="sq40-row">
        <select className="sq40-input" value={crit} onChange={e => setCrit(e.target.value)}>
          {['critical', 'high', 'medium', 'low', 'info'].map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {['interrupt', 'batch', 'silent'].map(m => (
          <button
            key={m}
            className={'sq40-opt' + (prefs[crit] === m ? ' sq40-opt-picked' : '')}
            onClick={() => setPrefs(learnInterruptionPref(prefs, crit, m))}
          >
            {m}
          </button>
        ))}
      </div>
      <pre className="sq40-pre">{JSON.stringify(prefs)}</pre>
    </Card>
  );
}

/** 51585 — learning loop. */
export function LearningLoopCard() {
  const [store, setStore] = useState({ entries: [] });
  const sum = learningSummary(store);
  return (
    <Card n={51585} title="Learning questions">
      <div className="sq40-prompt-title">Was this finding useful?</div>
      <div className="sq40-prompt-body">"{F.title}" — your answer improves my future hunts.</div>
      <div className="sq40-opts">
        <button
          className="sq40-opt"
          onClick={() => setStore(recordLearningAnswer(store, F.id, 'useful'))}
        >
          Useful
        </button>
        <button
          className="sq40-opt"
          onClick={() => setStore(recordLearningAnswer(store, F.id, 'noise'))}
        >
          Noise
        </button>
      </div>
      <div className="sq40-meta">
        learned: {sum.useful}/{sum.total} useful
      </div>
    </Card>
  );
}

/** 51597 — steering feedback loop. */
export function SteeringFeedbackCard() {
  const [store, setStore] = useState({ entries: [] });
  const sum = steeringFeedbackSummary(store);
  return (
    <Card n={51597} title="Steering feedback requests">
      <div className="sq40-prompt-body">
        I redirected after your steering "go deeper on /support" — did it help?
      </div>
      <div className="sq40-opts">
        <button
          className="sq40-opt"
          onClick={() => setStore(recordSteeringFeedback(store, 'a1', 'helped'))}
        >
          It helped
        </button>
        <button
          className="sq40-opt"
          onClick={() => setStore(recordSteeringFeedback(store, 'a1', 'hurt'))}
        >
          It hurt
        </button>
      </div>
      <div className="sq40-meta">
        helped {sum.helped} · hurt {sum.hurt} of {sum.total}
      </div>
    </Card>
  );
}

/** 51599 + 51600 — the queue itself: urgency triage + snoozing. */
export function QueueBoardCard() {
  const seed = () => {
    let q = createQueue();
    const mk = (kind, urgency, title) => ({
      id: 'q-' + kind,
      kind,
      title,
      body: title,
      options: [{ key: 'ok', label: 'OK' }],
      urgency,
      status: 'open',
      answerKey: null,
      snoozedUntilMs: null,
    });
    q = enqueue(q, mk('checkpoint', 'low', 'Checkpoint?'));
    q = enqueue(q, mk('disclosure', 'urgent', 'Notify client now?'));
    q = enqueue(q, mk('coverage', 'normal', 'Chase remaining coverage?'));
    q = enqueue(q, snoozeByMinutes(mk('timing', 'high', 'Run overnight test?'), 30, 1000));
    return q;
  };
  const [q, setQ] = useState(seed);
  const now = 2000;
  const sum = queueSummary(q, now);
  const next = dequeueNext(q, now);
  return (
    <Card n={51599} title="Interruption triage + question snoozing">
      <div className="sq40-meta">
        total {sum.total} · due {sum.due} · snoozed {sum.snoozed} · answered {sum.answered}
      </div>
      <div className="sq40-prompt-title">Next due (most urgent first):</div>
      <div className="sq40-prompt-body">
        {next.prompt ? next.prompt.title + ' [' + next.prompt.urgency + ']' : 'queue empty'}
      </div>
      <div className="sq40-row">
        <button className="sq40-opt" onClick={() => setQ(next.queue)}>
          ask next
        </button>
        <button className="sq40-opt" onClick={() => setQ(seed())}>
          reset sample
        </button>
      </div>
    </Card>
  );
}

export function SteeringQueueGallery() {
  return (
    <div className="sq40-gallery">
      <h3>Wave 40 · Steering prompt queue (51581–51600)</h3>
      <NotificationPrefCard />
      <QCard
        n={51582}
        title="Handoff question"
        prompt={handoffQuestion(12 * 60000, 10 * 60000, 0)}
      />
      <QCard
        n={51583}
        title="Retest proposal"
        prompt={retestProposal(
          ['app.example.com/api/orders'],
          [F, { ...F, id: 'F-202', asset: '/blog' }]
        )}
      />
      <QCard
        n={51584}
        title="Collaboration prompt"
        prompt={collaborationPrompt(F, ['arjun', 'meera'])}
      />
      <LearningLoopCard />
      <QCard
        n={51586}
        title="Assumption disclosure"
        prompt={assumptionDisclosure([
          'app.example.com is staging',
          'auth testing is allowed',
          'budget is 60 minutes',
        ])}
      />
      <QCard
        n={51587}
        title="Plan-review prompt"
        prompt={planReviewPrompt({
          phases: ['recon sweep', 'injection testing', 'auth testing', 'report'],
        })}
      />
      <QCard
        n={51588}
        title="Checkpoint question"
        prompt={checkpointQuestion('injection testing', 30 * 60000, 30 * 60000)}
      />
      <QCard
        n={51589}
        title="Anomaly alert as question"
        prompt={anomalyQuestion('request rate', 40, 320)}
      />
      <QCard n={51590} title="Coverage question" prompt={coverageQuestion(80, 120)} />
      <QCard
        n={51591}
        title="Tool-choice question"
        prompt={toolChoiceQuestion('fast-scan', 'deep-scan')}
      />
      <QCard n={51592} title="Evidence question" prompt={evidenceQuestion(F, 'high')} />
      <QCard
        n={51593}
        title="Timing question"
        prompt={timingQuestion('full subdomain brute-force', 5 * 3600000)}
      />
      <QCard n={51594} title="Parallelism question" prompt={parallelismQuestion(9, 2, 6)} />
      <QCard
        n={51595}
        title="Data-handling question"
        prompt={dataHandlingQuestion({ ...F, title: 'Exposed customer PII in /api/debug' })}
      />
      <QCard n={51596} title="Disclosure question" prompt={disclosureQuestion(F, 'mid-hunt')} />
      <SteeringFeedbackCard />
      <QCard
        n={51598}
        title="Goal-alignment check"
        prompt={goalAlignmentCheck('maximum coverage', 0, 5 * 3600000)}
      />
      <QueueBoardCard />
    </div>
  );
}
