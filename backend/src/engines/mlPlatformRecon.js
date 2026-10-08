/**
 * mlPlatformRecon.js — ML & data-platform fingerprinting engine.
 *
 * Detects and fingerprints exposed machine-learning tracking servers,
 * orchestrators and vector databases from HTTP responses — page structures,
 * experiment/tracking API shapes and dashboard endpoints:
 *
 *   idea 00487 — MLflow tracking-server detection (experiment APIs)
 *   idea 00488 — Kubeflow dashboard detection (central dashboard)
 *   idea 00489 — TensorBoard instance detection (data APIs)
 *   idea 00490 — Weaviate/Qdrant vector-DB detection (REST API shapes)
 *
 * Defensive recon only: functions analyse HTTP response data and API payloads
 * handed to them. They never make network requests, never create or mutate
 * experiments, indexes or collections, and never produce exploit code.
 */

/** Shared signature table for the five platforms. */
const ML_PLATFORM_SIGNATURES = [
  {
    service: 'MLflow',
    ui: /<title>\s*MLflow\s*<\/title>|mlflow/i,
    headers: null,
    versionEndpoints: ['/api/2.0/mlflow/experiments/search', '/api/2.0/mlflow/experiments/list'],
    versionPattern:
      /"mlflow-version"\s*:\s*"(\d+\.\d+\.\d+[^"]*)"|mlflow[^\d]*(\d+\.\d+\.\d+[\w.-]*)/i,
  },
  {
    service: 'Kubeflow',
    ui: /Kubeflow\s*central\s*dashboard|centraldashboard|kubeflow/i,
    headers: null,
    versionEndpoints: ['/api/workgroup/env-info', '/api/v1/cluster-info'],
    versionPattern: /"platform"\s*:\s*"[^"]*kubeflow[^"]*"|"kubeflow-version"\s*:\s*"([^"]+)"/i,
  },
  {
    service: 'TensorBoard',
    ui: /<title>\s*TensorBoard\s*<\/title>|tensorboard/i,
    headers: null,
    versionEndpoints: ['/data/runs', '/data/scalars', '/data/plugin/scalars/tags'],
    versionPattern: /"version"\s*:\s*"(\d+\.\d+\.\d+[^"]*)"/i,
  },
  {
    service: 'Weaviate',
    ui: /weaviate/i,
    headers: null,
    versionEndpoints: ['/v1/meta', '/v1/schema', '/v1/objects'],
    versionPattern: /"version"\s*:\s*"(\d+\.\d+\.\d+[^"]*)"/i,
  },
  {
    service: 'Qdrant',
    ui: /qdrant/i,
    headers: null,
    versionEndpoints: ['/', '/collections', '/telemetry'],
    versionPattern: /"version"\s*:\s*"(\d+\.\d+\.\d+[^"]*)"/i,
  },
];

/**
 * Parse a JSON payload safely.
 * @param {string|object} payload
 * @returns {{ok: boolean, data: any}}
 */
function parseJson(payload) {
  if (payload && typeof payload === 'object') return { ok: true, data: payload };
  try {
    return { ok: true, data: JSON.parse(String(payload || '')) };
  } catch {
    return { ok: false, data: null };
  }
}

/**
 * Extract a version disclosed by the ML platform.
 * @param {object} sig — platform signature entry
 * @param {string} body
 * @returns {string|null}
 */
export function extractMlVersion(sig, body) {
  const text = String(body || '');
  if (!sig.versionPattern) return null;
  const m = sig.versionPattern.exec(text);
  if (!m) return null;
  return m[1] || m[2] || null;
}

/**
 * Fingerprint one HTTP response against the ML-platform signature table.
 * @param {{url, status, headers, body}} input — one HTTP response
 * @returns {object} structured finding
 */
export function detectMlPlatform({ url = '', status = 0, headers = {}, body = '' }) {
  const text = String(body || '');
  const headerNames = Object.keys(headers || {}).join(' ');
  const headerValues = Object.values(headers || {}).join(' ');

  for (const sig of ML_PLATFORM_SIGNATURES) {
    let confidence = 'low';
    const evidence = [];

    if (sig.ui.test(text)) {
      confidence = 'medium';
      evidence.push(`Page content matches the ${sig.service} fingerprint.`);
    }
    if (sig.headers && (sig.headers.test(headerNames) || sig.headers.test(headerValues))) {
      confidence = confidence === 'medium' ? 'high' : 'medium';
      evidence.push(`Response headers reference ${sig.service}.`);
    }

    let matchedEndpoint = null;
    for (const ep of sig.versionEndpoints) {
      if (url.toLowerCase().includes(ep.toLowerCase())) {
        matchedEndpoint = ep;
        break;
      }
    }
    if (matchedEndpoint && status === 200) {
      if (confidence === 'low') confidence = 'medium';
      evidence.push(
        `Known ${sig.service} API endpoint ${matchedEndpoint} responded with HTTP 200.`
      );
    }

    if (confidence === 'low') continue;

    const version = extractMlVersion(sig, text);
    if (version) {
      confidence = 'high';
      evidence.push(`Disclosed version: ${version}.`);
    }

    return {
      detected: true,
      service: sig.service,
      endpoint: matchedEndpoint,
      version,
      confidence,
      severity: version ? 'Medium' : 'Low',
      cwe: 'CWE-200',
      evidence: evidence.join(' '),
    };
  }

  return {
    detected: false,
    service: 'ML/data platform',
    reason: 'No known ML or data-platform fingerprint matched.',
  };
}

/**
 * Parse an MLflow experiments API payload into a structured inventory.
 * Experiment names reveal project and team names; the inventory helps the
 * owner audit exposure — it only parses data from an authorized response.
 * @param {string|object} payload — JSON of /api/2.0/mlflow/experiments/search or /list
 * @returns {object} experiment inventory
 */
export function parseMlflowExperiments(payload) {
  const { ok, data } = parseJson(payload);
  if (!ok || !data) {
    return { detected: false, experiments: [], reason: 'Payload is not valid JSON.' };
  }

  const list = Array.isArray(data.experiments) ? data.experiments : [];
  if (!list.length) {
    return { detected: false, experiments: [], reason: 'No experiments found in payload.' };
  }

  const experiments = list.map(e => ({
    experimentId: String(e.experiment_id || e.experimentId || ''),
    name: String(e.name || ''),
    artifactLocation: String(e.artifact_location || e.artifactLocation || ''),
    lifecycleStage: String(e.lifecycle_stage || e.lifecycleStage || ''),
    creationTime: e.creation_time || e.creationTime || null,
    tagCount: Array.isArray(e.tags) ? e.tags.length : 0,
  }));

  const namingHints = experiments
    .map(e => e.name)
    .filter(n => n && !['default', '0'].includes(n.toLowerCase()));

  return {
    detected: true,
    service: 'MLflow',
    experiments,
    experimentCount: experiments.length,
    revealingNames: namingHints,
    severity: namingHints.length ? 'Low' : 'Info',
    cwe: 'CWE-200',
    evidence: namingHints.length
      ? `${experiments.length} experiment(s) disclosed; naming reveals internal project names: ${namingHints.join(', ')}.`
      : `${experiments.length} experiment(s) disclosed; only the default experiment is exposed.`,
  };
}

/**
 * Check a TensorBoard data-API response and summarise its plugin surface.
 * Read-only: confirms the instance and lists enabled plugins from the
 * provided response — no runs are started or modified.
 * @param {{url, status, body}} input — a /data/* response
 * @returns {object} structured finding
 */
export function checkTensorBoardDataApi({ url = '', status = 0, body = '' }) {
  const { ok, data } = parseJson(body);
  const text = String(body || '');

  const isDataEndpoint = /\/data\/(runs|scalars|plugin|experiment|environment)/i.test(url);
  const looksLikeTensorBoard = /tensorboard/i.test(text) || isDataEndpoint;

  if (!looksLikeTensorBoard) {
    return {
      detected: false,
      service: 'TensorBoard',
      reason: 'No TensorBoard data-API fingerprint matched.',
    };
  }

  const plugins =
    ok && data && typeof data === 'object'
      ? Object.keys(data).filter(k => !['version', 'runs'].includes(k))
      : [];
  const runs = ok && Array.isArray(data.runs) ? data.runs.length : null;

  const evidence = [`TensorBoard data API responded at ${url} (HTTP ${status}).`];
  if (runs !== null) evidence.push(`${runs} run(s) visible in the data API.`);
  if (plugins.length) evidence.push(`Enabled plugins: ${plugins.join(', ')}.`);

  return {
    detected: true,
    service: 'TensorBoard',
    endpoint: url,
    plugins,
    runCount: runs,
    confidence: status === 200 ? 'high' : 'medium',
    severity: runs ? 'Low' : 'Info',
    cwe: 'CWE-200',
    evidence: evidence.join(' '),
  };
}

/**
 * Parse a Weaviate /v1/schema or /v1/meta payload into a structured inventory.
 * @param {string|object} payload — JSON of the Weaviate API response
 * @returns {object} class inventory
 */
export function parseWeaviateSchema(payload) {
  const { ok, data } = parseJson(payload);
  if (!ok || !data) {
    return { detected: false, classes: [], reason: 'Payload is not valid JSON.' };
  }

  const version = typeof data.version === 'string' ? data.version : null;
  const classes = Array.isArray(data.classes) ? data.classes : [];

  if (!version && !classes.length) {
    return { detected: false, classes: [], reason: 'No Weaviate meta or schema data found.' };
  }

  return {
    detected: true,
    service: 'Weaviate',
    version,
    classes: classes.map(c => ({
      class: String(c.class || ''),
      vectorIndexType: String((c.vectorIndexConfig && c.vectorIndexConfig.distance) || ''),
      propertyCount: Array.isArray(c.properties) ? c.properties.length : 0,
    })),
    classCount: classes.length,
    confidence: 'high',
    severity: version ? 'Medium' : 'Low',
    cwe: 'CWE-200',
    evidence: version
      ? `Weaviate /v1/meta disclosed version ${version} with ${classes.length} class(es) in the schema.`
      : `Weaviate schema disclosed ${classes.length} class(es).`,
  };
}

/**
 * Parse a Qdrant /collections payload into a structured inventory.
 * @param {string|object} payload — JSON of the Qdrant /collections response
 * @returns {object} collection inventory
 */
export function parseQdrantCollections(payload) {
  const { ok, data } = parseJson(payload);
  if (!ok || !data) {
    return { detected: false, collections: [], reason: 'Payload is not valid JSON.' };
  }

  const result = data.result || {};
  const version = typeof data.version === 'string' ? data.version : null;
  const collections = Array.isArray(result.collections) ? result.collections : [];

  if (!collections.length && !version) {
    return { detected: false, collections: [], reason: 'No Qdrant collections or version found.' };
  }

  return {
    detected: true,
    service: 'Qdrant',
    version,
    collections: collections.map(c => String(c.name || '')),
    collectionCount: collections.length,
    confidence: 'high',
    severity: version ? 'Medium' : 'Low',
    cwe: 'CWE-200',
    evidence: version
      ? `Qdrant root endpoint disclosed version ${version} with ${collections.length} collection(s): ${collections.map(c => c.name || '').join(', ') || 'none listed'}.`
      : `Qdrant collections endpoint listed ${collections.length} collection(s).`,
  };
}

/**
 * Fingerprint a vector-DB response by its REST API shape (Weaviate vs Qdrant).
 * Distinguishes the two engines by their characteristic response shapes:
 * Weaviate /v1/meta and /v1/schema, Qdrant / and /collections.
 * @param {{url, status, body}} input — one HTTP response
 * @returns {object} structured finding
 */
export function detectVectorDb({ url = '', status = 0, body = '' }) {
  const { ok, data } = parseJson(body);
  const text = String(body || '');
  const lowered = url.toLowerCase();

  // Qdrant: root returns {"title":"qdrant - vector search engine","version":"..."}
  if (ok && data && /qdrant/i.test(String(data.title || ''))) {
    return {
      detected: true,
      service: 'Qdrant',
      version: typeof data.version === 'string' ? data.version : null,
      confidence: 'high',
      severity: 'Medium',
      cwe: 'CWE-200',
      evidence: `Qdrant root API shape matched at ${url}; version disclosed: ${data.version || 'unknown'}.`,
    };
  }

  // Weaviate: /v1/meta returns {"hostname":..., "version":"1.x.x", "modules":...}
  if (
    ok &&
    data &&
    typeof data.version === 'string' &&
    (lowered.includes('/v1/meta') || data.modules || data.hostname)
  ) {
    return {
      detected: true,
      service: 'Weaviate',
      version: data.version,
      confidence: 'high',
      severity: 'Medium',
      cwe: 'CWE-200',
      evidence: `Weaviate /v1/meta shape matched at ${url}; version disclosed: ${data.version}.`,
    };
  }

  // Schema/collections shapes without meta fields.
  if (ok && data && Array.isArray(data.classes) && lowered.includes('/v1/schema')) {
    return {
      detected: true,
      service: 'Weaviate',
      version: null,
      confidence: 'high',
      severity: 'Low',
      cwe: 'CWE-200',
      evidence: `Weaviate /v1/schema shape matched at ${url} (${data.classes.length} classes).`,
    };
  }
  if (
    ok &&
    data &&
    data.result &&
    Array.isArray(data.result.collections) &&
    lowered.includes('/collections')
  ) {
    return {
      detected: true,
      service: 'Qdrant',
      version: typeof data.version === 'string' ? data.version : null,
      confidence: 'high',
      severity: 'Low',
      cwe: 'CWE-200',
      evidence: `Qdrant /collections shape matched at ${url} (${data.result.collections.length} collections).`,
    };
  }

  if (/weaviate/i.test(text) || /qdrant/i.test(text)) {
    const service = /weaviate/i.test(text) ? 'Weaviate' : 'Qdrant';
    return {
      detected: true,
      service,
      version: null,
      confidence: 'medium',
      severity: 'Info',
      cwe: 'CWE-200',
      evidence: `Response content references ${service} without a confirming API shape.`,
    };
  }

  return {
    detected: false,
    service: 'vector database',
    reason: 'No Weaviate/Qdrant API shape matched.',
  };
}

export const ML_PLATFORM_RECON = {
  detectMlPlatform,
  extractMlVersion,
  parseMlflowExperiments,
  checkTensorBoardDataApi,
  parseWeaviateSchema,
  parseQdrantCollections,
  detectVectorDb,
  ML_PLATFORM_SIGNATURES,
};
export default ML_PLATFORM_RECON;
