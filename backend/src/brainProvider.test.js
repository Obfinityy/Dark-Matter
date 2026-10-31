// MODEL-SWITCHER lane (26 Oct 2026, owner order) — the mixture:
// "when Meta isn't respond switch automatic to 8B, thats our
// working". The lab for this lane is MOCKED Meta throughout —
// no live Meta call, no credit burn. The fake Meta is injected
// per test (metaFn / fetchFn); the fake 8B is a stub chatFn.
//
//   MS-1  default brain is V1: the 8B answers, Meta never called.
//   MS-2  selected Meta, Meta answers: Meta's reply, no event.
//   MS-3  Meta timeout -> automatic switch to 8B, switch event,
//         fallback persisted, 8B answers the turn.
//   MS-4  Meta HTTP 500 -> same, reason http_500.
//   MS-5  Meta empty reply -> same, reason empty.
//   MS-6  Meta refusal -> same, reason refusal.
//   MS-7  recovery: two consecutive Meta successes switch back
//         (flap guard); the first only answers the turn.
//   MS-8  in fallback, Meta fails again: streak resets, stays in
//         fallback, 8B answers, no new event.
//   MS-9  no META_API_KEY: 8B answers; the transition is recorded
//         once, not once per turn.
//   MS-10 manual switch to Meta without a key is refused.
//   MS-11 manual switch mid-hunt: state flips, event recorded,
//         and the SAME messages reach either brain (seamless —
//         the loop rebuilds the prompt from state + history +
//         memory every turn; the model never enters the prompt).
//   MS-12 the Meta client sends the Spark-quirk fields
//         (reasoning_effort + generous max_tokens) and treats a
//         refusal as a failure; the key never appears in a result.
//   MS-13 the chat path (callChatMeta) answers via Meta, null
//         without a key.
//   MS-14 integration: a real humanIteration turn whose chat dep
//         is the callBrain wrapper, Meta failing -> the turn still
//         runs on the 8B and the switch event lands in the hunt
//         record.
//
// Env is set BEFORE importing brainProvider (DATA_DIR points at a
// temp dir so the real store functions never touch live hunts).
// META_API_KEY is set/unset per test — the provider reads it at
// call time, so per-test env changes take effect. Every test gets
// its OWN hunt id, so switch events never leak between tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-provider-'));
process.env.DATA_DIR = tmpRoot;

const {
  BRAIN_MODELS,
  DEFAULT_BRAIN_MODEL,
  callBrain,
  callChatMeta,
  callMetaModel,
  getBrainState,
  listBrainModels,
  metaAvailable,
  setBrainModel,
} = await import('./brainProvider.js');
const { readHuntMeta, writeHuntMeta, readHuntEvents } = await import('./store.js');
const { humanIteration } = await import('./humanLoop.js');

const TARGET = 'https://scanme.nmap.org';

let huntSeq = 0;
function freshHunt() {
  const id = `h_test_sw_${++huntSeq}`;
  writeHuntMeta(id, { huntId: id, target: TARGET, state: 'running', iteration: 1 });
  return id;
}

function switches(huntId) {
  return (readHuntEvents(huntId) || []).filter((e) => e && e.type === 'model_switch');
}

// Async-aware: the env change must survive the whole async body,
// not just until the first await.
async function withKey(key, fn) {
  const prev = process.env.META_API_KEY;
  if (key === undefined) delete process.env.META_API_KEY;
  else process.env.META_API_KEY = key;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.META_API_KEY;
    else process.env.META_API_KEY = prev;
  }
}

function eightBStub(calls) {
  return async (messages, system, ctx) => {
    calls.push({ messages, system, ctx });
    return '8B-ANSWER';
  };
}

function metaStub(results, calls) {
  let n = 0;
  return async (messages, system, ctx, opts) => {
    calls.push({ messages, system, ctx, opts });
    const r = Array.isArray(results) ? results[Math.min(n++, results.length - 1)] : results;
    return typeof r === 'function' ? r() : r;
  };
}

const META_OK = { ok: true, text: 'META-ANSWER' };
const META_TIMEOUT = { ok: false, reason: 'timeout' };
const META_500 = { ok: false, reason: 'http_500' };
const META_EMPTY = { ok: false, reason: 'empty' };
const META_REFUSAL = { ok: false, reason: 'refusal' };

test('MS-1: default brain is V1 — the 8B answers, Meta never called, no event', async () => {
  await withKey('LLM_testkey', async () => {
    const HUNT = freshHunt();
    const eightCalls = [];
    const metaCalls = [];
    const reply = await callBrain([{ role: 'user', text: 'hi' }], 'sys', { huntId: HUNT }, {
      huntId: HUNT, chatFn: eightBStub(eightCalls), metaFn: metaStub([META_OK], metaCalls),
    });
    assert.equal(reply, '8B-ANSWER');
    assert.equal(eightCalls.length, 1);
    assert.equal(metaCalls.length, 0);
    assert.deepEqual(switches(HUNT), []);
    assert.equal(getBrainState(HUNT).selected, DEFAULT_BRAIN_MODEL);
  });
});

test('MS-2: selected Meta, Meta answers — Meta reply, no fallback, no event', async () => {
  await withKey('LLM_testkey', async () => {
    const HUNT = freshHunt();
    assert.equal(setBrainModel(HUNT, 'muse-spark-1.3', { manual: true }).ok, true);
    const eightCalls = [];
    const metaCalls = [];
    const reply = await callBrain([{ role: 'user', text: 'hi' }], 'sys', { huntId: HUNT }, {
      huntId: HUNT, chatFn: eightBStub(eightCalls), metaFn: metaStub([META_OK], metaCalls),
    });
    assert.equal(reply, 'META-ANSWER');
    assert.equal(metaCalls.length, 1);
    assert.equal(metaCalls[0].opts.model, 'muse-spark-1.3');
    assert.equal(eightCalls.length, 0);
    assert.equal(getBrainState(HUNT).fallback, false);
    assert.equal(getBrainState(HUNT).active, 'muse-spark-1.3');
    // The manual switch itself recorded one event; the Meta success added none.
    assert.equal(switches(HUNT).length, 1);
    assert.equal(switches(HUNT)[0].reason, 'manual_switch');
  });
});

for (const [name, failure, reason] of [
  ['MS-3: Meta timeout', META_TIMEOUT, 'timeout'],
  ['MS-4: Meta HTTP 500', META_500, 'http_500'],
  ['MS-5: Meta empty reply', META_EMPTY, 'empty'],
  ['MS-6: Meta refusal', META_REFUSAL, 'refusal'],
]) {
  test(`${name} -> automatic switch to 8B, switch event, fallback persisted`, async () => {
    await withKey('LLM_testkey', async () => {
      const HUNT = freshHunt();
      setBrainModel(HUNT, 'muse-spark-1.3', { manual: true });
      const before = switches(HUNT).length;
      const eightCalls = [];
      const reply = await callBrain([{ role: 'user', text: 'hi' }], 'sys', { huntId: HUNT }, {
        huntId: HUNT, chatFn: eightBStub(eightCalls), metaFn: metaStub([failure], []),
      });
      assert.equal(reply, '8B-ANSWER');
      assert.equal(eightCalls.length, 1);
      const st = getBrainState(HUNT);
      assert.equal(st.fallback, true);
      assert.equal(st.active, DEFAULT_BRAIN_MODEL);
      assert.equal(st.selected, 'muse-spark-1.3');
      const fresh = switches(HUNT).slice(before);
      assert.equal(fresh.length, 1);
      assert.equal(fresh[0].from, 'muse-spark-1.3');
      assert.equal(fresh[0].to, DEFAULT_BRAIN_MODEL);
      assert.equal(fresh[0].reason, reason);
      assert.equal(fresh[0].manual, false);
    });
  });
}

test('MS-7: recovery needs two consecutive Meta successes (flap guard)', async () => {
  await withKey('LLM_testkey', async () => {
    const HUNT = freshHunt();
    setBrainModel(HUNT, 'muse-spark-1.2', { manual: true });
    const eightCalls = [];
    const metaCalls = [];
    const meta = metaStub([META_OK, META_OK], metaCalls);
    const chat = eightBStub(eightCalls);
    // First failure puts the hunt in fallback.
    await callBrain([{ role: 'user', text: 't1' }], 'sys', { huntId: HUNT }, {
      huntId: HUNT, chatFn: chat, metaFn: metaStub([META_TIMEOUT], []),
    });
    assert.equal(getBrainState(HUNT).fallback, true);
    // First success while in fallback: answers the turn, streak 1,
    // still in fallback — no switch-back event yet.
    const reply1 = await callBrain([{ role: 'user', text: 't2' }], 'sys', { huntId: HUNT }, {
      huntId: HUNT, chatFn: chat, metaFn: meta,
    });
    assert.equal(reply1, 'META-ANSWER');
    assert.equal(getBrainState(HUNT).fallback, true);
    assert.equal(getBrainState(HUNT).metaStreak, 1);
    assert.equal(switches(HUNT).filter((e) => e.reason === 'meta_recovered').length, 0);
    // Second consecutive success: the guard is met — switch back.
    const reply2 = await callBrain([{ role: 'user', text: 't3' }], 'sys', { huntId: HUNT }, {
      huntId: HUNT, chatFn: chat, metaFn: meta,
    });
    assert.equal(reply2, 'META-ANSWER');
    const st = getBrainState(HUNT);
    assert.equal(st.fallback, false);
    assert.equal(st.active, 'muse-spark-1.2');
    assert.equal(st.metaStreak, 0);
    const back = switches(HUNT).filter((e) => e.reason === 'meta_recovered');
    assert.equal(back.length, 1);
    assert.equal(back[0].from, DEFAULT_BRAIN_MODEL);
    assert.equal(back[0].to, 'muse-spark-1.2');
    assert.equal(metaCalls.length, 2);
  });
});

test('MS-8: in fallback, Meta fails again — streak resets, stays in fallback, 8B answers, no new event', async () => {
  await withKey('LLM_testkey', async () => {
    const HUNT = freshHunt();
    setBrainModel(HUNT, 'muse-spark-1.3', { manual: true });
    const chat = eightBStub([]);
    await callBrain([{ role: 'user', text: 't1' }], 'sys', { huntId: HUNT }, {
      huntId: HUNT, chatFn: chat, metaFn: metaStub([META_TIMEOUT], []),
    });
    assert.equal(getBrainState(HUNT).fallback, true);
    const before = switches(HUNT).length;
    // One probe success (streak 1), then a failure: the streak resets.
    await callBrain([{ role: 'user', text: 't2' }], 'sys', { huntId: HUNT }, {
      huntId: HUNT, chatFn: chat, metaFn: metaStub([META_OK], []),
    });
    assert.equal(getBrainState(HUNT).metaStreak, 1);
    const reply = await callBrain([{ role: 'user', text: 't3' }], 'sys', { huntId: HUNT }, {
      huntId: HUNT, chatFn: chat, metaFn: metaStub([META_500], []),
    });
    assert.equal(reply, '8B-ANSWER');
    const st = getBrainState(HUNT);
    assert.equal(st.fallback, true);
    assert.equal(st.metaStreak, 0);
    assert.equal(switches(HUNT).length, before);
  });
});

test('MS-9: no META_API_KEY — the 8B answers; the transition is recorded once, not per turn', async () => {
  await withKey(undefined, async () => {
    assert.equal(metaAvailable(), false);
    const HUNT = freshHunt();
    // Force a Meta selection into the record (as if chosen before
    // the key went away) — the provider must cope, not crash.
    writeHuntMeta(HUNT, { ...readHuntMeta(HUNT), brain: { selected: 'muse-spark-1.3', active: 'muse-spark-1.3', fallback: false, metaStreak: 0 } });
    const chat = eightBStub([]);
    const r1 = await callBrain([{ role: 'user', text: 't1' }], 'sys', { huntId: HUNT }, { huntId: HUNT, chatFn: chat, metaFn: metaStub([META_OK], []) });
    const r2 = await callBrain([{ role: 'user', text: 't2' }], 'sys', { huntId: HUNT }, { huntId: HUNT, chatFn: chat, metaFn: metaStub([META_OK], []) });
    assert.equal(r1, '8B-ANSWER');
    assert.equal(r2, '8B-ANSWER');
    assert.equal(getBrainState(HUNT).fallback, true);
    const noKey = switches(HUNT).filter((e) => e.reason === 'meta_unavailable');
    assert.equal(noKey.length, 1);
  });
});

test('MS-10: manual switch to a Meta model without a key is refused, state unchanged', async () => {
  await withKey(undefined, async () => {
    const HUNT = freshHunt();
    const res = setBrainModel(HUNT, 'muse-spark-1.3', { manual: true });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'meta_unavailable');
    assert.equal(getBrainState(HUNT).selected, DEFAULT_BRAIN_MODEL);
    assert.deepEqual(switches(HUNT), []);
    const unknown = setBrainModel(HUNT, 'not-a-model', { manual: true });
    assert.equal(unknown.ok, false);
    assert.equal(unknown.error, 'unknown_model');
  });
});

test('MS-11: manual switch mid-hunt flips state, records the event, and the SAME messages reach either brain', async () => {
  await withKey('LLM_testkey', async () => {
    const HUNT = freshHunt();
    const messages = [{ role: 'user', text: 'the full planning prompt, state + history + memory' }];
    const eightCalls = [];
    const metaCalls = [];
    const chat = eightBStub(eightCalls);
    const meta = metaStub([META_OK], metaCalls);
    // Turn on the 8B first.
    await callBrain(messages, 'system-prompt', { huntId: HUNT }, { huntId: HUNT, chatFn: chat, metaFn: meta });
    assert.equal(eightCalls.length, 1);
    // Switch mid-hunt: state flips, the event is recorded, and the
    // next turn carries the identical prompt to the new brain.
    const switched = setBrainModel(HUNT, 'muse-wonder-1.0', { manual: true });
    assert.equal(switched.ok, true);
    const st = getBrainState(HUNT);
    assert.equal(st.selected, 'muse-wonder-1.0');
    assert.equal(st.active, 'muse-wonder-1.0');
    assert.equal(st.fallback, false);
    const manual = switches(HUNT).filter((e) => e.manual === true);
    assert.equal(manual.length, 1);
    assert.equal(manual[0].from, DEFAULT_BRAIN_MODEL);
    assert.equal(manual[0].to, 'muse-wonder-1.0');
    await callBrain(messages, 'system-prompt', { huntId: HUNT }, { huntId: HUNT, chatFn: chat, metaFn: meta });
    assert.equal(metaCalls.length, 1);
    assert.equal(metaCalls[0].opts.model, 'muse-wonder-1.0');
    assert.deepEqual(metaCalls[0].messages, eightCalls[0].messages);
    assert.equal(metaCalls[0].system, eightCalls[0].system);
    // The switcher list marks Meta models available while the key is set.
    assert.equal(listBrainModels().find((m) => m.id === 'muse-spark-1.3').available, true);
    assert.equal(BRAIN_MODELS.length, 7);
  });
});

test('MS-12: the Meta client sends the Spark-quirk fields; a refusal is a failure; the key never appears in a result', async () => {
  await withKey('LLM_topsecretkey', async () => {
    const HUNT = freshHunt();
    const seen = [];
    const fetchOk = async (url, opts) => {
      seen.push({ url, opts });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'hello', refusal: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      };
    };
    const chatRes = await callMetaModel([{ role: 'user', text: 'hi' }], 'sys', { huntId: HUNT }, {
      model: 'muse-spark-1.3', maxTokens: 800, reasoningEffort: 'minimal', fetchFn: fetchOk,
    });
    assert.equal(chatRes.ok, true);
    assert.equal(chatRes.text, 'hello');
    assert.equal(seen.length, 1);
    assert.equal(seen[0].url, 'https://api.meta.ai/v1/chat/completions');
    const body = JSON.parse(seen[0].opts.body);
    assert.equal(body.model, 'muse-spark-1.3');
    assert.equal(body.reasoning_effort, 'minimal');
    assert.equal(body.max_tokens, 800);
    assert.equal(seen[0].opts.redirect, 'manual');
    assert.equal(JSON.stringify(chatRes).includes('LLM_topsecretkey'), false);
    // Defaults for a brain turn: low reasoning, 2000 max tokens.
    seen.length = 0;
    await callMetaModel([{ role: 'user', text: 'plan' }], 'sys', { huntId: HUNT }, { fetchFn: fetchOk });
    const brainBody = JSON.parse(seen[0].opts.body);
    assert.equal(brainBody.reasoning_effort, 'low');
    assert.equal(brainBody.max_tokens, 2000);
    // A refusal is a failure, not a reply.
    const fetchRefusal = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '', refusal: 'I cannot help with that.' }, finish_reason: 'stop' }] }),
    });
    const ref = await callMetaModel([{ role: 'user', text: 'x' }], 'sys', { huntId: HUNT }, { fetchFn: fetchRefusal });
    assert.deepEqual(ref, { ok: false, reason: 'refusal' });
    // An empty reply is a failure too.
    const fetchEmpty = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '   ', refusal: '' }, finish_reason: 'length' }] }),
    });
    const emp = await callMetaModel([{ role: 'user', text: 'x' }], 'sys', { huntId: HUNT }, { fetchFn: fetchEmpty });
    assert.deepEqual(emp, { ok: false, reason: 'empty' });
    // A non-2xx is a failure with its status in the reason.
    const fetch500 = async () => ({ ok: false, status: 500, json: async () => ({}) });
    const bad = await callMetaModel([{ role: 'user', text: 'x' }], 'sys', { huntId: HUNT }, { fetchFn: fetch500 });
    assert.deepEqual(bad, { ok: false, reason: 'http_500' });
  });
});

test('MS-13: the chat path answers via Meta, and null without a key', async () => {
  await withKey('LLM_testkey', async () => {
    const HUNT = freshHunt();
    const fetchOk = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'chat reply', refusal: '' }, finish_reason: 'stop' }] }),
    });
    const reply = await callChatMeta([{ role: 'user', text: 'what are you doing?' }], 'sys', { huntId: HUNT }, { fetchFn: fetchOk });
    assert.equal(reply, 'chat reply');
  });
  await withKey(undefined, async () => {
    const HUNT = freshHunt();
    const reply = await callChatMeta([{ role: 'user', text: 'hi' }], 'sys', { huntId: HUNT }, {
      fetchFn: async () => { throw new Error('must not be called without a key'); },
    });
    assert.equal(reply, null);
  });
});

test('MS-14: a real humanIteration turn with the callBrain wrapper — Meta failing still runs on the 8B, switch event in the record', async () => {
  await withKey('LLM_testkey', async () => {
    const HUNT = freshHunt();
    setBrainModel(HUNT, 'muse-spark-1.3', { manual: true });
    const eightCalls = [];
    const chat = async (messages, system, ctx) => {
      eightCalls.push({ messages, system, ctx });
      return `thinking aloud, then acting.\n${JSON.stringify({ action: 'note', text: 'checked the login page' })}`;
    };
    const meta = metaStub([META_TIMEOUT], []);
    const recorded = [];
    const res = await humanIteration(HUNT, TARGET, {
      turns: 1,
      deps: {
        chat: (messages, system, ctx) => callBrain(messages, system, ctx, {
          huntId: HUNT, chatFn: chat, metaFn: meta,
        }),
        gui: {
          open: async () => ({ observation: 'opened', snapshot: { url: TARGET, title: 'scanme', text: 'scanme', elements: [] } }),
          snapshot: async () => ({ observation: `Page: ${TARGET}`, snapshot: { url: TARGET, title: 'scanme', text: 'scanme', elements: [] } }),
          click: async () => ({ ok: true, observation: 'clicked', snapshot: { url: TARGET, title: 'scanme', text: 'scanme', elements: [] } }),
          type: async () => ({ ok: true, observation: 'Typed.', snapshot: { url: TARGET, title: 'scanme', text: 'scanme', elements: [] } }),
          screenshot: async () => ({ observation: 'shot', snapshot: { url: TARGET, title: 'scanme', text: 'scanme', elements: [] } }),
        },
        execRaw: async () => ({ stdout: '', stderr: '' }),
        exec: async () => ({ stdout: '', stderr: '', code: 0 }),
        search: async () => 'no results',
        record: (h, e) => { recorded.push(e); },
        recordNote: () => {},
        readMeta: () => ({}),
        readEvents: () => [],
        buildBriefing: async () => '',
        machineControlled: () => false,
        desktopScreenshot: async () => ({ ok: true, name: 'desktop-x.jpg' }),
        startDesktop: async () => {},
        assess: null,
      },
    });
    assert.equal(res.aiOk, true);
    assert.equal(res.turnsRun, 1);
    assert.equal(res.actionsRun, 1);
    assert.equal(eightCalls.length, 1);
    assert.match(eightCalls[0].messages[0].text, /scanme/);
    // The fallback switch landed in the hunt's own event record.
    const sw = switches(HUNT).filter((e) => e.reason === 'timeout');
    assert.equal(sw.length, 1);
    assert.equal(sw[0].from, 'muse-spark-1.3');
    assert.equal(sw[0].to, DEFAULT_BRAIN_MODEL);
  });
});
