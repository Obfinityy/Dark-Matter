import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { SecretBox } from './core/crypto.js';
import { MongoDatabase } from './models/database.js';
import { ProviderModel } from './models/providerModel.js';
import { ScanModel } from './models/scanModel.js';
import { TargetModel } from './models/targetModel.js';
import { UserModel } from './models/userModel.js';
import { SessionModel } from './models/sessionModel.js';
import { EventService } from './services/eventService.js';
import { ScanService } from './services/scanService.js';
import { SubdomainService } from './services/subdomainService.js';
import { AuthService } from './services/authService.js';
import { attachAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createAgentController } from './controllers/agentController.js';
import { createAuthController } from './controllers/authController.js';
import { agentInfo, health } from './controllers/healthController.js';
import { createScanController } from './controllers/scanController.js';
import { createSettingsController } from './controllers/settingsController.js';
import { createTargetController } from './controllers/targetController.js';
import { listTools } from './controllers/toolController.js';
import { createRoutes } from './routes/index.js';

export async function createApp({ database = new MongoDatabase(config) } = {}) {
  await database.init();
  const providerModel = new ProviderModel(database, new SecretBox(config.encryptionKey));
  const targetModel = new TargetModel(database);
  const scanModel = new ScanModel(database);
  const userModel = new UserModel(database);
  const sessionModel = new SessionModel(database);
  const authService = new AuthService({ userModel, sessionModel, sessionDays: config.sessionDays });
  const eventService = new EventService(database);
  const subdomainService = new SubdomainService({ scanModel, targetModel, eventService });
  const scanService = new ScanService({ targetModel, scanModel, eventService, subdomainService });

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
  app.use(rateLimit({ windowMs: 60_000, max: config.rateLimitMax, standardHeaders: true, legacyHeaders: false }));
  app.use(express.json({ limit: '64kb' }));
  app.locals.services = { database, providerModel, targetModel, scanModel, eventService, scanService, subdomainService, authService };
  app.locals.shutdown = () => database.close();

  app.use('/api/v1', createRoutes({
    controllers: {
      health: { health, agentInfo },
      auth: { ...createAuthController(authService, config), attach: attachAuth(authService) },
      settings: createSettingsController(providerModel),
      tools: { listTools },
      targets: createTargetController(targetModel),
      scans: createScanController(scanService, eventService),
      agent: createAgentController(scanService)
    }
  }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
