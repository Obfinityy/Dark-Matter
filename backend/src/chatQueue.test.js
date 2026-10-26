// Mid-hunt chat queue (REAL-HUMAN lane, 26 Oct 2026).
//
// The owner's verified complaint: every mid-hunt question got the
// same canned summary shape in ~242ms, and the "detailed answer
// will wait" promise was never kept. The queue is the bridge:
// thinking questions wait for the brain's next turn, the instant
// reply is an honest acknowledgement grounded in the live record
// (never the summary shape), and the brain's answer is delivered
// as a chat_answer event + appended chat message. A question is
// never silently dropped.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE the queue (via store/config) is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-chat-queue-'));
process.env.DATA_DIR = tmpRoot;

const {
  MAX_QUEUED_CHAT_QUESTIONS,
  CHAT_QUESTIONS_ON_SCREEN,
  queueChatQuestion,
  pendingChatQuestions,
  markChatAnswered,
  chatQuestionScreenLines,
  extractChatAnswers,
  busyAck,
  queueFullLine,
} = await import('./chatQueue.js');

const HUNT = 'h_test_chatqueue';

test('queueChatQuestion: a question is stored pending with its chat + language', () => {
  const { question, queued } = queueChatQuestion(HUNT, {
    chatId: 'chat-1', userId: 'u1', text: 'To fir aage ka kya kaam h', lang: 'hinglish',
  });
  assert.equal(queued, true);
  assert.equal(question.status, 'pending');
  assert.equal(question.chatId, 'chat-1');
  assert.equal(question.lang, 'hinglish');
  assert.equal(question.text, 'To fir aage ka kya kaam h');
  assert.match(question.id, /^q_/);
  const pending = pendingChatQuestions(HUNT);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, question.id);
});

test('queueChatQuestion: past the cap the question is refused, not dropped silently', () => {
  const hunt = 'h_test_chatqueue_full';
  for (let i = 0; i < MAX_QUEUED_CHAT_QUESTIONS; i++) {
    assert.equal(queueChatQuestion(hunt, { chatId: 'c', userId: 'u', text: `q${i}` }).queued, true);
  }
  const res = queueChatQuestion(hunt, { chatId: 'c', userId: 'u', text: 'one too many' });
  assert.equal(res.queued, false);
  assert.equal(res.reason, 'full');
  assert.equal(pendingChatQuestions(hunt).length, MAX_QUEUED_CHAT_QUESTIONS);
  assert.match(queueFullLine('hinglish'), /pehle se wait kar rahe/);
});

test('markChatAnswered: an answered question leaves the pending list', () => {
  const hunt = 'h_test_chatqueue_ans';
  const { question } = queueChatQuestion(hunt, { chatId: 'c', userId: 'u', text: 'what now?' });
  assert.equal(markChatAnswered(hunt, question.id, { answer: 'Next I probe the reset flow.' }), true);
  assert.equal(pendingChatQuestions(hunt).length, 0);
  assert.equal(markChatAnswered(hunt, 'q_nope', { answer: 'x' }), false);
});

test('chatQuestionScreenLines: oldest first, capped, empty when nothing pending', () => {
  assert.deepEqual(chatQuestionScreenLines([]), []);
  const hunt = 'h_test_chatqueue_screen';
  queueChatQuestion(hunt, { chatId: 'c', userId: 'u', text: 'first question', lang: 'english' });
  queueChatQuestion(hunt, { chatId: 'c', userId: 'u', text: 'doosra sawaal', lang: 'hinglish' });
  const lines = chatQuestionScreenLines(pendingChatQuestions(hunt));
  assert.equal(lines[0], "=== YOUR OWNER'S QUESTIONS — ANSWER THEM THIS TURN ===");
  assert.match(lines[1], /first question/);
  assert.match(lines[2], /Roman Hindi/);
  assert.match(lines[lines.length - 1], /chat_answers/);
  // Cap: the screen never carries more than the budget.
  const many = Array.from({ length: 9 }, (_, i) => ({ id: `q_${i}`, text: `q${i}`, lang: 'english', askedAt: new Date().toISOString() }));
  const capped = chatQuestionScreenLines(many);
  assert.equal(capped.filter((l) => l.startsWith('- [q_')).length, CHAT_QUESTIONS_ON_SCREEN);
});

test('extractChatAnswers: only answers to really-pending ids count', () => {
  const pending = [
    { id: 'q_aaa', text: 'what now?', lang: 'english' },
    { id: 'q_bbb', text: 'aur kya?', lang: 'hinglish' },
  ];
  const action = {
    action: 'shell',
    command: 'curl -s https://example.com',
    chat_answers: [
      { q: 'q_aaa', answer: 'Next I probe the password reset flow.' },
      { q: 'q_fake', answer: 'A fabricated id must never be delivered.' },
      { q: 'q_bbb', answer: '   ' },
      { q: 'q_bbb' },
    ],
  };
  const out = extractChatAnswers(action, pending);
  assert.equal(out.length, 1);
  assert.equal(out[0].q, 'q_aaa');
  assert.equal(out[0].answer, 'Next I probe the password reset flow.');
  assert.equal(extractChatAnswers({ action: 'shell' }, pending).length, 0);
  assert.equal(extractChatAnswers(null, pending).length, 0);
});

// The canned summary shape, for the negative assertions below — the
// exact markers the owner's live chat showed on every reply.
const SUMMARY_MARKERS = [
  /lead\(s\)/, /confirmed/, /early recon/i, /round \d+/,
  /actively hunting/, /Abhi tak kya try kiya/, /Recent attempts/,
  /Aakhri soch/, /Currently: /,
];

test('busyAck: honest, specific, live-grounded — never the summary shape', () => {
  const facts = {
    doing: 'trying the login page again — the form rejected the probe',
    page: 'https://ksuite.infomaniak.com/login',
    age: '4 min ago',
    pendingCount: 1,
  };
  for (const lang of ['english', 'hinglish', 'devanagari']) {
    const ack = busyAck({ ...facts, lang });
    assert.ok(ack.length > 40, `${lang}: ack is a real sentence, not a stub`);
    assert.match(ack, /login page again/);
    assert.match(ack, /ksuite\.infomaniak\.com\/login/);
    for (const re of SUMMARY_MARKERS) {
      assert.doesNotMatch(ack, re, `${lang}: ack must never carry the summary shape (${re})`);
    }
  }
});

test('busyAck: two different questions get structurally different acks', () => {
  const a = busyAck({ lang: 'hinglish', doing: 'loading the SQLi skill card — no probe sent yet', page: '', age: '' });
  const b = busyAck({ lang: 'hinglish', doing: 'reading the forgot-password page — the reset form needs an email', page: 'https://ksuite.infomaniak.com/forgot-password', age: '1 min ago' });
  assert.notEqual(a, b);
  assert.match(a, /SQLi skill card/);
  assert.match(b, /forgot-password/);
});

test('busyAck: unknown page is admitted, never invented', () => {
  const ack = busyAck({ lang: 'english', doing: 'waiting on the browser snapshot', page: '', age: '' });
  assert.doesNotMatch(ack, /page unknown|on undefined|on null/i);
  assert.match(ack, /waiting on the browser snapshot/);
});

test('busyAck: multiple waiting questions are named', () => {
  const ack = busyAck({ lang: 'english', doing: 'probing the reset flow', pendingCount: 3 });
  assert.match(ack, /3 waiting/);
});
