/**
 * taskDecomposer.test.js — plan → delegate → synthesize, like the operator.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { TaskDecomposer } = await import('../src/agent/taskDecomposer.js');

/** Fake brain with scripted JSON replies. */
function fakeBrain({ plan, synthesis }) {
  return {
    calls: [],
    async generate(messages) {
      const sys = messages.find(m => m.role === 'system')?.content || '';
      this.calls.push(sys.slice(0, 20));
      if (sys.includes('task planner')) return JSON.stringify(plan);
      if (sys.includes('synthesizer')) return JSON.stringify(synthesis);
      // analyze worker
      return 'analysis result';
    },
  };
}

describe('TaskDecomposer', () => {
  test('decomposes, delegates, and synthesizes', async () => {
    const brain = fakeBrain({
      plan: {
        subTasks: [
          { kind: 'analyze', task: 'Check headers', context: 'target.com' },
          { kind: 'analyze', task: 'Check JS files', context: 'target.com' },
        ],
        synthesisHint: 'focus on misconfigs',
      },
      synthesis: {
        conclusion: 'Target has 2 misconfigs.',
        keyFacts: ['no CSP', 'verbose errors'],
        nextSteps: ['confirm manually'],
      },
    });
    const dc = new TaskDecomposer({});
    const out = await dc.run({ brain, objective: 'Assess target.com', context: '' });
    assert.equal(out.conclusion, 'Target has 2 misconfigs.');
    assert.deepEqual(out.keyFacts, ['no CSP', 'verbose errors']);
    assert.equal(out.subResults.length, 2);
    assert.ok(out.subResults.every(r => r.status === 'fulfilled'));
    // plan + 2 analyzes + synthesis = 4 brain calls
    assert.equal(brain.calls.length, 4);
  });

  test('tool sub-tasks run through the executor in parallel', async () => {
    const brain = fakeBrain({
      plan: {
        subTasks: [
          { kind: 'tool', tool: 'subfinder', target: 'example.com' },
          { kind: 'tool', tool: 'httpx', target: 'example.com' },
        ],
        synthesisHint: '',
      },
      synthesis: { conclusion: 'done', keyFacts: [], nextSteps: [] },
    });
    const executed = [];
    const toolExecutor = {
      async execute(tool, opts) {
        executed.push(tool);
        await new Promise(r => setTimeout(r, 20));
        return { tool, ok: true };
      },
    };
    const dc = new TaskDecomposer({ toolExecutor });
    const out = await dc.run({ brain, objective: 'recon', context: '' });
    assert.deepEqual(executed.sort(), ['httpx', 'subfinder']);
    assert.equal(out.subResults.length, 2);
  });

  test('a failed sub-task does not kill synthesis', async () => {
    const brain = fakeBrain({
      plan: { subTasks: [{ kind: 'analyze', task: 't1', context: '' }], synthesisHint: '' },
      synthesis: { conclusion: 'partial', keyFacts: [], nextSteps: [] },
    });
    // make the analyze call throw
    const origGenerate = brain.generate.bind(brain);
    let n = 0;
    brain.generate = async messages => {
      n += 1;
      if (n === 2) throw new Error('worker failed');
      return origGenerate(messages);
    };
    const dc = new TaskDecomposer({});
    const out = await dc.run({ brain, objective: 'x', context: '' });
    assert.equal(out.subResults[0].status, 'rejected');
    assert.equal(out.conclusion, 'partial');
  });

  test('throws when brain returns no plan', async () => {
    const brain = { async generate() { return 'not json'; } };
    const dc = new TaskDecomposer({});
    await assert.rejects(() => dc.run({ brain, objective: 'x', context: '' }), /valid sub-task plan/);
  });
});
