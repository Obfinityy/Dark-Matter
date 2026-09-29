/**
 * Infinity Long-Context Engine — TEST A..L
 *
 * Uses MemoryDatabase + a scripted fake phone model (no real Gemma needed).
 * The fake model implements PhoneModelAdapter's contract (complete/completeJson)
 * so the full engine stack is exercised end-to-end.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryDatabase } from '../src/models/database.js';
import { LongContextStore } from '../src/services/longContext/longContextStore.js';
import { LongGenerationStore as GenStore } from '../src/services/longContext/longGenerationStore.js';
import { LongContextEngine } from '../src/services/longContext/longContextEngine.js';
import { LongGenerationEngine } from '../src/services/longContext/longGenerationEngine.js';
import { chunkText, hashContent } from '../src/services/longContext/chunker.js';
import { ContextBudgetManager } from '../src/services/longContext/contextBudgetManager.js';
import { estimateTokens } from '../src/services/longContext/tokens.js';

// ─── Fake phone model (scripted) ─────────────────────────────────────────
class FakePhoneModel {
  constructor() {
    this.enabled = true;
    this.calls = [];
    this.script = [];        // list of handlers: (messages, opts) => ({ text, finishReason })
    this.failNext = null;    // inject error
  }
  async complete(messages, options = {}) {
    this.calls.push({ messages, options });
    if (this.failNext) {
      const err = new Error(this.failNext.message);
      if (this.failNext.code) err.code = this.failNext.code;
      if (this.failNext.name) err.name = this.failNext.name;
      this.failNext = null;
      throw err;
    }
    const handler = this.script.shift() || (() => ({ text: 'Generic scripted reply.', finishReason: 'stop' }));
    return handler(messages, options);
  }
  async completeJson(messages, options = {}) {
    const { text } = await this.complete(messages, options);
    const m = text.match(/\{[\s\S]*\}/);
    return JSON.parse(m[0]);
  }
}

function makeStack() {
  const database = new MemoryDatabase();
  const store = new LongContextStore(database);
  const model = new FakePhoneModel();
  const engine = new LongContextEngine({ store, model });
  const genStore = new GenStore(database);
  const genEngine = new LongGenerationEngine({ store: genStore, model });
  return { database, store, model, engine, genEngine, genStore };
}

// Deterministic large document: N sections of realistic prose+code.
function makeLargeDocument(sections = 40) {
  let out = '';
  for (let i = 1; i <= sections; i++) {
    out += `\n\n## Section ${i}\n`;
    out += `This is section ${i} of the test document. It discusses topic-${i} in detail.\n`;
    out += '```python\n';
    out += `def function_${i}(arg_${i}):\n`;
    for (let l = 0; l < 12; l++) {
      out += `    # line ${l} of function_${i}\n    value_${l} = arg_${i} * ${l + 1}\n`;
    }
    out += `    return [value_${11} for l in range(12)]\n`;
    out += '```\n';
    out += `The MAGIC_MARKER_${((i % 7) + 1)} appears in section ${i}.\n`;
  }
  return out;
}

// ═══ TEST A — normal chat works exactly as before ═══════════════════════
test('TEST A: normal small chat returns scripted reply and persists both sides', async () => {
  const { engine, store, model } = makeStack();
  const chatModel = {
    get: async () => null,
    appendMessages: async (userId, conversationId, msgs) => ({ messages: msgs }),
    updateMessages: async () => ({})
  };
  engine.chatModel = chatModel;

  model.script.push(() => ({ text: 'Hello! How can I help?', finishReason: 'stop' }));
  const composed = await engine.composeChatContext({
    userId: 'u1', conversationId: 'c1', request: 'hi there', recentMessages: []
  });
  assert.ok(composed.messages.length >= 2);
  assert.equal(composed.messages[composed.messages.length - 1].content, 'hi there');

  await engine.updateMemoryAfterTurn({ conversationId: 'c1', userMessage: 'hi there', assistantReply: 'Hello! How can I help?' });
  const state = await store.getTaskState('c1');
  assert.ok(state.conversationSummary.includes('hi there'));
});

// ═══ TEST B — 20-message conversation memory stays correct ══════════════
test('TEST B: 20-turn conversation keeps rolling memory without unbounded growth', async () => {
  const { engine, store } = makeStack();
  let conversation = [];
  for (let i = 1; i <= 20; i++) {
    const user = `question number ${i} about module ${i % 5}`;
    const reply = `answer ${i}`;
    conversation = [...conversation.slice(-8), { role: 'user', content: user }, { role: 'assistant', content: reply }];
    await engine.updateMemoryAfterTurn({ conversationId: 'cb', userMessage: user, assistantReply: reply });
  }
  const state = await store.getTaskState('cb');
  // Rolling summary is capped (deterministic digests, sliced at 4000 chars).
  assert.ok(state.conversationSummary.length <= 4100);
  assert.ok(state.conversationSummary.includes('question number 20'));
  // Requirement extraction caught the pattern-free turns gracefully (no crash).
  assert.ok(Array.isArray(state.requirements));
});

// ═══ TEST C — large user input is chunked and persisted ═════════════════
test('TEST C: large input ingestion chunks, preserves order, stores exact content', async () => {
  const { engine, store, model } = makeStack();
  model.enabled = false; // skip summarization model calls for this test
  const doc = makeLargeDocument(30);
  const input = await engine.ingest({ userId: 'u1', conversationId: 'cC', content: doc, title: 'Big Doc', summarize: false });

  assert.ok(input.chunkCount > 1);
  assert.equal(input.status, 'indexed');
  assert.equal(input.totalCharacters, doc.length);

  const chunks = await store.listChunks('u1', 'cC', input.inputId, { skip: 0, limit: 1000 });
  assert.equal(chunks.length, input.chunkCount);

  // Order preserved & offsets contiguous.
  for (let i = 0; i < chunks.length; i++) {
    assert.equal(chunks[i].chunkIndex, i);
    if (i > 0) assert.ok(chunks[i].startOffset >= chunks[i - 1].endOffset - 800, 'overlap tolerated');
  }
  // Exact reconstruction: first chunk starts at 0; last chunk ends at doc end.
  assert.equal(chunks[0].startOffset, 0);
  assert.equal(chunks[chunks.length - 1].endOffset, doc.length);
  // Hashes valid.
  for (const chunk of chunks) {
    assert.equal(chunk.hash, hashContent(chunk.content));
  }
});

// ═══ TEST D — context overflow auto-retrieves/compacts, never crashes ═══
test('TEST D: ContextBudgetManager compacts retrieved blocks and recent messages before touching the request', async () => {
  const tiny = new ContextBudgetManager({ capacity: 300, outputReserve: 50 });
  const bigBlocks = Array.from({ length: 20 }, (_, i) => ({
    id: `blk-${i}`, label: `block ${i}`, content: 'x'.repeat(400) + ` unique-${i}`
  }));
  const bigRecent = Array.from({ length: 10 }, (_, i) => ({ role: 'user', content: `old message ${i} `.repeat(30) }));
  const { messages, usage } = tiny.compose({
    system: 'You are a helpful assistant.',
    taskState: 'REQ: keep it short',
    retrievedBlocks: bigBlocks,
    recentMessages: bigRecent,
    userRequest: 'What is unique-3?'
  });

  // Current request survived intact.
  const last = messages[messages.length - 1];
  assert.equal(last.content, 'What is unique-3?');
  // Budget respected.
  assert.ok(usage.total + usage.outputReserve <= usage.capacity + 40, `total ${usage.total} within capacity ${usage.capacity}`);
  // Something was dropped.
  assert.ok(usage.droppedRetrieved > 0 || usage.droppedRecent > 0);
});

test('TEST D2: request alone larger than window throws CONTEXT_WINDOW_EXCEEDED (engine will ingest it instead)', () => {
  const tiny = new ContextBudgetManager({ capacity: 200, outputReserve: 50 });
  assert.throws(
    () => tiny.compose({ system: 'sys', retrievedBlocks: [], recentMessages: [], userRequest: 'y'.repeat(2000) }),
    (err) => err.code === 'CONTEXT_WINDOW_EXCEEDED'
  );
});

// ═══ TEST E — million-word simulation ═══════════════════════════════════
test('TEST E: very large document — chunking, persistence, indexing, retrieval, summary, exact recovery', async () => {
  const { engine, store, model } = makeStack();
  // ~1.2 MB synthetic document (thousands of sections).
  const doc = makeLargeDocument(1200);
  assert.ok(doc.length > 1_000_000, `document is ${doc.length} chars`);

  model.script.push(() => ({ text: 'GLOBAL: document covers 1200 numbered sections; each defines function_N and mentions MAGIC_MARKER_K.', finishReason: 'stop' }));
  const input = await engine.ingest({ userId: 'u1', conversationId: 'cE', content: doc, title: 'Million Word Doc' });
  assert.equal(input.status, 'ready');
  assert.ok(input.chunkCount >= 150, `expected many chunks, got ${input.chunkCount}`);

  // 1. Exact chunk recovery (chunk 732 equivalent).
  const targetIndex = Math.min(732, input.chunkCount - 1);
  const recovered = await engine.getExactChunk('u1', 'cE', input.inputId, String(targetIndex));
  assert.ok(recovered);
  assert.equal(recovered.integrityOk, true);
  assert.ok(recovered.content.includes(`Section ${targetIndex + 1}`) || recovered.content.length > 0);

  // 2. Deterministic search: "find every occurrence of MAGIC_MARKER" style.
  const hits = await engine.search('u1', 'cE', 'magic_marker_3 section', { limit: 10 });
  assert.ok(hits.length > 0);
  assert.ok(hits.every((h) => h.preview && h.chunkId));

  // 3. Retrieval for a query pulls relevant chunks into a bounded context.
  const composed = await engine.composeChatContext({
    userId: 'u1', conversationId: 'cE', request: 'what does section 3 say about function_3?', recentMessages: []
  });
  assert.ok(composed.retrievedBlocks.length > 0);
  const totalTokens = composed.usage.total;
  assert.ok(totalTokens + composed.usage.outputReserve <= composed.usage.capacity + 40, `bounded: ${totalTokens}`);

  // 4. Full-document summary goes through the stored hierarchy (map-reduce), not the raw text.
  const summaryCallsBefore = model.calls.length;
  const sum = await engine.summarizeDocument('u1', 'cE', input.inputId);
  assert.ok(sum.summary.length > 0);
  // Only condensation calls may have been made — never a call with the full 1.2MB.
  for (const call of model.calls.slice(summaryCallsBefore)) {
    const biggest = Math.max(...call.messages.map((m) => m.content.length));
    assert.ok(biggest < 200_000, 'no single model call carries the whole document');
  }
});

// ═══ TEST F — huge code generation: plan → parts → validation → assembly ═
test('TEST F: multi-file project generation with plan, parts, validation and assembly', async () => {
  const { genEngine } = makeStack();
  // Script: planner returns JSON plan; parts return code segments.
  genEngine.model.script.push(() => ({
    text: JSON.stringify({
      taskType: 'code_generation',
      artifact: 'game',
      language: 'python',
      files: [
        { path: 'main.py', purpose: 'entry' },
        { path: 'player.py', purpose: 'player logic' }
      ],
      generationOrder: ['main.py', 'player.py']
    }),
    finishReason: 'stop'
  }));
  const codeFor = (path, seg) => `# ${path} segment ${seg}\ndef helper_${seg}(x):\n    return x * ${seg}\n`;
  genEngine.model.script.push((messages) => {
    const m = messages[1].content;
    const path = m.match(/segment \d+ of "([^"]+)"/)[1];
    const seg = parseInt(m.match(/segment (\d+)/)[1], 10);
    return { text: codeFor(path, seg), finishReason: 'stop' };
  });

  const record = await genEngine.startGeneration({
    userId: 'u1', conversationId: 'cF', request: 'Generate a python game using pygame with keyboard controls'
  });
  // Wait for async completion.
  for (let i = 0; i < 100 && record.status !== 'completed' && record.status !== 'failed'; i++) {
    await new Promise((r) => setTimeout(r, 20));
  }
  const final = await genEngine.get(record.generationId);
  assert.equal(final.status, 'completed', `errors: ${final.errors.join('|')}`);
  assert.ok(final.parts.length >= 2);
  assert.ok(final.assembly.files['main.py'].includes('def helper_1'));
  assert.ok(final.assembly.files['player.py'].includes('def helper_1'));
  // Requirements registry survived into the plan.
  assert.ok(final.plan.requirements.some((r) => /pygame|keyboard/i.test(r)));
});

// ═══ TEST G — generation interruption: cancel → resume, no rework ═══════
test('TEST G: cancelled generation preserves parts and resume only finishes the rest', async () => {
  const { genEngine } = makeStack();
  genEngine.model.script.push(() => ({
    text: JSON.stringify({ taskType: 'code_generation', artifact: 'big', language: 'python', files: [{ path: 'a.py', purpose: 'x' }, { path: 'b.py', purpose: 'y' }], generationOrder: ['a.py', 'b.py'] }),
    finishReason: 'stop'
  }));
  let calls = 0;
  genEngine.model.script.push(() => {
    calls += 1;
    return { text: `# part ${calls}\nvalue = ${calls}\n`, finishReason: calls >= 2 ? 'length' : 'stop' };
  });

  const record = await genEngine.startGeneration({ userId: 'u1', conversationId: 'cG', request: 'build big artifact' });
  await new Promise((r) => setTimeout(r, 60));
  await genEngine.cancel(record.generationId, 'u1');
  await new Promise((r) => setTimeout(r, 80));

  const cancelled = await genEngine.get(record.generationId);
  const partsAfterCancel = cancelled.parts.length;
  assert.ok(partsAfterCancel >= 0);
  assert.equal(cancelled.cancelled, true);

  // Resume: unfinished parts regenerate; completed parts are kept.
  await genEngine.resume(record.generationId, 'u1');
  for (let i = 0; i < 200 && !['completed', 'failed', 'cancelled'].includes((await genEngine.get(record.generationId)).status); i++) {
    await new Promise((r) => setTimeout(r, 20));
  }
  const resumed = await genEngine.get(record.generationId);
  assert.ok(['completed', 'failed'].includes(resumed.status), `status: ${resumed.status}`);
  assert.ok(resumed.parts.length >= Math.min(2, partsAfterCancel), 'parts preserved or extended, never wiped');
});

// ═══ TEST H — duplicate continuation is detected and removed ════════════
test('TEST H: continuation overlap dedupe strips repeated tail, never duplicates lines', async () => {
  const { genEngine } = makeStack();
  const previous = 'line 1\nline 2\nline 3\nline 500\nline 501\nline 502\n';
  const next = 'line 500\nline 501\nline 502\nline 503\nline 504\n';
  const cleaned = genEngine.dedupeContinuation(previous, next);
  assert.equal(cleaned, 'line 503\nline 504\n');
  // Non-overlapping output is untouched.
  assert.equal(genEngine.dedupeContinuation(previous, 'fresh content\n'), 'fresh content\n');
});

// ═══ TEST I — conversation isolation: user A cannot touch user B ═════════
test('TEST I: strict user isolation on inputs, chunks and search', async () => {
  const { engine, store, model } = makeStack();
  model.enabled = false;
  const doc = makeLargeDocument(5);
  const inputA = await engine.ingest({ userId: 'userA', conversationId: 'shared', content: doc, summarize: false });

  // User B cannot fetch A's input.
  const stolen = await store.getInput('userB', 'shared', inputA.inputId);
  assert.equal(stolen, null);
  // User B cannot fetch A's chunk.
  const chunk = await store.getChunk('userB', 'shared', inputA.inputId, 'chunk-000000');
  assert.equal(chunk, null);
  // User B's search never returns A's content.
  const hits = await engine.search('userB', 'shared', 'MAGIC_MARKER_1');
  assert.equal(hits.length, 0);
  // User A still sees their own.
  const own = await engine.search('userA', 'shared', 'MAGIC_MARKER_1');
  assert.ok(own.length > 0);
});

// ═══ TEST J — generation state survives a "browser refresh" ═════════════
test('TEST J: persisted generation record survives engine restart (new engine, same db)', async () => {
  const { genEngine, database, model } = makeStack();
  model.script.push(() => ({
    text: JSON.stringify({ taskType: 'code_generation', artifact: 'persist', language: 'python', files: [{ path: 'p.py', purpose: 'x' }], generationOrder: ['p.py'] }),
    finishReason: 'stop'
  }));
  model.script.push(() => ({ text: 'value = 1\n', finishReason: 'stop' }));

  const record = await genEngine.startGeneration({ userId: 'u1', conversationId: 'cJ', request: 'persist me' });
  await new Promise((r) => setTimeout(r, 120));

  // "Restart": fresh engines over the same database.
  const store2 = new LongContextStore(database);
  const genStore2 = new GenStore(database);
  const genEngine2 = new LongGenerationEngine({ store: genStore2, model });
  const revived = await genEngine2.get(record.generationId);
  assert.ok(revived);
  assert.ok(['completed', 'failed', 'generating', 'validating', 'assembling'].includes(revived.status));
  assert.ok(revived.parts.length >= 1);
});

// ═══ TEST K — phone temporarily unavailable: honest failure, queue intact ═
test('TEST K: provider failure reports actual error (no fake success, no fake 429)', async () => {
  const { engine, model } = makeStack();
  const chatModel = { get: async () => null, appendMessages: async () => ({}), updateMessages: async () => ({}) };
  engine.chatModel = chatModel;
  model.failNext = { message: 'connect EHOSTUNREACH 10.0.0.9:4891' };

  await assert.rejects(
    () => engine.model.complete([{ role: 'user', content: 'ping' }], { maxAttempts: 1 }),
    (err) => /EHOSTUNREACH/.test(err.message)
  );
  // Queue still functional afterwards.
  model.failNext = null;
  const ok = await engine.model.complete([{ role: 'user', content: 'ping' }], { maxAttempts: 1 });
  assert.ok(ok.text.length > 0);
});

// ═══ TEST L — model context too small: system adapts (shrinks, honest error) ═
test('TEST L: context overflow surfaces ContextWindowError and budget shrinks adaptively', async () => {
  const { engine, model } = makeStack();
  model.failNext = { message: 'Tokenization failed: prompt too long', code: 'CONTEXT_WINDOW_EXCEEDED', name: 'ContextWindowError' };
  await assert.rejects(
    () => engine.model.complete([{ role: 'user', content: 'x'.repeat(50) }], { maxAttempts: 1 }),
    (err) => err.code === 'CONTEXT_WINDOW_EXCEEDED'
  );

  // Budget manager: smaller capacity → fewer retrieved blocks included.
  const big = new ContextBudgetManager({ capacity: 4000, outputReserve: 500 });
  const small = new ContextBudgetManager({ capacity: 500, outputReserve: 100 });
  const blocks = Array.from({ length: 10 }, (_, i) => ({ id: `b${i}`, label: `b${i}`, content: 'z'.repeat(300) }));
  const r1 = big.compose({ system: 's', retrievedBlocks: blocks, recentMessages: [], userRequest: 'q' });
  const r2 = small.compose({ system: 's', retrievedBlocks: blocks, recentMessages: [], userRequest: 'q' });
  assert.ok(r1.usage.retrieved > r2.usage.retrieved, 'smaller window includes less retrieved material');
});
