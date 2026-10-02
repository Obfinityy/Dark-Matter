/**
 * Infinity Modes service — the backend brains behind Infinity AI's four modes.
 *
 *   Chat     → the existing /infinite/chat path (long-context engine), untouched.
 *   Plan     → planInstruction(): NL idea → numbered step-by-step plan with
 *              tools/apps needed. Deterministic template planner keyed on task
 *              type; when the local brain is reachable it refines the wording.
 *              NEVER executes anything.
 *   Build    → agentWorkspace + buildProject(): the agent reads/writes REAL
 *              files, but ONLY inside a sandboxed workspace directory
 *              (backend/data/agent-workspace/). Path traversal is refused.
 *              buildProject("portfolio page") creates index.html + styles.css
 *              + app.js for real, provable by test.
 *   Control  → decomposeInstruction(): NL desktop command → ordered GUI action
 *              plan (each step later validated by actionSchema.js and executed
 *              by the computer adapter — mock in headless environments, the
 *              real Open-Interface bridge on the user's machine).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolveApplication } from '../computer/applicationResolver.js';
import { validateComputerAction } from '../computer/actionSchema.js';
import { MockComputerAdapter } from '../computer/mockComputerAdapter.js';
import { MockToolRunner } from './mockToolRunner.js';
import { ToolRegistry } from '../tools/registry.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Default sandbox root — created on demand, never committed. */
export function defaultWorkspaceRoot() {
  return path.resolve(HERE, '../../data/agent-workspace');
}

// ── Plan mode ────────────────────────────────────────────────────────────

const TASK_TYPES = [
  {
    id: 'web_build',
    match: /(website|web app|webapp|web page|webpage|portfolio|landing page|dashboard|site|frontend)/i,
    label: 'Web project'
  },
  {
    id: 'script',
    match: /(script|automation|bot|crawler|scraper|cli tool|command line)/i,
    label: 'Script / automation'
  },
  {
    id: 'document',
    match: /(document|report|resume|cv|letter|application|essay|write-up)/i,
    label: 'Document'
  },
  {
    id: 'research',
    match: /(research|learn|study|understand|compare|analysis)/i,
    label: 'Research'
  }
];

const PLAN_TEMPLATES = {
  web_build: [
    { title: 'Define the scope and pages', detail: 'Write down exactly what the site must do: pages, sections, and the one action each page exists for. Cut everything that is not essential for version one.', tools: ['Notes app', 'Pen & paper'] },
    { title: 'Sketch the layout', detail: 'Rough wireframes for desktop and mobile — header, hero, content blocks, footer. Decide the visual style (colors, fonts) before writing code.', tools: ['Figma', 'Excalidraw'] },
    { title: 'Set up the project', detail: 'Create the folder, index.html, styles.css and app.js. Add a CSS reset, responsive meta viewport, and a mobile-first layout grid.', tools: ['VS Code', 'Browser devtools'] },
    { title: 'Build the static structure', detail: 'Write semantic HTML for every section with real copy (no lorem ipsum). Keep accessibility in mind: headings, alt text, labels.', tools: ['VS Code'] },
    { title: 'Style it', detail: 'Implement the design system in CSS: variables for colors/spacing, responsive breakpoints, hover and focus states, smooth animations.', tools: ['CSS', 'Browser devtools'] },
    { title: 'Add interactivity', detail: 'Progressive enhancement in app.js — only the interactions the plan calls for. No framework until the vanilla version hurts.', tools: ['JavaScript'] },
    { title: 'Test on real devices', detail: 'Check desktop and a 390px phone viewport, keyboard navigation, and load time. Fix layout breaks before adding features.', tools: ['Browser devtools', 'Phone'] },
    { title: 'Deploy', detail: 'Ship a static build to hosting with a custom domain and HTTPS. Verify the live URL on mobile data, not just Wi-Fi.', tools: ['Vercel', 'Netlify', 'GitHub Pages'] }
  ],
  script: [
    { title: 'Pin down the exact input and output', detail: 'Write one sentence: given X, the script produces Y. List edge cases (empty input, network failure, bad format) up front.', tools: ['Notes app'] },
    { title: 'Pick the language and libraries', detail: 'Choose the smallest stack that covers the job — standard library first, one dependency only if it saves real complexity.', tools: ['Python', 'Node.js'] },
    { title: 'Draft the algorithm in pseudocode', detail: 'Five to ten lines of plain-language steps. If you cannot explain it simply, the design is not ready.', tools: ['Notes app'] },
    { title: 'Implement the happy path', detail: 'Write the minimal working version end to end. Hard-code nothing that the input should provide.', tools: ['VS Code', 'Terminal'] },
    { title: 'Handle failures loudly', detail: 'Every external call gets a timeout, a retry policy, and a clear error message. Never fail silently.', tools: ['Terminal'] },
    { title: 'Test with real data', detail: 'Run against a small real sample, then an ugly edge-case sample. Automate the checks you ran by hand.', tools: ['Terminal'] }
  ],
  document: [
    { title: 'Gather the raw facts', detail: 'Collect every date, name, number and reference the document needs before writing a single sentence.', tools: ['Notes app'] },
    { title: 'Outline the structure', detail: 'Headings first: what each section must convey. A reader should get the gist from headings alone.', tools: ['Word', 'Google Docs'] },
    { title: 'Write the first draft fast', detail: 'Get the full content down without editing. Clarity beats elegance at this stage.', tools: ['Word', 'Google Docs'] },
    { title: 'Revise for the reader', detail: 'Cut 20 percent. Short sentences, one idea per paragraph, headings that carry meaning.', tools: ['Word'] },
    { title: 'Proof and format', detail: 'Spell-check, consistent formatting, page numbers and a clean export to PDF.', tools: ['Word', 'PDF export'] }
  ],
  research: [
    { title: 'Frame the question', detail: 'Write the exact question you need answered and what a good answer looks like.', tools: ['Notes app'] },
    { title: 'Collect sources', detail: 'Gather primary sources first — docs, papers, official references — then opinions.', tools: ['Browser', 'Search'] },
    { title: 'Compare and contrast', detail: 'Build a comparison table: options, strengths, weaknesses, costs.', tools: ['Spreadsheet'] },
    { title: 'Decide and document', detail: 'State the recommendation, the reasoning, and what would change your mind.', tools: ['Notes app'] }
  ],
  generic: [
    { title: 'Define done', detail: 'Write one paragraph describing what "finished" looks like. If you cannot describe it, you cannot plan it.', tools: ['Notes app'] },
    { title: 'Break it into milestones', detail: 'Split the work into 3–5 milestones, each independently verifiable.', tools: ['Notes app'] },
    { title: 'Order by risk', detail: 'Do the riskiest, most uncertain part first — fail fast while it is cheap.', tools: [] },
    { title: 'Execute milestone one', detail: 'Take the first concrete action today, not tomorrow.', tools: [] },
    { title: 'Review and adjust', detail: 'After each milestone, check against the definition of done and replan the rest.', tools: [] }
  ]
};

function classifyTask(instruction) {
  const text = String(instruction || '');
  for (const t of TASK_TYPES) {
    if (t.match.test(text)) return t;
  }
  return { id: 'generic', label: 'Project' };
}

/**
 * Build a numbered step-by-step plan for an instruction. Pure and
 * deterministic — the same instruction always yields the same plan shape,
 * which is what makes it unit-testable. When a brain model is supplied and
 * reachable, it may refine step wording; refinement never changes the shape
 * and its failure never breaks planning.
 */
export async function planInstruction(instruction, { brainModel = null } = {}) {
  const clean = String(instruction || '').trim();
  if (!clean) throw new Error('instruction is required');

  const taskType = classifyTask(clean);
  const template = PLAN_TEMPLATES[taskType.id] || PLAN_TEMPLATES.generic;

  let steps = template.map((s, i) => ({
    n: i + 1,
    title: s.title,
    detail: s.detail,
    tools: [...s.tools]
  }));

  let refinedByBrain = false;
  if (brainModel && typeof brainModel.complete === 'function') {
    try {
      const res = await brainModel.complete([
        {
          role: 'system',
          content: 'You are a planning assistant. The user will receive a numbered plan. Reply with the same steps, slightly reworded to fit their specific request, keeping the same count and order. Format: one line per step as "N. Title — detail (Tools: a, b)".'
        },
        { role: 'user', content: `Request: ${clean}\n\nSteps:\n${steps.map((s) => `${s.n}. ${s.title} — ${s.detail}`).join('\n')}` }
      ], { maxTokens: 1200 });
      const text = String(res?.text || '').trim();
      if (text) {
        const parsed = parseNumberedPlan(text, steps.length);
        if (parsed) {
          steps = parsed;
          refinedByBrain = true;
        }
      }
    } catch {
      /* brain refinement is a bonus — the template plan stands on its own */
    }
  }

  return {
    task: clean,
    taskType: taskType.label,
    steps,
    refinedByBrain,
    executed: false,
    note: 'Planning only — nothing was executed. Switch to Build to make it real.'
  };
}

function parseNumberedPlan(text, expectedCount) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const m = line.match(/^(\d+)[.)]\s*(.+)$/);
    if (!m) continue;
    const n = Number(m[1]);
    if (n !== out.length + 1) continue;
    const rest = m[2];
    const toolMatch = rest.match(/\(tools?\s*:\s*([^)]+)\)\s*$/i);
    const tools = toolMatch ? toolMatch[1].split(/[,;]/).map((t) => t.trim()).filter(Boolean) : [];
    const withoutTools = toolMatch ? rest.slice(0, toolMatch.index).trim() : rest;
    const dash = withoutTools.indexOf('—') >= 0 ? withoutTools.indexOf('—') : withoutTools.indexOf('-');
    const title = dash > 0 ? withoutTools.slice(0, dash).trim() : withoutTools;
    const detail = dash > 0 ? withoutTools.slice(dash + 1).trim() : '';
    out.push({ n, title: title || `Step ${n}`, detail, tools });
    if (out.length === expectedCount) break;
  }
  return out.length === expectedCount ? out : null;
}

// ── Build mode: sandboxed workspace ──────────────────────────────────────

// ── Build mode: sandboxed workspace ──────────────────────────────────────
// Brain-driven builder: when the user's ACTIVE brain is reachable, it writes
// real project files from the brief (+ attached file context). The template
// portfolio below is only the fallback when no brain is available.

/**
 * Parse the brain's file-manifest reply into [{path, content}].
 * Accepts a raw JSON array, possibly wrapped in markdown fences or with
 * leading/trailing prose. Returns null when nothing usable is found.
 */
export function parseFileManifest(text) {
  const raw = String(text || '');
  if (!raw.trim()) return null;
  // Strip markdown fences if the brain wrapped the JSON in them.
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenceMatch ? fenceMatch[1] : raw).trim();
  const start = candidate.indexOf('[');
  const end = candidate.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  let parsed;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || !parsed.length) return null;
  const files = [];
  for (const entry of parsed.slice(0, 12)) {
    const relPath = String(entry?.path || '').replace(/\\/g, '/').trim();
    const content = String(entry?.content ?? '');
    if (!relPath || relPath.startsWith('/') || relPath.includes('..')) continue;
    if (!content.trim()) continue;
    files.push({ path: relPath, content: content.slice(0, 60_000) });
  }
  return files.length ? files : null;
}

const BUILD_SYSTEM_PROMPT = `You are an expert software builder. The user describes what to build.
Reply with ONLY a JSON array of files — no prose, no markdown fences:
[{"path": "index.html", "content": "<complete file content>"}, ...]
Rules:
- 2 to 8 files. Paths are relative (e.g. "index.html", "src/app.js"). No absolute paths, no "..".
- Every file must be COMPLETE and working — real code, no placeholders, no TODOs, no lorem ipsum.
- Web projects: an index.html at the root that loads the other files.
- Keep each file under ~15000 characters.
- If attached file context is provided, extend or improve that code rather than ignoring it.`;

/**
 * Ask the active brain to generate a whole project from the brief.
 * Returns [{path, content}] or throws when the brain can't produce one.
 */
export async function generateProjectWithBrain(brief, { brainModel, attachments = [], userId = null } = {}) {
  if (!brainModel || typeof brainModel.complete !== 'function') {
    throw new Error('No brain model available');
  }
  const contextParts = [];
  for (const att of (attachments || []).slice(0, 8)) {
    const body = String(att?.content || '').slice(0, 8000);
    if (!body.trim()) continue;
    contextParts.push(`--- Attached file: ${att.name || att.path} ---\n${body}`);
  }
  const userContent = `Build this:\n${brief}\n\n${contextParts.join('\n\n')}`.trim();
  const res = await brainModel.complete(
    [
      { role: 'system', content: BUILD_SYSTEM_PROMPT },
      { role: 'user', content: userContent }
    ],
    // userId is how the brain adapter resolves the user's ACTIVE brain
    // (Kaggle/Colab/local) — without it, every build would use the default.
    { maxTokens: 6000, temperature: 0.3, userId }
  );
  const files = parseFileManifest(res?.text);
  if (!files) throw new Error('The brain did not return a usable file manifest.');
  return files;
}

export function createWorkspace(root = defaultWorkspaceRoot()) {
  const ROOT = path.resolve(root);

  function safePath(...segments) {
    const joined = segments.map((s) => String(s || '')).join('/');
    const resolved = path.resolve(ROOT, joined);
    const relative = path.relative(ROOT, resolved);
    if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
      return resolved;
    }
    throw Object.assign(new Error(`Refused: path escapes the agent workspace: ${joined}`), { code: 'PATH_TRAVERSAL' });
  }

  function ensureRoot() {
    fs.mkdirSync(ROOT, { recursive: true });
    return ROOT;
  }

  function listFiles(subdir = '') {
    ensureRoot();
    const dir = safePath(subdir);
    if (!fs.existsSync(dir)) return [];
    const out = [];
    const walk = (current, prefix) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(path.join(current, entry.name), rel);
        else if (entry.isFile()) {
          const stat = fs.statSync(path.join(current, entry.name));
          out.push({ path: rel, size: stat.size });
        }
      }
    };
    walk(dir, subdir ? String(subdir) : '');
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  function readFile(relPath, { maxChars = 200_000 } = {}) {
    const full = safePath(relPath);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      throw Object.assign(new Error(`File not found in workspace: ${relPath}`), { code: 'ENOENT' });
    }
    const content = fs.readFileSync(full, 'utf8');
    return content.length > maxChars ? content.slice(0, maxChars) : content;
  }

  function writeFile(relPath, content) {
    const full = safePath(relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, String(content ?? ''), 'utf8');
    return { path: path.relative(ROOT, full), size: Buffer.byteLength(String(content ?? ''), 'utf8') };
  }

  return { root: ROOT, safePath, ensureRoot, listFiles, readFile, writeFile };
}

function extractName(brief) {
  const text = String(brief || '');
  const patterns = [
    /(?:for|about|named|called)\s+([A-Z][A-Za-z'.-]*(?:\s+[A-Z][A-Za-z'.-]*){0,3})/,
    /\bmy name is\s+([A-Z][A-Za-z'.-]*(?:\s+[A-Z][A-Za-z'.-]*){0,2})/i,
    /\bi am\s+([A-Z][A-Za-z'.-]*(?:\s+[A-Z][A-Za-z'.-]*){0,2})/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return 'Alex Carter';
}

function slugify(text) {
  return String(text || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'project';
}

/**
 * Build a real project from a brief, inside the sandbox. Currently generates
 * a polished portfolio site (index.html + styles.css + app.js). Returns the
 * file list — the caller (and the tests) can read every file back.
 */
export async function buildProject(brief, { conversationId = null, workspace = null, brainModel = null, attachments = [], userId = null } = {}) {
  const clean = String(brief || '').trim();
  if (!clean) throw new Error('brief is required');

  const ws = workspace || createWorkspace();
  ws.ensureRoot();

  const name = extractName(clean);
  const projectDir = `build-${slugify(clean.slice(0, 24))}-${(conversationId || crypto.randomUUID()).toString().slice(0, 8)}`;

  // ── Brain-first: the active brain writes real project files from the brief.
  // Attached files (uploaded via BuildPane) ride along as context.
  if (brainModel && typeof brainModel.complete === 'function') {
    try {
      const manifest = await generateProjectWithBrain(clean, { brainModel, attachments, userId });
      const files = manifest.map((f) => ws.writeFile(`${projectDir}/${f.path}`, f.content));
      return {
        brief: clean,
        projectDir,
        files,
        brainBuilt: true,
        note: `Built by your active brain from the brief${attachments?.length ? ` (+${attachments.length} attached file${attachments.length > 1 ? 's' : ''})` : ''}. Open index.html in a browser to view it.`
      };
    } catch (err) {
      // Brain failed or unreachable — fall through to the template builder.
    }
  }

  // ── Template fallback (no brain available): portfolio starter.

  const tagline = 'I design and build software that ships.';
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name} — Portfolio</title>
  <meta name="description" content="Portfolio of ${name}: projects, skills, and contact." />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="site-header">
    <nav class="nav">
      <a class="brand" href="#">${name}</a>
      <div class="nav-links">
        <a href="#work">Work</a>
        <a href="#about">About</a>
        <a href="#contact">Contact</a>
      </div>
    </nav>
    <div class="hero">
      <p class="eyebrow">Portfolio</p>
      <h1>${name}</h1>
      <p class="tagline">${tagline}</p>
      <a class="cta" href="#work">See my work</a>
    </div>
  </header>

  <main>
    <section id="work" class="section">
      <h2>Selected work</h2>
      <div class="cards" id="project-cards"><!-- rendered by app.js --></div>
    </section>

    <section id="about" class="section">
      <h2>About</h2>
      <p>
        I'm ${name}. I turn ideas into working software — from first sketch to
        deployed product. This page was generated by an autonomous agent from a
        one-line brief.
      </p>
      <ul class="skills" id="skill-list"><!-- rendered by app.js --></ul>
    </section>

    <section id="contact" class="section">
      <h2>Contact</h2>
      <p>Have something worth building? Let's talk.</p>
      <form id="contact-form">
        <input type="text" name="name" placeholder="Your name" required />
        <input type="email" name="email" placeholder="Email" required />
        <textarea name="message" placeholder="What should we build?" rows="4" required></textarea>
        <button type="submit">Send message</button>
      </form>
      <p class="form-note" id="form-note" hidden>Thanks — this demo form does not send anywhere yet.</p>
    </section>
  </main>

  <footer class="site-footer">
    <p>© ${new Date().getFullYear()} ${name} · Built by Infinity AI</p>
  </footer>

  <script src="app.js"></script>
</body>
</html>
`;

  const stylesCss = `:root {
  --bg: #0a0e14;
  --panel: #111722;
  --text: #e8eef7;
  --muted: #93a1b8;
  --accent: #7c8cf8;
  --accent-2: #39d0d8;
  --radius: 14px;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background: radial-gradient(1200px 600px at 80% -10%, rgba(124,140,248,.16), transparent), var(--bg);
  color: var(--text);
  line-height: 1.6;
}
.site-header { padding: 28px clamp(20px, 6vw, 72px) 64px; }
.nav { display: flex; justify-content: space-between; align-items: center; }
.brand { font-weight: 800; letter-spacing: -0.02em; color: var(--text); text-decoration: none; font-size: 1.15rem; }
.nav-links { display: flex; gap: 22px; }
.nav-links a { color: var(--muted); text-decoration: none; font-size: .95rem; }
.nav-links a:hover { color: var(--text); }
.hero { max-width: 720px; margin-top: 72px; }
.eyebrow { text-transform: uppercase; letter-spacing: .18em; font-size: .75rem; color: var(--accent-2); margin: 0 0 12px; }
.hero h1 { font-size: clamp(2.6rem, 7vw, 4.6rem); letter-spacing: -0.03em; margin: 0 0 12px; line-height: 1.05; }
.tagline { color: var(--muted); font-size: 1.2rem; margin: 0 0 28px; }
.cta {
  display: inline-block; padding: 12px 26px; border-radius: 999px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #06080d; font-weight: 700; text-decoration: none;
}
.section { padding: 48px clamp(20px, 6vw, 72px); max-width: 1100px; margin: 0 auto; }
.section h2 { font-size: 1.7rem; letter-spacing: -0.02em; margin: 0 0 24px; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; }
.card { background: var(--panel); border: 1px solid rgba(255,255,255,.07); border-radius: var(--radius); padding: 22px; }
.card h3 { margin: 0 0 8px; font-size: 1.1rem; }
.card p { color: var(--muted); font-size: .94rem; margin: 0 0 12px; }
.card .tags { display: flex; gap: 8px; flex-wrap: wrap; }
.card .tags span { font-size: .72rem; padding: 3px 10px; border-radius: 999px; background: rgba(124,140,248,.14); color: var(--accent); }
.skills { display: flex; gap: 10px; flex-wrap: wrap; list-style: none; padding: 0; }
.skills li { padding: 8px 16px; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); font-size: .88rem; color: var(--muted); }
#contact-form { display: grid; gap: 12px; max-width: 520px; }
#contact-form input, #contact-form textarea {
  background: var(--panel); border: 1px solid rgba(255,255,255,.1); border-radius: 10px;
  padding: 12px 14px; color: var(--text); font: inherit;
}
#contact-form button {
  justify-self: start; padding: 12px 28px; border: none; border-radius: 999px; cursor: pointer;
  background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #06080d; font-weight: 700;
}
.site-footer { text-align: center; color: var(--muted); padding: 40px 20px; font-size: .85rem; }
@media (max-width: 600px) { .nav-links { display: none; } }
`;

  const appJs = `// Portfolio interactivity — rendered content + demo contact form.
const PROJECTS = [
  { title: "Autonomous hunter", blurb: "An AI agent that finds and documents real vulnerabilities, end to end.", tags: ["AI", "Security"] },
  { title: "Realtime dashboard", blurb: "Live operations view streaming thousands of events per second.", tags: ["Web", "Realtime"] },
  { title: "Design system", blurb: "A component library with a cinematic dark aesthetic.", tags: ["Design", "CSS"] }
];
const SKILLS = ["JavaScript", "Python", "Security research", "UI design", "Automation"];

function renderProjects() {
  const host = document.getElementById("project-cards");
  if (!host) return;
  host.innerHTML = PROJECTS.map((p) => (
    "<article class='card'><h3>" + p.title + "</h3><p>" + p.blurb + "</p>" +
    "<div class='tags'>" + p.tags.map((t) => "<span>" + t + "</span>").join("") + "</div></article>"
  )).join("");
}

function renderSkills() {
  const host = document.getElementById("skill-list");
  if (!host) return;
  host.innerHTML = SKILLS.map((s) => "<li>" + s + "</li>").join("");
}

document.addEventListener("DOMContentLoaded", () => {
  renderProjects();
  renderSkills();
  const form = document.getElementById("contact-form");
  const note = document.getElementById("form-note");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (note) note.hidden = false;
      form.reset();
    });
  }
});
`;

  const files = [
    ws.writeFile(`${projectDir}/index.html`, indexHtml),
    ws.writeFile(`${projectDir}/styles.css`, stylesCss),
    ws.writeFile(`${projectDir}/app.js`, appJs)
  ];

  return {
    brief: clean,
    projectDir,
    files,
    note: 'Built inside the sandboxed agent workspace. Open index.html in a browser to view it.'
  };
}

// ── Control mode: NL → GUI action plan ────────────────────────────────────
// NOTE: there is deliberately NO canned content here. Document text (leave
// applications, letters, …) is composed by the user's ACTIVE brain inside the
// computer-task agent loop — never from a template. Hardcoded letters were
// removed: the brain reasons, opens the app, observes, and types what IT
// wrote, one verified step at a time.

/**
 * Decompose a natural-language desktop instruction into an ordered plan of
 * GUI actions. This is the planning layer: every returned step is a plain
 * {type, params, reason} object that MUST still pass validateComputerAction()
 * before any adapter is allowed to execute it.
 *
 * Returns { ok, application, steps } or { ok: false, reason } when the
 * instruction names nothing the planner can act on.
 */
export function decomposeInstruction(instruction) {
  const text = String(instruction || '').trim();
  if (!text) return { ok: false, reason: 'Empty instruction — nothing to do.' };

  const app = resolveApplication(text);
  const gui = (type, params, reason) => ({ kind: 'gui', type, params, reason });

  // NOTE: no canned document flows. Anything beyond "open/focus this app" is
  // handled by the computer-task agent loop, where the user's ACTIVE brain
  // reasons step-by-step (open → observe → act → verify). Template letters
  // were removed — the brain composes content itself.

  // ── Generic application launch/focus ("open calculator", "notepad kholo", "focus Word") ──
  if (app && /\b(open|launch|start|focus|switch|bring|kholo|khol)\b/i.test(text)) {
    return {
      ok: true,
      kind: 'open_app',
      application: app.canonical,
      launch: app.launch,
      steps: [
        gui('open_application', { name: app.launch }, `Open ${app.canonical} (launches it, or focuses it if already open)`),
        gui('sleep', { seconds: 1 }, `Wait for ${app.canonical} to appear`),
        gui('get_active_window', {}, `Verify ${app.canonical} is the active window`)
      ]
    };
  }

  return {
    ok: false,
    reason: `I could not turn "${text.slice(0, 80)}" into GUI steps. Name an application I know (for example "open Word", "calculator kholo") or describe a document to write in Word.`
  };
}

/**
 * Validate every step of a decomposed plan. Never executes.
 * Dispatches on step kind: gui → closed computer-action schema,
 * file → sandbox file rules, tool → tool-registry schema.
 */
export function validatePlanSteps(steps, context = {}) {
  return steps.map((step, index) => {
    const kind = step.kind || 'gui';
    let result;
    if (kind === 'file') result = validateFileStep(step);
    else if (kind === 'tool') result = validateToolStep(step);
    else result = validateComputerAction({ type: step.type, params: step.params || {} }, context);
    return {
      index,
      kind,
      type: step.type || null,
      op: step.op || null,
      tool: step.tool || null,
      params: step.params || {},
      path: step.path || null,
      code: step.code || null,
      content: step.content || null,
      reason: step.reason || '',
      valid: result.valid,
      errors: result.errors,
      normalized: result.valid ? (result.action || result.step || result.tool || null) : null
    };
  });
}

/**
 * Full Control pipeline: NL → plan → schema validation → adapter execution.
 *
 * @param {object} opts.adapter  computer adapter (real or MockComputerAdapter).
 *   When omitted, a MockComputerAdapter is used and the run is marked simulated.
 */
export async function runControlPlan(instruction, { adapter = null, scopeEngine = null, dryRun = false } = {}) {
  const started = Date.now();
  const decomposed = decomposeInstruction(instruction);
  if (!decomposed.ok) {
    return { ok: false, reason: decomposed.reason, instruction, steps: [], executed: [], simulated: true, durationMs: Date.now() - started };
  }

  const validated = validatePlanSteps(decomposed.steps, { scopeEngine });
  const invalid = validated.filter((s) => !s.valid);
  if (invalid.length) {
    return {
      ok: false,
      reason: `Plan rejected by the action schema: ${invalid.map((s) => `step ${s.index + 1} (${s.type}): ${s.errors.join('; ')}`).join(' | ')}`,
      instruction,
      application: decomposed.application,
      steps: validated,
      executed: [],
      simulated: true,
      durationMs: Date.now() - started
    };
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      instruction,
      kind: decomposed.kind,
      application: decomposed.application,
      steps: validated,
      executed: [],
      simulated: true,
      durationMs: Date.now() - started
    };
  }

  const usedAdapter = adapter || new MockComputerAdapter();
  const simulated = Boolean(usedAdapter.isMock);
  const executed = [];

  for (const step of validated) {
    let result;
    try {
      result = await usedAdapter.execute(
        { type: step.type, params: step.params, reason: step.reason },
        { scopeEngine }
      );
    } catch (err) {
      result = { ok: false, error: { message: err?.message || 'adapter threw', kind: 'error' } };
    }
    executed.push({
      type: step.type,
      params: step.params,
      reason: step.reason,
      ok: result.ok === true,
      observation: result.observation?.summary || null,
      error: result.error?.message || null
    });
    if (!result.ok) break; // stop at the first failure — never push past an error
  }

  const allOk = executed.length === validated.length && executed.every((e) => e.ok);
  return {
    ok: allOk,
    instruction,
    kind: decomposed.kind,
    application: decomposed.application,
    steps: validated,
    executed,
    simulated,
    stoppedEarly: executed.length < validated.length,
    durationMs: Date.now() - started
  };
}

// ── Deep Control: the brain drives OS-level work end-to-end ──────────────
// A Control plan mixes three step kinds, each with its OWN schema validation:
//   gui   → closed computer-action schema  → computer adapter (real or mock)
//   file  → sandbox file rules (agent workspace ONLY) → workspace service
//   tool  → tool-registry schema (python tool) → tool runner
//
// SAFETY POSTURE (deliberate, non-negotiable):
//   • `tool` steps through /infinite/control are ALWAYS simulated — the mock
//     runner validates and logs but never executes code. Real Python runs
//     only through the hunt's authorized tool pipeline (policy validator +
//     scope engine + user authorization).
//   • `file` steps can only touch the sandboxed agent workspace; traversal is
//     refused at validation AND at execution (the workspace enforces it).
//   • `gui` steps keep the closed whitelist: still no shell, ever.

export const FILE_OPS = Object.freeze(['write_file', 'read_file', 'list_files']);

/** Static path-safety check (the workspace's safePath enforces it again at execution). */
export function assertSafeRelPath(relPath) {
  const p = String(relPath || '');
  if (!p.trim()) return { ok: false, error: 'path is empty' };
  if (path.isAbsolute(p)) return { ok: false, error: `Refused: absolute paths are not allowed in the agent workspace: ${p}` };
  const normalized = path.posix.normalize(p.replace(/\\/g, '/'));
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    return { ok: false, error: `Refused: path escapes the agent workspace: ${p}` };
  }
  return { ok: true };
}

/** Validate a sandbox file step. Never touches disk. */
export function validateFileStep(step) {
  const errors = [];
  if (!FILE_OPS.includes(step.op)) {
    errors.push(`Unknown file op "${step.op}". Allowed: ${FILE_OPS.join(', ')}`);
  }
  if (step.op === 'write_file' || step.op === 'read_file') {
    if (typeof step.path !== 'string' || !step.path.trim()) {
      errors.push(`${step.op} requires a path`);
    } else {
      const safe = assertSafeRelPath(step.path);
      if (!safe.ok) errors.push(safe.error);
    }
  }
  if (step.op === 'write_file') {
    if (typeof step.content !== 'string' || !step.content) errors.push('write_file requires non-empty content');
    else if (step.content.length > 200_000) errors.push('write_file content exceeds 200000 characters');
  }
  return {
    valid: errors.length === 0,
    errors,
    step: errors.length ? null : { kind: 'file', op: step.op, path: step.path, content: step.content }
  };
}

/** Validate a tool step against the real tool registry schema. Never executes. */
export function validateToolStep(step) {
  const errors = [];
  const tool = ToolRegistry.get(step.tool);
  if (!tool) {
    const names = ToolRegistry.list().map((t) => t.name).slice(0, 10).join(', ');
    errors.push(`Unknown tool "${step.tool}". Registered tools include: ${names}…`);
  }
  if (step.tool === 'python') {
    if (typeof step.code !== 'string' || !step.code.trim()) errors.push('python tool step requires code');
    else if (step.code.length > 20000) errors.push('python code exceeds 20000 characters');
  }
  return {
    valid: errors.length === 0,
    errors,
    tool: tool ? { name: tool.name, riskLevel: tool.riskLevel, requiresAuthorization: tool.requiresAuthorization } : null
  };
}

function extractClipboardText(text) {
  let m = text.match(/["“”']([^"“”']{1,4000})["“”']\s*(?:to|into)\s+(?:the\s+)?clipboard/i);
  if (m) return m[1];
  m = text.match(/\bcopy\b\s+(.+?)\s+to\s+(?:the\s+)?clipboard\b/i);
  if (m) return m[1].trim().replace(/^["“”']|["“”']$/g, '');
  return null;
}

function extractFileWrite(text) {
  let m = text.match(/\b(?:write|save)\b\s*["“”']([\s\S]{1,20000}?)["“”']\s*\bto\b\s*([^\s"“”']{1,120})/i);
  if (m) return { content: m[1], path: m[2] };
  m = text.match(/\b(?:write|save)\b\s*(?:file\s+)?([^\s"“”']{1,120})\s*\bwith\b\s*["“”']([\s\S]{1,20000}?)["“”']/i);
  if (m) return { path: m[1], content: m[2] };
  return null;
}

function extractFileRead(text) {
  let m = text.match(/\bread\b\s+file\s+([^\s"“”']{1,120})/i);
  if (m) return m[1];
  m = text.match(/\bread\b\s+([^\s"“”']{1,120}\.[A-Za-z0-9]{1,8})/i);
  if (m && /\bworkspace\b/i.test(text)) return m[1];
  return null;
}

function extractPythonCode(text) {
  const m = text.match(/\bpython\b\s*[:\-]?\s*([\s\S]{1,10000})/i);
  const code = m ? m[1].trim().replace(/^["“”']|["“”']$/g, '') : '';
  return code || null;
}

/**
 * Deep decomposition: NL → mixed-kind step plan (gui / file / tool).
 * Falls back to the GUI decomposer for pure desktop instructions.
 */
export function decomposeControlRequest(instruction) {
  const text = String(instruction || '').trim();
  if (!text) return { ok: false, reason: 'Empty instruction — nothing to do.' };

  // 1. Terminal via the python tool — "run python: print(2+2)"
  if (/\bpython\b/i.test(text) && /\b(run|execute|eval)\b/i.test(text)) {
    const code = extractPythonCode(text);
    if (code) {
      return {
        ok: true,
        kind: 'tool_run',
        application: null,
        steps: [{ kind: 'tool', tool: 'python', code, reason: 'Run the Python snippet via the python tool (simulated through this endpoint)' }]
      };
    }
  }

  // 2. Sandbox file operations
  const write = extractFileWrite(text);
  if (write) {
    return {
      ok: true,
      kind: 'file_write',
      application: null,
      steps: [{ kind: 'file', op: 'write_file', path: write.path, content: write.content, reason: `Write ${write.path} inside the sandboxed agent workspace` }]
    };
  }
  const read = extractFileRead(text);
  if (read) {
    return {
      ok: true,
      kind: 'file_read',
      application: null,
      steps: [{ kind: 'file', op: 'read_file', path: read, reason: `Read ${read} from the sandboxed agent workspace` }]
    };
  }
  if (/\blist\b.{0,24}\bfiles\b/i.test(text) && /\bworkspace\b/i.test(text)) {
    return {
      ok: true,
      kind: 'file_list',
      application: null,
      steps: [{ kind: 'file', op: 'list_files', reason: 'List files in the sandboxed agent workspace' }]
    };
  }

  // 3. Clipboard — 'copy "hello" to clipboard'
  const clip = extractClipboardText(text);
  if (clip) {
    return {
      ok: true,
      kind: 'clipboard',
      application: null,
      steps: [{ kind: 'gui', type: 'clipboard_set', params: { text: clip }, reason: 'Copy the text to the OS clipboard' }]
    };
  }

  // 4. Pure desktop instructions → the GUI decomposer (Word docs, app launch/focus).
  const guiPlan = decomposeInstruction(text);
  if (guiPlan.ok) return guiPlan;

  return {
    ok: false,
    reason: `I could not turn "${text.slice(0, 80)}" into steps. Try: "open Word", "focus calculator", 'copy "hello" to clipboard', 'write "notes" to notes.txt', "read file notes.txt", "list workspace files", or "run python: print(2+2)". For full desktop control, use the Control tab's agent mode.`
  };
}

async function executeFileStep(step, fileSystem) {
  const started = Date.now();
  try {
    if (step.op === 'write_file') {
      const written = fileSystem.writeFile(step.path, step.content);
      return { ok: true, observation: `Wrote ${written.path} (${written.size} bytes) into the sandboxed agent workspace`, durationMs: Date.now() - started, sandboxed: true };
    }
    if (step.op === 'read_file') {
      const content = fileSystem.readFile(step.path);
      const preview = content.length > 120 ? `${content.slice(0, 120)}…` : content;
      return { ok: true, observation: `Read ${step.path} (${content.length} chars) from the sandbox: "${preview}"`, durationMs: Date.now() - started, sandboxed: true };
    }
    if (step.op === 'list_files') {
      const files = fileSystem.listFiles();
      return { ok: true, observation: files.length ? `Workspace files: ${files.map((f) => f.path).join(', ')}` : 'The agent workspace is empty', durationMs: Date.now() - started, sandboxed: true };
    }
    return { ok: false, error: { message: `unsupported file op ${step.op}`, kind: 'error' }, durationMs: Date.now() - started };
  } catch (err) {
    return { ok: false, error: { message: err.message, kind: 'error' }, durationMs: Date.now() - started };
  }
}

/**
 * Deep Control pipeline: NL → multi-kind plan → per-kind schema validation →
 * execution (computer adapter / sandbox workspace / simulated tool runner).
 *
 * Tool steps are ALWAYS simulated through this path (MockToolRunner) — real
 * code execution stays behind the hunt's authorized tool pipeline.
 */
export async function runControlDeep(instruction, { adapter = null, fileSystem = null, toolRunner = null, scopeEngine = null, dryRun = false } = {}) {
  const started = Date.now();
  const decomposed = decomposeControlRequest(instruction);
  if (!decomposed.ok) {
    return { ok: false, reason: decomposed.reason, instruction, steps: [], executed: [], simulated: true, durationMs: Date.now() - started };
  }

  const validated = validatePlanSteps(decomposed.steps, { scopeEngine });
  const invalid = validated.filter((s) => !s.valid);
  if (invalid.length) {
    const label = (s) => `step ${s.index + 1} (${s.kind}/${s.type || s.op || s.tool})`;
    return {
      ok: false,
      reason: `Plan rejected: ${invalid.map((s) => `${label(s)}: ${s.errors.join('; ')}`).join(' | ')}`,
      instruction,
      application: decomposed.application,
      steps: validated,
      executed: [],
      simulated: true,
      durationMs: Date.now() - started
    };
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      instruction,
      kind: decomposed.kind,
      application: decomposed.application,
      steps: validated,
      executed: [],
      simulated: true,
      durationMs: Date.now() - started
    };
  }

  const computer = adapter || new MockComputerAdapter();
  const files = fileSystem || createWorkspace();
  const tools = toolRunner || new MockToolRunner();
  const simulated = Boolean(computer.isMock) || validated.some((s) => s.kind === 'tool' && tools.isMock);
  const executed = [];

  for (const step of validated) {
    let result;
    try {
      if (step.kind === 'file') {
        result = await executeFileStep(step, files);
      } else if (step.kind === 'tool') {
        result = await tools.run({ tool: step.tool, code: step.code, reason: step.reason });
      } else {
        result = await computer.execute(
          { type: step.type, params: step.params, reason: step.reason },
          { scopeEngine }
        );
      }
    } catch (err) {
      result = { ok: false, error: { message: err?.message || 'executor threw', kind: 'error' } };
    }
    executed.push({
      kind: step.kind,
      type: step.type,
      op: step.op,
      tool: step.tool,
      path: step.path,
      params: step.params,
      reason: step.reason,
      ok: result.ok === true,
      observation: typeof result.observation === 'string' ? result.observation : (result.observation?.summary || null),
      error: result.error?.message || (typeof result.error === 'string' ? result.error : null),
      simulated: Boolean(result.simulated),
      sandboxed: Boolean(result.sandboxed)
    });
    if (!result.ok) break; // stop at the first failure — never push past an error
  }

  const allOk = executed.length === validated.length && executed.every((e) => e.ok);
  return {
    ok: allOk,
    instruction,
    kind: decomposed.kind,
    application: decomposed.application,
    steps: validated,
    executed,
    simulated,
    stoppedEarly: executed.length < validated.length,
    durationMs: Date.now() - started
  };
}

export function createInfinityModes({ brainModel = null, brainModelFor = null, workspaceRoot = null, logger = console } = {}) {
  const workspace = createWorkspace(workspaceRoot || defaultWorkspaceRoot());
  // brainModelFor(userId) lets Plan mode think with the user's ACTIVE brain
  // (Models → Run / Kaggle connect); falls back to the fixed brainModel.
  const brainFor = (userId) => (typeof brainModelFor === 'function' ? brainModelFor(userId) : null) || brainModel;
  return {
    workspace,
    plan: (instruction, opts = {}) => planInstruction(instruction, { brainModel: brainFor(opts?.userId) }),
    build: (brief, opts = {}) => buildProject(brief, { ...opts, workspace, brainModel: brainFor(opts?.userId) }),
    decompose: decomposeInstruction,
    decomposeDeep: decomposeControlRequest,
    validateSteps: validatePlanSteps,
    runControl: (instruction, opts = {}) => runControlDeep(instruction, { fileSystem: workspace, ...opts }),
    runControlGui: (instruction, opts = {}) => runControlPlan(instruction, opts)
  };
}
