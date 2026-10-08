/**
 * debugErrorPageDetector.js — Debug-mode error-page detection for autonomous bug bounty.
 *
 * Implements idea-bank item 00408: detect verbose debug error pages (Django,
 * Laravel, Rails, Symfony, ASP.NET) that leak internals such as settings,
 * environment variables, SQL queries, and source code excerpts.
 *
 * During an authorized engagement the caller triggers a benign error and
 * records the response body. This module analyzes the recorded body for the
 * unmistakable markers of framework debug pages, scores the exposure, and
 * lists the categories of leaked internals. No requests are sent here.
 */

/**
 * Debug-page signatures per framework. Each entry lists marker patterns that
 * only appear when the framework's debug mode is enabled.
 */
export const DEBUG_SIGNATURES = [
  {
    framework: 'Django',
    markers: [
      /you have <code>DEBUG = True<\/code>/i,
      /You're seeing this error because you have <code>DEBUG = True<\/code>/i,
      /<title>.*DisallowedHost.*<\/title>/i,
      /technical_500_response|technical_404_response/i,
    ],
    leaks: [
      'settings module path',
      'installed apps',
      'template context',
      'local variables',
      'SQL queries',
    ],
  },
  {
    framework: 'Laravel',
    markers: [
      /Whoops, looks like something went wrong/i,
      /ignition/i,
      /laravel\/framework/i,
      /APP_DEBUG/i,
    ],
    leaks: ['environment variables', 'stack frames', 'request data', 'application path'],
  },
  {
    framework: 'Ruby on Rails',
    markers: [
      /Showing <i>.*<\/i> where line <b>#\d+<\/b> raised/i,
      /Rails::Info|actionpack/i,
      /Request<\/dt>\s*<dd>Parameters/i,
    ],
    leaks: ['request parameters', 'session data', 'source excerpt', 'framework path'],
  },
  {
    framework: 'Symfony',
    markers: [/sf-toolbar|symfony.*profiler/i, /_profiler/i, /ExceptionController/i],
    leaks: ['profiler token', 'request attributes', 'service container hints'],
  },
  {
    framework: 'ASP.NET',
    markers: [
      /Server Error in '\/' Application/i,
      /<!-- Web\.Config Configuration File -->/i,
      /customErrors mode/i,
      /Compilation Error/i,
    ],
    leaks: ['source file paths', 'compiler output', 'stack trace', 'web.config hints'],
  },
  {
    framework: 'Flask',
    markers: [
      /The console is locked and needs to be unlocked/i,
      /Werkzeug Debug/i,
      /Debugger PIN/i,
    ],
    leaks: ['interactive debugger console', 'debugger PIN prompt', 'traceback frames'],
  },
];

/**
 * Detect whether a recorded error page is a framework debug page.
 * @param {string} html Recorded error-page body.
 * @returns {{isDebug:boolean, framework:string|null, confidence:number, matchedMarkers:string[], leakedInternals:string[], severity:string}}
 */
export function detectDebugPage(html) {
  const body = typeof html === 'string' ? html : '';
  let best = null;
  let bestHits = [];
  for (const sig of DEBUG_SIGNATURES) {
    const hits = sig.markers.filter(re => re.test(body)).map(re => re.source.slice(0, 70));
    if (hits.length > bestHits.length) {
      best = sig;
      bestHits = hits;
    }
  }
  if (!best || bestHits.length === 0) {
    return {
      isDebug: false,
      framework: null,
      confidence: 0,
      matchedMarkers: [],
      leakedInternals: [],
      severity: 'info',
    };
  }
  const confidence = Math.min(1, 0.45 + bestHits.length * 0.2);
  const interactive = /console is locked|Debugger PIN|eval\(|interactive/i.test(body);
  return {
    isDebug: true,
    framework: best.framework,
    confidence: Math.round(confidence * 100) / 100,
    matchedMarkers: bestHits,
    leakedInternals: best.leaks,
    severity: interactive ? 'critical' : 'high',
  };
}

/**
 * Scan a batch of recorded error pages for debug-mode exposure.
 * @param {Array<{url?:string, status?:number, html?:string}>} pages Recorded error pages.
 * @returns {{exposed:Array<{url:string|null, status:number|null, framework:string|null, confidence:number, severity:string, leakedInternals:string[]}>, clean:number, total:number}}
 */
export function scanErrorPages(pages) {
  const list = Array.isArray(pages) ? pages : [];
  const exposed = [];
  let clean = 0;
  for (const p of list) {
    const rec = p && typeof p === 'object' ? p : {};
    const result = detectDebugPage(rec.html);
    if (result.isDebug) {
      exposed.push({
        url: typeof rec.url === 'string' ? rec.url : null,
        status: typeof rec.status === 'number' ? rec.status : null,
        framework: result.framework,
        confidence: result.confidence,
        severity: result.severity,
        leakedInternals: result.leakedInternals,
      });
    } else {
      clean++;
    }
  }
  return { exposed, clean, total: list.length };
}

/**
 * Render a remediation line for a detected debug page.
 * @param {{framework:string|null, severity:string, leakedInternals:string[]}} detection One entry from scanErrorPages.
 * @returns {string}
 */
export function debugRemediationLine(detection) {
  const d = detection && typeof detection === 'object' ? detection : {};
  const where = d.url ? ` on ${d.url}` : '';
  return (
    `Debug mode enabled (${d.framework || 'unknown framework'})${where} — severity ${d.severity}; ` +
    `leaks: ${(d.leakedInternals || []).join(', ') || 'none observed'}. Remediation: disable debug mode in production.`
  );
}
