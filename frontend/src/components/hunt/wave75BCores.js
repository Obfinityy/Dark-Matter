/**
 * wave75BCores.js — Infinity AI · Dark-Matter · Wave 75B
 * Template operations and governance, ideas 52981–53000.
 * Pure logic for triage and SLA defaults, lifecycle defaults,
 * bulk application, the org marketplace, effectiveness
 * analytics, recommendations, auto-improvement, scope
 * guardrails, required fields, the creation wizard,
 * quick-start, duplication detection, ownership, permission
 * levels, audit logs, rollback, pre and post hooks,
 * auto-generated docs, and performance badges. Every helper
 * takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE75_B_IDEAS = [
  { id: 52981, title: 'Template triage-assignment defaults', skip: false },
  { id: 52982, title: 'Template SLA defaults', skip: false },
  { id: 52983, title: 'Template lifecycle defaults', skip: false },
  { id: 52984, title: 'Bulk-apply template to targets', skip: false },
  { id: 52985, title: 'Org template marketplace', skip: false },
  { id: 52986, title: 'Template effectiveness analytics', skip: false },
  { id: 52987, title: 'AI template recommendations', skip: false },
  { id: 52988, title: 'Template auto-improvement', skip: false },
  { id: 52989, title: 'Template scope guardrails', skip: false },
  { id: 52990, title: 'Template required fields', skip: false },
  { id: 52991, title: 'Template creation wizard', skip: false },
  { id: 52992, title: 'Template quick-start', skip: false },
  { id: 52993, title: 'Template duplication detection', skip: false },
  { id: 52994, title: 'Template ownership', skip: false },
  { id: 52995, title: 'Template permission levels', skip: false },
  { id: 52996, title: 'Template audit log (post-hunt)', skip: false },
  { id: 52997, title: 'Template rollback (post-hunt)', skip: false },
  { id: 52998, title: 'Template pre/post hooks', skip: false },
  { id: 52999, title: 'Auto-generated template docs', skip: false },
  { id: 53000, title: 'Template performance badges', skip: false },
];

function slug(text) {
  return String(text || 'template').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 44) || 'template';
}
function tokenize(text) {
  return String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2);
}

/** Resolve triage assignment defaults (idea 52981). */
export function resolveTriageAssignmentDefaults(template = {}, org = {}, options = {}) {
  const rules = [...(template.triageRules || [])];
  const defaults = {
    critical: org.criticalAssignee || 'lead-1',
    high: org.highAssignee || 'senior-analyst',
    default: org.defaultAssignee || 'triage-queue',
  };
  const assignments = ['critical', 'high', 'medium', 'low'].map(sev => ({ severity: sev, assignee: defaults[sev] || defaults.default, ruleCount: rules.filter(r => String(r.severity || '').toLowerCase() === sev).length }));
  return { templateId: template.id || template.templateId || null, assignments, ruleCount: rules.length, summary: `Infinity AI resolved triage assignments for ${template.id || 'the template'} (${rules.length} rule(s)).` };
}

/** Resolve SLA defaults for a template (idea 52982). */
export function resolveSlaDefaults(template = {}, options = {}) {
  const base = { triageHours: 24, fixCriticalHours: 72, fixHighHours: 120, reviewHours: 48 };
  const merged = { ...base, ...(template.sla || {}) };
  return { templateId: template.id || template.templateId || null, sla: merged, strictestHours: Math.min(merged.triageHours, merged.fixCriticalHours), summary: `Infinity AI set SLAs for ${template.id || 'the template'}: triage ${merged.triageHours}h, critical fix ${merged.fixCriticalHours}h.` };
}

/** Resolve lifecycle defaults (idea 52983). */
export function resolveLifecycleDefaults(template = {}, options = {}) {
  const lifecycle = { state: String(template.lifecycle?.state || template.state || 'draft'), autoArchiveDays: Number(template.lifecycle?.autoArchiveDays ?? 90), reviewCadenceDays: Number(template.lifecycle?.reviewCadenceDays ?? 30), ...(template.lifecycle || {}) };
  return { templateId: template.id || template.templateId || null, lifecycle, summary: `Infinity AI lifecycle for ${template.id || 'the template'}: ${lifecycle.state}, review every ${lifecycle.reviewCadenceDays} day(s).` };
}

/** Bulk-apply one template to many targets (idea 52984). */
export function bulkApplyTemplate(template = {}, targets = [], options = {}) {
  const plan = (targets || []).map(t => {
    const host = typeof t === 'string' ? t : (t.host || t.target || null);
    return { target: host, huntDraftId: `hunt-${slug(host || 'target')}-${slug(template.id || 'tpl')}`, engines: (template.engines || []).map(e => (typeof e === 'string' ? e : e.id)), ready: Boolean(host && (template.scope?.include || []).length >= 0) };
  });
  const ready = plan.filter(p => p.ready);
  return { templateId: template.id || template.templateId || null, plan, readyCount: ready.length, totalTargets: plan.length, summary: `Infinity AI prepared ${ready.length} hunt draft(s) from ${template.id || 'the template'}.` };
}

/** Browse the org template marketplace (idea 52985). */
export function browseOrgMarketplace(listings = [], query = '', options = {}) {
  const needle = String(query || '').toLowerCase().trim();
  const matched = (listings || []).filter(l => {
    if (!needle) return true;
    return `${l.name || ''} ${l.id || ''} ${(l.tags || []).join(' ')} ${l.publisher || ''}`.toLowerCase().includes(needle);
  }).map(l => ({ templateId: l.id || l.templateId || null, name: l.name || 'Untitled template', publisher: l.publisher || 'unknown', installs: Number(l.installs || 0), verified: Boolean(l.verified) }));
  matched.sort((a, b) => b.installs - a.installs || String(a.templateId).localeCompare(String(b.templateId)));
  return { listings: matched, count: matched.length, verifiedCount: matched.filter(m => m.verified).length, summary: `Infinity AI found ${matched.length} marketplace template(s).` };
}

/** Analyze template effectiveness (idea 52986). */
export function analyzeTemplateEffectiveness(templates = [], hunts = [], options = {}) {
  const rows = (templates || []).map(t => {
    const id = t.id || t.templateId;
    const used = (hunts || []).filter(h => h.templateId === id);
    const findings = used.flatMap(h => h.findings || []);
    const fps = findings.filter(f => f.status === 'false-positive').length;
    return { templateId: id, uses: used.length, findings: findings.length, fpRate: findings.length ? Math.round((fps / findings.length) * 100) / 100 : 0, yieldPerUse: used.length ? Math.round((findings.length / used.length) * 10) / 10 : 0 };
  }).sort((a, b) => b.yieldPerUse - a.yieldPerUse || String(a.templateId).localeCompare(String(b.templateId)));
  return { rows, best: rows[0] || null, templateCount: rows.length, summary: rows.length ? `Infinity AI effectiveness: ${rows[0].templateId} yields ${rows[0].yieldPerUse} finding(s) per use.` : 'Infinity AI: no template effectiveness data yet.' };
}

/** Recommend templates for a target fingerprint (idea 52987). */
export function recommendTemplatesWithAi(templates = [], fingerprint = {}, options = {}) {
  const fpTokens = new Set(tokenize(`${(fingerprint.techStack || []).join(' ')} ${fingerprint.assetType || ''} ${fingerprint.vertical || ''}`));
  const scored = (templates || []).map(t => {
    const text = tokenize(`${t.name || ''} ${(t.tags || []).join(' ')} ${t.description || ''} ${t.assetType || ''} ${t.vertical || ''}`);
    const overlap = text.filter(w => fpTokens.has(w)).length;
    const score = overlap * 4 + Number(t.uses || 0);
    return { templateId: t.id || t.templateId || null, name: t.name || 'Untitled template', score, matchedSignals: overlap };
  }).sort((a, b) => b.score - a.score || String(a.templateId).localeCompare(String(b.templateId)));
  return { recommendations: scored.slice(0, Number(options.limit || 3)), top: scored[0] || null, summary: scored.length ? `Infinity AI recommends ${scored[0].templateId} for this target (score ${scored[0].score}).` : 'Infinity AI: no templates available to recommend.' };
}

/** Propose automatic template improvements (idea 52988). */
export function autoImproveTemplate(template = {}, stats = {}, options = {}) {
  const suggestions = [];
  if (Number(stats.fpRate || 0) > 0.4) suggestions.push({ kind: 'tighten-scope', detail: 'False-positive rate is high; narrow the scope or add exclusions.' });
  if (Number(stats.averageYield || 0) >= 2 && !(template.tags || []).includes('proven')) suggestions.push({ kind: 'tag-proven', detail: 'High yield; mark the template as proven.' });
  if (!(template.engines || []).includes('secret-scan')) suggestions.push({ kind: 'add-engine', detail: 'Add the secret-scan engine for broader coverage.' });
  if (!suggestions.length) suggestions.push({ kind: 'none', detail: 'No improvement needed right now.' });
  return { templateId: template.id || template.templateId || null, suggestions, suggestionCount: suggestions.length, summary: `Infinity AI proposes ${suggestions.length} improvement(s) for ${template.id || 'the template'}.` };
}

/** Enforce scope guardrails (idea 52989). */
export function enforceScopeGuardrails(template = {}, policy = {}, options = {}) {
  const include = template.scope?.include || [];
  const blockedSuffixes = (policy.blockedSuffixes || ['.gov', '.mil']).map(s => String(s).toLowerCase());
  const maxHosts = Number(policy.maxHosts || 25);
  const violations = [];
  for (const h of include) if (blockedSuffixes.some(s => String(h).toLowerCase().endsWith(s))) violations.push({ host: h, rule: 'blocked suffix' });
  if (include.length > maxHosts) violations.push({ host: null, rule: `exceeds ${maxHosts} hosts` });
  return { templateId: template.id || template.templateId || null, violations, violationCount: violations.length, allowed: violations.length === 0, summary: violations.length ? `Infinity AI blocked ${template.id || 'the template'}: ${violations.length} guardrail violation(s).` : `Infinity AI: scope guardrails pass for ${template.id || 'the template'}.` };
}

/** Validate required template fields (idea 52990). */
export function validateRequiredFields(template = {}, options = {}) {
  const required = options.required || ['name', 'scope', 'engines'];
  const missing = required.filter(f => {
    if (f === 'scope') return !(template.scope?.include || []).length;
    if (f === 'engines') return !(template.engines || []).length;
    return !template[f];
  });
  return { templateId: template.id || template.templateId || null, required, missing, valid: missing.length === 0, summary: missing.length ? `Infinity AI: template is missing ${missing.join(', ')}.` : `Infinity AI: template has every required field.` };
}

/** Run the template creation wizard (idea 52991). */
export function runTemplateCreationWizard(draft = {}, step = 1, options = {}) {
  const steps = [
    { step: 1, name: 'Basics', done: Boolean(draft.name) },
    { step: 2, name: 'Scope', done: Boolean((draft.scope?.include || []).length) },
    { step: 3, name: 'Engines', done: Boolean((draft.engines || []).length) },
    { step: 4, name: 'Review', done: Boolean(draft.name && (draft.scope?.include || []).length && (draft.engines || []).length) },
  ];
  const current = Math.min(4, Math.max(1, Number(step || 1)));
  return { templateId: draft.id || null, steps, current, complete: steps.every(s => s.done), nextStep: steps.find(s => !s.done)?.step || null, summary: `Infinity AI wizard for ${draft.id || 'the new template'}: step ${current} of 4.` };
}

/** Resolve the quick-start path (idea 52992). */
export function resolveTemplateQuickStart(template = {}, options = {}) {
  const ready = Boolean((template.scope?.include || []).length && (template.engines || []).length);
  return { templateId: template.id || template.templateId || null, ready, launchLabel: ready ? 'Launch hunt now' : 'Complete the template first', steps: ready ? ['confirm scope', 'confirm engines', 'launch'] : ['add scope', 'add engines'], summary: ready ? `Infinity AI quick-start is ready for ${template.id || 'the template'}.` : 'Infinity AI: quick-start needs scope and engines first.' };
}

/** Detect duplicate templates by similarity (idea 52993). */
export function detectTemplateDuplication(templates = [], options = {}) {
  const norm = t => new Set(tokenize(`${t.name || ''} ${(t.scope?.include || []).join(' ')} ${(t.engines || []).map(e => (typeof e === 'string' ? e : e.id)).join(' ')}`));
  const pairs = [];
  const list = templates || [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = norm(list[i]); const b = norm(list[j]);
    const inter = [...a].filter(x => b.has(x)).length;
    const union = new Set([...a, ...b]).size || 1;
    const similarity = Math.round((inter / union) * 100) / 100;
    if (similarity >= Number(options.threshold || 0.5)) pairs.push({ a: list[i].id || null, b: list[j].id || null, similarity });
  }
  pairs.sort((x, y) => y.similarity - x.similarity);
  return { pairs, pairCount: pairs.length, summary: pairs.length ? `Infinity AI found ${pairs.length} likely duplicate pair(s).` : 'Infinity AI: no duplicate templates detected.' };
}

/** Resolve template ownership (idea 52994). */
export function resolveTemplateOwnership(template = {}, members = [], options = {}) {
  const owner = template.owner || template.createdBy || null;
  const known = (members || []).some(m => (m.id || m.name) === owner);
  return { templateId: template.id || template.templateId || null, owner, known, transferable: Boolean(owner && options.to && owner !== options.to), summary: owner ? `Infinity AI: ${template.id || 'the template'} is owned by ${owner}${known ? '' : ' (outside the current roster)'}.` : 'Infinity AI: the template has no recorded owner.' };
}

/** Resolve permission levels for a template (idea 52995). */
export function resolveTemplatePermissions(template = {}, actor = {}, options = {}) {
  const levels = { owner: 4, editor: 3, runner: 2, viewer: 1 };
  const role = String(actor.role || template.permissions?.[actor.id] || 'viewer').toLowerCase();
  const level = levels[role] || 1;
  const can = { view: level >= 1, run: level >= 2, edit: level >= 3, delete: level >= 4 };
  return { templateId: template.id || template.templateId || null, role, level, can, summary: `Infinity AI: ${actor.id || 'the actor'} is a ${role} on ${template.id || 'the template'} (can run: ${can.run}).` };
}

/** Build the template audit log (idea 52996). */
export function buildTemplateAuditLog(template = {}, events = [], options = {}) {
  const entries = [...(events || template.audit || [])].map(e => ({ at: e.at || null, actor: e.actor || 'unknown', action: String(e.action || 'view').slice(0, 60), templateId: template.id || template.templateId || null })).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return { templateId: template.id || template.templateId || null, entries, entryCount: entries.length, summary: `Infinity AI audit log for ${template.id || 'the template'} holds ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}.` };
}

/** Roll a template back to a prior version (idea 52997). */
export function rollbackTemplate(template = {}, targetVersion = null, options = {}) {
  const versions = [...(template.versions || [])].sort((a, b) => Number(a.version || 0) - Number(b.version || 0));
  const goal = targetVersion === null ? versions[versions.length - 2] : versions.find(v => Number(v.version) === Number(targetVersion));
  return { templateId: template.id || template.templateId || null, currentVersion: versions.length ? versions[versions.length - 1].version : null, rollbackTo: goal ? goal.version : null, possible: Boolean(goal), snapshot: goal || null, summary: goal ? `Infinity AI can roll ${template.id || 'the template'} back to version ${goal.version}.` : 'Infinity AI: no earlier version to roll back to.' };
}

/** Resolve pre and post hunt hooks (idea 52998). */
export function resolveTemplateHooks(template = {}, options = {}) {
  const pre = [...(template.hooks?.pre || template.preHooks || [])].map(h => (typeof h === 'string' ? { name: h } : { ...h }));
  const post = [...(template.hooks?.post || template.postHooks || [])].map(h => (typeof h === 'string' ? { name: h } : { ...h }));
  return { templateId: template.id || template.templateId || null, pre, post, hookCount: pre.length + post.length, summary: `Infinity AI registered ${pre.length} pre-hook(s) and ${post.length} post-hook(s) for ${template.id || 'the template'}.` };
}

/** Generate documentation from a template (idea 52999). */
export function generateTemplateDocs(template = {}, options = {}) {
  const scope = template.scope?.include || [];
  const engines = (template.engines || []).map(e => (typeof e === 'string' ? e : e.id));
  const lines = [`# ${template.name || 'Untitled template'}`, '', `Generated by Infinity AI.`, '', `## Scope`, ...scope.map(h => `- ${h}`), '', `## Engines`, ...engines.map(e => `- ${e}`), '', `## Notes`, 'Launch a hunt from this template to apply its scope, engines, and defaults.'];
  return { templateId: template.id || template.templateId || null, title: template.name || 'Untitled template', content: lines.join('\n'), sectionCount: 3, summary: `Infinity AI generated docs for ${template.id || 'the template'} (${scope.length} scope entrie(s), ${engines.length} engine(s)).` };
}

/** Derive performance badges from template stats (idea 53000). */
export function deriveTemplateBadges(template = {}, stats = {}, options = {}) {
  const fpRate = Number(stats.fpRate ?? template.fpRate ?? 1);
  const minutes = Number(stats.averageMinutes ?? template.averageMinutes ?? 999);
  const yieldAvg = Number(stats.averageYield ?? template.averageYield ?? 0);
  const badges = [];
  if (fpRate <= 0.15) badges.push({ id: 'low-fp', label: 'Low FP' });
  if (minutes <= 45) badges.push({ id: 'fast', label: 'Fast' });
  if (yieldAvg >= 2) badges.push({ id: 'high-yield', label: 'High Yield' });
  return { templateId: template.id || template.templateId || null, badges, badgeLabels: badges.map(b => b.label), badgeCount: badges.length, summary: badges.length ? `Infinity AI awarded ${template.id || 'the template'}: ${badges.map(b => b.label).join(', ')}.` : `Infinity AI: ${template.id || 'the template'} has no performance badges yet.` };
}
