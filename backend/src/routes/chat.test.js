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
import { detectSteering } from './chat.js';

test('hinglish status questions route to summary', () => {
  for (const q of [
    'kitni mili ab tak?',
    'kitni mili?',
    'kitne mile ab tak',
    'kya mila?',
    'kuch mila?',
    'ab tak kya mila',
    'kahan tak pahunche',
    'kya chal raha hai',
    'kya ho raha hai',
    'kya try kiya ab tak',
  ]) {
    assert.equal(detectSteering(q), 'summary', q);
  }
});

test("owner's own phrasings route to summary", () => {
  for (const q of [
    'so what is now doing by you and what you thinking now?',
    'bata',
    'batao',
    "what's going on",
    'what is happening',
    'what are you thinking now',
  ]) {
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
