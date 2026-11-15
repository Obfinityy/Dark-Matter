// Split out of hunts.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; hunts.js re-exports the public names so callers are unchanged.

import PDFDocument from 'pdfkit';
import { routeKeyForUrl } from '../../scanner/routeGroup.js';
import { analyzeFindings, chainsMarkdown, generateLogicTests, getPlaybook, reflectHunt, recordHuntExperience, resolveHuntMode, HUNT_MODES, MODE_ORDER, TIERS } from '../../hunt-intel/index.js';
import { loadHuntMemory, panelFindings, findingDetail, applyRetractions, isErrorPageFinding, normTitle } from '../../huntMemory.js';
import {
  appendHuntEvent,
  readHuntBehaviour,
  readHuntEvents,
  writeHuntMeta,
  writeHuntMetaCheckpoint,
  readHuntMeta,
  listHuntMetas,
} from '../../store.js';
import { requireAuth, issueTerminalTicket, issueControlTicket } from '../auth.js';
import { getHuntCost, getUserCosts } from '../../costTracker.js';
import { teardownHuntContainer, huntDesktopScreenshot } from '../../huntRunner.js';
import { engineErrorResponse, mapListHunt, normalizeHuntCreate, pickExistingHunt, requireHuntOwner } from './helpers.js';
import { createLogger } from '../../logger.js';
import {
  OWASP_STAGES,
  STAGE_TABLE_VERSION,
  GO_SHEET_TO_OWASP,
  MCP_BLOCKED_REASON,
  AI_BLOCKED_REASON,
  stageOfPhase,
} from '../../scanner/owaspStages.js';
import { CHECKS } from '../../self/checklist.js';

const log = createLogger('hunts');

// LINK-TO-REPORT OWASP SECTIONS (15 Nov 2026, design §3.3).
//
// When the hunt meta carries owaspStages (a Link → Report run), the
// report gains one section per stage in stage order (REC, A01..A10,
// Additional) plus a Coverage honesty section. Each stage section
// shows its phases' run/skip/fail state (from the streamed phase
// records — the live truth, never the phase list), the findings
// attributed to the stage, and the Self-checklist checks that did
// NOT run in that stage (GAP / GAP-partial / AI-blocked /
// MCP-blocked, with the missing leg named). Nothing is ever rendered
// as passed unless a phase actually ran it.
//
// Finding → stage attribution comes from the `scanner_finding`
// events: runScan tags every finding with its producing phase name
// when owaspStages is enabled, and stageOfPhase maps it. A finding
// row with no tagged stamp (pre-table run, or an AI-hunt row) is
// listed under Coverage honesty as unattributed, never silently
// dropped and never guessed into a stage.
//
// The existing ## Findings / Tool activity / Status timeline
// sections are untouched: the OWASP block is appended after
// ## Findings, and a hunt without meta.owaspStages renders exactly
// as before (buildReportMarkdown calls this only when the meta
// carries the table).
function buildOwaspReportSections({ meta, events, rows, confirmedRows, leadRows, genuineByTitle, anyByTitle }) {
  const lines = [];
  const stagesMeta = (meta && meta.owaspStages) || {};
  const version = stagesMeta.version || STAGE_TABLE_VERSION;
  lines.push('## OWASP Top 10 2021 — Link → Report');
  lines.push('');
  lines.push(`Run mode: Link → Report — recon first, then OWASP Top 10 2021 A01..A10 in order, then Additional. Stage table v${version}. Full evidence for each finding is in ## Findings above; this section groups them by stage and names what did not run.`);
  lines.push('');

  // Phase records, aggregated per phase NAME (the param battery
  // repeats a phase name per URL — counting raw records would
  // inflate the stage totals).
  const phaseByName = new Map();
  for (const e of events || []) {
    if (!e || e.type !== 'phase' || !e.name) continue;
    if (!phaseByName.has(e.name)) phaseByName.set(e.name, []);
    phaseByName.get(e.name).push(e);
  }
  const phaseStatus = (name) => {
    const list = phaseByName.get(name);
    if (!list || !list.length) return 'not-run';
    if (list.some((p) => !p.ok && !p.skipped)) return 'failed';
    if (list.every((p) => p.skipped)) return 'skipped';
    return 'ok';
  };
  const phaseFindingsCount = (name) => {
    const list = phaseByName.get(name) || [];
    return list.reduce((n, p) => n + (Number(p.findingsCount) || 0), 0);
  };

  // Finding title → stage, from the tagged scanner_finding stamps.
  const stageByTitle = new Map();
  for (const e of events || []) {
    if (!e || e.type !== 'scanner_finding' || !e.finding) continue;
    const f = e.finding;
    if (!f.title || !f.phase) continue;
    const code = stageOfPhase(f.phase);
    if (!code) continue;
    const key = normTitle(f.title);
    if (key && !stageByTitle.has(key)) stageByTitle.set(key, code);
  }
  const rowsOfStage = (code, list) =>
    list.filter((r) => stageByTitle.get(normTitle(r.title)) === code);
  const unattributed = rows.filter((r) => !stageByTitle.has(normTitle(r.title)));

  // Self-checklist checks, grouped by OWASP stage via the Go-sheet
  // bridge. LIVE checks are covered by the scanner battery and are
  // not listed per stage (their count is in Coverage honesty);
  // everything else is honestly not-run.
  const notRunByStage = new Map();
  for (const c of CHECKS) {
    const code = GO_SHEET_TO_OWASP[c.category];
    if (!code) continue;
    if (c.coverage === 'LIVE' && c.kind !== 'ai') continue;
    if (!notRunByStage.has(code)) notRunByStage.set(code, []);
    notRunByStage.get(code).push(c);
  }
  const notRunReason = (c) => {
    if (c.kind === 'ai') return `blocked — needs AI executor (${AI_BLOCKED_REASON})`;
    if (c.coverage === 'GAP') return 'not run — no scanner leg exists (GAP)';
    return 'not run — partial leg only; judgment leg deferred (GAP-partial)';
  };

  for (const stage of OWASP_STAGES) {
    const names = stage.phases || [];
    const counts = { ok: 0, failed: 0, skipped: 0, 'not-run': 0 };
    let stageFindingsReported = 0;
    for (const n of names) {
      counts[phaseStatus(n)] += 1;
      stageFindingsReported += phaseFindingsCount(n);
    }
    const confirmed = rowsOfStage(stage.code, confirmedRows);
    const leads = rowsOfStage(stage.code, leadRows);
    lines.push(`## ${stage.code} — ${stage.title}`);
    lines.push('');
    if (stage.note) lines.push(`_${stage.note}_`, '');
    lines.push(`- **Phases:** ${names.length} in stage — ${counts.ok} ran ok, ${counts.failed} failed, ${counts.skipped} skipped, ${counts['not-run']} not run yet. Phases reported ${stageFindingsReported} finding(s) in total (before verification dedup).`);
    lines.push('');
    if (!confirmed.length && !leads.length) {
      lines.push('_No findings recorded in this stage yet._');
      lines.push('');
    } else {
      if (confirmed.length) {
        lines.push('### Confirmed vulnerabilities');
        lines.push('');
        for (const r of confirmed) {
          const sev = String(r.severity || 'info');
          const stamp = genuineByTitle.get(normTitle(r.title)) || {};
          lines.push(`#### [${sev.toUpperCase()}] ${r.title}`);
          if (r.verification) lines.push('', `**Verification:** ${r.verification}`);
          if (r.detail) lines.push('', String(r.detail));
          const url = stamp.url || r.url;
          if (url) lines.push('', `**URL:** ${url}`);
          lines.push('');
        }
      }
      if (leads.length) {
        lines.push('### Leads under investigation');
        lines.push('');
        for (const r of leads) {
          const sev = String(r.severity || 'info');
          const stamp = anyByTitle.get(normTitle(r.title)) || {};
          const url = stamp.url || r.url;
          lines.push(`- **[${sev.toUpperCase()}] ${r.title}** — under investigation (not confirmed).${url ? ` ${url}` : ''}`);
        }
        lines.push('');
      }
    }
    // MCP-blocked leg: the mcp-tool-poisoning phase lives in
    // Additional and is blocked by owner decision, never run.
    if (stage.code === 'Additional') {
      lines.push(`- **Blocked — MCP:** \`mcp-tool-poisoning\` — ${MCP_BLOCKED_REASON}. Never run, never faked as passed.`);
      lines.push('');
    }
    // Checks not run in this stage (Self checklist coverage).
    const notRun = notRunByStage.get(stage.code) || [];
    lines.push('### Checks not run');
    lines.push('');
    if (!notRun.length) {
      lines.push('_All Self-checklist checks for this stage are LIVE-covered._');
    } else {
      const groups = [
        ['AI-blocked', notRun.filter((c) => c.kind === 'ai')],
        ['GAP', notRun.filter((c) => c.kind !== 'ai' && c.coverage === 'GAP')],
        ['GAP-partial', notRun.filter((c) => c.kind !== 'ai' && c.coverage === 'GAP-partial')],
      ];
      for (const [label, list] of groups) {
        if (!list.length) continue;
        lines.push(`- **${label} (${list.length}):**`);
        for (const c of list) lines.push(`  - ${c.name} (${c.id}) — ${notRunReason(c)}`);
      }
    }
    lines.push('');
  }

  // Coverage honesty (design §3.3): counts only, no invented passes.
  const totalRecords = [...phaseByName.values()].flat();
  const phaseTotals = {
    total: totalRecords.length,
    ok: totalRecords.filter((p) => p.ok && !p.skipped).length,
    failed: totalRecords.filter((p) => !p.ok && !p.skipped).length,
    skipped: totalRecords.filter((p) => p.skipped).length,
    timedOut: totalRecords.filter((p) => p.timedOut).length,
  };
  const checkTotals = {
    live: CHECKS.filter((c) => c.coverage === 'LIVE' && c.kind !== 'ai').length,
    gapPartial: CHECKS.filter((c) => c.coverage === 'GAP-partial' && c.kind !== 'ai').length,
    gap: CHECKS.filter((c) => c.coverage === 'GAP' && c.kind !== 'ai').length,
    ai: CHECKS.filter((c) => c.kind === 'ai').length,
  };
  const tablePhases = OWASP_STAGES.flatMap((s) => s.phases || []);
  const notRunPhases = tablePhases.filter((n) => !phaseByName.has(n)).length;
  lines.push('## Coverage honesty');
  lines.push('');
  lines.push(`- **Phases:** ${phaseTotals.total} phase records — ${phaseTotals.ok} ran ok, ${phaseTotals.failed} failed, ${phaseTotals.skipped} skipped, ${phaseTotals.timedOut} timed out. ${notRunPhases} of ${tablePhases.length} table phases have no record yet.`);
  lines.push(`- **Self checklist (${CHECKS.length} checks):** ${checkTotals.live} LIVE-covered, ${checkTotals.gapPartial} GAP-partial (partial leg only), ${checkTotals.gap} GAP (no scanner leg), ${checkTotals.ai} AI-blocked (need the AI executor — never run, never faked). MCP-blocked: 1 (\`mcp-tool-poisoning\`).`);
  lines.push('- **No invented passes:** a check or phase listed above as not run, blocked, or skipped is not a pass. A stage with zero findings means the phases that ran found nothing — not that every check passed.');
  if (unattributed.length) {
    lines.push(`- **Findings without a stage (${unattributed.length}):** ${unattributed.map((r) => r.title).join('; ')} — no phase-tagged stamp exists for these titles, so they are not attributed to any stage above.`);
  }
  lines.push('');
  return lines;
}


export function buildReportMarkdown({ huntId, meta, events }) {
  const target = (meta && meta.target) || 'unknown target';
  const createdAt = (meta && meta.createdAt) || 'unknown';
  // LIVE REPORT (27 Oct 2026, feat/live-report-fix): the report
  // used to render RAW finding events — every stamp a finding,
  // including the 5 "verified" 404-page stamps and their
  // "PoC confirmed:" duplicates, with no confirmed/lead
  // distinction. It now renders the same reconciled rows the hunt
  // panel shows (panelFindings over retraction-filtered events):
  // one row per unique title, error-page stamps demoted to leads,
  // so the report can never contradict the panel or the chat.
  const rawFindings = applyRetractions(events);
  const rows = panelFindings(rawFindings);
  const confirmedRows = rows.filter((r) => r.verified);
  const leadRows = rows.filter((r) => !r.verified);
  // Evidence/description/URL come from the underlying stamp: a
  // genuine verified stamp for confirmed rows; any stamp's URL for
  // leads (leads render no evidence block and no verification
  // string — their evidence is what misled the verifier).
  const genuineByTitle = new Map();
  const anyByTitle = new Map();
  for (const f of rawFindings) {
    const key = normTitle(f.title || f.type || '');
    if (!key) continue;
    if (!anyByTitle.has(key)) anyByTitle.set(key, f);
    if (f.verified && !isErrorPageFinding(f) && !genuineByTitle.has(key)) genuineByTitle.set(key, f);
  }
  const toolCalls = events.filter((e) => e.type === 'tool_call');
  const thinking = events.filter((e) => e.type === 'thinking');
  const statuses = events.filter((e) => e.type === 'status');
  const lastStatus = statuses.length ? statuses[statuses.length - 1] : null;

  const lines = [];
  lines.push(`# Hunt Report — ${huntId}`);
  lines.push('');
  lines.push(`- **Target:** ${target}`);
  lines.push(`- **Created:** ${createdAt}`);
  // SCAN SCOPE (9 Nov 2026, /* owner order): a whole-site hunt says
  // so up front, and the per-route section below answers "which route
  // had what". Page-scope hunts (incl. legacy metas) carry no line.
  if (meta && meta.scanScope === 'site') {
    lines.push(`- **Scan scope:** Whole site (/*) — recursive same-origin crawl`);
    const finished = statuses.find((s) => s.state === 'scanner_finished' && s.summary);
    if (finished && finished.summary && finished.summary.routesScanned) {
      lines.push(`- **Routes scanned:** ${finished.summary.routesScanned}`);
    }
  }
  // LINK-TO-REPORT (15 Nov 2026): the run mode + stage table version
  // are header facts, so a reader can tell an ordered OWASP run
  // from a legacy hunt at a glance. Legacy metas carry no key and
  // render no line here.
  if (meta && meta.owaspStages) {
    const stagesMeta = meta.owaspStages || {};
    lines.push(`- **Run mode:** Link → Report — recon, then OWASP Top 10 2021 A01..A10 in order`);
    lines.push(`- **Stage table:** v${stagesMeta.version || STAGE_TABLE_VERSION}`);
  }
  lines.push(`- **Latest status:** ${lastStatus ? (lastStatus.state || JSON.stringify(lastStatus)) : 'n/a'}`);
  lines.push(`- **Events cached:** ${events.length} (${thinking.length} thinking, ${toolCalls.length} tool calls, ${rows.length} unique findings: ${confirmedRows.length} confirmed, ${leadRows.length} under investigation)`);
  lines.push(`- **Generated:** ${new Date().toISOString()} (report may reflect a mid-hunt snapshot)`);
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  if (!rows.length) {
    lines.push('_No findings recorded yet._');
  } else {
    // Infinity analysis: chains, confirmation, exploitability, variant probes.
    // Chains build on GENUINE confirmed findings only — a 404 stamp
    // must never seed an exploit chain.
    try {
      // The Infinity-analysis counts line must agree with the
      // reconciled rows above: analyzeFindings runs on the
      // GENUINE-only subset (chains must never seed from a 404
      // stamp), but its summary then reads "0 raw → 0 unique" on
      // a hunt with 6 reconciled leads — contradicting the
      // report's own "6 unique findings" headline (live, 27 Oct
      // 23:51 IST verification). Override the counts with the
      // reconciled numbers; likely-exploitable stays the genuine
      // analysis's own count (leads are unconfirmed, so they can
      // never be likely exploitable).
      const analysis = analyzeFindings(rawFindings.filter((f) => f.verified && !isErrorPageFinding(f)));
      analysis.summary = {
        ...analysis.summary,
        raw: rawFindings.length,
        unique: rows.length,
        confirmed: confirmedRows.length,
      };
      lines.push(chainsMarkdown(analysis));
    } catch {
      // intel layer is best-effort; raw findings still render below
    }
    lines.push('### Confirmed vulnerabilities');
    lines.push('');
    if (!confirmedRows.length) {
      lines.push('_No confirmed vulnerabilities yet._');
    } else {
      for (const r of confirmedRows) {
        const sev = String(r.severity || 'info');
        const stamp = genuineByTitle.get(normTitle(r.title)) || {};
        lines.push(`#### [${sev.toUpperCase()}] ${r.title}`);
        if (r.verification) lines.push('', `**Verification:** ${r.verification}`);
        if (r.detail) lines.push('', String(r.detail));
        if (stamp.description) lines.push('', String(stamp.description));
        if (stamp.evidence) lines.push('', '**Evidence:**', '', '```', String(typeof stamp.evidence === 'string' ? stamp.evidence : JSON.stringify(stamp.evidence)).slice(0, 2000), '```');
        const url = stamp.url || r.url;
        if (url) lines.push('', `**URL:** ${url}`);
        lines.push('');
      }
    }
    // FINDINGS BY ROUTE (9 Nov 2026, /* owner order): whole-site
    // hunts group the confirmed titles under the route they were
    // found on, so the report answers "which route had what" at a
    // glance. Page-scope hunts render no section — their findings
    // all come from the one pasted page.
    if (meta && meta.scanScope === 'site' && confirmedRows.length) {
      const byRoute = new Map();
      for (const r of confirmedRows) {
        const stamp = genuineByTitle.get(normTitle(r.title)) || {};
        const route = routeKeyForUrl(stamp.url || r.url, target);
        if (!byRoute.has(route)) byRoute.set(route, []);
        const titles = byRoute.get(route);
        if (!titles.includes(r.title)) titles.push(r.title);
      }
      lines.push('### Findings by route');
      lines.push('');
      for (const [route, titles] of [...byRoute.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        lines.push(`#### ${route}`);
        for (const t of titles) lines.push(`- ${t}`);
        lines.push('');
      }
    }
    lines.push('### Leads under investigation');
    lines.push('');
    if (!leadRows.length) {
      lines.push('_No leads under investigation._');
    } else {
      for (const r of leadRows) {
        const sev = String(r.severity || 'info');
        const stamp = anyByTitle.get(normTitle(r.title)) || {};
        const url = stamp.url || r.url;
        lines.push(`- **[${sev.toUpperCase()}] ${r.title}** — under investigation (not confirmed).${url ? ` ${url}` : ''}`);
        if (r.detail) lines.push(`  ${String(r.detail)}`);
      }
      lines.push('');
    }
  }
  // LINK-TO-REPORT (15 Nov 2026, design §3.3): when the hunt meta
  // carries owaspStages, the report gains the per-stage OWASP
  // sections + Coverage honesty after ## Findings. When absent, this
  // block is skipped and the report renders exactly as before.
  if (meta && meta.owaspStages) {
    lines.push(...buildOwaspReportSections({ meta, events, rows, confirmedRows, leadRows, genuineByTitle, anyByTitle }));
  }
  lines.push('## Tool activity');
  lines.push('');
  if (!toolCalls.length) {
    lines.push('_No tool calls recorded yet._');
  } else {
    for (const t of toolCalls.slice(0, 200)) {
      const name = t.tool || t.name || 'tool';
      lines.push(`- \`${name}\` ${t.input ? '— ' + String(t.input).slice(0, 160) : ''}`);
    }
    if (toolCalls.length > 200) lines.push(`- …and ${toolCalls.length - 200} more`);
  }
  lines.push('');
  lines.push('## Status timeline');
  lines.push('');
  for (const s of statuses) {
    lines.push(`- ${s.cachedAt || s.at || ''} — ${s.state || JSON.stringify(s)}`);
  }
  lines.push('');
  return lines.join('\n');
}

export function renderPdf(md, meta, huntId) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.fontSize(20).text(`Hunt Report — ${huntId}`, { underline: true });
  doc.moveDown();
  doc.fontSize(10).fillColor('#555');
  doc.text(`Target: ${(meta && meta.target) || 'unknown'}`);
  doc.text(`Generated: ${new Date().toISOString()} (may be a mid-hunt snapshot)`);
  doc.moveDown();
  doc.fillColor('#000');

  // Simple markdown-ish rendering: headings, bullets, code blocks.
  let inCode = false;
  for (const rawLine of md.split('\n')) {
    const line = rawLine;
    if (line.trim().startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      doc.font('Courier').fontSize(8).text(line);
      doc.font('Helvetica').fontSize(10);
      continue;
    }
    if (line.startsWith('# ')) doc.fontSize(16).text(line.slice(2));
    else if (line.startsWith('## ')) { doc.moveDown(0.5); doc.fontSize(13).text(line.slice(3)); }
    else if (line.startsWith('### ')) { doc.moveDown(0.25); doc.fontSize(11).text(line.slice(4)); }
    else if (line.startsWith('- ') || line.startsWith('* ')) doc.fontSize(10).text('• ' + line.slice(2));
    else if (line.trim() === '') doc.moveDown(0.5);
    else doc.fontSize(10).text(line.replace(/\*\*/g, ''));
  }
  doc.end();
  return done;
}

// Route registrations moved verbatim from hunts.js by the P3 lane;
// hunts.js calls registerReportRoutes(router) in the same order.

export function registerReportRoutes(router) {
  // ---- Report: works ANY time, even mid-hunt --------------------------------
  // Assembled from the locally cached event stream (see WS bridge + engine
  // polls). Markdown is always available; PDF is rendered with pdfkit (bundled
  // dependency). If pdfkit were ever missing, we fall back to markdown with a
  // clear note instead of failing.

  router.get('/:id/report', requireAuth, async (req, res) => {
    const huntId = req.params.id;
    const meta0 = requireHuntOwner(req, res);
    if (!meta0) return;
    const format = String(req.query.format || 'md').toLowerCase();
    const events = readHuntEvents(huntId);
    const meta = readHuntMeta(huntId);
    if (!meta && events.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'unknown_hunt',
        message: `No cached data for hunt "${huntId}". Reports are generated from the local event cache.`,
      });
    }
    const md = buildReportMarkdown({ huntId, meta, events });
    if (format === 'pdf') {
      try {
        const pdf = await renderPdf(md, meta, huntId);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="hunt-${huntId}.pdf"`);
        return res.send(pdf);
      } catch (err) {
        log.warn(`[hunts] pdf render failed for ${huntId}: ${err.message}; falling back to markdown`);
        res.setHeader('X-Report-Note', 'pdf-render-failed; markdown returned instead');
        return res.type('text/markdown').send(md);
      }
    }
    res.type('text/markdown').send(md);
  });

  // ---- AI-generated report for Autonomous hunts (owner order 3 Nov 2026) ---
  // GET /api/v1/hunts/:id/agent-report — "jo report aayegi wo AI banayega".
  // Meta AI writes the professional report from the scanner's collected data
  // (findings only, not the event firehose). One call per request, cost
  // recorded. Honest 502 when the API is unavailable — never a fabricated
  // report. Auth: JWT + hunt ownership.

  router.get('/:id/agent-report', requireAuth, async (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const lang = String(req.query.lang || 'hinglish-roman').slice(0, 40);
    try {
      const { generateAgentReport } = await import('../../scanner/agentReport.js');
      const r = await generateAgentReport(req.params.id, { lang });
      if (!r.ok) {
        return res.status(502).json({ ok: false, error: 'report_unavailable', reason: r.reason });
      }
      res.type('text/markdown').send(r.markdown);
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'report_error' });
    }
  });

  // ---- Autonomous agent chat (owner order 3 Nov 2026) ----------------------
  // POST /api/v1/hunts/:id/agent-chat — talk to the scan agent about THIS
  // hunt. Meta API answers from the hunt's own findings, in the user's
  // language, strictly scoped to bug-bounty + the current target; anything
  // outside scope gets a short refusal. Minimal cost by construction
  // (one short call per message). Auth: JWT + hunt ownership.

  router.post('/:id/agent-chat', requireAuth, async (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const message = String((req.body && req.body.message) || '').slice(0, 2000).trim();
    if (!message) {
      return res.status(400).json({ ok: false, error: 'empty_message' });
    }
    const lang = String((req.body && req.body.lang) || 'hinglish-roman').slice(0, 40);
    try {
      const { agentChatReply } = await import('../../scanner/agentChat.js');
      const r = await agentChatReply(req.params.id, message, { lang });
      if (!r.ok) {
        return res.status(502).json({ ok: false, error: 'agent_unavailable', reason: r.reason });
      }
      return res.json({ ok: true, reply: r.text, costUsd: r.costUsd });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'agent_error' });
    }
  });

  // ---- AI behaviour analysis (owner idea, 8 Nov 2026) ----------------------
  // GET  /api/v1/hunts/:id/behaviour   — the hunt's behaviour bundle
  // POST /api/v1/hunts/:id/ai-analysis — ONE Meta AI call over that
  //   bundle, proposing NEW candidate vulnerabilities beyond the ones the
  //   predefined battery found. IDEMPOTENT: once aiAnalysis.json exists
  //   it is returned as-is and the provider is never called again.
  //   Suggestions are LEADS (verified:false) — never merged into
  //   scannerSummary confirmed counts or the findings list. While the
  //   Meta Model API key is dead (401 since 4 Nov 2026) the live path
  //   returns status 'ai-unavailable'. Auth: JWT + hunt ownership,
  //   same as GET the hunt.

  router.get('/:id/behaviour', requireAuth, async (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    try {
      const bundle = readHuntBehaviour(req.params.id);
      if (!bundle) {
        return res.status(404).json({ ok: false, error: 'no behaviour bundle yet' });
      }
      return res.json({ ok: true, behaviour: bundle });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'behaviour_error' });
    }
  });

  router.post('/:id/ai-analysis', requireAuth, async (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    try {
      const { runAiAnalysis } = await import('../../scanner/aiAnalysis.js');
      const r = await runAiAnalysis(req.params.id);
      if (!r.ok) {
        if (r.error === 'no behaviour bundle yet') {
          return res.status(404).json({ ok: false, error: 'no behaviour bundle yet' });
        }
        return res.status(500).json({ ok: false, error: r.error });
      }
      return res.json({ ok: true, stored: r.stored, analysis: r.analysis });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'ai_analysis_error' });
    }
  });

  // ---- Live Machine: latest frame of the hunt machine's GUI desktop --------
  // The owner watches the agent's desktop as a picture that refreshes every
  // few seconds (the frontend polls this route ~every 3s). Strictly a
  // VIEW: nothing on this route can drive the machine — the desktop's VNC
  // server is view-only inside the container, and hunt control stays on
  // the pause/resume/stop routes. The first poll starts the desktop stack
  // inside the container on demand; until the image/stack provides one,
  // this returns 404 desktop_not_available and the frontend shows its
  // "machine view starts when the hunter uses its desktop" placeholder.
  // Auth: JWT (requireAuth) + hunt ownership (requireHuntOwner — the hunt's
  // user, or admin). Frames are never cached (no-store).

  router.get('/:id/desktop.jpg', requireAuth, async (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    try {
      const shot = await huntDesktopScreenshot(req.params.id);
      if (!shot.ok) {
        return res.status(404).json({ ok: false, error: shot.error || 'desktop_not_available' });
      }
      res.setHeader('Content-Type', shot.contentType);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      return res.send(shot.buffer);
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'desktop_capture_failed' });
    }
  });

  // ---- Agent activity log: whatever the agent did, when --------------------------------
  // Cached event stream (thinking, tool calls, findings, status). Works even
  // when the engine is unreachable — this is the "what is the agent doing"
  // view.

  router.get('/:id/events', requireAuth, (req, res) => {  const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const limit = Math.min(parseInt(req.query.limit || '200', 10) || 200, 1000);
    const events = readHuntEvents(req.params.id);
    // Lane V: the hunt panel's findings come from the SAME reconciled
    // source as mid-hunt chat — loadHuntMemory (retraction-filtered),
    // shaped by panelFindings to one row per unique title. The panel
    // used to rebuild its counts from raw streamed finding events
    // (dropping `verified`, ignoring retractions, counting duplicate
    // stamps) and flatly contradicted chat: "0 confirmed — 284 leads"
    // on a hunt whose record holds 44 confirmed titles.
    let findings = [];
    try { findings = panelFindings(loadHuntMemory(req.params.id).findings); } catch { findings = []; }
    res.json({ ok: true, huntId: req.params.id, events: events.slice(-limit), findings });
  });

  // ---- Finding detail: the full record behind one panel row --------
  // GET /:id/findings/:title — one finding title's complete record
  // (verified stamp's evidence as stored, timestamps, stamp count).
  // The panel rows (GET /:id/events -> panelFindings) drop the raw
  // evidence, so the detail view cannot be served from them, and the
  // action index only covers tool_call/task_complete events, so the
  // output-by-hash route cannot serve it either. Read-only: the same
  // retraction-filtered loadHuntMemory record the events route uses,
  // grouped by the same normalised title. :title is URL-encoded by
  // the caller (encodeURIComponent); Express decodes %2F back to '/'
  // before matching the param, so titles containing '/' still match.
  // Owner-only, like the events route. 404 unknown_finding when no
  // stamp of that title survives on this hunt.

  router.get('/:id/findings/:title', requireAuth, (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    let detail = null;
    try { detail = findingDetail(loadHuntMemory(req.params.id).findings, req.params.title); } catch { detail = null; }
    if (!detail) {
      return res.status(404).json({
        ok: false,
        error: 'unknown_finding',
        message: `No finding titled "${req.params.title}" on this hunt.`,
      });
    }
    res.json({ ok: true, huntId: req.params.id, finding: detail });
  });

  // ---- Download full hunt memory: meta + all events + findings as JSON.
  // The admin can download any hunt's complete memory from the admin panel.

  router.get('/:id/memory', requireAuth, (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const huntId = req.params.id;
    const events = readHuntEvents(huntId);
    const memory = {
      huntId,
      exportedAt: new Date().toISOString(),
      meta,
      events,
      eventCount: events.length,
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="hunt-${huntId}-memory.json"`);
    res.send(JSON.stringify(memory, null, 2));
  });

  // ---- Money burnt on this hunt (Bedrock tokens + EC2) + its budget.

  router.get('/:id/cost', requireAuth, (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    res.json({
      ok: true,
      ...getHuntCost(req.params.id),
      budgetUsd: typeof meta.budgetUsd === 'number' ? meta.budgetUsd : null,
      pausedReason: meta.pausedReason || null,
    });
  });

  // ---- Infinity analysis: chains, confirmation, exploitability, variant probes.
  // Pure logic over cached findings — no engine call needed. Powers the
  // "what did you chain / what's next" view any time, even mid-hunt.

  router.get('/:id/analysis', requireAuth, async (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const goal = String(req.query.goal || 'rce');
    const events = readHuntEvents(req.params.id);
    const findings = events.filter((e) => e.type === 'finding');
    res.json({ ok: true, huntId: req.params.id, analysis: analyzeFindings(findings, goal) });
  });

  // ---- Business-logic tests: original black-box generator --------------------
  // Classifies the target's app type from observed paths and returns
  // invariant rules + abuse-case test sequences for the hunt's next phase.

  router.get('/:id/logic-tests', requireAuth, (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const events = readHuntEvents(req.params.id);
    const paths = [];
    for (const e of events) {
      const url = e.url || (e.input && e.input.url) || '';
      try {
        const u = new URL(String(url));
        paths.push(u.pathname);
      } catch { /* not a URL */ }
    }
    if (meta.target) {
      try { paths.push(new URL(meta.target).pathname); } catch { /* ignore */ }
    }
    res.json({ ok: true, huntId: req.params.id, ...generateLogicTests(paths) });
  });
}
