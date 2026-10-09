/**
 * htmlReportService.js — on-demand HTML bug-bounty reports, written by the
 * hacking brain in small chunks.
 *
 * Why chunked: the hunting brain is a small (8B) model with a limited
 * context window. Asking it to write a full HTML report in one shot either
 * truncates the output or degrades quality. Instead the report is planned
 * as sections, and the brain writes ONE section per call — each call carries
 * only the data that section needs. Sections are then assembled into a
 * single professional HTML document.
 *
 * Rules:
 *  • Every factual claim comes from stored findings/evidence — the brain
 *    writes narrative around real data, never invents vulnerabilities.
 *  • Reports can be requested ANY time (mid-hunt or after) — they reflect
 *    the findings known so far.
 *  • Brain HTML fragments are sanitized before assembly (no scripts, no
 *    event handlers) — the report is safe to open and share.
 *  • Generation runs async with progress events; the caller polls status.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'informational'];
const SEVERITY_COLORS = {
  critical: '#ff4d5e',
  high: '#ff9f43',
  medium: '#ffd32a',
  low: '#2ed573',
  informational: '#70a1ff',
};

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Strip anything executable from a brain-written HTML fragment.
 * The brain is instructed to emit semantic HTML only, but defense in depth:
 * no scripts, no iframes/objects/embeds, no event-handler attributes,
 * no javascript: URLs.
 */
export function sanitizeFragment(html) {
  let out = String(html || '');
  out = out.replace(/<script[\s\S]*?<\/script\s*>/gi, '');
  out = out.replace(/<\/?(iframe|object|embed|form|input|button|select|textarea|meta|link|base)\b[^>]*>/gi, '');
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, '$1="#"');
  return out;
}

/** Sort findings critical-first for the report. */
function sortFindings(findings = []) {
  const rank = s => {
    const i = SEVERITY_ORDER.indexOf(String(s || '').toLowerCase());
    return i === -1 ? 99 : i;
  };
  return [...findings].sort((a, b) => rank(a.severity) - rank(b.severity));
}

/** Compact one-line summary of a finding for brain prompts (keeps context small). */
function findingDigest(f) {
  return [
    `Title: ${f.title || f.type || 'Untitled'}`,
    `Severity: ${f.severity || 'unknown'}`,
    `Category: ${f.category || 'uncategorized'}`,
    f.affectedAsset ? `Asset: ${f.affectedAsset}` : null,
    f.parameter ? `Parameter: ${f.parameter}` : null,
    f.description ? `Description: ${String(f.description).slice(0, 400)}` : null,
    f.reproduction ? `Reproduction: ${String(f.reproduction).slice(0, 400)}` : null,
    f.impact ? `Impact: ${String(f.impact).slice(0, 300)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

const FRAGMENT_SYSTEM = [
  'You are the report writer for Infinity AI, an autonomous bug-bounty agent.',
  'Write ONLY the HTML fragment for the requested report section.',
  'Rules: use semantic HTML only (h2, h3, p, ul, ol, li, table, tr, th, td, strong, em, code, pre, blockquote).',
  'No <html>, <head>, <body>, <script>, <style>, or <iframe> tags — just the section content.',
  'No markdown fences, no explanations outside the HTML.',
  'Base every claim on the finding data provided. Never invent vulnerabilities.',
  'Be concise and professional — this reads like a real pentest report.',
].join('\n');

/** HtmlReportService — chunked, brain-written HTML reports. */
export class HtmlReportService {
  /**
   * @param {object} [options]
   * @param {string} [options.reportDir] — where finished .html files are stored.
   * @param {object} [options.logger]
   */
  constructor({ reportDir = null, logger = console } = {}) {
    this.reportDir =
      reportDir || path.resolve(process.cwd(), 'data', 'html-reports');
    this.logger = logger || console;
    this.generations = new Map(); // id -> { status, progress, ... }
  }

  /**
   * Start an async HTML report generation.
   * @param {object} args — { jobId, userId, target, findings, brain, huntContext }
   * @returns {string} generationId — poll getStatus(), then getHtml().
   */
  startGeneration({ jobId, userId, target, findings = [], brain = null, huntContext = {} }) {
    const id = `htmlrep_${crypto.randomBytes(8).toString('hex')}`;
    const sorted = sortFindings(findings);
    const gen = {
      id,
      jobId,
      userId,
      target,
      status: 'generating',
      progress: { done: 0, total: 0, currentSection: 'planning' },
      startedAt: new Date().toISOString(),
      finishedAt: null,
      filePath: null,
      error: null,
    };
    this.generations.set(id, gen);
    // Fire and forget — progress is observable via getStatus().
    this._runGeneration(gen, { findings: sorted, brain, huntContext }).catch(err => {
      gen.status = 'failed';
      gen.error = err?.message || String(err);
      gen.finishedAt = new Date().toISOString();
      this.logger.error?.(`[html-report] generation ${id} failed: ${gen.error}`);
    });
    return id;
  }

  getStatus(generationId) {
    const gen = this.generations.get(generationId);
    if (!gen) return { status: 'not_found' };
    return {
      id: gen.id,
      status: gen.status,
      progress: gen.progress,
      startedAt: gen.startedAt,
      finishedAt: gen.finishedAt,
      ...(gen.error ? { error: gen.error } : {}),
    };
  }

  async getHtml(generationId) {
    const gen = this.generations.get(generationId);
    if (!gen || gen.status !== 'done' || !gen.filePath) return null;
    return fs.readFile(gen.filePath, 'utf8');
  }

  // ── generation pipeline ────────────────────────────────────────────

  async _runGeneration(gen, { findings, brain, huntContext }) {
    // Plan: deterministic sections + one brain call per narrative section.
    // Low-severity findings are grouped so the brain never faces a huge prompt.
    const deepDiveGroups = this._planFindingGroups(findings);
    const sections = [
      { key: 'executive-summary', title: 'Executive Summary', kind: 'brain' },
      { key: 'methodology', title: 'Scope & Methodology', kind: 'brain' },
      { key: 'findings-overview', title: 'Findings at a Glance', kind: 'deterministic' },
      ...deepDiveGroups.map((g, i) => ({
        key: `finding-${i + 1}`,
        title: g.length === 1 ? `Finding: ${(g[0].title || g[0].type || 'Untitled').slice(0, 60)}` : `Findings Group ${i + 1}`,
        kind: 'brain',
        findings: g,
      })),
      { key: 'attack-chains', title: 'Attack Chains', kind: 'brain' },
      { key: 'remediation', title: 'Remediation Roadmap', kind: 'brain' },
      { key: 'appendix', title: 'Appendix', kind: 'deterministic' },
    ];
    gen.progress.total = sections.length;

    const fragments = [];
    for (const section of sections) {
      gen.progress.currentSection = section.title;
      let html;
      if (section.kind === 'deterministic') {
        html = this._deterministicSection(section.key, { findings, target: gen.target, huntContext });
      } else if (brain) {
        html = await this._brainSection(brain, section, {
          findings,
          target: gen.target,
          huntContext,
        });
      } else {
        html = this._fallbackSection(section, { findings });
      }
      fragments.push({ key: section.key, title: section.title, html: sanitizeFragment(html) });
      gen.progress.done += 1;
    }

    const fullHtml = this._assemble({ target: gen.target, findings, fragments, huntContext });
    await fs.mkdir(this.reportDir, { recursive: true });
    const filePath = path.join(this.reportDir, `${gen.id}.html`);
    await fs.writeFile(filePath, fullHtml, 'utf8');
    gen.filePath = filePath;
    gen.status = 'done';
    gen.finishedAt = new Date().toISOString();
    gen.progress.currentSection = 'complete';
    this.logger.info?.(
      `[html-report] done ${gen.id}: ${sections.length} sections, ${findings.length} findings`
    );
  }

  /**
   * Group findings for deep dives: critical/high get their own section each;
   * medium and below are grouped (max 3 per group) to bound brain prompts.
   */
  _planFindingGroups(findings) {
    const groups = [];
    let lowGroup = [];
    for (const f of findings) {
      const sev = String(f.severity || '').toLowerCase();
      if (sev === 'critical' || sev === 'high') {
        if (lowGroup.length) { groups.push(lowGroup); lowGroup = []; }
        groups.push([f]);
      } else {
        lowGroup.push(f);
        if (lowGroup.length >= 3) { groups.push(lowGroup); lowGroup = []; }
      }
    }
    if (lowGroup.length) groups.push(lowGroup);
    return groups;
  }

  /** One focused brain call per narrative section — small prompt, small output. */
  async _brainSection(brain, section, { findings, target, huntContext }) {
    const counts = {};
    for (const f of findings) {
      const s = String(f.severity || 'informational').toLowerCase();
      counts[s] = (counts[s] || 0) + 1;
    }
    const contextLines = [
      `Target: ${target || '(unknown)'}`,
      `Total findings: ${findings.length} (${SEVERITY_ORDER.map(s => `${s}: ${counts[s] || 0}`).join(', ')})`,
    ];
    let task;
    switch (section.key) {
      case 'executive-summary':
        task = `Write the Executive Summary: 2 short paragraphs — what was tested, the overall risk posture, and the single most important takeaway. Then a 3-5 item bullet list of key highlights.`;
        break;
      case 'methodology':
        task = `Write Scope & Methodology: what was in scope (the target above), the testing approach in 4-6 bullets (recon, crawling, vulnerability scanning, manual validation logic, chaining), and 2-3 lines on what was NOT tested (destructive actions excluded).`;
        break;
      case 'attack-chains':
        task = `Write Attack Chains: describe 1-3 realistic attack paths that CHAIN the findings below into higher-impact scenarios (e.g. info leak → auth bypass → data access). Each chain: name, the findings it links (by title), step-by-step narrative, resulting impact. If no meaningful chain exists, say so honestly in one paragraph — do not force it.`;
        contextLines.push('', 'Findings:', ...findings.slice(0, 10).map(findingDigest));
        break;
      case 'remediation':
        task = `Write the Remediation Roadmap: a prioritized table or numbered list — fix order (critical first), each with the finding title, one-line fix guidance, and effort estimate (low/medium/high). End with 2-3 strategic recommendations.`;
        contextLines.push('', 'Findings:', ...findings.slice(0, 10).map(findingDigest));
        break;
      default: {
        // finding deep dive
        const group = section.findings || [];
        task = `Write a technical deep dive for ${group.length === 1 ? 'this finding' : 'each of these findings (separate h3 per finding)'}. Per finding: what it is (1 paragraph), affected asset/endpoint, step-by-step reproduction, why it matters (impact), and the concrete fix.`;
        contextLines.push('', 'Findings:', ...group.map(findingDigest));
      }
    }
    const prompt = `${contextLines.join('\n')}\n\nTask: ${task}`;
    try {
      const out = await brain.generate(
        [
          { role: 'system', content: FRAGMENT_SYSTEM },
          { role: 'user', content: prompt },
        ],
        { maxTokens: 1500, timeout: 180000 }
      );
      const text = String(out || '').trim();
      if (!text) throw new Error('empty brain reply');
      return text;
    } catch (err) {
      this.logger.warn?.(`[html-report] brain section "${section.key}" failed: ${err.message} — using fallback`);
      return this._fallbackSection(section, { findings });
    }
  }

  /** Deterministic sections need no brain call. */
  _deterministicSection(key, { findings, target, huntContext }) {
    if (key === 'findings-overview') {
      const rows = findings
        .map(f => {
          const sev = String(f.severity || 'informational').toLowerCase();
          const color = SEVERITY_COLORS[sev] || SEVERITY_COLORS.informational;
          return `<tr><td><span class="sev" style="background:${color}">${escapeHtml(sev)}</span></td><td>${escapeHtml(f.title || f.type || 'Untitled')}</td><td>${escapeHtml(f.category || '—')}</td><td>${escapeHtml(f.affectedAsset || target || '—')}</td></tr>`;
        })
        .join('\n');
      return `<h2>Findings at a Glance</h2>
<table class="findings"><thead><tr><th>Severity</th><th>Title</th><th>Category</th><th>Asset</th></tr></thead>
<tbody>${rows || '<tr><td colspan="4">No findings recorded yet.</td></tr>'}</tbody></table>`;
    }
    if (key === 'appendix') {
      const when = huntContext?.startedAt ? `<p>Hunt started: ${escapeHtml(huntContext.startedAt)}</p>` : '';
      return `<h2>Appendix</h2>${when}
<p>Report generated by Infinity AI on ${escapeHtml(new Date().toISOString())} from ${findings.length} recorded finding(s). All claims derive from stored hunt data.</p>
<p><em>Authorized testing only — this report covers the agreed scope.</em></p>`;
    }
    return `<h2>${escapeHtml(key)}</h2><p>No data.</p>`;
  }

  /** When the brain is unavailable, still produce a useful section. */
  _fallbackSection(section, { findings }) {
    if (section.key === 'executive-summary') {
      const crit = findings.filter(f => String(f.severity).toLowerCase() === 'critical').length;
      const high = findings.filter(f => String(f.severity).toLowerCase() === 'high').length;
      return `<h2>Executive Summary</h2><p>Automated security assessment of the target identified <strong>${findings.length}</strong> finding(s), including <strong>${crit}</strong> critical and <strong>${high}</strong> high severity. Detailed analysis per finding follows below.</p>`;
    }
    const group = section.findings || [];
    if (group.length) {
      return `<h2>${escapeHtml(section.title)}</h2>` + group.map(f =>
        `<h3>${escapeHtml(f.title || f.type || 'Untitled')}</h3><p>${escapeHtml(f.description || 'No description recorded.')}</p>`
      ).join('\n');
    }
    return `<h2>${escapeHtml(section.title)}</h2><p>Section content unavailable — the hunting brain was unreachable when this report was generated. Raw finding data is preserved in the findings table.</p>`;
  }

  /** Assemble fragments into a complete standalone HTML document. */
  _assemble({ target, findings, fragments, huntContext }) {
    const toc = fragments
      .map((f, i) => `<li><a href="#sec-${i}">${escapeHtml(f.title)}</a></li>`)
      .join('\n');
    const body = fragments
      .map((f, i) => `<section id="sec-${i}" class="report-section">${f.html}</section>`)
      .join('\n');
    const counts = {};
    for (const f of findings) {
      const s = String(f.severity || 'informational').toLowerCase();
      counts[s] = (counts[s] || 0) + 1;
    }
    const badges = SEVERITY_ORDER.map(
      s => `<span class="sev" style="background:${SEVERITY_COLORS[s]}">${s}: ${counts[s] || 0}</span>`
    ).join(' ');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Security Assessment Report — ${escapeHtml(target || 'Target')}</title>
<style>
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0b0e14; color: #e6e9f0; margin: 0; line-height: 1.6; }
.header { background: linear-gradient(135deg, #141a2e, #0b0e14); border-bottom: 1px solid #232a44; padding: 32px 40px; }
.header h1 { margin: 0 0 8px; font-size: 28px; }
.header .meta { color: #8b93b0; font-size: 14px; }
.badges { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
.sev { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; color: #0b0e14; text-transform: uppercase; letter-spacing: .4px; }
.layout { display: flex; max-width: 1100px; margin: 0 auto; }
.toc { width: 240px; flex-shrink: 0; padding: 32px 0 32px 40px; position: sticky; top: 0; align-self: flex-start; }
.toc h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #8b93b0; }
.toc ol { padding-left: 18px; }
.toc li { margin: 6px 0; font-size: 14px; }
.toc a { color: #9fb4ff; text-decoration: none; }
.toc a:hover { text-decoration: underline; }
.content { flex: 1; padding: 32px 40px 64px 32px; min-width: 0; }
.report-section { background: #11162a; border: 1px solid #232a44; border-radius: 12px; padding: 24px 28px; margin-bottom: 24px; }
.report-section h2 { margin-top: 0; font-size: 22px; border-bottom: 1px solid #232a44; padding-bottom: 10px; }
.report-section h3 { color: #cdd6f4; }
table.findings { width: 100%; border-collapse: collapse; font-size: 14px; }
table.findings th, table.findings td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #232a44; }
table.findings th { color: #8b93b0; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: .5px; }
code, pre { background: #0b0e14; border: 1px solid #232a44; border-radius: 6px; }
code { padding: 2px 6px; font-size: 13px; }
pre { padding: 14px; overflow-x: auto; font-size: 13px; }
.footer { text-align: center; color: #5b6486; font-size: 12px; padding: 24px; border-top: 1px solid #232a44; }
@media (max-width: 800px) { .layout { flex-direction: column; } .toc { width: auto; position: static; padding: 16px 24px 0; } .content { padding: 16px 24px 48px; } }
@media print { body { background: #fff; color: #111; } .header { background: #fff; color: #111; } .toc { display: none; } .report-section { background: #fff; border-color: #ddd; break-inside: avoid; } }
</style>
</head>
<body>
<div class="header">
<h1>Security Assessment Report</h1>
<div class="meta">Target: <strong>${escapeHtml(target || '—')}</strong> &nbsp;•&nbsp; Generated ${escapeHtml(new Date().toLocaleString())} &nbsp;•&nbsp; Infinity AI</div>
<div class="badges">${badges}</div>
</div>
<div class="layout">
<nav class="toc"><h3>Contents</h3><ol>${toc}</ol></nav>
<main class="content">${body}</main>
</div>
<div class="footer">Generated by Infinity AI — authorized testing only. Verify findings before action.</div>
</body>
</html>`;
  }
}

export function createHtmlReportService(options = {}) {
  return new HtmlReportService(options);
}
