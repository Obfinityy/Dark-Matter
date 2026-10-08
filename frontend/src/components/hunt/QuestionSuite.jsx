/**
 * QuestionSuite.jsx — wave 41 (ideas 51601–51620): question/interruption
 * management suite.
 * Real working components driving local state. All logic comes from
 * questionCore.js.
 * The QuestionSuiteGallery is exported for review only; it is not
 * mounted in app UI.
 */
import React, { useState } from 'react';
import {
  URGENCY_LABELS,
  newQuestion,
  answerQuestion,
  batchQuestions,
  labelUrgency,
  createAutoAnswerRule,
  applyAutoAnswerRules,
  recordQuestion,
  questionHistory,
  recordAnswerOutcome,
  answerOutcomeAnalytics,
  quietModeQueue,
  deliverQuietQueue,
  voiceAskedDescriptor,
  mobileQuestionCard,
  escalateQuestion,
  questionTiming,
  questionPreview,
  multiOptionQuestion,
  QUESTION_TEMPLATES,
  applyQuestionTemplate,
  fatigueGuard,
  logQuestion,
  questionAuditLog,
  learnFromAnswer,
  learningConfidence,
  emergencyBreakthrough,
  delegateQuestion,
  confidenceDisplay,
  postHuntReview,
} from './questionCore.js';

function Card({ n, title, children }) {
  return (
    <div className="qn41-card" data-idea={n}>
      <div className="qn41-card-head">
        <span className="qn41-num">{n}</span>
        <h4>{title}</h4>
      </div>
      <div className="qn41-card-body">{children}</div>
    </div>
  );
}

function sampleQuestions(nowMs) {
  return [
    newQuestion(
      'coverage',
      'Chase the last 20% of assets?',
      'Two internal hosts remain untested.',
      [
        { key: 'yes', label: 'Yes, full coverage' },
        { key: 'no', label: 'No, stop' },
      ],
      'fyi',
      nowMs - 60000
    ),
    newQuestion(
      'timing',
      'Run the slow brute-force now?',
      'Estimated 4 hours.',
      [
        { key: 'now', label: 'Now' },
        { key: 'overnight', label: 'Overnight' },
      ],
      'decision-needed',
      nowMs - 30000
    ),
    newQuestion(
      'disclosure',
      'Notify the client about the critical?',
      'Confirmed remote code execution.',
      [
        { key: 'notify', label: 'Notify now' },
        { key: 'wait', label: 'Wait for report' },
      ],
      'blocking',
      nowMs - 10000
    ),
  ];
}

function UrgencyTag({ urgency }) {
  const u = URGENCY_LABELS.includes(urgency) ? urgency : 'fyi';
  return <span className={'qn41-urgency qn41-urgency-' + u}>{u}</span>;
}

/** 51601 — non-urgent questions grouped into a single digest. */
export function QuestionBatchCard() {
  const now = 1000000;
  const [qs] = useState(() => sampleQuestions(now));
  const [res] = useState(() => batchQuestions(qs, now));
  return (
    <Card n={51601} title="Question batching (mid-hunt)">
      <div className="qn41-meta">
        open: {qs.length} · standalone (blocking): {res.standalone.length}
      </div>
      {res.digest && (
        <div>
          <div className="qn41-prompt-title">{res.digest.title}</div>
          <div className="qn41-prompt-body">{res.digest.body}</div>
          <UrgencyTag urgency={res.digest.urgency} />
        </div>
      )}
      <div className="qn41-row">
        <div className="qn41-meta">
          standalone keeps: {res.standalone.map(q => q.title).join('; ') || 'none'}
        </div>
      </div>
    </Card>
  );
}

/** 51602 — every question carries an urgency label. */
export function UrgencyLabelCard() {
  const [urg, setUrg] = useState('blocking');
  const q = labelUrgency(
    newQuestion(
      'scope',
      'Expand scope to api-staging?',
      'New asset discovered.',
      [
        { key: 'yes', label: 'Yes' },
        { key: 'no', label: 'No' },
      ],
      urg,
      1000
    )
  );
  return (
    <Card n={51602} title="Question urgency labels">
      <div className="qn41-row">
        {URGENCY_LABELS.map(l => (
          <button
            key={l}
            className={'qn41-opt' + (urg === l ? ' qn41-opt-picked' : '')}
            onClick={() => setUrg(l)}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="qn41-row">
        <UrgencyTag urgency={q.urgency} />
        <span className="qn41-meta">{q.title}</span>
      </div>
    </Card>
  );
}

/** 51603 — predefined answers to recurring questions. */
export function AutoAnswerRuleCard() {
  const q = newQuestion(
    'dig-deeper',
    'Dig deeper on the injection point?',
    'Blind SQLi indicators found.',
    [
      { key: 'yes', label: 'Yes, always dig deeper' },
      { key: 'no', label: 'No' },
    ],
    'decision-needed',
    1000
  );
  const [rules] = useState(() => [
    createAutoAnswerRule('dig deeper', 'yes', 'Standing owner preference'),
  ]);
  const [applied, setApplied] = useState(null);
  return (
    <Card n={51603} title="Auto-answer rules">
      <div className="qn41-meta">
        rule: "{rules[0].pattern}" → {rules[0].answerKey} ({rules[0].reason})
      </div>
      <div className="qn41-row">
        <button
          className="qn41-opt"
          onClick={() => setApplied(applyAutoAnswerRules(q, rules, 2000))}
        >
          run rules
        </button>
        {applied && (
          <div className="qn41-meta">
            {applied.ruleId
              ? `auto-answered "${applied.question.answerKey}" by ${applied.ruleId}`
              : 'no rule matched'}
          </div>
        )}
      </div>
    </Card>
  );
}

/** 51604 — every question and answer, reviewable. */
export function QuestionHistoryCard() {
  const [store, setStore] = useState({ questions: [] });
  const hist = questionHistory(store);
  return (
    <Card n={51604} title="Question history">
      <div className="qn41-row">
        <button
          className="qn41-opt"
          onClick={() => {
            const q = answerQuestion(
              newQuestion(
                'evidence',
                'Upgrade this to high with stronger proof?',
                'Need 20 more minutes.',
                [
                  { key: 'yes', label: 'Yes' },
                  { key: 'no', label: 'No' },
                ],
                'decision-needed',
                3000 + store.questions.length * 1000
              ),
              'yes',
              4000
            );
            setStore(recordQuestion(store, q, q.askedAtMs));
          }}
        >
          record a question
        </button>
      </div>
      <ul className="qn41-list">
        {hist.map(q => (
          <li key={q.id} className="qn41-history-item">
            <UrgencyTag urgency={q.urgency} /> <b>{q.title}</b>
            <div className="qn41-meta">
              {q.status}
              {q.answerKey ? ' → ' + q.answerKey : ''} {q.autoAnswered ? '(auto-answered)' : ''}
            </div>
          </li>
        ))}
      </ul>
      {!hist.length && <div className="qn41-meta">no questions recorded yet</div>}
    </Card>
  );
}

/** 51605 — which answers led to the best outcomes. */
export function ResponseAnalyticsCard() {
  const [store, setStore] = useState({ outcomes: [] });
  const rows = answerOutcomeAnalytics(store);
  return (
    <Card n={51605} title="Question response analytics">
      <div className="qn41-row">
        <button
          className="qn41-opt"
          onClick={() => setStore(recordAnswerOutcome(store, 'Q-1', 'dig', 92, 5000))}
        >
          record outcome: dig → 92
        </button>
        <button
          className="qn41-opt"
          onClick={() => setStore(recordAnswerOutcome(store, 'Q-2', 'skip', 45, 6000))}
        >
          record outcome: skip → 45
        </button>
      </div>
      {rows.length > 0 && (
        <table className="qn41-table">
          <thead>
            <tr>
              <th>answer</th>
              <th>count</th>
              <th>avg score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.answerKey}>
                <td>{r.answerKey}</td>
                <td>{r.count}</td>
                <td>{r.avgScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/** 51606 — quiet mode queues questions instead of interrupting. */
export function SilentModeCard() {
  const [queue, setQueue] = useState([]);
  const [delivered, setDelivered] = useState([]);
  return (
    <Card n={51606} title="Silent-mode questions">
      <div className="qn41-meta">
        queued silently: {queue.length} · delivered: {delivered.length}
      </div>
      <div className="qn41-row">
        <button
          className="qn41-opt"
          onClick={() =>
            setQueue(
              quietModeQueue(
                queue,
                newQuestion(
                  'timing',
                  'Run overnight test?',
                  'Slow scan queued.',
                  [{ key: 'ok', label: 'OK' }],
                  'fyi',
                  1000
                )
              )
            )
          }
        >
          queue a question silently
        </button>
        <button
          className="qn41-opt"
          onClick={() => {
            const r = deliverQuietQueue(queue);
            setDelivered(d => d.concat(r.delivered));
            setQueue(r.queue);
          }}
        >
          deliver queued
        </button>
      </div>
    </Card>
  );
}

/** 51607 — the avatar speaks important questions aloud. */
export function VoiceQuestionCard() {
  const q = newQuestion(
    'disclosure',
    'Critical finding confirmed — notify the client now?',
    'Remote code execution verified.',
    [
      { key: 'notify', label: 'Notify now' },
      { key: 'wait', label: 'Wait' },
    ],
    'blocking',
    1000
  );
  const [voice, setVoice] = useState('aria');
  const [desc, setDesc] = useState(null);
  return (
    <Card n={51607} title="Voice-asked questions">
      <div className="qn41-row">
        {['aria', 'kai'].map(v => (
          <button
            key={v}
            className={'qn41-opt' + (voice === v ? ' qn41-opt-picked' : '')}
            onClick={() => setVoice(v)}
          >
            {v}
          </button>
        ))}
        <button className="qn41-opt" onClick={() => setDesc(voiceAskedDescriptor(q, voice))}>
          speak question
        </button>
      </div>
      {desc && (
        <div className="qn41-prompt-body">
          voice: {desc.voice} · priority: {desc.priority}
          <br />"{desc.speakText}"
        </div>
      )}
    </Card>
  );
}

/** 51608 — questions as swipeable mobile cards. */
export function MobileCard() {
  const q = newQuestion(
    'priority',
    'Which lead matters more?',
    'Two strong leads found.',
    [
      { key: 'idor', label: 'IDOR lead' },
      { key: 'sqli', label: 'SQLi lead' },
      { key: 'both', label: 'Chase both' },
    ],
    'decision-needed',
    1000
  );
  const [card, setCard] = useState(() => mobileQuestionCard(q));
  const [picked, setPicked] = useState(null);
  return (
    <Card n={51608} title="Mobile question cards">
      <div className="qn41-prompt-title">{card.title}</div>
      <div className="qn41-row">
        {card.swipeActions.map(a => (
          <button
            key={a.key}
            className={'qn41-opt' + (picked === a.key ? ' qn41-opt-picked' : '')}
            onClick={() => setPicked(a.key)}
          >
            swipe: {a.label}
          </button>
        ))}
      </div>
      <div className="qn41-meta">
        card id: {card.cardId} · compact layout · {picked ? 'chose ' + picked : 'no choice yet'}
      </div>
    </Card>
  );
}

/** 51609 — unanswered blocking questions escalate. */
export function EscalationCard() {
  const [q, setQ] = useState(() =>
    newQuestion(
      'disclosure',
      'Unconfirmed critical needs owner eyes',
      'Awaiting decision 20 minutes.',
      [{ key: 'ack', label: 'Acknowledge' }],
      'blocking',
      1000
    )
  );
  const [team, setTeam] = useState('arjun');
  return (
    <Card n={51609} title="Question escalation">
      <div className="qn41-row">
        <input
          className="qn41-input"
          style={{ maxWidth: 160 }}
          value={team}
          onChange={e => setTeam(e.target.value)}
        />
        <button className="qn41-opt" onClick={() => setQ(escalateQuestion(q, team, 5000))}>
          escalate
        </button>
      </div>
      <div className="qn41-meta">
        status: {q.status} · escalated:{' '}
        {q.escalated ? 'yes → ' + q.escalatedTo + ' at ' + q.escalatedAtMs : 'no'}
      </div>
    </Card>
  );
}

/** 51610 — questions land at phase boundaries. */
export function TimingCard() {
  const [phase, setPhase] = useState('injection-testing');
  const q = newQuestion(
    'coverage',
    'Chase remaining coverage?',
    '80% covered.',
    [
      { key: 'yes', label: 'Yes' },
      { key: 'no', label: 'No' },
    ],
    'decision-needed',
    1000
  );
  const t = questionTiming(q, phase, 2000);
  return (
    <Card n={51610} title="Contextual question timing">
      <div className="qn41-row">
        {['injection-testing', 'recon-complete', 'scan-complete', 'triage-complete'].map(p => (
          <button
            key={p}
            className={'qn41-opt' + (phase === p ? ' qn41-opt-picked' : '')}
            onClick={() => setPhase(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="qn41-meta">
        phase: {t.huntPhase} · at boundary: {t.atBoundary ? 'yes' : 'no'} →{' '}
        {t.askNow ? 'ask now' : 'hold until ' + t.holdUntilPhase}
      </div>
    </Card>
  );
}

/** 51611 — preview the outcome of each option before choosing. */
export function PreviewCard() {
  const q = newQuestion(
    'exploit-depth',
    'Demonstrate full impact?',
    'Confirmed RCE.',
    [
      { key: 'full', label: 'Full impact evidence' },
      { key: 'safe', label: 'Safe proof only' },
    ],
    'decision-needed',
    1000
  );
  const [pv, setPv] = useState(null);
  return (
    <Card n={51611} title="Question previews">
      <div className="qn41-row">
        <button
          className="qn41-opt"
          onClick={() =>
            setPv(
              questionPreview(q, {
                full: 'Agent will capture full chain evidence and stop before data impact.',
                safe: 'Agent captures minimal proof and continues scanning.',
              })
            )
          }
        >
          show previews
        </button>
      </div>
      {pv && (
        <ul className="qn41-list">
          {pv.options.map(o => (
            <li key={o.optionKey}>
              <b>{o.label}</b>: {o.previewText}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** 51612 — questions with 3–4 concrete options. */
export function MultiOptionCard() {
  const [q, setQ] = useState(null);
  const [err, setErr] = useState('');
  return (
    <Card n={51612} title="Multi-option questions">
      <div className="qn41-row">
        <button
          className="qn41-opt"
          onClick={() => {
            try {
              setQ(
                multiOptionQuestion(
                  'How should I proceed on /api/admin?',
                  'Admin panel found with weak auth.',
                  [
                    { key: 'probe', label: 'Probe gently' },
                    { key: 'deep', label: 'Test deeply' },
                    { key: 'skip', label: 'Skip it' },
                  ],
                  'decision-needed'
                )
              );
              setErr('');
            } catch (e) {
              setErr(e.message);
            }
          }}
        >
          build 3-option question
        </button>
        <button
          className="qn41-opt"
          onClick={() => {
            try {
              multiOptionQuestion('bad', 'x', [{ key: 'a', label: 'A' }], 'fyi');
            } catch (e) {
              setErr('guard works: ' + e.message);
            }
          }}
        >
          try invalid (1 option)
        </button>
      </div>
      {err && <div className="qn41-meta">{err}</div>}
      {q && (
        <div>
          <div className="qn41-prompt-title">{q.title}</div>
          <div className="qn41-row">
            {q.options.map(o => (
              <button
                key={o.key}
                className={'qn41-opt' + (q.answerKey === o.key ? ' qn41-opt-picked' : '')}
                onClick={() => setQ(answerQuestion(q, o.key, 2000))}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="qn41-meta">
            {q.options.length} options · {q.status}
            {q.answerKey ? ' → ' + q.answerKey : ''}
          </div>
        </div>
      )}
    </Card>
  );
}

/** 51613 — the agent's question style follows your template. */
export function TemplateCard() {
  const [key, setKey] = useState('concise');
  const [ask, setAsk] = useState('Should I continue the auth tests?');
  const t = applyQuestionTemplate(key, {
    title: 'Auth testing',
    context: 'Session handling is weak.',
    ask,
  });
  return (
    <Card n={51613} title="Question templates">
      <div className="qn41-row">
        {Object.keys(QUESTION_TEMPLATES).map(k => (
          <button
            key={k}
            className={'qn41-opt' + (key === k ? ' qn41-opt-picked' : '')}
            onClick={() => setKey(k)}
          >
            {k}
          </button>
        ))}
      </div>
      <input className="qn41-input" value={ask} onChange={e => setAsk(e.target.value)} />
      <div className="qn41-prompt-body" style={{ marginTop: 8 }}>
        {t.body}
      </div>
      <div className="qn41-meta">template: {t.template}</div>
    </Card>
  );
}

/** 51614 — limits interruptions per hour. */
export function FatigueGuardCard() {
  const [asked, setAsked] = useState(3);
  const [limit, setLimit] = useState(5);
  const g = fatigueGuard(asked, limit);
  return (
    <Card n={51614} title="Question fatigue guard">
      <div className="qn41-row">
        <span className="qn41-meta">asked this hour:</span>
        <input
          className="qn41-input"
          style={{ maxWidth: 70 }}
          type="number"
          value={asked}
          onChange={e => setAsked(Number(e.target.value))}
        />
        <span className="qn41-meta">limit:</span>
        <input
          className="qn41-input"
          style={{ maxWidth: 70 }}
          type="number"
          value={limit}
          onChange={e => setLimit(Number(e.target.value))}
        />
      </div>
      <div className="qn41-meta">
        {g.allowed
          ? `interruption allowed — ${g.remaining} remaining`
          : 'limit reached — next question holds'}
      </div>
      <div className="qn41-bar">
        <div
          className="qn41-bar-fill"
          style={{ width: Math.min(100, (g.askedThisHour / g.limitPerHour) * 100) + '%' }}
        />
      </div>
    </Card>
  );
}

/** 51615 — auditable record of every question and decision. */
export function AuditLogCard() {
  const [log, setLog] = useState([]);
  const rows = questionAuditLog(log);
  return (
    <Card n={51615} title="Proactive question log">
      <div className="qn41-row">
        <button
          className="qn41-opt"
          onClick={() =>
            setLog(
              logQuestion(log, {
                id: 'l' + log.length,
                questionId: 'Q-abc123',
                action: 'asked',
                detail: 'coverage question',
                atMs: 1000 + log.length * 1000,
              })
            )
          }
        >
          log an event
        </button>
        <button
          className="qn41-opt"
          onClick={() =>
            setLog(
              logQuestion(log, {
                id: 'l' + log.length,
                questionId: 'Q-abc123',
                action: 'answered',
                detail: 'owner chose dig',
                atMs: 1000 + log.length * 1000,
              })
            )
          }
        >
          log an answer
        </button>
      </div>
      <ul className="qn41-list">
        {rows.map(r => (
          <li key={r.id}>{r.line}</li>
        ))}
      </ul>
      {!rows.length && <div className="qn41-meta">log is empty</div>}
    </Card>
  );
}

/** 51616 — answers fine-tune future judgment. */
export function LearningCard() {
  const [profile, setProfile] = useState({ weights: {} });
  const [tag, setTag] = useState('injection');
  const [ans, setAns] = useState('dig');
  const conf = learningConfidence(profile, tag, ans);
  return (
    <Card n={51616} title="Question-driven learning">
      <div className="qn41-row">
        <input
          className="qn41-input"
          style={{ maxWidth: 130 }}
          value={tag}
          onChange={e => setTag(e.target.value)}
        />
        {['dig', 'skip'].map(a => (
          <button
            key={a}
            className={'qn41-opt' + (ans === a ? ' qn41-opt-picked' : '')}
            onClick={() => setAns(a)}
          >
            {a}
          </button>
        ))}
        <button
          className="qn41-opt"
          onClick={() => setProfile(learnFromAnswer(profile, ans, [tag]))}
        >
          record answer
        </button>
      </div>
      <div className="qn41-meta">
        learned weights: {Object.keys(profile.weights).length} · confidence for {tag}:{ans} = {conf}
        %
      </div>
    </Card>
  );
}

/** 51617 — critical questions break through quiet hours. */
export function EmergencyCard() {
  const [quiet, setQuiet] = useState(true);
  const q = newQuestion(
    'emergency',
    'Production database exposed to the internet',
    'Critical: open port 5432 with default credentials.',
    [{ key: 'ack', label: 'Acknowledge' }],
    'blocking',
    1000
  );
  const eq = { ...q, kind: 'emergency' };
  const r = emergencyBreakthrough(
    eq,
    Date.UTC(2026, 9, 8, 2, 0, 0),
    quiet ? { start: 22, end: 7 } : null
  );
  return (
    <Card n={51617} title="Emergency questions">
      <div className="qn41-row">
        <button
          className={'qn41-opt' + (quiet ? ' qn41-opt-picked' : '')}
          onClick={() => setQuiet(!quiet)}
        >
          {quiet ? 'quiet hours on' : 'quiet hours off'}
        </button>
      </div>
      <div className="qn41-meta">
        quiet hour: {r.isQuietHour ? 'yes' : 'no'} · breaks through:{' '}
        {r.breaksThrough ? 'yes' : 'no'} → delivery: {r.delivery}
      </div>
    </Card>
  );
}

/** 51618 — route question types to teammates. */
export function DelegationCard() {
  const [q, setQ] = useState(() =>
    newQuestion(
      'scope',
      'Add partner API to scope?',
      'Third-party integration found.',
      [
        { key: 'yes', label: 'Yes' },
        { key: 'no', label: 'No' },
      ],
      'decision-needed',
      1000
    )
  );
  const [mate, setMate] = useState('meera');
  return (
    <Card n={51618} title="Question delegation">
      <div className="qn41-row">
        <input
          className="qn41-input"
          style={{ maxWidth: 140 }}
          value={mate}
          onChange={e => setMate(e.target.value)}
        />
        <button
          className="qn41-opt"
          onClick={() => setQ(delegateQuestion(q, mate, 'scope owner knows this vendor'))}
        >
          delegate
        </button>
      </div>
      <div className="qn41-meta">
        status: {q.status}
        {q.delegatedTo ? ' → ' + q.delegatedTo : ''}
        {q.delegationReason ? ' (' + q.delegationReason + ')' : ''}
      </div>
    </Card>
  );
}

/** 51619 — the agent shows its lean on each option. */
export function ConfidenceCard() {
  const [res, setRes] = useState(() =>
    confidenceDisplay([
      { key: 'dig', label: 'Dig deeper', confidence: 72 },
      { key: 'pivot', label: 'Pivot to auth', confidence: 41 },
      { key: 'skip', label: 'Skip', confidence: 12 },
    ])
  );
  return (
    <Card n={51619} title="Question confidence display">
      {res.options.map(o => (
        <div key={o.key} className="qn41-row">
          <span className="qn41-meta" style={{ minWidth: 110 }}>
            {o.label} ({o.bar}%)
          </span>
          <div className="qn41-bar" style={{ flex: 1 }}>
            <div className="qn41-bar-fill" style={{ width: o.bar + '%' }} />
          </div>
        </div>
      ))}
      <div className="qn41-meta" style={{ marginTop: 8 }}>
        agent leans toward: <b>{res.agentLean}</b>
      </div>
    </Card>
  );
}

/** 51620 — revisit the key decisions after the hunt. */
export function PostHuntReviewCard() {
  const seed = () => {
    let s = { questions: [] };
    const q1 = answerQuestion(
      newQuestion(
        'disclosure',
        'Notify client about critical?',
        'RCE confirmed.',
        [{ key: 'notify', label: 'Notify' }],
        'blocking',
        1000
      ),
      'notify',
      2000
    );
    const q2 = answerQuestion(
      newQuestion(
        'coverage',
        'Chase last 20%?',
        'Two hosts left.',
        [{ key: 'yes', label: 'Yes' }],
        'fyi',
        3000
      ),
      'yes',
      4000
    );
    s = recordQuestion(s, q1, 1000);
    s = recordQuestion(s, q2, 3000);
    return s;
  };
  const [store, setStore] = useState(seed);
  const review = postHuntReview(store);
  return (
    <Card n={51620} title="Post-hunt question review">
      <div className="qn41-meta">
        total {review.totalQuestions} · decisions {review.decisionsMade} · blocking{' '}
        {review.blockingDecisions}
      </div>
      <ul className="qn41-list">
        {review.keyDecisions.map(d => (
          <li key={d.id}>
            <UrgencyTag urgency={d.urgency} /> <b>{d.title}</b>
            <div className="qn41-meta">
              answer: {d.answerKey || '—'}
              {d.autoAnswered ? ' (auto)' : ''}
            </div>
          </li>
        ))}
      </ul>
      <div className="qn41-row">
        <button className="qn41-opt" onClick={() => setStore(seed())}>
          reload sample
        </button>
      </div>
    </Card>
  );
}

export function QuestionSuiteGallery() {
  return (
    <div className="qn41-gallery">
      <h3>Wave 41 · Question management (51601–51620)</h3>
      <QuestionBatchCard />
      <UrgencyLabelCard />
      <AutoAnswerRuleCard />
      <QuestionHistoryCard />
      <ResponseAnalyticsCard />
      <SilentModeCard />
      <VoiceQuestionCard />
      <MobileCard />
      <EscalationCard />
      <TimingCard />
      <PreviewCard />
      <MultiOptionCard />
      <TemplateCard />
      <FatigueGuardCard />
      <AuditLogCard />
      <LearningCard />
      <EmergencyCard />
      <DelegationCard />
      <ConfidenceCard />
      <PostHuntReviewCard />
    </div>
  );
}
