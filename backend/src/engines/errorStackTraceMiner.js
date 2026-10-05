/**
 * errorStackTraceMiner.js — Error-page stack-trace mining for autonomous bug bounty.
 *
 * Implements idea-bank item 00407: mine recorded 404/500 error pages for
 * stack traces that disclose the framework, library versions, and internal
 * file-system paths.
 *
 * During an authorized engagement the caller triggers benign error pages
 * (for example a nonexistent path) and records the response bodies. This
 * module is pure analysis of those recorded bodies: it extracts stack
 * frames, identifies frameworks, and pulls versions and paths from the
 * text. No requests are sent by this module.
 */

/**
 * Extract stack-trace frames from error-page text. Recognizes Python
 * tracebacks, Java/JVM stacks, Node.js stacks, PHP traces, Ruby traces,
 * and .NET stack traces.
 * @param {string} text Error page text or HTML.
 * @returns {Array<{language:string, frame:string}>}
 */
export function extractStackFrames(text) {
  const body = typeof text === 'string' ? text : '';
  const frames = [];
  const patterns = [
    ['python', /File "([^"]+)", line (\d+), in ([^\n<]+)/g],
    ['java', /at ([\w.$]+)\(([\w.]+):(\d+)\)/g],
    ['node', /at ([^\s(]+) \(([^():]+):(\d+):(\d+)\)/g],
    ['php', /#\d+ ([^(]+\([^)]*\)): ([^(:]+)\((\d+)\):/g],
    ['ruby', /from ([^:]+):(\d+):in `([^']+)'/g],
    ['dotnet', /at ([\w.]+)\(\) in ([^:]+):line (\d+)/g],
  ];
  for (const [language, re] of patterns) {
    let m;
    const rx = new RegExp(re.source, re.flags);
    let count = 0;
    while ((m = rx.exec(body)) !== null && count < 200) {
      frames.push({ language, frame: m[0].slice(0, 300) });
      count++;
    }
  }
  return frames;
}

/**
 * Identify the web framework from error-page markers.
 * @param {string} text Error page text or HTML.
 * @returns {{framework:string|null, confidence:number, evidence:string[]}}
 */
export function identifyFramework(text) {
  const body = typeof text === 'string' ? text : '';
  const evidence = [];
  const checks = [
    ['Django', [/django/i, /DisallowedHost|Requested URL/i]],
    ['Flask', [/werkzeug/i, /flask/i]],
    ['Laravel', [/laravel/i, /Whoops, looks like something went wrong/i]],
    ['Symfony', [/symfony/i, /Kernel::/i]],
    ['Ruby on Rails', [/actionpack|rails/i, /Showing .* where line #\d+ raised/i]],
    ['Express', [/express/i, /at .*node_modules\/express/i]],
    ['ASP.NET', [/asp\.net/i, /System\.Web\.|Server Error in '\/' Application/i]],
    ['Spring Boot', [/whitelabel error page/i, /org\.springframework/i]],
    ['Next.js', [/next\.js/i, /_next\/static/i]],
    ['WordPress', [/wp-includes|wp-content/i]],
  ];
  let best = null;
  let bestScore = 0;
  for (const [framework, regexes] of checks) {
    let score = 0;
    for (const re of regexes) {
      if (re.test(body)) {
        score++;
        evidence.push(`${framework} marker: ${re.source.slice(0, 60)}`);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = framework;
    }
  }
  const confidence = best ? Math.min(1, 0.5 + bestScore * 0.25) : 0;
  return { framework: best, confidence: Math.round(confidence * 100) / 100, evidence };
}

/**
 * Extract software version strings adjacent to known product names.
 * @param {string} text Error page text or HTML.
 * @returns {Array<{product:string, version:string}>}
 */
export function extractVersions(text) {
  const body = typeof text === 'string' ? text : '';
  const out = [];
  const seen = new Set();
  const patterns = [
    /([A-Za-z][\w.+-]*)\s+version\s+(\d+\.\d+(?:\.\d+)?)/gi,
    /(Django|Flask|Laravel|Symfony|Rails|Express|Spring|Tomcat|nginx|Apache|PHP|Python|Node\.js|Werkzeug)\/?\s*v?(\d+\.\d+(?:\.\d+)?)/gi,
    /"version"\s*:\s*"(\d+\.\d+(?:\.\d+)?)"/gi,
  ];
  for (const re of patterns) {
    let m;
    const rx = new RegExp(re.source, re.flags);
    while ((m = rx.exec(body)) !== null) {
      const product = m[2] ? m[1] : 'unknown';
      const version = m[2] || m[1];
      const key = `${product}@${version}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ product, version });
      }
      if (out.length >= 50) break;
    }
  }
  return out;
}

/**
 * Extract internal file-system paths leaked in stack frames.
 * @param {string} text Error page text or HTML.
 * @returns {Array<string>} Deduplicated absolute paths (capped).
 */
export function extractInternalPaths(text) {
  const body = typeof text === 'string' ? text : '';
  const found = new Set();
  const patterns = [
    /"(?:\/[A-Za-z0-9_.-]+)+(?:\/[A-Za-z0-9_.-]+)*"/g,
    /[A-Za-z]:\\(?:[A-Za-z0-9_.-]+\\)+[A-Za-z0-9_.-]*/g,
  ];
  for (const re of patterns) {
    let m;
    const rx = new RegExp(re.source, re.flags);
    while ((m = rx.exec(body)) !== null && found.size < 100) {
      found.add(m[0].replace(/^"|"$/g, ''));
    }
  }
  return [...found];
}

/**
 * Mine one recorded error page end to end.
 * @param {string} html Recorded error-page body.
 * @param {object} opts { status?: number|null, url?: string }.
 * @returns {{status:number|null, url:string|null, frames:Array, framework:object, versions:Array, internalPaths:Array, leakScore:number, summary:string}}
 */
export function mineErrorPage(html, opts = {}) {
  const frames = extractStackFrames(html);
  const framework = identifyFramework(html);
  const versions = extractVersions(html);
  const internalPaths = extractInternalPaths(html);
  let leakScore = 0;
  if (frames.length > 0) leakScore += 2;
  if (framework.framework) leakScore += 2;
  leakScore += Math.min(3, versions.length);
  leakScore += Math.min(3, internalPaths.length);
  const status = typeof opts.status === 'number' ? opts.status : null;
  const url = typeof opts.url === 'string' ? opts.url : null;
  const bits = [];
  if (framework.framework) bits.push(`framework: ${framework.framework}`);
  if (versions.length > 0) bits.push(`versions: ${versions.map((v) => `${v.product} ${v.version}`).join(', ')}`);
  if (internalPaths.length > 0) bits.push(`${internalPaths.length} internal path(s)`);
  if (frames.length > 0) bits.push(`${frames.length} stack frame(s)`);
  return {
    status, url, frames, framework, versions, internalPaths,
    leakScore,
    summary: bits.length > 0 ? `Error page leaks ${bits.join('; ')}.` : 'Error page reveals no stack-trace information.',
  };
}
