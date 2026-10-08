/**
 * liveReport.js — the Infinity AI hunt report that builds DURING the hunt.
 *
 * Every finding the planner or toolRunner produces is forwarded here
 * immediately (via addFinding), so the report is never "generated only after
 * the hunt finishes": it grows live, is persisted incrementally to
 * backend/data/hunts/<huntId>/report.json, and can be rendered to PDF at
 * any moment via toPdfInput() (compatible with services/pdfReportWriter.js
 * buildReportPdf).
 *
 * Recommended fixes are ranked PenHeal-style (concept inspired by the
 * PenHeal academic project — see THIRD_PARTY_NOTICES.md; original code):
 * each fix carries an effort estimate and an impact estimate, and the
 * "recommended fixes" section is ordered by impact-per-effort so the owner
 * sees the highest-value remediation first.
 *
 * Findings + remediation only. No exploit payloads are stored or rendered.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.resolve(here, '..', '..', 'data', 'hunts');

const SEVERITY_WEIGHT = { critical: 4, high: 3, medium: 2, low: 1, informational: 0.5 };
const EFFORT_COST = { low: 1, medium: 2, high: 3 };

/**
 * Remediation catalog: weakness pattern → fix guidance.
 * effort: low = config/header change, medium = code change, high = architectural.
 * impact: expected risk reduction if applied.
 */
export const REMEDIATION_CATALOG = [
  {
    match: /sql injection|sqli/i,
    fix: 'Use parameterized queries / prepared statements everywhere; enforce least-privilege DB accounts.',
    effort: 'medium',
    impact: 'high',
  },
  {
    match: /xss|cross-?site scripting/i,
    fix: 'Apply context-aware output encoding; adopt a strict Content-Security-Policy.',
    effort: 'medium',
    impact: 'high',
  },
  {
    match: /cors/i,
    fix: 'Replace wildcard/reflective origins with an explicit allowlist; never combine credentials with "*".',
    effort: 'low',
    impact: 'medium',
  },
  {
    match: /secret|token|password|api key|credential/i,
    fix: 'Revoke exposed secrets, rotate them, and move to a managed secrets store; scan history.',
    effort: 'low',
    impact: 'high',
  },
  {
    match: /takeover/i,
    fix: 'Remove dangling DNS records or reclaim the external service; monitor for reappearance.',
    effort: 'low',
    impact: 'high',
  },
  {
    match: /ssrf|server-?side request forgery/i,
    fix: 'Allowlist outbound destinations; block cloud metadata endpoints; validate and sanitize URLs.',
    effort: 'medium',
    impact: 'high',
  },
  {
    match: /idor|broken access control|authorization/i,
    fix: 'Enforce server-side authorization checks on every object reference; use indirect references.',
    effort: 'medium',
    impact: 'high',
  },
  {
    match: /jwt/i,
    fix: 'Validate signature with a strong algorithm allowlist (no "none"); set short expirations; verify claims.',
    effort: 'low',
    impact: 'medium',
  },
  {
    match: /security header|missing header|hsts|x-frame|content-security/i,
    fix: 'Deploy baseline security headers (HSTS, X-Frame-Options/frame-ancestors, CSP, Referrer-Policy).',
    effort: 'low',
    impact: 'medium',
  },
  {
    match: /outdated|old version|vulnerable version|eol/i,
    fix: 'Upgrade to a supported release and establish a patch cadence.',
    effort: 'medium',
    impact: 'high',
  },
  {
    match: /exposed|directory listing|backup|\.git|\.env/i,
    fix: 'Remove the exposed artifact from the web root; block sensitive paths at the edge.',
    effort: 'low',
    impact: 'medium',
  },
  {
    match: /open redirect/i,
    fix: 'Validate redirect targets against an allowlist; use relative URLs.',
    effort: 'low',
    impact: 'low',
  },
];

export const GENERIC_FIX = {
  fix: 'Investigate the finding, confirm exploitability in a safe test environment, and remediate per vendor/framework security guidance.',
  effort: 'medium',
  impact: 'medium',
};

function now() {
  return new Date().toISOString();
}

/** Match a finding to catalog remediation entries. */
export function remediationFor(finding) {
  const hay = `${finding.title || ''} ${finding.description || ''} ${finding.templateId || ''}`;
  const hits = REMEDIATION_CATALOG.filter(c => c.match.test(hay));
  const base = hits.length ? hits : [GENERIC_FIX];
  const explicit = (finding.remediation || '').trim();
  return base.map(b => ({
    fix: explicit && !hits.length ? explicit : b.fix,
    detail: explicit && hits.length ? explicit : '',
    effort: b.effort,
    impact: b.impact,
    // Impact-per-effort: higher is better. Severity of the finding boosts impact.
    score: scoreFix(b, finding),
    findingTitle: finding.title,
    severity: finding.severity,
  }));
}

function scoreFix(entry, finding) {
  const sevW = SEVERITY_WEIGHT[String(finding.severity || 'informational').toLowerCase()] ?? 0.5;
  const impactW = { high: 3, medium: 2, low: 1 }[entry.impact] ?? 2;
  const effortC = EFFORT_COST[entry.effort] ?? 2;
  return Number(((sevW + impactW) / effortC).toFixed(2));
}

/**
 * Live hunt report.
 */
export class LiveReport {
  /**
   * @param {object} opts — { huntId, target, dataDir, logger }
   */
  constructor({ huntId, target = '', dataDir = DEFAULT_DATA_DIR, logger = console } = {}) {
    if (!huntId) throw new Error('LiveReport requires huntId');
    this.huntId = String(huntId);
    this.target = String(target);
    this.dataDir = dataDir;
    this.logger = logger;
    this.findings = [];
    this.stages = [];
    this.startedAt = now();
    this.updatedAt = now();
    this._seen = new Set();
  }

  reportFile() {
    return path.join(this.dataDir, this.huntId, 'report.json');
  }

  /** Dedupe key: same weakness on the same target is one finding. */
  dedupeKey(f) {
    return `${String(f.title || '')
      .toLowerCase()
      .trim()}|${String(f.target || '')
      .toLowerCase()
      .trim()}`;
  }

  /**
   * Add a finding as it lands (planner or toolRunner). Deduplicates,
   * attaches ranked remediation, persists immediately.
   * @returns {Promise<object|null>} the stored finding, or null if duplicate
   */
  async addFinding(raw) {
    const finding = normalizeFinding(raw);
    const key = this.dedupeKey(finding);
    if (this._seen.has(key)) {
      // Merge new evidence into the existing finding instead of duplicating.
      const existing = this.findings.find(f => this.dedupeKey(f) === key);
      if (
        existing &&
        finding.evidence &&
        !existing.evidence.includes(finding.evidence.slice(0, 80))
      ) {
        existing.evidence = `${existing.evidence}\n${finding.evidence}`.slice(0, 3000);
        this.updatedAt = now();
        await this.save().catch(e => this.logger.warn?.(`[liveReport] save failed: ${e.message}`));
      }
      return null;
    }
    this._seen.add(key);
    finding.id = `f${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    finding.foundAt = now();
    finding.remediationSteps = remediationFor(finding);
    this.findings.push(finding);
    this.updatedAt = now();
    await this.save().catch(e => this.logger.warn?.(`[liveReport] save failed: ${e.message}`));
    return finding;
  }

  recordStage(stage) {
    this.stages.push({ ...stage, at: now() });
    this.updatedAt = now();
  }

  /** Recommended fixes ranked by impact-per-effort (highest value first). */
  rankedFixes() {
    const fixes = [];
    for (const f of this.findings) {
      for (const r of f.remediationSteps || []) fixes.push(r);
    }
    const deduped = [];
    const seen = new Set();
    for (const fix of fixes.sort((a, b) => b.score - a.score)) {
      const k = fix.fix.toLowerCase().slice(0, 80);
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(fix);
    }
    return deduped;
  }

  summary() {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
    for (const f of this.findings) {
      const s = String(f.severity).toLowerCase();
      if (counts[s] !== undefined) counts[s]++;
    }
    return {
      total: this.findings.length,
      ...counts,
      validated: this.findings.filter(f => f.confidence === 'high').length,
    };
  }

  /**
   * Shape the live report for services/pdfReportWriter.js buildReportPdf.
   * Safe to call mid-hunt: renders whatever has landed so far.
   */
  toPdfInput() {
    const fixes = this.rankedFixes();
    return {
      title: `Infinity AI Security Assessment — ${this.target}`,
      target: this.target,
      generatedAt: this.updatedAt,
      summary: this.summary(),
      executiveSummary:
        `Automated defensive assessment of ${this.target} by Infinity AI. ` +
        `${this.findings.length} finding(s) recorded so far. ` +
        `Recommended fixes are ranked by expected risk reduction per unit of effort.`,
      findings: this.findings.map(f => ({
        title: f.title,
        severity: f.severity,
        cvss: f.cvss || undefined,
        description: f.description,
        impact: `Severity: ${f.severity}. Confidence: ${f.confidence}.`,
        reproductionSteps: f.reproductionSteps || [
          'Observed during automated assessment (see evidence).',
        ],
        remediation: (f.remediationSteps || []).map(
          r =>
            `[${r.effort} effort / ${r.impact} impact] ${r.fix}${r.detail ? ` — ${r.detail}` : ''}`
        ),
        evidence: f.evidence ? [f.evidence] : [],
        poc: f.safeValidation || '',
      })),
      recommendedFixes: fixes.map((r, i) => ({
        rank: i + 1,
        fix: r.fix,
        effort: r.effort,
        impact: r.impact,
        score: r.score,
        relatedFinding: r.findingTitle,
      })),
      stages: this.stages,
    };
  }

  async save() {
    const dir = path.join(this.dataDir, this.huntId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.reportFile(),
      JSON.stringify(
        {
          huntId: this.huntId,
          target: this.target,
          product: 'Infinity AI',
          startedAt: this.startedAt,
          updatedAt: this.updatedAt,
          findings: this.findings,
          stages: this.stages,
        },
        null,
        2
      ),
      'utf8'
    );
  }

  /** Restore a live report from disk (resume). */
  static async load({ huntId, dataDir = DEFAULT_DATA_DIR, logger = console }) {
    const report = new LiveReport({ huntId, dataDir, logger });
    const raw = await fs.readFile(report.reportFile(), 'utf8');
    const data = JSON.parse(raw);
    report.target = data.target || '';
    report.startedAt = data.startedAt || report.startedAt;
    report.updatedAt = data.updatedAt || report.updatedAt;
    report.findings = data.findings || [];
    report.stages = data.stages || [];
    for (const f of report.findings) report._seen.add(report.dedupeKey(f));
    return report;
  }
}

const SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'informational']);

function normalizeFinding(raw = {}) {
  const severity = String(raw.severity || 'informational').toLowerCase();
  return {
    title: String(raw.title || 'Untitled finding').slice(0, 200),
    severity: SEVERITIES.has(severity) ? severity : 'informational',
    target: String(raw.target || raw.url || raw.host || '').slice(0, 200),
    description: String(raw.description || '').slice(0, 2000),
    evidence: String(raw.evidence || '').slice(0, 3000),
    remediation: String(raw.remediation || '').slice(0, 2000),
    confidence: ['high', 'medium', 'low'].includes(raw.confidence) ? raw.confidence : 'medium',
    templateId: raw.templateId ? String(raw.templateId).slice(0, 120) : undefined,
    safeValidation: String(raw.safeValidation || '').slice(0, 1000),
    source: String(raw.source || raw.kind || 'hunt').slice(0, 60),
  };
}

export default LiveReport;
