/**
 * findingShareCore.js — wave 40 (ideas 51561–51580): finding sharing +
 * proactive steering-prompt engine (part 1) for Infinity AI.
 *
 * Pure logic for taking live findings outward (viewer watermark, Jira/Linear
 * ticket creation, team-chat posts, hunt retrospectives) and for the agent's
 * first 16 proactive check-in prompts: dig-deeper, scope expansion, technique
 * proposals, priority check-ins, ambiguity clarification, risk confirmation,
 * triage questions, strategy pivots, resource/time check-ins, credential and
 * context questions, business-context, false-positive, exploit-depth and
 * report-scope questions.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic: no Date.now(), no Math.random(); time is
 * always passed in as an argument.
 */

export const WAVE40_FS_START = 51561;
export const WAVE40_FS_END = 51580;

/** Registry of the 20 sharing + prompt ideas — completeness is testable. */
export const WAVE40_FS_IDEAS = [
  [51561, 'finding watermark', 'Shared finding views carry viewer identity'],
  [51562, 'finding to ticket', 'One-click Jira/Linear ticket creation from live findings'],
  [51563, 'finding chat integration', 'New criticals posted to the team channel automatically'],
  [51564, 'finding retrospective prompts', 'After each hunt, review which findings mattered most'],
  [51565, 'dig-deeper prompts', '"I found X — want me to dig deeper?" asked at the right moment'],
  [51566, 'scope-expansion suggestions', 'The agent proposes newly discovered assets worth adding'],
  [51567, 'technique proposals', '"I noticed Y; should I try Z next?" with one-tap approval'],
  [51568, 'priority check-ins', 'The agent asks which of two leads matters more to you'],
  [51569, 'ambiguity clarifications', 'Proactive questions when steering could mean two things'],
  [51570, 'risk confirmations', 'The agent double-checks before crossing a risk threshold'],
  [51571, 'finding triage questions', '"This looks like a duplicate of #12 — merge them?"'],
  [51572, 'strategy pivot proposals', 'The agent suggests a strategy change with its reasoning'],
  [51573, 'resource check-ins', '"I\'m using a lot of requests; should I slow down?"'],
  [51574, 'time check-ins', '"30 minutes left on the budget — how should I spend it?"'],
  [
    51575,
    'credential requests',
    'The agent asks for login credentials when auth testing would help',
  ],
  [51576, 'context questions', '"Is this staging or production?" asked before risky steps'],
  [51577, 'business-context questions', 'The agent asks what matters most to prioritize impact'],
  [51578, 'false-positive checks', '"This might be a false positive — want me to verify?"'],
  [
    51579,
    'exploit-depth questions',
    '"I\'ve confirmed the issue; should I demonstrate full impact?"',
  ],
  [51580, 'report-scope questions', '"Should low-severity items go in the main report?"'],
];

/* --- shared helpers ---------------------------------------------------------- */

function djb2(str) {
  let h = 5381;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

function clamp(n, lo, hi) {
  const v = Number(n);
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

export function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let promptSeq = 0;

/**
 * Canonical prompt descriptor used by every steering prompt builder below.
 * `options` is a list of { key, label, hint? } the human can tap.
 */
export function newPrompt(kind, title, body, options, urgency) {
  promptSeq += 1;
  return {
    id: 'P-' + String(promptSeq).padStart(4, '0'),
    kind,
    title,
    body,
    options: (options || []).map(o => ({ key: o.key, label: o.label, hint: o.hint || '' })),
    urgency: ['low', 'normal', 'high', 'urgent'].includes(urgency) ? urgency : 'normal',
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
  };
}

export function answerPrompt(prompt, key) {
  const found = (prompt.options || []).find(o => o.key === key);
  if (!found) return { ...prompt };
  return { ...prompt, status: 'answered', answerKey: key };
}

export function snoozePrompt(prompt, untilMs) {
  return { ...prompt, snoozedUntilMs: Math.max(0, Number(untilMs) || 0) };
}

export function promptSummary(prompt) {
  return {
    id: prompt.id,
    kind: prompt.kind,
    title: prompt.title,
    status: prompt.status,
    urgency: prompt.urgency,
    answered: prompt.status === 'answered',
  };
}

/* --- 51561 finding watermark ------------------------------------------------- */

export function watermarkText(viewer, findingId) {
  const who = String(viewer || 'viewer').trim() || 'viewer';
  return 'Infinity AI · ' + who + (findingId ? ' · ' + String(findingId) : '');
}

/** Deterministic watermark placement/style derived from the viewer identity. */
export function watermarkStyle(viewer) {
  const h = djb2(viewer);
  return {
    rotationDeg: -18 + (h % 12), // -18..-7 deg
    opacity: 0.05 + ((h >> 4) % 5) * 0.01, // 0.05..0.09
    fontSizePx: 64 + (h % 24), // 64..87 px
  };
}

export function embedWatermark(html, viewer, findingId) {
  return (
    String(html || '') +
    '<div class="fs40-watermark" data-viewer="' +
    escHtml(viewer) +
    '">' +
    escHtml(watermarkText(viewer, findingId)) +
    '</div>'
  );
}

/* --- 51562 finding to ticket ------------------------------------------------- */

export const TICKET_SYSTEMS = ['jira', 'linear'];

export function jiraPriority(severity) {
  const map = { critical: 'Highest', high: 'High', medium: 'Medium', low: 'Low', info: 'Lowest' };
  return map[String(severity || '').toLowerCase()] || 'Medium';
}

export function linearPriority(severity) {
  const map = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const v = map[String(severity || '').toLowerCase()];
  return v == null ? 2 : v;
}

/** One-click ticket payload for Jira or Linear from a finding. No network calls. */
export function ticketPayload(finding, system, opts) {
  const f = finding || {};
  const sys = String(system || '').toLowerCase();
  const o = opts || {};
  const title =
    '[' +
    String(f.severity || 'medium').toUpperCase() +
    '] ' +
    String(f.title || 'Untitled finding') +
    ' — ' +
    String(f.asset || 'unknown asset');
  const labels = [
    'infinity-ai',
    String(f.type || 'finding'),
    'severity-' + String(f.severity || 'medium').toLowerCase(),
  ];
  if (sys === 'linear') {
    return {
      system: 'linear',
      title,
      description: findingMarkdown(f),
      labels: labels.slice(0, 3),
      priority: linearPriority(f.severity),
      teamId: o.teamId || null,
      projectId: o.projectId || null,
    };
  }
  return {
    system: 'jira',
    title,
    description: findingMarkdown(f),
    labels,
    priority: jiraPriority(f.severity),
    projectKey: o.projectKey || 'SEC',
    issueType: 'Bug',
  };
}

export function findingMarkdown(f) {
  const x = f || {};
  return [
    '## ' + String(x.title || 'Finding'),
    '',
    '- **Severity:** ' + String(x.severity || 'n/a'),
    '- **Type:** ' + String(x.type || 'n/a'),
    '- **Asset:** ' + String(x.asset || 'n/a'),
    '- **Confidence:** ' + String(x.confidence != null ? x.confidence + '%' : 'n/a'),
    '',
    String(x.evidenceSummary || 'Evidence attached in the Infinity AI hunt log.'),
    '',
    '_Reported by Infinity AI_',
  ].join('\n');
}

/** Deterministic external ticket reference for a finding. */
export function ticketRef(finding, system) {
  const sys = String(system || '').toLowerCase() === 'linear' ? 'LIN' : 'SEC';
  return sys + '-' + String((djb2(finding && finding.id ? finding.id + sys : sys) % 90000) + 10000);
}

export function linkTicket(findingId, ticket, linkedAtMs) {
  return {
    findingId: String(findingId || ''),
    system: ticket && ticket.system ? ticket.system : 'jira',
    ref: ticket && ticket.ref ? ticket.ref : ticketRef({ id: findingId }, ticket && ticket.system),
    linkedAtMs: Math.max(0, Number(linkedAtMs) || 0),
  };
}

/* --- 51563 finding chat integration ------------------------------------------ */

export const CHAT_CHANNELS = ['slack', 'teams', 'discord'];

export function shouldAutoPost(finding, prefs) {
  const p = prefs || {};
  if (p.disabled) return false;
  const order = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
  const sev = order[String((finding && finding.severity) || 'info').toLowerCase()] || 0;
  const min = order[String(p.minSeverity || 'critical').toLowerCase()] ?? 4;
  if (sev < min) return false;
  if (p.mutedFindingIds && p.mutedFindingIds.includes(finding && finding.id)) return false;
  return true;
}

export function chatPostText(finding) {
  const f = finding || {};
  return (
    '🚨 *' +
    String(f.severity || 'medium').toUpperCase() +
    '* — ' +
    String(f.title || 'New finding') +
    ' on `' +
    String(f.asset || '?') +
    '` (confidence ' +
    String(f.confidence != null ? f.confidence + '%' : 'n/a') +
    ')'
  );
}

/** Channel message block payload (Slack/Teams/Discord compatible shape). No network. */
export function chatMessage(finding, channel, prefs) {
  const ch = CHAT_CHANNELS.includes(channel) ? channel : 'slack';
  const p = prefs || {};
  return {
    channel: ch,
    room: p.room || (ch === 'discord' ? '#security' : '#security-alerts'),
    text: chatPostText(finding),
    fields: [
      { title: 'Type', value: String((finding || {}).type || 'n/a') },
      { title: 'Asset', value: String((finding || {}).asset || 'n/a') },
      { title: 'Severity', value: String((finding || {}).severity || 'n/a') },
    ],
    autoPost: shouldAutoPost(finding, p),
  };
}

/* --- 51564 finding retrospective prompts ------------------------------------- */

export function retrospectivePrompts(hunt) {
  const h = hunt || {};
  const findings = h.findings || [];
  const prompts = [
    {
      key: 'most-valuable',
      question: 'Which finding mattered most to you?',
      kind: 'pick',
      findingIds: findings.map(f => f.id),
    },
    {
      key: 'false-positives',
      question: 'Were any of these findings false positives?',
      kind: 'multi-pick',
      findingIds: findings.map(f => f.id),
    },
    { key: 'missed', question: 'Did the hunt miss anything you expected to find?', kind: 'text' },
    {
      key: 'depth',
      question: 'Should the next hunt go deeper on any technique?',
      kind: 'pick',
      options: ['recon', 'injection', 'auth', 'logic', 'none'],
    },
  ];
  if (h.goal)
    prompts.push({
      key: 'goal',
      question: 'Did this hunt serve the goal "' + String(h.goal) + '"?',
      kind: 'yes-no',
    });
  return prompts;
}

export function retrospectiveSummary(answers) {
  const a = answers || {};
  const answered = Object.keys(a).filter(k => a[k] != null && a[k] !== '');
  return {
    answeredCount: answered.length,
    mostValuableId: a['most-valuable'] || null,
    flaggedFpIds: Array.isArray(a['false-positives']) ? a['false-positives'] : [],
    missedNote: a['missed'] || '',
    nextDepth: a['depth'] || 'none',
  };
}

/* --- 51565 dig-deeper prompts ------------------------------------------------ */

export function digDeeperPrompt(finding) {
  const f = finding || {};
  return newPrompt(
    'dig-deeper',
    'Dig deeper into this finding?',
    'Found "' +
      String(f.title || 'a finding') +
      '" on ' +
      String(f.asset || 'the target') +
      ' (confidence ' +
      String(f.confidence != null ? f.confidence + '%' : 'n/a') +
      '). I can chase it further — check exploitability, affected endpoints, and blast radius.',
    [
      { key: 'dig', label: 'Dig deeper', hint: 'follow-up tests on this finding' },
      { key: 'hold', label: 'Keep hunting', hint: 'leave it for triage' },
    ],
    String(f.severity || '').toLowerCase() === 'critical' ? 'urgent' : 'high'
  );
}

export function digDeeperPlan(finding) {
  const f = finding || {};
  return [
    'Re-verify the finding on ' + String(f.asset || 'the asset') + ' with a second technique',
    'Enumerate affected endpoints sharing the ' + String(f.type || 'finding') + ' pattern',
    'Estimate blast radius and draft an impact note',
  ];
}

/* --- 51566 scope-expansion suggestions --------------------------------------- */

export function scopeScore(asset) {
  const a = String(asset || '');
  let score = 10;
  if (/admin|internal|staging|dev|api/i.test(a)) score += 25;
  if (/\.(corp|internal|local)$/i.test(a) || a.includes('10.') || a.includes('192.168.'))
    score += 15;
  score += djb2(a) % 10;
  return clamp(score, 0, 100);
}

export function scopeSuggestion(newAssets, opts) {
  const o = opts || {};
  const ranked = (newAssets || [])
    .map(a => ({ asset: String(a), score: scopeScore(a) }))
    .sort((x, y) => y.score - x.score);
  return newPrompt(
    'scope-expansion',
    'Add newly discovered assets to scope?',
    'I discovered ' +
      ranked.length +
      ' asset' +
      (ranked.length === 1 ? '' : 's') +
      ' during recon' +
      (o.source ? ' (' + String(o.source) + ')' : '') +
      '. Top candidate: ' +
      (ranked[0] ? ranked[0].asset + ' (score ' + ranked[0].score + ')' : 'none') +
      '.',
    [
      { key: 'add-all', label: 'Add all in scope', hint: ranked.length + ' assets' },
      { key: 'add-top', label: 'Add top pick only', hint: ranked[0] ? ranked[0].asset : 'none' },
      { key: 'ignore', label: 'Stay in scope', hint: 'do not expand' },
    ],
    'normal'
  );
}

/* --- 51567 technique proposals ----------------------------------------------- */

export function techniqueProposal(currentTechnique, suggested, reason) {
  return newPrompt(
    'technique-proposal',
    'Try ' + String(suggested || 'another technique') + ' next?',
    'I noticed ' +
      String(
        reason ||
          'something interesting while running ' +
            String(currentTechnique || 'the current technique')
      ) +
      '. Should I switch to ' +
      String(suggested || 'a different technique') +
      '?',
    [
      { key: 'try', label: 'Try it', hint: 'one-tap approval' },
      { key: 'later', label: 'Queue for later' },
      { key: 'no', label: 'Stay the course' },
    ],
    'normal'
  );
}

/* --- 51568 priority check-ins ------------------------------------------------ */

export function priorityCheckin(leadA, leadB) {
  const a = leadA || {},
    b = leadB || {};
  return newPrompt(
    'priority-checkin',
    'Which lead matters more to you?',
    'Two leads are competing for attention: (1) ' +
      String(a.title || 'lead A') +
      ' [' +
      String(a.severity || '?') +
      '] vs (2) ' +
      String(b.title || 'lead B') +
      ' [' +
      String(b.severity || '?') +
      '].',
    [
      { key: 'a', label: String(a.title || 'Lead A').slice(0, 48) },
      { key: 'b', label: String(b.title || 'Lead B').slice(0, 48) },
      { key: 'both', label: 'Both, in parallel' },
    ],
    'high'
  );
}

/* --- 51569 ambiguity clarifications ------------------------------------------ */

export function ambiguityPrompt(question, interpretations) {
  const list = (interpretations || []).map((t, i) => ({
    key: 'opt' + (i + 1),
    label: String(t).slice(0, 64),
  }));
  return newPrompt(
    'ambiguity',
    'Quick clarification',
    String(question || 'Your steering could mean two things — which did you mean?'),
    list.length ? list : [{ key: 'either', label: 'Either is fine' }],
    'high'
  );
}

/* --- 51570 risk confirmations ------------------------------------------------ */

export function riskConfirmation(action, riskScore, threshold) {
  const r = clamp(riskScore, 0, 10);
  const t = clamp(threshold == null ? 7 : threshold, 0, 10);
  const needs = r >= t;
  return {
    ...newPrompt(
      'risk-confirmation',
      needs ? 'Confirm before crossing the risk threshold' : 'Risk note',
      '"' +
        String(action || 'this action') +
        '" scores ' +
        r +
        '/10 risk against your threshold of ' +
        t +
        '.',
      [
        { key: 'proceed', label: 'Proceed anyway' },
        { key: 'safer', label: 'Use the safer variant' },
        { key: 'skip', label: 'Skip it' },
      ],
      needs ? 'urgent' : 'low'
    ),
    needsConfirmation: needs,
    riskScore: r,
    threshold: t,
  };
}

/* --- 51571 finding triage questions ------------------------------------------ */

export function triageQuestion(finding, candidateDup) {
  const f = finding || {},
    d = candidateDup || {};
  return newPrompt(
    'triage-question',
    'Merge these as duplicates?',
    'This looks like a duplicate of #' +
      String(d.seq != null ? d.seq : d.id || '?') +
      ' ("' +
      String(d.title || 'another finding') +
      '"). Merge "' +
      String(f.title || 'this finding') +
      '" into it?',
    [
      { key: 'merge', label: 'Merge them' },
      { key: 'keep', label: 'Keep separate' },
    ],
    'normal'
  );
}

/* --- 51572 strategy pivot proposals ------------------------------------------ */

export function pivotProposal(current, proposed, reasoning) {
  return newPrompt(
    'strategy-pivot',
    'Pivot the hunt strategy?',
    'Current: ' +
      String(current || 'default') +
      '. Proposed: ' +
      String(proposed || 'alternative') +
      '. Reasoning: ' +
      String(reasoning || 'early results suggest a better fit') +
      '.',
    [
      { key: 'pivot', label: 'Pivot now' },
      { key: 'finish', label: 'Finish current first' },
      { key: 'no', label: 'No pivot' },
    ],
    'high'
  );
}

/* --- 51573 resource check-ins ------------------------------------------------ */

export function resourceCheckin(usage) {
  const u = usage || {};
  const rpm = Number(u.requestsPerMin) || 0;
  const budget = Number(u.budgetPerMin) || 600;
  const pct = budget > 0 ? Math.round((rpm / budget) * 100) : 0;
  return {
    ...newPrompt(
      'resource-checkin',
      "I'm using a lot of requests — slow down?",
      'Currently ' + rpm + ' requests/min against a ' + budget + '/min budget (' + pct + '%).',
      [
        { key: 'slow', label: 'Slow down' },
        { key: 'keep', label: 'Keep pace' },
        { key: 'burst', label: 'Burst through' },
      ],
      pct >= 90 ? 'high' : 'normal'
    ),
    requestsPerMin: rpm,
    budgetPerMin: budget,
    pctUsed: pct,
  };
}

/* --- 51574 time check-ins ---------------------------------------------------- */

export function timeCheckin(elapsedMs, budgetMs) {
  const e = Math.max(0, Number(elapsedMs) || 0);
  const b = Math.max(1, Number(budgetMs) || 1);
  const remaining = Math.max(0, b - e);
  const pct = Math.min(100, Math.round((e / b) * 100));
  return {
    ...newPrompt(
      'time-checkin',
      'How should I spend the remaining budget?',
      Math.round(remaining / 60000) +
        ' minutes left of a ' +
        Math.round(b / 60000) +
        '-minute budget (' +
        pct +
        '% used).',
      [
        { key: 'depth', label: 'Go deeper on findings' },
        { key: 'breadth', label: 'Chase more coverage' },
        { key: 'report', label: 'Wrap up + report' },
      ],
      pct >= 75 ? 'high' : 'normal'
    ),
    remainingMs: remaining,
    pctUsed: pct,
  };
}

/* --- 51575 credential requests ----------------------------------------------- */

export function credentialRequest(scope, reason) {
  return newPrompt(
    'credential-request',
    'Credentials would help here',
    'Authenticated testing of ' +
      String(scope || 'the target') +
      ' would help: ' +
      String(reason || 'several checks need a logged-in session') +
      '. Share credentials and I will use them only for this hunt (never stored in logs).',
    [
      { key: 'provide', label: 'I will provide' },
      { key: 'later', label: 'Ask me later' },
      { key: 'no', label: 'Stay unauthenticated' },
    ],
    'normal'
  );
}

/* --- 51576 context questions ------------------------------------------------- */

export const KNOWN_ENVIRONMENTS = ['production', 'staging', 'development', 'unknown'];

export function contextQuestion(field, known) {
  const f = String(field || 'environment');
  const options =
    f === 'environment'
      ? KNOWN_ENVIRONMENTS.map(e => ({ key: e, label: e[0].toUpperCase() + e.slice(1) }))
      : [
          { key: 'yes', label: 'Yes' },
          { key: 'no', label: 'No' },
        ];
  return newPrompt(
    'context-question',
    'Quick context check',
    'Is this ' +
      f +
      ' ' +
      String(known || 'staging or production') +
      '? I ask before any step that could disturb the target.',
    options,
    'high'
  );
}

/* --- 51577 business-context questions ---------------------------------------- */

export function businessContextQuestion(assets) {
  const list = (assets || []).slice(0, 4).map(a => ({ key: String(a), label: String(a) }));
  return newPrompt(
    'business-context',
    'What matters most to the business?',
    'To prioritize impact, tell me which of these assets matters most to the business.',
    list.length
      ? list.concat([{ key: 'all-equal', label: 'All equal' }])
      : [{ key: 'all-equal', label: 'All equal' }],
    'normal'
  );
}

/* --- 51578 false-positive checks --------------------------------------------- */

export function fpCheckQuestion(finding) {
  const f = finding || {};
  return newPrompt(
    'false-positive-check',
    'This might be a false positive — verify?',
    '"' +
      String(f.title || 'A finding') +
      '" looks suspicious but could be a false positive ' +
      '(confidence ' +
      String(f.confidence != null ? f.confidence + '%' : 'n/a') +
      '). Want me to verify it?',
    [
      { key: 'verify', label: 'Verify it' },
      { key: 'dismiss', label: 'Mark false positive' },
      { key: 'keep', label: 'Keep as-is' },
    ],
    'normal'
  );
}

/* --- 51579 exploit-depth questions ------------------------------------------- */

export function exploitDepthQuestion(finding) {
  const f = finding || {};
  return newPrompt(
    'exploit-depth',
    'Demonstrate full impact?',
    'I have confirmed "' +
      String(f.title || 'the issue') +
      '". Should I demonstrate full impact with a safe proof-of-concept?',
    [
      { key: 'full', label: 'Demonstrate impact' },
      { key: 'confirm', label: 'Confirmation is enough' },
    ],
    'high'
  );
}

/* --- 51580 report-scope questions -------------------------------------------- */

export function reportScopeQuestion(findings) {
  const list = findings || [];
  const order = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  const lowCount = list.filter(
    f => (order[String(f.severity || '').toLowerCase()] ?? 0) <= 1
  ).length;
  return newPrompt(
    'report-scope',
    'Should low-severity items go in the main report?',
    'There ' +
      (lowCount === 1 ? 'is 1' : 'are ' + lowCount) +
      ' low/info-severity item' +
      (lowCount === 1 ? '' : 's') +
      ' out of ' +
      list.length +
      ' findings.',
    [
      { key: 'include', label: 'Include everything' },
      { key: 'appendix', label: 'Appendix only' },
      { key: 'exclude', label: 'Exclude lows' },
    ],
    'normal'
  );
}
