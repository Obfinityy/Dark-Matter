/**
 * wave74BCores.js — Infinity AI · Dark-Matter · Wave 74B
 * Reopen integrations and hunt templates, ideas 52941–52960.
 * Pure logic for reopen webhooks, keyboard shortcuts, confirmation
 * details, team notes, activity feeds, reason analytics, health
 * checks, saving hunts as templates, capturing scope, engines,
 * payloads, schedules and triage rules, the template library,
 * team sharing, versioning, forking, ratings, usage statistics,
 * and template previews. Every helper takes explicit inputs,
 * never mutates them, and returns structured view models.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE74_B_IDEAS = [
  { id: 52941, title: 'Reopen webhooks', skip: false },
  { id: 52942, title: 'Reopen keyboard shortcut', skip: false },
  { id: 52943, title: 'Reopen confirmation details', skip: false },
  { id: 52944, title: 'Team note on reopen', skip: false },
  { id: 52945, title: 'Activity-feed reopen entry', skip: false },
  { id: 52946, title: 'Reopen reason analytics', skip: false },
  { id: 52947, title: 'Post-reopen health check', skip: false },
  { id: 52948, title: '"Save hunt as template"', skip: false },
  { id: 52949, title: 'Template captures scope', skip: false },
  { id: 52950, title: 'Template captures engine selection', skip: false },
  { id: 52951, title: 'Template captures payload profile', skip: false },
  { id: 52952, title: 'Template captures schedule', skip: false },
  { id: 52953, title: 'Template captures triage rules', skip: false },
  { id: 52954, title: 'Template library browser', skip: false },
  { id: 52955, title: 'Team template sharing (post-hunt)', skip: false },
  { id: 52956, title: 'Template versioning (post-hunt)', skip: false },
  { id: 52957, title: 'Template forking (post-hunt)', skip: false },
  { id: 52958, title: 'Template ratings (post-hunt)', skip: false },
  { id: 52959, title: 'Template usage statistics (post-hunt)', skip: false },
  { id: 52960, title: 'Template preview (post-hunt)', skip: false },
];

function parseMs(iso) {
  if (!iso) return null;
  const ms = Date.parse(String(iso));
  return Number.isNaN(ms) ? null : ms;
}
function slug(text) {
  return String(text || 'template').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'template';
}
function tokenize(text) {
  return String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2);
}

/**
 * Build the webhook payload for a reopen or close (idea 52941).
 * External systems receive the hunt, actor, reason, and state
 * transition in one signed-shape event envelope.
 */
export function buildReopenWebhookPayload(hunt = {}, event = {}, options = {}) {
  const kind = String(event.kind || event.type || 'reopen').toLowerCase();
  const payload = {
    event: kind === 'close' ? 'hunt.closed' : 'hunt.reopened',
    huntId: hunt.huntId || hunt.id || null,
    target: hunt.target || null,
    actor: event.actor || event.requestedBy || 'unknown',
    reason: String(event.reason || '').slice(0, 200),
    at: event.at || options.now || '2026-10-09T00:00:00Z',
    source: 'Infinity AI',
  };
  const deliveries = (options.endpoints || hunt.webhooks || []).map(u => ({ url: String(u), event: payload.event }));
  return {
    payload,
    deliveries,
    deliveryCount: deliveries.length,
    valid: Boolean(payload.huntId && payload.reason),
    summary: `Infinity AI webhook ${payload.event} for ${payload.huntId || 'the hunt'} ready for ${deliveries.length} endpoint(s).`,
  };
}

/**
 * Describe the power-user reopen shortcut (idea 52942).
 * The key chord opens the reason dialog only on a closed hunt;
 * open hunts and editable fields ignore it.
 */
export function describeReopenShortcut(context = {}, options = {}) {
  const keys = String(context.keys || options.keys || 'ctrl+shift+r').toLowerCase().replace(/\s+/g, '');
  const canonical = 'ctrl+shift+r';
  const matches = keys === canonical || keys === 'cmd+shift+r';
  const state = String(context.huntState || context.status || '').toLowerCase();
  const closed = ['closed', 'archived', 'completed'].includes(state);
  const inField = Boolean(context.inInput || context.editing);
  const triggers = matches && closed && !inField;
  return {
    shortcut: canonical,
    matches,
    huntState: state || 'unknown',
    triggers,
    action: triggers ? 'open-reason-dialog' : 'ignore',
    summary: triggers
      ? `Infinity AI: ${canonical} opens the reopen reason dialog.`
      : 'Infinity AI: the reopen shortcut does not apply here.',
  };
}

/**
 * Show what a reopen will restore before it commits (idea 52943).
 * Findings, decisions, shares, and schedules are counted so the
 * confirmation dialog never hides the blast radius.
 */
export function buildReopenConfirmation(hunt = {}, options = {}) {
  const snapshot = hunt.snapshot || {};
  const findings = snapshot.findings || hunt.findings || [];
  const decisions = snapshot.decisions || snapshot.triageDecisions || hunt.decisions || [];
  const shares = hunt.shareLinks || options.shareLinks || [];
  const schedules = hunt.schedules || options.schedules || [];
  const scope = hunt.scope?.include || hunt.scope || [];
  return {
    huntId: hunt.huntId || hunt.id || null,
    previousState: String(hunt.status || hunt.state || 'closed').toLowerCase(),
    willRestore: [
      { item: 'findings', count: findings.length },
      { item: 'triage decisions', count: decisions.length },
      { item: 'share links', count: shares.length },
      { item: 'schedules', count: schedules.length },
      { item: 'scope entries', count: Array.isArray(scope) ? scope.length : 0 },
    ],
    totalItems: findings.length + decisions.length + shares.length + schedules.length,
    requiresReason: true,
    summary: `Infinity AI will restore ${findings.length} finding(s) and ${decisions.length} decision(s) for ${hunt.huntId || 'the hunt'}.`,
  };
}

/**
 * Broadcast a custom team note on reopen (idea 52944).
 * The note rides with the reopen notification so every watcher
 * learns the why in the author's own words.
 */
export function buildTeamNoteOnReopen(hunt = {}, note = {}, options = {}) {
  const text = String(note.text || note.message || '').trim().slice(0, 400);
  const recipients = [...new Set([...(hunt.watchers || []), ...(hunt.assignees || []), ...(hunt.owner ? [hunt.owner] : [])].map(String))];
  const valid = text.length >= 4;
  return {
    huntId: hunt.huntId || hunt.id || null,
    author: note.author || note.by || 'unknown',
    text,
    valid,
    recipients,
    recipientCount: recipients.length,
    summary: valid
      ? `Infinity AI will broadcast the reopen note for ${hunt.huntId || 'the hunt'} to ${recipients.length} teammate(s).`
      : 'Infinity AI: the team note is too short to broadcast.',
  };
}

/**
 * Build the activity-feed entry for a reopen (idea 52945).
 * Reopens render as a prominent feed event with hunt, actor,
 * reason, and a direct link back to the hunt.
 */
export function buildActivityFeedReopenEntry(hunt = {}, event = {}, options = {}) {
  return {
    entry: {
      kind: 'hunt-reopened',
      huntId: hunt.huntId || hunt.id || null,
      target: hunt.target || null,
      actor: event.actor || event.requestedBy || 'unknown',
      reason: String(event.reason || '').slice(0, 120),
      at: event.at || options.now || '2026-10-09T00:00:00Z',
      prominence: 'high',
      link: `/hunts/${hunt.huntId || hunt.id || ''}`,
    },
    feed: options.feedId || 'workspace',
    summary: `Infinity AI added a reopen entry for ${hunt.huntId || 'the hunt'} to the activity feed.`,
  };
}

/**
 * Analyze which reopen reasons recur most (idea 52946).
 * Reason categories and free-text themes across hunts point at
 * the process improvements with the highest leverage.
 */
export function analyzeReopenReasons(hunts = [], options = {}) {
  const byWord = {};
  const byCategory = {};
  let totalReopens = 0;
  for (const h of hunts || []) {
    for (const r of h.reopenHistory || []) {
      totalReopens += 1;
      const cat = String(r.category || 'general').toLowerCase();
      byCategory[cat] = (byCategory[cat] || 0) + 1;
      for (const w of tokenize(r.reason || '')) {
        if (['the', 'and', 'for', 'this', 'that', 'with', 'after'].includes(w)) continue;
        byWord[w] = (byWord[w] || 0) + 1;
      }
    }
  }
  const ranked = Object.entries(byCategory).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  const topWords = Object.entries(byWord).map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word)).slice(0, 5);
  return {
    totalReopens,
    byCategory,
    ranked,
    topReason: ranked[0] || null,
    topWords,
    summary: ranked.length
      ? `Infinity AI reopen reasons: ${ranked[0].category} leads with ${ranked[0].count} of ${totalReopens}.`
      : 'Infinity AI: no reopen reasons recorded yet.',
  };
}

/**
 * Verify integrity right after a reopen (idea 52947).
 * Finding counts, decision links, and scope are compared with
 * the snapshot; every mismatch is reported, never hidden.
 */
export function runPostReopenHealthCheck(hunt = {}, snapshot = {}, options = {}) {
  const expected = snapshot.findings || [];
  const actual = hunt.findings || [];
  const expectedDecisions = snapshot.decisions || snapshot.triageDecisions || [];
  const actualDecisions = hunt.decisions || hunt.triageDecisions || [];
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });
  add('finding-count', expected.length === actual.length, `${actual.length} of ${expected.length} finding(s) present`);
  add('decisions-preserved', expectedDecisions.length === actualDecisions.length, `${actualDecisions.length} of ${expectedDecisions.length} decision(s) present`);
  const scope = hunt.scope?.include || hunt.scope || [];
  add('scope-present', Array.isArray(scope) && scope.length > 0, `${Array.isArray(scope) ? scope.length : 0} scope entrie(s)`);
  add('state-open', String(hunt.status || hunt.state || '').toLowerCase() === 'open', `state is ${String(hunt.status || hunt.state || 'unknown')}`);
  const failed = checks.filter(c => !c.ok);
  return {
    huntId: hunt.huntId || hunt.id || null,
    checks,
    healthy: failed.length === 0,
    issueCount: failed.length,
    summary: failed.length
      ? `Infinity AI health check for ${hunt.huntId || 'the hunt'} found ${failed.length} issue(s).`
      : `Infinity AI health check passed for ${hunt.huntId || 'the hunt'}.`,
  };
}

/**
 * Save a hunt configuration as a reusable template (idea 52948).
 * Scope, engines, payload, schedule, and triage defaults are
 * captured in one click from a finished hunt.
 */
export function saveHuntAsTemplate(hunt = {}, options = {}) {
  const scope = hunt.scope?.include || hunt.scope || [];
  const template = {
    id: options.templateId || `tpl-${slug(hunt.huntId || hunt.target || 'hunt')}`,
    name: String(options.name || `Template from ${hunt.huntId || 'hunt'}`).slice(0, 80),
    sourceHuntId: hunt.huntId || hunt.id || null,
    scope: { include: [...scope], exclude: [...(hunt.scope?.exclude || [])] },
    engines: [...(hunt.engines || hunt.stats?.engines || [])],
    payloadProfile: hunt.payloadProfile || { aggressiveness: 'balanced' },
    schedule: hunt.schedule || { cadence: 'weekly' },
    triageRules: [...(hunt.triageRules || [])],
    createdBy: options.createdBy || hunt.owner || 'unknown',
  };
  return {
    template,
    templateId: template.id,
    sectionCount: 5,
    summary: `Infinity AI saved ${template.id} from ${hunt.huntId || 'the hunt'}.`,
  };
}

/**
 * Capture scope patterns into a template (idea 52949).
 * Inclusions, exclusions, and target patterns are stored so the
 * template never scans outside its proven surface.
 */
export function captureTemplateScope(source = {}, options = {}) {
  const include = [...(source.scope?.include || source.include || [])].map(String);
  const exclude = [...(source.scope?.exclude || source.exclude || [])].map(String);
  return {
    templateId: source.templateId || source.id || null,
    include,
    exclude,
    pattern: include.map(h => `*.${h.replace(/^[^.]+\./, '')}`).filter((v, i, a) => a.indexOf(v) === i),
    includeCount: include.length,
    excludeCount: exclude.length,
    summary: `Infinity AI captured ${include.length} inclusion(s) and ${exclude.length} exclusion(s) for the template.`,
  };
}

/**
 * Capture engine selection into a template (idea 52950).
 * Engine ids and versions are frozen so hunts from the template
 * run the exact stack that proved itself.
 */
export function captureTemplateEngines(source = {}, options = {}) {
  const raw = source.engines || source.stats?.engines || [];
  const engines = (raw || []).map(e => (typeof e === 'string' ? { id: e, version: 'current' } : { id: e.id || 'engine', version: e.version || 'current' }));
  return {
    templateId: source.templateId || source.id || null,
    engines,
    engineCount: engines.length,
    summary: `Infinity AI captured ${engines.length} engine(s) for the template.`,
  };
}

/**
 * Capture the payload profile into a template (idea 52951).
 * Aggressiveness, payload sets, and stealth settings travel with
 * the template so new hunts inherit the tuned profile.
 */
export function captureTemplatePayloadProfile(source = {}, options = {}) {
  const profile = source.payloadProfile || source.payload || {};
  const captured = {
    aggressiveness: String(profile.aggressiveness || 'balanced').toLowerCase(),
    payloadSets: [...(profile.payloadSets || profile.sets || ['standard'])].map(String),
    stealth: Boolean(profile.stealth),
    rateLimitPerMinute: Number(profile.rateLimitPerMinute ?? 60),
  };
  return {
    templateId: source.templateId || source.id || null,
    profile: captured,
    summary: `Infinity AI captured a ${captured.aggressiveness} payload profile (${captured.payloadSets.length} set(s)) for the template.`,
  };
}

/**
 * Capture the schedule into a template (idea 52952).
 * Default cadence and run windows are stored so templated hunts
 * start with the rhythm the original hunt used.
 */
export function captureTemplateSchedule(source = {}, options = {}) {
  const sched = source.schedule || {};
  const captured = {
    cadence: String(sched.cadence || 'weekly').toLowerCase(),
    window: String(sched.window || 'business-hours'),
    timezone: String(sched.timezone || 'UTC'),
    enabled: sched.enabled !== false,
  };
  return {
    templateId: source.templateId || source.id || null,
    schedule: captured,
    summary: `Infinity AI captured a ${captured.cadence} schedule (${captured.window}) for the template.`,
  };
}

/**
 * Capture triage rules into a template (idea 52953).
 * Auto-prioritization and routing rules are bundled so findings
 * from templated hunts land with the right owners.
 */
export function captureTemplateTriageRules(source = {}, options = {}) {
  const rules = (source.triageRules || source.rules || []).map(r => ({ ...r }));
  return {
    templateId: source.templateId || source.id || null,
    rules,
    ruleCount: rules.length,
    summary: `Infinity AI captured ${rules.length} triage rule(s) for the template.`,
  };
}

/**
 * Browse the template library (idea 52954).
 * Templates are searchable by keyword with previews and usage
 * stats; ordering is deterministic for a stable gallery.
 */
export function browseTemplateLibrary(templates = [], query = '', options = {}) {
  const needle = String(query || '').toLowerCase().trim();
  const list = (templates || []).map(t => ({ ...t }));
  const matched = list.filter(t => {
    if (!needle) return true;
    const text = `${t.name || ''} ${t.id || ''} ${(t.tags || []).join(' ')} ${t.description || ''}`.toLowerCase();
    return text.includes(needle);
  }).map(t => ({
    id: t.id || null,
    name: t.name || 'Untitled template',
    uses: Number(t.uses ?? t.usageCount ?? 0),
    rating: t.rating ?? null,
    scopeCount: (t.scope?.include || []).length,
  }));
  matched.sort((a, b) => b.uses - a.uses || String(a.id).localeCompare(String(b.id)));
  return {
    templates: matched.slice(0, Number(options.limit || 50)),
    count: matched.length,
    total: list.length,
    query: needle,
    summary: `Infinity AI found ${matched.length} template(s)${needle ? ` for "${needle}"` : ''}.`,
  };
}

/**
 * Publish a template to the team workspace (idea 52955).
 * Description, owner, and visibility are recorded so teammates
 * can discover and trust the shared template.
 */
export function shareTemplateWithTeam(template = {}, sharing = {}, options = {}) {
  const published = {
    templateId: template.id || template.templateId || null,
    name: template.name || 'Untitled template',
    description: String(sharing.description || template.description || '').slice(0, 240),
    owner: sharing.owner || template.owner || template.createdBy || 'unknown',
    visibility: String(sharing.visibility || 'workspace').toLowerCase(),
    publishedAt: options.now || '2026-10-09T00:00:00Z',
  };
  return {
    ...published,
    shared: published.visibility === 'workspace' || published.visibility === 'team',
    summary: `Infinity AI published ${published.templateId || 'the template'} to the workspace.`,
  };
}

/**
 * Version a template on every edit (idea 52956).
 * Each change creates a new version while prior versions stay
 * immutable, and hunts record the version they launched from.
 */
export function versionTemplate(template = {}, changes = {}, options = {}) {
  const prior = (template.versions || []).map(v => ({ ...v }));
  const nextNumber = prior.length + 1;
  const version = {
    version: nextNumber,
    at: options.now || '2026-10-09T00:00:00Z',
    by: changes.by || options.by || 'unknown',
    note: String(changes.note || 'Template updated.').slice(0, 160),
  };
  return {
    templateId: template.id || template.templateId || null,
    versions: [...prior, version],
    currentVersion: nextNumber,
    versionCount: nextNumber,
    summary: `Infinity AI created version ${nextNumber} of ${template.id || 'the template'}.`,
  };
}

/**
 * Fork a template without touching the original (idea 52957).
 * The clone carries the source configuration plus the caller's
 * overrides under a fresh identity.
 */
export function forkTemplate(template = {}, overrides = {}, options = {}) {
  const fork = {
    id: options.newId || `${template.id || 'tpl'}-fork`,
    name: String(overrides.name || `${template.name || 'Template'} (fork)`).slice(0, 80),
    forkedFrom: template.id || template.templateId || null,
    scope: { include: [...(overrides.scope?.include || template.scope?.include || [])], exclude: [...(overrides.scope?.exclude || template.scope?.exclude || [])] },
    engines: [...(overrides.engines || template.engines || [])].map(e => (typeof e === 'string' ? e : e.id)),
    owner: overrides.owner || options.owner || 'unknown',
  };
  return {
    template: fork,
    originalId: fork.forkedFrom,
    forkId: fork.id,
    summary: `Infinity AI forked ${fork.forkedFrom || 'the template'} into ${fork.id}.`,
  };
}

/**
 * Rate a template on result quality (idea 52958).
 * Stars and comments roll into an average so the best templates
 * surface; a single rating never hides the sample size.
 */
export function rateTemplate(template = {}, rating = {}, options = {}) {
  const stars = Math.max(1, Math.min(5, Number(rating.stars || rating.score || 0)));
  const prevCount = Number(template.ratingCount ?? (template.ratings || []).length);
  const prevAvg = Number(template.ratingAvg ?? template.rating ?? 0);
  const count = prevCount + (stars ? 1 : 0);
  const average = count ? Math.round(((prevAvg * prevCount + stars) / count) * 10) / 10 : 0;
  return {
    templateId: template.id || template.templateId || null,
    recorded: stars >= 1 && stars <= 5,
    stars,
    ratingCount: count,
    average,
    summary: `Infinity AI recorded a ${stars}-star rating for ${template.id || 'the template'} (average ${average}).`,
  };
}

/**
 * Compute template usage statistics (idea 52959).
 * Use counts, finding yield, and false-positive rates per
 * template show which configurations actually deliver.
 */
export function computeTemplateUsageStats(templates = [], hunts = [], options = {}) {
  const huntList = hunts || [];
  const stats = (templates || []).map(t => {
    const id = t.id || t.templateId;
    const used = huntList.filter(h => h.templateId === id || h.template?.id === id);
    const findings = used.reduce((s, h) => s + (h.findings || []).length, 0);
    return {
      templateId: id,
      name: t.name || 'Untitled template',
      uses: used.length,
      totalFindings: findings,
      averageYield: used.length ? Math.round((findings / used.length) * 10) / 10 : 0,
    };
  });
  stats.sort((a, b) => b.uses - a.uses || String(a.templateId).localeCompare(String(b.templateId)));
  return {
    stats,
    templateCount: stats.length,
    topTemplate: stats[0] || null,
    summary: stats.length
      ? `Infinity AI usage: ${stats[0].templateId} leads with ${stats[0].uses} use(s).`
      : 'Infinity AI: no template usage recorded yet.',
  };
}

/**
 * Preview a template before launching from it (idea 52960).
 * The full configuration — scope, engines, payload, schedule,
 * triage — renders as one inspectable summary.
 */
export function previewTemplate(template = {}, options = {}) {
  const scopeInclude = template.scope?.include || [];
  const engines = (template.engines || []).map(e => (typeof e === 'string' ? e : e.id));
  const sections = [
    { name: 'scope', items: scopeInclude.length },
    { name: 'engines', items: engines.length },
    { name: 'payload', items: template.payloadProfile ? 1 : 0 },
    { name: 'schedule', items: template.schedule ? 1 : 0 },
    { name: 'triage rules', items: (template.triageRules || []).length },
  ];
  return {
    templateId: template.id || template.templateId || null,
    name: template.name || 'Untitled template',
    sections,
    scopeInclude: [...scopeInclude],
    engines,
    payloadProfile: template.payloadProfile || null,
    schedule: template.schedule || null,
    triageRuleCount: (template.triageRules || []).length,
    complete: sections.every(s => s.items > 0 || s.name === 'triage rules'),
    summary: `Infinity AI preview of ${template.id || 'the template'}: ${scopeInclude.length} scope entrie(s), ${engines.length} engine(s).`,
  };
}
