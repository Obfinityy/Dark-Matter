// Findings block — the confirmed-vulnerabilities list (flat, or grouped
// by route for whole-site hunts) plus unverified leads, extracted from
// HuntCard.jsx (P6).
//
// 100% truth rule: only VERIFIED findings are shown as vulnerabilities.
// Unverified leads are hypotheses, not vulnerabilities — they are NEVER
// given a verified badge. But they ARE shown (27 Oct 2026, live-report
// fix): before this change a hunt with 0 verified findings showed only
// the bare count "N leads under investigation" with no title, severity
// or evidence — the owner could not see any report building live. Leads
// now render as lead rows (title + severity + evidence snippet + "under
// investigation" badge) while the verified list above stays verified-only.
import React, { useMemo } from 'react';
import { groupFindingsByRoute } from '../../lib/routeGroup';

const SEVERITY_CLASS = {
  critical: 'sev-critical',
  high: 'sev-high',
  medium: 'sev-medium',
  low: 'sev-low',
};

// P0 (31 Oct 2026): probe/test names must never count as verified
// findings, even if the backend stamped verified:true (defense in
// depth — the backend guard is primary). A title starting with
// "probe_" (or matching test-name patterns) is a probe note, not a
// vulnerability.
function isProbeName(t) {
  const s = String(t || '').trim().toLowerCase();
  return /^probe[_-]/.test(s) || /[_-]probe([_-]|$)/.test(s) || /[_-]test([_-]|$)/.test(s) || /^test[_-]/.test(s);
}

export default function HuntFindings({ findings, hunt, isSiteScope, onSelectFinding }) {
  const verifiedFindings = findings.filter((f) => f && f.verified === true && !isProbeName(f.title));
  // Deduplicate by normalized title — the same vulnerability verified
  // twice (e.g. sql_injection_login filed @345 and @453) must count as
  // ONE unique finding, not two events.
  const uniqueVerifiedFindings = [];
  const seenTitles = new Set();
  for (const f of verifiedFindings) {
    const norm = String(f.title || '').toLowerCase().replace(/[_\-\s]+/g, ' ').trim();
    if (!norm || seenTitles.has(norm)) continue;
    seenTitles.add(norm);
    uniqueVerifiedFindings.push(f);
  }
  const unverifiedFindings = findings.filter((f) => f && f.verified !== true);
  const unverifiedCount = unverifiedFindings.length;

  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0 };
    uniqueVerifiedFindings.forEach((f) => {
      if (c[f.severity] !== undefined) c[f.severity] += 1;
      else c.low += 1;
    });
    return c;
  }, [uniqueVerifiedFindings]);

  const totalFindings = uniqueVerifiedFindings.length;

  // FINDINGS BY ROUTE (9 Nov 2026, /* scope): a whole-site hunt
  // groups its findings under the route each was found on, so the
  // panel answers "which route had what". Page-scope hunts keep the
  // flat list. The route comes from the panel row's url (the backend
  // carries the verified stamp's URL on the row); rows without one
  // group under the hunt target.
  const verifiedByRoute = isSiteScope ? groupFindingsByRoute(uniqueVerifiedFindings, hunt.target) : null;
  const leadsByRoute = isSiteScope ? groupFindingsByRoute(unverifiedFindings, hunt.target) : null;

  // Row renderers shared by the flat list and the per-route groups —
  // row content is unchanged in both layouts.
  const verifiedRow = (f, idx) => (
    <li key={idx} className="finding-item">
      {/* FINDING DETAIL (28 Oct 2026): rows are buttons —
          clicking one opens the detail modal for that
          title. Row content is unchanged. */}
      <button
        type="button"
        className={`finding finding-row ${SEVERITY_CLASS[f.severity] || 'sev-low'}`}
        onClick={() => onSelectFinding(f.title)}
        title={`View detail — ${f.title}`}
        aria-label={`View detail for ${f.title}`}
      >
        <span className="finding-sev">{f.severity}</span>
        <span className="finding-title">{f.title}</span>
        <span className="finding-badge finding-verified" title={f.verification || 'Verified'}>
          ✓ verified
        </span>
        <span className="finding-view-hint" aria-hidden="true">View detail →</span>
        {f.detail && <span className="finding-detail">{f.detail}</span>}
      </button>
    </li>
  );
  const leadRow = (f, idx) => (
    <li key={`lead-${idx}`} className="finding-item">
      <button
        type="button"
        className={`finding finding-row finding-lead ${SEVERITY_CLASS[f.severity] || 'sev-low'}`}
        onClick={() => onSelectFinding(f.title)}
        title={`View detail — ${f.title}`}
        aria-label={`View detail for ${f.title}`}
      >
        <span className="finding-sev">{f.severity}</span>
        <span className="finding-title">{f.title}</span>
        <span className="finding-badge finding-unverified" title={f.verification || 'Under investigation'}>
          under investigation
        </span>
        <span className="finding-view-hint" aria-hidden="true">View detail →</span>
        {f.detail && <span className="finding-detail">{f.detail}</span>}
      </button>
    </li>
  );

  if (totalFindings === 0 && unverifiedCount === 0) return null;

  return (
    <div className="hunt-findings-block">
      <div className="hunt-findings-title">
        {totalFindings > 0 ? 'Confirmed vulnerabilities' : 'Vulnerabilities'}
        {counts.critical > 0 && <span className="sev sev-critical">{counts.critical} critical</span>}
        {counts.high > 0 && <span className="sev sev-high">{counts.high} high</span>}
        {counts.medium > 0 && <span className="sev sev-medium">{counts.medium} medium</span>}
        {counts.low > 0 && <span className="sev sev-low">{counts.low} low</span>}
      </div>
      {totalFindings === 0 && (
        <div className="hunt-no-confirmed">
          No confirmed vulnerabilities yet
          {unverifiedCount > 0 && ` — ${unverifiedCount} lead${unverifiedCount === 1 ? '' : 's'} under investigation`}
          .
        </div>
      )}
      {totalFindings > 0 && !isSiteScope && (
      <ul className="findings-list">
        {uniqueVerifiedFindings.map((f, idx) => verifiedRow(f, idx))}
      </ul>
      )}
      {totalFindings > 0 && isSiteScope && verifiedByRoute.map((g) => (
        <div key={g.route} className="findings-route-group">
          <div className="findings-route-title">{g.route}</div>
          <ul className="findings-list">
            {g.findings.map((f, idx) => verifiedRow(f, `${g.route}-${idx}`))}
          </ul>
        </div>
      ))}
      {unverifiedCount > 0 && !isSiteScope && (
      <ul className="findings-list findings-leads">
        {unverifiedFindings.map((f, idx) => leadRow(f, idx))}
      </ul>
      )}
      {unverifiedCount > 0 && isSiteScope && leadsByRoute.map((g) => (
        <div key={g.route} className="findings-route-group">
          <div className="findings-route-title">{g.route}</div>
          <ul className="findings-list findings-leads">
            {g.findings.map((f, idx) => leadRow(f, `${g.route}-${idx}`))}
          </ul>
        </div>
      ))}
    </div>
  );
}
