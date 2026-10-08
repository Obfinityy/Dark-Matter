/**
 * FindingsBoard — critical-first findings with plain-language explainer mode.
 *
 * Findings arrive pre-sorted (critical → high → medium → low → informational).
 * Each card shows severity, CVSS, category, affected endpoint, evidence count,
 * and remediation. "Explain like I'm new" toggles the plain-language
 * explainer: a jargon-free summary of what the bug means and why it matters.
 *
 * Props:
 *   findings   — array from GET /jobs/:id/findings
 *   loading
 *   explainer  — boolean; when true every card shows its plain explanation
 */
import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ChevronDown,
  FileText,
  Crosshair,
  Sparkles,
  Package,
  Loader2,
} from 'lucide-react';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'informational', 'info'];

function severityRank(severity) {
  const idx = SEVERITY_ORDER.indexOf(String(severity || '').toLowerCase());
  return idx === -1 ? 99 : idx;
}

function explainFinding(finding) {
  // Deterministic plain-language explainer — no model call, no invented
  // facts. It translates the structured fields into human language.
  const title = finding.title || finding.category || 'a finding';
  const sev = String(finding.severity || 'unknown').toLowerCase();
  const where = finding.affectedEndpoint || finding.affectedAsset || 'the target';
  const impact =
    sev === 'critical'
      ? 'an attacker could likely take meaningful control or steal sensitive data'
      : sev === 'high'
        ? 'an attacker could do real damage with moderate effort'
        : sev === 'medium'
          ? 'an attacker could misuse this under the right conditions'
          : 'this is mostly worth knowing about for defense-in-depth';
  const evidence = (finding.evidence && finding.evidence.length) || 0;
  return (
    `The agent confirmed "${title}" on ${where}. ` +
    `In plain terms: ${impact}. ` +
    (evidence
      ? `This isn't a guess — the agent captured ${evidence} piece${evidence === 1 ? '' : 's'} of evidence proving it works. `
      : `The agent validated the behavior directly during the hunt. `) +
    (finding.remediation
      ? `The fix: ${finding.remediation}`
      : 'Check the detailed report for the recommended fix.')
  );
}

export function FindingsBoard({ findings = [], loading = false, explainer = false }) {
  const [openId, setOpenId] = useState(null);
  const [explainAll, setExplainAll] = useState(explainer);

  useEffect(() => setExplainAll(explainer), [explainer]);

  const sorted = [...findings].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const counts = {};
  sorted.forEach(f => {
    const s = String(f.severity || 'unknown').toLowerCase();
    counts[s] = (counts[s] || 0) + 1;
  });

  if (loading)
    return (
      <div className="dm-findings-loading" role="status" aria-live="polite">
        <Loader2 size={18} className="dm-spin" aria-hidden="true" /> Loading findings…
      </div>
    );

  if (!sorted.length) {
    return (
      <div className="dm-findings-empty">
        <ShieldAlert size={22} aria-hidden="true" />
        <p>
          No confirmed findings yet. The agent files a finding only when it has evidence — not on
          suspicion.
        </p>
      </div>
    );
  }

  return (
    <div className="dm-findings">
      <div className="dm-findings-bar">
        <div className="dm-sev-chips">
          {['critical', 'high', 'medium', 'low'].map(sev =>
            counts[sev] ? (
              <span key={sev} className={`dm-sev-chip sev-${sev}`}>
                {counts[sev]} {sev}
              </span>
            ) : null
          )}
          <span className="dm-findings-total">{sorted.length} confirmed</span>
        </div>
        <button
          className={`dm-btn-ghost ${explainAll ? 'active' : ''}`}
          onClick={() => setExplainAll(v => !v)}
          aria-pressed={explainAll}
          title="Plain-language explanations for every finding"
        >
          <Sparkles size={14} /> Explain like I'm new
        </button>
      </div>

      <div className="dm-finding-list">
        {sorted.map((finding, i) => {
          const sev = String(finding.severity || 'unknown').toLowerCase();
          const open = openId === finding.id;
          const evidenceCount = (finding.evidence && finding.evidence.length) || 0;
          return (
            <div
              key={finding.id || `${sev}-${i}`}
              className={`dm-finding sev-${sev} ${open ? 'open' : ''}`}
              style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}
            >
              <button
                className="dm-finding-head"
                onClick={() => setOpenId(open ? null : finding.id)}
                aria-expanded={open}
                aria-controls={`finding-body-${finding.id}`}
              >
                <span className={`dm-sev-badge sev-${sev}`}>{sev}</span>
                <span className="dm-finding-title">
                  {finding.title || finding.category || 'Untitled finding'}
                </span>
                {finding.cvssMetrics?.baseScore != null && (
                  <span className="dm-cvss">
                    CVSS {Number(finding.cvssMetrics.baseScore).toFixed(1)}
                  </span>
                )}
                <ChevronDown
                  size={15}
                  className={`dm-chev ${open ? 'open' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {(open || explainAll) && (
                <div
                  className="dm-finding-body"
                  id={`finding-body-${finding.id}`}
                  role="region"
                  aria-label={finding.title || finding.category || 'Finding details'}
                >
                  {explainAll && (
                    <p className="dm-finding-explainer">
                      <Sparkles size={13} aria-hidden="true" /> {explainFinding(finding)}
                    </p>
                  )}
                  {open && (
                    <>
                      <div className="dm-finding-meta">
                        {finding.category && (
                          <span>
                            <Crosshair size={12} aria-hidden="true" /> {finding.category}
                          </span>
                        )}
                        {(finding.affectedEndpoint || finding.affectedAsset) && (
                          <span>
                            <FileText size={12} aria-hidden="true" />{' '}
                            {finding.affectedEndpoint || finding.affectedAsset}
                          </span>
                        )}
                        {evidenceCount > 0 && (
                          <span>
                            <Package size={12} aria-hidden="true" /> {evidenceCount} evidence
                          </span>
                        )}
                        {finding.confidence != null && (
                          <span>confidence {Math.round(finding.confidence * 100)}%</span>
                        )}
                      </div>
                      {finding.description && (
                        <p className="dm-finding-desc">{finding.description}</p>
                      )}
                      {finding.impact && (
                        <p className="dm-finding-impact">
                          <strong>Impact:</strong> {finding.impact}
                        </p>
                      )}
                      {finding.reproductionSteps?.length > 0 && (
                        <div className="dm-finding-repro">
                          <strong>Reproduction</strong>
                          <ol>
                            {finding.reproductionSteps.map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {finding.remediation && (
                        <p className="dm-finding-fix">
                          <strong>Fix:</strong> {finding.remediation}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
