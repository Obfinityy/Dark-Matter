/**
 * exportEndpointRecon.js — export-format discovery and async completion mapping.
 *
 * Ideas 01235–01240: discover supported export formats on list endpoints, map
 * async report job polling, hunt bulk-export routes, enumerate template
 * downloads, check sample-file endpoints, and map polling-vs-webhook
 * completion channels — because export paths generate bulk data files and
 * polling endpoints may enforce less auth than their webhook counterparts on
 * authorized targets.
 *
 * Pure planning and response classification — no network calls are made here;
 * the operator's HTTP layer executes the generated plans and feeds observed
 * responses back into the analyzers.
 */

const EXPORT_FORMATS = ['csv', 'json', 'xlsx', 'pdf', 'xml', 'zip'];

const BULK_EXPORT_ROUTES = [
  '/api/export', '/api/export/all', '/api/exports/all', '/export/all',
  '/api/data/export', '/api/bulk-export', '/api/bulks/export',
  '/api/reports/export-all', '/admin/export/all', '/api/v1/export/all',
];

const TEMPLATE_ROUTES = [
  '/api/templates', '/templates', '/api/import/template',
  '/api/templates/csv', '/api/templates/import', '/downloads/template',
  '/api/v1/templates', '/api/import/templates',
];

const SAMPLE_FILE_ROUTES = [
  '/api/sample.csv', '/api/sample-file', '/samples/sample.csv',
  '/api/export/sample', '/api/templates/sample', '/downloads/sample.csv',
  '/api/sample.json', '/api/reports/sample',
];

const REPORT_JOB_PATTERNS = [
  { path: '/api/reports', method: 'POST', note: 'create async report job' },
  { path: '/api/exports', method: 'POST', note: 'create async export job' },
  { path: '/api/report-jobs', method: 'POST', note: 'create report job' },
];

export const FORMATS = EXPORT_FORMATS;
export const BULK_ROUTES = BULK_EXPORT_ROUTES;
export const TEMPLATE_PATHS = TEMPLATE_ROUTES;
export const SAMPLE_PATHS = SAMPLE_FILE_ROUTES;

const PLACEHOLDER_ROW_HINTS = [/lorem/i, /sample/i, /example\.com/i, /john doe/i, /foo.*bar/i];

/**
 * Build a plan that probes ?format=<fmt> on list endpoints.
 * @param {string[]} listPaths - e.g. ['/api/orders', '/api/users'].
 * @param {object} [options]
 * @param {string[]} [options.formats] - Formats to probe.
 * @returns {{probes: {method: string, path: string, query: Record<string,string>, format: string}[], strategy: string}}
 */
export function discoverExportFormats(listPaths = [], options = {}) {
  const formats = options.formats || EXPORT_FORMATS;
  const probes = [];
  for (const path of listPaths) {
    for (const format of formats) {
      probes.push({ method: 'GET', path, query: { format }, format });
    }
  }
  return {
    probes,
    strategy:
      'Probe ?format= on list endpoints; a Content-Type or Content-Disposition ' +
      'that matches the requested format confirms an export path that can ' +
      'generate bulk data files.',
  };
}

/**
 * Classify one export-format probe response.
 * @param {{status: number, headers?: Record<string,string>, body?: unknown}} response
 * @param {string} format - The format that was requested.
 * @returns {{verdict: string, supported: boolean, evidence: string}}
 */
export function analyzeExportFormatResponse(response = {}, format = '') {
  const { status = 0, headers = {}, body = null } = response;
  if (status < 200 || status >= 300) {
    return { verdict: 'format-rejected', supported: false, evidence: `HTTP ${status} for format "${format}"` };
  }
  const lower = Object.fromEntries(Object.entries(headers || {}).map(([k, v]) => [String(k).toLowerCase(), String(v)]));
  const contentType = (lower['content-type'] || '').toLowerCase();
  const disposition = (lower['content-disposition'] || '').toLowerCase();
  const bodyText = typeof body === 'string' ? body : '';
  const typeMatches =
    (format === 'csv' && /text\/csv/.test(contentType)) ||
    (format === 'xlsx' && /spreadsheetml/.test(contentType)) ||
    (format === 'json' && /json/.test(contentType)) ||
    (format === 'pdf' && /pdf/.test(contentType)) ||
    (format === 'xml' && /xml/.test(contentType)) ||
    (format === 'zip' && /zip/.test(contentType));
  if (disposition.includes('attachment') || typeMatches) {
    return {
      verdict: 'export-supported',
      supported: true,
      evidence: `HTTP ${status} for format "${format}"; ${disposition.includes('attachment') ? 'Content-Disposition: attachment' : `Content-Type: ${contentType}`}`,
    };
  }
  if (format === 'csv' && /^[^,{}\[\]"]*[,\n]/.test(bodyText)) {
    return { verdict: 'export-supported', supported: true, evidence: `HTTP ${status} for format "csv"; body is CSV-shaped` };
  }
  return { verdict: 'format-ignored', supported: false, evidence: `HTTP ${status} for format "${format}"; normal list response returned` };
}

/**
 * Build a plan mapping async report-generation job endpoints.
 * @param {object} [options]
 * @param {string} [options.jobId='123'] - Probe ID for status/download paths.
 * @returns {{probes: {method: string, path: string, note: string}[], strategy: string}}
 */
export function mapAsyncReportPolling(options = {}) {
  const jobId = options.jobId || '123';
  const probes = [];
  for (const { path, method, note } of REPORT_JOB_PATTERNS) {
    probes.push({ method, path, note });
  }
  for (const statusPath of ['/api/reports/{id}/status', '/api/exports/{id}', '/api/report-jobs/{id}']) {
    probes.push({ method: 'GET', path: statusPath.replace('{id}', jobId), note: 'poll job status' });
  }
  for (const dlPath of ['/api/reports/{id}/download', '/api/exports/{id}/download', '/api/report-jobs/{id}/download']) {
    probes.push({ method: 'GET', path: dlPath.replace('{id}', jobId), note: 'fetch job artifact' });
  }
  return {
    probes,
    strategy:
      'Trace the async lifecycle: creation endpoint, status-polling endpoint, ' +
      'then artifact-download endpoint. Record which steps expose status or ' +
      'download URLs, and whether they enforce auth differently.',
  };
}

/**
 * Classify one async report-job response.
 * @param {{status: number, headers?: Record<string,string>, body?: unknown}} response
 * @param {string} [stage='status'] - 'create' | 'status' | 'download'.
 * @returns {{verdict: string, exposesArtifact: boolean, evidence: string}}
 */
export function analyzeReportJobResponse(response = {}, stage = 'status') {
  const { status = 0, body = null } = response;
  if (status === 401 || status === 403) {
    return { verdict: 'auth-enforced', exposesArtifact: false, evidence: `HTTP ${status} at stage "${stage}"; auth enforced` };
  }
  if (status < 200 || status >= 300) {
    return { verdict: 'unavailable', exposesArtifact: false, evidence: `HTTP ${status} at stage "${stage}"` };
  }
  const text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
  const hasDownloadUrl = /https?:\/\/[^"'\s]+\.(csv|xlsx|pdf|zip|json)/i.test(text) || /download/i.test(text);
  const hasStatus = /status/i.test(text);
  if (stage === 'download' && (hasDownloadUrl || status === 200)) {
    return { verdict: 'artifact-exposed', exposesArtifact: true, evidence: `HTTP ${status} at stage "${stage}"; artifact reachable` };
  }
  return {
    verdict: hasStatus ? 'status-exposed' : 'present',
    exposesArtifact: false,
    evidence: `HTTP ${status} at stage "${stage}"${hasStatus ? '; job status readable' : ''}`,
  };
}

/**
 * Build a plan hunting bulk-export routes that bypass pagination.
 * @param {object} [options]
 * @param {string[]} [options.routes] - Candidate bulk routes.
 * @returns {{probes: {method: string, path: string, note: string}[], strategy: string}}
 */
export function huntBulkExportEndpoints(options = {}) {
  const routes = options.routes || BULK_EXPORT_ROUTES;
  return {
    probes: routes.map(path => ({ method: 'GET', path, note: 'bulk export candidate' })),
    strategy:
      'Hunt /export/all-style routes; a 2xx binary or CSV body here means a ' +
      'pagination bypass — the endpoint can dump the whole collection.',
  };
}

/**
 * Classify one bulk-export probe response.
 * @param {{status: number, headers?: Record<string,string>, body?: unknown}} response
 * @returns {{verdict: string, bulkDump: boolean, evidence: string}}
 */
export function analyzeBulkExportResponse(response = {}) {
  const { status = 0, body = null } = response;
  if (status === 401 || status === 403) {
    return { verdict: 'auth-enforced', bulkDump: false, evidence: `HTTP ${status}; auth enforced` };
  }
  if (status < 200 || status >= 300) {
    return { verdict: 'not-present', bulkDump: false, evidence: `HTTP ${status}` };
  }
  const text = typeof body === 'string' ? body : '';
  const rows = text.split('\n').filter(l => l.trim().length > 0).length;
  if (rows > 20) {
    return { verdict: 'bulk-dump', bulkDump: true, evidence: `HTTP ${status}; ${rows} data rows without pagination` };
  }
  return { verdict: 'present', bulkDump: false, evidence: `HTTP ${status}; ${rows} row(s), no bulk dump signal` };
}

/**
 * Build a plan enumerating import-template downloads.
 * @param {object} [options]
 * @param {string[]} [options.routes] - Candidate template routes.
 * @returns {{probes: {method: string, path: string, note: string}[], strategy: string}}
 */
export function enumerateTemplateDownloads(options = {}) {
  const routes = options.routes || TEMPLATE_ROUTES;
  return {
    probes: routes.map(path => ({ method: 'GET', path, note: 'import template candidate' })),
    strategy:
      'Fetch template files; their headers reveal the accepted import schema ' +
      'and internal field names the UI never documents.',
  };
}

/**
 * Extract the schema (header row) from a template response.
 * @param {{status: number, headers?: Record<string,string>, body?: unknown}} response
 * @returns {{verdict: string, schema: string[], evidence: string}}
 */
export function analyzeTemplateResponse(response = {}) {
  const { status = 0, body = null } = response;
  if (status < 200 || status >= 300) {
    return { verdict: 'not-present', schema: [], evidence: `HTTP ${status}` };
  }
  const text = typeof body === 'string' ? body : '';
  const firstLine = text.split('\n')[0] || '';
  const schema = firstLine.split(/[,\t;|]/).map(c => c.trim()).filter(c => c.length > 0 && c.length < 80);
  if (schema.length >= 2) {
    return {
      verdict: 'schema-revealed',
      schema,
      evidence: `HTTP ${status}; template exposes ${schema.length} field(s): ${schema.slice(0, 8).join(', ')}${schema.length > 8 ? ', …' : ''}`,
    };
  }
  return { verdict: 'template-unparsed', schema: [], evidence: `HTTP ${status}; no parseable header row` };
}

/**
 * Build a plan checking sample-file endpoints.
 * @param {object} [options]
 * @param {string[]} [options.routes] - Candidate sample routes.
 * @returns {{probes: {method: string, path: string, note: string}[], strategy: string}}
 */
export function checkSampleFileEndpoints(options = {}) {
  const routes = options.routes || SAMPLE_FILE_ROUTES;
  return {
    probes: routes.map(path => ({ method: 'GET', path, note: 'sample file candidate' })),
    strategy:
      'Download sample files; samples that contain real production rows — ' +
      'rather than obvious placeholder data — are data exposure, not docs.',
  };
}

/**
 * Decide whether a sample file looks like real production data.
 * @param {{status: number, headers?: Record<string,string>, body?: unknown}} response
 * @returns {{verdict: string, looksReal: boolean, rowCount: number, evidence: string}}
 */
export function analyzeSampleFileResponse(response = {}) {
  const { status = 0, body = null } = response;
  if (status < 200 || status >= 300) {
    return { verdict: 'not-present', looksReal: false, rowCount: 0, evidence: `HTTP ${status}` };
  }
  const text = typeof body === 'string' ? body : '';
  const rows = text.split('\n').filter(l => l.trim().length > 0);
  const bodyRows = rows.length > 1 ? rows.slice(1) : [];
  const placeholderHits = PLACEHOLDER_ROW_HINTS.filter(r => r.test(text)).length;
  const looksReal = bodyRows.length >= 3 && placeholderHits === 0;
  return {
    verdict: looksReal ? 'production-rows' : 'placeholder-sample',
    looksReal,
    rowCount: bodyRows.length,
    evidence: `HTTP ${status}; ${bodyRows.length} data row(s), ${placeholderHits} placeholder hint(s)`,
  };
}

/**
 * Build a plan comparing job-completion channels: polling vs webhook.
 * @param {object} [options]
 * @param {string} [options.jobId='123'] - Probe ID for the poll path.
 * @returns {{probes: {method: string, path: string, note: string}[], strategy: string}}
 */
export function mapCompletionChannels(options = {}) {
  const jobId = options.jobId || '123';
  return {
    probes: [
      { method: 'GET', path: `/api/report-jobs/${jobId}`, note: 'poll completion status' },
      { method: 'POST', path: '/api/webhooks/report-complete', note: 'register webhook callback' },
      { method: 'POST', path: '/api/report-jobs', note: 'create job with callback_url field' },
      { method: 'GET', path: `/api/report-jobs/${jobId}`, note: 'poll WITHOUT auth headers (auth-delta probe)' },
    ],
    strategy:
      'Compare the completion channels side by side: polling endpoints must ' +
      'enforce the same auth as webhook registration. A polling status that ' +
      'works without auth while webhooks require it is an auth-enforcement gap.',
  };
}

/**
 * Classify the polling-vs-webhook auth comparison.
 * @param {{polling: {status: number}, webhook: {status: number}, unauthPoll: {status: number}}} observed
 * @returns {{verdict: string, authGap: boolean, evidence: string}}
 */
export function analyzeCompletionChannels(observed = {}) {
  const polling = observed.polling?.status ?? 0;
  const webhook = observed.webhook?.status ?? 0;
  const unauthPoll = observed.unauthPoll?.status ?? 0;
  const authGap = unauthPoll >= 200 && unauthPoll < 300;
  if (authGap) {
    return {
      verdict: 'auth-gap',
      authGap: true,
      evidence: `Polling OK without auth (HTTP ${unauthPoll}) while webhook registration returns HTTP ${webhook}; completion channel skips auth the webhook enforces`,
    };
  }
  if (webhook === 401 || webhook === 403) {
    return { verdict: 'consistent', authGap: false, evidence: `Polling HTTP ${polling}, webhook HTTP ${webhook}; both gated` };
  }
  return { verdict: 'inconclusive', authGap: false, evidence: `Polling HTTP ${polling}, webhook HTTP ${webhook}, unauth-poll HTTP ${unauthPoll}` };
}
