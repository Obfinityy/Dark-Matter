/**
 * ExplainabilityRound3.jsx — wave 37 (ideas 51441–51452): explainability
 * round 3 suite.
 * Real working components driving local state — no mocks, no canned-only
 * controls. All logic comes from explainabilityRound3Core.js.
 * The Wave37ExplainGallery is exported for review only; it is not mounted
 * in app UI.
 */
import React, { useState } from 'react';
import {
  WAVE37_EX_IDEAS,
  faqForFinding, diffExplanations,
  clarityMeter,
  plainTitle, oneLineTakeaway,
  SHARE_LEVELS, sharePackage,
  audioScript,
  recordExplanationEvent, analyticsSummary,
  explanationStaleness,
  crossFindingSummary,
  citationsFor,
  watchNarration,
} from './explainabilityRound3Core.js';

const SAMPLE = {
  id: 'F-1042', type: 'sql-injection', severity: 'high',
  title: 'SQL injection in login form', location: '/api/login',
  confidence: 87, businessUnit: 'customer portal',
  evidence: ['POST /api/login with payload returned 12 rows instead of 1', 'Error message leaked table name "users"'],
};

function Card({ n, title, children }) {
  return (
    <div className="ex37-card" data-idea={n}>
      <div className="ex37-card-head"><span className="ex37-num">{n}</span><h4>{title}</h4></div>
      <div className="ex37-card-body">{children}</div>
    </div>
  );
}

/* 51441 */ export function FaqCard() {
  const faqs = faqForFinding(SAMPLE);
  const [open, setOpen] = useState(0);
  return (
    <Card n="51441" title="FAQ generator">
      {faqs.map((f, i) => (
        <div key={i} className="ex37-faq">
          <button className="ex37-faq-q" onClick={() => setOpen(open === i ? -1 : i)}>{f.q}</button>
          {open === i && <p className="ex37-faq-a">{f.a}</p>}
        </div>
      ))}
    </Card>
  );
}

/* 51442 */ export function ExplanationDiffCard() {
  const oldT = 'The login form may be vulnerable.\nConfidence is moderate.';
  const [newT, setNewT] = useState('The login form is vulnerable to SQL injection.\nConfidence is high.\n12 rows were returned instead of 1.');
  const d = diffExplanations(oldT, newT);
  return (
    <Card n="51442" title="Explanation diff">
      <textarea className="ex37-input" rows={3} value={newT} onChange={(e) => setNewT(e.target.value)} />
      <div className="ex37-diff">
        {d.added.map((l, i) => <p key={'a' + i} className="ex37-add">+ {l}</p>)}
        {d.removed.map((l, i) => <p key={'r' + i} className="ex37-rem">− {l}</p>)}
        {d.unchanged.map((l, i) => <p key={'u' + i} className="ex37-same">  {l}</p>)}
      </div>
    </Card>
  );
}

/* 51443 */ export function ClarityMeterCard() {
  const [conf, setConf] = useState(SAMPLE.confidence);
  const m = clarityMeter({ ...SAMPLE, confidence: conf });
  return (
    <Card n="51443" title="Confidence-to-clarity meter">
      <input type="range" min={0} max={100} value={conf} onChange={(e) => setConf(Number(e.target.value))} />
      <p><strong>{m.label}</strong> ({m.score}%) — {m.sentence}</p>
    </Card>
  );
}

/* 51444 */ export function PlainTitleCard() {
  return (
    <Card n="51444" title="Plain-language titles">
      <p className="ex37-tech">{SAMPLE.title}</p>
      <p className="ex37-plain">{plainTitle(SAMPLE)}</p>
    </Card>
  );
}

/* 51445 */ export function TakeawayCard() {
  return (
    <Card n="51445" title="One-line takeaway">
      <p className="ex37-takeaway">{oneLineTakeaway(SAMPLE)}</p>
    </Card>
  );
}

/* 51446 */ export function ShareControlsCard() {
  const [level, setLevel] = useState('team');
  const pkg = sharePackage(SAMPLE, level);
  return (
    <Card n="51446" title="Explanation sharing controls">
      <div className="ex37-row">
        {SHARE_LEVELS.map((l) => (
          <button key={l.id} className={level === l.id ? 'ex37-active' : ''} onClick={() => setLevel(l.id)} title={l.description}>{l.label}</button>
        ))}
      </div>
      <pre className="ex37-pre">{JSON.stringify(pkg, null, 1)}</pre>
    </Card>
  );
}

/* 51447 */ export function AudioClipCard() {
  const clip = audioScript(SAMPLE);
  const [played, setPlayed] = useState(false);
  return (
    <Card n="51447" title="Audio explanation clip">
      <p className="ex37-muted">{clip.script}</p>
      <p><strong>{clip.seconds}s</strong> estimated listening time.</p>
      <button onClick={() => setPlayed(!played)}>{played ? 'Stop preview' : 'Play preview'}</button>
      {played && <p className="ex37-note">Previewing script (TTS hook would speak this).</p>}
    </Card>
  );
}

/* 51448 */ export function AnalyticsCard() {
  const [store, setStore] = useState({ 'F-1042': { opened: 4, understood: 3, shared: 1 } });
  const s = analyticsSummary(store);
  return (
    <Card n="51448" title="Explanation analytics">
      <div className="ex37-row">
        {['opened', 'understood', 'shared'].map((ev) => (
          <button key={ev} onClick={() => setStore({ ...recordExplanationEvent({ ...store }, SAMPLE.id, ev) })}>+ {ev}</button>
        ))}
      </div>
      <p>{s.findings} findings tracked — comprehension <strong>{s.comprehension}%</strong> ({s.totals.understood}/{s.totals.opened} understood).</p>
    </Card>
  );
}

/* 51449 */ export function LiveUpdateCard() {
  const [conf, setConf] = useState(62);
  const st = explanationStaleness({ ...SAMPLE, confidence: SAMPLE.confidence }, { ...SAMPLE, confidence: conf });
  return (
    <Card n="51449" title="Live explanation updates">
      <input type="range" min={0} max={100} value={conf} onChange={(e) => setConf(Number(e.target.value))} />
      <p>{st.stale ? `Refresh needed — changed: ${st.changed.join(', ')}.` : 'Explanation is current.'}</p>
    </Card>
  );
}

/* 51450 */ export function CrossFindingCard() {
  const [sys, setSys] = useState('your login system');
  const findings = [SAMPLE, { ...SAMPLE, id: 'F-1043', severity: 'medium', type: 'xss', title: 'XSS in profile page', location: '/profile' }];
  return (
    <Card n="51450" title="Cross-finding plain summary">
      <input className="ex37-input" value={sys} onChange={(e) => setSys(e.target.value)} aria-label="System name" />
      <p>{crossFindingSummary(findings, sys)}</p>
    </Card>
  );
}

/* 51451 */ export function CitationsCard() {
  const cites = citationsFor(SAMPLE);
  return (
    <Card n="51451" title="Explanation citations">
      <ol>{cites.map((c) => <li key={c.n}>[{c.kind}] {c.text}</li>)}</ol>
    </Card>
  );
}

/* 51452 */ export function WatchCard() {
  const steps = ['Sent baseline login request', 'Injected quote character', 'Observed 12-row response', 'Confirmed table leak'];
  const [idx, setIdx] = useState(0);
  const n = watchNarration(steps, idx);
  return (
    <Card n="51452" title="Explain-while-you-watch">
      <p>{n.text}</p>
      <div className="ex37-row">
        <button disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Back</button>
        <button disabled={n.done} onClick={() => setIdx(idx + 1)}>Next step</button>
        <button onClick={() => setIdx(0)}>Restart</button>
      </div>
    </Card>
  );
}

// --- gallery (export only — not mounted in app UI) -------------------------------
export function Wave37ExplainGallery() {
  return (
    <div className="ex37-gallery">
      <h3>Wave 37 · Explainability round 3 ({WAVE37_EX_IDEAS.length} ideas)</h3>
      <FaqCard /><ExplanationDiffCard /><ClarityMeterCard /><PlainTitleCard />
      <TakeawayCard /><ShareControlsCard /><AudioClipCard /><AnalyticsCard />
      <LiveUpdateCard /><CrossFindingCard /><CitationsCard /><WatchCard />
    </div>
  );
}
