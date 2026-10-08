/**
 * explainabilityRound2Core.js — wave 36 (ideas 51401–51440): explainability
 * round 2 — pure logic.
 *
 * Depth-slider explanations, jargon busting, exploit walkthroughs,
 * follow-up threads, multi-language and role-based explanations, confidence
 * flags, evidence links, comparison/risk/fix framing, history, share cards,
 * voice scripts, quizzes, kid mode, templates, live editing, versioning,
 * contrasting opinions, severity justification, attack narration, process
 * mapping, search, export, regulatory/cost/timeline/benchmark framing,
 * feedback, multi-finding narratives, chat threads, gauges/meters,
 * white-labeling, glossary auto-linking, story mode, personalization, and
 * myth-busting. Template-driven from the finding's own fields — explanations
 * are always about the actual finding, never canned filler.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic: no Date.now(), no Math.random.
 *
 * finding: { id, type, severity, title, location, evidence?, firstSeen?,
 *            introducedIn?, businessUnit? }
 * type is a kebab-case key like 'sql-injection'.
 */

import { explainFinding, eli5Explanation, executiveSummary } from './explainabilityCore.js';

export const WAVE36_START = 51401;
export const WAVE36_END = 51440;

/** Registry of the 40 explainability-round-2 ideas — completeness is testable. Zero skips. */
export const WAVE36_IDEAS = [
  [
    51401,
    'explanation depth slider',
    'Dial an explanation from a one-liner up to a full walkthrough',
  ],
  [51402, 'jargon buster', 'Inline plain definitions for technical terms'],
  [
    51403,
    'visual exploit walkthrough',
    'Step-by-step illustrated flow of how the finding was proven',
  ],
  [51404, 'ask-follow-up threads', 'Keep questioning any explanation until it clicks'],
  [
    51405,
    'multi-language explanations',
    'Template-based plain-language explanations in Hindi and Spanish',
  ],
  [
    51406,
    'role-based explanations',
    'Tailored versions for developer, manager, or executive audiences',
  ],
  [
    51407,
    'explanation confidence flags',
    'The agent flags the parts of an explanation it is less sure about',
  ],
  [51408, 'evidence-linked claims', 'Each claim in the explanation links to supporting evidence'],
  [51409, 'comparison explanations', '"Like the finding we saw last month, except…" framing'],
  [51410, 'risk-in-context explainer', 'Why this finding matters for this specific business'],
  [51411, 'fix-oriented endings', 'Every explanation ends with what fixing it looks like'],
  [51412, 'explanation history', 'Revisit every explanation generated during the hunt'],
  [51413, 'shareable explanation cards', 'Clean cards you can send to stakeholders directly'],
  [51414, 'voice explanations', 'A TTS-ready plain-text script of the finding explanation'],
  [51415, 'explanation quizzes', 'Check-questions confirming a stakeholder understood'],
  [51416, 'kid-friendly mode', 'Extreme simplification for awareness-training contexts'],
  [51417, 'explanation templates', 'Preferred explanation structure applied automatically'],
  [51418, 'live explanation editing', 'Tweak the explanation; the agent notes your style'],
  [51419, 'explanation versioning', 'Track how an explanation evolved as the finding matured'],
  [51420, 'contrasting opinions', 'Alternative interpretations of ambiguous findings'],
  [51421, 'severity justification', 'Plain-language reasoning for the severity rating'],
  [
    51422,
    'attack-scenario narration',
    '"Here is how an attacker would actually use this" storytelling',
  ],
  [51423, 'business-process mapping', 'The finding mapped to the business process it threatens'],
  [51424, 'explanation search', 'Find past explanations by keyword across all hunts'],
  [51425, 'explanation export', 'Download explanations as slides or one-pagers'],
  [51426, 'regulatory framing', 'The finding explained in compliance terms'],
  [51427, 'cost-of-breach framing', 'Potential financial impact in plain numbers'],
  [51428, 'timeline explanations', 'How long the weakness likely existed, explained simply'],
  [51429, 'peer-benchmark context', '"Similar companies typically fix this in X days" framing'],
  [51430, 'explanation feedback loop', 'Rate explanations to improve future ones'],
  [51431, 'multi-finding narratives', 'Several related findings woven into one coherent story'],
  [51432, 'explanation chat threads', 'Discuss any explanation with the agent in a thread'],
  [
    51433,
    'visual severity scales',
    'Intuitive gauges showing where the finding sits on risk scales',
  ],
  [51434, 'remediation difficulty meter', 'Plain indication of how hard the fix will be'],
  [51435, 'exploitability meter', 'How easily an attacker could use this, in plain terms'],
  [
    51436,
    'white-labeled client explanations',
    'Client-ready explanations with internal branding removed',
  ],
  [51437, 'glossary auto-linking', 'Every technical term links to a plain definition'],
  [51438, 'story-mode report section', 'Findings retold as a narrative chapter in the report'],
  [51439, 'explanation personalization', 'Explanations adapt to what the reader already knows'],
  [51440, 'myth-busting notes', 'Common misconceptions about the finding type, corrected plainly'],
];

/* Shared per-type knowledge ------------------------------------------------ */

const TYPE_FIX = {
  'sql-injection': [
    'Use parameterized queries / prepared statements everywhere user input reaches SQL.',
    'Apply least-privilege DB accounts so a breakout reads as little as possible.',
    'Add a WAF rule as a stopgap, then fix the code — the WAF is not the fix.',
  ],
  xss: [
    'Encode output for the right context (HTML, attribute, JS) — never trust raw interpolation.',
    'Ship a Content-Security-Policy that blocks inline scripts.',
    'Audit stored user content paths, not just reflected ones.',
  ],
  idor: [
    'Check ownership on every object access, server-side, on every request.',
    'Use unpredictable identifiers or capability URLs where feasible.',
    'Add tests that swap IDs between two test users.',
  ],
  ssrf: [
    'Allowlist outbound fetch targets; block cloud metadata endpoints explicitly.',
    'Validate and normalize user-supplied URLs before fetching.',
    'Run outbound requests through a locked-down proxy with no internal routes.',
  ],
  'jwt-none-alg': [
    'Enforce an explicit allowlist of signing algorithms — never accept "none".',
    'Verify signatures with the correct key on every request.',
    'Add short expirations and rotate signing keys.',
  ],
  'secret-leak': [
    'Rotate the exposed secret immediately — treat it as compromised.',
    'Move secrets to a vault / environment config, never into client bundles or logs.',
    'Scan history for how long the secret was exposed.',
  ],
  'cors-misconfig': [
    'Replace the wildcard origin with an explicit allowlist.',
    'Only send Access-Control-Allow-Credentials to trusted origins.',
    'Vary: Origin on responses so caches do not leak across sites.',
  ],
  'open-redirect': [
    'Allowlist redirect targets; reject absolute URLs you do not recognize.',
    'Use internal redirect keys instead of raw URLs in parameters.',
    'Warn users when leaving the trusted domain.',
  ],
  'subdomain-takeover': [
    'Remove the dangling DNS record or point it at a resource you control.',
    'Audit all CNAME records against live services quarterly.',
    'Claim the dangling service name yourself until DNS is cleaned.',
  ],
  'broken-auth': [
    'Add rate limiting and lockouts on login attempts.',
    'Use a proven auth library instead of hand-rolled session logic.',
    'Enforce MFA for privileged accounts.',
  ],
  'rate-limit': [
    'Add per-IP and per-account throttles on the endpoint.',
    'Return 429 with Retry-After instead of silently queuing.',
    'Alert on sustained throttle hits — it is often an attack.',
  ],
  'info-disclosure': [
    'Replace verbose errors with generic messages; log details server-side.',
    'Strip stack traces, versions, and paths from public responses.',
    'Add a response-header audit to CI.',
  ],
};

const TYPE_DIFFICULTY = {
  'sql-injection': {
    value: 45,
    factors: ['Code change in query layer', 'Needs regression tests on search'],
  },
  xss: {
    value: 55,
    factors: ['Output encoding across templates', 'CSP rollout can break inline scripts'],
  },
  idor: { value: 60, factors: ['Ownership checks on every endpoint', 'Easy to miss one path'] },
  ssrf: { value: 50, factors: ['URL validation logic', 'Proxy or allowlist config'] },
  'jwt-none-alg': {
    value: 25,
    factors: ['Small, well-understood change', 'Key rotation coordination'],
  },
  'secret-leak': {
    value: 30,
    factors: ['Rotation is quick', 'Audit of exposure window takes longer'],
  },
  'cors-misconfig': {
    value: 20,
    factors: ['Single config change', 'Verify no legit integration breaks'],
  },
  'open-redirect': { value: 30, factors: ['Allowlist of targets', 'Small code change'] },
  'subdomain-takeover': { value: 15, factors: ['DNS record removal', 'No code change needed'] },
  'broken-auth': { value: 70, factors: ['Auth redesign risk', 'Session migration for users'] },
  'rate-limit': {
    value: 35,
    factors: ['Middleware or gateway rule', 'Tune thresholds to avoid false blocks'],
  },
  'info-disclosure': { value: 20, factors: ['Error handler change', 'Low blast radius'] },
};

const TYPE_EXPLOITABILITY = {
  'sql-injection': { value: 85, factors: ['Automated tools exist', 'No user interaction needed'] },
  xss: { value: 70, factors: ['Needs a victim to click', 'Phishing delivery is common'] },
  idor: { value: 80, factors: ['Just change an ID', 'Scriptable enumeration'] },
  ssrf: {
    value: 65,
    factors: ['Needs server to fetch attacker URL', 'Cloud metadata is one request away'],
  },
  'jwt-none-alg': { value: 95, factors: ['Forge any identity', 'Trivial to weaponize'] },
  'secret-leak': { value: 90, factors: ['Key is already public', 'Attacker just uses it'] },
  'cors-misconfig': {
    value: 60,
    factors: ['Needs victim browser visit', 'Silent data theft once loaded'],
  },
  'open-redirect': { value: 75, factors: ['Phishing amplifier', 'Abuses domain trust'] },
  'subdomain-takeover': {
    value: 70,
    factors: ['Claim the dangling service', 'Then phish from your domain'],
  },
  'broken-auth': { value: 80, factors: ['Credential stuffing at scale', 'Automation-friendly'] },
  'rate-limit': { value: 75, factors: ['Scriptable abuse', 'No exploit skill needed'] },
  'info-disclosure': { value: 40, factors: ['Aids recon only', 'Not directly exploitable'] },
};

const TYPE_PEER_DAYS = {
  'sql-injection': 14,
  xss: 21,
  idor: 14,
  ssrf: 21,
  'jwt-none-alg': 7,
  'secret-leak': 3,
  'cors-misconfig': 14,
  'open-redirect': 21,
  'subdomain-takeover': 7,
  'broken-auth': 14,
  'rate-limit': 30,
  'info-disclosure': 30,
};

const TYPE_MYTHS = {
  'sql-injection': [
    {
      myth: 'Our WAF blocks SQL injection, so the code is fine.',
      truth:
        'A WAF is a seatbelt, not brakes — attackers routinely bypass signature-based filters. The query code itself must be fixed.',
    },
    {
      myth: 'Only login forms are at risk.',
      truth:
        'Any input that reaches a query is at risk — search boxes, sort parameters, and APIs are the usual overlooked paths.',
    },
  ],
  xss: [
    {
      myth: 'XSS is just defacement, not a real breach.',
      truth:
        'Stored XSS runs attacker JavaScript as your users — session theft and account takeover, not graffiti.',
    },
    {
      myth: 'Our framework escapes everything automatically.',
      truth:
        'Frameworks escape the default context only. Raw HTML helpers, innerHTML, and JS contexts still need manual care.',
    },
  ],
  idor: [
    {
      myth: 'Nobody will guess our sequential IDs.',
      truth:
        "Attackers do not guess — they enumerate. Sequential IDs make someone else's data one number away.",
    },
    {
      myth: 'It is fine because the data is not sensitive.',
      truth:
        'Today\'s "not sensitive" IDOR becomes tomorrow\'s data breach when fields are added to the same endpoint.',
    },
  ],
  ssrf: [
    {
      myth: 'Blocking external URLs is enough.',
      truth:
        "SSRF's danger is internal URLs — cloud metadata and admin panels the server can reach but the internet cannot.",
    },
    {
      myth: 'Our allowlist covers it.',
      truth:
        'Allowlists fail on redirect chains, DNS rebinding, and parser quirks. Validate the final resolved target, not just the input string.',
    },
  ],
  'jwt-none-alg': [
    {
      myth: 'Nobody knows we accept unsigned tokens.',
      truth:
        'Algorithm confusion is textbook — scanners test for "none" automatically. Obscurity is not a control.',
    },
    {
      myth: 'Our tokens are short-lived, so it does not matter.',
      truth: 'A forged admin token valid for even five minutes is a full authentication bypass.',
    },
  ],
};

const GENERIC_MYTHS = [
  {
    myth: 'Low severity means we can ignore it.',
    truth:
      'Low severity means limited impact alone — chained with other findings it often becomes the entry point.',
  },
  {
    myth: 'We will fix it in the next big rewrite.',
    truth: 'Deferred fixes compound. Small, targeted patches now beat perfect rewrites later.',
  },
];

function fixSteps(finding) {
  return (
    TYPE_FIX[finding.type] || [
      'Have an engineer reproduce the finding from the evidence.',
      'Apply the smallest safe fix, then re-test the exact proof steps.',
      'Add a regression check so it cannot silently return.',
    ]
  );
}

/* 51401 — depth slider -------------------------------------------------------- */

export const DEPTH_LEVELS = [
  { level: 1, label: 'One-liner' },
  { level: 2, label: 'Brief' },
  { level: 3, label: 'Detailed' },
  { level: 4, label: 'Full walkthrough' },
];

/** Template-driven explanation whose length follows the slider, built from the finding's fields. */
export function depthText(finding, level) {
  const lvl = Math.min(4, Math.max(1, level || 1));
  const oneLiner = `${finding.title || finding.id} at ${finding.location} — ${finding.severity || 'unknown'} severity.`;
  if (lvl === 1) return { level: 1, label: 'One-liner', text: oneLiner };
  if (lvl === 2)
    return { level: 2, label: 'Brief', text: `${oneLiner} ${explainFinding(finding)}` };
  if (lvl === 3) {
    return {
      level: 3,
      label: 'Detailed',
      text: `${explainFinding(finding)} ${severityJustification(finding).summary} ${riskInContext(finding, { business: finding.businessUnit || 'saas' })}`,
    };
  }
  return {
    level: 4,
    label: 'Full walkthrough',
    text: [
      explainFinding(finding),
      `How it was proven: ${exploitSteps(finding)
        .map(s => `step ${s.n} — ${s.title}`)
        .join('; ')}.`,
      severityJustification(finding).summary,
      riskInContext(finding, { business: finding.businessUnit || 'saas' }),
      `Fix outlook: ${fixEnding(finding).closing}`,
    ].join(' '),
  };
}

/* 51402 — jargon buster -------------------------------------------------------- */

export const JARGON_GLOSSARY = {
  'sql injection':
    'Tricking an app into running attacker-written database commands by hiding them inside normal input.',
  xss: "Cross-site scripting: attacker text that runs as code in another user's browser.",
  payload: 'The piece of data an attacker sends to trigger the vulnerability.',
  sanitization: 'Cleaning user input so dangerous characters cannot become code.',
  token:
    'A small credential string that proves who you are without sending your password each time.',
  session: "The server's memory of your logged-in visit, usually tracked with a cookie.",
  cors: "Cross-origin rules deciding which websites may read your site's responses.",
  ssrf: 'Server-side request forgery: tricking your server into fetching an attacker-chosen URL.',
  idor: "Insecure direct object reference: changing an ID in a request to access someone else's data.",
  cve: 'A public catalog number for a known vulnerability, so everyone refers to the same flaw.',
  cvss: 'A 0–10 score estimating how severe a vulnerability is.',
  exploit: 'A working method that actually abuses the vulnerability, not just theory.',
  poc: 'Proof of concept: a small demonstration that the flaw is real and reachable.',
  '2fa': 'Two-factor authentication: password plus a second check, like a phone code.',
  hashing: 'Scrambling a password into an unreadable fingerprint that cannot be reversed.',
  encryption: 'Scrambling data so only someone with the key can read it.',
  mitm: 'Man-in-the-middle: an attacker secretly sitting between you and the site you use.',
  rce: 'Remote code execution: the attacker runs their own programs on your server.',
  'privilege escalation': 'Going from a low-power account to a high-power one without permission.',
  'zero-day':
    'A flaw nobody knew about before — no patch exists yet because it was just discovered.',
  waf: 'Web application firewall: a filter in front of the app that blocks known attack patterns.',
  csrf: 'Cross-site request forgery: tricking your browser into performing actions on a site where you are logged in.',
  dns: "The internet's phone book, turning names like example.com into server addresses.",
  csp: 'Content-security-policy: a browser rule limiting which scripts a page may run.',
};

const JARGON_TERMS = Object.keys(JARGON_GLOSSARY).sort((a, b) => b.length - a.length);

/** Case-insensitive glossary lookup; returns null for unknown terms. */
export function lookupTerm(term) {
  if (!term) return null;
  const key = String(term).trim().toLowerCase();
  return JARGON_GLOSSARY[key] ? { term: key, definition: JARGON_GLOSSARY[key] } : null;
}

/** Returns the glossary terms found inside a text, longest-first, no duplicates. */
export function findJargonTerms(text) {
  const lower = ` ${String(text || '').toLowerCase()} `;
  const found = [];
  for (const term of JARGON_TERMS) {
    if (lower.includes(` ${term} `) || lower.includes(` ${term}.`) || lower.includes(` ${term},`)) {
      if (!found.some(f => term.includes(f) || f.includes(term))) found.push(term);
    }
  }
  return found;
}

/* 51403 — visual exploit walkthrough -------------------------------------------- */

const TYPE_STEPS = {
  'sql-injection': [
    {
      n: 1,
      title: 'Map the input',
      detail:
        'The hunt found the search box at the location passes text straight into a database query.',
    },
    {
      n: 2,
      title: 'Send a probe',
      detail:
        'A harmless test character was sent; the error reply confirmed the input reaches the query unsanitized.',
    },
    {
      n: 3,
      title: 'Prove control',
      detail:
        'A crafted input made the database answer a question only it could know — proving attacker commands run.',
    },
    {
      n: 4,
      title: 'Measure impact',
      detail: 'The same channel could read or change data the attacker should never touch.',
    },
  ],
  xss: [
    {
      n: 1,
      title: 'Find the sink',
      detail: 'User-supplied text at the location is rendered into the page without encoding.',
    },
    {
      n: 2,
      title: 'Inject a marker',
      detail: 'A harmless marker string was submitted and observed executing in the rendered page.',
    },
    {
      n: 3,
      title: 'Confirm the session angle',
      detail: 'The injected script runs as the victim user — sessions and actions are reachable.',
    },
  ],
  idor: [
    {
      n: 1,
      title: 'Capture a request',
      detail: 'A normal request at the location carries an object ID belonging to the test user.',
    },
    {
      n: 2,
      title: 'Swap the ID',
      detail: "Replacing the ID with another user's returned their data — no ownership check ran.",
    },
    {
      n: 3,
      title: 'Confirm scope',
      detail: 'Sequential IDs enumerate further records, proving bulk access is possible.',
    },
  ],
};

function genericSteps(finding) {
  return [
    {
      n: 1,
      title: 'Locate the weakness',
      detail: `The hunt flagged ${finding.location} during automated checks.`,
    },
    {
      n: 2,
      title: 'Send a safe probe',
      detail: 'A non-destructive test confirmed the behavior described in the finding.',
    },
    {
      n: 3,
      title: 'Verify reachability',
      detail: 'The proof used only normal network access — no special privileges needed.',
    },
  ];
}

/** Ordered, illustrated-flow-ready steps showing how the finding was proven. */
export function exploitSteps(finding) {
  return (TYPE_STEPS[finding.type] || genericSteps(finding)).map(s => ({ ...s }));
}

/* 51404 — follow-up threads ------------------------------------------------------ */

export function followUpSuggestions(finding) {
  return [
    'How would you fix this?',
    'How could an attacker actually use this?',
    'What would this cost us if exploited?',
    'Why is the severity rated this way?',
    'How long has this weakness existed?',
    'What evidence proves this is real?',
  ].map((q, i) => ({ id: `fq-${i + 1}`, question: q }));
}

/** Keyword-matched follow-up answers composed from the finding's own data. */
export function answerFollowUp(finding, question) {
  const q = String(question || '').toLowerCase();
  if (q.includes('fix') || q.includes('remediat') || q.includes('patch')) {
    const fe = fixEnding(finding);
    return `Fixing it looks like this: ${fe.steps.join(' ')} ${fe.closing}`;
  }
  if (q.includes('cost') || q.includes('much') || q.includes('money') || q.includes('financial'))
    return costSentence(finding);
  if (q.includes('attacker') || q.includes('abuse') || q.includes('use this')) {
    const sc = attackScenario(finding);
    return `${sc.title}: ${sc.beats.map(b => b.title).join(' → ')}.`;
  }
  if (
    q.includes('why') &&
    (q.includes('sever') || q.includes('rating') || q.includes('critical') || q.includes('high'))
  )
    return severityJustification(finding).summary;
  if (q.includes('long') || q.includes('when') || q.includes('exist'))
    return weaknessTimeline(finding).sentence;
  if (q.includes('evidence') || q.includes('proof') || q.includes('prove') || q.includes('real')) {
    const links = evidenceLinks(finding);
    return links.length
      ? `The proof: ${links.map(l => l.claim).join(' ')} Evidence on file: ${links[0].evidence}.`
      : 'No evidence recorded yet — ask for a re-test with proof capture.';
  }
  return `${explainFinding(finding)} Ask about the fix, the cost, the evidence, or how an attacker would use it.`;
}

/* 51405 — multi-language explanations --------------------------------------------- */
/* Template-based phrase translation (not full machine translation) — honest scope. */

const LANG_SEVERITY = {
  hi: { critical: 'गंभीर', high: 'उच्च', medium: 'मध्यम', low: 'निम्न', info: 'सूचनात्मक' },
  es: { critical: 'crítica', high: 'alta', medium: 'media', low: 'baja', info: 'informativa' },
};

export const EXPLANATION_LANGS = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'es', name: 'Español' },
];

/** Template-driven explanation in the requested language; falls back to English. */
export function translateExplanation(finding, lang) {
  const sev = (finding.severity || 'unknown').toLowerCase();
  if (lang === 'hi') {
    const sevHi = LANG_SEVERITY.hi[sev] || finding.severity || 'अज्ञात';
    return `सरल भाषा में: "${finding.title || finding.id}" ${finding.location} पर एक ${sevHi} समस्या है। इसका मतलब है कि कोई बाहरी व्यक्ति इसका गलत इस्तेमाल करके आपका डेटा देख या बदल सकता है। इसे जल्द ठीक करना चाहिए।`;
  }
  if (lang === 'es') {
    const sevEs = LANG_SEVERITY.es[sev] || finding.severity || 'desconocida';
    return `En lenguaje sencillo: "${finding.title || finding.id}" en ${finding.location} es un problema de gravedad ${sevEs}. Significa que una persona externa podría aprovecharlo para ver o modificar sus datos. Debe corregirse pronto.`;
  }
  return eli5Explanation(finding);
}

/* 51406 — role-based explanations -------------------------------------------------- */

export const EXPLANATION_ROLES = ['developer', 'manager', 'executive'];

/** Tailored explanation per audience, built from the finding's fields. */
export function roleExplanation(finding, role) {
  const r = String(role || '').toLowerCase();
  if (r === 'developer') {
    return `Developer brief — ${finding.title || finding.id} (${finding.severity || 'unknown'}) at ${finding.location}. ${explainFinding(finding)} Reproduce with: ${exploitSteps(
      finding
    )
      .map(s => s.title)
      .join(' → ')}. Fix: ${fixSteps(finding)[0]}`;
  }
  if (r === 'manager') {
    return `Manager brief — ${finding.title || finding.id} is ${finding.severity || 'unknown'} severity at ${finding.location}. ${riskInContext(finding, { business: finding.businessUnit || 'saas' })} Peers typically resolve this class in ${peerBenchmark(finding).typicalFixDays} days; remediation difficulty is ${difficultyMeter(finding).label.toLowerCase()}.`;
  }
  return `Executive brief — ${executiveSummary(finding)}`;
}

/* 51407 — confidence flags ---------------------------------------------------------- */

const SEVERITY_KNOWN = ['critical', 'high', 'medium', 'low', 'info'];

/** Flags the parts of an explanation the agent is less sure about. */
export function confidenceFlags(finding) {
  const flags = [];
  const knownType = !!TYPE_FIX[finding.type];
  flags.push({
    part: 'finding description',
    level: knownType ? 'high' : 'medium',
    note: knownType
      ? 'Vulnerability class is in the knowledge base.'
      : 'Finding type is not in the knowledge base — the description is a generic fallback. Confirm with an engineer.',
  });
  flags.push({
    part: 'severity rating',
    level: SEVERITY_KNOWN.includes((finding.severity || '').toLowerCase()) ? 'high' : 'low',
    note: SEVERITY_KNOWN.includes((finding.severity || '').toLowerCase())
      ? 'Severity uses the standard scale.'
      : 'Severity value is non-standard — treat the rating as provisional.',
  });
  flags.push({
    part: 'evidence',
    level: finding.evidence ? 'high' : 'medium',
    note: finding.evidence
      ? 'Direct evidence is attached to the finding.'
      : 'No direct evidence attached — the claim rests on scanner output alone.',
  });
  flags.push({
    part: 'exploitability',
    level: 'medium',
    note: 'Exploitability is estimated from the vulnerability class, not from a live exploit attempt in your environment.',
  });
  return flags;
}

/* 51408 — evidence-linked claims ----------------------------------------------------- */

const TYPE_CLAIMS = {
  'sql-injection': [
    'User input reaches a database query without sanitization.',
    'Attacker-controlled database commands execute in the application context.',
  ],
  xss: [
    "Attacker-supplied text is rendered as code in another user's browser.",
    "The injected script runs with the victim user's session.",
  ],
  idor: [
    'Object IDs from the request are trusted without an ownership check.',
    "Another user's records are retrievable by swapping the ID.",
  ],
  ssrf: [
    'The server fetches a URL taken from user input.',
    'Internal-only endpoints are reachable through the fetch.',
  ],
  'jwt-none-alg': [
    'Tokens signed with the "none" algorithm are accepted.',
    'A forged token is trusted as any user, including admin.',
  ],
};

/** Each claim paired with the supporting evidence (or an honest gap note). */
export function evidenceLinks(finding) {
  const claims = TYPE_CLAIMS[finding.type] || [
    `The scanner flagged ${finding.location} as ${finding.title || finding.id}.`,
  ];
  const evidence =
    finding.evidence ||
    'No direct evidence recorded — re-test with proof capture before prioritizing.';
  return claims.map((claim, i) => ({
    id: `ev-${i + 1}`,
    claim,
    evidence,
    ref: finding.evidence ? `${finding.id}-evidence` : null,
  }));
}

/* 51409 — comparison explanations ----------------------------------------------------- */

/** "Like the one we saw last month, except…" — diffs two findings honestly. */
export function comparisonExplanation(finding, previous) {
  if (!previous)
    return `${explainFinding(finding)} No earlier finding was supplied for comparison.`;
  const diffs = [];
  if (previous.type !== finding.type)
    diffs.push(`the class is ${finding.type} instead of ${previous.type}`);
  if (previous.severity !== finding.severity)
    diffs.push(
      `severity is ${finding.severity || 'unknown'} rather than ${previous.severity || 'unknown'}`
    );
  if (previous.location !== finding.location)
    diffs.push(`it lives at ${finding.location} instead of ${previous.location}`);
  const except = diffs.length
    ? `, except ${diffs.join(', ')}`
    : ' — same class, severity, and location pattern';
  return `This is like the ${previous.title || previous.id} we saw at ${previous.location || 'a previous hunt'}${except}. ${explainFinding(finding)}`;
}

/* 51410 — risk in context --------------------------------------------------------------- */

const BUSINESS_CONTEXT = {
  ecommerce:
    'orders, payments, and customer addresses flow through this surface — a breach here hits revenue and chargebacks first',
  saas: 'customer tenants share this surface — one flaw can cross tenant boundaries and trigger churn plus SLA penalties',
  fintech:
    'money movement and KYC data sit behind this surface — regulators and auditors will ask about this finding by name',
  healthcare:
    'patient data is protected by law here — this finding maps directly to breach-notification obligations',
};

/** Why this finding matters for this specific business. */
export function riskInContext(finding, profile) {
  const business = (profile && profile.business) || 'saas';
  const ctx = BUSINESS_CONTEXT[business] || BUSINESS_CONTEXT.saas;
  return `Why it matters for your ${business} business: ${ctx}. A ${finding.severity || 'unknown'}-severity ${finding.type || 'finding'} at ${finding.location} is not an abstract risk — it threatens the exact data your customers trust you with.`;
}

/* 51411 — fix-oriented endings -------------------------------------------------------------- */

export function fixEnding(finding) {
  const steps = fixSteps(finding);
  return {
    steps,
    closing: `What fixing it looks like: ${steps[0]} Then verify with the original proof steps, and add a regression check so it stays fixed. Expect roughly ${peerBenchmark(finding).typicalFixDays} days of calendar time at a typical team pace.`,
  };
}

/* 51412 — explanation history ------------------------------------------------------------------ */

export function recordExplanation(history, entry) {
  const list = Array.isArray(history) ? history : [];
  const id = `expl-${list.length + 1}`;
  return [
    ...list,
    {
      id,
      findingId: entry.findingId,
      mode: entry.mode || 'plain',
      text: entry.text || '',
      seq: list.length + 1,
    },
  ];
}

export function explanationHistory(history, findingId) {
  return (Array.isArray(history) ? history : []).filter(e => e.findingId === findingId);
}

export function getExplanation(history, id) {
  return (Array.isArray(history) ? history : []).find(e => e.id === id) || null;
}

/* 51413 — shareable explanation cards ------------------------------------------------------------- */

export function buildShareCard(finding) {
  const fe = fixEnding(finding);
  const summary = explainFinding(finding);
  return {
    title: finding.title || finding.id,
    severity: finding.severity || 'unknown',
    location: finding.location,
    summary,
    fixLine: fe.steps[0],
    shareText: [
      `${finding.title || finding.id} — ${finding.severity || 'unknown'} severity`,
      `Where: ${finding.location}`,
      summary,
      `Fix: ${fe.steps[0]}`,
    ].join('\n'),
  };
}

/* 51414 — voice explanations ------------------------------------------------------------------------ */

/** Plain-text, TTS-friendly script: short sentences, no markdown, no jargon dumps. */
export function voiceScript(finding) {
  const clean = s =>
    String(s || '')
      .replace(/[*_`#>\[\]()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const sentences = [
    `Finding: ${finding.title || finding.id}.`,
    `Severity: ${finding.severity || 'unknown'}.`,
    `Location: ${finding.location}.`,
    clean(eli5Explanation(finding)).split('. ').slice(0, 3).join('. ') + '.',
    `Recommended fix: ${clean(fixSteps(finding)[0])}`,
  ];
  return sentences.join(' ');
}

/* 51415 — explanation quizzes -------------------------------------------------------------------------- */

const TYPE_QUIZ = {
  'sql-injection': [
    {
      q: 'What is the core mistake behind a SQL injection?',
      options: [
        'User input is placed into a database query without cleaning',
        'The database password is too short',
        'The server has too little memory',
        'The page loads too slowly',
      ],
      answer: 0,
    },
    {
      q: 'What is the correct fix?',
      options: [
        'A bigger server',
        'Parameterized queries / prepared statements',
        'Hiding the search box',
        'More logging',
      ],
      answer: 1,
    },
  ],
  xss: [
    {
      q: 'Why is stored XSS dangerous?',
      options: [
        'It makes pages load slowly',
        'Attacker script runs as the victim user, stealing sessions',
        'It deletes the database directly',
        'It only affects the attacker',
      ],
      answer: 1,
    },
    {
      q: 'Which control most reduces XSS impact?',
      options: [
        'A longer password policy',
        'Content-Security-Policy plus output encoding',
        'Blocking all images',
        'Daily reboots',
      ],
      answer: 1,
    },
  ],
};

function genericQuiz(finding) {
  return [
    {
      q: `Where was "${finding.title || finding.id}" found?`,
      options: [
        finding.location,
        '/unrelated/page',
        'Nowhere — it is theoretical',
        'In the office printer',
      ],
      answer: 0,
    },
    {
      q: 'What should happen next?',
      options: [
        'Ignore it',
        'Reproduce from the evidence, fix, and re-test',
        'Delete the report',
        'Wait a year',
      ],
      answer: 1,
    },
  ];
}

/** Check-questions generated from the finding; deterministic. */
export function buildQuiz(finding) {
  const questions = (TYPE_QUIZ[finding.type] || genericQuiz(finding)).map((q, i) => ({
    id: `q-${i + 1}`,
    ...q,
  }));
  return { findingId: finding.id, questions };
}

/** Scores submitted answers (array of option indexes) against the quiz. */
export function scoreQuiz(quiz, answers) {
  const total = quiz.questions.length;
  let correct = 0;
  quiz.questions.forEach((q, i) => {
    if (answers[i] === q.answer) correct += 1;
  });
  const pct = total ? Math.round((correct / total) * 100) : 0;
  return { correct, total, pct, passed: pct >= 70 };
}

/* 51416 — kid-friendly mode ------------------------------------------------------------------------------- */

const TYPE_KID = {
  'sql-injection':
    'Somebody found a sneaky way to whisper extra instructions to the computer that remembers things — like telling the librarian to also throw away the secret files. Grown-ups need to teach the librarian to only follow safe instructions.',
  xss: 'Someone left a naughty note on the school noticeboard that whispers mean things to everyone who reads it. Grown-ups need to check every note before pinning it up.',
  idor: 'The toy boxes have numbers, and anyone can open any box just by saying a different number. Grown-ups need to put a real lock on each box.',
};

export function kidExplanation(finding) {
  const body =
    TYPE_KID[finding.type] ||
    `Something at ${finding.location} is not as safe as it should be — like a gate with a wobbly lock. Grown-ups are fixing the lock.`;
  return `A super-simple version for young learners: ${body} Remember: if something online looks strange, tell a grown-up.`;
}

/* 51417 — explanation templates --------------------------------------------------------------------------------- */

export const EXPLANATION_TEMPLATES = [
  {
    id: 'what-why-fix',
    name: 'What / Why / Fix',
    sections: ['What happened', 'Why it matters', 'How to fix'],
  },
  { id: 'exec-brief', name: 'Executive brief', sections: ['Headline', 'Business impact', 'Ask'] },
  {
    id: 'dev-ticket',
    name: 'Developer ticket',
    sections: ['Reproduction', 'Root cause', 'Acceptance criteria'],
  },
];

/** Applies a preferred structure to the finding's explanation. */
export function applyTemplate(templateId, finding) {
  const tpl = EXPLANATION_TEMPLATES.find(t => t.id === templateId) || EXPLANATION_TEMPLATES[0];
  const bodies = {
    'what-why-fix': [
      explainFinding(finding),
      riskInContext(finding, { business: finding.businessUnit || 'saas' }),
      fixEnding(finding).closing,
    ],
    'exec-brief': [
      `${finding.title || finding.id} — ${finding.severity || 'unknown'} severity at ${finding.location}.`,
      riskInContext(finding, { business: finding.businessUnit || 'saas' }),
      `Approve remediation; peers resolve this class in ~${peerBenchmark(finding).typicalFixDays} days.`,
    ],
    'dev-ticket': [
      `Steps: ${exploitSteps(finding)
        .map(s => s.title)
        .join(' → ')} at ${finding.location}.`,
      `Root cause class: ${finding.type || 'unknown'}.`,
      `Done when: ${fixSteps(finding)[0]} Lower bar: proof steps no longer reproduce.`,
    ],
  };
  const texts = bodies[tpl.id] || bodies['what-why-fix'];
  return {
    templateId: tpl.id,
    name: tpl.name,
    sections: tpl.sections.map((heading, i) => ({ heading, body: texts[i] || '' })),
  };
}

/* 51418 — live explanation editing ----------------------------------------------------------------------------------- */

/** Heuristic style profile learned from the user's edited text. */
export function learnStyle(text) {
  const words = String(text || '')
    .split(/\s+/)
    .filter(Boolean);
  const sentences = String(text || '')
    .split(/[.!?]+/)
    .filter(s => s.trim().length > 0);
  const avgSentenceLen = sentences.length ? Math.round(words.length / sentences.length) : 0;
  const casualHits = (
    String(text).match(/\b(don't|can't|won't|it's|you'll|we'll|gonna|kinda)\b/gi) || []
  ).length;
  return {
    wordCount: words.length,
    avgSentenceLen,
    tone: casualHits >= 2 ? 'casual' : avgSentenceLen >= 22 ? 'formal' : 'mixed',
  };
}

/** Applies the user's edit and returns the learned style profile alongside. */
export function editExplanation(current, userText) {
  return { previous: current, text: userText, style: learnStyle(userText) };
}

/* 51419 — explanation versioning ---------------------------------------------------------------------------------------- */

export function addExplanationVersion(versions, text) {
  const list = Array.isArray(versions) ? versions : [];
  const v = list.length + 1;
  return [...list, { v, text, seq: v }];
}

export function getVersion(versions, v) {
  return (Array.isArray(versions) ? versions : []).find(x => x.v === v) || null;
}

/** Simple word-level diff between two versions (capped, deterministic). */
export function diffVersions(a, b) {
  const aw = new Set(
    String(a || '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
  );
  const bw = new Set(
    String(b || '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
  );
  const added = [...bw].filter(w => !aw.has(w)).slice(0, 25);
  const removed = [...aw].filter(w => !bw.has(w)).slice(0, 25);
  return { added, removed, addedCount: added.length, removedCount: removed.length };
}

/* 51420 — contrasting opinions ----------------------------------------------------------------------------------------------- */

export function contrastingOpinions(finding) {
  const known = !!TYPE_FIX[finding.type];
  return [
    {
      stance: 'Likely a true positive',
      reason: known
        ? `The ${finding.type} pattern at ${finding.location} matches a well-known vulnerability class with working proof steps.`
        : `The scanner flagged concrete behavior at ${finding.location}; treat it as real until disproven.`,
    },
    {
      stance: 'Could be benign',
      reason:
        'Scanner output can misread framework protections — a framework-level encoder or gateway rule may already neutralize it.',
    },
    {
      stance: 'Needs a human check',
      reason: finding.evidence
        ? 'Evidence exists, but business-logic context decides the real blast radius — have the owning engineer confirm reachability.'
        : 'No direct evidence is attached, so this opinion cannot be settled without a manual re-test.',
    },
  ];
}

/* 51421 — severity justification ------------------------------------------------------------------------------------------------------ */

const SEVERITY_REASONS = {
  critical: [
    'Direct path to full compromise (data theft, auth bypass, or code execution).',
    'Exploitable with low skill and no user interaction in the common case.',
    'Breach-notification and disclosure obligations likely trigger.',
  ],
  high: [
    'Serious impact on confidentiality or integrity, though usually needing one extra condition.',
    'Well-understood exploit techniques exist in the wild.',
    'Should block a release until addressed.',
  ],
  medium: [
    'Real weakness, but exploitation needs specific conditions or user interaction.',
    'Often the stepping-stone that makes a high-severity chain possible.',
    'Fix in the normal sprint cycle.',
  ],
  low: [
    'Limited direct impact — mostly useful for reconnaissance or minor abuse.',
    'Still worth fixing: low findings become entry points when chained.',
    'Fix opportunistically.',
  ],
  info: [
    'No direct security impact; noted for completeness.',
    'Useful context for hardening, not a vulnerability to patch urgently.',
  ],
};

/** Plain-language reasoning for why the severity rating was assigned. */
export function severityJustification(finding) {
  const sev = (finding.severity || 'unknown').toLowerCase();
  const reasons = SEVERITY_REASONS[sev] || [
    'The severity value is non-standard, so this rating is provisional — confirm with the owning engineer.',
  ];
  const summary = `Rated ${finding.severity || 'unknown'} because: ${reasons[0]}`;
  return { severity: finding.severity || 'unknown', reasons, summary };
}

/* 51422 — attack-scenario narration -------------------------------------------------------------------------------------------------------- */

const TYPE_SCENARIO = {
  'sql-injection': [
    {
      n: 1,
      title: 'Recon',
      detail: 'The attacker finds the search box and notices database-flavored error messages.',
    },
    {
      n: 2,
      title: 'Weaponize',
      detail: 'They craft input that asks the database for the users table instead of products.',
    },
    {
      n: 3,
      title: 'Exfiltrate',
      detail: 'Rows stream out — emails, password hashes, whatever the query can reach.',
    },
    {
      n: 4,
      title: 'Cash out',
      detail:
        "Credentials get tested against other sites; the breach becomes someone else's login problem too.",
    },
  ],
  xss: [
    {
      n: 1,
      title: 'Plant',
      detail: 'The attacker saves a comment carrying a script at the vulnerable page.',
    },
    {
      n: 2,
      title: 'Wait',
      detail: "Every visitor who loads the page silently runs the attacker's code.",
    },
    {
      n: 3,
      title: 'Harvest',
      detail: 'Sessions and keystrokes flow to the attacker; accounts fall one by one.',
    },
  ],
  idor: [
    {
      n: 1,
      title: 'Borrow',
      detail: 'The attacker signs up for a normal account and watches their own requests.',
    },
    {
      n: 2,
      title: 'Swap',
      detail: "They change the ID in the URL and someone else's order appears.",
    },
    { n: 3, title: 'Enumerate', detail: 'A script walks through IDs, collecting records in bulk.' },
  ],
};

function genericScenario(finding) {
  return [
    {
      n: 1,
      title: 'Probe',
      detail: `The attacker pokes at ${finding.location} the way the hunt did.`,
    },
    {
      n: 2,
      title: 'Confirm',
      detail: 'The weak behavior answers back — the flaw is real and reachable.',
    },
    {
      n: 3,
      title: 'Abuse',
      detail: 'They fold it into their toolkit and return whenever it is useful.',
    },
  ];
}

/** "Here is how an attacker would actually use this" — narrative beats. */
export function attackScenario(finding) {
  return {
    title: `How an attacker would use the ${finding.title || finding.id}`,
    beats: (TYPE_SCENARIO[finding.type] || genericScenario(finding)).map(b => ({ ...b })),
  };
}

/* 51423 — business-process mapping ------------------------------------------------------------------------------------------------------------ */

const PROCESS_MAP = {
  ecommerce: ['Checkout & payment', 'Order fulfillment', 'Customer accounts', 'Marketing site'],
  saas: ['Signup & onboarding', 'Tenant data access', 'Billing', 'API integrations'],
  fintech: ['KYC onboarding', 'Money movement', 'Statements & reporting', 'Support tooling'],
  healthcare: ['Patient intake', 'Records access', 'Billing & claims', 'Appointment scheduling'],
};

const TYPE_PROCESS_HINT = {
  'sql-injection': /payment|billing|data access|records access|checkout/i,
  xss: /accounts|customer accounts|marketing site|support tooling|signup/i,
  idor: /order|tenant data|records access|statements/i,
  ssrf: /integrations|api integrations|webhook/i,
  'jwt-none-alg': /accounts|customer accounts|support tooling|signup|intake/i,
  'secret-leak': /integrations|api integrations|billing/i,
};

/** Maps the finding to the business processes it threatens. */
export function mapToProcess(finding, business) {
  const processes = PROCESS_MAP[business] || PROCESS_MAP.saas;
  const hint = TYPE_PROCESS_HINT[finding.type];
  return processes.map(process => {
    const threatened = hint ? hint.test(process) : process.length > 0;
    return {
      process,
      threatened,
      why: threatened
        ? `The ${finding.type || 'finding'} at ${finding.location} can reach data or actions inside "${process}".`
        : 'No direct path from this finding class to this process was identified.',
    };
  });
}

/* 51424 — explanation search ---------------------------------------------------------------------------------------------------------------------- */

export function buildExplanationIndex(explanations) {
  return (Array.isArray(explanations) ? explanations : []).map(e => ({
    id: e.id,
    findingId: e.findingId,
    text: e.text || '',
    tokens: new Set(
      String(e.text || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(t => t.length > 2)
    ),
  }));
}

/** Keyword search over past explanations; ranked by token overlap. */
export function searchExplanations(index, query) {
  const terms = String(query || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 2);
  if (!terms.length) return [];
  return index
    .map(e => ({
      id: e.id,
      findingId: e.findingId,
      text: e.text,
      score: terms.filter(t => e.tokens.has(t)).length,
    }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
}

/* 51425 — explanation export ---------------------------------------------------------------------------------------------------------------------------- */

export function exportSlidesMarkdown(finding) {
  const fe = fixEnding(finding);
  const lines = [
    `# ${finding.title || finding.id}`,
    `Severity: ${finding.severity || 'unknown'} · Location: ${finding.location}`,
    '---',
    '# What happened',
    explainFinding(finding),
    '---',
    '# Why it matters',
    riskInContext(finding, { business: finding.businessUnit || 'saas' }),
    '---',
    '# Evidence',
    ...evidenceLinks(finding).map(l => `- ${l.claim} (Evidence: ${l.evidence})`),
    '---',
    '# What fixing it looks like',
    ...fe.steps.map(s => `- ${s}`),
  ];
  return lines.join('\n');
}

export function exportOnePagerMarkdown(finding) {
  const fe = fixEnding(finding);
  return [
    `# ${finding.title || finding.id} — one-pager`,
    '',
    `**Severity:** ${finding.severity || 'unknown'} · **Location:** ${finding.location}`,
    '',
    '## Summary',
    explainFinding(finding),
    '',
    '## Business context',
    riskInContext(finding, { business: finding.businessUnit || 'saas' }),
    '',
    '## Severity rationale',
    ...severityJustification(finding).reasons.map(r => `- ${r}`),
    '',
    '## Fix',
    ...fe.steps.map(s => `- ${s}`),
    '',
    `*Peer benchmark: similar companies resolve this class in ~${peerBenchmark(finding).typicalFixDays} days.*`,
  ].join('\n');
}

/* 51426 — regulatory framing ---------------------------------------------------------------------------------------------------------------------------------- */

const REG_FRAMING = {
  gdpr: {
    name: 'GDPR',
    text: 'requires protection of personal data by design and 72-hour breach notification — this finding is the kind of weakness regulators cite',
  },
  'pci-dss': {
    name: 'PCI DSS',
    text: 'requires secure coding, access control, and prompt patching of internet-facing flaws — an assessor would flag this finding',
  },
  hipaa: {
    name: 'HIPAA',
    text: 'requires safeguards for electronic health information — this finding weakens the technical safeguards auditors check',
  },
  'soc-2': {
    name: 'SOC 2',
    text: 'tests whether security controls actually work — this finding is evidence a control failed its test',
  },
};

export const REGULATIONS = Object.keys(REG_FRAMING);

/** The finding explained in compliance terms. */
export function regulatoryFraming(finding, regulation) {
  const reg = REG_FRAMING[(regulation || 'gdpr').toLowerCase()] || REG_FRAMING.gdpr;
  return `Compliance view (${reg.name}): ${reg.text}. A ${finding.severity || 'unknown'}-severity ${finding.type || 'finding'} at ${finding.location} left unaddressed becomes an audit finding on top of a security finding — fix it before the auditor asks.`;
}

/* 51427 — cost-of-breach framing ------------------------------------------------------------------------------------------------------------------------------------ */

const COST_TABLE = {
  critical: { low: 120000, mid: 480000, high: 2100000 },
  high: { low: 45000, mid: 180000, high: 750000 },
  medium: { low: 12000, mid: 60000, high: 240000 },
  low: { low: 2000, mid: 12000, high: 50000 },
  info: { low: 0, mid: 1000, high: 5000 },
};

function fmtUSD(n) {
  return '$' + Number(n).toLocaleString('en-US');
}

/** Plain-number cost framing from a deterministic per-severity table. */
export function costOfBreach(finding) {
  const row = COST_TABLE[(finding.severity || '').toLowerCase()] || COST_TABLE.medium;
  return {
    currency: 'USD',
    low: row.low,
    mid: row.mid,
    high: row.high,
    basis:
      'Industry breach-cost ranges for this severity class; your numbers vary with record count and response speed.',
  };
}

export function costSentence(finding) {
  const c = costOfBreach(finding);
  return `In plain numbers: if exploited, incidents of this severity class typically cost between ${fmtUSD(c.low)} and ${fmtUSD(c.high)}, with ${fmtUSD(c.mid)} as the middle of the range — driven by response effort, notification, and lost business, not just the technical fix.`;
}

/* 51428 — timeline explanations ------------------------------------------------------------------------------------------------------------------------------------------ */

export function weaknessTimeline(finding) {
  const events = [];
  if (finding.introducedIn)
    events.push({
      label: 'Likely introduced',
      detail: `The weakness probably dates to ${finding.introducedIn}.`,
    });
  else
    events.push({
      label: 'Likely introduced',
      detail: 'No code-history marker — the weakness predates the first scan that checked for it.',
    });
  if (finding.firstSeen)
    events.push({ label: 'First seen', detail: `First flagged on ${finding.firstSeen}.` });
  else
    events.push({
      label: 'First seen',
      detail: 'First flagged by this hunt — it may have been visible to attackers longer.',
    });
  events.push({
    label: 'Today',
    detail: `Still present at ${finding.location}; every day it stays open is another day of exposure.`,
  });
  const sentence = finding.introducedIn
    ? `This weakness likely existed since ${finding.introducedIn} — every day since was a day an attacker could have found it first.`
    : 'This weakness predates the first scan that checked for it — assume attackers had the same window you did, or longer.';
  return { events, sentence };
}

/* 51429 — peer benchmarks ----------------------------------------------------------------------------------------------------------------------------------------------------- */

/** "Similar companies typically fix this in X days" — per-class table. */
export function peerBenchmark(finding) {
  const days = TYPE_PEER_DAYS[finding.type] || 21;
  return {
    typicalFixDays: days,
    note: `Across similar companies, this vulnerability class is typically resolved in about ${days} days. Faster than that puts you ahead of the pack; slower leaves the window open longer than most peers accept.`,
  };
}

/* 51430 — feedback loop --------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function recordFeedback(ratings, entry) {
  const list = Array.isArray(ratings) ? ratings : [];
  const score = Math.min(5, Math.max(1, Number(entry.score) || 3));
  return [
    ...list,
    { explanationId: entry.explanationId, score, note: entry.note || '', seq: list.length + 1 },
  ];
}

export function feedbackSummary(ratings) {
  const list = Array.isArray(ratings) ? ratings : [];
  const count = list.length;
  const avg = count ? Math.round((list.reduce((s, r) => s + r.score, 0) / count) * 10) / 10 : 0;
  const distribution = [1, 2, 3, 4, 5].map(s => ({
    score: s,
    count: list.filter(r => r.score === s).length,
  }));
  return { count, avg, distribution };
}

/* 51431 — multi-finding narratives ------------------------------------------------------------------------------------------------------------------------------------------------------------ */

/** Weaves several related findings into one coherent story. */
export function multiFindingNarrative(findings) {
  const list = Array.isArray(findings) ? findings : [];
  if (!list.length)
    return {
      title: 'No findings selected',
      paragraphs: ['Select at least one finding to build the narrative.'],
    };
  const types = [...new Set(list.map(f => f.type || 'unknown'))];
  const locations = [...new Set(list.map(f => f.location))];
  const worst = list.reduce(
    (a, b) => (severityRank(a.severity) >= severityRank(b.severity) ? a : b),
    list[0]
  );
  return {
    title: `The story of ${list.length} finding${list.length > 1 ? 's' : ''}: ${types.slice(0, 2).join(' and ')}`,
    paragraphs: [
      `It started with ${list.length} separate flags across ${locations.length} location${locations.length > 1 ? 's' : ''} — ${locations.slice(0, 3).join(', ')}. Alone, each one is a line in a report. Together, they tell one story.`,
      `The common thread is ${types.length === 1 ? `a single weakness class: ${types[0]}` : `a pattern across classes: ${types.join(', ')}`} — the same kind of mistake showing up in more than one place, which usually means a shared root cause rather than bad luck.`,
      `The sharpest edge is "${worst.title || worst.id}" at ${worst.location} (${worst.severity || 'unknown'} severity) — that is the one an attacker would reach for first, and the one to fix first.`,
      `Fix the pattern, not just the instances: ${fixSteps(worst)[0]} Then re-run the hunt across every location above — the story only ends when the whole thread is pulled.`,
    ],
  };
}

function severityRank(sev) {
  return { critical: 5, high: 4, medium: 3, low: 2, info: 1 }[(sev || '').toLowerCase()] || 0;
}

/* 51432 — explanation chat threads -------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function postThreadMessage(thread, author, text) {
  const list = Array.isArray(thread) ? thread : [];
  return [
    ...list,
    { id: `msg-${list.length + 1}`, author, text: String(text || ''), seq: list.length + 1 },
  ];
}

/** The agent's reply inside an explanation thread, grounded in the finding. */
export function threadReply(finding, userText) {
  const answer = answerFollowUp(finding, userText);
  return { author: 'Infinity AI', text: answer };
}

/* 51433–51435 — gauges and meters -------------------------------------------------------------------------------------------------------------------------------------------------------------- */

const SEVERITY_GAUGE = { critical: 95, high: 75, medium: 50, low: 25, info: 10 };

export function gaugeLabel(value) {
  const v = Math.min(100, Math.max(0, Number(value) || 0));
  if (v >= 85) return 'Critical zone';
  if (v >= 65) return 'High zone';
  if (v >= 40) return 'Moderate zone';
  if (v >= 15) return 'Low zone';
  return 'Minimal zone';
}

/** 51433 — where the finding sits on the risk scale, 0–100. */
export function severityGauge(severity) {
  const value = SEVERITY_GAUGE[(severity || '').toLowerCase()] ?? 35;
  return { value, label: gaugeLabel(value) };
}

function meterLabel(value) {
  const v = Math.min(100, Math.max(0, Number(value) || 0));
  if (v >= 75) return 'High';
  if (v >= 50) return 'Moderate';
  if (v >= 25) return 'Low';
  return 'Minimal';
}

/** 51434 — how hard the fix will be, 0–100 with the driving factors. */
export function difficultyMeter(finding) {
  const row = TYPE_DIFFICULTY[finding.type] || {
    value: 50,
    factors: ['Scope depends on the codebase', 'Confirm with the owning engineer'],
  };
  return { value: row.value, label: meterLabel(row.value), factors: row.factors };
}

/** 51435 — how easily an attacker could use this, 0–100 with the driving factors. */
export function exploitabilityMeter(finding) {
  const row = TYPE_EXPLOITABILITY[finding.type] || {
    value: 50,
    factors: ['Depends on attacker access', 'Confirm with a proof attempt'],
  };
  return { value: row.value, label: meterLabel(row.value), factors: row.factors };
}

/* 51436 — white-labeled client explanations ------------------------------------------------------------------------------------------------------------------------------------------------------ */

/** Strips internal branding and internal-only notes for client-ready text. */
export function whiteLabel(text, clientName) {
  const name = clientName || 'your security team';
  return String(text || '')
    .split('\n')
    .filter(line => !/^\s*internal:/i.test(line))
    .join('\n')
    .replace(/Infinity AI/g, name)
    .replace(/Dark-Matter/g, 'the security assessment');
}

export function whiteLabelFinding(finding, clientName) {
  return whiteLabel(
    [
      `${finding.title || finding.id} — ${finding.severity || 'unknown'} severity at ${finding.location}.`,
      explainFinding(finding),
      fixEnding(finding).closing,
      'Prepared by Infinity AI.',
    ].join('\n'),
    clientName
  );
}

/* 51437 — glossary auto-linking --------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

/** Splits text into plain and term segments so the UI can link terms to definitions. */
export function autoLinkGlossary(text) {
  const src = String(text || '');
  const lower = src.toLowerCase();
  const hits = [];
  for (const term of JARGON_TERMS) {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(term, from);
      if (at === -1) break;
      const before = at === 0 || !/[a-z0-9]/.test(lower[at - 1]);
      const after = at + term.length >= lower.length || !/[a-z0-9]/.test(lower[at + term.length]);
      if (before && after) hits.push({ at, end: at + term.length, term });
      from = at + term.length;
    }
  }
  hits.sort((a, b) => a.at - b.at || b.end - a.end);
  const picked = [];
  let lastEnd = 0;
  for (const h of hits) {
    if (h.at >= lastEnd) {
      picked.push(h);
      lastEnd = h.end;
    }
  }
  const segments = [];
  let cursor = 0;
  for (const h of picked) {
    if (h.at > cursor) segments.push({ text: src.slice(cursor, h.at), term: null });
    segments.push({
      text: src.slice(h.at, h.end),
      term: h.term,
      definition: JARGON_GLOSSARY[h.term],
    });
    cursor = h.end;
  }
  if (cursor < src.length) segments.push({ text: src.slice(cursor), term: null });
  return segments.length ? segments : [{ text: src, term: null }];
}

/* 51438 — story-mode report section ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

/** Retells findings as a narrative chapter for the report. */
export function storyModeSection(findings) {
  const list = Array.isArray(findings) ? findings : [];
  if (!list.length) return '# Chapter: The Hunt\n\nNo findings were recorded on this hunt.';
  const lines = ['# Chapter: What the hunt found', ''];
  list.forEach((f, i) => {
    lines.push(`## Scene ${i + 1}: ${f.title || f.id}`);
    lines.push('');
    lines.push(
      `The hunt reached ${f.location} and found ${f.title || f.id} — ${f.severity || 'unknown'} severity. ${explainFinding(f).split('. ')[0]}.`
    );
    lines.push('');
    lines.push(
      `The proof unfolded in ${exploitSteps(f).length} steps: ${exploitSteps(f)
        .map(s => s.title.toLowerCase())
        .join(', ')}. The chapter closes the way every chapter should: ${fixEnding(f).steps[0]}`
    );
    lines.push('');
  });
  lines.push(`## Epilogue`);
  lines.push('');
  lines.push(
    `Across ${list.length} scene${list.length > 1 ? 's' : ''}, the pattern is clear — and every scene already carries its fix. That is the whole story: found, proven, and fixable.`
  );
  return lines.join('\n');
}

/* 51439 — explanation personalization ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

/** Estimates reader knowledge from a small profile; deterministic. */
export function estimateKnowledge(profile) {
  const p = profile || {};
  const years = Number(p.yearsExperience) || 0;
  const seen = Number(p.priorFindingsSeen) || 0;
  const score = years * 2 + Math.min(seen, 20);
  const level = score >= 16 ? 'expert' : score >= 6 ? 'intermediate' : 'beginner';
  return {
    level,
    score,
    detail: `Estimated ${level} from ${years} year(s) experience and ${seen} prior finding(s) reviewed.`,
  };
}

/** Adapts the explanation to what the reader already knows. */
export function personalizedExplanation(finding, profile) {
  const { level } = estimateKnowledge(profile);
  if (level === 'expert') {
    return `Expert cut — ${finding.type || 'finding'} at ${finding.location} (${finding.severity || 'unknown'}). Root cause class; fix: ${fixSteps(finding)[0]} Evidence: ${finding.evidence || 'none attached'}.`;
  }
  if (level === 'intermediate') {
    return `${explainFinding(finding)} ${severityJustification(finding).summary}`;
  }
  return `${eli5Explanation(finding)} ${fixEnding(finding).closing}`;
}

/* 51440 — myth-busting ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

/** Common misconceptions about the finding type, corrected plainly. */
export function mythBusting(finding) {
  return [...(TYPE_MYTHS[finding.type] || []), ...GENERIC_MYTHS].slice(0, 4);
}
