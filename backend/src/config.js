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
  reportStoragePath: process.env.REPORT_STORAGE_PATH || './data/reports',

  // --- Phone AI ---
  phoneAiHost: process.env.PHONE_AI_HOST || '',
  phoneAiPort: Number(process.env.PHONE_AI_PORT || 4891),
  phoneAiBaseUrl: process.env.PHONE_AI_BASE_URL || `http://${process.env.PHONE_AI_HOST || '127.0.0.1'}:4891/v1`,
  phoneAiEnabled: process.env.PHONE_AI_ENABLED === 'true',
  phoneAiModel: process.env.PHONE_AI_MODEL || 'local',
  phoneAiApiKey: process.env.PHONE_AI_API_KEY || '',

  // --- Infinity Long-Context Engine ---
  longContext: {
    // Model-side capacity (tokens) — the model stays FINITE; the engine
    // virtualizes around it. See services/longContext/.
    modelContextTokens: Number(process.env.PHONE_AI_CONTEXT_TOKENS || 4096),
    outputReserveTokens: Number(process.env.LONG_CONTEXT_OUTPUT_RESERVE || 768),
    inputThresholdChars: Number(process.env.LONG_CONTEXT_INPUT_THRESHOLD || 8000),
    chunkTargetChars: Number(process.env.LONG_CONTEXT_CHUNK_TARGET || 6000),
    chunkOverlapTokens: Number(process.env.LONG_CONTEXT_CHUNK_OVERLAP || 200),
    summaryGroupSize: Number(process.env.LONG_CONTEXT_SUMMARY_GROUP || 4),
    partMaxTokens: Number(process.env.LONG_CONTEXT_PART_MAX_TOKENS || 700),
    maxParts: Number(process.env.LONG_CONTEXT_MAX_PARTS || 120),
    repairLoops: Number(process.env.LONG_CONTEXT_REPAIR_LOOPS || 2)
  }
};
