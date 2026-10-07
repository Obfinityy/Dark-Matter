/**
 * FindingShare.jsx — wave 40 (ideas 51561–51580): finding sharing +
 * proactive steering prompts (part 1).
 * Real working components driving local state — no canned-only controls.
 * All logic comes from findingShareCore.js.
 * The FindingShareGallery is exported for review only; it is not
 * mounted in app UI.
 */
import React, { useState } from 'react';
import {
  watermarkText, watermarkStyle, embedWatermark,
  TICKET_SYSTEMS, ticketPayload, ticketRef, linkTicket, findingMarkdown,
  CHAT_CHANNELS, shouldAutoPost, chatMessage,
  retrospectivePrompts, retrospectiveSummary,
  digDeeperPrompt, digDeeperPlan, answerPrompt,
  scopeScore, scopeSuggestion,
  techniqueProposal,
  priorityCheckin,
  ambiguityPrompt,
  riskConfirmation,
  triageQuestion,
  pivotProposal,
  resourceCheckin,
  timeCheckin,
  credentialRequest,
  KNOWN_ENVIRONMENTS, contextQuestion,
  businessContextQuestion,
  fpCheckQuestion,
  exploitDepthQuestion,
  reportScopeQuestion,
} from './findingShareCore.js';

function Card({ n, title, children }) {
  return (
    <div className="fs40-card" data-idea={n}>
      <div className="fs40-card-head"><span className="fs40-num">{n}</span><h4>{title}</h4></div>
      <div className="fs40-card-body">{children}</div>
    </div>
  );
}

function PromptCard({ n, title, prompt }) {
  const [p, setP] = useState(prompt);
  return (
    <Card n={n} title={title}>
      <div className="fs40-prompt-title">{p.title}</div>
      <div className="fs40-prompt-body">{p.body}</div>
      <div className="fs40-opts">
        {p.options.map(o => (
          <button key={o.key} className={'fs40-opt' + (p.answerKey === o.key ? ' fs40-opt-picked' : '')}
            onClick={() => setP(answerPrompt(p, o.key))} title={o.hint || ''}>{o.label}</button>
        ))}
      </div>
      <div className="fs40-meta">status: {p.status}{p.answerKey ? ' → ' + p.answerKey : ''} · urgency: {p.urgency}</div>
    </Card>
  );
}

const SAMPLE_FINDING = {
  id: 'F-101', title: 'Stored XSS in support chat', type: 'xss', severity: 'high',
  confidence: 87, asset: 'app.example.com/support', evidenceSummary: 'Payload executed in agent view.',
};

export function WatermarkBadge() {
  const [viewer, setViewer] = useState('priya');
  const st = watermarkStyle(viewer);
  return (
    <Card n={51561} title="Finding watermark">
      <input className="fs40-input" value={viewer} onChange={e => setViewer(e.target.value)} />
      <div className="fs40-wm-preview" style={{ opacity: st.opacity, fontSize: Math.min(28, st.fontSizePx / 2) + 'px' }}>
        {watermarkText(viewer, 'F-101')}
      </div>
      <div className="fs40-meta">rotation {st.rotationDeg}° · opacity {st.opacity.toFixed(2)}</div>
    </Card>
  );
}

export function TicketCreateCard() {
  const [system, setSystem] = useState('jira');
  const payload = ticketPayload(SAMPLE_FINDING, system, { projectKey: 'SEC', teamId: 'T-9' });
  const [linked, setLinked] = useState(null);
  return (
    <Card n={51562} title="Finding to ticket">
      <div className="fs40-row">
        {TICKET_SYSTEMS.map(s => (
          <button key={s} className={'fs40-opt' + (system === s ? ' fs40-opt-picked' : '')}
            onClick={() => setSystem(s)}>{s}</button>
        ))}
      </div>
      <pre className="fs40-pre">{JSON.stringify(payload, null, 1).slice(0, 520)}…</pre>
      <div className="fs40-meta">ref: {ticketRef(SAMPLE_FINDING, system)}</div>
      <button className="fs40-opt" onClick={() => setLinked(linkTicket(SAMPLE_FINDING.id, { system, ref: ticketRef(SAMPLE_FINDING, system) }, 0))}>
        Create + link ticket
      </button>
      {linked && <div className="fs40-meta">linked → {linked.ref}</div>}
    </Card>
  );
}

export function ChatPostPreview() {
  const [channel, setChannel] = useState('slack');
  const [minSev, setMinSev] = useState('critical');
  const msg = chatMessage(SAMPLE_FINDING, channel, { minSeverity: minSev });
  return (
    <Card n={51563} title="Finding chat integration">
      <div className="fs40-row">
        {CHAT_CHANNELS.map(c => (
          <button key={c} className={'fs40-opt' + (channel === c ? ' fs40-opt-picked' : '')}
            onClick={() => setChannel(c)}>{c}</button>
        ))}
        <select className="fs40-input" value={minSev} onChange={e => setMinSev(e.target.value)}>
          {['info', 'low', 'medium', 'high', 'critical'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="fs40-chat">{msg.text}</div>
      <div className="fs40-meta">{msg.room} · auto-post: {msg.autoPost ? 'yes' : 'no (below threshold)'}</div>
    </Card>
  );
}

export function RetroPromptCard() {
  const prompts = retrospectivePrompts({ findings: [SAMPLE_FINDING, { ...SAMPLE_FINDING, id: 'F-102', title: 'Open S3 bucket' }], goal: 'maximum coverage' });
  const [answers, setAnswers] = useState({});
  const sum = retrospectiveSummary(answers);
  return (
    <Card n={51564} title="Finding retrospective prompts">
      {prompts.slice(0, 3).map(pr => (
        <div key={pr.key} className="fs40-retro">
          <div>{pr.question}</div>
          {pr.kind === 'pick' && (
            <div className="fs40-row">{pr.findingIds.map(id => (
              <button key={id} className={'fs40-opt' + (answers[pr.key] === id ? ' fs40-opt-picked' : '')}
                onClick={() => setAnswers(a => ({ ...a, [pr.key]: id }))}>{id}</button>
            ))}</div>
          )}
          {pr.kind === 'text' && <input className="fs40-input" value={answers[pr.key] || ''} onChange={e => setAnswers(a => ({ ...a, [pr.key]: e.target.value }))} />}
        </div>
      ))}
      <div className="fs40-meta">answered {sum.answeredCount} · top: {sum.mostValuableId || '—'}</div>
    </Card>
  );
}

export function FindingShareGallery() {
  const assets = ['api.example.com', 'staging.example.com', '10.0.0.9'];
  return (
    <div className="fs40-gallery">
      <h3>Wave 40 · Finding share + steering prompts (51561–51580)</h3>
      <WatermarkBadge />
      <TicketCreateCard />
      <ChatPostPreview />
      <RetroPromptCard />
      <PromptCard n={51565} title="Dig-deeper prompt" prompt={digDeeperPrompt(SAMPLE_FINDING)} />
      <PromptCard n={51566} title="Scope-expansion suggestion"
        prompt={scopeSuggestion(assets, { source: 'subdomain enum' })} />
      <PromptCard n={51567} title="Technique proposal"
        prompt={techniqueProposal('sqli', 'time-based blind', 'the error messages are suppressed but timing differs')} />
      <PromptCard n={51568} title="Priority check-in"
        prompt={priorityCheckin(SAMPLE_FINDING, { title: 'IDOR in /api/orders', severity: 'high' })} />
      <PromptCard n={51569} title="Ambiguity clarification"
        prompt={ambiguityPrompt('Did "go deeper" mean this finding or the whole module?', ['This finding', 'The whole module'])} />
      <PromptCard n={51570} title="Risk confirmation" prompt={riskConfirmation('active exploit attempt', 8, 7)} />
      <PromptCard n={51571} title="Finding triage question"
        prompt={triageQuestion(SAMPLE_FINDING, { id: 'F-99', seq: 12, title: 'XSS in support chat widget' })} />
      <PromptCard n={51572} title="Strategy pivot proposal"
        prompt={pivotProposal('breadth-first recon', 'depth-first on /support', '3 of 5 findings cluster on /support')} />
      <PromptCard n={51573} title="Resource check-in" prompt={resourceCheckin({ requestsPerMin: 540, budgetPerMin: 600 })} />
      <PromptCard n={51574} title="Time check-in" prompt={timeCheckin(45 * 60000, 60 * 60000)} />
      <PromptCard n={51575} title="Credential request" prompt={credentialRequest('app.example.com', 'IDOR checks need a second user session')} />
      <PromptCard n={51576} title="Context question" prompt={contextQuestion('environment', null)} />
      <PromptCard n={51577} title="Business-context question" prompt={businessContextQuestion(['/checkout', '/support', '/blog'])} />
      <PromptCard n={51578} title="False-positive check" prompt={fpCheckQuestion({ ...SAMPLE_FINDING, confidence: 52 })} />
      <PromptCard n={51579} title="Exploit-depth question" prompt={exploitDepthQuestion(SAMPLE_FINDING)} />
      <PromptCard n={51580} title="Report-scope question"
        prompt={reportScopeQuestion([SAMPLE_FINDING, { ...SAMPLE_FINDING, id: 'F-103', severity: 'low', title: 'Missing CSP header' }, { ...SAMPLE_FINDING, id: 'F-104', severity: 'info', title: 'Verbose banner' }])} />
    </div>
  );
}
