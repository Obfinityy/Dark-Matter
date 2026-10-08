/**
 * ExportSuite.jsx — Infinity AI · Dark-Matter · Wave 55
 * 19 working React components for the report-export suite, ideas 52182–52200.
 * Export-only module: components are not mounted anywhere.
 */
import React, { useState } from 'react';
import * as E from './exportCore.js';

const SAMPLE_HUNT = {
  id: 'hunt-77',
  target: 'shop.example.com',
  findings: [
    {
      id: 'f-101',
      title: 'Reflected XSS on /search',
      severity: 'high',
      status: 'open',
      vulnClass: 'xss',
      cwe: 'CWE-79',
      endpoint: '/search',
      target: 'shop',
      assignee: 'ria',
      confidence: 'high',
      description: 'User input is reflected without output encoding.',
      evidence: [
        {
          kind: 'http',
          summary: 'GET /search?q=<script>alert(1)</script>',
          body: 'raw request bytes',
        },
      ],
      poc: 'curl "https://shop.example.com/search?q=<script>alert(1)</script>"',
      remediation: 'Apply context-aware output encoding.',
    },
    {
      id: 'f-102',
      title: 'SQL injection on /login',
      severity: 'critical',
      status: 'open',
      vulnClass: 'sqli',
      cwe: 'CWE-89',
      endpoint: '/login',
      target: 'shop',
      assignee: 'dev',
      confidence: 'high',
      description: 'Login parameter is concatenated into the SQL query.',
      evidence: [{ kind: 'http', summary: "POST /login with ' OR 1=1--" }],
      poc: null,
      remediation: 'Use parameterized queries.',
    },
    {
      id: 'f-103',
      title: 'Missing security headers',
      severity: 'low',
      status: 'fixed',
      vulnClass: 'headers',
      cwe: null,
      endpoint: '/',
      target: 'blog',
      assignee: 'ops',
      confidence: 'medium',
      description: 'X-Content-Type-Options is not set.',
      evidence: [],
      poc: null,
      remediation: 'Set X-Content-Type-Options: nosniff.',
    },
  ],
};

/* 52182 — Executive-summary PDF export. */
export function ExecSummaryPdfExport() {
  const [model, setModel] = useState(null);
  return (
    <div className="ex55-card">
      <h3 className="ex55-title">52182 · Executive-summary PDF export</h3>
      <button className="ex55-btn" onClick={() => setModel(E.buildExecSummaryModel(SAMPLE_HUNT))}>
        Build summary model
      </button>
      {model && (
        <div className="ex55-note">
          <p>
            risk score {model.riskScore} · {model.totalFindings} findings ·{' '}
            {model.remediationStatus.remediated} remediated
          </p>
          <ul className="ex55-list">
            {model.topFindings.map(f => (
              <li key={f.id}>
                {f.id} · {f.title} [{f.severity}]
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* 52183 — Technical deep-dive PDF. */
export function DeepDivePdfExport() {
  const [model, setModel] = useState(null);
  return (
    <div className="ex55-card">
      <h3 className="ex55-title">52183 · Technical deep-dive PDF</h3>
      <button className="ex55-btn" onClick={() => setModel(E.buildDeepDiveModel(SAMPLE_HUNT))}>
        Build deep-dive model
      </button>
      {model && (
        <p className="ex55-note">
          {model.findings.length} findings with evidence · CWE refs:{' '}
          {model.findings.filter(f => f.cwe).length}
        </p>
      )}
    </div>
  );
}

/* 52184 — Per-finding PDF export. */
export function PerFindingPdfExport() {
  const [res, setRes] = useState(null);
  return (
    <div className="ex55-card">
      <h3 className="ex55-title">52184 · Per-finding PDF export</h3>
      <button
        className="ex55-btn"
        onClick={() => setRes(E.buildPerFindingModel(SAMPLE_HUNT.findings[0], SAMPLE_HUNT))}
      >
        Export f-101
      </button>
      {res && res.ok && (
        <p className="ex55-note">standalone model ready: {res.model.finding.title}</p>
      )}
    </div>
  );
}

/* 52185 — Evidence-free PDF variant. */
export function EvidenceFreePdfExport() {
  const [res, setRes] = useState(null);
  return (
    <div className="ex55-card">
      <h3 className="ex55-title">52185 · Evidence-free PDF variant</h3>
      <button
        className="ex55-btn"
        onClick={() => setRes(E.stripEvidenceForSharing(E.buildDeepDiveModel(SAMPLE_HUNT)))}
      >
        Strip evidence
      </button>
      {res && res.ok && (
        <p className="ex55-note">
          evidence redacted: {String(res.model.evidenceRedacted)} · payloads removed
        </p>
      )}
    </div>
  );
}

/* 52186 — Watermarked PDFs. */
export function WatermarkedPdfExport() {
  const [wm, setWm] = useState(null);
  return (
    <div className="ex55-card">
      <h3 className="ex55-title">52186 · Watermarked PDFs</h3>
      <button
        className="ex55-btn"
        onClick={() => setWm(E.watermarkDescriptor('Acme Corp — R. Kapoor'))}
      >
        Add watermark
      </button>
      {wm && wm.ok && (
        <p className="ex55-note ex55-watermark-preview">
          “{wm.watermark.text}” · opacity {wm.watermark.opacity}
        </p>
      )}
    </div>
  );
}

/* 52187 — Password-protected PDFs. */
export function PasswordProtectedPdfExport() {
  const [res, setRes] = useState(null);
  const [pw, setPw] = useState('correct-horse-92');
  return (
    <div className="ex55-card">
      <h3 className="ex55-title">52187 · Password-protected PDFs</h3>
      <input
        className="ex55-input"
        type="password"
        value={pw}
        onChange={e => setPw(e.target.value)}
      />
      <button
        className="ex55-btn"
        onClick={() => setRes(E.buildProtectionDescriptor(pw, { deliveryChannel: 'secure-vault' }))}
      >
        Protect PDF
      </button>
      {res && (
        <p className="ex55-note">
          {res.ok
            ? `${res.protection.algorithm} · password via ${res.protection.passwordDeliveredVia}`
            : `error: ${res.reason}`}
        </p>
      )}
    </div>
  );
}

/* 52188 — Digitally signed PDFs. */
export function DigitallySignedPdfExport() {
  const [res, setRes] = useState(null);
  const cert = {
    subject: 'CN=Infinity AI',
    issuer: 'CN=Infinity CA',
    expiresAt: Date.now() + 86400000,
  };
  return (
    <div className="ex55-card">
      <h3 className="ex55-title">52188 · Digitally signed PDFs</h3>
      <button
        className="ex55-btn"
        onClick={() => setRes(E.buildSignatureBlock(cert, 'sha256:9f2a…c4'))}
      >
        Sign PDF
      </button>
      {res && res.ok && (
        <p className="ex55-note">
          signed by {res.signature.signer} · valid: {String(res.signature.valid)}
        </p>
      )}
    </div>
  );
}

/* 52189 — Branded report letterhead. */
export function BrandedLetterheadExport() {
  const [res, setRes] = useState(null);
  const brand = {
    companyName: 'Acme Corp',
    primaryColor: '#0f766e',
    footer: 'Acme Corp · Security',
  };
  return (
    <div className="ex55-card">
      <h3 className="ex55-title">52189 · Branded report letterhead</h3>
      <button
        className="ex55-btn"
        onClick={() => setRes(E.applyLetterheadBrand(E.buildExecSummaryModel(SAMPLE_HUNT), brand))}
      >
        Apply brand
      </button>
      {res && res.ok && (
        <p className="ex55-note">
          letterhead: {res.model.letterhead.companyName} · {res.model.letterhead.primaryColor}
        </p>
      )}
    </div>
  );
}

/* 52190 — Versioned JSON full dump. */
export function VersionedJsonDump() {
  const [dump, setDump] = useState(null);
  return (
    <div className="ex55-card">
      <h3 className="ex55-title">52190 · Versioned JSON full dump</h3>
      <button
        className="ex55-btn"
        onClick={() => setDump(E.buildVersionedDump(SAMPLE_HUNT, 1700000000000))}
      >
        Build dump
      </button>
      {dump && (
        <p className="ex55-note">
          schema {dump.schema} · {dump.findings.length} findings
        </p>
      )}
    </div>
  );
}
/* 52191 — Per-finding JSON export. */
export function PerFindingJsonExport() {
  const [res, setRes] = useState(null);
  return (
    <div className="ex55-card">
      <h3 className="ex55-title">52191 · Per-finding JSON export</h3>
      <button
        className="ex55-btn"
        onClick={() => setRes(E.findingToJson(SAMPLE_HUNT.findings[1], SAMPLE_HUNT))}
      >
        Export f-102
      </button>
      {res && res.ok && (
        <p className="ex55-note">
          {res.json.schema} · {res.json.finding.id} · {res.json.finding.severity}
        </p>
      )}
    </div>
  );
}

/* 52192 — SIEM-ready JSON format. */
export function SiemJsonExport() {
  const [rows, setRows] = useState(null);
  return (
    <div className="ex55-card">
      <h3 className="ex55-title">52192 · SIEM-ready JSON format</h3>
      <button
        className="ex55-btn"
        onClick={() => setRows(E.flattenToSiem(SAMPLE_HUNT.findings, SAMPLE_HUNT))}
      >
        Flatten to ECS
      </button>
      {rows && (
        <ul className="ex55-list">
          {rows.map(r => (
            <li key={r['vulnerability.id']} className="ex55-mono">
              {r['vulnerability.id']} · {r['event.severity']} · {r['url.full']}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* 52193 — Findings CSV export. */
export function FindingsCsvExport() {
  const [out, setOut] = useState(null);
  return (
    <div className="ex55-card">
      <h3 className="ex55-title">52193 · Findings CSV export</h3>
      <button className="ex55-btn" onClick={() => setOut(E.findingsToCsv(SAMPLE_HUNT.findings))}>
        Export CSV
      </button>
      {out && <pre className="ex55-mono">{out.csv.split('\n').slice(0, 3).join('\n')}</pre>}
    </div>
  );
}

/* 52194 — Custom CSV column picker. */
export function CsvColumnPicker() {
  const [cols, setCols] = useState([...E.CSV_COLUMN_PRESETS.default]);
  const [preset, setPreset] = useState('default');
  const toggle = id => setCols(c => (c.includes(id) ? c.filter(x => x !== id) : [...c, id]));
  const applyPreset = name => {
    const r = E.applyColumnPreset(name);
    if (r.ok) {
      setCols(r.columns);
      setPreset(name);
    }
  };
  const out = E.findingsToCsv(SAMPLE_HUNT.findings, cols);
  return (
    <div className="ex55-card">
      <h3 className="ex55-title">52194 · Custom CSV column picker</h3>
      <div className="ex55-row">
        {Object.keys(E.CSV_COLUMN_PRESETS).map(p => (
          <button
            key={p}
            className={`ex55-btn ${preset === p ? '' : 'ex55-btn-ghost'}`}
            onClick={() => applyPreset(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="ex55-grid2">
        {E.CSV_COLUMNS.map(c => (
          <label key={c.id} className="ex55-check">
            <input type="checkbox" checked={cols.includes(c.id)} onChange={() => toggle(c.id)} />{' '}
            {c.label}
          </label>
        ))}
      </div>
      <p className="ex55-note">
        {out.columns.length} columns · {out.rows} rows
      </p>
    </div>
  );
}

/* 52195 — Excel pivot-ready CSV. */
export function PivotReadyCsvExport() {
  const [out, setOut] = useState(null);
  const withAssets = SAMPLE_HUNT.findings.map(f => ({
    ...f,
    assets: [f.target, `${f.target}-cdn`],
  }));
  return (
    <div className="ex55-card">
      <h3 className="ex55-title">52195 · Excel pivot-ready CSV</h3>
      <button className="ex55-btn" onClick={() => setOut(E.findingsToPivotCsv(withAssets))}>
        Build pivot CSV
      </button>
      {out && (
        <pre className="ex55-mono">
          {out.csv.split('\n').slice(0, 4).join('\n')}
          {'\n'}… {out.rows} data rows
        </pre>
      )}
    </div>
  );
}

/* 52196 — SARIF 2.1.0 export. */
export function SarifExport() {
  const [sarif, setSarif] = useState(null);
  return (
    <div className="ex55-card">
      <h3 className="ex55-title">52196 · SARIF 2.1.0 export</h3>
      <button className="ex55-btn" onClick={() => setSarif(E.buildSarif(SAMPLE_HUNT))}>
        Build SARIF
      </button>
      {sarif && (
        <div className="ex55-note">
          <p>
            SARIF {sarif.version} · {sarif.runs[0].results.length} results ·{' '}
            {sarif.runs[0].tool.driver.rules.length} rules
          </p>
          <ul className="ex55-list">
            {sarif.runs[0].results.map(r => (
              <li key={r.properties.findingId} className="ex55-mono">
                {r.ruleId} · {r.level}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* 52197 — Per-run SARIF files. */
export function PerRunSarifExport() {
  const [files, setFiles] = useState(null);
  const runs = [
    { id: 'run-a', findings: SAMPLE_HUNT.findings.slice(0, 2) },
    { id: 'run-b', findings: SAMPLE_HUNT.findings.slice(2) },
  ];
  return (
    <div className="ex55-card">
      <h3 className="ex55-title">52197 · Per-run SARIF files</h3>
      <button className="ex55-btn" onClick={() => setFiles(E.buildSarifPerRun(runs))}>
        Split per run
      </button>
      {files && (
        <ul className="ex55-list">
          {files.map(f => (
            <li key={f.runId} className="ex55-mono">
              {f.runId} → {f.sarif.runs[0].results.length} results
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* 52198 — GitHub code-scanning upload helper. */
export function CodeScanningUploadHelper() {
  const [pkg, setPkg] = useState(null);
  return (
    <div className="ex55-card">
      <h3 className="ex55-title">52198 · GitHub code-scanning upload helper</h3>
      <button
        className="ex55-btn"
        onClick={() =>
          setPkg(E.buildCodeScanningUploadPackage(E.buildSarif(SAMPLE_HUNT), 'acme/shop'))
        }
      >
        Build upload package
      </button>
      {pkg && pkg.ok && (
        <ol className="ex55-list">
          {pkg.package.instructions.map((s, i) => (
            <li key={i} className="ex55-note">
              {s}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* 52199 — HTML report export. */
export function HtmlReportExport() {
  const [res, setRes] = useState(null);
  return (
    <div className="ex55-card">
      <h3 className="ex55-title">52199 · HTML report export</h3>
      <button
        className="ex55-btn"
        onClick={() => setRes(E.renderHtmlReport(E.buildDeepDiveModel(SAMPLE_HUNT)))}
      >
        Render HTML
      </button>
      {res && res.ok && (
        <p className="ex55-note">
          self-contained HTML · {res.html.length} chars · {res.html.split('<details').length - 1}{' '}
          findings
        </p>
      )}
    </div>
  );
}

/* 52200 — Markdown report export (post-hunt). */
export function MarkdownReportExport() {
  const [res, setRes] = useState(null);
  return (
    <div className="ex55-card">
      <h3 className="ex55-title">52200 · Markdown report export</h3>
      <button
        className="ex55-btn"
        onClick={() => setRes(E.renderMarkdownReport(E.buildExecSummaryModel(SAMPLE_HUNT)))}
      >
        Render Markdown
      </button>
      {res && res.ok && (
        <pre className="ex55-mono">{res.markdown.split('\n').slice(0, 8).join('\n')}</pre>
      )}
    </div>
  );
}

/* Gallery wrapper: renders every export component in a grid. */
export function ExportSuiteGallery() {
  return (
    <div className="ex55-gallery">
      <ExecSummaryPdfExport />
      <DeepDivePdfExport />
      <PerFindingPdfExport />
      <EvidenceFreePdfExport />
      <WatermarkedPdfExport />
      <PasswordProtectedPdfExport />
      <DigitallySignedPdfExport />
      <BrandedLetterheadExport />
      <VersionedJsonDump />
      <PerFindingJsonExport />
      <SiemJsonExport />
      <FindingsCsvExport />
      <CsvColumnPicker />
      <PivotReadyCsvExport />
      <SarifExport />
      <PerRunSarifExport />
      <CodeScanningUploadHelper />
      <HtmlReportExport />
      <MarkdownReportExport />
    </div>
  );
}
