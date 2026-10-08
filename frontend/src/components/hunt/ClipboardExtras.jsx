/**
 * ClipboardExtras.jsx — wave 22 (ideas 50841–50880): formatter components.
 *
 * Real, working copy components for every text formatter in clipboardCore:
 * cURL replay commands, finding deep links, CVSS vectors, normalized target
 * URLs, share text, hunt summaries, timeline lines, search/filter-as-URL,
 * webhook examples, Jira/GitHub tickets, model configs, verified regex,
 * widget configs, asset lists, retest diffs, shortcut text, status updates,
 * diagnostics bundles, checksums, invite links, citations, CSV tables,
 * accessible tables, report sections, dual timestamps, and the mobile
 * share-sheet fallback.
 */
import { useMemo, useState } from 'react';
import { CopyButton, useCopy } from './ClipboardActions.jsx';
import {
  buildCurlCommand,
  findingDeepLink,
  cvssCopyText,
  normalizeTargetUrl,
  rowsToCsv,
  reportSectionCopy,
  shareText,
  diagnosticsBundle,
  searchAsUrl,
  webhookExample,
  findingAsTicket,
  filteredSetText,
  huntSummaryText,
  checksumCopyText,
  timelineEventLine,
  citationAppend,
  assetListText,
  retestDiffText,
  shortcutText,
  statusUpdateText,
  modelConfigJson,
  filterAsUrl,
  verifyRegex,
  escapeRegex,
  widgetConfigJson,
  dualTimestamps,
  inviteLinkText,
  prefersShareSheet,
  accessibleTableText,
  copyAriaLabel,
} from './clipboardCore.js';
import './Clipboard.css';

function Demo({ title, children }) {
  return (
    <div className="cb-demo">
      <h3>{title}</h3>
      <div className="cb-demo-body">{children}</div>
    </div>
  );
}

/* 50842 */ export function CurlCopy({ request }) {
  const cmd = useMemo(() => buildCurlCommand(request || {}), [request]);
  return (
    <>
      <pre className="cb-pre">{cmd.slice(0, 300)}</pre>
      <CopyButton text={cmd} action="request as cURL" />
    </>
  );
}

/* 50843 */ export function DeepLinkCopy({ baseUrl, huntId, findingId }) {
  const link = findingDeepLink({ baseUrl, huntId, findingId });
  return (
    <>
      <code className="cb-inline">{link}</code>
      <CopyButton text={link} action="finding deep link" />
    </>
  );
}

/* 50844 */ export function CvssCopy({ vector }) {
  const text = cvssCopyText(vector);
  return (
    <>
      <span className="cb-chip">{text || 'no vector'}</span>
      <CopyButton text={text} action="CVSS vector" />
    </>
  );
}

/* 50845 */ export function TargetUrlCopy({ url }) {
  const { text, note } = normalizeTargetUrl(url);
  return (
    <>
      <code className="cb-inline">{text}</code>
      {note && <span className="cb-note">({note})</span>}
      <CopyButton text={text} action="target URL" />
    </>
  );
}

/* 50847 */ export function CsvTableCopy({ rows, headers }) {
  const csv = useMemo(() => rowsToCsv(rows || [], headers), [rows, headers]);
  return (
    <>
      <pre className="cb-pre">{csv.slice(0, 300)}</pre>
      <CopyButton text={csv} action="table as CSV" />
    </>
  );
}

/* 50878 */ export function AccessibleTableCopy({ rows, headers }) {
  const text = useMemo(() => accessibleTableText(rows || [], headers), [rows, headers]);
  return (
    <>
      <pre className="cb-pre">{text.slice(0, 300)}</pre>
      <CopyButton text={text} action="accessible table" />
    </>
  );
}

/* 50848 */ export function ReportSectionCopy({ section }) {
  const text = reportSectionCopy(section);
  return (
    <>
      <p className="cb-inline">{(section && section.title) || 'Section'}</p>
      <CopyButton text={text} action="report section" />
    </>
  );
}

/* 50849 */ export function ShareTextCopy({ finding }) {
  const text = shareText(finding || {});
  return (
    <>
      <p className="cb-inline">{text}</p>
      <CopyButton text={text} action="share text" />
    </>
  );
}

/* 50851 */ export function DiagnosticsCopy({ errorId, stack, env }) {
  const text = useMemo(() => diagnosticsBundle({ errorId, stack, env }), [errorId, stack, env]);
  return (
    <>
      <pre className="cb-pre">{text.slice(0, 300)}</pre>
      <CopyButton text={text} action="diagnostics bundle" />
    </>
  );
}

/* 50852 */ export function SearchUrlCopy({ baseUrl, query }) {
  const [q, setQ] = useState(query || '');
  const url = searchAsUrl(baseUrl, q);
  return (
    <>
      <input
        className="cb-input"
        value={q}
        onChange={e => setQ(e.target.value)}
        aria-label="Search query"
      />
      <code className="cb-inline">{url}</code>
      <CopyButton text={url} action="search as URL" />
    </>
  );
}

/* 50853 */ export function WebhookExampleCopy({ event }) {
  const text = useMemo(() => webhookExample(event), [event]);
  return (
    <>
      <pre className="cb-pre">{text.slice(0, 300)}</pre>
      <CopyButton text={text} action="webhook example" />
    </>
  );
}

/* 50854 */ export function TicketCopy({ finding }) {
  const [flavor, setFlavor] = useState('github');
  const text = useMemo(() => findingAsTicket(finding || {}, flavor), [finding, flavor]);
  return (
    <>
      <div className="cb-segment" role="group" aria-label="Ticket flavor">
        {['github', 'jira'].map(f => (
          <button
            key={f}
            type="button"
            className={`cb-btn cb-sm${flavor === f ? ' cb-active' : ' cb-ghost'}`}
            aria-pressed={flavor === f}
            onClick={() => setFlavor(f)}
          >
            {f === 'github' ? 'GitHub' : 'Jira'}
          </button>
        ))}
      </div>
      <pre className="cb-pre">{text.slice(0, 300)}</pre>
      <CopyButton text={text} action={`remediation as ${flavor} ticket`} />
    </>
  );
}

/* 50855 */ export function FilteredSetCopy({ filters }) {
  const [format, setFormat] = useState('json');
  const text = useMemo(() => filteredSetText(filters || {}, format), [filters, format]);
  return (
    <>
      <div className="cb-segment" role="group" aria-label="Export format">
        {['json', 'csv'].map(f => (
          <button
            key={f}
            type="button"
            className={`cb-btn cb-sm${format === f ? ' cb-active' : ' cb-ghost'}`}
            aria-pressed={format === f}
            onClick={() => setFormat(f)}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>
      <pre className="cb-pre">{text.slice(0, 300)}</pre>
      <CopyButton text={text} action={`filtered set (${format})`} />
    </>
  );
}

/* 50856 */ export function HuntSummaryCopy({ hunt }) {
  const text = huntSummaryText(hunt || {});
  return (
    <>
      <p className="cb-inline">{text}</p>
      <CopyButton text={text} action="hunt summary" />
    </>
  );
}

/* 50857 */ export function ChecksumCopy({ hash, algorithm }) {
  const text = checksumCopyText(hash, algorithm);
  return (
    <>
      <code className="cb-inline">{text}</code>
      <CopyButton text={text} action="report checksum" />
    </>
  );
}

/* 50858 */ export function TimelineEventCopy({ event }) {
  const text = timelineEventLine(event || {});
  return (
    <>
      <code className="cb-inline">{text}</code>
      <CopyButton text={text} action="timeline event" />
    </>
  );
}

/* 50861 */ export function CitationCopy({ text, huntId, at }) {
  const cited = citationAppend(text, { huntId, at });
  return (
    <>
      <pre className="cb-pre">{cited.slice(0, 300)}</pre>
      <CopyButton text={cited} action="evidence with citation" />
    </>
  );
}

/* 50862 */ export function AssetListCopy({ assets }) {
  const text = assetListText(assets);
  return (
    <>
      <pre className="cb-pre">{text.slice(0, 300) || '(no assets)'}</pre>
      <CopyButton text={text} action="asset list" />
    </>
  );
}

/* 50863 */ export function RetestDiffCopy({ before, after }) {
  const text = useMemo(() => retestDiffText({ before, after }), [before, after]);
  return (
    <>
      <pre className="cb-pre">{text.slice(0, 400)}</pre>
      <CopyButton text={text} action="retest diff" />
    </>
  );
}

/* 50864 */ export function ShortcutTextCopy({ binding }) {
  const text = shortcutText(binding);
  return (
    <>
      <kbd className="cb-kbd">{text}</kbd>
      <CopyButton text={text} action="shortcut text" />
    </>
  );
}

/* 50865 */ export function StatusUpdateCopy({ notification }) {
  const text = statusUpdateText(notification || {});
  return (
    <>
      <p className="cb-inline">{text}</p>
      <CopyButton text={text} action="status update" />
    </>
  );
}

/* 50866 */ export function ModelConfigCopy({ config }) {
  const text = useMemo(() => modelConfigJson(config), [config]);
  return (
    <>
      <pre className="cb-pre">{text.slice(0, 300)}</pre>
      <CopyButton text={text} action="model config" />
    </>
  );
}

/* 50867 */ export function FilterUrlCopy({ baseUrl, filterState }) {
  const url = useMemo(() => filterAsUrl(baseUrl, filterState), [baseUrl, filterState]);
  return (
    <>
      <code className="cb-inline">{url}</code>
      <CopyButton text={url} action="filter as URL" />
    </>
  );
}

/* 50876 */ export function RegexCopy({ pattern }) {
  const [input, setInput] = useState(pattern || '');
  const result = useMemo(() => verifyRegex(input), [input]);
  const escaped = useMemo(() => escapeRegex(input), [input]);
  return (
    <>
      <input
        className="cb-input"
        value={input}
        onChange={e => setInput(e.target.value)}
        aria-label="Regex pattern"
      />
      <span className={`cb-note${result.valid ? ' cb-ok' : ' cb-err'}`} role="status">
        {result.valid ? 'valid' : `invalid: ${result.error}`}
      </span>
      {result.valid && (
        <>
          <span className="cb-note">
            escaped literal: <code>{escaped}</code>
          </span>
          <CopyButton text={input} action="verified regex" />
        </>
      )}
    </>
  );
}

/* 50875 */ export function WidgetConfigCopy({ layout }) {
  const text = useMemo(() => widgetConfigJson(layout), [layout]);
  return (
    <>
      <pre className="cb-pre">{text.slice(0, 300)}</pre>
      <CopyButton text={text} action="widget config" />
    </>
  );
}

/* 50873 */ export function DualTimestampCopy({ ts }) {
  const [showBoth, setShowBoth] = useState(true);
  const { iso, relative, combined } = useMemo(() => dualTimestamps(ts || Date.now()), [ts]);
  const text = showBoth ? combined : iso;
  return (
    <>
      <label className="cb-toggle">
        <input type="checkbox" checked={showBoth} onChange={e => setShowBoth(e.target.checked)} />
        ISO + relative
      </label>
      <code className="cb-inline">{text}</code>
      <CopyButton text={text} action="timestamps" />
    </>
  );
}

/* 50874 */ export function InviteLinkCopy({ link, role, expiresAt }) {
  const text = inviteLinkText({ link, role, expiresAt });
  return (
    <>
      <pre className="cb-pre">{text}</pre>
      <CopyButton text={text} action="invite link" />
    </>
  );
}

/* 50880 */ export function MobileShareButton({ text, title, url }) {
  const { copy, toast } = useCopy();
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const onShare = async () => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    if (canShare && prefersShareSheet(ua)) {
      try {
        await navigator.share({ text, title, url });
        return;
      } catch {
        // User dismissed or share failed — fall back to clipboard.
      }
    }
    await copy(text, { label: 'share text' });
  };

  return (
    <span className="cb-wrap">
      <button
        type="button"
        className="cb-btn cb-primary"
        aria-label={copyAriaLabel('share')}
        onClick={onShare}
      >
        Share
      </button>
      {toast && (
        <span className="cb-toast" role="status">
          {toast}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Gallery                                                            */
/* ------------------------------------------------------------------ */

const DEMO_FINDING = {
  severity: 'Critical',
  title: 'SQLi',
  host: 'example.com',
  path: '/login',
  link: 'https://app.example/hunts/h1?finding=f1',
  target: 'https://example.com',
  description: 'Union-based SQL injection in the login form.',
  remediation: 'Use parameterized queries.',
};

const DEMO_ROWS = [
  { id: 'f1', severity: 'critical', title: 'SQLi' },
  { id: 'f2', severity: 'high', title: 'Stored XSS' },
];

export function ClipboardExtrasGallery() {
  return (
    <section className="cb-gallery" aria-label="Clipboard formatters gallery">
      <h2>Copy formatters</h2>
      <Demo title="Copy as cURL">
        <CurlCopy
          request={{
            method: 'POST',
            url: 'https://example.com/login',
            headers: { 'Content-Type': 'application/json' },
            body: { user: 'a' },
          }}
        />
      </Demo>
      <Demo title="Finding deep link">
        <DeepLinkCopy baseUrl="https://app.example" huntId="h1" findingId="f1" />
      </Demo>
      <Demo title="CVSS vector">
        <CvssCopy vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H" />
      </Demo>
      <Demo title="Target URL">
        <TargetUrlCopy url="example.com" />
      </Demo>
      <Demo title="CSV table">
        <CsvTableCopy rows={DEMO_ROWS} headers={['id', 'severity', 'title']} />
      </Demo>
      <Demo title="Accessible table">
        <AccessibleTableCopy rows={DEMO_ROWS} headers={['id', 'severity', 'title']} />
      </Demo>
      <Demo title="Report section">
        <ReportSectionCopy section={{ title: 'Findings', body: '2 findings, 1 critical.' }} />
      </Demo>
      <Demo title="Share text">
        <ShareTextCopy finding={DEMO_FINDING} />
      </Demo>
      <Demo title="Diagnostics bundle">
        <DiagnosticsCopy
          errorId="ERR-42"
          stack={'TypeError: x\n    at hunt (app.js:10)'}
          env={{ NODE_ENV: 'prod' }}
        />
      </Demo>
      <Demo title="Search as URL">
        <SearchUrlCopy baseUrl="https://app.example" query="severity:critical" />
      </Demo>
      <Demo title="Webhook example">
        <WebhookExampleCopy event="finding.created" />
      </Demo>
      <Demo title="Remediation ticket">
        <TicketCopy finding={DEMO_FINDING} />
      </Demo>
      <Demo title="Filtered set">
        <FilteredSetCopy filters={{ severity: 'critical', target: 'example.com' }} />
      </Demo>
      <Demo title="Hunt summary">
        <HuntSummaryCopy
          hunt={{
            name: 'nightly',
            duration: '42m',
            findings: [{ severity: 'critical' }, { severity: 'high' }, { severity: 'low' }],
          }}
        />
      </Demo>
      <Demo title="Checksum">
        <ChecksumCopy hash="a3f5…" algorithm="SHA-256" />
      </Demo>
      <Demo title="Timeline event">
        <TimelineEventCopy
          event={{ timestamp: '2026-10-07T18:00:00+05:30', huntId: 'h1', label: 'hunt finished' }}
        />
      </Demo>
      <Demo title="Citation">
        <CitationCopy text="SQL syntax error near '1'" huntId="h1" at="2026-10-07 18:00 IST" />
      </Demo>
      <Demo title="Asset list">
        <AssetListCopy assets={['example.com', 'api.example.com', '/admin']} />
      </Demo>
      <Demo title="Retest diff">
        <RetestDiffCopy
          before={'status: 500\nerror: SQL syntax'}
          after={'status: 400\nerror: invalid input'}
        />
      </Demo>
      <Demo title="Shortcut text">
        <ShortcutTextCopy binding="Ctrl+Shift+E" />
      </Demo>
      <Demo title="Status update">
        <StatusUpdateCopy
          notification={{
            kind: 'hunt',
            summary: '3 new findings',
            link: 'https://app.example/hunts/h1',
          }}
        />
      </Demo>
      <Demo title="Model config">
        <ModelConfigCopy config={{ slot: 1, model: 'qwen2.5-vl', temperature: 0.2 }} />
      </Demo>
      <Demo title="Filter as URL">
        <FilterUrlCopy
          baseUrl="https://app.example"
          filterState={{ severity: 'critical', sort: 'risk' }}
        />
      </Demo>
      <Demo title="Verified regex">
        <RegexCopy pattern={'^/admin'} />
      </Demo>
      <Demo title="Widget config">
        <WidgetConfigCopy layout={[{ id: 'w1', type: 'severity-chart' }]} />
      </Demo>
      <Demo title="Dual timestamps">
        <DualTimestampCopy ts={Date.now() - 65 * 60000} />
      </Demo>
      <Demo title="Invite link">
        <InviteLinkCopy
          link="https://app.example/invite/abc"
          role="analyst"
          expiresAt="2026-10-14"
        />
      </Demo>
      <Demo title="Mobile share">
        <MobileShareButton text="Critical: SQLi on example.com/login" title="Share finding" />
      </Demo>
    </section>
  );
}
