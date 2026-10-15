// Dark Matter — Intelligent Tool Chaining
//
// Inspired by kali-gpt's ToolChainBuilder (MIT-style open source).
// Core principle: THINK FIRST, then act. Never try SQL injection on
// a MongoDB target. Never try WordPress scans on a React SPA.
//
// The AI observes what the target IS, then selects appropriate tools.
// This replaces pre-defined test lists with discovery-driven chaining.

/**
 * Technology fingerprints → appropriate tool chains.
 * Each chain is ordered by priority (lower = run first).
 */
const TECH_CHAINS = {
  wordpress: [
    { tool: 'wpscan', command: (t) => `wpscan --url ${t} --enumerate ap,at,u 2>/dev/null | head -50`, why: 'WordPress detected — enumerate plugins/themes/users' },
    { tool: 'nuclei', command: (t) => `nuclei -u ${t} -tags wordpress -silent 2>/dev/null | head -20`, why: 'WordPress-specific CVE scan' },
  ],
  joomla: [
    { tool: 'joomscan', command: (t) => `joomscan -u ${t} 2>/dev/null | head -50`, why: 'Joomla detected — vulnerability scan' },
  ],
  drupal: [
    { tool: 'droopescan', command: (t) => `droopescan scan drupal -u ${t} 2>/dev/null | head -50`, why: 'Drupal detected — vulnerability scan' },
  ],
  // Database-specific: CRITICAL — don't try SQLi on MongoDB!
  mongodb: [
    { tool: 'nosqli', command: (t) => `curl -sk "${t}/api/users?username[$ne]=1" 2>/dev/null | head -c 2000`, why: 'MongoDB detected — test NoSQL injection via $ne operator' },
    { tool: 'nosqli', command: (t) => `curl -sk -X POST "${t}/api/login" -H "Content-Type: application/json" -d '{"username":{"$gt":""},"password":{"$gt":""}}' 2>/dev/null | head -c 2000`, why: 'MongoDB detected — test NoSQL auth bypass' },
  ],
  mysql: [
    { tool: 'sqlmap', command: (t) => `sqlmap -u "${t}" --batch --level=1 --risk=1 2>/dev/null | head -30`, why: 'MySQL detected — test SQL injection' },
  ],
  postgresql: [
    { tool: 'sqlmap', command: (t) => `sqlmap -u "${t}" --batch --level=1 --risk=1 --dbms=PostgreSQL 2>/dev/null | head -30`, why: 'PostgreSQL detected — test SQL injection' },
  ],
  // If NO database detected, DON'T try SQL injection at all
  nodatabase: [
    { tool: 'xss', command: (t) => `curl -sk "${t}/?q=<script>alert(1)</script>" 2>/dev/null | grep -o "alert(1)" | head -5`, why: 'No DB — test reflected XSS instead of SQLi' },
    { tool: 'redirect', command: (t) => `curl -sk -o /dev/null -w "%{redirect_url}" "${t}/?next=https://evil.com" 2>/dev/null`, why: 'No DB — test open redirect' },
  ],
  react: [
    { tool: 'sourcemap', command: (t) => `curl -sk "${t}/static/js/main.js.map" 2>/dev/null | head -c 5000`, why: 'React SPA — check for exposed source maps' },
    { tool: 'nuclei', command: (t) => `nuclei -u ${t} -tags exposure -silent 2>/dev/null | head -20`, why: 'React SPA — check for exposed files' },
  ],
  // Generic web (when tech unknown) — safe baseline, no DB assumptions
  generic_web: [
    { tool: 'nuclei', command: (t) => `nuclei -u ${t} -silent -severity low,medium,high,critical 2>/dev/null | head -30`, why: 'Generic nuclei scan (no DB-specific tests)' },
    { tool: 'nikto', command: (t) => `nikto -h ${t} -Tuning 1,2,3 2>/dev/null | head -40`, why: 'Web server misconfiguration check' },
  ],
};

/**
 * Detect technologies from HTTP headers and HTML.
 * Returns { techs: string[], database: string|null, hasDatabase: boolean }
 */
export function detectTechnologies(headers, html) {
  const techs = [];
  const h = JSON.stringify(headers || {}).toLowerCase();
  const body = String(html || '').toLowerCase();

  // CMS detection
  if (body.includes('wp-content') || body.includes('wordpress') || h.includes('wordpress')) techs.push('wordpress');
  if (body.includes('joomla') || h.includes('joomla')) techs.push('joomla');
  if (body.includes('drupal') || h.includes('drupal')) techs.push('drupal');

  // Frontend frameworks
  if (body.includes('react') || body.includes('_react') || body.includes('reactjs')) techs.push('react');
  if (body.includes('vue') || body.includes('__vue__')) techs.push('vue');
  if (body.includes('angular') || body.includes('ng-')) techs.push('angular');
  if (body.includes('next.js') || body.includes('_next/')) techs.push('nextjs');

  // Backend
  if (h.includes('express') || body.includes('express')) techs.push('express');
  if (h.includes('django') || body.includes('django')) techs.push('django');
  if (h.includes('laravel') || body.includes('laravel')) techs.push('laravel');
  if (h.includes('php') || h.includes('x-powered-by: php')) techs.push('php');

  // Database detection (from error messages, API responses, headers)
  let database = null;
  if (body.includes('mongodb') || body.includes('mongoerror') || body.includes('$ne') || body.includes('objectid')) {
    database = 'mongodb';
    techs.push('mongodb');
  } else if (body.includes('mysql') || body.includes('mysqli') || body.includes('sql syntax')) {
    // Only flag MySQL if it's clearly MySQL, not just generic SQL error
    if (body.includes('mysql') || body.includes('mysqli')) {
      database = 'mysql';
      techs.push('mysql');
    }
  } else if (body.includes('postgresql') || body.includes('pg_')) {
    database = 'postgresql';
    techs.push('postgresql');
  }

  return {
    techs: [...new Set(techs)],
    database,
    hasDatabase: database !== null,
  };
}

/**
 * Get intelligent tool chain based on detected technologies.
 * This is the "think first" logic — never blindly try SQLi on MongoDB.
 */
export function getToolChain(detection, target) {
  const chains = [];
  const { techs, database, hasDatabase } = detection;

  // 1. Database-specific tests (HIGHEST priority — must match actual DB)
  if (database && TECH_CHAINS[database]) {
    for (const step of TECH_CHAINS[database]) {
      chains.push({ ...step, command: step.command(target), priority: 1 });
    }
  } else if (!hasDatabase) {
    // No database detected — use non-DB tests, SKIP all SQL injection
    for (const step of TECH_CHAINS.nodatabase) {
      chains.push({ ...step, command: step.command(target), priority: 1 });
    }
  }

  // 2. Technology-specific tests
  for (const tech of techs) {
    if (TECH_CHAINS[tech] && tech !== database) {
      for (const step of TECH_CHAINS[tech]) {
        chains.push({ ...step, command: step.command(target), priority: 2 });
      }
    }
  }

  // 3. Generic baseline (always safe, no DB assumptions)
  for (const step of TECH_CHAINS.generic_web) {
    chains.push({ ...step, command: step.command(target), priority: 3 });
  }

  // Sort by priority, dedupe by tool+command
  const seen = new Set();
  return chains
    .sort((a, b) => a.priority - b.priority)
    .filter((c) => {
      const key = c.tool + ':' + c.command.slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 15); // Max 15 steps per chain
}

/**
 * Build AI prompt with detection context.
 * The AI now KNOWS what the target is — no more blind SQLi on MongoDB.
 */
export function buildIntelligentPrompt(detection, target, previousFindings) {
  const { techs, database, hasDatabase } = detection;
  
  let context = `Target: ${target}\n`;
  context += `Detected technologies: ${techs.length ? techs.join(', ') : 'unknown'}\n`;
  context += `Database: ${database || 'none detected'}\n`;
  
  if (database === 'mongodb') {
    context += `\nCRITICAL: This target uses MongoDB (NoSQL). DO NOT suggest SQL injection tests. `;
    context += `Only suggest NoSQL injection tests (e.g., $ne, $gt operators, $where clauses).\n`;
  } else if (database === 'mysql' || database === 'postgresql') {
    context += `\nThis target uses ${database}. SQL injection tests are appropriate.\n`;
  } else if (!hasDatabase) {
    context += `\nNo database detected. DO NOT suggest SQL injection. Focus on XSS, open redirects, `;
    context += `information disclosure, and client-side vulnerabilities.\n`;
  }

  if (previousFindings && previousFindings.length) {
    context += `\nPrevious findings: ${previousFindings.length} items. Build on these, don't repeat.\n`;
  }

  return context;
}
