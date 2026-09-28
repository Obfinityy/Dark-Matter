import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.APP_ENCRYPTION_KEY) {
  throw new Error('APP_ENCRYPTION_KEY is required in production');
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 4000),
  encryptionKey: process.env.APP_ENCRYPTION_KEY || 'development-only-key-change-me',
  mongoUrl: process.env.MONGO_URL,
  mongoDbName: process.env.MONGO_DB_NAME || 'darkmatter',
  mongoServerSelectionTimeoutMs: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10_000),
  frontendOrigins: (process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  sessionDays: Number(process.env.SESSION_DAYS || 30),
  toolRequestTimeoutMs: Number(process.env.TOOL_REQUEST_TIMEOUT_MS || process.env.AI_REQUEST_TIMEOUT_MS || 20_000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 120),

  // --- Agent Brain ---
  llmApiKey: process.env.LLM_API_KEY || '',
  llmModel: process.env.LLM_MODEL || 'gemini-2.5-flash',
  llmBaseUrl: process.env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
  agentMaxIterations: Number(process.env.AGENT_MAX_ITERATIONS || 50),
  agentIterationDelayMs: Number(process.env.AGENT_ITERATION_DELAY_MS || 1000),
  agentMaxConcurrentTools: Number(process.env.AGENT_MAX_CONCURRENT_TOOLS || 3),

  // --- Tool Execution ---
  toolDefaultTimeoutMs: Number(process.env.TOOL_DEFAULT_TIMEOUT_MS || 120_000),
  toolMaxOutputBytes: Number(process.env.TOOL_MAX_OUTPUT_BYTES || 2_000_000),
  kaliWorkerUrl: process.env.KALI_WORKER_URL || '',

  // --- Report ---
  reportStoragePath: process.env.REPORT_STORAGE_PATH || './data/reports'
};
