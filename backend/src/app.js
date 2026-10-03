import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { SecretBox } from './core/crypto.js';
import { MongoDatabase, MemoryDatabase } from './models/database.js';
import { ProviderModel } from './models/providerModel.js';
import { ScanModel } from './models/scanModel.js';
import { TargetModel } from './models/targetModel.js';
import { UserModel } from './models/userModel.js';
import { SessionModel } from './models/sessionModel.js';
import { AssessmentModel } from './models/assessmentModel.js';
import { AgentStateModel } from './models/agentStateModel.js';
import { ToolExecutionModel } from './models/toolExecutionModel.js';
import { ComputerActionModel } from './models/computerActionModel.js';
import { ReasoningCycleModel } from './models/reasoningCycleModel.js';
import { BrainProviderModel } from './models/brainProviderModel.js';
import { CustomModelModel } from './models/customModelModel.js';
import { FindingModel } from './models/findingModel.js';
import { ReportModel } from './models/reportModel.js';
import { EventService } from './services/eventService.js';
import { ScanService } from './services/scanService.js';
import { SubdomainService } from './services/subdomainService.js';
import { AuthService } from './services/authService.js';
import { AssessmentService } from './services/assessmentService.js';
import { ReportService } from './services/reportService.js';
import { StateManager } from './agent/stateManager.js';
import { Planner } from './agent/planner.js';
import { AgentBrain } from './agent/brain.js';
import { ScopeEngine } from './agent/scopeEngine.js';
import { ToolExecutor } from './tools/executor.js';
import { attachAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createAgentController } from './controllers/agentController.js';
import { createAuthController } from './controllers/authController.js';
import { agentInfo, health, localAiHealth, directChat } from './controllers/healthController.js';
import { createScanController } from './controllers/scanController.js';
import { createSettingsController } from './controllers/settingsController.js';
import { createTargetController } from './controllers/targetController.js';
import { createAssessmentController } from './controllers/assessmentController.js';
import { createInfiniteChatController } from './controllers/infiniteChatController.js';
import { createInfinityModes } from './services/infinityModes.js';
import { createJobController } from './controllers/jobController.js';
import { createPermissionsController } from './controllers/permissionsController.js';
import { createLocalModelController } from './controllers/localModelController.js';
import { createModelRunnerController } from './controllers/modelRunnerController.js';
import { createRemoteModelController } from './controllers/remoteModelController.js';
import { createComputerController } from './controllers/computerController.js';
import { createComputerTaskController } from './controllers/computerTaskController.js';
import { createCrewController } from './controllers/crewController.js';
import { CrewService } from './services/crewService.js';
import { CrewWorker } from './jobs/crewWorker.js';
import { createVoiceController } from './controllers/voiceController.js';
import { VoiceManager } from './services/voiceManager.js';
import { AgentJobModel } from './models/agentJobModel.js';
import { ComputerTaskModel } from './models/computerTaskModel.js';
import { ComputerTaskBrain } from './agent/computerTaskBrain.js';
import { ComputerTaskWorker } from './jobs/computerTaskWorker.js';
import { ComputerTaskManager } from './services/computerTaskManager.js';
import { AgentMemoryModel } from './models/agentMemoryModel.js';
import { EvidenceModel } from './models/evidenceModel.js';
import { AgentMemory } from './agent/memory/agentMemory.js';
import { AutonomousBrain } from './agent/autonomousBrain.js';
import { LocalModelService } from './services/localModel/localModelService.js';
import { ModelRunnerService } from './services/modelRunner/modelRunnerService.js';
import { ContextBudgetManager } from './services/longContext/contextBudgetManager.js';
import { ComputerState } from './computer/computerState.js';
import { ComputerEvents } from './computer/computerEvents.js';
import { OpenInterfaceAdapter } from './computer/openInterfaceAdapter.js';
import { FindingLifecycleService } from './services/findingLifecycleService.js';
import { AgentWorker } from './jobs/agentWorker.js';
import { JobManager } from './jobs/jobManager.js';
import { AlertModel } from './models/alertModel.js';
import { PayloadLibraryModel } from './models/payloadLibraryModel.js';
import { HuntScheduleModel } from './models/huntScheduleModel.js';
import { TargetQueueModel } from './models/targetQueueModel.js';
import { HuntRecordModel } from './models/huntRecordModel.js';
import { AlertService } from './services/alertService.js';
import { TargetQueueService } from './services/targetQueueService.js';
import { HuntScheduler } from './services/huntScheduler.js';
import { FileMemory } from './agent/memory/fileMemory.js';
import { HuntContextManager } from './agent/huntContextManager.js';
import { createHuntRecordController } from './controllers/huntRecordController.js';
import { createAlertController } from './controllers/alertController.js';
import { createQueueController } from './controllers/queueController.js';
import { createScheduleController } from './controllers/scheduleController.js';
import { createPayloadLibraryController } from './controllers/payloadLibraryController.js';
import { memoryController } from './controllers/memoryController.js';
import { listTools } from './controllers/toolController.js';
import { createReportController } from './controllers/reportController.js';
import { createRoutes } from './routes/index.js';
import { InfiniteChatModel } from './models/infiniteChatModel.js';
import {
  LongContextStore,
  LongContextEngine,
  LongGenerationStore,
  LongGenerationEngine,
  PhoneModelAdapter
} from './services/longContext/index.js';
import { UserBrainAdapter } from './services/userBrainAdapter.js';

function resolveDatabase(explicit) {
  if (explicit) return explicit;
  if (config.mongoUrl) return new MongoDatabase(config);
  if (config.nodeEnv === 'production') {
    throw new Error('MONGO_URL is required for the backend database connection (production)');
  }
  // Dev/test convenience: boot without Mongo so `npm start` works out of the
  // box. Data lives only in memory and is lost on restart — set MONGO_URL
  // for anything persistent.
  console.warn(
    '[dark-matter] WARNING: MONGO_URL is not set — using an IN-MEMORY database. ' +
    'All data will be lost on restart. Set MONGO_URL for persistence.'
  );
  return new MemoryDatabase();
}

export async function createApp({ database } = {}) {
  database = resolveDatabase(database);
  try {
    await database.init();
  } catch (err) {
    // MONGO_URL was set but the cluster is unreachable (offline dev box,
    // sandbox with no TLS route to Atlas, …). In non-production this
    // degrades to the in-memory database instead of killing the boot —
    // `npm start` must always just work locally. Production still dies
    // loudly (data loss there is not acceptable).
    const isMongo = database instanceof MongoDatabase;
    if (isMongo && config.nodeEnv !== 'production') {
      console.warn(
        `[dark-matter] WARNING: MongoDB unreachable (${err?.message || err}) — ` +
        'falling back to an IN-MEMORY database for this session. ' +
        'Data will be lost on restart. Check backend/.env MONGO_URL when you are back online.'
      );
      database = new MemoryDatabase();
      await database.init();
    } else {
      throw err;
    }
  }

  // ─── Existing Models ──────────────────────────────────────────────
  const providerModel = new ProviderModel(database, new SecretBox(config.encryptionKey));
  const targetModel = new TargetModel(database);
  const scanModel = new ScanModel(database);
  const userModel = new UserModel(database);
  const sessionModel = new SessionModel(database);
  const infiniteChatModel = new InfiniteChatModel(database);

  // ─── New Assessment Models ────────────────────────────────────────
  const assessmentModel = new AssessmentModel(database);
  const agentStateModel = new AgentStateModel(database);
  const toolExecutionModel = new ToolExecutionModel(database);
  const computerActionModel = new ComputerActionModel(database);
  const reasoningCycleModel = new ReasoningCycleModel(database);
  const brainProviderModel = new BrainProviderModel(database);
  const customModelModel = new CustomModelModel(database);
  const findingModel = new FindingModel(database);
  const reportModel = new ReportModel(database);
  const agentJobModel = new AgentJobModel(database);
  const agentMemoryModel = new AgentMemoryModel(database);
  const evidenceModel = new EvidenceModel(database);
  // ─── Hunt-support models (alerts, payload learning, schedules, queues) ──
  const alertModel = new AlertModel(database);
  const payloadLibraryModel = new PayloadLibraryModel(database);
  const huntScheduleModel = new HuntScheduleModel(database);
  const targetQueueModel = new TargetQueueModel(database);
  // ─── Hunt records: the DB side of hybrid storage ──────────────────────
  // Completed hunts' final reports live here — the source of truth for
  // "what have we already hunted" (target dedup + report history).
  const huntRecordModel = new HuntRecordModel(database);

  // ─── Existing Services ────────────────────────────────────────────
  const authService = new AuthService({
    userModel,
    sessionModel,
    sessionDays: config.sessionDays,
    jwtSecret: config.jwtSecret,
    jwtDays: config.jwtDays
  });
  const eventService = new EventService(database);
  const subdomainService = new SubdomainService({ scanModel, targetModel, eventService });
  const scanService = new ScanService({ targetModel, scanModel, eventService, subdomainService });
  // Alerts: critical findings, hunt completion, queue/schedule events.
  const alertService = new AlertService({ alertModel, eventService, logger: console });

  // ─── Agent System ─────────────────────────────────────────────────
  // Note: ScopeEngine is created per-assessment in AssessmentService.
  // We create a default one here for the ToolExecutor (it gets replaced per-assessment).
  const defaultScopeEngine = new ScopeEngine({ included: [], excluded: [] }, 'localhost');

  const stateManager = new StateManager({ agentStateModel, assessmentModel, eventService });
  const planner = new Planner({ providerModel });
  const toolExecutor = new ToolExecutor({ toolExecutionModel, eventService, scopeEngine: defaultScopeEngine });

  const agentBrain = new AgentBrain({
    stateManager,
    planner,
    toolExecutor,
    scopeEngine: defaultScopeEngine,
    eventService,
    assessmentModel,
    findingModel
  });

  const assessmentService = new AssessmentService({
    assessmentModel,
    targetModel,
    agentBrain,
    stateManager,
    eventService,
    planner,
    providerModel
  });

  const reportService = new ReportService({
    reportModel,
    assessmentModel,
    findingModel,
    toolExecutionModel,
    agentStateModel,
    eventService,
    evidenceModel
  });

  // ─── Computer Control (Open-Interface "hands") ───────────────────
  // The adapter owns the Python bridge process. It never calls an LLM: the
  // local phone Gemma remains the only brain.
  const computerState = new ComputerState();
  const computerEvents = new ComputerEvents({ eventService, state: computerState });
  const computerAdapter = new OpenInterfaceAdapter({
    config: config.computer,
    state: computerState,
    events: computerEvents
  });
  computerState.setCapabilities(null, {
    available: false,
    reason: config.computer.enabled ? 'not probed yet' : 'computer control is disabled (COMPUTER_CONTROL_ENABLED=false)'
  });

  // ─── Persistent Agent Memory (MongoDB as the brain's memory) ─────
  const agentMemory = new AgentMemory({
    memoryModel: agentMemoryModel,
    contextBudgetManager: new ContextBudgetManager({
      capacity: config.longContext.modelContextTokens,
      outputReserve: config.longContext.outputReserveTokens
    })
  });

  const findingLifecycle = new FindingLifecycleService({
    findingModel,
    evidenceModel,
    memory: agentMemory,
    eventService,
    agentStateModel
  });

  // ─── Autonomous Brain (local phone Gemma by default) ─────────────────
  const autonomousBrain = new AutonomousBrain({
    memory: agentMemory,
    eventService,
    computer: computerAdapter
  });

  // ─── Brain provider switching (issue #3: "Run Locally" model library) ──
  // Per-user brains: the model picker persists EACH USER's selection in the
  // brain-provider model; the worker builds that user's brain lazily on the
  // next reasoning step. There is deliberately NO global brain and NO boot
  // swap — one user's model choice must never affect another user's hunts.
  // onActivate simply drops the user's cached brain so it rebuilds.
  let agentWorker = null; // assigned below; the hook below closes over it
  const localModelService = new LocalModelService({
    config,
    brainProviderModel,
    customModelModel,
    onActivate: (userId) => agentWorker?.refreshBrainForUser(userId)
  });

  // ─── Local GGUF model runner (no Ollama) ──────────────────────────
  // Download → Run → localhost: the user picks a GGUF from the library (or
  // adds any Hugging Face GGUF), the backend downloads it once, and Run
  // spawns llama-server on 127.0.0.1. The running model becomes the brain
  // for Hunt + Infinity AI via the 'local' brain provider.
  const modelRunnerService = new ModelRunnerService({
    dataDir: process.env.DARKMATTER_DATA_DIR || null,
    logger: console
  });

  // ─── Infinity Voice: built-in neural TTS (lazy — spawns on first /speak)
  const voiceManager = new VoiceManager({ logger: console });

  // ─── Hybrid memory: files for working memory, DB for artifacts ──────
  // The agent's working memory (journal, learnings, plan, per-hunt summary)
  // lives in LOCAL FILES under the app-data dir — the agent reads/writes them
  // itself with run_command. The database keeps only persistent ARTIFACTS
  // (completed hunt records + final reports via huntRecordModel above).
  const fileMemory = new FileMemory({ dataDir: process.env.DARKMATTER_DATA_DIR || null });
  // HuntContextManager assembles the token-budgeted brain context each cycle:
  // hot sliding window → warm rolling summary → cold file memory. The warm
  // summary is ALSO persisted to the hunt's summary.md (see its
  // maybeRefreshSummary), so long hunts survive restarts with memory intact.
  const huntContextManager = new HuntContextManager({
    jobModel: agentJobModel,
    memory: fileMemory,
    findingModel,
    reasoningCycleModel,
    payloadLibraryModel
  });

  // ─── Persistent Job Worker ────────────────────────────────────────
  agentWorker = new AgentWorker({
    jobModel: agentJobModel,
    assessmentModel,
    brain: autonomousBrain,
    memory: agentMemory,
    toolExecutor,
    toolExecutionModel,
    computer: computerAdapter,
    computerState,
    computerEvents,
    computerActionModel,
    reasoningCycleModel,
    findingLifecycle,
    evidenceModel,
    stateManager,
    eventService,
    reportService,
    findingModel,
    alertService,
    targetQueueService: null, // assigned after the queue service is built below
    payloadLibraryModel,
    brainProviderModel,
    huntContextManager,
    appConfig: config,
    huntRecordModel,
    modelRunnerService
  });

  const jobManager = new JobManager({
    jobModel: agentJobModel,
    assessmentModel,
    worker: agentWorker,
    eventService,
    config: config.agentWorker
  });

  // ─── Scheduled hunts + multi-target queues ──────────────────────────
  // Both fire through the SAME assessment-creation path as POST /jobs, so
  // scheduled/queued hunts get authorization checks, target dedup, and the
  // fair worker pool like any other hunt. createJob receives the scheduler's
  // { userId, target, scope, objective } and the queue's { userId, url }.
  const createHuntFromTarget = async ({ userId, target, targetUrl, scope, objective }) => {
    const url = targetUrl || target;
    const created = await assessmentService.createFromTarget(userId, {
      targetUrl: url,
      authorizationConfirmed: true, // the user authorized the schedule/queue itself
      message: objective || `Assess ${url}`,
      deferStart: true
    });
    if (created.status !== 'assessment_created') {
      throw new Error(created.message || `Could not create assessment for ${url}`);
    }
    return jobManager.createJob({
      userId,
      assessmentId: created.assessmentId,
      // Full normalized URL — keeps the port; ScopeEngine accepts full URLs.
      target: created.assessment.targetUrl || created.assessment.targetHostname,
      scope: scope || created.assessment.scope,
      objective: objective || `Assess ${created.assessment.targetHostname}`
    });
  };
  const targetQueueService = new TargetQueueService({
    queueModel: targetQueueModel,
    // Queue advance passes { userId, target, scope, objective, origin }.
    createJob: ({ userId, target, scope, objective }) => createHuntFromTarget({ userId, target, scope, objective }),
    alertService
  });
  const huntScheduler = new HuntScheduler({
    // Scheduler tick passes { userId, target, scope, objective, origin }.
    scheduleModel: huntScheduleModel,
    createJob: createHuntFromTarget,
    alertService
  });
  // The worker advances the queue when a hunt completes (best-effort).
  agentWorker.targetQueueService = targetQueueService;

  // ─── Infinity Long-Context Engine ─────────────────────────────────
  // Application-level context virtualization over the finite local model.
  const phoneModel = new PhoneModelAdapter();
  // Infinity AI thinks with the user's ACTIVE brain (Models → Run / Kaggle
  // connect), not hard-wired phone: phone-default users delegate back to
  // phoneModel untouched, so default behavior is byte-for-byte identical.
  const userBrain = new UserBrainAdapter({
    brainProviderModel,
    modelRunnerService,
    appConfig: config,
    defaultModel: phoneModel
  });
  const longContextStore = new LongContextStore(database);
  const longContextEngine = new LongContextEngine({ store: longContextStore, model: userBrain });
  longContextEngine.chatModel = infiniteChatModel; // conversation history stays in infinite_chats
  const longGenerationStore = new LongGenerationStore(database);
  const longGenerationEngine = new LongGenerationEngine({ store: longGenerationStore, model: userBrain });

  // ─── InfiniteChat Computer Tasks (active brain + shared hands) ──────
  // Logically separated from the bug-bounty agent (own model/worker/manager/
  // endpoints) but reusing the SAME computer layer and LocalAIQueue — never a
  // second bridge, never a second action protocol (#29, #30).
  // The brain is the user's ACTIVE brain via userBrain.providerFor: whatever
  // is selected on the Models page (local Run / Kaggle-Connect / phone
  // default) does the thinking — no hard-wired model, no canned plans.
  const computerTaskModel = new ComputerTaskModel(database);
  const computerTaskBrain = new ComputerTaskBrain({
    providerFor: (userId) => userBrain.providerFor(userId)
  });
  const computerTaskWorker = new ComputerTaskWorker({
    taskModel: computerTaskModel,
    chatModel: infiniteChatModel,
    brain: computerTaskBrain,
    computer: computerAdapter,
    computerState,
    computerEvents,
    eventService
  });
  const computerTaskManager = new ComputerTaskManager({
    taskModel: computerTaskModel,
    worker: computerTaskWorker,
    eventService,
    config: { recoverOnBoot: config.agentWorker.recoverOnBoot }
  });

  // ─── Infinity Crew (persistent AI coworkers with their own computers) ─
  // Each crew member is a long-lived coworker the user chats with from
  // inside Infinity AI Control mode. Reuses the same computer layer and the
  // user's active brain — no second bridge, no second action protocol.
  const crewService = new CrewService({});
  const crewWorker = new CrewWorker({
    crewService,
    providerFor: (userId) => userBrain.providerFor(userId),
    computerAdapter,
    logger: console
  });

  // ─── Express App ──────────────────────────────────────────────────
  const app = express();
  app.disable('x-powered-by');
  // Honest DB reporting for /health: "mongodb" when Atlas is wired, "memory" for the zero-config fallback.
  app.locals.databaseKind = database instanceof MongoDatabase ? 'mongodb' : 'memory';
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({
    origin: (origin, callback) => {
      // Zero-config local dev: the vite dev server may land on any port
      // (5173, 5174, …) when several instances run. Same-machine origins
      // are always trusted — CORS is not a localhost security boundary.
      if (!origin || config.frontendOrigins.includes(origin)) return callback(null, true);
      if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) return callback(null, true);
      return callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true
  }));
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '10mb' }));

  // Store services for access in controllers
  app.locals.services = {
    database, providerModel, targetModel, scanModel, eventService, scanService,
    subdomainService, authService, assessmentModel, agentStateModel,
    toolExecutionModel, findingModel, reportModel, assessmentService,
    reportService, agentBrain,
    longContextEngine, longGenerationEngine,
    agentJobModel, agentMemoryModel, evidenceModel, agentMemory,
    computerState, computerEvents, computerAdapter, autonomousBrain,
    findingLifecycle, agentWorker, jobManager,
    computerTaskModel, computerTaskBrain, computerTaskWorker, computerTaskManager,
    crewService, crewWorker,
    reasoningCycleModel, brainProviderModel, localModelService, customModelModel,
    modelRunnerService,
    huntRecordModel, alertModel, payloadLibraryModel, huntScheduleModel, targetQueueModel
  };
  app.locals.shutdown = async () => {
    // Stop all running assessments on shutdown
    for (const [id] of agentBrain.runningAssessments) {
      agentBrain.stop(id);
    }
    // Stop the autonomous worker and the computer bridge, then close Mongo.
    await agentWorker.stopAll();
    await modelRunnerService.stop().catch(() => {});
    await computerTaskManager.stopAll();
    computerAdapter.stop();
    await database.close();
  };

  app.use('/api/v1', createRoutes({
    controllers: {
      health: { health, agentInfo, localAiHealth, directChat },
      auth: { ...createAuthController(authService, config), attach: attachAuth(authService) },
      settings: createSettingsController(providerModel),
      tools: { listTools },
      targets: createTargetController(targetModel),
      scans: createScanController(scanService, eventService),
      agent: createAgentController(scanService),
      assessments: createAssessmentController(assessmentService, eventService),
      reports: createReportController(reportService, assessmentService),
      infiniteChat: createInfiniteChatController({
        longContextEngine,
        longGenerationEngine,
        computerTaskManager,
        infinityModes: createInfinityModes({ brainModelFor: () => userBrain }),
        computerAdapter
      }),
      voice: createVoiceController({ voiceManager }),
      jobs: createJobController({
        jobManager,
        assessmentService,
        eventService,
        computerAdapter,
        computerActionModel,
        reasoningCycleModel,
        huntRecordModel,
        reportService,
        findingModel,
        agentStateModel,
        evidenceModel
      }),
      huntRecords: createHuntRecordController({ huntRecordModel }),
      alerts: createAlertController({ alertService }),
      queues: createQueueController({ targetQueueService, targetQueueModel }),
      schedules: createScheduleController({ huntScheduler, huntScheduleModel }),
      payloadLibrary: createPayloadLibraryController({ payloadLibraryModel }),
      localModels: createLocalModelController({ localModelService, agentWorker }),
      modelRunner: createModelRunnerController({ modelRunnerService, brainProviderModel, agentWorker }),
      remoteModel: createRemoteModelController({ brainProviderModel, agentWorker }),
      computer: createComputerController({ computerAdapter, assessmentModel }),
      computerTasks: createComputerTaskController({ computerTaskManager, computerAdapter }),
      crew: createCrewController({ crewService, crewWorker }),
      permissions: createPermissionsController(),
      memory: memoryController,
    }
  }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  // ─── Boot recovery: pick up jobs left over from a restart ──────────
  // Runs after the app is built so an operator can observe it, and never
  // blocks startup. A restart must not lose a 50-hour assessment (#70).
  if (config.agentWorker.recoverOnBoot && config.agentWorker.autoStartWorker) {
    setImmediate(() => {
      jobManager.recoverIncompleteJobs().catch((error) => {
        console.error('[job-manager] boot recovery failed:', error.message);
      });
      computerTaskManager.recoverIncompleteTasks().catch((error) => {
        console.error('[computer-task-manager] boot recovery failed:', error.message);
      });
    });
  }

  // ─── Scheduled hunts: fire due schedules on an interval ────────────
  // HuntScheduler.tick() is idempotent (advances nextRunAt BEFORE firing),
  // so a slow tick can never double-fire a schedule. Disabled in tests via
  // HUNT_SCHEDULER_ENABLED=false. The timer is unref'd so it never holds
  // the process open on its own.
  if (process.env.HUNT_SCHEDULER_ENABLED !== 'false') {
    const schedulerTickMs = Number(process.env.HUNT_SCHEDULER_TICK_MS || 60_000);
    const schedulerTimer = setInterval(() => {
      huntScheduler.tick().catch((error) => {
        console.error('[hunt-scheduler] tick failed:', error.message);
      });
    }, schedulerTickMs);
    schedulerTimer.unref?.();
  }

  // Expose the boot-recovery hooks so server.js / tests can drive them explicitly.
  app.locals.jobManager = jobManager;
  app.locals.computerTaskManager = computerTaskManager;
  app.locals.huntScheduler = huntScheduler;
  app.locals.targetQueueService = targetQueueService;
  app.locals.alertService = alertService;
  return app;
}
