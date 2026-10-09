/**
 * Wave 108C — Target scoring factors + analyst notes (ideas 54301-54310).
 *
 * Pure JS core logic for the Dark Matter / Hunt AI target page: port-exposure
 * scoring factors, score recalculation triggers, the public score API shape,
 * provisional scoring for newly onboarded targets, and a full analyst-notes
 * toolkit (rich-text blocks, safe Markdown, pinning, templates, timeline
 * annotations, screenshot attachments).
 *
 * No JSX, no side effects beyond a small trigger registry — every export is
 * deterministic and testable with plain objects. Branding: Infinity AI /
 * Dark Matter / Obfinity.
 */

export const WAVE108_C_IDEAS = [
  { id: 54301, title: 'Port exposure factor', summary: 'Weighs unexpected open services (databases, admin panels) in the target score.' },
  { id: 54302, title: 'Score recalculation triggers', summary: 'Recomputes scores automatically on hunt completion, change detection, and scope edits.' },
  { id: 54303, title: 'Score API', summary: 'Exposes current scores and factor breakdowns for external prioritization tools.' },
  { id: 54304, title: 'New-target provisional scoring', summary: 'Assigns a clearly-marked provisional score from onboarding signals until real data arrives.' },
  { id: 54305, title: 'Rich-text notes editor', summary: 'Formats notes with headings, lists, links, and callouts without leaving the target page.' },
  { id: 54306, title: 'Markdown support', summary: 'Writes notes in Markdown with live preview for technical documentation.' },
  { id: 54307, title: 'Note pinning', summary: 'Pins critical notes to the top of the target notes panel so context is never buried.' },
  { id: 54308, title: 'Note templates', summary: 'Starts notes from templates like "Access credentials", "Scope caveats", or "Client contacts".' },
  { id: 54309, title: 'Timestamped annotations', summary: 'Attaches notes to specific timeline events with one click from the event row.' },
  { id: 54310, title: 'Screenshot attachments', summary: 'Embeds annotated screenshots directly inside notes with drag and drop.' },
];

/* ------------------------------------------------------------------ */
/* Shared scoring model                                                 */
/* ------------------------------------------------------------------ */

export const SCORE_MODEL_VERSION = 'infinity-score/108.0';
export const SCORE_FACTOR_MAX = 100;

export const SCORE_BANDS = [
  { min: 80, band: 'critical' },
  { min: 60, band: 'high' },
  { min: 40, band: 'medium' },
  { min: 20, band: 'low' },
  { min: 0, band: 'info' },
];

/**
 * Maps a 0-100 score to a severity band.
 */
export function scoreBand(score) {
  const n = Math.max(0, Math.min(100, Number(score) || 0));
  for (const { min, band } of SCORE_BANDS) {
    if (n >= min) return band;
  }
  return 'info';
}

/* ------------------------------------------------------------------ */
/* 54301 — Port exposure factor                                         */
/* ------------------------------------------------------------------ */

/**
 * Known risky services: { service, risk, weight, reason }.
 * Weight is the factor contribution (0-100) when the port is open and NOT expected.
 */
export const PORT_SERVICE_RISK = {
  21: { service: 'FTP', risk: 'medium', weight: 12, reason: 'cleartext credential exchange' },
  22: { service: 'SSH', risk: 'medium', weight: 10, reason: 'remote shell exposed to the internet' },
  23: { service: 'Telnet', risk: 'critical', weight: 28, reason: 'unencrypted remote administration' },
  445: { service: 'SMB', risk: 'high', weight: 22, reason: 'file sharing exposed (lateral movement vector)' },
  1433: { service: 'MSSQL', risk: 'critical', weight: 32, reason: 'database directly exposed' },
  1521: { service: 'Oracle DB', risk: 'critical', weight: 32, reason: 'database directly exposed' },
  3306: { service: 'MySQL', risk: 'critical', weight: 32, reason: 'database directly exposed' },
  3389: { service: 'RDP', risk: 'high', weight: 24, reason: 'remote desktop exposed to the internet' },
  5432: { service: 'PostgreSQL', risk: 'critical', weight: 32, reason: 'database directly exposed' },
  5900: { service: 'VNC', risk: 'high', weight: 24, reason: 'remote framebuffer exposed' },
  5985: { service: 'WinRM', risk: 'high', weight: 20, reason: 'remote management exposed' },
  6379: { service: 'Redis', risk: 'critical', weight: 32, reason: 'in-memory datastore often unauthenticated' },
  8080: { service: 'HTTP-alt', risk: 'medium', weight: 14, reason: 'frequently hosts admin or debug panels' },
  8443: { service: 'HTTPS-alt', risk: 'low', weight: 8, reason: 'alternate TLS service, usually expected' },
  9000: { service: 'App/debug', risk: 'medium', weight: 14, reason: 'common debug / tooling port' },
  9200: { service: 'Elasticsearch', risk: 'high', weight: 24, reason: 'search engine with data-leak history' },
  11211: { service: 'Memcached', risk: 'high', weight: 22, reason: 'cache often unauthenticated' },
  2375: { service: 'Docker API', risk: 'critical', weight: 36, reason: 'unauthenticated Docker API = host compromise' },
  27017: { service: 'MongoDB', risk: 'critical', weight: 32, reason: 'database directly exposed' },
};

const UNKNOWN_PORT_WEIGHT = 5;

/**
 * Weighs unexpected open services in the target score.
 * @param {Array<{port:number, service?:string, banner?:string}>} openPorts
 * @param {Array<number|string>} expectedServices — port numbers or service names considered normal
 * @returns {{factor:number, factorMax:number, unexpected:Array, expected:Array, totalOpen:number}}
 */
export function portExposureScore(openPorts, expectedServices = []) {
  const ports = Array.isArray(openPorts) ? openPorts : [];
  const expected = new Set(
    (Array.isArray(expectedServices) ? expectedServices : []).map((s) =>
      typeof s === 'number' ? s : String(s).toLowerCase()
    )
  );
  const isExpected = (port, service) =>
    expected.has(port) || (service && expected.has(String(service).toLowerCase()));

  const unexpected = [];
  const expectedList = [];
  for (const entry of ports) {
    const port = Number(entry && entry.port);
    if (!Number.isFinite(port)) continue;
    const known = PORT_SERVICE_RISK[port];
    const service = (entry && entry.service) || (known && known.service) || 'unknown';
    if (isExpected(port, service)) {
      expectedList.push({ port, service });
      continue;
    }
    const detail = known
      ? { port, service, risk: known.risk, weight: known.weight, reason: known.reason }
      : { port, service, risk: 'low', weight: UNKNOWN_PORT_WEIGHT, reason: 'unexpected open port' };
    unexpected.push(detail);
  }
  const factor = Math.min(
    SCORE_FACTOR_MAX,
    unexpected.reduce((sum, u) => sum + u.weight, 0)
  );
  return {
    factor,
    factorMax: SCORE_FACTOR_MAX,
    unexpected: unexpected.sort((a, b) => b.weight - a.weight),
    expected: expectedList,
    totalOpen: expectedList.length + unexpected.length,
  };
}

/* ------------------------------------------------------------------ */
/* 54302 — Score recalculation triggers                                 */
/* ------------------------------------------------------------------ */

export const DEFAULT_RECALC_TRIGGERS = [
  { eventType: 'hunt-completed', reason: 'fresh findings may change the score', enabled: true },
  { eventType: 'change-detected', reason: 'target changed since the last scoring', enabled: true },
  { eventType: 'scope-edited', reason: 'attack surface changed with the scope', enabled: true },
];

const customTriggers = [];

/**
 * Registers an extra event type that should trigger a score recompute.
 * Returns the full trigger list.
 */
export function registerRecalcTrigger(eventType, reason = 'custom trigger') {
  if (!eventType || typeof eventType !== 'string') throw new Error('eventType is required');
  const existing = customTriggers.find((t) => t.eventType === eventType);
  if (!existing) customTriggers.push({ eventType, reason, enabled: true, custom: true });
  return listRecalcTriggers();
}

/**
 * Lists every trigger (defaults + registered custom triggers).
 */
export function listRecalcTriggers() {
  return [...DEFAULT_RECALC_TRIGGERS, ...customTriggers];
}

/**
 * Decides whether an incoming event should recompute the score.
 * @param {string|{type:string}} event
 * @returns {{recalc:boolean, eventType:string|null, reason:string|null}}
 */
export function shouldRecalc(event) {
  const type = typeof event === 'string' ? event : event && event.type;
  const found = listRecalcTriggers().find((t) => t.enabled && t.eventType === type);
  return {
    recalc: Boolean(found),
    eventType: type || null,
    reason: found ? found.reason : null,
  };
}

/**
 * Clears only the custom (registered) triggers — defaults always stay on.
 */
export function resetRecalcTriggers() {
  customTriggers.length = 0;
  return listRecalcTriggers();
}

/* ------------------------------------------------------------------ */
/* 54303 — Score API                                                    */
/* ------------------------------------------------------------------ */

/**
 * Builds the external-facing score payload for prioritization tools.
 * @param {{id:string, name?:string, score:number, factors?:Array<{name:string, score:number, weight?:number}>}} target
 * @returns JSON-serializable {target, score, band, factors, modelVersion, computedAt}
 */
export function buildScoreApiResponse(target) {
  if (!target || !target.id) throw new Error('target.id is required');
  const score = Math.max(0, Math.min(100, Number(target.score) || 0));
  const factors = (Array.isArray(target.factors) ? target.factors : []).map((f) => ({
    name: f.name || 'factor',
    score: Math.max(0, Math.min(100, Number(f.score) || 0)),
    weight: f.weight === undefined ? 1 : Number(f.weight) || 0,
  }));
  return {
    target: { id: target.id, name: target.name || null },
    score,
    band: scoreBand(score),
    factors,
    modelVersion: SCORE_MODEL_VERSION,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Serializes the API response to a JSON string (throws on non-serializable input).
 */
export function scoreApiToJson(target) {
  return JSON.stringify(buildScoreApiResponse(target));
}

/* ------------------------------------------------------------------ */
/* 54304 — New-target provisional scoring                               */
/* ------------------------------------------------------------------ */

export const ONBOARDING_SIGNALS = [
  'domainVerified',
  'scopeDefined',
  'assetInventory',
  'techStack',
  'priorReports',
];

const SIGNAL_LABELS = {
  domainVerified: 'domain verified',
  scopeDefined: 'scope defined',
  assetInventory: 'asset inventory',
  techStack: 'technology stack',
  priorReports: 'prior reports',
};

const PROVISIONAL_BASE = 30;
const PROVISIONAL_PER_SIGNAL = 10;

/**
 * Assigns a clearly-marked provisional score from onboarding signals.
 * Provisional stays true until every onboarding signal is present.
 * @param {{[signal]:boolean}} onboardingSignals
 * @returns {{score:number, band:string, provisional:boolean, missingSignals:string[], presentSignals:string[], computedAt:string}}
 */
export function provisionalScore(onboardingSignals = {}) {
  const present = [];
  const missing = [];
  for (const key of ONBOARDING_SIGNALS) {
    if (onboardingSignals && onboardingSignals[key]) present.push(key);
    else missing.push(key);
  }
  const score = Math.min(
    SCORE_FACTOR_MAX,
    PROVISIONAL_BASE + present.length * PROVISIONAL_PER_SIGNAL
  );
  return {
    score,
    band: scoreBand(score),
    provisional: missing.length > 0,
    presentSignals: present.map((k) => SIGNAL_LABELS[k] || k),
    missingSignals: missing.map((k) => SIGNAL_LABELS[k] || k),
    computedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* 54305 — Rich-text notes editor                                       */
/* ------------------------------------------------------------------ */

export const RICH_BLOCK_KINDS = ['heading', 'paragraph', 'list', 'link', 'callout'];
export const CALLOUT_TONES = ['info', 'success', 'warning', 'danger'];

/**
 * Creates a new rich-text note document made of blocks.
 */
export function createRichDoc(title = 'Untitled note', now = new Date().toISOString()) {
  return { title, version: 1, blocks: [], createdAt: now };
}

function withBlock(doc, block) {
  if (!RICH_BLOCK_KINDS.includes(block.kind)) throw new Error(`unknown block kind: ${block.kind}`);
  return { ...doc, blocks: [...doc.blocks, block] };
}

export function addHeading(doc, level, text) {
  const n = Math.max(1, Math.min(3, Number(level) || 1));
  if (!text) throw new Error('heading text is required');
  return withBlock(doc, { kind: 'heading', level: n, text: String(text) });
}

export function addParagraph(doc, text) {
  if (!text) throw new Error('paragraph text is required');
  return withBlock(doc, { kind: 'paragraph', text: String(text) });
}

export function addList(doc, items, ordered = false) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('items is required');
  return withBlock(doc, { kind: 'list', ordered: Boolean(ordered), items: items.map(String) });
}

export function addCallout(doc, tone, text) {
  if (!CALLOUT_TONES.includes(tone)) throw new Error(`unknown callout tone: ${tone}`);
  if (!text) throw new Error('callout text is required');
  return withBlock(doc, { kind: 'callout', tone, text: String(text) });
}

export function addLink(doc, url, label) {
  if (!url) throw new Error('url is required');
  return withBlock(doc, { kind: 'link', url: String(url), label: label ? String(label) : String(url) });
}

/**
 * Renders a rich-text block document to Markdown (used for storage and preview).
 */
export function richDocToMarkdown(doc) {
  if (!doc || !Array.isArray(doc.blocks)) return '';
  const out = [];
  for (const block of doc.blocks) {
    switch (block.kind) {
      case 'heading':
        out.push(`${'#'.repeat(block.level || 1)} ${block.text}`);
        break;
      case 'paragraph':
        out.push(block.text);
        break;
      case 'list':
        block.items.forEach((item, i) => {
          out.push(block.ordered ? `${i + 1}. ${item}` : `- ${item}`);
        });
        break;
      case 'link':
        out.push(`[${block.label}](${block.url})`);
        break;
      case 'callout':
        out.push(`> **${block.tone.toUpperCase()}** — ${block.text}`);
        break;
      default:
        break;
    }
    out.push('');
  }
  return out.join('\n').trim();
}

/* ------------------------------------------------------------------ */
/* 54306 — Markdown support (safe lite renderer)                        */
/* ------------------------------------------------------------------ */

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeUrl(url) {
  const trimmed = String(url).trim();
  if (/^(https?:\/\/|mailto:|#|\/)/i.test(trimmed)) return trimmed;
  return '#';
}

function renderInline(text) {
  // Escape raw HTML first so injected markup can never execute.
  let out = escapeHtml(text);
  // Inline code first (protects contents from further formatting).
  out = out.replace(/`([^`]+?)`/g, (m, code) => `<code>${code}</code>`);
  // Links.
  out = out.replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, (m, label, url) => {
    const safe = escapeHtml(sanitizeUrl(url));
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  // Bold then italic.
  out = out.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+?)\*/g, '$1<em>$2</em>');
  return out;
}

/**
 * Converts a small Markdown subset to safe HTML. Raw HTML in the source is
 * escaped (never rendered), so note previews cannot inject markup.
 * Supports: fenced code blocks, headings (#-###), bold/italic, inline code,
 * links, ordered/unordered lists, blockquotes, horizontal rules, paragraphs.
 */
export function markdownToHtmlLite(md) {
  const source = String(md == null ? '' : md);
  const lines = source.split('\n');
  const html = [];
  let i = 0;
  let inCode = false;
  let codeLang = '';
  const codeBuf = [];
  let listOpen = null; // 'ul' | 'ol' | null
  let paraBuf = [];

  const closeList = () => {
    if (listOpen) {
      html.push(`</${listOpen}>`);
      listOpen = null;
    }
  };
  const flushPara = () => {
    if (paraBuf.length > 0) {
      html.push(`<p>${renderInline(paraBuf.join(' '))}</p>`);
      paraBuf = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```(\w*)\s*$/);

    if (fence) {
      flushPara();
      closeList();
      if (!inCode) {
        inCode = true;
        codeLang = fence[1] || '';
        codeBuf.length = 0;
      } else {
        inCode = false;
        const cls = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : '';
        html.push(`<pre><code${cls}>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
      }
      i += 1;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    const hr = /^\s*(---|\*\*\*)\s*$/.test(line);
    const quote = line.match(/^>\s?(.*)$/);
    const ulItem = line.match(/^\s*[-*]\s+(.*)$/);
    const olItem = line.match(/^\s*\d+[.)]\s+(.*)$/);

    if (heading) {
      flushPara();
      closeList();
      html.push(`<h${heading[1].length}>${renderInline(heading[2])}</h${heading[1].length}>`);
    } else if (hr) {
      flushPara();
      closeList();
      html.push('<hr/>');
    } else if (quote) {
      flushPara();
      closeList();
      html.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
    } else if (ulItem) {
      flushPara();
      if (listOpen !== 'ul') {
        closeList();
        html.push('<ul>');
        listOpen = 'ul';
      }
      html.push(`<li>${renderInline(ulItem[1])}</li>`);
    } else if (olItem) {
      flushPara();
      if (listOpen !== 'ol') {
        closeList();
        html.push('<ol>');
        listOpen = 'ol';
      }
      html.push(`<li>${renderInline(olItem[1])}</li>`);
    } else if (/^\s*$/.test(line)) {
      flushPara();
      closeList();
    } else {
      paraBuf.push(line.trim());
    }
    i += 1;
  }

  if (inCode) {
    // Unterminated fence: render what we have as a code block.
    const cls = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : '';
    html.push(`<pre><code${cls}>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
  }
  flushPara();
  closeList();
  return html.join('\n');
}

/* ------------------------------------------------------------------ */
/* 54307 — Note pinning                                                 */
/* ------------------------------------------------------------------ */

/**
 * Pins a note; pinned notes sort first (by pinned time).
 * @param {Array} notes — note objects with at least {id}
 */
export function pinNote(notes, id, now = new Date().toISOString()) {
  return sortNotesPinnedFirst(
    (Array.isArray(notes) ? notes : []).map((n) =>
      n.id === id ? { ...n, pinned: true, pinnedAt: now } : n
    )
  );
}

export function unpinNote(notes, id) {
  return sortNotesPinnedFirst(
    (Array.isArray(notes) ? notes : []).map((n) =>
      n.id === id ? { ...n, pinned: false, pinnedAt: null } : n
    )
  );
}

export function isNotePinned(note) {
  return Boolean(note && note.pinned);
}

export function sortNotesPinnedFirst(notes) {
  const list = Array.isArray(notes) ? [...notes] : [];
  return list.sort((a, b) => {
    const ap = a.pinned ? 1 : 0;
    const bp = b.pinned ? 1 : 0;
    if (ap !== bp) return bp - ap; // pinned first
    if (ap && bp) return String(a.pinnedAt || '').localeCompare(String(b.pinnedAt || ''));
    return 0; // unpinned keep original relative order (stable sort)
  });
}

/* ------------------------------------------------------------------ */
/* 54308 — Note templates                                               */
/* ------------------------------------------------------------------ */

export const NOTE_TEMPLATES = {
  'access-credentials': {
    title: 'Access credentials',
    description: 'Test accounts, roles, and auth details for this target.',
    sections: [
      { heading: 'Test accounts', items: ['- username / password — role:'] },
      { heading: 'Auth notes', items: ['- MFA enabled: yes/no', '- Password reset flow:'] },
      { heading: 'Rotation', items: ['- Credentials rotated on:'] },
    ],
  },
  'scope-caveats': {
    title: 'Scope caveats',
    description: 'Out-of-scope areas and testing constraints to never forget.',
    sections: [
      { heading: 'Out of scope', items: ['- '] },
      { heading: 'Rate limits', items: ['- '] },
      { heading: 'Coordination', items: ['- Contact before destructive tests:'] },
    ],
  },
  'client-contacts': {
    title: 'Client contacts',
    description: 'Who to reach for escalations and confirmations.',
    sections: [
      { heading: 'Primary contact', items: ['- Name:', '- Email:', '- Response window:'] },
      { heading: 'Security team', items: ['- Name:', '- Email:'] },
      { heading: 'Escalation path', items: ['- '] },
    ],
  },
};

/**
 * Lists available note templates: [{key, title, description}].
 */
export function listNoteTemplates() {
  return Object.entries(NOTE_TEMPLATES).map(([key, t]) => ({
    key,
    title: t.title,
    description: t.description,
  }));
}

/**
 * Builds a note object from a template key.
 * @returns {{id, title, body, format, template, pinned, createdAt}}
 */
export function noteFromTemplate(templateKey, now = new Date().toISOString()) {
  const tpl = NOTE_TEMPLATES[templateKey];
  if (!tpl) throw new Error(`unknown template: ${templateKey}`);
  const body = [`# ${tpl.title}`, '']
    .concat(
      tpl.sections.flatMap((s) => [`## ${s.heading}`, '', ...s.items, ''])
    )
    .join('\n')
    .trim();
  return {
    id: `note:${templateKey}:${Date.now()}`,
    title: tpl.title,
    body,
    format: 'markdown',
    template: templateKey,
    pinned: false,
    pinnedAt: null,
    createdAt: now,
  };
}

/* ------------------------------------------------------------------ */
/* 54309 — Timestamped annotations                                      */
/* ------------------------------------------------------------------ */

/**
 * Attaches a note to a specific timeline event.
 * @param {string} eventId — timeline event row id
 * @param {string} noteText
 * @param {{author?:string, now?:string, sequence?:number}} opts
 * @returns {{id, eventId, text, author, createdAt}}
 */
export function annotateTimelineEvent(eventId, noteText, opts = {}) {
  if (!eventId) throw new Error('eventId is required');
  if (!noteText || !String(noteText).trim()) throw new Error('noteText is required');
  const now = opts.now || new Date().toISOString();
  const seq = opts.sequence == null ? 1 : opts.sequence;
  return {
    id: `annotation:${eventId}:${seq}`,
    eventId,
    text: String(noteText).trim(),
    author: opts.author || 'analyst',
    createdAt: now,
  };
}

export function annotationsForEvent(annotations, eventId) {
  return (Array.isArray(annotations) ? annotations : []).filter((a) => a.eventId === eventId);
}

/* ------------------------------------------------------------------ */
/* 54310 — Screenshot attachments                                      */
/* ------------------------------------------------------------------ */

export const MAX_SCREENSHOT_DATAURL_BYTES = 5 * 1024 * 1024; // 5 MB guard

/**
 * Embeds a screenshot (data URL) inside a note, with a size guard.
 * @param {object} note
 * @param {{dataUrl:string, caption?:string, annotated?:boolean}} shot
 * @returns new note with the attachment appended
 */
export function attachScreenshot(note, { dataUrl, caption = '', annotated = false }) {
  if (!note) throw new Error('note is required');
  if (!dataUrl || typeof dataUrl !== 'string') throw new Error('dataUrl is required');
  if (!dataUrl.startsWith('data:image/')) throw new Error('dataUrl must be an image data URL');
  const bytes = dataUrl.length;
  if (bytes > MAX_SCREENSHOT_DATAURL_BYTES) {
    throw new Error(
      `screenshot too large: ${bytes} bytes exceeds ${MAX_SCREENSHOT_DATAURL_BYTES} bytes`
    );
  }
  const attachments = Array.isArray(note.attachments) ? note.attachments : [];
  const attachment = {
    id: `shot:${note.id || 'note'}:${attachments.length + 1}`,
    dataUrl,
    caption: String(caption),
    annotated: Boolean(annotated),
    sizeBytes: bytes,
    addedAt: new Date().toISOString(),
  };
  return { ...note, attachments: [...attachments, attachment] };
}

export function removeScreenshot(note, attachmentId) {
  if (!note) return note;
  const attachments = (Array.isArray(note.attachments) ? note.attachments : []).filter(
    (a) => a.id !== attachmentId
  );
  return { ...note, attachments };
}

export function screenshotCount(note) {
  return Array.isArray(note && note.attachments) ? note.attachments.length : 0;
}
