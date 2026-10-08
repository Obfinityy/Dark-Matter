/**
 * Detection scan loops — nuclei / sqlmap / dalfox.
 *
 * These are the loops a hunt actually INVOKES (not raw tool calls):
 *   1. build the tool request (template selection / param plan / scan mode)
 *   2. run it THROUGH the registry ToolExecutor — PolicyValidator +
 *      permission-service gating apply exactly as for any brain decision
 *   3. normalize the raw output → findings via findingNormalizer
 *
 * HONEST DEGRADATION: when no execution path exists (no Kali worker
 * configured and no local execution path), the loop returns
 *   { status: 'tool-unavailable', findings: [], note }
 * — never fake findings. A permission block surfaces as
 *   { status: 'needs-approval', approval }
 * so the hunt can ask the user instead of silently skipping.
 */
import { normalizeNuclei, normalizeSqlmap, normalizeDalfox } from '../tools/findingNormalizer.js';

/**
 * Detect the executor's "no execution path" placeholder. ToolExecutor returns
 * a JSON {status:"kali_required"} blob when KALI_WORKER_URL is unset; we also
 * treat "command not found" as unavailable rather than as findings.
 */
export function isToolUnavailableOutput(rawOutput) {
  const s = typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput || '');
  return (
    /"status"\s*:\s*"kali_required"/.test(s) ||
    /command not found|not recognized as an internal/i.test(s)
  );
}

function unavailable(tool, why) {
  return {
    status: 'tool-unavailable',
    tool,
    findings: [],
    degraded: true,
    note: `Tool unavailable: ${why}. No fake findings generated — the hunt continues with other techniques.`,
  };
}

function needsApproval(tool, approval) {
  return {
    status: 'needs-approval',
    tool,
    findings: [],
    degraded: false,
    approval: approval ? { id: approval.id, tool: approval.tool, target: approval.target } : null,
    note: `Permission required before running ${tool} (approval${approval ? ` ${approval.id}` : ''} pending).`,
  };
}

/** A hard policy block (not an approval flow) — final, never retried. */
function policyBlocked(tool, error) {
  return {
    status: 'blocked',
    tool,
    findings: [],
    degraded: false,
    note: `Policy blocked ${tool}: ${error?.message || 'blocked'} — this is final, not an approval flow.`,
  };
}

/** Classify a POLICY_VIOLATION outcome: approval flow vs hard block. */
function classifyBlocked(tool, error) {
  return error?.approval ? needsApproval(tool, error.approval) : policyBlocked(tool, error);
}

/** Run one request through the registry executor; classify the outcome. */
async function runOnce(executor, assessmentId, userId, request) {
  try {
    const result = await executor.execute(assessmentId, userId, request);
    const raw = result.rawOutput || '';
    if (isToolUnavailableOutput(raw)) return { kind: 'unavailable', raw };
    return { kind: 'ran', raw, result };
  } catch (error) {
    if (error?.code === 'POLICY_VIOLATION') return { kind: 'blocked', error };
    throw error;
  }
}

// ── nuclei: template selection → findings ──────────────────────────────

/** Detected tech → nuclei template tags. Order matters: specific before generic. */
const NUCLEI_TECH_TAGS = [
  [/wordpress/i, ['wordpress', 'wp-plugin', 'wp-theme']],
  [/drupal/i, ['drupal']],
  [/joomla/i, ['joomla']],
  [/laravel/i, ['laravel']],
  [/django/i, ['django']],
  [/express|node\.?js/i, ['nodejs']],
  [/react|next\.?js|nuxt|vue|angular|spa/i, ['javascript', 'misconfig']],
  [/nginx/i, ['nginx']],
  [/apache/i, ['apache']],
  [/tomcat/i, ['tomcat']],
  [/iis|asp\.?net/i, ['iis', 'aspnet']],
  [/php/i, ['php']],
  [/jira/i, ['jira']],
  [/jenkins/i, ['jenkins']],
  [/grafana/i, ['grafana']],
  [/git/i, ['git', 'exposure']],
  [/waf|cloudflare|cdn/i, ['waf']],
];

/** Tech list → deduped nuclei template tags; unknown stack → safe generic baseline. */
export function selectNucleiTags(techs = []) {
  const tags = new Set();
  for (const tech of techs) {
    for (const [re, list] of NUCLEI_TECH_TAGS) {
      if (re.test(String(tech))) list.forEach(t => tags.add(t));
    }
  }
  if (!tags.size) return ['misconfig', 'exposure'];
  return [...tags];
}

/** Full nuclei arg list for a template-selected scan. Target rides in request.target. */
export function buildNucleiArgs({
  tags = [],
  severity = 'medium,high,critical',
  extraArgs = [],
} = {}) {
  const args = ['-silent', '-json'];
  if (tags.length) args.push('-tags', tags.join(','));
  args.push('-severity', severity);
  return args.concat(extraArgs || []);
}

/**
 * nuclei loop: pick templates from the tech fingerprint, scan, normalize.
 * @returns { status: 'ran'|'tool-unavailable'|'needs-approval', findings, templateTags, ... }
 */
export async function nucleiLoop(
  executor,
  assessmentId,
  userId,
  { target, techs = [], severity, extraArgs = [], description = null } = {}
) {
  if (!target) throw new Error('nucleiLoop requires a target');
  const tags = selectNucleiTags(techs);
  const request = {
    tool: 'nuclei',
    target,
    arguments: { args: buildNucleiArgs({ tags, severity, extraArgs }) },
    description: description || `nuclei vulnerability scan (templates: ${tags.join(', ')})`,
    meta: { templateTags: tags, loop: 'nuclei' },
  };
  const out = await runOnce(executor, assessmentId, userId, request);
  if (out.kind === 'unavailable') {
    return unavailable(
      'nuclei',
      'nuclei binary not on the execution path and no Kali worker configured'
    );
  }
  if (out.kind === 'blocked') return classifyBlocked('nuclei', out.error);
  const findings = normalizeNuclei(out.raw);
  return {
    status: 'ran',
    tool: 'nuclei',
    target,
    findings,
    templateTags: tags,
    degraded: false,
    note: `nuclei scan completed (${tags.join(', ')} templates) — ${findings.length} finding(s)`,
  };
}

// ── sqlmap: parameter discovery → boolean-based confirm ────────────────

/**
 * Boolean-based confirm args for ONE parameter. Safe by construction:
 * --technique=B (boolean only — no time/union/error/stack), --risk=1,
 * --level=1, --batch (never interactive). No --dump/--os-shell family here.
 */
export function buildSqlmapBooleanArgs(param, extraArgs = []) {
  return [
    '--batch',
    '--level=1',
    '--risk=1',
    '--random-agent',
    '-p',
    String(param),
    '--technique=B',
  ].concat(extraArgs || []);
}

/**
 * sqlmap loop: for each discovered parameter, run a boolean-based confirm.
 * sqlmap is permission-gated (destructive tool) — in "ask" mode each param
 * confirm returns needs-approval instead of running silently.
 */
export async function sqlmapLoop(
  executor,
  assessmentId,
  userId,
  { url, params = [], extraArgs = [] } = {}
) {
  if (!url) throw new Error('sqlmapLoop requires a url');
  if (!params.length) {
    return {
      status: 'skipped',
      tool: 'sqlmap',
      findings: [],
      degraded: false,
      perParam: [],
      note: 'sqlmap skipped: no parameters discovered — nothing to boolean-confirm',
    };
  }
  const perParam = [];
  for (const param of params) {
    const request = {
      tool: 'sqlmap',
      target: url,
      arguments: { args: buildSqlmapBooleanArgs(param, extraArgs) },
      description: `sqlmap boolean-based confirm on parameter '${param}'`,
      meta: { param, technique: 'boolean-based', loop: 'sqlmap' },
    };
    const out = await runOnce(executor, assessmentId, userId, request);
    if (out.kind === 'unavailable') {
      perParam.push({
        param,
        ...unavailable(
          'sqlmap',
          'sqlmap binary not on the execution path and no Kali worker configured'
        ),
      });
      continue;
    }
    if (out.kind === 'blocked') {
      perParam.push({ param, ...classifyBlocked('sqlmap', out.error) });
      continue;
    }
    const parsed = normalizeSqlmap(out.raw);
    const findings = Array.isArray(parsed) ? parsed : parsed.findings;
    perParam.push({
      param,
      status: 'ran',
      findings,
      degraded: false,
      negative: !Array.isArray(parsed) && parsed.negative === true,
      note: findings.length
        ? `boolean-based SQLi CONFIRMED on '${param}' (${findings.length} technique(s))`
        : `parameter '${param}' not injectable via boolean technique`,
    });
  }
  const findings = perParam.flatMap(p => p.findings || []);
  const anyUnavailable = perParam.some(p => p.status === 'tool-unavailable');
  const anyApproval = perParam.some(p => p.status === 'needs-approval');
  return {
    status: anyUnavailable && findings.length === 0 && !anyApproval ? 'tool-unavailable' : 'ran',
    tool: 'sqlmap',
    findings,
    perParam,
    degraded: anyUnavailable,
    note: anyApproval
      ? 'sqlmap confirm blocked pending user approval'
      : `sqlmap boolean confirm over ${params.length} param(s) — ${findings.length} confirmed finding(s)`,
  };
}

// ── dalfox: reflected + stored ─────────────────────────────────────────

/** dalfox single-URL scan args. Target rides in request.target. */
export function buildDalfoxArgs(extraArgs = []) {
  return ['url', '--silence', '--format', 'json'].concat(extraArgs || []);
}

/**
 * dalfox loop: scan the URL, then split findings into reflected vs stored
 * buckets (the normalizer classifies from dalfox's own output — stored comes
 * from "P"-type / stored markers, never from guessing).
 */
export async function dalfoxLoop(executor, assessmentId, userId, { url, extraArgs = [] } = {}) {
  if (!url) throw new Error('dalfoxLoop requires a url');
  const request = {
    tool: 'dalfox',
    target: url,
    arguments: { args: buildDalfoxArgs(extraArgs) },
    description: 'dalfox XSS scan (reflected + stored detection)',
    meta: { scanKinds: ['reflected', 'stored'], loop: 'dalfox' },
  };
  const out = await runOnce(executor, assessmentId, userId, request);
  if (out.kind === 'unavailable') {
    return unavailable(
      'dalfox',
      'dalfox binary not on the execution path and no Kali worker configured'
    );
  }
  if (out.kind === 'blocked') return classifyBlocked('dalfox', out.error);
  const findings = normalizeDalfox(out.raw);
  const reflected = findings.filter(f => f.type === 'reflected-xss' || f.type === 'dom-xss');
  const stored = findings.filter(f => f.type === 'stored-xss');
  return {
    status: 'ran',
    tool: 'dalfox',
    target: url,
    findings,
    degraded: false,
    reflected: reflected.length,
    stored: stored.length,
    note: `dalfox scan completed — ${reflected.length} reflected/DOM, ${stored.length} stored finding(s)`,
  };
}

/**
 * Single dispatch entry: a hunt invokes a detection loop by name.
 *   runDetectionLoop(executor, assessmentId, userId, 'nuclei', { target, techs })
 *   runDetectionLoop(executor, assessmentId, userId, 'sqlmap', { url, params })
 *   runDetectionLoop(executor, assessmentId, userId, 'dalfox', { url })
 */
export async function runDetectionLoop(executor, assessmentId, userId, loop, opts = {}) {
  switch (loop) {
    case 'nuclei':
      return nucleiLoop(executor, assessmentId, userId, opts);
    case 'sqlmap':
      return sqlmapLoop(executor, assessmentId, userId, opts);
    case 'dalfox':
      return dalfoxLoop(executor, assessmentId, userId, opts);
    default:
      throw new Error(`Unknown detection loop: ${loop} (expected nuclei|sqlmap|dalfox)`);
  }
}
