/**
 * FindingCards2.jsx — Forge wave 4, ideas 50141–50160.
 *
 * List-level + advanced card features: drag reorder, print mode, similar rows,
 * discovery meta, CVSS chip, FP dismiss flow, highlighted evidence, copy-PoC,
 * lightbox, hover peek, severity mini-bar, reviewer checkmark, remediation
 * checklist, retest button, param chip, OWASP badge, replay dot, reasoning.
 */
import React from 'react';
import './FindingCards2.css';
import { FC_SEVERITY, FindingCard } from './FindingCards';

/** 50141 — Drag-to-reorder cards (custom sort mode only). */
export function DragToReorderList({
  items = [],
  onReorder,
  renderItem,
  sortMode = 'custom',
  className = '',
}) {
  const [order, setOrder] = React.useState(items.map((_, i) => i));
  const [dragIdx, setDragIdx] = React.useState(null);
  React.useEffect(() => {
    setOrder(items.map((_, i) => i));
  }, [items.length]);
  const draggable = sortMode === 'custom';
  const drop = targetPos => {
    if (dragIdx === null || dragIdx === targetPos) return;
    const next = order.filter((_, p) => p !== dragIdx);
    next.splice(targetPos, 0, order[dragIdx]);
    setOrder(next);
    setDragIdx(null);
    if (onReorder) onReorder(next.map(oi => items[oi]));
  };
  return (
    <div className={`fc2-reorder ${className}`} role="list" aria-label="Findings, drag to reorder">
      {order.map((oi, pos) => (
        <div
          key={items[oi]?.id || oi}
          role="listitem"
          draggable={draggable}
          onDragStart={() => setDragIdx(pos)}
          onDragOver={e => {
            if (draggable) e.preventDefault();
          }}
          onDrop={() => drop(pos)}
          onDragEnd={() => setDragIdx(null)}
          className={`fc2-reorder-item ${draggable ? 'fc2-draggable' : ''} ${dragIdx === pos ? 'fc2-dragging' : ''}`}
          aria-grabbed={draggable && dragIdx === pos}
        >
          {renderItem ? renderItem(items[oi], oi) : null}
        </div>
      ))}
    </div>
  );
}

/** 50142 — Print-friendly mode toggle (hides actions, compacts cards). */
export function PrintModeToggle({ printMode = false, onChange, className = '' }) {
  return (
    <button
      type="button"
      className={`fc2-print-toggle ${className}`}
      onClick={() => onChange && onChange(!printMode)}
      aria-pressed={printMode}
    >
      <span aria-hidden="true">🖨</span> {printMode ? 'Exit print view' : 'Print view'}
    </button>
  );
}

/** 50143 — Similar-findings row linking related findings. */
export function SimilarFindingsRow({ related = [], onOpen, className = '' }) {
  if (!related.length) return null;
  return (
    <div className={`fc2-similar ${className}`}>
      <span className="fc2-similar-label">similar to</span>
      {related.map(r => (
        <button
          key={r.id}
          type="button"
          className="fc2-similar-chip"
          onClick={() => onOpen && onOpen(r.id)}
          title={r.title}
        >
          {r.id}
        </button>
      ))}
    </div>
  );
}

/** 50144 — Discovery meta line: "found during Testing · 14:32". */
export function DiscoveryMetaLine({ phase = '', at = 0, className = '' }) {
  const time =
    at > 0 ? new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <span className={`fc2-meta ${className}`}>
      found during {phase || 'hunt'}
      {time ? ` · ${time}` : ''}
    </span>
  );
}

const CVSS_METRICS = {
  AV: { N: 'Network', A: 'Adjacent', L: 'Local', P: 'Physical' },
  AC: { L: 'Low', H: 'High' },
  PR: { N: 'None', L: 'Low', H: 'High' },
  UI: { N: 'None', R: 'Required' },
  S: { U: 'Unchanged', C: 'Changed' },
  C: { N: 'None', L: 'Low', H: 'High' },
  I: { N: 'None', L: 'Low', H: 'High' },
  A: { N: 'None', L: 'Low', H: 'High' },
};
const CVSS_NAMES = {
  AV: 'Attack Vector',
  AC: 'Attack Complexity',
  PR: 'Privileges Required',
  UI: 'User Interaction',
  S: 'Scope',
  C: 'Confidentiality',
  I: 'Integrity',
  A: 'Availability',
};

/** 50145 — CVSS vector chip expanding into the full metric breakdown. */
export function CvssVectorChip({ vector = '', className = '' }) {
  const [open, setOpen] = React.useState(false);
  if (!vector) return null;
  const parts = vector
    .split('/')
    .slice(1)
    .map(p => p.split(':'))
    .filter(([k, v]) => CVSS_METRICS[k] && CVSS_METRICS[k][v]);
  return (
    <span className={`fc2-cvss ${className}`}>
      <button
        type="button"
        className="fc2-cvss-chip"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        title={vector}
      >
        {vector.split('/')[0]}
      </button>
      {open && (
        <span className="fc2-cvss-panel" role="table" aria-label="CVSS breakdown">
          {parts.map(([k, v]) => (
            <span key={k} className="fc2-cvss-row" role="row">
              <span role="cell" className="fc2-cvss-k">
                {CVSS_NAMES[k]}
              </span>
              <span role="cell" className="fc2-cvss-v">
                {CVSS_METRICS[k][v]}
              </span>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

/** 50147 — False-positive dismiss flow: reason → slim dismissed row. */
export function FalsePositiveDismiss({ findingId = '', onDismiss, className = '' }) {
  const [asking, setAsking] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [dismissed, setDismissed] = React.useState(false);
  if (dismissed) {
    return (
      <div className={`fc2-dismissed ${className}`} role="status">
        <span>Dismissed as false positive — {reason}</span>
        <button
          type="button"
          onClick={() => {
            setDismissed(false);
            setReason('');
          }}
        >
          Undo
        </button>
      </div>
    );
  }
  if (!asking) {
    return (
      <button type="button" className={`fc2-fp-btn ${className}`} onClick={() => setAsking(true)}>
        Mark as false positive
      </button>
    );
  }
  return (
    <span className={`fc2-fp-ask ${className}`}>
      <input
        type="text"
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Reason (e.g. expected behavior)"
        aria-label="False positive reason"
      />
      <button
        type="button"
        disabled={!reason.trim()}
        onClick={() => {
          setDismissed(true);
          if (onDismiss) onDismiss(findingId, reason.trim());
        }}
      >
        Confirm
      </button>
      <button
        type="button"
        onClick={() => {
          setAsking(false);
          setReason('');
        }}
      >
        Cancel
      </button>
    </span>
  );
}

const HL_KEYWORDS =
  /\b(const|let|var|function|return|if|else|for|while|import|from|export|new|await|async|class|def|select|union|where|order|by|insert|into|values|script|alert|document|window|fetch|true|false|null|undefined)\b/;
const HL_TOKEN =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)/g;

/** 50148 — Evidence code blocks with syntax highlighting + line numbers. */
export function HighlightedEvidenceBlock({ code = '', lang = '', className = '' }) {
  const lines = code.split('\n');
  const renderLine = (line, li) => {
    const out = [];
    let last = 0;
    let m;
    HL_TOKEN.lastIndex = 0;
    while ((m = HL_TOKEN.exec(line)) !== null && out.length < 60) {
      if (m.index > last) {
        const plain = line.slice(last, m.index);
        let kLast = 0;
        let km;
        const kwRe = new RegExp(HL_KEYWORDS.source, 'g');
        while ((km = kwRe.exec(plain)) !== null) {
          if (km.index > kLast)
            out.push(<span key={`t${li}-${kLast}`}>{plain.slice(kLast, km.index)}</span>);
          out.push(
            <span key={`k${li}-${km.index}`} className="fc2-hl-kw">
              {km[0]}
            </span>
          );
          kLast = km.index + km[0].length;
        }
        if (kLast < plain.length)
          out.push(<span key={`t${li}-${kLast}-e`}>{plain.slice(kLast)}</span>);
      }
      const cls = m[1] ? 'fc2-hl-com' : m[2] ? 'fc2-hl-str' : 'fc2-hl-num';
      out.push(
        <span key={`m${li}-${m.index}`} className={cls}>
          {m[0]}
        </span>
      );
      last = m.index + m[0].length;
    }
    if (last < line.length) out.push(<span key={`e${li}`}>{line.slice(last)}</span>);
    return out.length > 0 ? out : line;
  };
  return (
    <div
      className={`fc2-code ${className}`}
      role="figure"
      aria-label={`Code evidence${lang ? ` in ${lang}` : ''}`}
    >
      {lang && <span className="fc2-code-lang">{lang}</span>}
      <div className="fc2-code-body" tabIndex={0} aria-label="Scrollable code evidence">
        {lines.map((line, i) => (
          <div key={i} className="fc2-code-line">
            <span className="fc2-code-num" aria-hidden="true">
              {i + 1}
            </span>
            <code>{renderLine(line, i)}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 50149 — Copy a ready-to-paste markdown block of the PoC. */
export function CopyPoCMarkdownButton({ markdown = '', className = '' }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = markdown;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" className={`fc2-copy-poc ${className}`} onClick={copy}>
      {copied ? '✓ Copied' : '⧉ Copy PoC markdown'}
    </button>
  );
}

/** 50150 — Screenshot lightbox: full-screen viewer with zoom controls. */
export function ScreenshotLightbox({ src = '', alt = 'Evidence screenshot', className = '' }) {
  const [open, setOpen] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = e => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!src) return null;
  return (
    <span className={className}>
      <button
        type="button"
        className="fc2-lightbox-thumb"
        onClick={() => {
          setOpen(true);
          setZoom(1);
        }}
        aria-label="Open screenshot viewer"
      >
        <img src={src} alt={alt} />
      </button>
      {open && (
        <div
          className="fc2-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot viewer"
          onClick={() => setOpen(false)}
        >
          <div className="fc2-lightbox-bar" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))}
              aria-label="Zoom in"
            >
              ＋
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
              aria-label="Zoom out"
            >
              －
            </button>
            <button type="button" onClick={() => setZoom(1)}>
              Reset
            </button>
            <button
              type="button"
              className="fc2-lightbox-x"
              onClick={() => setOpen(false)}
              aria-label="Close viewer"
            >
              ✕
            </button>
          </div>
          <img
            src={src}
            alt={alt}
            className="fc2-lightbox-img"
            style={{ transform: `scale(${zoom})` }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </span>
  );
}

/** 50151 — Hover peek: floating preview of the top evidence on card hover. */
export function HoverPeekPreview({ preview = null, children, className = '' }) {
  return (
    <span className={`fc2-peek ${className}`} tabIndex={0}>
      {children}
      <span className="fc2-peek-card" role="tooltip">
        {preview}
      </span>
    </span>
  );
}

/** 50152 — Severity distribution mini-bar atop the findings list. */
export function SeverityDistributionMiniBar({ counts = {}, className = '' }) {
  const keys = ['critical', 'high', 'medium', 'low', 'info'];
  const total = keys.reduce((s, k) => s + (counts[k] || 0), 0);
  if (!total) return null;
  return (
    <div
      className={`fc2-sevbar ${className}`}
      role="img"
      aria-label={`Severity mix: ${keys.map(k => `${counts[k] || 0} ${k}`).join(', ')}`}
    >
      {keys.map(
        k =>
          (counts[k] || 0) > 0 && (
            <span
              key={k}
              className="fc2-sevbar-seg"
              title={`${k}: ${counts[k]}`}
              style={{
                width: `${((counts[k] || 0) / total) * 100}%`,
                background: FC_SEVERITY[k].color,
              }}
            />
          )
      )}
    </div>
  );
}

/** 50153 — Reviewer checkmark: avatar + who triaged the finding. */
export function ReviewerCheckmark({ name = '', initials = '', className = '' }) {
  if (!name) return null;
  return (
    <span
      className={`fc2-reviewer ${className}`}
      title={`Triaged by ${name}`}
      aria-label={`Triaged by ${name}`}
    >
      <span className="fc2-reviewer-check" aria-hidden="true">
        ✓
      </span>
      <span className="fc2-reviewer-avatar" aria-hidden="true">
        {initials || name.slice(0, 2).toUpperCase()}
      </span>
      <span className="fc2-reviewer-name">{name}</span>
    </span>
  );
}

/** 50154 — Remediation checklist: persistent checkboxes inside the expanded card. */
export function RemediationChecklist({ findingId = '', steps = [], className = '' }) {
  const key = `fc-remediation-${findingId}`;
  const [done, setDone] = React.useState(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const toggle = i => {
    setDone(d => {
      const next = { ...d, [i]: !d[i] };
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const items =
    steps.length > 0
      ? steps
      : ['Use parameterized queries', 'Add input validation', 'Re-test after fix'];
  const doneCount = items.filter((_, i) => done[i]).length;
  return (
    <div
      className={`fc2-remediation ${className}`}
      aria-label={`Remediation: ${doneCount} of ${items.length} done`}
    >
      <span className="fc2-remediation-title">
        Remediation — {doneCount}/{items.length}
      </span>
      {items.map((s, i) => (
        <label key={i} className={`fc2-remediation-step ${done[i] ? 'fc2-done' : ''}`}>
          <input type="checkbox" checked={!!done[i]} onChange={() => toggle(i)} />
          <span>{s}</span>
        </label>
      ))}
    </div>
  );
}

/** 50156 — Request-retest button: triggers a verification mini-hunt. */
export function RequestRetestButton({ findingId = '', onRetest, className = '' }) {
  const [state, setState] = React.useState('idle');
  const run = () => {
    setState('requested');
    if (onRetest) onRetest(findingId);
  };
  return (
    <button
      type="button"
      className={`fc2-retest fc2-retest-${state} ${className}`}
      onClick={run}
      disabled={state !== 'idle'}
    >
      {state === 'idle' ? '↻ Request retest' : '✓ Retest requested'}
    </button>
  );
}

/** 50157 — Affected-parameter chip with its own copy button. */
export function AffectedParameterChip({ param = '', className = '' }) {
  const [copied, setCopied] = React.useState(false);
  if (!param) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(param);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <span className={`fc2-param ${className}`} title={`Vulnerable parameter: ${param}`}>
      <code>{param}</code>
      <button type="button" onClick={copy} aria-label={`Copy parameter ${param}`}>
        {copied ? '✓' : '⧉'}
      </button>
    </span>
  );
}

const OWASP_TOP10 = {
  A01: 'Broken Access Control',
  A02: 'Cryptographic Failures',
  A03: 'Injection',
  A04: 'Insecure Design',
  A05: 'Security Misconfiguration',
  A06: 'Vulnerable and Outdated Components',
  A07: 'Identification and Authentication Failures',
  A08: 'Software and Data Integrity Failures',
  A09: 'Security Logging and Monitoring Failures',
  A10: 'Server-Side Request Forgery',
};

/** 50158 — OWASP category badge with explainer link. */
export function OwaspCategoryBadge({ category = '', className = '' }) {
  const name = OWASP_TOP10[category];
  if (!name) return null;
  return (
    <a
      className={`fc2-owasp ${className}`}
      href="https://owasp.org/Top10/"
      target="_blank"
      rel="noopener noreferrer"
      title={`OWASP Top 10 — ${name}`}
    >
      {category} · {name}
    </a>
  );
}

/** 50159 — PoC replay status dot: green replayable, gray manual-only. */
export function PocReplayStatusDot({ replayable = false, className = '' }) {
  return (
    <span
      className={`fc2-replay-dot ${replayable ? 'fc2-replayable' : ''} ${className}`}
      role="status"
      aria-label={replayable ? 'PoC is replayable' : 'PoC is manual-only'}
    >
      <i aria-hidden="true" /> {replayable ? 'replayable PoC' : 'manual PoC'}
    </span>
  );
}

/** 50160 — Agent-reasoning section: why the agent flagged this finding. */
export function AgentReasoningSection({ text = '', className = '' }) {
  const [open, setOpen] = React.useState(false);
  if (!text) return null;
  return (
    <div className={`fc2-reasoning ${className}`}>
      <button
        type="button"
        className="fc2-reasoning-head"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span aria-hidden="true">🧠</span> Why the agent flagged this
        <span aria-hidden="true" className="fc2-reasoning-caret">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && <p className="fc2-reasoning-body">{text}</p>}
    </div>
  );
}

/** Demo composite: a fully wired finding card using both files. */
export function DemoFindingCard({ finding = {}, className = '' }) {
  const f = {
    id: 'DM-2026-0042',
    title: 'SQL injection in login form',
    severity: 'critical',
    confidence: 92,
    riskScore: 9.1,
    discoveredAt: Date.now() - 2 * 60 * 1000,
    tags: ['authenticated', 'chained'],
    asset: { host: 'app.target.example', path: '/login?user=' },
    impact: 'Attackers can dump the entire user database without logging in.',
    exploitSteps: 3,
    status: 'triaged',
    comments: 2,
    parentId: 'DM-2026-0039',
    cvss: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:N',
    param: 'user=',
    owasp: 'A03',
    replayable: true,
    reasoning:
      'The login form reflects a time-delayed response to stacked queries, and the error message leaks the backend dialect — both strong SQLi signals.',
    remediation: [
      'Use parameterized queries',
      'Strip verbose DB errors',
      'Add WAF rule for stacked queries',
    ],
    evidence: [
      {
        type: 'code',
        lang: 'http',
        code: "POST /login HTTP/1.1\nuser=admin' AND SLEEP(5)-- -",
        label: 'request',
      },
    ],
    pocMarkdown:
      '## PoC\n```\ncurl -X POST https://app.target.example/login -d "user=admin\' AND SLEEP(5)-- -"\n```',
    ...finding,
  };
  return (
    <div className={className}>
      <FindingCard
        finding={f}
        expandedExtra={
          <>
            <HighlightedEvidenceBlock
              code={f.evidence[0]?.code || ''}
              lang={f.evidence[0]?.lang || ''}
            />
            <RemediationChecklist findingId={f.id} steps={f.remediation} />
            <AgentReasoningSection text={f.reasoning} />
            <SimilarFindingsRow related={[{ id: 'DM-2026-0043', title: 'SQLi in search' }]} />
          </>
        }
      />
      <div className="fc2-demo-row">
        <CvssVectorChip vector={f.cvss} />
        <OwaspCategoryBadge category={f.owasp} />
        <AffectedParameterChip param={f.param} />
        <PocReplayStatusDot replayable={f.replayable} />
      </div>
      <div className="fc2-demo-row">
        <CopyPoCMarkdownButton markdown={f.pocMarkdown} />
        <RequestRetestButton findingId={f.id} />
        <ReviewerCheckmark name="Infinity AI" initials="AI" />
        <DiscoveryMetaLine phase="Testing" at={f.discoveredAt} />
      </div>
    </div>
  );
}

export { FC_SEVERITY };
