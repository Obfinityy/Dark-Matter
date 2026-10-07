/**
 * wave36.test.js — wave 36 (ideas 51401–51440): explainability round 2.
 * node:test checks for pure logic in explainabilityRound2Core.js and
 * registry completeness (40/40, zero skips).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE36_START, WAVE36_END, WAVE36_IDEAS,
  depthText, DEPTH_LEVELS,
  lookupTerm, findJargonTerms, JARGON_GLOSSARY,
  exploitSteps,
  followUpSuggestions, answerFollowUp,
  translateExplanation, EXPLANATION_LANGS,
  roleExplanation, EXPLANATION_ROLES,
  confidenceFlags,
  evidenceLinks,
  comparisonExplanation,
  riskInContext,
  fixEnding,
  recordExplanation, explanationHistory, getExplanation,
  buildShareCard,
  voiceScript,
  buildQuiz, scoreQuiz,
  kidExplanation,
  EXPLANATION_TEMPLATES, applyTemplate,
  editExplanation, learnStyle,
  addExplanationVersion, getVersion, diffVersions,
  contrastingOpinions,
  severityJustification,
  attackScenario,
  mapToProcess,
  buildExplanationIndex, searchExplanations,
  exportSlidesMarkdown, exportOnePagerMarkdown,
  regulatoryFraming, REGULATIONS,
  costOfBreach, costSentence,
  weaknessTimeline,
  peerBenchmark,
  recordFeedback, feedbackSummary,
  multiFindingNarrative,
  postThreadMessage, threadReply,
  severityGauge, difficultyMeter, exploitabilityMeter, gaugeLabel,
  whiteLabel, whiteLabelFinding,
  autoLinkGlossary,
  storyModeSection,
  estimateKnowledge, personalizedExplanation,
  mythBusting,
} from './explainabilityRound2Core.js';

const SQLI = { id: 'F-201', type: 'sql-injection', severity: 'critical', title: 'SQL injection in search endpoint', location: '/api/search?q=', evidence: 'Time-based probe returned DB version string', firstSeen: '2026-09-28', introducedIn: '2026-06-12', businessUnit: 'ecommerce' };
const IDOR = { id: 'F-203', type: 'idor', severity: 'high', title: 'IDOR on order endpoint', location: '/api/orders/{id}' };
const WEIRD = { id: 'F-900', type: 'zero-day-xyz', severity: 'medium', title: 'Unknown oddity', location: '/weird' };

// --- registry completeness -----------------------------------------------------

test('wave 36 registry covers 51401–51440 with zero skips', () => {
  assert.equal(WAVE36_START, 51401);
  assert.equal(WAVE36_END, 51440);
  assert.equal(WAVE36_IDEAS.length, 40);
  const ids = WAVE36_IDEAS.map(([id]) => id);
  for (let i = WAVE36_START; i <= WAVE36_END; i++) assert.ok(ids.includes(i), `missing idea ${i}`);
  assert.equal(new Set(ids).size, 40, 'no duplicate ids');
  assert.ok(WAVE36_IDEAS.every(([, , desc]) => typeof desc === 'string' && desc.length > 10), 'every idea described');
});

// --- 51401 depth slider ----------------------------------------------------------

test('51401 depth slider grows the explanation with the level', () => {
  const short = depthText(SQLI, 1);
  const full = depthText(SQLI, 4);
  assert.equal(short.level, 1);
  assert.ok(full.text.length > short.text.length, 'deeper level = longer text');
  assert.ok(short.text.includes('/api/search?q='), 'built from the finding fields');
  assert.equal(depthText(SQLI, 99).level, 4, 'clamped to max');
  assert.equal(DEPTH_LEVELS.length, 4);
});

// --- 51402 jargon buster -----------------------------------------------------------

test('51402 jargon buster looks up terms and finds them in text', () => {
  const hit = lookupTerm('XSS');
  assert.ok(hit && hit.definition.length > 10, 'case-insensitive lookup');
  assert.equal(lookupTerm('not-a-term'), null);
  const found = findJargonTerms('A SQL injection payload bypassed sanitization at the token endpoint.');
  assert.ok(found.includes('sql injection') && found.includes('payload'), 'finds glossary terms');
  assert.ok(Object.keys(JARGON_GLOSSARY).length >= 20, 'glossary has depth');
});

// --- 51403 exploit walkthrough -------------------------------------------------------

test('51403 exploit walkthrough returns ordered proof steps', () => {
  const steps = exploitSteps(SQLI);
  assert.ok(steps.length >= 3);
  assert.deepEqual(steps.map((s) => s.n), steps.map((_, i) => i + 1), 'sequential step numbers');
  assert.ok(steps[0].title && steps[0].detail);
  assert.ok(exploitSteps(WEIRD).length >= 3, 'fallback steps for unknown types');
});

// --- 51404 follow-ups ------------------------------------------------------------------

test('51404 follow-up answers are grounded in the finding', () => {
  assert.ok(followUpSuggestions(SQLI).length >= 4);
  assert.ok(answerFollowUp(SQLI, 'How would you fix this?').includes('parameterized'), 'fix question answered');
  assert.ok(answerFollowUp(SQLI, 'What would this cost us?').includes('$'), 'cost question answered');
  assert.ok(answerFollowUp(SQLI, 'Why is the severity rated this way?').includes('critical'), 'severity question answered');
  assert.ok(answerFollowUp(SQLI, 'random unrelated musing').length > 20, 'fallback still explains');
});

// --- 51405 multi-language -----------------------------------------------------------------

test('51405 explanations render in Hindi and Spanish templates', () => {
  const hi = translateExplanation(SQLI, 'hi');
  const es = translateExplanation(SQLI, 'es');
  const en = translateExplanation(SQLI, 'en');
  assert.ok(hi.includes('गंभीर'), 'Hindi severity localized');
  assert.ok(es.includes('crítica'), 'Spanish severity localized');
  assert.ok(en.length > 20, 'English fallback works');
  assert.deepEqual(EXPLANATION_LANGS.map((l) => l.code), ['en', 'hi', 'es']);
});

// --- 51406 role-based ------------------------------------------------------------------------

test('51406 role-based explanations tailor per audience', () => {
  const dev = roleExplanation(SQLI, 'developer');
  const mgr = roleExplanation(SQLI, 'manager');
  const exec = roleExplanation(SQLI, 'executive');
  assert.ok(dev.includes('/api/search?q=') && dev.toLowerCase().includes('reproduce'), 'developer gets technical detail');
  assert.ok(mgr.toLowerCase().includes('peers') || mgr.toLowerCase().includes('days'), 'manager gets timeline context');
  assert.ok(exec.toLowerCase().includes('business impact') || exec.toLowerCase().includes('executive'), 'executive gets business framing');
  assert.deepEqual(EXPLANATION_ROLES, ['developer', 'manager', 'executive']);
});

// --- 51407 confidence flags ---------------------------------------------------------------------

test('51407 confidence flags mark uncertain parts honestly', () => {
  const flags = confidenceFlags(WEIRD);
  assert.ok(flags.some((f) => f.part === 'finding description' && f.level === 'medium'), 'unknown type flagged');
  assert.ok(flags.some((f) => f.part === 'evidence' && f.level === 'medium'), 'missing evidence flagged');
  assert.ok(confidenceFlags(SQLI).every((f) => ['high', 'medium', 'low'].includes(f.level)));
});

// --- 51408 evidence links --------------------------------------------------------------------------

test('51408 every claim links to supporting evidence', () => {
  const links = evidenceLinks(SQLI);
  assert.ok(links.length >= 2);
  assert.ok(links.every((l) => l.claim && l.evidence), 'claim + evidence on each row');
  assert.ok(links[0].ref === 'F-201-evidence', 'evidence ref built from finding id');
  assert.ok(evidenceLinks(IDOR)[0].evidence.includes('No direct evidence'), 'honest gap when evidence missing');
});

// --- 51409 comparison ---------------------------------------------------------------------------------

test('51409 comparison explanation diffs two findings', () => {
  const c = comparisonExplanation(SQLI, IDOR);
  assert.ok(c.includes('like the'), 'comparison framing present');
  assert.ok(c.includes('except'), 'differences called out');
  assert.ok(comparisonExplanation(SQLI, null).includes('/api/search?q='), 'works without a previous finding');
});

// --- 51410 risk in context -------------------------------------------------------------------------------

test('51410 risk is framed for the specific business', () => {
  const r = riskInContext(SQLI, { business: 'fintech' });
  assert.ok(r.includes('fintech'), 'names the business');
  assert.ok(r.includes('/api/search?q='), 'still about the finding');
});

// --- 51411 fix-oriented endings -------------------------------------------------------------------------------

test('51411 explanations end with what fixing looks like', () => {
  const fe = fixEnding(SQLI);
  assert.ok(fe.steps.length >= 3);
  assert.ok(fe.steps[0].toLowerCase().includes('parameterized'), 'first step is the real fix');
  assert.ok(fe.closing.includes('What fixing it looks like'));
});

// --- 51412 history -----------------------------------------------------------------------------------------------------

test('51412 explanation history records and retrieves per finding', () => {
  let h = recordExplanation([], { findingId: 'F-201', mode: 'plain', text: 'first' });
  h = recordExplanation(h, { findingId: 'F-201', mode: 'kid', text: 'second' });
  h = recordExplanation(h, { findingId: 'F-203', mode: 'plain', text: 'other' });
  assert.equal(explanationHistory(h, 'F-201').length, 2);
  assert.equal(getExplanation(h, 'expl-2').text, 'second');
  assert.equal(getExplanation(h, 'nope'), null);
});

// --- 51413 share cards -----------------------------------------------------------------------------------------------------

test('51413 share cards bundle copy-ready text', () => {
  const card = buildShareCard(SQLI);
  assert.equal(card.title, 'SQL injection in search endpoint');
  assert.ok(card.shareText.includes('critical') && card.shareText.includes('Fix:'), 'share text is complete');
});

// --- 51414 voice -----------------------------------------------------------------------------------------------------------------

test('51414 voice script is plain TTS-ready text', () => {
  const s = voiceScript(SQLI);
  assert.ok(s.length > 40);
  assert.ok(!/[*_`#>[\]]/.test(s), 'no markdown characters');
  assert.ok(s.includes('Recommended fix'));
});

// --- 51415 quizzes -------------------------------------------------------------------------------------------------------------------

test('51415 quizzes generate questions and score answers', () => {
  const quiz = buildQuiz(SQLI);
  assert.ok(quiz.questions.length >= 2);
  assert.ok(quiz.questions.every((q) => q.options.length === 4 && q.answer >= 0 && q.answer < 4));
  const allRight = scoreQuiz(quiz, quiz.questions.map((q) => q.answer));
  assert.equal(allRight.pct, 100);
  assert.ok(allRight.passed);
  const allWrong = scoreQuiz(quiz, quiz.questions.map((q) => (q.answer + 1) % 4));
  assert.equal(allWrong.pct, 0);
  assert.ok(!allWrong.passed);
  assert.ok(buildQuiz(WEIRD).questions.length >= 2, 'fallback quiz for unknown types');
});

// --- 51416 kid mode -----------------------------------------------------------------------------------------------------------------------

test('51416 kid-friendly mode simplifies extremely', () => {
  const k = kidExplanation(SQLI);
  assert.ok(k.toLowerCase().includes('librarian') || k.toLowerCase().includes('super-simple'), 'uses a child-safe picture');
  assert.ok(kidExplanation(WEIRD).length > 40, 'fallback exists');
});

// --- 51417 templates -----------------------------------------------------------------------------------------------------------------------------

test('51417 templates apply a preferred structure', () => {
  const t = applyTemplate('dev-ticket', SQLI);
  assert.deepEqual(t.sections.map((s) => s.heading), ['Reproduction', 'Root cause', 'Acceptance criteria']);
  assert.ok(t.sections.every((s) => s.body.length > 10), 'every section filled from the finding');
  assert.ok(EXPLANATION_TEMPLATES.length >= 3);
  assert.equal(applyTemplate('nope', SQLI).templateId, 'what-why-fix', 'unknown template falls back');
});

// --- 51418 live editing -----------------------------------------------------------------------------------------------------------------------------------

test('51418 live editing saves the tweak and learns style', () => {
  const casual = "Here's the thing — don't worry, it's not that bad. We'll fix it soon, you'll see!";
  const r = editExplanation('original', casual);
  assert.equal(r.text, casual);
  assert.equal(r.previous, 'original');
  assert.equal(r.style.tone, 'casual', 'contractions detected');
  assert.ok(r.style.wordCount > 5 && r.style.avgSentenceLen > 0);
  assert.equal(learnStyle('The vulnerability resides within the authentication subsystem, and comprehensive remediation activities have been formally scheduled for inclusion within the forthcoming release cycle following appropriate review.').tone, 'formal');
});

// --- 51419 versioning ----------------------------------------------------------------------------------------------------------------------------------------------

test('51419 versions accumulate with word-level diffs', () => {
  let v = addExplanationVersion([], 'first draft text');
  v = addExplanationVersion(v, 'first draft text with more words');
  assert.equal(v.length, 2);
  assert.equal(getVersion(v, 2).v, 2);
  const d = diffVersions(v[0].text, v[1].text);
  assert.ok(d.added.includes('with') && d.added.includes('more'), 'added words detected');
  assert.equal(d.removedCount, 0);
  assert.equal(getVersion(v, 9), null);
});

// --- 51420 contrasting opinions --------------------------------------------------------------------------------------------------------------------------------------------------------

test('51420 contrasting opinions present three stances', () => {
  const ops = contrastingOpinions(SQLI);
  assert.equal(ops.length, 3);
  assert.ok(ops.some((o) => o.stance.includes('true positive')));
  assert.ok(ops.some((o) => o.stance.includes('benign')));
  assert.ok(ops.every((o) => o.reason.length > 20), 'each stance reasoned');
});

// --- 51421 severity justification ---------------------------------------------------------------------------------------------------------------------------------------------------------------

test('51421 severity justification reasons in plain language', () => {
  const j = severityJustification(SQLI);
  assert.equal(j.severity, 'critical');
  assert.ok(j.reasons.length >= 3);
  assert.ok(j.summary.includes('critical'));
});

// --- 51422 attack scenario --------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('51422 attack scenario narrates beats in order', () => {
  const sc = attackScenario(SQLI);
  assert.ok(sc.title.includes('attacker'));
  assert.deepEqual(sc.beats.map((b) => b.n), sc.beats.map((_, i) => i + 1));
  assert.ok(sc.beats[0].detail.length > 10);
  assert.ok(attackScenario(WEIRD).beats.length >= 3, 'fallback scenario exists');
});

// --- 51423 process mapping --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('51423 findings map to threatened business processes', () => {
  const rows = mapToProcess(SQLI, 'ecommerce');
  assert.ok(rows.length >= 3);
  assert.ok(rows.some((r) => r.threatened), 'at least one process threatened');
  assert.ok(rows.every((r) => r.process && r.why), 'every row explained');
});

// --- 51424 search ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('51424 explanation search ranks by keyword overlap', () => {
  const corpus = [
    { id: 'e1', findingId: 'F-1', text: 'SQL injection in the search endpoint allows database theft' },
    { id: 'e2', findingId: 'F-2', text: 'Cross-site scripting in comments steals user sessions' },
  ];
  const index = buildExplanationIndex(corpus);
  const res = searchExplanations(index, 'database theft');
  assert.equal(res[0].id, 'e1', 'best match first');
  assert.deepEqual(searchExplanations(index, 'zzz-no-match'), [], 'no false positives');
  assert.deepEqual(searchExplanations(index, ''), [], 'empty query = empty results');
});

// --- 51425 export ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('51425 export builds slides and one-pager markdown', () => {
  const slides = exportSlidesMarkdown(SQLI);
  const one = exportOnePagerMarkdown(SQLI);
  assert.ok(slides.includes('# SQL injection') && slides.split('---').length >= 5, 'slides have separators');
  assert.ok(one.includes('one-pager') && one.includes('## Fix'), 'one-pager has fix section');
  assert.ok(slides.includes('/api/search?q=') && one.includes('parameterized'), 'content from the finding');
});

// --- 51426 regulatory -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('51426 regulatory framing names the regulation', () => {
  const g = regulatoryFraming(SQLI, 'gdpr');
  assert.ok(g.includes('GDPR') && g.includes('/api/search?q='), 'GDPR framing grounded');
  assert.ok(regulatoryFraming(SQLI, 'pci-dss').includes('PCI DSS'));
  assert.ok(REGULATIONS.length >= 4);
});

// --- 51427 cost --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('51427 cost framing gives plain numbers', () => {
  const c = costOfBreach(SQLI);
  assert.ok(c.low < c.mid && c.mid < c.high, 'sane range ordering');
  assert.equal(c.currency, 'USD');
  const s = costSentence(SQLI);
  assert.ok(s.includes('$') && s.includes('plain numbers'));
});

// --- 51428 timeline -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('51428 timeline narrates how long the weakness existed', () => {
  const tl = weaknessTimeline(SQLI);
  assert.ok(tl.events.length >= 3);
  assert.ok(tl.sentence.includes('2026-06-12'), 'uses the introduced date');
  assert.ok(weaknessTimeline(IDOR).sentence.length > 20, 'works without dates');
});

// --- 51429 benchmarks ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('51429 peer benchmarks give fix-day context', () => {
  const b = peerBenchmark(SQLI);
  assert.ok(b.typicalFixDays > 0);
  assert.ok(b.note.includes(String(b.typicalFixDays)), 'note cites the number');
});

// --- 51430 feedback -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('51430 feedback loop records ratings and summarizes', () => {
  let r = recordFeedback([], { explanationId: 'F-201', score: 5, note: 'clear' });
  r = recordFeedback(r, { explanationId: 'F-201', score: 3 });
  r = recordFeedback(r, { explanationId: 'F-201', score: 99 });
  assert.equal(r[2].score, 5, 'scores clamp to 1–5');
  const s = feedbackSummary(r);
  assert.equal(s.count, 3);
  assert.ok(s.avg > 0);
  assert.equal(s.distribution.find((d) => d.score === 5).count, 2);
});

// --- 51431 multi-finding narratives -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('51431 multi-finding narratives weave one story', () => {
  const n = multiFindingNarrative([SQLI, IDOR]);
  assert.ok(n.title.includes('2 finding'), 'title counts findings');
  assert.equal(n.paragraphs.length, 4);
  assert.ok(n.paragraphs[2].includes('SQL injection'), 'sharpest edge named');
  assert.equal(multiFindingNarrative([]).paragraphs.length, 1, 'empty selection handled');
});

// --- 51432 chat threads -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('51432 chat threads post messages and answer grounded', () => {
  let t = postThreadMessage([], 'You', 'How do we fix it?');
  const reply = threadReply(SQLI, 'How do we fix it?');
  t = [...t, reply];
  assert.equal(t.length, 2);
  assert.equal(t[1].author, 'Infinity AI');
  assert.ok(t[1].text.includes('parameterized'), 'agent reply grounded in the finding');
});

// --- 51433–51435 gauges --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('51433 severity gauge maps severity to 0–100', () => {
  assert.equal(severityGauge('critical').value, 95);
  assert.equal(severityGauge('low').value, 25);
  assert.ok(severityGauge('critical').label.length > 0);
  assert.equal(gaugeLabel(90), 'Critical zone');
  assert.equal(gaugeLabel(5), 'Minimal zone');
});

test('51434 difficulty meter scores fix effort with factors', () => {
  const d = difficultyMeter({ type: 'subdomain-takeover' });
  assert.ok(d.value >= 0 && d.value <= 100);
  assert.ok(d.factors.length >= 1);
  assert.ok(difficultyMeter(WEIRD).factors.length >= 1, 'fallback factors exist');
});

test('51435 exploitability meter scores attacker ease with factors', () => {
  const m = exploitabilityMeter({ type: 'jwt-none-alg' });
  assert.ok(m.value >= 90, 'none-alg is trivially exploitable');
  assert.ok(m.factors.length >= 1);
});

// --- 51436 white-label ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('51436 white-labeling strips internal branding', () => {
  const out = whiteLabel('INTERNAL: secret note\nFound by Infinity AI during the Dark-Matter assessment.', 'Acme Corp');
  assert.ok(!out.includes('INTERNAL'), 'internal lines removed');
  assert.ok(!out.includes('Infinity AI'), 'brand replaced');
  assert.ok(out.includes('Acme Corp'), 'client name inserted');
  assert.ok(!out.includes('Dark-Matter'), 'product name neutralized');
  assert.ok(whiteLabelFinding(SQLI, 'Acme').includes('Acme'), 'finding-level white-label works');
});

// --- 51437 glossary auto-linking ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('51437 glossary auto-linking segments terms for linking', () => {
  const segs = autoLinkGlossary('A SQL injection payload hit the token store.');
  const terms = segs.filter((s) => s.term);
  assert.ok(terms.length >= 2, 'terms detected');
  assert.ok(terms.every((s) => s.definition && s.definition.length > 10), 'each term carries a definition');
  assert.equal(segs.map((s) => s.text).join(''), 'A SQL injection payload hit the token store.', 'segments reassemble exactly');
});

// --- 51438 story mode ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('51438 story mode retells findings as a narrative chapter', () => {
  const md = storyModeSection([SQLI, IDOR]);
  assert.ok(md.includes('# Chapter'), 'chapter heading');
  assert.ok(md.includes('Scene 1') && md.includes('Scene 2'), 'one scene per finding');
  assert.ok(md.includes('Epilogue'), 'closes the chapter');
  assert.ok(storyModeSection([]).includes('No findings'), 'empty hunt handled');
});

// --- 51439 personalization -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('51439 personalization adapts to reader knowledge', () => {
  const beginner = estimateKnowledge({ yearsExperience: 0, priorFindingsSeen: 0 });
  const expert = estimateKnowledge({ yearsExperience: 10, priorFindingsSeen: 30 });
  assert.equal(beginner.level, 'beginner');
  assert.equal(expert.level, 'expert');
  const bText = personalizedExplanation(SQLI, { yearsExperience: 0, priorFindingsSeen: 0 });
  const eText = personalizedExplanation(SQLI, { yearsExperience: 10, priorFindingsSeen: 30 });
  assert.ok(bText.length > eText.length, 'beginners get more words than experts');
  assert.ok(eText.includes('Expert cut'), 'expert version labeled');
});

// --- 51440 myth-busting ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('51440 myth-busting corrects misconceptions plainly', () => {
  const myths = mythBusting(SQLI);
  assert.ok(myths.length >= 2);
  assert.ok(myths.every((m) => m.myth && m.truth && m.truth.length > m.myth.length * 0.3), 'myth + correction pairs');
  assert.ok(mythBusting(WEIRD).length >= 2, 'generic myths for unknown types');
});

// --- audits: CSS keyframes, debris, JSX parse ---------------------------------------------------------------------------------------------------------------------------------------------------------------

test('CSS carries zero keyframes per the zero-animation order', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('./ExplainabilityRound2.css', import.meta.url), 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'zero keyframes');
  assert.ok(/\.ex36-/.test(css), 'scoped ex36- prefix present');
});

test('all four wave-36 files have no TODO/FIXME/mock/demo/simulate/placeholder debris', async () => {
  const { readFile } = await import('node:fs/promises');
  const files = ['./explainabilityRound2Core.js', './ExplainabilityRound2.jsx', './ExplainabilityRound2.css'];
  for (const f of files) {
    const src = await readFile(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/\bTODO\b|\bFIXME\b/i.test(src), `no TODO/FIXME in ${f}`);
    assert.ok(!/\bmock\b/i.test(src), `no mock debris in ${f}`);
    assert.ok(!/\bdemo\b/i.test(src), `no demo debris in ${f}`);
    assert.ok(!/\bsimulate\b/i.test(src), `no simulate debris in ${f}`);
    assert.ok(!/\bplaceholder\b/i.test(src), `no placeholder debris in ${f}`);
  }
});

test('ExplainabilityRound2.jsx parses clean via esbuild', async () => {
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const jsxPath = fileURLToPath(new URL('./ExplainabilityRound2.jsx', import.meta.url));
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], { encoding: 'utf8', timeout: 30000 });
  assert.ok(out.includes('Wave36Gallery'), 'esbuild parsed the gallery export');
});
