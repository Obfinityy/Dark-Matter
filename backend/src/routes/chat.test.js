// Chat steering detection (Lane S follow-up, 24 Oct 2026).
//
// "kitni mili ab tak?" — the owner's mid-hunt status question —
// missed the English-only summary patterns, fell to the LLM path,
// and queued behind the hunt's own generations on the shared 8B
// model: no reply in 147s in the live browser check, and an earlier
// question died after ~5 min with the backend-unreachable error
// (nginx 300s). Status questions must route to the instant
// deterministic summary, never the brain queue.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectSteering,
  detectChatLanguage,
  isBareTell,
  sanitizeHistory,
  summaryReply,
  buildHuntSystemPrompt,
  huntContextLine,
  busyLine,
  fallbackLine,
  ackTextForHunt,
} from './chat.js';

test('hinglish status questions route to summary', () => {
  for (const q of [
    'kitni mili ab tak?',
    'kitni mili?',
    'kitne mile ab tak',
    'kya mila?',
    'kuch mila?',
    'ab tak kya mila',
    'kahan tak pahunche',
  ]) {
    assert.equal(detectSteering(q), 'summary', q);
  }
});

// REAL-HUMAN (26 Oct 2026): thinking/doing questions are NOT
// status — they used to route to the summary and got the canned
// shape the owner complained about. They now fall through to the
// open-question path, where a running hunt queues them for the
// brain's next turn.
test('thinking/doing questions fall through to the brain (not summary)', () => {
  for (const q of [
    // The owner's exact live questions (03:24–03:26Z, 08:21Z 26 Oct).
    'Abhi kya progress h.', // has "progress" — still status
    'To fir aage ka kya kaam h',
    'Now what are you thinking',
    'What are you doing now',
    'so what is now doing by you and what you thinking now?',
    "what's going on",
    'what is happening',
    'what are you thinking now',
    'what are you doing right now?',
    'kya chal raha hai',
    'kya ho raha hai',
    'kya kar raha hai',
    'kya try kiya ab tak',
    'क्या चल रहा है',
    'क्या हो रहा है',
    'क्या कर रहे हो',
    'अभी क्या कर रहे हो',
    'तुम क्या कर रहे हो',
  ]) {
    if (q === 'Abhi kya progress h.') {
      assert.equal(detectSteering(q), 'summary', q);
    } else {
      assert.equal(detectSteering(q), null, q);
    }
  }
});

test("owner's bare-tell phrasings still route to summary", () => {
  for (const q of ['bata', 'batao']) {
    assert.equal(detectSteering(q), 'summary', q);
  }
});

test('english steering/summary still works', () => {
  assert.equal(detectSteering('what did you find?'), 'summary');
  assert.equal(detectSteering('what is the status'), 'summary');
  assert.equal(detectSteering('pause the hunt'), 'pause');
  assert.equal(detectSteering('resume the hunt'), 'resume');
  assert.equal(detectSteering('stop the hunt'), 'stop');
});

test('open questions still fall through to the LLM (not summary)', () => {
  for (const q of [
    'how does XSS work on this site',
    'explain the login flow',
    'kya ye site vulnerable hai',
    'mujhe ek joke sunao',
  ]) {
    assert.equal(detectSteering(q), null, q);
  }
});

// CHAT-ANSWERS (26 Oct 2026): Devanagari status questions — the
// owner's speech-to-text default. Until this lane the instant-answer
// system was Latin-script-only, so every Devanagari message fell to
// the LLM path and queued behind hunt turns.
test('devanagari status questions route to summary', () => {
  for (const q of [
    'कितनी मिली अब तक?',
    'कितने मिले?',
    'क्या मिला?',
    'कुछ मिला?',
    'अब तक क्या मिला',
    'कहाँ तक पहुँचे',
    'बता',
    'बताओ',
  ]) {
    assert.equal(detectSteering(q), 'summary', q);
  }
});

test('bare tell routes to summary; a real question containing bata does not', () => {
  for (const q of ['bata', 'batao', 'bata?', 'batao na', 'बता', 'बताओ', 'बता?']) {
    assert.equal(detectSteering(q), 'summary', q);
    assert.equal(isBareTell(q), true, q);
  }
  for (const q of [
    'bata fir jau sone?',
    'बता फिर सोने जाऊँ?',
    'batao mujhe XSS kaise kaam karta hai',
    'batao mujhe login kaise karte hain',
  ]) {
    assert.equal(detectSteering(q), null, q);
    assert.equal(isBareTell(q), false, q);
  }
});

// REAL-HUMAN (26 Oct 2026): the queued-question ack is built
// from the last reasoning row — the brain's actual last action,
// where it ran, how long ago — and must never be the summary
// shape (no status line, no counts, no "early recon", no round).
test('ackTextForHunt: honest ack from the last reasoning row, never the summary shape', () => {
  const rows = [
    { action: 'browser_open: https://ksuite.infomaniak.com/login', result: 'opened the login page', at: new Date(Date.now() - 4 * 60000).toISOString() },
    { action: 'browser_type: <script>alert(1)</script>', result: 'typed into the login form on https://ksuite.infomaniak.com/login — the form rejected the probe', at: new Date(Date.now() - 60000).toISOString() },
  ];
  const ack = ackTextForHunt({ reasoningRows: rows, lang: 'hinglish', pendingCount: 1 });
  assert.match(ack, /browser_type/);
  assert.match(ack, /ksuite\.infomaniak\.com\/login/);
  assert.match(ack, /agle turn/);
  for (const re of [/lead\(s\)/, /confirmed/, /early recon/i, /round \d+/, /actively hunting/, /Abhi tak kya try kiya/]) {
    assert.doesNotMatch(ack, re, `ack must never carry the summary shape (${re})`);
  }
  // No rows at all: still an honest ack, never a crash, never invented facts.
  const empty = ackTextForHunt({ reasoningRows: [], lang: 'english' });
  assert.match(empty, /middle of a turn/);
  assert.doesNotMatch(empty, /undefined|NaN/);
});

test('detectChatLanguage matches script and register', () => {
  assert.equal(detectChatLanguage('कितनी मिली अब तक?'), 'devanagari');
  assert.equal(detectChatLanguage('बता फिर सोने जाऊँ?'), 'devanagari');
  assert.equal(detectChatLanguage('kitni mili ab tak?'), 'hinglish');
  assert.equal(detectChatLanguage('bata fir jau sone?'), 'hinglish');
  assert.equal(detectChatLanguage('how many found so far?'), 'english');
  assert.equal(detectChatLanguage('what are you doing right now?'), 'english');
});

test('sanitizeHistory caps, maps roles, drops junk', () => {
  assert.deepEqual(sanitizeHistory(null), []);
  assert.deepEqual(sanitizeHistory('nope'), []);
  // Seven items in, slice(-6) keeps the last six — 'hello' is dropped.
  assert.deepEqual(
    sanitizeHistory([
      { role: 'user', text: 'hello' },
      { role: 'assistant', text: 'hi there' },
      { role: 'hunt', text: 'should be user' },
      { text: 'no role' },
      { role: 'user', text: '   ' },
      { role: 'user', text: 'x'.repeat(2000) },
      null,
    ]),
    [
      { role: 'assistant', text: 'hi there' },
      { role: 'user', text: 'should be user' },
      { role: 'user', text: 'no role' },
      { role: 'user', text: 'x'.repeat(1000) },
    ]
  );
  const many = Array.from({ length: 10 }, (_, i) => ({ role: 'user', text: `m${i}` }));
  assert.equal(sanitizeHistory(many).length, 6);
  assert.equal(sanitizeHistory(many)[0].text, 'm4');
});

const SUMMARY_BASE = {
  ctx: 'Hunting https://ksuite.infomaniak.com — actively hunting, round 80. 0 lead(s), 0 confirmed so far.',
  live: { target: 'https://ksuite.infomaniak.com', state: 'running', stepCount: 80 },
  liveError: null,
  cached: [
    { type: 'tool_call', tool: 'browser_type', detail: 'password', cachedAt: new Date(Date.now() - 3 * 60000).toISOString() },
  ],
  findings: [],
  reasoningRows: [
    {
      action: 'browser_type: password',
      result:
        'Typed "password". The page now shows: | Page: (untitled) — about:blank | --- visible text --- | (no visible text)',
      at: new Date(Date.now() - 3 * 60000).toISOString(),
    },
  ],
  meta: { target: 'https://ksuite.infomaniak.com', state: 'running', iteration: 80 },
  huntId: 'h_test',
};

test('summaryReply names the Right-now action, page and age (English)', () => {
  const reply = summaryReply({ ...SUMMARY_BASE, message: 'how many found so far?' });
  assert.match(reply, /Right now \(round 80\): browser_type: password/);
  assert.match(reply, /Page: about:blank/);
  assert.match(reply, /Last turn: 3 min ago/);
  assert.match(reply, /Still in early recon/);
});

test('summaryReply renders in Roman Hinglish for a Hinglish question', () => {
  const reply = summaryReply({ ...SUMMARY_BASE, message: 'kitni mili ab tak?' });
  assert.match(reply, /Hunt https:\/\/ksuite\.infomaniak\.com par chal rahi hai/);
  assert.match(reply, /Right now \(round 80\): browser_type: password/);
  assert.match(reply, /Aakhri turn: 3 min pehle/);
  assert.match(reply, /Abhi tak kya try kiya/);
});

test('summaryReply renders in Devanagari for a Devanagari question', () => {
  const reply = summaryReply({ ...SUMMARY_BASE, message: 'कितनी मिली अब तक?' });
  assert.match(reply, /हंट https:\/\/ksuite\.infomaniak\.com पर चल रही है/);
  assert.match(reply, /अभी \(राउंड 80\): browser_type: password/);
  assert.match(reply, /Page: about:blank/);
  assert.match(reply, /आख़िरी turn: 3 मिनट पहले/);
  assert.match(reply, /अभी तक क्या try किया/);
});

test('summaryReply says the page is unknown when the record carries no URL', () => {
  const reply = summaryReply({
    ...SUMMARY_BASE,
    message: 'what is the status?',
    reasoningRows: [{ action: 'search: infomaniak login', result: 'no useful results', at: new Date().toISOString() }],
  });
  assert.match(reply, /page unknown from the record/);
  const hindi = summaryReply({
    ...SUMMARY_BASE,
    message: 'क्या चल रहा है?',
    reasoningRows: [{ action: 'search: infomaniak login', result: 'no useful results', at: new Date().toISOString() }],
  });
  assert.match(hindi, /page record से पता नहीं चल रहा/);
});

test('summaryReply with no turns says so instead of inventing an action', () => {
  assert.match(
    summaryReply({ ...SUMMARY_BASE, message: 'status?', reasoningRows: [] }),
    /No turn has run yet on this hunt/
  );
  assert.match(
    summaryReply({ ...SUMMARY_BASE, message: 'क्या चल रहा है?', reasoningRows: [] }),
    /इस hunt पर अभी तक एक भी turn नहीं चला/
  );
});

test('summaryReply lists confirmed titles (unique) and counts them honestly', () => {
  const reply = summaryReply({
    ...SUMMARY_BASE,
    message: 'what did you find?',
    findings: [
      { verified: true, title: 'Stored XSS in profile name' },
      { verified: true, title: 'Stored XSS in profile name' },
      { verified: false, title: 'Reflected XSS maybe' },
    ],
  });
  assert.match(reply, /Found 1 confirmed vulnerability: Stored XSS in profile name/);
});

test('huntContextLine renders in all three languages', () => {
  const args = {
    huntId: 'h_test',
    meta: { target: 'https://ksuite.infomaniak.com', state: 'running', iteration: 80 },
    live: { target: 'https://ksuite.infomaniak.com', state: 'running', stepCount: 80 },
    liveError: null,
    cached: [],
    findings: [],
  };
  assert.match(huntContextLine(args), /Hunting https:\/\/ksuite\.infomaniak\.com — actively hunting, round 80/);
  assert.match(huntContextLine({ ...args, lang: 'hinglish' }), /par chal rahi hai — actively hunting, round 80/);
  assert.match(huntContextLine({ ...args, lang: 'devanagari' }), /पर चल रही है — actively hunting, राउंड 80/);
});

test('buildHuntSystemPrompt carries memory, Right-now state and the language rule', () => {
  const prompt = buildHuntSystemPrompt({
    huntId: 'h_test',
    meta: { target: 'https://ksuite.infomaniak.com', state: 'running' },
    live: { target: 'https://ksuite.infomaniak.com', state: 'running', stepCount: 80 },
    liveError: null,
    cached: [],
    findings: [],
    memory: {
      leftOff: {
        lastThinking: 'Stuck on the login form — the password field never submits.',
        lastActions: [
          { action: 'browser_type: password', result: 'Typed "password" on about:blank' },
        ],
      },
      ruledOut: ['SQLi on the login form (parameterised)'],
      dossierBriefing: 'kSuite is the new Infomaniak workspace product.',
      reasoningRows: SUMMARY_BASE.reasoningRows,
    },
    userMessage: 'क्या कर रहे हो?',
  });
  assert.match(prompt, /Reply in the language and script of the user's latest message/);
  assert.match(prompt, /Where I left off: Stuck on the login form/);
  assert.match(prompt, /Ruled out.*SQLi on the login form/);
  assert.match(prompt, /Dossier: kSuite is the new Infomaniak workspace product/);
  assert.match(prompt, /Right now: browser_type: password/);
  assert.match(prompt, /\(page: about:blank\)/);
});

test('busy and fallback lines are honest and bilingual', () => {
  assert.match(busyLine('english'), /mid-turn right now/);
  assert.match(busyLine('hinglish'), /Brain abhi ek turn ke beech mein hai/);
  assert.match(busyLine('devanagari'), /Brain अभी एक turn के बीच में है/);
  assert.match(fallbackLine('english'), /couldn't reach the brain/);
  assert.match(fallbackLine('devanagari'), /Brain से detailed जवाब नहीं मिल पाया/);
  assert.equal(busyLine('klingon'), busyLine('english'));
});
