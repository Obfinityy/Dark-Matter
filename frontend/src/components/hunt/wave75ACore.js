/**
 * wave75ACore.js — Infinity AI · Dark-Matter · Wave 75A
 * Template ecosystem foundations, ideas 52961–52980.
 * Pure logic for template import and export, auto-suggestion
 * from the best hunt, categories, search and tags, cross-target
 * cloning, parameterized variables, secrets placeholders,
 * approval workflow, deprecation, changelog, diff viewing,
 * dry-run testing, cost estimation, vertical and asset-type
 * templates, bounty-program templates, regression templates,
 * compliance-audit templates, notification defaults, and
 * stakeholder-view defaults. Every helper takes explicit inputs,
 * returns a structured view model, and never mutates arguments.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE75_A_IDEAS = [
  { id: 52961, title: 'Template import/export (post-hunt)', skip: false },
  { id: 52962, title: 'Auto-suggest template from best hunt', skip: false },
  { id: 52963, title: 'Template categories (post-hunt)', skip: false },
  { id: 52964, title: 'Template search and tags', skip: false },
  { id: 52965, title: 'Cross-target template cloning', skip: false },
  { id: 52966, title: 'Parameterized target variables', skip: false },
  { id: 52967, title: 'Secrets placeholders', skip: false },
  { id: 52968, title: 'Template approval workflow (post-hunt)', skip: false },
  { id: 52969, title: 'Template deprecation (post-hunt)', skip: false },
  { id: 52970, title: 'Template changelog (post-hunt)', skip: false },
  { id: 52971, title: 'Template diff viewer (post-hunt)', skip: false },
  { id: 52972, title: 'Template dry-run test', skip: false },
  { id: 52973, title: 'Template cost estimator', skip: false },
  { id: 52974, title: 'Vertical-specific templates', skip: false },
  { id: 52975, title: 'Asset-type templates', skip: false },
  { id: 52976, title: 'Bounty-program templates', skip: false },
  { id: 52977, title: 'Regression templates', skip: false },
  { id: 52978, title: 'Compliance-audit templates', skip: false },
  { id: 52979, title: 'Template notification defaults', skip: false },
  { id: 52980, title: 'Template stakeholder-view defaults', skip: false },
];

function hashText(text) {
  let h = 0;
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}
function slug(text) {
  return String(text || 'template').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 44) || 'template';
}
function tokenize(text) {
  return String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2);
}
function hostOf(value) {
  const m = String(value || '').match(/^(?:[a-z]+:\/\/)?([^/:?#]+)/i);
  return m ? m[1].toLowerCase() : '';
}

/** Export and validate template packages (idea 52961). */
export function exchangeTemplatePackage(template = {}, incoming = null, options = {}) {
  const body = {
    schemaVersion: 1,
    id: template.id || template.templateId || null,
    name: template.name || 'Untitled template',
    scope: { include: [...(template.scope?.include || [])], exclude: [...(template.scope?.exclude || [])] },
    engines: [...(template.engines || [])].map(e => (typeof e === 'string' ? e : e.id)).filter(Boolean),
    payloadProfile: template.payloadProfile || null,
    schedule: template.schedule || null,
    triageRules: [...(template.triageRules || [])],
    tags: [...(template.tags || [])],
  };
  const checksum = hashText(JSON.stringify(body));
  const descriptor = { ...body, checksum, format: 'infinity-template-v1', exportedBy: 'Infinity AI' };
  let imported = null;
  if (incoming) {
    const errors = [];
    if (incoming.schemaVersion !== 1) errors.push('unsupported schema version');
    if (!incoming.id) errors.push('missing template id');
    if (!incoming.name) errors.push('missing template name');
    if (incoming.checksum && incoming.checksum !== hashText(JSON.stringify({ ...incoming, checksum: undefined, format: undefined, exportedBy: undefined, schemaVersion: 1, id: incoming.id, name: incoming.name, scope: incoming.scope || { include: [], exclude: [] }, engines: incoming.engines || [], payloadProfile: incoming.payloadProfile || null, schedule: incoming.schedule || null, triageRules: incoming.triageRules || [], tags: incoming.tags || [] }))) {
      // deterministic integrity note without failing valid hand-built packages
      if (incoming.strictChecksum) errors.push('checksum mismatch');
    }
    imported = { templateId: incoming.id || null, name: incoming.name || null, valid: errors.length === 0, errors };
  }
  return { descriptor, imported, checksum, summary: `Infinity AI packaged ${body.id || 'the template'} for export${imported ? ` and validated import as ${imported.valid ? 'valid' : 'invalid'}` : ''}.` };
}

/** Suggest a template from the highest-yield hunt (idea 52962). */
export function suggestTemplateFromBestHunt(hunts = [], options = {}) {
  const ranked = [...(hunts || [])].map(h => ({
    huntId: h.huntId || h.id || null,
    target: h.target || null,
    findings: (h.findings || []).length,
    fps: (h.findings || []).filter(f => f.status === 'false-positive' || f.fp === true).length,
    engines: [...(h.engines || h.stats?.engines || [])],
    scope: { include: [...(h.scope?.include || [])], exclude: [...(h.scope?.exclude || [])] },
    score: (h.findings || []).length * 10 - (h.findings || []).filter(f => f.status === 'false-positive').length * 4,
  })).sort((a, b) => b.score - a.score || String(a.huntId).localeCompare(String(b.huntId)));
  const best = ranked[0] || null;
  const suggestion = best && best.score >= Number(options.minScore || 1) ? {
    sourceHuntId: best.huntId,
    templateName: `Template from ${best.huntId}`,
    scope: best.scope,
    engines: best.engines,
    reason: `${best.findings} finding(s) with the strongest yield in the set.`,
  } : null;
  return { ranked, best, suggestion, summary: suggestion ? `Infinity AI suggests building a template from ${best.huntId}.` : 'Infinity AI: no hunt is strong enough to become a template yet.' };
}

/** Classify a template into a stable category (idea 52963). */
export function classifyTemplateCategory(template = {}, options = {}) {
  const text = `${template.name || ''} ${(template.tags || []).join(' ')} ${template.description || ''}`.toLowerCase();
  const rules = [
    ['regression', /regression|retest|verify-fix/],
    ['compliance', /compliance|audit|gdpr|pci|hipaa/],
    ['recon', /recon|discovery|enumeration/],
    ['api', /api|graphql|rest/],
    ['web', /web|checkout|shop|store/],
  ];
  let category = 'general';
  for (const [name, re] of rules) if (re.test(text)) { category = name; break; }
  const counts = {};
  for (const c of options.catalog || []) counts[c] = (counts[c] || 0) + 1;
  return { templateId: template.id || template.templateId || null, category, catalog: Object.keys(counts).sort(), summary: `Infinity AI classified ${template.id || 'the template'} as ${category}.` };
}

/** Search templates by tokens and tags (idea 52964). */
export function searchTemplatesWithTags(templates = [], query = '', options = {}) {
  const tokens = tokenize(query);
  const wantTags = (options.tags || []).map(t => String(t).toLowerCase());
  const scored = (templates || []).map(t => {
    const text = `${t.name || ''} ${t.id || ''} ${(t.tags || []).join(' ')} ${t.description || ''}`.toLowerCase();
    let score = tokens.filter(tok => text.includes(tok)).length * 3;
    const tags = (t.tags || []).map(x => String(x).toLowerCase());
    score += wantTags.filter(tg => tags.includes(tg)).length * 5;
    return { templateId: t.id || t.templateId || null, name: t.name || 'Untitled template', tags, score, uses: Number(t.uses || 0) };
  }).filter(r => tokens.length + wantTags.length === 0 || r.score > 0);
  scored.sort((a, b) => b.score - a.score || b.uses - a.uses || String(a.templateId).localeCompare(String(b.templateId)));
  return { results: scored, count: scored.length, tokens, summary: `Infinity AI found ${scored.length} template(s) for the search.` };
}

/** Clone a template onto a new target (idea 52965). */
export function cloneTemplateAcrossTargets(template = {}, target = {}, options = {}) {
  const newHost = hostOf(target.host || target.target || target.url || '');
  const oldInclude = template.scope?.include || [];
  const remapped = oldInclude.map(h => {
    const parts = String(h).split('.');
    if (!newHost) return String(h);
    return newHost.includes('.') ? newHost : (parts.length > 2 ? `${parts[0]}.${newHost}` : newHost);
  });
  const clone = {
    id: options.newId || `${template.id || 'tpl'}-${slug(newHost || 'clone')}`,
    name: String(options.name || `${template.name || 'Template'} for ${newHost || 'new target'}`).slice(0, 80),
    sourceId: template.id || template.templateId || null,
    scope: { include: [...new Set(remapped)], exclude: [...(template.scope?.exclude || [])].map(h => (newHost && String(h).includes('.') ? newHost : h)) },
    engines: [...(template.engines || [])].map(e => (typeof e === 'string' ? e : e.id)),
  };
  return { template: clone, cloneId: clone.id, remappedCount: clone.scope.include.length, summary: `Infinity AI cloned ${clone.sourceId || 'the template'} onto ${newHost || 'a new target'} as ${clone.id}.` };
}

/** Substitute parameterized variables (idea 52966). */
export function applyTemplateVariables(template = {}, vars = {}, options = {}) {
  const raw = JSON.stringify({ scope: template.scope || {}, engines: template.engines || [], name: template.name || '' });
  const keys = [...new Set([...raw.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)].map(m => m[1]))];
  const missing = keys.filter(k => vars[k] === undefined && vars[k.split('.').pop()] === undefined);
  let rendered = raw;
  for (const k of keys) {
    const v = vars[k] ?? vars[k.split('.').pop()];
    if (v !== undefined) rendered = rendered.split(`{{${k}}}`).join(String(v));
  }
  let parsed = null;
  try { parsed = JSON.parse(rendered); } catch { parsed = null; }
  return { required: keys, missing, rendered: parsed, complete: missing.length === 0, summary: missing.length ? `Infinity AI: template variables missing: ${missing.join(', ')}.` : `Infinity AI resolved ${keys.length} template variable(s).` };
}

/** Replace hardcoded secrets with vault placeholders (idea 52967). */
export function redactTemplateSecrets(template = {}, options = {}) {
  const text = JSON.stringify(template);
  const patterns = [
    /sk-[a-z0-9]{12,}/gi, /ghp_[a-z0-9]{12,}/gi, /AKIA[0-9A-Z]{12,}/g,
    /(api[_-]?key|token|secret|password)\s*[:=]\s*["']?([a-z0-9_./+-]{10,})/gi,
  ];
  const findings = [];
  for (const re of patterns) for (const m of text.matchAll(re)) findings.push({ kind: 'secret-like value', snippet: String(m[0]).slice(0, 6) + '...' });
  const redacted = patterns.reduce((acc, re) => acc.replace(re, (full, k) => (k ? `${k}={{vault:secret}}` : '{{vault:secret}}')), text);
  let parsed = null; try { parsed = JSON.parse(redacted); } catch { parsed = null; }
  return { findings, findingCount: findings.length, safe: findings.length === 0, redacted: parsed, summary: findings.length ? `Infinity AI flagged ${findings.length} hardcoded secret(s) in the template.` : 'Infinity AI: no hardcoded secrets found in the template.' };
}

/** Run the template approval state machine (idea 52968). */
export function runTemplateApprovalWorkflow(template = {}, action = {}, options = {}) {
  const state = String(template.approvalState || template.state || 'draft').toLowerCase();
  const act = String(action.type || action.action || 'submit').toLowerCase();
  const role = String(action.role || options.role || 'author').toLowerCase();
  const transitions = { draft: { submit: 'pending' }, pending: { approve: 'approved', reject: 'rejected', request_changes: 'draft' }, approved: { revoke: 'draft' }, rejected: { submit: 'pending' } };
  const allowed = (transitions[state] || {})[act] || null;
  const gated = act === 'approve' && !['lead', 'admin', 'reviewer'].includes(role);
  const nextState = gated ? state : (allowed || state);
  return { templateId: template.id || template.templateId || null, from: state, to: nextState, action: act, allowed: Boolean(allowed) && !gated, gated, summary: gated ? `Infinity AI: role ${role} cannot approve templates.` : `Infinity AI moved ${template.id || 'the template'} from ${state} to ${nextState}.` };
}

/** Decide whether a template should be deprecated (idea 52969). */
export function evaluateTemplateDeprecation(template = {}, stats = {}, options = {}) {
  const uses = Number(stats.uses ?? template.uses ?? 0);
  const yieldAvg = Number(stats.averageYield ?? template.averageYield ?? 0);
  const fpRate = Number(stats.fpRate ?? template.fpRate ?? 0);
  const reasons = [];
  if (uses === 0) reasons.push('never used');
  if (uses > 0 && yieldAvg < Number(options.minYield || 0.5)) reasons.push('low yield');
  if (fpRate > Number(options.maxFpRate || 0.6)) reasons.push('high false-positive rate');
  if (template.deprecated === true) reasons.push('already deprecated');
  const deprecated = reasons.length > 0;
  return { templateId: template.id || template.templateId || null, deprecated, reasons, replacementId: options.replacementId || template.replacementId || null, summary: deprecated ? `Infinity AI recommends deprecating ${template.id || 'the template'}: ${reasons.join(', ')}.` : `Infinity AI keeps ${template.id || 'the template'} active.` };
}

/** Build an ordered template changelog (idea 52970). */
export function buildTemplateChangelog(template = {}, options = {}) {
  const versions = [...(template.versions || [])].sort((a, b) => Number(a.version || 0) - Number(b.version || 0));
  const entries = versions.map(v => ({ version: v.version || 0, at: v.at || null, by: v.by || 'unknown', note: String(v.note || '').slice(0, 160), added: (v.changes?.added || []).length, removed: (v.changes?.removed || []).length }));
  const lines = [`# Changelog — ${template.id || 'template'}`, '', `Maintained by Infinity AI · ${entries.length} version(s)`, '', ...entries.map(e => `- v${e.version} · ${e.at || 'undated'} · ${e.by}: ${e.note}`)];
  return { templateId: template.id || template.templateId || null, entries, entryCount: entries.length, content: lines.join('\n'), summary: `Infinity AI built a changelog with ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} for ${template.id || 'the template'}.` };
}

/** Diff two template versions field by field (idea 52971). */
export function diffTemplateVersions(before = {}, after = {}, options = {}) {
  const fields = ['name', 'description'];
  const changes = [];
  for (const f of fields) if (String(before[f] || '') !== String(after[f] || '')) changes.push({ field: f, from: before[f] || null, to: after[f] || null });
  const scopeBefore = new Set(before.scope?.include || []);
  const scopeAfter = new Set(after.scope?.include || []);
  for (const h of scopeAfter) if (!scopeBefore.has(h)) changes.push({ field: 'scope.include', from: null, to: h });
  for (const h of scopeBefore) if (!scopeAfter.has(h)) changes.push({ field: 'scope.include', from: h, to: null });
  const engBefore = new Set((before.engines || []).map(e => (typeof e === 'string' ? e : e.id)));
  const engAfter = new Set((after.engines || []).map(e => (typeof e === 'string' ? e : e.id)));
  for (const e of engAfter) if (!engBefore.has(e)) changes.push({ field: 'engines', from: null, to: e });
  for (const e of engBefore) if (!engAfter.has(e)) changes.push({ field: 'engines', from: e, to: null });
  return { templateId: before.id || after.id || null, changes, changeCount: changes.length, identical: changes.length === 0, summary: changes.length ? `Infinity AI found ${changes.length} difference(s) between the template versions.` : 'Infinity AI: the template versions are identical.' };
}

/** Validate a template without launching a hunt (idea 52972). */
export function dryRunTemplate(template = {}, options = {}) {
  const checks = [];
  const scope = template.scope?.include || [];
  checks.push({ name: 'scope-present', status: scope.length ? 'pass' : 'fail', detail: `${scope.length} inclusion(s)` });
  checks.push({ name: 'engines-present', status: (template.engines || []).length ? 'pass' : 'fail', detail: `${(template.engines || []).length} engine(s)` });
  checks.push({ name: 'variables-resolved', status: (template.missingVars || []).length === 0 ? 'pass' : 'warn', detail: `${(template.missingVars || []).length} missing variable(s)` });
  checks.push({ name: 'secrets-clean', status: template.hasHardcodedSecrets ? 'fail' : 'pass', detail: template.hasHardcodedSecrets ? 'hardcoded secret present' : 'no hardcoded secrets' });
  const failed = checks.filter(c => c.status === 'fail');
  const warned = checks.filter(c => c.status === 'warn');
  return { templateId: template.id || template.templateId || null, checks, verdict: failed.length ? 'fail' : warned.length ? 'warn' : 'pass', summary: `Infinity AI dry-run for ${template.id || 'the template'}: ${failed.length} failure(s), ${warned.length} warning(s).` };
}

/** Estimate hunt cost from template shape (idea 52973). */
export function estimateTemplateCost(template = {}, plan = {}, options = {}) {
  const targets = Math.max(1, Number(plan.targets || (template.scope?.include || []).length || 1));
  const engines = Math.max(1, (template.engines || []).length || 1);
  const depth = String(plan.depth || template.payloadProfile?.aggressiveness || 'balanced').toLowerCase();
  const depthFactor = depth === 'deep' ? 3 : depth === 'light' ? 1 : 2;
  const minutes = targets * engines * depthFactor * 12;
  const computeUnits = Math.round(minutes / 6);
  return { templateId: template.id || template.templateId || null, targets, engines, depth, estimatedMinutes: minutes, computeUnits, summary: `Infinity AI estimates ${minutes} minute(s) and ${computeUnits} compute unit(s) for ${template.id || 'the template'}.` };
}

/** Filter templates for an industry vertical (idea 52974). */
export function filterVerticalTemplates(templates = [], vertical = '', options = {}) {
  const v = String(vertical || '').toLowerCase();
  const matched = (templates || []).filter(t => String(t.vertical || '').toLowerCase() === v || (t.tags || []).map(x => String(x).toLowerCase()).includes(v)).map(t => ({ templateId: t.id || t.templateId || null, name: t.name || 'Untitled template', vertical: t.vertical || v }));
  return { vertical: v || null, templates: matched, count: matched.length, summary: `Infinity AI found ${matched.length} template(s) for the ${v || 'unset'} vertical.` };
}

/** Filter templates for an asset type (idea 52975). */
export function filterAssetTypeTemplates(templates = [], assetType = '', options = {}) {
  const a = String(assetType || '').toLowerCase();
  const matched = (templates || []).filter(t => String(t.assetType || '').toLowerCase() === a || (t.tags || []).map(x => String(x).toLowerCase()).includes(a)).map(t => ({ templateId: t.id || t.templateId || null, name: t.name || 'Untitled template', assetType: t.assetType || a }));
  return { assetType: a || null, templates: matched, count: matched.length, summary: `Infinity AI found ${matched.length} template(s) for ${a || 'unset'} assets.` };
}

/** Build a bounty-program template from program rules (idea 52976). */
export function buildBountyProgramTemplate(program = {}, options = {}) {
  const rewards = program.rewards || {};
  const template = {
    id: options.templateId || `tpl-program-${slug(program.name || 'program')}`,
    name: String(program.name || 'Bounty program template').slice(0, 80),
    scope: { include: [...(program.scope?.include || program.inScope || [])], exclude: [...(program.scope?.exclude || program.outOfScope || [])] },
    minReward: Number(rewards.min || 0),
    maxReward: Number(rewards.max || 0),
    disclosure: String(program.disclosure || 'coordinated'),
  };
  return { template, templateId: template.id, scopeCount: template.scope.include.length, summary: `Infinity AI built ${template.id} from the bounty program rules.` };
}

/** Build a regression template from prior findings (idea 52977). */
export function buildRegressionTemplate(hunt = {}, options = {}) {
  const findings = (hunt.findings || []).filter(f => ['critical', 'high'].includes(String(f.severity || '').toLowerCase()));
  const template = {
    id: options.templateId || `tpl-regression-${slug(hunt.huntId || 'hunt')}`,
    name: `Regression for ${hunt.huntId || 'hunt'}`,
    sourceHuntId: hunt.huntId || hunt.id || null,
    checks: findings.map(f => ({ findingId: f.id || null, title: f.title || 'Untitled', target: f.target || null })),
    cadence: String(options.cadence || 'on-deploy'),
  };
  return { template, templateId: template.id, checkCount: template.checks.length, summary: `Infinity AI built a regression template with ${template.checks.length} check(s) from ${hunt.huntId || 'the hunt'}.` };
}

/** Build a compliance-audit template (idea 52978). */
export function buildComplianceAuditTemplate(framework = {}, options = {}) {
  const controls = (framework.controls || ['access-control', 'logging', 'encryption']).map(c => ({ id: String(c), status: 'required' }));
  const template = { id: options.templateId || `tpl-compliance-${slug(framework.name || 'audit')}`, name: String(framework.name || 'Compliance audit'), controls, evidenceRequired: true };
  return { template, templateId: template.id, controlCount: controls.length, summary: `Infinity AI built ${template.id} with ${controls.length} compliance control(s).` };
}

/** Resolve notification defaults for a template (idea 52979). */
export function resolveNotificationDefaults(template = {}, prefs = {}, options = {}) {
  const defaults = { onStart: true, onFinding: true, onComplete: true, channels: ['in-app'] };
  const merged = { ...defaults, ...(template.notifications || {}), ...prefs };
  merged.channels = [...new Set([...(merged.channels || [])].map(String))];
  return { templateId: template.id || template.templateId || null, notifications: merged, channelCount: merged.channels.length, summary: `Infinity AI set notification defaults for ${template.id || 'the template'} across ${merged.channels.length} channel(s).` };
}

/** Resolve stakeholder view defaults for a template (idea 52980). */
export function resolveStakeholderViewDefaults(template = {}, options = {}) {
  const base = [
    { audience: 'leadership', fields: ['summary', 'risk', 'counts'] },
    { audience: 'engineering', fields: ['findings', 'evidence', 'scope'] },
    { audience: 'customer', fields: ['summary', 'status'] },
  ];
  const overrides = template.stakeholderViews || {};
  const views = base.map(v => ({ ...v, fields: [...(overrides[v.audience]?.fields || v.fields)] }));
  return { templateId: template.id || template.templateId || null, views, viewCount: views.length, summary: `Infinity AI configured ${views.length} stakeholder view(s) for ${template.id || 'the template'}.` };
}
