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
    eventService
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
    longContextEngine, longGenerationEngine
  };
  app.locals.shutdown = async () => {
    // Stop all running assessments on shutdown
    for (const [id] of agentBrain.runningAssessments) {
      agentBrain.stop(id);
    }
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
      infiniteChat: createInfiniteChatController({ longContextEngine, longGenerationEngine })
    }
  }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
