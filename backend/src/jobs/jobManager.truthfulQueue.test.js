/**
 * jobManager.truthfulQueue.test.js — Bug 4: the backend must NEVER emit
 * fake hunting progress.
 *
 *  - cloud/orchestration mode (localExecution: false): a created hunt stays
 *    truthfully `queued` with waitingReason 'waiting for your agent
 *    machine'; the in-process worker is never invoked; no brain/tool/
 *    finding progress events are emitted;
 *  - local mode: executor='backend' hunts still dispatch to the worker;
 *  - mid-hunt chat (askBrain) is brain-routed even for "simple" status
 *    questions; an unreachable brain yields the honest message, never a
 *    template.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GradioProvider } from '../agent/providers/gradioProvider.js';
import { JobManager, WAITING_FOR_AGENT_MACHINE } from './jobManager.js';
import { BRAIN_UNAVAILABLE_REPLY } from '../services/huntChatBrain.js';

const TEMPLATE_PHRASES = [
  'ka hunt chal raha hai',
  'Abhi phase:',
  'recon kar raha',
  'queue mein hai',
  'Main ruka nahi hun',
  'Findings so far',
  'Ab tak kul',
  'Sabse serious',
  'Filhaal ye chal raha hai',
  'intezaar kar raha hun',
];

function assertNoTemplatePhrases(text, label) {
  for (const phrase of TEMPLATE_PHRASES) {
    assert.ok(
      !String(text).includes(phrase),
      `${label}: must not contain template phrase "${phrase}"`
    );
  }
}

// Event types that would constitute (fake) hunting progress on a backend
// that cannot actually drive the hunt.
const PROGRESS_EVENT_TYPES = new Set([
  'job.started',
  'brain.decision',
  'brain.triple',
  'brain.deterministic',
  'tool.output',
  'finding.created',
  'observation.recorded',
]);

function buildStubs() {
  const jobs = new Map();
  const events = [];
  const state = { workerRunCalls: [] };
  const jobModel = {
    create: async fields => {
      const job = {
        id: `job_${jobs.size + 1}`,
        status: 'queued',
        phase: 'initializing',
        stepCount: 0,
        activity: [],
        waitingReason: null,
        ...fields,
        executor: fields.executor === 'agent' ? 'agent' : 'backend',
      };
      jobs.set(job.id, job);
      return { ...job };
    },
    get: async id => jobs.get(id) || null,
    getForUser: async (userId, id) => {
      const job = jobs.get(id);
      return job && job.userId === userId ? job : null;
    },
    update: async (id, patch) => {
      const job = jobs.get(id);
      if (job) Object.assign(job, patch);
      return job ? { ...job } : null;
    },
  };
  const worker = {
    isRunning: () => false,
    runningCount: 0,
    runningCountForUser: () => 0,
    run: async id => {
      state.workerRunCalls.push(id);
      return { status: 'finished' };
    },
    memory: { rememberConversation: async () => {} },
    findingModel: { list: async () => [] },
    brainProviderModel: null,
    modelRunnerService: null,
    appConfig: {},
    reasoningCycleModel: null,
  };
  const eventService = {
    publish: async (jobId, event) => {
      events.push({ jobId, ...event });
      return event;
    },
  };
  const assessmentModel = { setStatus: async () => {} };
  return { jobs, events, state, jobModel, worker, eventService, assessmentModel };
}

const KAGGLE_SELECTION = {
  slotSources: {
    hacker: { source: 'kaggle', kaggleUrl: 'https://abc123.gradio.live', kaggleName: 'Hacker' },
  },
  slotAssignments: {},
};

const origGenerate = GradioProvider.prototype.generate;
afterEach(() => {
  GradioProvider.prototype.generate = origGenerate;
});

describe('truthful queue — cloud/orchestration mode', () => {
  test('created hunt stays queued with waitingReason; worker never runs; no progress events', async () => {
    const stubs = buildStubs();
    const manager = new JobManager({
      jobModel: stubs.jobModel,
      assessmentModel: stubs.assessmentModel,
      worker: stubs.worker,
      eventService: stubs.eventService,
      logger: { error: () => {}, warn: () => {}, info: () => {} },
      config: { localExecution: false },
    });

    const job = await manager.createJob({
      userId: 'u1',
      assessmentId: 'a1',
      target: 'https://example.com',
      scope: {},
      objective: 'Assess example.com',
      executor: 'backend', // user asked "this device" — cloud backend cannot honor it
    });

    // createJob dispatches asynchronously — wait for admission to settle.
    await manager.dispatches.get(job.id);

    assert.equal(job.status, 'queued', 'job stays queued');
    assert.equal(job.executor, 'agent', 're-routed to the agent machine queue');
    assert.equal(job.waitingReason, WAITING_FOR_AGENT_MACHINE);
    assert.deepEqual(stubs.state.workerRunCalls, [], 'in-process worker never invoked');

    const progressEvents = stubs.events.filter(e => PROGRESS_EVENT_TYPES.has(e.type));
    assert.deepEqual(
      progressEvents.map(e => e.type),
      [],
      'no brain/tool/finding progress events emitted'
    );
    const awaiting = stubs.events.filter(e => e.type === 'job.awaiting_agent');
    assert.ok(awaiting.length >= 1, 'exactly one honest awaiting_agent event');
    assert.ok(
      String(awaiting[0].message).includes(WAITING_FOR_AGENT_MACHINE),
      'event message states the truth'
    );

    // The persisted doc agrees (what the UI reads on refresh).
    const persisted = await stubs.jobModel.get(job.id);
    assert.equal(persisted.status, 'queued');
    assert.equal(persisted.waitingReason, WAITING_FOR_AGENT_MACHINE);
  });

  test('WAITING_FOR_AGENT_MACHINE constant matches the contract wording', () => {
    assert.equal(WAITING_FOR_AGENT_MACHINE, 'waiting for your agent machine');
  });
});

describe('local mode — worker still drives backend-executor hunts', () => {
  test("executor='backend' dispatches to the in-process worker", async () => {
    const stubs = buildStubs();
    const manager = new JobManager({
      jobModel: stubs.jobModel,
      assessmentModel: stubs.assessmentModel,
      worker: stubs.worker,
      eventService: stubs.eventService,
      logger: { error: () => {}, warn: () => {}, info: () => {} },
      config: { localExecution: true },
    });

    const job = await manager.createJob({
      userId: 'u1',
      assessmentId: 'a1',
      target: 'https://example.com',
      scope: {},
      objective: 'Assess example.com',
      executor: 'backend',
    });

    assert.equal(job.executor, 'backend');
    assert.deepEqual(stubs.state.workerRunCalls, [job.id], 'worker.run invoked once');
  });
});

describe('askBrain — always brain-routed, never templates', () => {
  function managerWithBrain({ generateImpl } = {}) {
    const stubs = buildStubs();
    stubs.worker.brainProviderModel = { getSelection: async () => KAGGLE_SELECTION };
    GradioProvider.prototype.generate =
      generateImpl ||
      (async () => 'BRAIN SAYS: abhi main login form ke parameters test kar raha hun.');
    const manager = new JobManager({
      jobModel: stubs.jobModel,
      assessmentModel: stubs.assessmentModel,
      worker: stubs.worker,
      eventService: stubs.eventService,
      logger: { error: () => {}, warn: () => {}, info: () => {} },
      config: { localExecution: true },
    });
    return { manager, stubs };
  }

  async function seedJob(stubs) {
    return stubs.jobModel.create({
      userId: 'u1',
      assessmentId: 'a1',
      target: 'https://example.com',
      scope: {},
      objective: 'Assess example.com',
      executor: 'backend',
      status: 'running',
      phase: 'probing',
      stepCount: 12,
      currentAction: 'testing the login form',
      activity: [{ message: 'started probing the login form' }],
    });
  }

  test('a "simple" status question goes to the brain — not to templates', async () => {
    const { manager, stubs } = managerWithBrain();
    const job = await seedJob(stubs);

    const answer = await manager.askBrain('u1', job.id, 'kya kar rahe ho?');

    assert.equal(answer.intent, 'brain');
    assert.match(answer.reply, /BRAIN SAYS/, 'reply carries the brain’s own words');
    assertNoTemplatePhrases(answer.reply, 'askBrain reply');
    assert.equal(answer.jobStatus, 'running');
  });

  test('unreachable brain → honest message, zero template phrases', async () => {
    const { manager, stubs } = managerWithBrain({
      generateImpl: async () => {
        throw new Error('Gradio link expired');
      },
    });
    const job = await seedJob(stubs);

    const answer = await manager.askBrain('u1', job.id, 'kya mila?');

    assert.equal(answer.intent, 'brain_unavailable');
    assert.equal(answer.reply, BRAIN_UNAVAILABLE_REPLY);
    assertNoTemplatePhrases(answer.reply, 'unavailable reply');
  });

  test('no brain configured → honest message', async () => {
    const stubs = buildStubs();
    stubs.worker.brainProviderModel = {
      getSelection: async () => ({ slotSources: {}, slotAssignments: {} }),
    };
    const manager = new JobManager({
      jobModel: stubs.jobModel,
      assessmentModel: stubs.assessmentModel,
      worker: stubs.worker,
      eventService: stubs.eventService,
      logger: { error: () => {}, warn: () => {}, info: () => {} },
      config: { localExecution: true },
    });
    const job = await seedJob(stubs);

    const answer = await manager.askBrain('u1', job.id, 'status?');
    assert.equal(answer.intent, 'brain_unavailable');
    assert.equal(answer.reply, BRAIN_UNAVAILABLE_REPLY);
    assertNoTemplatePhrases(answer.reply, 'unavailable reply');
  });
});
