import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { SecretBox } from './core/crypto.js';
import { MongoDatabase } from './models/database.js';
import { ProviderModel } from './models/providerModel.js';
import { ScanModel } from './models/scanModel.js';
import { TargetModel } from './models/targetModel.js';
import { UserModel } from './models/userModel.js';
import { SessionModel } from './models/sessionModel.js';
import { AssessmentModel } from './models/assessmentModel.js';
import { AgentStateModel } from './models/agentStateModel.js';
import { ToolExecutionModel } from './models/toolExecutionModel.js';
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
import { createJobController } from './controllers/jobController.js';
import { createComputerController } from './controllers/computerController.js';
import { createComputerTaskController } from './controllers/computerTaskController.js';
import { AgentJobModel } from './models/agentJobModel.js';
import { ComputerTaskModel } from './models/computerTaskModel.js';
import { ComputerTaskBrain } from './agent/computerTaskBrain.js';
import { ComputerTaskWorker } from './jobs/computerTaskWorker.js';
import { ComputerTaskManager } from './services/computerTaskManager.js';
import { AgentMemoryModel } from './models/agentMemoryModel.js';
import { EvidenceModel } from './models/evidenceModel.js';
import { AgentMemory } from './agent/memory/agentMemory.js';
import { AutonomousBrain } from './agent/autonomousBrain.js';
import { ContextBudgetManager } from './services/longContext/contextBudgetManager.js';
import { ComputerState } from './computer/computerState.js';
import { ComputerEvents } from './computer/computerEvents.js';
import { OpenInterfaceAdapter } from './computer/openInterfaceAdapter.js';
import { FindingLifecycleService } from './services/findingLifecycleService.js';
import { AgentWorker } from './jobs/agentWorker.js';
import { JobManager } from './jobs/jobManager.js';
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

export async function createApp({ database = new MongoDatabase(config) } = {}) {
  await database.init();

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
  const findingModel = new FindingModel(database);
  const reportModel = new ReportModel(database);
  const agentJobModel = new AgentJobModel(database);
  const agentMemoryModel = new AgentMemoryModel(database);
  const evidenceModel = new EvidenceModel(database);

  // ─── Existing Services ────────────────────────────────────────────
  const authService = new AuthService({ userModel, sessionModel, sessionDays: config.sessionDays });
  const eventService = new EventService(database);
  const subdomainService = new SubdomainService({ scanModel, targetModel, eventService });
  const scanService = new ScanService({ targetModel, scanModel, eventService, subdomainService });

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

  // ─── Autonomous Brain (local phone Gemma ONLY) ────────────────────
  const autonomousBrain = new AutonomousBrain({
    memory: agentMemory,
    eventService,
    computer: computerAdapter
  });

  // ─── Persistent Job Worker ────────────────────────────────────────
  const agentWorker = new AgentWorker({
    jobModel: agentJobModel,
    assessmentModel,
    brain: autonomousBrain,
    memory: agentMemory,
    toolExecutor,
    toolExecutionModel,
    computer: computerAdapter,
    computerState,
    computerEvents,
    findingLifecycle,
    evidenceModel,
    stateManager,
    eventService,
    reportService,
    findingModel
  });

  const jobManager = new JobManager({
    jobModel: agentJobModel,
    assessmentModel,
    worker: agentWorker,
    eventService,
    config: config.agentWorker
  });

  // ─── InfiniteChat Computer Tasks (local brain + shared hands) ──────
  // Logically separated from the bug-bounty agent (own model/worker/manager/
  // endpoints) but reusing the SAME computer layer and LocalAIQueue — never a
  // second bridge, never a second action protocol (#29, #30).
  const computerTaskModel = new ComputerTaskModel(database);
  const computerTaskBrain = new ComputerTaskBrain({});
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

  // ─── Infinity Long-Context Engine ─────────────────────────────────
  // Application-level context virtualization over the finite local model.
  const phoneModel = new PhoneModelAdapter();
  const longContextStore = new LongContextStore(database);
  const longContextEngine = new LongContextEngine({ store: longContextStore, model: phoneModel });
  longContextEngine.chatModel = infiniteChatModel; // conversation history stays in infinite_chats
  const longGenerationStore = new LongGenerationStore(database);
  const longGenerationEngine = new LongGenerationEngine({ store: longGenerationStore, model: phoneModel });

  // ─── Express App ──────────────────────────────────────────────────
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || config.frontendOrigins.includes(origin)) return callback(null, true);
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
    computerTaskModel, computerTaskBrain, computerTaskWorker, computerTaskManager
  };
  app.locals.shutdown = async () => {
    // Stop all running assessments on shutdown
    for (const [id] of agentBrain.runningAssessments) {
      agentBrain.stop(id);
    }
    // Stop the autonomous worker and the computer bridge, then close Mongo.
    await agentWorker.stopAll();
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
      infiniteChat: createInfiniteChatController({ longContextEngine, longGenerationEngine, computerTaskManager }),
      jobs: createJobController({ jobManager, assessmentService, eventService, computerAdapter }),
      computer: createComputerController({ computerAdapter, assessmentModel }),
      computerTasks: createComputerTaskController({ computerTaskManager, computerAdapter })
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

  // Expose the boot-recovery hooks so server.js / tests can drive them explicitly.
  app.locals.jobManager = jobManager;
  app.locals.computerTaskManager = computerTaskManager;
  return app;
}
