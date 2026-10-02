/**
 * paramMiner.js — Hidden parameter discovery.
 *
 * Tests common hidden/debug parameters that often reveal:
 *  - Debug modes (?debug=true, ?test=1)
 *  - Admin toggles (?admin=true)
 *  - API version switches (?v=2, ?api_version=beta)
 */

const HIDDEN_PARAMS = [
  'debug', 'test', 'admin', 'dev', 'staging', 'beta',
  'api_version', 'v', 'version', 'format', 'callback',
  'show_all', 'all', 'limit', 'offset', 'page_size',
  'include', 'expand', 'fields', 'verbose', 'trace',
];

const DEBUG_VALUES = ['true', '1', 'yes', 'on'];

/**
 * Generate parameter-mining test URLs.
 * @param {string} baseUrl URL without query string
 * @returns {string[]} test URLs
 */
export function mineParams(baseUrl = '') {
  const clean = baseUrl.split('?')[0].split('#')[0];
  const urls = [];
  for (const param of HIDDEN_PARAMS) {
    for (const val of DEBUG_VALUES.slice(0, 2)) { // limit combos
      urls.push(`${clean}?${param}=${val}`);
    }
  }
  return urls;
}

/**
 * Analyze a response for signs a hidden param worked.
 * Returns { interesting, reasons[] }.
 */
export function analyzeParamResponse({ url, statusCode, body, baselineBody }) {
  const reasons = [];
  const text = String(body || '');
  const baseline = String(baselineBody || '');

  // Status changed vs baseline
  // (caller provides baseline)

  // Debug info leaked
  if (/debug|stack trace|traceback|sql query/i.test(text) && !/debug|stack trace/i.test(baseline)) {
    reasons.push('Debug information appeared');
  }

  // Significantly more content
  if (text.length > baseline.length * 1.5 && baseline.length > 100) {
    reasons.push(`Response ${Math.round(text.length / baseline.length)}x larger than baseline`);
  }

  // Admin/debug keywords
  if (/admin panel|debug mode|development mode/i.test(text)) {
    reasons.push('Admin/debug keywords in response');
  }

  return { interesting: reasons.length > 0, reasons, url };
}

export const PARAM_MINER = { mineParams, analyzeParamResponse, HIDDEN_PARAMS };
export default PARAM_MINER;
