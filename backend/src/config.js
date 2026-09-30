import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.APP_ENCRYPTION_KEY) {
  throw new Error('APP_ENCRYPTION_KEY is required in production');
}

function resolvePhoneAiBaseUrl() {
  const host = (process.env.PHONE_AI_HOST || '127.0.0.1').trim();
  const port = Number(process.env.PHONE_AI_PORT || 4891);
  const rawBaseUrl = (process.env.PHONE_AI_BASE_URL || '').trim();

  if (!rawBaseUrl) {
    return `http://${host}:${port}/v1`;
  }

  let baseUrl = rawBaseUrl
    .replace(/\$\{PHONE_AI_HOST\}/g, host)
    .replace(/\$\{PHONE_AI_PORT\}/g, String(port));

  if (process.env.PHONE_AI_HOST) {
    try {
      const parsed = new URL(baseUrl);
      if (parsed.hostname !== host) {
        parsed.hostname = host;
        baseUrl = parsed.toString().replace(/\/$/, '');
      }
    } catch (_) {}
  }

  return baseUrl;
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
  // 0 = unlimited (no artificial step cap). The autonomous worker has no cap at
  // all; this only applies to the legacy in-request investigation loop.
  agentMaxIterations: Number(process.env.AGENT_MAX_ITERATIONS || 0),
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
  phoneAiBaseUrl: resolvePhoneAiBaseUrl(),
  phoneAiEnabled: process.env.PHONE_AI_ENABLED === 'true',
  phoneAiModel: process.env.PHONE_AI_MODEL || 'local',
  phoneAiApiKey: process.env.PHONE_AI_API_KEY || '',

  // --- Autonomous Job Worker ---
  // NOTE: there is deliberately NO step/time/token quota here. The only limits
  // are real environment limits (phone offline, computer unavailable, tool crash).
  agentWorker: {
    pollIntervalMs: Number(process.env.AGENT_WORKER_POLL_MS || 500),
    idleDelayMs: Number(process.env.AGENT_WORKER_IDLE_MS || 1000),
    leaseMs: Number(process.env.AGENT_WORKER_LEASE_MS || 30_000),
    phoneUnavailableRetryMs: Number(process.env.AGENT_PHONE_RETRY_MS || 15_000),
    computerUnavailableRetryMs: Number(process.env.AGENT_COMPUTER_RETRY_MS || 10_000),
    recoverOnBoot: process.env.AGENT_WORKER_RECOVER_ON_BOOT !== 'false',
    autoStartWorker: process.env.AGENT_WORKER_AUTOSTART !== 'false'
  },

  // --- Computer Control (Open-Interface adapter) ---
  computer: {
    enabled: process.env.COMPUTER_CONTROL_ENABLED === 'true',
    pythonBin: process.env.COMPUTER_PYTHON_BIN || '',
    bridgePath: process.env.COMPUTER_BRIDGE_PATH || '',
    // No artificial short timeouts: a screenshot on a loaded desktop can take seconds.
    actionTimeoutMs: Number(process.env.COMPUTER_ACTION_TIMEOUT_MS || 60_000),
    probeTimeoutMs: Number(process.env.COMPUTER_PROBE_TIMEOUT_MS || 20_000),
    idleShutdownMs: Number(process.env.COMPUTER_IDLE_SHUTDOWN_MS || 300_000),
    requireApproval: process.env.COMPUTER_REQUIRE_APPROVAL !== 'false',
    maxScreenshotBytes: Number(process.env.COMPUTER_MAX_SCREENSHOT_BYTES || 4_000_000)
  },

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
