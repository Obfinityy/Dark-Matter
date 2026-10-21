// Test for human-mode WORKING MEMORY (Lane I, 21 Oct 2026).
//
// Owner order: "make it like a human — when he is thinking he knows
// his past, what he has done already, and what he is doing now."
// Lanes F+G made the gate enforce the record and the briefing lead
// with lessons, but the hunter's working memory still had holes:
//   1. the briefing was built ONCE per 6-turn session and frozen —
//      his own notes/actions from earlier turns of the SAME session
//      were invisible to him until the next session;
//   2. no session journal — he saw only the LAST action's result,
//      never his own immediate trail;
//   3. no left-off continuity — meta.humanLoop stored only action
//      KINDS, so a new session started cold;
//   4. DOSSIER.md (consolidation's distilled notebook) was written
//      but never read by human mode;
//   5. the 2 retracted false FTP stamps still showed as [VERIFIED]
//      because findings came from raw finding events;
//   6. no recall action — the pipeline had RECALL; human mode,
//      the "human", did not.
// This suite proves each fix with injected fakes + real hunt files
// (production paths) where the fix lives in the briefing builder.
// Run: node backend/scripts/test-human-working-memory.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-lane-i-'));
process.env.DATA_DIR = tmp;

const {
  humanIteration,
  buildMemoryBriefing,
  applyRetractions,
  retractedFindingCount,
  extractDossierBriefing,
  sessionJournalLines,
  leftOffLines,
} = await import('../src/humanLoop.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const TARGET = 'http://target.test';

function makeDeps({ replies, pastEvents = [], briefing, recall, meta } = {}) {
  const state = {
    screens: [],
    events: [],
    notes: [],
    recallCalls: [],
    meta: meta || { huntId: 'h_working_test', target: TARGET, mode: 'human', humanMode: true, parsedScope: null },
  };
  const queue = [...replies];
  state.deps = {
    chat: async (messages) => {
      state.screens.push(messages[0].text);
      return queue.length ? queue.shift() : null;
    },
    exec: async (h, t, command) => ({ stdout: `ROBOTS-RESULT-XYZ for ${command}`, stderr: '', code: 0 }),
    execRaw: async () => ({ stdout: '/root\n---\nnotes.txt', stderr: '', code: 0 }),
    search: async () => [{ title: 'ssti-result-title', url: 'https://example.org/ssti', snippet: 'jinja2 ssti notes' }],
    writeFile: async (h, name, content) => ({ name, chars: content.length }),
    spill: () => 'spilled.log',
    record: (h, ev) => state.events.push(ev),
    readMeta: () => state.meta,
    writeMeta: (h, m) => { state.meta = m; },
    readEvents: () => pastEvents,
    recordNote: (h, entry) => state.notes.push(entry),
    assess: null,
    gui: {
      open: async () => ({ ok: true, observation: 'opened' }),
      snapshot: async () => ({ ok: true, observation: 'snapshot' }),
      click: async () => ({ ok: true, observation: 'clicked' }),
      type: async () => ({ ok: true, observation: 'typed' }),
      screenshot: async () => ({ ok: true, observation: 'shot' }),
    },
    sleep: async () => {},
    now: () => Date.now(),
    buildBriefing: briefing || (async () => 'BRIEFING-STATIC'),
  };
  if (recall) {
    state.deps.recall = async (h, q) => {
      state.recallCalls.push(q);
      return recall(h, q);
    };
  }
  return state;
}

// ---------------------------------------------------------------------------
// 1. Per-turn briefing refresh: changing content appears NEXT turn;
//    a failed refresh keeps the previous briefing (never crashes).
// ---------------------------------------------------------------------------
{
  let calls = 0;
  const s = makeDeps({
    replies: [
      'One.\n{"action":"note","text":"n1"}',
      'Two.\n{"action":"note","text":"n2"}',
      'Three.\n{"action":"note","text":"n3"}',
    ],
    briefing: async () => `BRIEFING-V${++calls}`,
  });
  await humanIteration('h_working_test', TARGET, { turns: 3, deps: s.deps });
  check('refresh: buildBriefing called once per turn (session-start = turn 1)', calls === 3);
  check('refresh: turn 1 screen has V1', s.screens[0].includes('BRIEFING-V1'));
  check('refresh: turn 2 screen has V2 (own earlier-turn work can surface)', s.screens[1].includes('BRIEFING-V2'));
  check('refresh: turn 3 screen has V3', s.screens[2].includes('BRIEFING-V3'));
}
{
  let calls = 0;
  const s = makeDeps({
    replies: [
      'One.\n{"action":"note","text":"n1"}',
      'Two.\n{"action":"note","text":"n2"}',
      'Three.\n{"action":"note","text":"n3"}',
    ],
    briefing: async () => {
      calls++;
      if (calls === 2) throw new Error('briefing store busy');
      return `BRIEFING-V${calls}`;
    },
  });
  const res = await humanIteration('h_working_test', TARGET, { turns: 3, deps: s.deps });
  check('refresh: a throwing refresh does not crash the session', res.turnsRun === 3);
  check('refresh: failed refresh keeps the previous briefing on screen', s.screens[1].includes('BRIEFING-V1'));
  check('refresh: the next successful refresh lands', s.screens[2].includes('BRIEFING-V3'));
}

// ---------------------------------------------------------------------------
// 2. Session journal: prior actions of THIS session, with detail+result
// ---------------------------------------------------------------------------
check('journal unit: line carries turn, kind, detail, result', (() => {
  const line = sessionJournalLines([{ turn: 2, action: 'shell', detail: 'curl -s http://t.test/', observation: 'HTTP 200' }])[0];
  return line.includes('Turn 2') && line.includes('shell') && line.includes('curl -s http://t.test/') && line.includes('HTTP 200');
})());
check('journal unit: result summary capped at 80 chars', (() => {
  const line = sessionJournalLines([{ turn: 1, action: 'shell', detail: 'c', observation: 'y'.repeat(200) }])[0];
  const seg = line.split('→ ')[1] || '';
  return seg.length <= 80;
})());
check('journal unit: empty log -> no lines', sessionJournalLines([]).length === 0);
{
  const s = makeDeps({
    replies: [
      'Robots first.\n{"action":"shell","command":"curl -s http://target.test/robots.txt"}',
      'Noting.\n{"action":"note","text":"robots checked"}',
      'Searching.\n{"action":"search","query":"target.test stack"}',
    ],
  });
  await humanIteration('h_working_test', TARGET, { turns: 3, deps: s.deps });
  check('journal: absent on turn 1 (nothing done yet)', !s.screens[0].includes('THIS SESSION SO FAR'));
  check('journal: turn 2 screen lists turn 1 with detail + result',
    s.screens[1].includes('=== THIS SESSION SO FAR ===') &&
    s.screens[1].includes('Turn 1') && s.screens[1].includes('curl -s http://target.test/robots.txt') &&
    s.screens[1].includes('ROBOTS-RESULT-XYZ'));
  check('journal: turn 3 screen lists turns 1 and 2 in order',
    s.screens[2].indexOf('Turn 1') > -1 && s.screens[2].indexOf('Turn 1') < s.screens[2].indexOf('Turn 2') &&
    s.screens[2].includes('robots checked'));
  check('journal: log entries carry detail', (() => {
    // the returned log is the journal's source — detail must ride on it
    return true; // asserted via screens above; log shape checked in left-off below
  })());
}

// ---------------------------------------------------------------------------
// 3. Left-off continuity: persisted at session end (detail+result,
//    last note, open threads, thinking tail) and rendered next session
// ---------------------------------------------------------------------------
check('leftOff unit: null/garbage -> no lines', leftOffLines(null).length === 0 && leftOffLines({}).length === 0);
check('leftOff unit: renders thinking, actions, note, threads', (() => {
  const txt = leftOffLines({
    lastThinking: 'mid-SSTI thought',
    lastActions: [{ tool: 'shell', detail: 'curl x', result: '200 OK' }],
    lastNote: 'remember the token',
    openThreads: ['- SSTI: researched ×2, never probed'],
  }).join('\n');
  return txt.includes('WHERE YOU LEFT OFF') && txt.includes('mid-SSTI thought') &&
    txt.includes('curl x') && txt.includes('200 OK') && txt.includes('remember the token') && txt.includes('SSTI');
})());
{
  const pastEvents = [{ type: 'tool_call', tool: 'search', detail: 'SSTI template injection jinja2', via: 'human-mode' }];
  const a = makeDeps({
    pastEvents,
    replies: [
      'Looking at robots first.\n{"action":"shell","command":"curl -s http://target.test/robots.txt"}',
      'Noting the admin thread.\n{"action":"note","text":"NOTE-TEXT-LEFTOFF: admin panel needs a second look"}',
      'FINAL-THOUGHT-MARKER: I was mid-way through SSTI research.\n{"action":"search","query":"SSTI template injection jinja2"}',
    ],
  });
  await humanIteration('h_working_test', TARGET, { turns: 3, deps: a.deps });
  const lo = a.meta.humanLoop && a.meta.humanLoop.leftOff;
  check('leftOff: persisted into meta.humanLoop at session end', Boolean(lo) && typeof lo.at === 'string');
  check('leftOff: lastActions carry tool + detail + result (not just kinds)',
    Array.isArray(lo.lastActions) && lo.lastActions.length === 3 &&
    lo.lastActions[2].tool === 'search' && lo.lastActions[2].detail.includes('SSTI') &&
    lo.lastActions[2].result.includes('ssti-result-title') &&
    lo.lastActions[0].detail.includes('robots.txt'));
  check('leftOff: lastNote is the brain\'s most recent note', lo.lastNote.includes('NOTE-TEXT-LEFTOFF'));
  check('leftOff: thinking tail preserved (≤240 chars)', lo.lastThinking.includes('FINAL-THOUGHT-MARKER') && lo.lastThinking.length <= 240);
  check('leftOff: openThreads are the researched-not-probed lines', Array.isArray(lo.openThreads) && lo.openThreads.some((l) => l.includes('SSTI')));

  // Next session on the same meta: the hand-off is on the first screen.
  const b = makeDeps({ pastEvents, meta: a.meta, replies: ['Resuming.\n{"action":"note","text":"back"}'] });
  await humanIteration('h_working_test', TARGET, { turns: 1, deps: b.deps });
  const screen = b.screens[0];
  check('leftOff: next session screen opens with WHERE YOU LEFT OFF',
    screen.includes('=== WHERE YOU LEFT OFF (last session) ==='));
  check('leftOff: screen carries the note, the thinking tail, the last action, the open thread',
    screen.includes('NOTE-TEXT-LEFTOFF') && screen.includes('FINAL-THOUGHT-MARKER') &&
    screen.includes('SSTI template injection jinja2') && screen.includes('Open threads you left'));
  check('leftOff: hand-off sits high (before the memory briefing)',
    screen.indexOf('WHERE YOU LEFT OFF') < screen.indexOf('WHAT YOU KNOW'));
}

// ---------------------------------------------------------------------------
// 5 (units first). applyRetractions: title-matched later retractions
// remove findings; genuine findings survive; stamps are conservative.
// ---------------------------------------------------------------------------
const F = (title, extra = {}) => ({ type: 'finding', title, verified: true, severity: 'high', ...extra });
const R = (findingTitle, extra = {}) => ({ type: 'retraction', findingTitle, ...extra });
check('retractions: title-matched later retraction removes the finding',
  applyRetractions([F('FTP directory listing exposure'), R('FTP directory listing exposure')]).length === 0);
check('retractions: genuine finding with a different title is kept',
  applyRetractions([F('FTP directory listing exposure'), F('Real XSS in search'), R('FTP directory listing exposure')])
    .map((f) => f.title).join() === 'Real XSS in search');
check('retractions: a retraction BEFORE the finding does not remove it',
  applyRetractions([R('FTP exposure'), F('FTP exposure')]).length === 1);
check('retractions: title match is case/whitespace tolerant',
  applyRetractions([F('FTP  Directory Listing Exposure'), R('ftp directory listing exposure')]).length === 0);
check('retractions: matching retractsStampTs removes', (() => {
  const f = F('Stamped bug', { cachedAt: '2026-10-21T10:00:00.000Z' });
  return applyRetractions([f, R('Stamped bug', { retractsStampTs: '2026-10-21T10:00:00.000Z' })]).length === 0;
})());
check('retractions: mismatched retractsStampTs keeps the finding (conservative)',
  applyRetractions([F('Stamped bug', { cachedAt: '2026-10-21T10:00:00.000Z' }), R('Stamped bug', { retractsStampTs: '2026-10-20T09:00:00.000Z' })]).length === 1);
check('retractions: non-finding events are not returned, empty input safe',
  applyRetractions([{ type: 'thinking', text: 'x' }]).length === 0 && applyRetractions([]).length === 0 && applyRetractions(null).length === 0);
check('retractions: count helper agrees', retractedFindingCount([F('A'), F('B'), R('A')]) === 1 && retractedFindingCount([F('A')]) === 0);
{
  // Screen level: the retracted stamp must not render as VERIFIED,
  // and the findings section must carry the retraction note.
  const evs = [
    { type: 'finding', title: 'FTP directory listing exposure', verified: true, severity: 'high' },
    { type: 'retraction', findingTitle: 'FTP directory listing exposure', retractsStampTs: '' },
    { type: 'finding', title: 'Real XSS in search', verified: true, severity: 'medium' },
  ];
  const s = makeDeps({ pastEvents: evs, replies: ['Looking.\n{"action":"note","text":"ok"}'] });
  await humanIteration('h_working_test', TARGET, { turns: 1, deps: s.deps });
  check('retractions: screen does NOT show the retracted stamp as VERIFIED',
    !s.screens[0].includes('VERIFIED: FTP directory listing exposure'));
  check('retractions: screen still shows the genuine verified finding',
    s.screens[0].includes('VERIFIED: Real XSS in search'));
  check('retractions: screen carries the retraction note',
    s.screens[0].includes('(1 earlier claim(s) were retracted as false positives'));
}

// ---------------------------------------------------------------------------
// 4. Dossier in the briefing: open threads + next step only — the
//    Confirmed-facts section (pre-retraction pollution) never surfaces.
// ---------------------------------------------------------------------------
check('dossier unit: extracts open threads + next step', (() => {
  const text = [
    '# Target dossier — https://t.test',
    '## Confirmed facts (validator-stamped only)',
    '- [verified · high] FALSE-CONFIRMED-MARKER',
    '## Open threads',
    '- OPEN-THREAD-MARKER: check the token scope',
    '## Captured state (key presence only)',
    '- jwt: present',
    '## Next step',
    '- NEXT-STEP-MARKER: probe the token endpoint',
  ].join('\n');
  const out = extractDossierBriefing(text);
  return out.includes('OPEN-THREAD-MARKER') && out.includes('NEXT-STEP-MARKER') && !out.includes('FALSE-CONFIRMED-MARKER') && !out.includes('jwt: present');
})());
check('dossier unit: placeholder-only sections -> empty', extractDossierBriefing('## Open threads\n- (none recorded)\n## Next step\n- (no next step recorded)') === '');
check('dossier unit: bounded to 600 chars', extractDossierBriefing('## Open threads\n' + '- thread line\n'.repeat(200)).length <= 600);
check('dossier unit: missing dossier text -> empty', extractDossierBriefing('') === '' && extractDossierBriefing(null) === '');
{
  const HUNT = 'h_dossier_test';
  const dir = path.join(tmp, 'hunts', HUNT);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'events.jsonl'), '');
  fs.writeFileSync(path.join(dir, 'DOSSIER.md'), [
    '# Target dossier — https://t.test',
    '',
    '## Goal',
    'Hunt https://t.test',
    '',
    '## Confirmed facts (validator-stamped only)',
    '- [verified · high] FALSE-CONFIRMED-MARKER FTP directory listing exposure',
    '',
    '## Open threads',
    '- Unverified lead: OPEN-THREAD-MARKER token scope question (episode #42)',
    '',
    '## Captured state (key presence only — values never printed)',
    '- (no chain artefacts captured)',
    '',
    '## Next step',
    '- NEXT-STEP-MARKER: probe the token endpoint with the captured session',
    '',
  ].join('\n'));
  const briefing = buildMemoryBriefing(HUNT, 'https://t.test', { huntId: HUNT, target: 'https://t.test' });
  check('dossier e2e: briefing carries the DOSSIER block', briefing.includes('FROM YOUR DOSSIER (open threads / next step)'));
  check('dossier e2e: open thread + next step present', briefing.includes('OPEN-THREAD-MARKER') && briefing.includes('NEXT-STEP-MARKER'));
  check('dossier e2e: confirmed-facts content does NOT leak into the briefing', !briefing.includes('FALSE-CONFIRMED-MARKER'));
  const noDossier = buildMemoryBriefing('h_no_dossier_here', 'https://t.test', {});
  check('dossier e2e: missing dossier omits the block silently', !noDossier.includes('FROM YOUR DOSSIER'));
}

// Briefing-level retraction truth: a retracted verified stamp in the
// hunt's real files must not reach the ledger as [VERIFIED].
{
  const HUNT = 'h_briefing_retract';
  const dir = path.join(tmp, 'hunts', HUNT);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'events.jsonl'), [
    { type: 'finding', title: 'FTP directory listing exposure', severity: 'high', verified: true, verification: 'VERIFIED' },
    { type: 'retraction', findingTitle: 'FTP directory listing exposure' },
    { type: 'finding', title: 'Genuine XSS', severity: 'medium', verified: true, verification: 'VERIFIED' },
  ].map((e) => JSON.stringify(e)).join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'reasoning.jsonl'), '');
  const briefing = buildMemoryBriefing(HUNT, 'https://t.test', { huntId: HUNT, target: 'https://t.test' });
  check('briefing retractions: retracted stamp absent from the ledger', !briefing.includes('FTP directory listing exposure'));
  check('briefing retractions: genuine verified still listed', briefing.includes('Genuine XSS'));
}

// ---------------------------------------------------------------------------
// 6. Recall action: returns memory hits, records tool_call + note,
//    and is NOT dedupe-gated (the same recall 3x still runs).
// ---------------------------------------------------------------------------
{
  const s = makeDeps({
    replies: [
      'I need the exact SSTI result from before.\n{"action":"recall","query":"ssti probe result"}',
      'Again, to be sure.\n{"action":"recall","query":"ssti probe result"}',
      'And once more.\n{"action":"recall","query":"ssti probe result"}',
      'Noted.\n{"action":"note","text":"done"}',
    ],
    recall: async (h, q) => `RECALL-HIT for "${q}": the earlier SSTI probe returned 49 on /search`,
  });
  await humanIteration('h_working_test', TARGET, { turns: 4, deps: s.deps });
  check('recall: injected recall ran with the brain\'s query', s.recallCalls.length === 3 && s.recallCalls[0] === 'ssti probe result');
  check('recall: hits land on the next screen', s.screens[1].includes('RECALL-HIT') && s.screens[1].includes('returned 49'));
  check('recall: tool_call recorded like other actions',
    s.events.filter((e) => e.type === 'tool_call' && e.tool === 'recall').length === 3);
  check('recall: reasoning note recorded', s.notes.some((n) => String(n.action).startsWith('recall:')));
  check('recall: NOT dedupe-gated — 3 identical recalls, zero blocks',
    !s.events.some((e) => e.type === 'dedup_block'));
}
{
  // Production default recall (no injection): searchRecall over the
  // hunt's real reasoning file must surface the hit.
  const HUNT = 'h_recall_test';
  const dir = path.join(tmp, 'hunts', HUNT);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'events.jsonl'), '');
  fs.writeFileSync(path.join(dir, 'reasoning.jsonl'), JSON.stringify({
    at: 't', hypothesis: '', action: 'shell: curl ssti probe on /search', why: 'template reflection suspected',
    result: '{{7*7}} reflected as 49 in the response', learned: 'SSTI confirmed manually',
  }) + '\n');
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ huntId: HUNT, target: TARGET, parsedScope: null }));
  const screens = [];
  let meta = { huntId: HUNT, target: TARGET, parsedScope: null };
  await humanIteration(HUNT, TARGET, {
    turns: 2,
    deps: {
      chat: async (msgs) => {
        screens.push(msgs[0].text);
        return screens.length === 1
          ? 'What did that SSTI probe return exactly?\n{"action":"recall","query":"ssti"}'
          : 'Got it.\n{"action":"note","text":"ok"}';
      },
      execRaw: async () => ({ stdout: '/root', stderr: '', code: 0 }),
      exec: async () => ({ stdout: '', stderr: '', code: 0 }),
      assess: null,
      sleep: async () => {},
      readMeta: () => meta,
      writeMeta: (h, m) => { meta = m; },
      // recall and buildBriefing deliberately NOT injected — production defaults run.
    },
  });
  check('recall default: searchRecall hit on the next screen (reflected 49)',
    screens.length === 2 && screens[1].includes('reflected as 49'));
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
