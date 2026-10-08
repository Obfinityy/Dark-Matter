/**
 * ExportFormats.jsx — Infinity AI · Dark-Matter · Wave 56
 * 20 working React components for report-export formats, ideas 52201–52220.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React, { useState } from 'react';
import * as E from './exportFormatsCore.js';

const SAMPLE_HUNT = {
  id: 'hunt-99',
  target: 'api.example.com',
  findings: [
    {
      id: 'f-201',
      title: 'Reflected XSS on /search',
      severity: 'high',
      status: 'open',
      vulnClass: 'xss',
      cwe: 'CWE-79',
      target: 'api',
      assignee: 'ria',
      confidence: 'high',
      description: 'User input reflected without output encoding.',
      evidence: [
        { kind: 'http', summary: 'GET /search?q=<script>alert(1)</script>', body: 'raw bytes' },
      ],
      poc: 'curl "https://api.example.com/search?q=<script>alert(1)</script>"',
      pocPython: 'import requests\nprint(requests.get("https://api.example.com/search?q=x").text)',
      remediation: 'Apply context-aware output encoding.',
      createdAt: 1700000000000,
      updatedAt: 1700000100000,
    },
    {
      id: 'f-202',
      title: 'SQL injection on /login',
      severity: 'critical',
      status: 'open',
      vulnClass: 'sqli',
      cwe: 'CWE-89',
      target: 'api',
      assignee: 'dev',
      confidence: 'high',
      description: 'Login parameter concatenated into SQL.',
      evidence: [{ kind: 'http', summary: "POST /login with ' OR 1=1--" }],
      poc: 'curl -d "u=\' OR 1=1--" https://api.example.com/login',
      pocPython: null,
      remediation: 'Use parameterized queries.',
      createdAt: 1700000200000,
      updatedAt: 1700000300000,
    },
    {
      id: 'f-203',
      title: 'Verbose error leak',
      severity: 'low',
      status: 'fixed',
      vulnClass: 'info',
      cwe: null,
      target: 'blog',
      assignee: 'ops',
      confidence: 'medium',
      description: 'Stack trace disclosed in 500 page.',
      evidence: [],
      poc: null,
      remediation: 'Disable debug errors in prod.',
      createdAt: 1700000400000,
      updatedAt: 1700000500000,
    },
  ],
};

/* 52201 — DOCX report export. */
export function DocxReportExport() {
  const [res, setRes] = useState(null);
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52201 · DOCX report export</h3>
      <button
        className="exf56-btn"
        onClick={() => setRes(E.buildDocxModel(SAMPLE_HUNT, 1700000000000))}
      >
        Build DOCX model
      </button>
      {res && res.ok && (
        <p className="exf56-note">
          {res.docx.sections.length} sections · editable: {String(res.docx.editable)} · target{' '}
          {res.docx.target}
        </p>
      )}
    </div>
  );
}

/* 52202 — Nessus-style XML export. */
export function NessusXmlExport() {
  const [res, setRes] = useState(null);
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52202 · Nessus-style XML export</h3>
      <button
        className="exf56-btn"
        onClick={() => setRes(E.buildNessusXml(SAMPLE_HUNT, 1700000000000))}
      >
        Build Nessus XML
      </button>
      {res && res.ok && (
        <pre className="exf56-mono">
          {res.xml.split('\n').slice(0, 6).join('\n')}
          {'\n'}… {res.hostCount} hosts
        </pre>
      )}
    </div>
  );
}

/* 52203 — JUnit XML for CI. */
export function JUnitXmlExport() {
  const [res, setRes] = useState(null);
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52203 · JUnit XML for CI</h3>
      <button
        className="exf56-btn"
        onClick={() => setRes(E.buildJUnitXml(SAMPLE_HUNT, 1700000000000))}
      >
        Build JUnit XML
      </button>
      {res && res.ok && (
        <p className="exf56-note">
          {res.tests} tests · {res.failures} failures (CI gates on high+)
        </p>
      )}
    </div>
  );
}

/* 52204 — Filtered-subset export. */
export function FilteredSubsetExport() {
  const [res, setRes] = useState(null);
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52204 · Filtered-subset export</h3>
      <button
        className="exf56-btn"
        onClick={() =>
          setRes(
            E.selectFilteredSubset(SAMPLE_HUNT.findings, { severity: ['critical'], status: 'open' })
          )
        }
      >
        Open criticals only
      </button>
      {res && res.ok && (
        <ul className="exf56-list">
          {res.subset.map(f => (
            <li key={f.id} className="exf56-mono">
              {f.id} · {f.title}
            </li>
          ))}
          <li className="exf56-note">
            {res.subset.length}/{res.total} matched
          </li>
        </ul>
      )}
    </div>
  );
}

/* 52205 — Selected-findings-only export. */
export function SelectedOnlyExport() {
  const [sel, setSel] = useState(['f-201', 'f-203']);
  const res = E.exportSelectedOnly(SAMPLE_HUNT.findings, sel);
  const toggle = id => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52205 · Selected-findings-only export</h3>
      {SAMPLE_HUNT.findings.map(f => (
        <label key={f.id} className="exf56-check">
          <input type="checkbox" checked={sel.includes(f.id)} onChange={() => toggle(f.id)} />{' '}
          {f.id}
        </label>
      ))}
      <p className="exf56-note">{res.ok ? res.findings.map(f => f.id).join(', ') : res.reason}</p>
    </div>
  );
}

/* 52206 — Triage-state-aware export. */
export function TriageAwareExport() {
  const [res, setRes] = useState(null);
  const triage = {
    'f-201': { decision: 'confirmed', reviewer: 'ria', decidedAt: 1700000100000 },
    'f-202': { decision: 'confirmed', reviewer: 'lead', decidedAt: 1700000200000 },
  };
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52206 · Triage-state-aware export</h3>
      <button
        className="exf56-btn"
        onClick={() => setRes(E.enrichWithTriage(SAMPLE_HUNT.findings, triage))}
      >
        Enrich with triage
      </button>
      {res && res.ok && (
        <ul className="exf56-list">
          {res.findings.map(f => (
            <li key={f.id} className="exf56-note">
              {f.id} · {f.triage.decision} by {f.triage.reviewer || '—'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* 52207 — FP-reason-inclusive export. */
export function FpReasonExport() {
  const [res, setRes] = useState(null);
  const dismissed = [
    {
      id: 'f-099',
      title: 'Rate-limit probe',
      severity: 'low',
      fpReason: 'WAF blocks all payloads; not exploitable',
      dismissedBy: 'ria',
      dismissedAt: 1700000000000,
    },
  ];
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52207 · FP-reason-inclusive export</h3>
      <button className="exf56-btn" onClick={() => setRes(E.buildFpAppendix(dismissed))}>
        Build FP appendix
      </button>
      {res && res.ok && (
        <p className="exf56-note">
          {res.appendix.count} dismissed:{' '}
          {res.appendix.entries.map(e => `${e.id} — ${e.reason}`).join(' · ')}
        </p>
      )}
    </div>
  );
}

/* 52208 — Remediation-status export. */
export function RemediationStatusExport() {
  const [res, setRes] = useState(null);
  const statusMap = {
    'f-203': { state: 'verified-fixed', assignee: 'ops', verification: 'retest-pass' },
  };
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52208 · Remediation-status export</h3>
      <button
        className="exf56-btn"
        onClick={() => setRes(E.enrichRemediationStatus(SAMPLE_HUNT.findings, statusMap))}
      >
        Attach fix state
      </button>
      {res && res.ok && (
        <ul className="exf56-list">
          {res.findings.map(f => (
            <li key={f.id} className="exf56-note">
              {f.id} · {f.remediationStatus.state} · {f.remediationStatus.assignee || 'unassigned'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* 52209 — Scheduled exports (post-hunt). */
export function ScheduledExports() {
  const [res, setRes] = useState(null);
  const schedules = [
    { id: 's-1', name: 'Weekly CSV to GRC', nextRunAt: 1699999999000 },
    { id: 's-2', name: 'Monthly PDF', nextRunAt: 1700086400000 },
  ];
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52209 · Scheduled exports (post-hunt)</h3>
      <button
        className="exf56-btn"
        onClick={() => setRes(E.evaluateSchedule(schedules, 1700000000000))}
      >
        Evaluate schedule
      </button>
      {res && res.ok && (
        <p className="exf56-note">
          due: {res.due.map(s => s.name).join(', ') || 'none'} · next:{' '}
          {res.upcoming[0] ? res.upcoming[0].name : 'none'}
        </p>
      )}
    </div>
  );
}

/* 52210 — Export to S3 / Google Drive. */
export function CloudDeliveryExport() {
  const [res, setRes] = useState(null);
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52210 · Export to S3 / Google Drive</h3>
      <div className="exf56-row">
        <button
          className="exf56-btn"
          onClick={() =>
            setRes(
              E.buildDeliveryDescriptor({
                kind: 's3',
                bucket: 'inf-reports',
                key: 'hunt-99/report.pdf',
              })
            )
          }
        >
          S3 target
        </button>
        <button
          className="exf56-btn exf56-btn-ghost"
          onClick={() =>
            setRes(
              E.buildDeliveryDescriptor({
                kind: 'drive',
                folderId: 'fld-1',
                filename: 'report.pdf',
              })
            )
          }
        >
          Drive target
        </button>
      </div>
      {res && (
        <p className="exf56-note">
          {res.ok
            ? `${res.descriptor.kind} → ${res.descriptor.bucket || res.descriptor.folderId}`
            : `error: ${res.reason}`}
        </p>
      )}
    </div>
  );
}

/* 52211 — Export API endpoint. */
export function ExportApiDescriptor() {
  const [res, setRes] = useState(null);
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52211 · Export API endpoint</h3>
      <button
        className="exf56-btn"
        onClick={() =>
          setRes(
            E.buildApiExportRequest({
              format: 'pdf',
              huntId: 'hunt-99',
              filter: { severity: ['critical'] },
              redacted: true,
            })
          )
        }
      >
        Build API request
      </button>
      {res && res.ok && (
        <pre className="exf56-mono">
          {res.request.method} {res.request.path}
          {'\n'}
          {JSON.stringify(res.request.body, null, 1)}
        </pre>
      )}
    </div>
  );
}

/* 52212 — Export templates (post-hunt). */
export function ExportTemplates() {
  const [store, setStore] = useState({});
  const [applied, setApplied] = useState(null);
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52212 · Export templates (post-hunt)</h3>
      <div className="exf56-row">
        <button
          className="exf56-btn"
          onClick={() => {
            const r = E.templateStore(store, {
              type: 'save',
              name: 'client-pdf',
              config: { format: 'pdf', redacted: false },
              now: 1700000000000,
            });
            if (r.ok) setStore(r.templates);
          }}
        >
          Save template
        </button>
        <button
          className="exf56-btn exf56-btn-ghost"
          onClick={() => {
            const r = E.templateStore(store, { type: 'apply', name: 'client-pdf' });
            if (r.ok) setApplied(r.config);
          }}
        >
          Apply
        </button>
      </div>
      <p className="exf56-note">
        templates: {E.templateStore(store, { type: 'list' }).names.join(', ') || 'none'}
        {applied && ` · applied format=${applied.format}`}
      </p>
    </div>
  );
}

/* 52213 — Multi-language exports. */
export function MultiLanguageExports() {
  const [lang, setLang] = useState('hi');
  const res = E.buildLanguageDescriptor(lang);
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52213 · Multi-language exports</h3>
      <div className="exf56-row">
        {E.EXPORT_LANGUAGES.map(l => (
          <button
            key={l}
            className={`exf56-btn ${lang === l ? '' : 'exf56-btn-ghost'}`}
            onClick={() => setLang(l)}
          >
            {l}
          </button>
        ))}
      </div>
      <p className="exf56-note">
        {res.ok ? `template key ${res.language.templateKey}` : res.reason}
      </p>
    </div>
  );
}

/* 52214 — Redacted export mode. */
export function RedactedExportMode() {
  const [res, setRes] = useState(null);
  const raw =
    'Evidence from api.example.com — contact analyst@corp.test, token sk_live_4f6a9b2c8d7e1f3a5b6c, payload <script>alert(1)</script>';
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52214 · Redacted export mode</h3>
      <button className="exf56-btn" onClick={() => setRes(E.redactForExport(raw))}>
        Redact
      </button>
      {res && (
        <pre className="exf56-mono">
          {res.text}
          {'\n'}redacted: {res.redactions.join(', ')}
        </pre>
      )}
    </div>
  );
}

/* 52215 — Severity-threshold export. */
export function SeverityThresholdExport() {
  const [th, setTh] = useState('medium');
  const res = E.filterBySeverityThreshold(SAMPLE_HUNT.findings, th);
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52215 · Severity-threshold export</h3>
      <div className="exf56-row">
        {['low', 'medium', 'high', 'critical'].map(t => (
          <button
            key={t}
            className={`exf56-btn ${th === t ? '' : 'exf56-btn-ghost'}`}
            onClick={() => setTh(t)}
          >
            {t}+
          </button>
        ))}
      </div>
      <p className="exf56-note">
        kept {res.kept}/{res.total} findings
      </p>
    </div>
  );
}

/* 52216 — Delta export (new since last). */
export function DeltaExport() {
  const [res, setRes] = useState(null);
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52216 · Delta export (new since last)</h3>
      <button
        className="exf56-btn"
        onClick={() => setRes(E.selectDelta(SAMPLE_HUNT.findings, 1700000150000))}
      >
        Select delta
      </button>
      {res && res.ok && (
        <p className="exf56-note">
          {res.count} new/changed: {res.findings.map(f => f.id).join(', ')}
        </p>
      )}
    </div>
  );
}

/* 52217 — PoC bundle ZIP export. */
export function PocBundleExport() {
  const [res, setRes] = useState(null);
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52217 · PoC bundle ZIP export</h3>
      <button
        className="exf56-btn"
        onClick={() => setRes(E.buildPocZipManifest(SAMPLE_HUNT.findings, 1700000000000))}
      >
        Build ZIP manifest
      </button>
      {res && res.ok && (
        <p className="exf56-note">
          {res.manifest.archive} · {res.manifest.files.length} PoCs · skipped{' '}
          {res.manifest.skippedWithoutPoc}
        </p>
      )}
    </div>
  );
}

/* 52218 — Evidence attachments export. */
export function EvidenceAttachmentsExport() {
  const [res, setRes] = useState(null);
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52218 · Evidence attachments export</h3>
      <button
        className="exf56-btn"
        onClick={() => setRes(E.buildEvidenceManifest(SAMPLE_HUNT.findings))}
      >
        Build manifest
      </button>
      {res && res.ok && (
        <pre className="exf56-mono">
          {res.csv.split('\n').slice(0, 3).join('\n')}
          {'\n'}… {res.manifest.total} attachments
        </pre>
      )}
    </div>
  );
}

/* 52219 — Audit-log export (post-hunt). */
export function AuditLogExport() {
  const [res, setRes] = useState(null);
  const events = [
    { at: 1700000000000, actor: 'ria', action: 'triage.confirmed', target: 'f-201' },
    { at: 1700000100000, actor: 'lead', action: 'export.requested', target: 'hunt-99' },
  ];
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52219 · Audit-log export (post-hunt)</h3>
      <button className="exf56-btn" onClick={() => setRes(E.exportAuditLog(events, 1700000000000))}>
        Export audit log
      </button>
      {res && res.ok && <pre className="exf56-mono">{res.csv}</pre>}
    </div>
  );
}

/* 52220 — Comment-thread export. */
export function CommentThreadExport() {
  const [res, setRes] = useState(null);
  const threads = [
    {
      findingId: 'f-201',
      comments: [
        { author: 'ria', at: 1700000000000, body: 'Confirmed on staging.' },
        { author: 'dev', at: 1700000100000, body: 'Fix in review.' },
      ],
    },
    {
      findingId: 'f-202',
      comments: [{ author: 'lead', at: 1700000200000, body: 'Needs PoC before client call.' }],
    },
  ];
  return (
    <div className="exf56-card">
      <h3 className="exf56-title">52220 · Comment-thread export</h3>
      <button className="exf56-btn" onClick={() => setRes(E.exportCommentThreads(threads))}>
        Export threads
      </button>
      {res && res.ok && (
        <p className="exf56-note">
          {res.threads.length} threads · {res.totalComments} comments preserved
        </p>
      )}
    </div>
  );
}

/* Gallery wrapper: renders every format component in a grid. */
export function ExportFormatsGallery() {
  return (
    <div className="exf56-gallery">
      <DocxReportExport />
      <NessusXmlExport />
      <JUnitXmlExport />
      <FilteredSubsetExport />
      <SelectedOnlyExport />
      <TriageAwareExport />
      <FpReasonExport />
      <RemediationStatusExport />
      <ScheduledExports />
      <CloudDeliveryExport />
      <ExportApiDescriptor />
      <ExportTemplates />
      <MultiLanguageExports />
      <RedactedExportMode />
      <SeverityThresholdExport />
      <DeltaExport />
      <PocBundleExport />
      <EvidenceAttachmentsExport />
      <AuditLogExport />
      <CommentThreadExport />
    </div>
  );
}
