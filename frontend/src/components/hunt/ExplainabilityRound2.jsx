/**
 * ExplainabilityRound2.jsx — wave 36 (ideas 51401–51440): explainability
 * round 2 suite.
 * Real working components driving local state — no mocks, no canned-only
 * controls. All logic comes from explainabilityRound2Core.js.
 * The Wave36Gallery is exported for review only; it is not mounted in app UI.
 */
import React, { useState } from 'react';
import {
  WAVE36_IDEAS,
  depthText,
  DEPTH_LEVELS,
  lookupTerm,
  findJargonTerms,
  JARGON_GLOSSARY,
  exploitSteps,
  followUpSuggestions,
  answerFollowUp,
  translateExplanation,
  EXPLANATION_LANGS,
  roleExplanation,
  EXPLANATION_ROLES,
  confidenceFlags,
  evidenceLinks,
  comparisonExplanation,
  riskInContext,
  fixEnding,
  recordExplanation,
  explanationHistory,
  getExplanation,
  buildShareCard,
  voiceScript,
  buildQuiz,
  scoreQuiz,
  kidExplanation,
  EXPLANATION_TEMPLATES,
  applyTemplate,
  editExplanation,
  addExplanationVersion,
  getVersion,
  diffVersions,
  contrastingOpinions,
  severityJustification,
  attackScenario,
  mapToProcess,
  buildExplanationIndex,
  searchExplanations,
  exportSlidesMarkdown,
  exportOnePagerMarkdown,
  regulatoryFraming,
  REGULATIONS,
  costOfBreach,
  costSentence,
  weaknessTimeline,
  peerBenchmark,
  recordFeedback,
  feedbackSummary,
  multiFindingNarrative,
  postThreadMessage,
  threadReply,
  severityGauge,
  difficultyMeter,
  exploitabilityMeter,
  gaugeLabel,
  whiteLabelFinding,
  autoLinkGlossary,
  storyModeSection,
  estimateKnowledge,
  personalizedExplanation,
  mythBusting,
} from './explainabilityRound2Core.js';
import { explainFinding } from './explainabilityCore.js';

const SAMPLE_FINDINGS = [
  {
    id: 'F-201',
    type: 'sql-injection',
    severity: 'critical',
    title: 'SQL injection in search endpoint',
    location: '/api/search?q=',
    evidence: 'Time-based probe returned DB version string',
    firstSeen: '2026-09-28',
    introducedIn: '2026-06-12',
    businessUnit: 'ecommerce',
  },
  {
    id: 'F-202',
    type: 'xss',
    severity: 'high',
    title: 'Stored XSS in comment field',
    location: '/profile/comments',
    evidence: 'Marker script executed on page render',
    businessUnit: 'saas',
  },
  {
    id: 'F-203',
    type: 'idor',
    severity: 'high',
    title: 'IDOR on order endpoint',
    location: '/api/orders/{id}',
    businessUnit: 'ecommerce',
  },
  {
    id: 'F-204',
    type: 'jwt-none-alg',
    severity: 'critical',
    title: 'JWT accepts none algorithm',
    location: 'Authorization header',
    evidence: 'Forged admin token accepted with alg=none',
    businessUnit: 'fintech',
  },
  {
    id: 'F-205',
    type: 'secret-leak',
    severity: 'high',
    title: 'API key in client bundle',
    location: '/static/app.js',
    businessUnit: 'saas',
  },
];

function ideaNo(n) {
  const row = WAVE36_IDEAS.find(([id]) => id === n);
  return row ? `#${row[0]}` : '';
}

function Card({ idea, title, children }) {
  return (
    <section className="ex36-card" aria-label={title}>
      <header className="ex36-card-head">
        <h3 className="ex36-card-title">{title}</h3>
        <span className="ex36-idea">{ideaNo(idea)}</span>
      </header>
      <div className="ex36-card-body">{children}</div>
    </section>
  );
}

function FindingPicker({ value, onChange, label }) {
  return (
    <select
      className="ex36-input"
      value={value.id}
      aria-label={label || 'Finding'}
      onChange={e => onChange(SAMPLE_FINDINGS.find(f => f.id === e.target.value))}
    >
      {SAMPLE_FINDINGS.map(f => (
        <option key={f.id} value={f.id}>
          {f.id} — {f.title}
        </option>
      ))}
    </select>
  );
}

function Meter({ value, label }) {
  return (
    <div className="ex36-meter" role="img" aria-label={`${label}: ${value} of 100`}>
      <div className="ex36-meter-track">
        <div className="ex36-meter-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="ex36-meter-val">
        {value} · {label}
      </span>
    </div>
  );
}

function downloadFile(name, text) {
  const blob = new Blob([text], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --- 51401 depth slider ------------------------------------------------------------------
export function DepthSliderCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const [depth, setDepth] = useState(2);
  const out = depthText(finding, depth);
  return (
    <Card idea={51401} title="Explanation depth slider">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
      </div>
      <label className="ex36-row">
        <span className="ex36-dim">Depth: {out.label}</span>
        <input
          type="range"
          min="1"
          max="4"
          step="1"
          value={depth}
          aria-label="Explanation depth"
          onChange={e => setDepth(Number(e.target.value))}
        />
        <span className="ex36-dim">{DEPTH_LEVELS.map(d => d.label).join(' · ')}</span>
      </label>
      <p className="ex36-text">{out.text}</p>
    </Card>
  );
}

// --- 51402 jargon buster -------------------------------------------------------------------
export function JargonBusterCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const [active, setActive] = useState(null);
  const [query, setQuery] = useState('');
  const text = explainFinding(finding);
  const terms = findJargonTerms(text);
  const looked = lookupTerm(query);
  return (
    <Card idea={51402} title="Jargon buster">
      <div className="ex36-row">
        <FindingPicker
          value={finding}
          onChange={f => {
            setFinding(f);
            setActive(null);
          }}
        />
      </div>
      <p className="ex36-dim">Tap a highlighted term for its plain definition.</p>
      <div className="ex36-terms">
        {terms.length === 0 && (
          <span className="ex36-dim">No glossary terms in this explanation.</span>
        )}
        {terms.map(t => (
          <button
            key={t}
            className={`ex36-term${active === t ? ' ex36-term-active' : ''}`}
            onClick={() => setActive(active === t ? null : t)}
          >
            {t}
          </button>
        ))}
      </div>
      {active && (
        <p className="ex36-text ex36-def">
          <strong>{active}:</strong> {JARGON_GLOSSARY[active]}
        </p>
      )}
      <div className="ex36-row">
        <input
          className="ex36-input"
          value={query}
          aria-label="Look up a term"
          onChange={e => setQuery(e.target.value)}
        />
        <span className="ex36-text">
          {looked ? `${looked.term}: ${looked.definition}` : query ? 'Not in the glossary.' : ''}
        </span>
      </div>
    </Card>
  );
}

// --- 51403 visual exploit walkthrough --------------------------------------------------------
export function ExploitWalkthroughCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const [idx, setIdx] = useState(0);
  const steps = exploitSteps(finding);
  const step = steps[Math.min(idx, steps.length - 1)];
  return (
    <Card idea={51403} title="Visual exploit walkthrough">
      <div className="ex36-row">
        <FindingPicker
          value={finding}
          onChange={f => {
            setFinding(f);
            setIdx(0);
          }}
        />
      </div>
      <div className="ex36-flow" aria-label="Exploit walkthrough steps">
        {steps.map((s, i) => (
          <React.Fragment key={s.n}>
            <button
              className={`ex36-step${i === idx ? ' ex36-step-active' : ''}${i < idx ? ' ex36-step-done' : ''}`}
              onClick={() => setIdx(i)}
              aria-label={`Step ${s.n}: ${s.title}`}
            >
              <span className="ex36-step-n">{s.n}</span>
              <span className="ex36-step-t">{s.title}</span>
            </button>
            {i < steps.length - 1 && (
              <span className="ex36-flow-arrow" aria-hidden="true">
                →
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
      <p className="ex36-text">
        <strong>
          Step {step.n} — {step.title}:
        </strong>{' '}
        {step.detail}
      </p>
      <div className="ex36-row">
        <button className="ex36-btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
          Back
        </button>
        <button
          className="ex36-btn"
          disabled={idx === steps.length - 1}
          onClick={() => setIdx(idx + 1)}
        >
          Next step
        </button>
        <span className="ex36-dim">
          {idx + 1} of {steps.length}
        </span>
      </div>
    </Card>
  );
}

// --- 51404 ask-follow-up -----------------------------------------------------------------------
export function FollowUpCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const [thread, setThread] = useState([]);
  const [custom, setCustom] = useState('');
  const ask = q => {
    const withQ = [...thread, { q, a: null }];
    setThread([...withQ.slice(0, -1), { q, a: answerFollowUp(finding, q) }]);
    setCustom('');
  };
  return (
    <Card idea={51404} title="Ask-follow-up threads">
      <div className="ex36-row">
        <FindingPicker
          value={finding}
          onChange={f => {
            setFinding(f);
            setThread([]);
          }}
        />
      </div>
      <div className="ex36-terms">
        {followUpSuggestions(finding).map(s => (
          <button key={s.id} className="ex36-term" onClick={() => ask(s.question)}>
            {s.question}
          </button>
        ))}
      </div>
      <div className="ex36-row">
        <input
          className="ex36-input ex36-grow"
          value={custom}
          aria-label="Ask your own follow-up"
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && custom.trim()) ask(custom.trim());
          }}
        />
        <button className="ex36-btn" disabled={!custom.trim()} onClick={() => ask(custom.trim())}>
          Ask
        </button>
      </div>
      {thread.map((t, i) => (
        <div key={i} className="ex36-qa">
          <p className="ex36-line">
            <strong>Q:</strong> {t.q}
          </p>
          <p className="ex36-text">
            <strong>A:</strong> {t.a}
          </p>
        </div>
      ))}
    </Card>
  );
}

// --- 51405 multi-language --------------------------------------------------------------------------
export function LanguageCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[1]);
  const [lang, setLang] = useState('en');
  return (
    <Card idea={51405} title="Multi-language explanations">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
        <select
          className="ex36-input"
          value={lang}
          aria-label="Explanation language"
          onChange={e => setLang(e.target.value)}
        >
          {EXPLANATION_LANGS.map(l => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <p className="ex36-text">{translateExplanation(finding, lang)}</p>
      <p className="ex36-dim">
        Template-based translation — key phrases are localized, not machine-translated prose.
      </p>
    </Card>
  );
}

// --- 51406 role-based ------------------------------------------------------------------------------
export function RoleCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[2]);
  const [role, setRole] = useState('developer');
  return (
    <Card idea={51406} title="Role-based explanations">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
        {EXPLANATION_ROLES.map(r => (
          <button
            key={r}
            className={`ex36-btn${role === r ? ' ex36-btn-active' : ''}`}
            aria-pressed={role === r}
            onClick={() => setRole(r)}
          >
            {r[0].toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>
      <p className="ex36-text">{roleExplanation(finding, role)}</p>
    </Card>
  );
}

// --- 51407 confidence flags --------------------------------------------------------------------------
export function ConfidenceCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[2]);
  return (
    <Card idea={51407} title="Explanation confidence flags">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
      </div>
      <ul className="ex36-list">
        {confidenceFlags(finding).map(f => (
          <li key={f.part}>
            <span className={`ex36-flag ex36-flag-${f.level}`}>{f.level}</span>
            <strong> {f.part}:</strong> {f.note}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// --- 51408 evidence-linked claims ----------------------------------------------------------------------
export function EvidenceLinksCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  return (
    <Card idea={51408} title="Evidence-linked explanations">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
      </div>
      <ul className="ex36-list">
        {evidenceLinks(finding).map(l => (
          <li key={l.id}>
            {l.claim}{' '}
            <span className="ex36-ev" title={l.evidence}>
              [evidence{l.ref ? `: ${l.ref}` : ': none recorded'}]
            </span>
          </li>
        ))}
      </ul>
      <p className="ex36-dim">Hover a marker to see the supporting evidence for that claim.</p>
    </Card>
  );
}

// --- 51409 comparison explanations -----------------------------------------------------------------------
export function ComparisonCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const [previous, setPrevious] = useState(SAMPLE_FINDINGS[1]);
  return (
    <Card idea={51409} title="Comparison explanations">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} label="Current finding" />
        <FindingPicker value={previous} onChange={setPrevious} label="Previous finding" />
      </div>
      <p className="ex36-text">{comparisonExplanation(finding, previous)}</p>
    </Card>
  );
}

// --- 51410 risk-in-context ---------------------------------------------------------------------------------
export function RiskContextCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const [business, setBusiness] = useState('ecommerce');
  return (
    <Card idea={51410} title="Risk-in-context explainer">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
        <select
          className="ex36-input"
          value={business}
          aria-label="Business type"
          onChange={e => setBusiness(e.target.value)}
        >
          {['ecommerce', 'saas', 'fintech', 'healthcare'].map(b => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
      <p className="ex36-text">{riskInContext(finding, { business })}</p>
    </Card>
  );
}

// --- 51411 fix-oriented endings ------------------------------------------------------------------------------
export function FixEndingCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[1]);
  const [showSteps, setShowSteps] = useState(true);
  const fe = fixEnding(finding);
  return (
    <Card idea={51411} title="Fix-oriented explanations">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
        <button
          className="ex36-btn"
          aria-pressed={showSteps}
          onClick={() => setShowSteps(!showSteps)}
        >
          {showSteps ? 'Hide fix steps' : 'Show fix steps'}
        </button>
      </div>
      <p className="ex36-text">{explainFinding(finding)}</p>
      {showSteps && (
        <ol className="ex36-list">
          {fe.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
      <p className="ex36-text ex36-fixclose">{fe.closing}</p>
    </Card>
  );
}

// --- 51412 explanation history -----------------------------------------------------------------------------------
export function HistoryCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const [history, setHistory] = useState([]);
  const [mode, setMode] = useState('plain');
  const [viewId, setViewId] = useState(null);
  const texts = {
    plain: explainFinding(finding),
    depth4: depthText(finding, 4).text,
    kid: kidExplanation(finding),
  };
  const generate = () => {
    const next = recordExplanation(history, { findingId: finding.id, mode, text: texts[mode] });
    setHistory(next);
    setViewId(next[next.length - 1].id);
  };
  const viewing = getExplanation(history, viewId);
  const list = explanationHistory(history, finding.id);
  return (
    <Card idea={51412} title="Explanation history">
      <div className="ex36-row">
        <FindingPicker
          value={finding}
          onChange={f => {
            setFinding(f);
            setViewId(null);
          }}
        />
        <select
          className="ex36-input"
          value={mode}
          aria-label="Explanation mode"
          onChange={e => setMode(e.target.value)}
        >
          <option value="plain">Plain</option>
          <option value="depth4">Full walkthrough</option>
          <option value="kid">Kid-friendly</option>
        </select>
        <button className="ex36-btn" onClick={generate}>
          Generate + record
        </button>
      </div>
      <div className="ex36-row">
        {list.length === 0 && (
          <span className="ex36-dim">No explanations recorded for this finding yet.</span>
        )}
        {list.map(e => (
          <button
            key={e.id}
            className={`ex36-btn${viewId === e.id ? ' ex36-btn-active' : ''}`}
            onClick={() => setViewId(e.id)}
          >
            #{e.seq} · {e.mode}
          </button>
        ))}
      </div>
      {viewing && <p className="ex36-text">{viewing.text}</p>}
    </Card>
  );
}

// --- 51413 shareable explanation cards ---------------------------------------------------------------------------------
export function ShareCardComp() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const [copied, setCopied] = useState(false);
  const card = buildShareCard(finding);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(card.shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Card idea={51413} title="Shareable explanation cards">
      <div className="ex36-row">
        <FindingPicker
          value={finding}
          onChange={f => {
            setFinding(f);
            setCopied(false);
          }}
        />
      </div>
      <div className="ex36-sharecard">
        <div className="ex36-sharecard-head">
          <strong>{card.title}</strong>
          <span className={`ex36-sev ex36-sev-${(card.severity || 'unknown').toLowerCase()}`}>
            {card.severity}
          </span>
        </div>
        <p className="ex36-line">{card.location}</p>
        <p className="ex36-text">{card.summary}</p>
        <p className="ex36-line">
          <strong>Fix:</strong> {card.fixLine}
        </p>
      </div>
      <div className="ex36-row">
        <button className="ex36-btn" onClick={copy}>
          {copied ? 'Copied!' : 'Copy card text'}
        </button>
      </div>
      {!copied && <pre className="ex36-pre">{card.shareText}</pre>}
    </Card>
  );
}

// --- 51414 voice explanations -----------------------------------------------------------------------------------------------
export function VoiceCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[1]);
  const [speaking, setSpeaking] = useState(false);
  const script = voiceScript(finding);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const speak = () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(script);
    u.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };
  const stop = () => {
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  };
  return (
    <Card idea={51414} title="Voice explanations">
      <div className="ex36-row">
        <FindingPicker
          value={finding}
          onChange={f => {
            setFinding(f);
            stop();
          }}
        />
        <button className="ex36-btn" disabled={!supported || speaking} onClick={speak}>
          {speaking ? 'Speaking…' : 'Listen'}
        </button>
        <button className="ex36-btn" disabled={!speaking} onClick={stop}>
          Stop
        </button>
      </div>
      {!supported && (
        <p className="ex36-warn">Speech synthesis is not available in this browser.</p>
      )}
      <p className="ex36-dim">TTS-ready script (plain text, no markdown):</p>
      <p className="ex36-text">{script}</p>
    </Card>
  );
}

// --- 51415 explanation quizzes ----------------------------------------------------------------------------------------------------
export function QuizCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const quiz = buildQuiz(finding);
  const submit = () =>
    setResult(
      scoreQuiz(
        quiz,
        quiz.questions.map((q, i) => answers[i])
      )
    );
  const reset = f => {
    setFinding(f);
    setAnswers({});
    setResult(null);
  };
  return (
    <Card idea={51415} title="Explanation quizzes">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={reset} />
      </div>
      {quiz.questions.map((q, i) => (
        <fieldset key={q.id} className="ex36-fieldset">
          <legend className="ex36-line">
            {i + 1}. {q.q}
          </legend>
          {q.options.map((opt, oi) => (
            <label key={oi} className="ex36-check">
              <input
                type="radio"
                name={q.id}
                checked={answers[i] === oi}
                onChange={() => setAnswers({ ...answers, [i]: oi })}
              />{' '}
              {opt}
            </label>
          ))}
        </fieldset>
      ))}
      <div className="ex36-row">
        <button className="ex36-btn" onClick={submit}>
          Check answers
        </button>
        <button className="ex36-btn" onClick={() => reset(finding)}>
          Retake
        </button>
        {result && (
          <span className={result.passed ? 'ex36-pass' : 'ex36-warn'}>
            {result.correct}/{result.total} correct ({result.pct}%) —{' '}
            {result.passed ? 'understood' : 'review the explanation and try again'}
          </span>
        )}
      </div>
    </Card>
  );
}

// --- 51416 kid-friendly mode ----------------------------------------------------------------------------------------------------------------
export function KidModeCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[1]);
  const [kid, setKid] = useState(false);
  return (
    <Card idea={51416} title="Kid-friendly mode">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
        <button className="ex36-btn" aria-pressed={kid} onClick={() => setKid(!kid)}>
          {kid ? 'Show standard version' : 'Switch to kid-friendly'}
        </button>
      </div>
      <p className="ex36-text">{kid ? kidExplanation(finding) : explainFinding(finding)}</p>
    </Card>
  );
}

// --- 51417 explanation templates --------------------------------------------------------------------------------------------------------------------
export function TemplateCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[3]);
  const [tpl, setTpl] = useState(EXPLANATION_TEMPLATES[0].id);
  const applied = applyTemplate(tpl, finding);
  return (
    <Card idea={51417} title="Explanation templates">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
        <select
          className="ex36-input"
          value={tpl}
          aria-label="Explanation template"
          onChange={e => setTpl(e.target.value)}
        >
          {EXPLANATION_TEMPLATES.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      {applied.sections.map(s => (
        <div key={s.heading}>
          <h4 className="ex36-h4">{s.heading}</h4>
          <p className="ex36-text">{s.body}</p>
        </div>
      ))}
    </Card>
  );
}

// --- 51418 live explanation editing -------------------------------------------------------------------------------------------------------------------------
export function LiveEditorCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(null);
  const base = explainFinding(finding);
  const startEdit = f => {
    setFinding(f);
    setDraft('');
    setSaved(null);
  };
  const save = () => setSaved(editExplanation(base, draft.trim() || base));
  return (
    <Card idea={51418} title="Live explanation editing">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={startEdit} />
      </div>
      <p className="ex36-dim">Agent draft:</p>
      <p className="ex36-text">{base}</p>
      <label className="ex36-dim" htmlFor="ex36-edit">
        Your edit (the agent notes your style):
      </label>
      <textarea
        id="ex36-edit"
        className="ex36-input ex36-area"
        rows={4}
        value={draft}
        aria-label="Edit the explanation"
        onChange={e => setDraft(e.target.value)}
      />
      <div className="ex36-row">
        <button className="ex36-btn" disabled={!draft.trim()} onClick={save}>
          Save edit
        </button>
      </div>
      {saved && (
        <div>
          <p className="ex36-text">
            <strong>Saved version:</strong> {saved.text}
          </p>
          <p className="ex36-dim">
            Learned style — tone: {saved.style.tone}, {saved.style.wordCount} words, avg{' '}
            {saved.style.avgSentenceLen} words/sentence.
          </p>
        </div>
      )}
    </Card>
  );
}

// --- 51419 explanation versioning --------------------------------------------------------------------------------------------------------------------------------
export function VersionCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const [versions, setVersions] = useState(() =>
    addExplanationVersion([], explainFinding(SAMPLE_FINDINGS[0]))
  );
  const [draft, setDraft] = useState('');
  const [view, setView] = useState(1);
  const add = () => {
    if (!draft.trim()) return;
    const next = addExplanationVersion(versions, draft.trim());
    setVersions(next);
    setView(next.length);
    setDraft('');
  };
  const current = getVersion(versions, view);
  const prev = getVersion(versions, view - 1);
  const diff = prev && current ? diffVersions(prev.text, current.text) : null;
  return (
    <Card idea={51419} title="Explanation versioning">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
      </div>
      <div className="ex36-row">
        <input
          className="ex36-input ex36-grow"
          value={draft}
          aria-label="New explanation version"
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') add();
          }}
        />
        <button className="ex36-btn" disabled={!draft.trim()} onClick={add}>
          Add version
        </button>
      </div>
      <div className="ex36-row">
        {versions.map(v => (
          <button
            key={v.v}
            className={`ex36-btn${view === v.v ? ' ex36-btn-active' : ''}`}
            onClick={() => setView(v.v)}
          >
            v{v.v}
          </button>
        ))}
      </div>
      {current && (
        <p className="ex36-text">
          v{current.v}: {current.text}
        </p>
      )}
      {diff && (
        <p className="ex36-dim">
          v{view - 1} → v{view}: +{diff.addedCount} word(s)
          {diff.added.slice(0, 6).join(', ') ? ` (${diff.added.slice(0, 6).join(', ')})` : ''} · −
          {diff.removedCount} word(s)
          {diff.removed.slice(0, 6).join(', ') ? ` (${diff.removed.slice(0, 6).join(', ')})` : ''}
        </p>
      )}
    </Card>
  );
}

// --- 51420 contrasting opinions ------------------------------------------------------------------------------------------------------------------------------------------
export function OpinionsCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[2]);
  return (
    <Card idea={51420} title="Contrasting opinions">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
      </div>
      {contrastingOpinions(finding).map(o => (
        <div key={o.stance} className="ex36-opinion">
          <p className="ex36-line">
            <strong>{o.stance}</strong>
          </p>
          <p className="ex36-text">{o.reason}</p>
        </div>
      ))}
    </Card>
  );
}

// --- 51421 severity justification ---------------------------------------------------------------------------------------------------------------------------------------------
export function SeverityJustCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[3]);
  const j = severityJustification(finding);
  return (
    <Card idea={51421} title="Severity justification">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
      </div>
      <p className="ex36-text">
        <strong>{j.summary}</strong>
      </p>
      <ul className="ex36-list">
        {j.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </Card>
  );
}

// --- 51422 attack-scenario narration ---------------------------------------------------------------------------------------------------------------------------------------------
export function ScenarioCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const [revealed, setRevealed] = useState(1);
  const sc = attackScenario(finding);
  const pick = f => {
    setFinding(f);
    setRevealed(1);
  };
  return (
    <Card idea={51422} title="Attack-scenario narration">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={pick} />
      </div>
      <p className="ex36-line">
        <strong>{sc.title}</strong>
      </p>
      {sc.beats.slice(0, revealed).map(b => (
        <p key={b.n} className="ex36-text">
          <strong>
            {b.n}. {b.title}:
          </strong>{' '}
          {b.detail}
        </p>
      ))}
      <div className="ex36-row">
        {revealed < sc.beats.length ? (
          <button className="ex36-btn" onClick={() => setRevealed(revealed + 1)}>
            Reveal next beat
          </button>
        ) : (
          <button className="ex36-btn" onClick={() => setRevealed(1)}>
            Replay
          </button>
        )}
        <span className="ex36-dim">
          {revealed} of {sc.beats.length}
        </span>
      </div>
    </Card>
  );
}

// --- 51423 business-process mapping ---------------------------------------------------------------------------------------------------------------------------------------------------
export function ProcessMapCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const [business, setBusiness] = useState('ecommerce');
  const rows = mapToProcess(finding, business);
  return (
    <Card idea={51423} title="Business-process mapping">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
        <select
          className="ex36-input"
          value={business}
          aria-label="Business type"
          onChange={e => setBusiness(e.target.value)}
        >
          {['ecommerce', 'saas', 'fintech', 'healthcare'].map(b => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
      <ul className="ex36-list">
        {rows.map(r => (
          <li key={r.process}>
            <span className={r.threatened ? 'ex36-threat' : 'ex36-dim'}>
              {r.threatened ? '● threatened' : '○ clear'}
            </span>{' '}
            <strong>{r.process}</strong> — {r.why}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// --- 51424 explanation search ----------------------------------------------------------------------------------------------------------------------------------------------------------------
const SEARCH_CORPUS = [
  {
    id: 'expl-1',
    findingId: 'F-201',
    text: 'SQL injection at /api/search?q= lets attackers run database commands.',
  },
  {
    id: 'expl-2',
    findingId: 'F-202',
    text: 'Stored XSS in comments runs attacker script as the victim user.',
  },
  {
    id: 'expl-3',
    findingId: 'F-203',
    text: 'IDOR on the order endpoint exposes other customers orders by swapping IDs.',
  },
  {
    id: 'expl-4',
    findingId: 'F-204',
    text: 'JWT none algorithm acceptance allows forged admin sessions.',
  },
];

export function SearchCard() {
  const [query, setQuery] = useState('');
  const index = buildExplanationIndex(SEARCH_CORPUS);
  const results = searchExplanations(index, query);
  return (
    <Card idea={51424} title="Explanation search">
      <div className="ex36-row">
        <input
          className="ex36-input ex36-grow"
          value={query}
          aria-label="Search past explanations"
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      {query.trim() && results.length === 0 && (
        <p className="ex36-dim">No past explanations match.</p>
      )}
      <ul className="ex36-list">
        {results.map(r => (
          <li key={r.id}>
            <strong>{r.findingId}</strong> (score {r.score}): {r.text}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// --- 51425 explanation export -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function ExportCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const [kind, setKind] = useState('slides');
  const md = kind === 'slides' ? exportSlidesMarkdown(finding) : exportOnePagerMarkdown(finding);
  const file = `${finding.id}-${kind === 'slides' ? 'slides' : 'one-pager'}.md`;
  return (
    <Card idea={51425} title="Explanation export">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
        <button
          className={`ex36-btn${kind === 'slides' ? ' ex36-btn-active' : ''}`}
          onClick={() => setKind('slides')}
        >
          Slides
        </button>
        <button
          className={`ex36-btn${kind === 'one-pager' ? ' ex36-btn-active' : ''}`}
          onClick={() => setKind('one-pager')}
        >
          One-pager
        </button>
        <button className="ex36-btn" onClick={() => downloadFile(file, md)}>
          Download {file}
        </button>
      </div>
      <pre className="ex36-pre">{md}</pre>
    </Card>
  );
}

// --- 51426 regulatory framing -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function RegulatoryCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[3]);
  const [reg, setReg] = useState('gdpr');
  return (
    <Card idea={51426} title="Regulatory framing">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
        <select
          className="ex36-input"
          value={reg}
          aria-label="Regulation"
          onChange={e => setReg(e.target.value)}
        >
          {REGULATIONS.map(r => (
            <option key={r} value={r}>
              {r.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
      <p className="ex36-text">{regulatoryFraming(finding, reg)}</p>
    </Card>
  );
}

// --- 51427 cost-of-breach framing -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function CostCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const c = costOfBreach(finding);
  return (
    <Card idea={51427} title="Cost-of-breach framing">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
      </div>
      <table className="ex36-table">
        <thead>
          <tr>
            <th>Scenario</th>
            <th>Estimated cost (USD)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Contained quickly</td>
            <td>${c.low.toLocaleString('en-US')}</td>
          </tr>
          <tr>
            <td>Typical incident</td>
            <td>${c.mid.toLocaleString('en-US')}</td>
          </tr>
          <tr>
            <td>Worst case</td>
            <td>${c.high.toLocaleString('en-US')}</td>
          </tr>
        </tbody>
      </table>
      <p className="ex36-text">{costSentence(finding)}</p>
      <p className="ex36-dim">{c.basis}</p>
    </Card>
  );
}

// --- 51428 timeline explanations ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function TimelineCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const tl = weaknessTimeline(finding);
  return (
    <Card idea={51428} title="Timeline explanations">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
      </div>
      <div className="ex36-timeline">
        {tl.events.map(e => (
          <div key={e.label} className="ex36-tl-row">
            <span className="ex36-tl-label">{e.label}</span>
            <span className="ex36-text">{e.detail}</span>
          </div>
        ))}
      </div>
      <p className="ex36-text">
        <strong>{tl.sentence}</strong>
      </p>
    </Card>
  );
}

// --- 51429 peer-benchmark context ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function BenchmarkCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[1]);
  const b = peerBenchmark(finding);
  return (
    <Card idea={51429} title="Peer-benchmark context">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
      </div>
      <Meter
        value={Math.min(100, Math.round((b.typicalFixDays / 60) * 100))}
        label={`${b.typicalFixDays} days typical (scale 0–60)`}
      />
      <p className="ex36-text">{b.note}</p>
    </Card>
  );
}

// --- 51430 explanation feedback loop ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function FeedbackCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const [ratings, setRatings] = useState([]);
  const [score, setScore] = useState(4);
  const [note, setNote] = useState('');
  const submit = () => {
    setRatings(recordFeedback(ratings, { explanationId: finding.id, score, note: note.trim() }));
    setNote('');
  };
  const s = feedbackSummary(ratings);
  return (
    <Card idea={51430} title="Explanation feedback loop">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
      </div>
      <p className="ex36-text">{explainFinding(finding)}</p>
      <div className="ex36-row" role="radiogroup" aria-label="Rate this explanation">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            className={`ex36-star${score >= n ? ' ex36-star-on' : ''}`}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => setScore(n)}
          >
            ★
          </button>
        ))}
        <input
          className="ex36-input ex36-grow"
          value={note}
          aria-label="Feedback note (optional)"
          onChange={e => setNote(e.target.value)}
        />
        <button className="ex36-btn" onClick={submit}>
          Submit rating
        </button>
      </div>
      {s.count > 0 && (
        <p className="ex36-dim">
          {s.count} rating(s), average {s.avg}/5 — distribution:{' '}
          {s.distribution.map(d => `${d.score}★×${d.count}`).join(' ')}
        </p>
      )}
    </Card>
  );
}

// --- 51431 multi-finding narratives ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function MultiNarrativeCard() {
  const [selected, setSelected] = useState(['F-201', 'F-203']);
  const toggle = id =>
    setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  const narrative = multiFindingNarrative(SAMPLE_FINDINGS.filter(f => selected.includes(f.id)));
  return (
    <Card idea={51431} title="Multi-finding narratives">
      <div className="ex36-row">
        {SAMPLE_FINDINGS.map(f => (
          <label key={f.id} className="ex36-check">
            <input
              type="checkbox"
              checked={selected.includes(f.id)}
              onChange={() => toggle(f.id)}
            />{' '}
            {f.id}
          </label>
        ))}
      </div>
      <h4 className="ex36-h4">{narrative.title}</h4>
      {narrative.paragraphs.map((p, i) => (
        <p key={i} className="ex36-text">
          {p}
        </p>
      ))}
    </Card>
  );
}

// --- 51432 explanation chat threads ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function ChatThreadCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const [thread, setThread] = useState(() =>
    postThreadMessage([], 'Infinity AI', 'Ask me anything about this explanation.')
  );
  const [draft, setDraft] = useState('');
  const send = () => {
    if (!draft.trim()) return;
    const withUser = postThreadMessage(thread, 'You', draft.trim());
    setThread([...withUser, threadReply(finding, draft.trim())]);
    setDraft('');
  };
  return (
    <Card idea={51432} title="Explanation chat threads">
      <div className="ex36-row">
        <FindingPicker
          value={finding}
          onChange={f => {
            setFinding(f);
            setThread(
              postThreadMessage([], 'Infinity AI', 'Ask me anything about this explanation.')
            );
          }}
        />
      </div>
      <div className="ex36-thread" aria-label="Explanation discussion thread">
        {thread.map(m => (
          <div key={m.id} className={`ex36-msg ex36-msg-${m.author === 'You' ? 'you' : 'ai'}`}>
            <span className="ex36-msg-author">{m.author}</span>
            <p className="ex36-text">{m.text}</p>
          </div>
        ))}
      </div>
      <div className="ex36-row">
        <input
          className="ex36-input ex36-grow"
          value={draft}
          aria-label="Message the agent"
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') send();
          }}
        />
        <button className="ex36-btn" disabled={!draft.trim()} onClick={send}>
          Send
        </button>
      </div>
    </Card>
  );
}

// --- 51433 visual severity scales --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function SeverityGaugeCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[3]);
  const g = severityGauge(finding.severity);
  return (
    <Card idea={51433} title="Visual severity scales">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
      </div>
      <Meter value={g.value} label={`${finding.severity} — ${g.label} (${gaugeLabel(g.value)})`} />
      <p className="ex36-dim">
        0–100 risk scale: {finding.title} sits at {g.value}.
      </p>
    </Card>
  );
}

// --- 51434 remediation difficulty meter ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function DifficultyMeterCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[3]);
  const d = difficultyMeter(finding);
  return (
    <Card idea={51434} title="Remediation difficulty meter">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
      </div>
      <Meter value={d.value} label={d.label} />
      <ul className="ex36-list">
        {d.factors.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>
    </Card>
  );
}

// --- 51435 exploitability meter ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function ExploitMeterCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[3]);
  const m = exploitabilityMeter(finding);
  return (
    <Card idea={51435} title="Exploitability meter">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
      </div>
      <Meter value={m.value} label={m.label} />
      <ul className="ex36-list">
        {m.factors.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>
    </Card>
  );
}

// --- 51436 white-labeled client explanations -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function WhiteLabelCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[1]);
  const [client, setClient] = useState('Acme Corp');
  const raw = [
    `INTERNAL: hunt run H-88, operator notes attached.`,
    `${finding.title || finding.id} — flagged by Infinity AI during the Dark-Matter assessment.`,
  ].join('\n');
  return (
    <Card idea={51436} title="White-labeled client explanations">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
        <input
          className="ex36-input"
          value={client}
          aria-label="Client name"
          onChange={e => setClient(e.target.value)}
        />
      </div>
      <p className="ex36-dim">Internal draft (never sent):</p>
      <pre className="ex36-pre">{raw}</pre>
      <p className="ex36-dim">Client-ready version — branding replaced, internal lines stripped:</p>
      <p className="ex36-text">
        {whiteLabelFinding(
          {
            ...finding,
            title: `${finding.title} — flagged by Infinity AI during the Dark-Matter assessment`,
          },
          client || 'your security team'
        )}
      </p>
    </Card>
  );
}

// --- 51437 glossary auto-linking --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function AutoLinkCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const [active, setActive] = useState(null);
  const segments = autoLinkGlossary(explainFinding(finding));
  return (
    <Card idea={51437} title="Glossary auto-linking">
      <div className="ex36-row">
        <FindingPicker
          value={finding}
          onChange={f => {
            setFinding(f);
            setActive(null);
          }}
        />
      </div>
      <p className="ex36-text">
        {segments.map((s, i) =>
          s.term ? (
            <button
              key={i}
              className={`ex36-gloss${active === i ? ' ex36-gloss-active' : ''}`}
              onClick={() => setActive(active === i ? null : i)}
            >
              {s.text}
            </button>
          ) : (
            <span key={i}>{s.text}</span>
          )
        )}
      </p>
      {active !== null && segments[active] && segments[active].term && (
        <p className="ex36-text ex36-def">
          <strong>{segments[active].term}:</strong> {segments[active].definition}
        </p>
      )}
    </Card>
  );
}

// --- 51438 story-mode report section -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function StoryModeCard() {
  const [selected, setSelected] = useState(['F-201', 'F-202']);
  const toggle = id =>
    setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  const md = storyModeSection(SAMPLE_FINDINGS.filter(f => selected.includes(f.id)));
  return (
    <Card idea={51438} title="Story-mode report section">
      <div className="ex36-row">
        {SAMPLE_FINDINGS.slice(0, 3).map(f => (
          <label key={f.id} className="ex36-check">
            <input
              type="checkbox"
              checked={selected.includes(f.id)}
              onChange={() => toggle(f.id)}
            />{' '}
            {f.id}
          </label>
        ))}
      </div>
      <pre className="ex36-pre">{md}</pre>
    </Card>
  );
}

// --- 51439 explanation personalization --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function PersonalizeCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[1]);
  const [years, setYears] = useState(1);
  const [seen, setSeen] = useState(2);
  const profile = { yearsExperience: years, priorFindingsSeen: seen };
  const est = estimateKnowledge(profile);
  return (
    <Card idea={51439} title="Explanation personalization">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
      </div>
      <div className="ex36-row">
        <label className="ex36-check">
          Years experience
          <input
            className="ex36-input ex36-num"
            type="number"
            min="0"
            max="40"
            value={years}
            aria-label="Years of experience"
            onChange={e => setYears(Number(e.target.value))}
          />
        </label>
        <label className="ex36-check">
          Findings reviewed before
          <input
            className="ex36-input ex36-num"
            type="number"
            min="0"
            max="500"
            value={seen}
            aria-label="Prior findings reviewed"
            onChange={e => setSeen(Number(e.target.value))}
          />
        </label>
      </div>
      <p className="ex36-dim">{est.detail}</p>
      <p className="ex36-text">{personalizedExplanation(finding, profile)}</p>
    </Card>
  );
}

// --- 51440 myth-busting notes ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function MythBustingCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  return (
    <Card idea={51440} title="Myth-busting notes">
      <div className="ex36-row">
        <FindingPicker value={finding} onChange={setFinding} />
      </div>
      {mythBusting(finding).map((m, i) => (
        <div key={i} className="ex36-myth">
          <p className="ex36-line">
            <span className="ex36-myth-tag">Myth</span> {m.myth}
          </p>
          <p className="ex36-text">
            <span className="ex36-truth-tag">Reality</span> {m.truth}
          </p>
        </div>
      ))}
    </Card>
  );
}

// --- gallery (export only — not mounted in app UI) ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const ALL = [
  [DepthSliderCard, 51401],
  [JargonBusterCard, 51402],
  [ExploitWalkthroughCard, 51403],
  [FollowUpCard, 51404],
  [LanguageCard, 51405],
  [RoleCard, 51406],
  [ConfidenceCard, 51407],
  [EvidenceLinksCard, 51408],
  [ComparisonCard, 51409],
  [RiskContextCard, 51410],
  [FixEndingCard, 51411],
  [HistoryCard, 51412],
  [ShareCardComp, 51413],
  [VoiceCard, 51414],
  [QuizCard, 51415],
  [KidModeCard, 51416],
  [TemplateCard, 51417],
  [LiveEditorCard, 51418],
  [VersionCard, 51419],
  [OpinionsCard, 51420],
  [SeverityJustCard, 51421],
  [ScenarioCard, 51422],
  [ProcessMapCard, 51423],
  [SearchCard, 51424],
  [ExportCard, 51425],
  [RegulatoryCard, 51426],
  [CostCard, 51427],
  [TimelineCard, 51428],
  [BenchmarkCard, 51429],
  [FeedbackCard, 51430],
  [MultiNarrativeCard, 51431],
  [ChatThreadCard, 51432],
  [SeverityGaugeCard, 51433],
  [DifficultyMeterCard, 51434],
  [ExploitMeterCard, 51435],
  [WhiteLabelCard, 51436],
  [AutoLinkCard, 51437],
  [StoryModeCard, 51438],
  [PersonalizeCard, 51439],
  [MythBustingCard, 51440],
];

export function Wave36Gallery() {
  return (
    <div className="ex36-gallery" aria-label="Explainability round 2 gallery">
      {ALL.map(([C, id]) => (
        <C key={id} />
      ))}
    </div>
  );
}
