// Hunt card — ChatGPT idiom: an assistant message with a progress card.
// Status line ("Hunting <target>…"), expandable event feed, findings stream,
// and Pause/Resume/Stop pill buttons. All stream/control logic unchanged.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { pauseHunt, resumeHunt, stopHunt, getHuntCost, getHuntEvents, steerHunt, listHunts } from '../lib/api';
import { HuntStreamClient, createSimulatedStream, isDemoMode } from '../lib/huntStream';
import { toast } from '../lib/toast';

const SEVERITY_CLASS = {
  critical: 'sev-critical',
  high: 'sev-high',
  medium: 'sev-medium',
  low: 'sev-low',
};

function statusClass(status) {
  switch (status) {
    case 'running': return 'status-pill status-running';
    case 'idle':
    case 'created':
    case 'starting': return 'status-pill status-running';
    case 'paused': return 'status-pill status-paused';
    case 'out_of_credits': return 'status-pill status-paused';
    case 'done': return 'status-pill status-completed';
    case 'stopped': return 'status-pill status-stopped';
    case 'error': return 'status-pill status-failed';
    default: return 'status-pill status-paused';
  }
}

function statusLabel(status) {
  switch (status) {
    case 'running': return 'Running';
    case 'idle':
    case 'created':
    case 'starting': return 'Starting';
    case 'paused': return 'Paused';
    case 'out_of_credits': return 'Out of credits';
    case 'done': return 'Completed';
    case 'stopped': return 'Stopped';
    case 'error': return 'Failed';
    default: return status ? String(status) : 'Paused';
  }
}

function statusText(status, target) {
  switch (status) {
    case 'running': return `Hunting ${target}…`;
    case 'idle':
    case 'created':
    case 'starting': return 'Starting hunt…';
    case 'paused': return 'Hunt paused';
    case 'out_of_credits': return 'Out of credits — top up, then press Resume.';
    case 'done': return 'Hunt completed';
    case 'stopped': return 'Hunt stopped';
    case 'error': return 'Stream unavailable';
    default: return `Hunt ${status}`;
  }
}

// Lane V: a stream event's OWN time. Every recorded event carries
// the stamp the backend wrote (cachedAt; some events also carry
// `at`). Feed lines must render their event's time — stamping a
// replayed history line with the moment the page happened to load
// made every history line show one identical elapsed stamp (the
// hunt's total elapsed at load). Date.now() is only the fallback
// for a live frame that carries no stamp of its own.
function eventTimeMs(payload) {
  const t = Date.parse((payload && (payload.at || payload.cachedAt)) || '');
  return Number.isFinite(t) ? t : Date.now();
}

// One feed line for a tool_call event/record, identical for the
// history pull and the live stream. Host-side events (pipeline AND
// human mode) carry {tool, detail}; engine-era frames carried
// {tool, args}. The stream handler used to read only args/output,
// so every host-side tool line collapsed to the bare tool name and
// the action itself (which page, which command) never rendered.
function toolCallText(e) {
  const tool = (e && e.tool) || 'tool';
  const detail = (e && (e.detail || e.args)) || '';
  return `${tool}${detail ? ` ${detail}` : ''}`;
}

import HuntPiP from './HuntPiP';
import HuntTerminalModal from './HuntTerminalModal';
import LiveMachine from './LiveMachine';

export default function HuntCard({ hunt, onStatusChange, onRerun, onTalkWithAI, onGetReport }) {
  const [status, setStatus] = useState(hunt.status || 'idle');
  // Button visibility rule (owner's spec): a live hunt shows Pause + Stop;
  // a paused hunt shows Resume + Stop. Terminal hunts show nothing clickable.
  const isPaused = status === 'paused' || status === 'out_of_credits';
  const isTerminal = ['done', 'stopped', 'failed', 'error'].includes(status);
  const isActive = ['running', 'paused'].includes(status);
  const [showPiP, setShowPiP] = useState(false);
  const [showTerminalModal, setShowTerminalModal] = useState(false);
  const [cost, setCost] = useState(null);
  const [balance, setBalance] = useState(null);
  const ITERATION_PRICE = { normal: 0.1, medium: 0.15, high: 0.25, ultra_high: 0.4, max: 0.6, infinity: 1.0 };
  const perIter = ITERATION_PRICE[hunt.mode] || ITERATION_PRICE.normal;
  const [logs, setLogs] = useState(hunt.logs || []);
  const [findings, setFindings] = useState(hunt.findings || []);
  const [phase, setPhase] = useState(hunt.phase || '');
  const [busy, setBusy] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [showFeed, setShowFeed] = useState(true);
  const [resolvedCreatedAt, setResolvedCreatedAt] = useState(hunt.createdAt || null);
  // Lane P: until the history fetch settles, the card cannot tell a
  // genuinely silent hunt from one whose record is still loading —
  // on remount (e.g. Admin -> hunt via the sidebar) it used to flash
  // "Waiting for hunt output…" plus a 00:00:00 timer, looking like
  // the hunt had restarted from zero (owner's live QA, 23 Oct 2026).
  // Track the load so the card says "loading" while it is loading.
  const [historyLoaded, setHistoryLoaded] = useState(false);
  // Load historical events for real timestamps on existing log lines,
  // plus the reconciled findings snapshot (Lane V): the panel's
  // findings come from the backend's single read path
  // (loadHuntMemory -> panelFindings — retraction-filtered, one row
  // per unique title), the same source mid-hunt chat counts from.
  useEffect(() => {
    let cancelled = false;
    import('../lib/api').then(({ getHuntEvents }) =>
      getHuntEvents(hunt.huntId, 200).then((r) => {
        if (cancelled) return;
        setHistoryLoaded(true);
        if (!r.ok || !r.data) return;
        if (Array.isArray(r.data.findings)) setFindings(r.data.findings);
        const evts = r.data.events || r.data || [];
        if (!Array.isArray(evts) || evts.length === 0) return;
        const mapped = evts
          .filter((e) => e.type === 'thinking' || e.type === 'tool_call' || e.type === 'dedup_block')
          .map((e) => {
            const at = (e.at || e.cachedAt) ? new Date(e.at || e.cachedAt).getTime() : Date.now();
            if (e.type === 'tool_call') return { kind: 'tool', text: toolCallText(e), at };
            if (e.type === 'dedup_block') {
              return { kind: 'thinking', text: `dedup_block: ${e.tool || ''} ${e.detail || ''}`.trim(), at };
            }
            return { kind: 'thinking', text: e.text || e.message || e.detail || '', at };
          })
          .filter((l) => l.text);
        if (mapped.length) setLogs(mapped.slice(-99));
      }).catch(() => { if (!cancelled) setHistoryLoaded(true); })
    );
    return () => { cancelled = true; };
  }, [hunt.huntId]);

  // Lane V: keep the panel's findings on the reconciled snapshot
  // while the stream runs. A streamed 'finding'/'retraction' event
  // is a signal to re-read the snapshot (debounced), never a row to
  // append raw — raw accumulation is what desynced the panel from
  // chat (dropped `verified`, no retractions, duplicate stamps).
  const findingsTimerRef = useRef(null);
  const refreshFindings = () => {
    getHuntEvents(hunt.huntId, 200).then((r) => {
      if (r && r.ok && r.data && Array.isArray(r.data.findings)) setFindings(r.data.findings);
    }).catch(() => {});
  };
  const refreshFindingsSoon = () => {
    if (findingsTimerRef.current) clearTimeout(findingsTimerRef.current);
    findingsTimerRef.current = setTimeout(refreshFindings, 800);
  };
  useEffect(() => {
    if (hunt.createdAt) { setResolvedCreatedAt(hunt.createdAt); return; }
    let cancelled = false;
    listHunts().then((r) => {
      if (cancelled || !r.ok) return;
      const found = (r.data.hunts || []).find((h) => h.huntId === hunt.huntId);
      if (found && found.createdAt) setResolvedCreatedAt(found.createdAt);
      if (found && found.status && found.status !== status) setStatus(found.status);
    });
    return () => { cancelled = true; };
  }, [hunt.huntId]);
  const [steerMsg, setSteerMsg] = useState('');
  const [steerSent, setSteerSent] = useState(false);
  const [steerBusy, setSteerBusy] = useState(false);
  const logEndRef = useRef(null);

  // Elapsed-time ticker: shows how long the hunt has been running
  // (00:00:05 → 00:01:00 → 01:00:00). Ticks every second while live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (isTerminal) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isTerminal]);
  // Elapsed HH:MM:SS since hunt start, for log timestamps.
  const huntStartMs = new Date(resolvedCreatedAt || Date.now()).getTime();
  function elapsedStamp(at) {
    const ms = Math.max(0, (at || Date.now()) - huntStartMs);
    const s = Math.floor(ms / 1000);
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${sec}`;
  }
  // Lane P: before the hunt's real start time resolves, show a
  // placeholder instead of a timer counting up from the mount
  // moment (the 00:00:00 flash read as "the hunt restarted").
  const elapsedStr = resolvedCreatedAt ? elapsedStamp(now) : '--:--:--';

  // Plain-English activity feed: translate technical log entries into
  // "I did this" narration anyone can understand.
  const humanLogEntries = (() => {
    const out = [];
    const seen = new Set();
    for (const entry of logs) {
      const text = entry.text || '';
      let emoji = '💭';
      let human = null;
      if (entry.kind === 'finding') {
        emoji = '🎯';
        human = `I found something: ${text.slice(0, 120)}`;
      } else if (entry.kind === 'tool') {
        const t = text.toLowerCase();
        // Human-mode GUI actions (Lane V): the line carries the tool
        // name + detail ("browser_open http://…/ftp"), so name what
        // the hunter actually did. These used to fall through to one
        // generic line, deduped by text into invisibility — the
        // activity feed showed nothing of human mode at all.
        if (t.startsWith('browser_open')) {
          const u = (text.match(/https?:\/\/\S+/) || [])[0];
          emoji = '🌐'; human = u ? `I opened ${u.slice(0, 80)} in my browser` : 'I opened a page in my browser';
        }
        else if (t.startsWith('browser_click')) { emoji = '🖱️'; human = `I clicked ${text.replace(/^browser_click\s*/i, '').slice(0, 60) || 'a page element'}`; }
        else if (t.startsWith('browser_type')) { emoji = '⌨️'; human = 'I typed into the page'; }
        else if (t.startsWith('browser_snapshot')) { emoji = '👀'; human = 'I took a close look at the page'; }
        else if (t.includes('nmap')) { emoji = '🔍'; human = 'I scanned the target for open ports'; }
        else if (t.includes('subdomain') || t.includes('subfinder') || t.includes('amass')) { emoji = '🌐'; human = 'I enumerated subdomains'; }
        else if (t.includes('nuclei')) { emoji = '🔬'; human = 'I ran vulnerability checks'; }
        else if (t.includes('curl') || t.includes('wget')) { emoji = '📡'; human = 'I fetched a web page to inspect it'; }
        else if (t.includes('sqlmap') || t.includes('sql')) { emoji = '💉'; human = 'I tested for SQL injection'; }
        else if (t.includes('xss')) { emoji = '⚡'; human = 'I tested for cross-site scripting'; }
        else if (t.startsWith('shell')) { emoji = '💻'; human = `I ran a command: ${text.replace(/^shell\s*/i, '').slice(0, 70)}`; }
        else { emoji = '🔧'; human = `I ran a security test`; }
      } else {
        // thinking entries — make them first-person and friendly
        const t = text.toLowerCase();
        if (t.includes('dedup_block')) { emoji = '🛑'; human = 'I caught myself repeating an action — my own record stopped it'; }
        else if (t.includes('reconnaissance') || t.includes('mapping the attack')) { emoji = '🗺️'; human = 'I started mapping the website'; }
        else if (t.includes('understanding target')) { emoji = '👀'; human = `I'm looking at ${hunt.target}`; }
        else if (t.includes('iteration')) { const m = text.match(/iteration\s+(\d+)/i); emoji = '🔄'; human = m ? `I'm on round ${m[1]} of testing` : 'I continued testing'; }
        else if (t.includes('business-logic') || t.includes('bl module')) { emoji = '🧠'; human = 'I planned business-logic attack scenarios'; }
        else if (t.includes('checkpoint') || t.includes('resum')) { emoji = '💾'; human = 'I picked up from where I left off'; }
        else if (t.includes('finished')) { emoji = '✅'; human = 'I finished the hunt'; }
        else if (t.includes('paused')) { emoji = '⏸️'; human = 'I paused — waiting for you'; }
        else if (t.includes('stopped')) { emoji = '⏹️'; human = 'I stopped the hunt'; }
        if (!human && text.trim()) {
          // Lane V: human-mode thinking is free-form first-person
          // reasoning that matches none of the pipeline-era patterns
          // above; dropping it froze this feed at the last pipeline
          // narration line while the hunter kept working. Show the
          // reasoning itself, trimmed to a feed line.
          human = text.replace(/\s+/g, ' ').trim().slice(0, 140);
        }
      }
      if (human && !seen.has(human)) {
        seen.add(human);
        out.push({ emoji, text: human, at: entry.at });
      }
    }
    return out.slice(-8);
  })();

  const updateStatus = (next) => {
    setStatus(next);
    onStatusChange && onStatusChange(hunt.huntId, next);
  };

  useEffect(() => {
    let cancelled = false;
    getHuntCost(hunt.huntId).then((res) => {
      if (!cancelled && res.ok) setCost(res);
    }).catch(() => {});
    import('../lib/api').then(({ billingStatus }) =>
      billingStatus().then((res) => {
        if (!cancelled && res.ok && res.data) setBalance(res.data.balanceUsd);
      }).catch(() => {})
    );
    const t = setInterval(() => {
      getHuntCost(hunt.huntId).then((res) => {
        if (!cancelled && res.ok) setCost(res);
      }).catch(() => {});
      import('../lib/api').then(({ billingStatus }) =>
        billingStatus().then((res) => {
          if (!cancelled && res.ok && res.data) setBalance(res.data.balanceUsd);
        }).catch(() => {})
      );
    }, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, [hunt.huntId]);

  useEffect(() => {
    const handlers = {
      onEvent: (type, payload) => {
        if (type === 'thinking') {
          setLogs((prev) => [...prev.slice(-99), { kind: 'thinking', text: payload.text || payload.message || '', at: eventTimeMs(payload) }]);
        } else if (type === 'tool_call') {
          const line = payload.output
            ? `${payload.tool} → output received`
            : toolCallText(payload);
          setLogs((prev) => [...prev.slice(-99), { kind: 'tool', text: line, at: eventTimeMs(payload) }]);
        } else if (type === 'dedup_block') {
          setLogs((prev) => [...prev.slice(-99), { kind: 'thinking', text: `dedup_block: ${payload.tool || ''} ${payload.detail || ''}`.trim(), at: eventTimeMs(payload) }]);
        } else if (type === 'finding' || type === 'retraction') {
          // Lane V: never accumulate raw finding events in the panel.
          // The reconciled snapshot (loadHuntMemory -> panelFindings,
          // the same source chat counts from) is the only truth here;
          // a streamed finding/retraction just schedules a re-read.
          // (Demo mode has no backend to re-read — keep its scripted
          // findings, this time WITH the verified flag intact.)
          if (payload.demo) {
            if (type === 'finding') {
              setFindings((prev) => [
                ...prev,
                {
                  title: payload.title || 'Finding',
                  severity: String(payload.severity || 'low').toLowerCase(),
                  verified: payload.verified === true,
                  detail: payload.detail || '',
                },
              ]);
            }
          } else {
            refreshFindingsSoon();
          }
        } else if (type === 'status') {
          if (payload.status) updateStatus(payload.status);
          if (payload.phase) setPhase(payload.phase);
        } else if (type === 'done') {
          updateStatus('done');
          if (payload.summary) {
            setLogs((prev) => [...prev.slice(-99), { kind: 'thinking', text: payload.summary, at: eventTimeMs(payload) }]);
          }
        }
      },
      onError: () => {
        setStreamError(true);
        setStatus((s) => (s === 'idle' ? 'error' : s));
      },
      onClose: () => {},
    };

    let stream;
    try {
      stream = isDemoMode()
        ? createSimulatedStream(hunt.huntId, handlers)
        : new HuntStreamClient(hunt.huntId, handlers);
      stream.connect();
    } catch (err) {
      setStreamError(true);
      setStatus('error');
    }
    return () => stream && stream.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hunt.huntId]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [logs]);

  // 100% truth rule: only VERIFIED findings are shown as vulnerabilities.
  // Unverified leads are hypotheses, not vulnerabilities — they are counted
  // separately as "under investigation" and never presented as findings.
  const verifiedFindings = findings.filter((f) => f && f.verified === true);
  const unverifiedCount = findings.filter((f) => f && f.verified !== true).length;

  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0 };
    verifiedFindings.forEach((f) => {
      if (c[f.severity] !== undefined) c[f.severity] += 1;
      else c.low += 1;
    });
    return c;
  }, [verifiedFindings]);

  async function runControl(action, fn, successMsg) {
    setBusy(true);
    const res = await fn(hunt.huntId);
    setBusy(false);
    if (res.ok) {
      toast(successMsg, 'success');
      if (action === 'pause') updateStatus('paused');
      if (action === 'resume') updateStatus('running');
      if (action === 'stop') updateStatus('stopped');
    } else {
      toast(res.error || 'The backend did not accept the request.', 'error');
    }
  }

  const totalFindings = verifiedFindings.length;

  return (
    <div className="hunt-card">
      <div className="hunt-statusline">
        <span className={statusClass(status)}><span className="dot" aria-hidden="true" />{statusLabel(status)}</span>
        <span className="hunt-status-text">{statusText(status, hunt.target)}</span>
        {!isTerminal && (
          <span className="hunt-timer" title="Time since this hunt started">
            ⏱ {elapsedStr}
          </span>
        )}
        {phase && <span className="hunt-target-inline">{phase}</span>}
        {logs.length > 0 && (
          <button
            className="hunt-toggle-feed"
            onClick={() => setShowFeed((v) => !v)}
            aria-expanded={showFeed}
          >
            {showFeed ? 'Hide terminal' : 'Show terminal'}
          </button>
        )}
      </div>

      {streamError && (
        <div className="hunt-stream-warning">
          Live stream unavailable — control buttons still work, but live output will not update.
          <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      )}

      {showFeed && (
        <>
        <div className="hunt-money-strip" title="Wallet balance, money burnt on this hunt, and burn rate per iteration">
          <span className="hunt-money">💰 {balance === null ? '…' : `$${Number(balance).toFixed(2)}`} balance</span>
          <span className="hunt-money">🔥 ${cost && cost.totalUsd ? cost.totalUsd.toFixed(2) : '0.00'} burnt</span>
          <span className="hunt-money hunt-burn-rate">⚡ ${perIter.toFixed(2)}/iter</span>
        </div>
        <div className="hunt-feed" ref={logEndRef} aria-live="polite">
          {logs.length === 0 && <div className="empty-hint">{historyLoaded ? 'Waiting for hunt output…' : 'Loading hunt history…'}</div>}
          {logs.map((entry, idx) => (
            <div key={idx} className={`log-line${entry.kind === 'tool' ? ' log-tool' : entry.kind === 'finding' ? ' log-finding' : ' log-think'}`}>
              <span className="log-time">[{elapsedStamp(entry.at)}]</span>
              <span className="log-prefix" aria-hidden="true">
                {entry.kind === 'tool' ? '$' : entry.kind === 'finding' ? '✓' : '›'}
              </span>
              <span>{entry.text}</span>
            </div>
          ))}
        </div>
        </>
      )}

      {(totalFindings > 0 || unverifiedCount > 0) && (
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
          {totalFindings > 0 && (
          <ul className="findings-list">
            {verifiedFindings.map((f, idx) => (
              <li key={idx} className={`finding ${SEVERITY_CLASS[f.severity] || 'sev-low'}`}>
                <span className="finding-sev">{f.severity}</span>
                <span className="finding-title">{f.title}</span>
                <span className="finding-badge finding-verified" title={f.verification || 'Verified'}>
                  ✓ verified
                </span>
                {f.detail && <div className="finding-detail">{f.detail}</div>}
              </li>
            ))}
          </ul>
          )}
          {totalFindings > 0 && unverifiedCount > 0 && (
            <div className="hunt-investigating">
              + {unverifiedCount} lead{unverifiedCount === 1 ? '' : 's'} under investigation
            </div>
          )}
        </div>
      )}

      <div className="hunt-controls">
        {cost && cost.totalUsd > 0 && (
          <span className="hunt-cost" title="Money burnt on this hunt (AWS)">
            🔥 ${cost.totalUsd.toFixed(2)}
          </span>
        )}
        {isPaused ? (
          <button
            className="hunt-pill-btn"
            disabled={busy}
            onClick={() => runControl('resume', resumeHunt, 'Hunt resumed.')}
          >
            ▶ Resume
          </button>
        ) : (
          <button
            className="hunt-pill-btn"
            disabled={busy || isTerminal}
            onClick={() => runControl('pause', pauseHunt, 'Hunt paused.')}
          >
            ❚❚ Pause
          </button>
        )}
        <button
          className="hunt-pill-btn danger"
          disabled={busy || isTerminal}
          onClick={() => runControl('stop', stopHunt, 'Hunt stopped.')}
        >
          ■ Stop
        </button>
        {isTerminal && onRerun && (
          <button
            className="hunt-pill-btn"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              onRerun(hunt).finally(() => setBusy(false));
            }}
            title="Start a fresh hunt against the same target"
          >
            ↻ Re-run
          </button>
        )}
        {onTalkWithAI && (
          <button
            className="hunt-pill-btn talk"
            onClick={() => onTalkWithAI(hunt.huntId)}
            title="Talk with the AI about this hunt — voice conversation, works anytime"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
            </svg>
            Talk with AI
          </button>
        )}
        {onGetReport && (
          <button
            className="hunt-pill-btn"
            onClick={() => onGetReport(hunt.huntId)}
            title="Generate a professional bug bounty report from this hunt's findings and memory"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Get Report
          </button>
        )}
        {isActive && (
          <button
            className="hunt-pill-btn"
            onClick={() => setShowPiP((v) => !v)}
            title="Watch live terminal — see what the AI is doing"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="2" y="4" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 22h8M12 18v4" strokeLinecap="round" />
            </svg>
            {showPiP ? 'Hide Terminal' : 'Live Terminal'}
          </button>
        )}
        <span className="hunt-id">ID: {hunt.huntId}</span>
      </div>

      {showPiP && isActive && (
        <HuntPiP
          huntId={hunt.huntId}
          target={hunt.target}
          onExpand={() => setShowTerminalModal(true)}
          onClose={() => setShowPiP(false)}
        />
      )}
      {/* Live Machine: read-only picture-in-picture of the hunt machine's
          GUI desktop while this hunt is active. View-only by design — the
          pause/stop controls above remain the only way to control it. */}
      {isActive && (
        <LiveMachine huntId={hunt.huntId} target={hunt.target} />
      )}
      {showTerminalModal && (
        <HuntTerminalModal
          huntId={hunt.huntId}
          target={hunt.target}
          onClose={() => setShowTerminalModal(false)}
        />
      )}

      {isActive && (
        <div className="hunt-steer">
          <div className="hunt-steer-title">💬 Steer the hunter</div>
          <div className="hunt-steer-row">
            <input
              className="hunt-steer-input"
              value={steerMsg}
              onChange={(e) => { setSteerMsg(e.target.value); setSteerSent(false); }}
              placeholder="e.g. focus on the login page, try harder on XSS…"
              maxLength={500}
              disabled={steerBusy}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && steerMsg.trim() && !steerBusy) {
                  setSteerBusy(true);
                  steerHunt(hunt.huntId, steerMsg.trim()).then((r) => {
                    setSteerBusy(false);
                    if (r.ok) { setSteerSent(true); setSteerMsg(''); }
                    else toast.error(r.error || 'Could not send instruction');
                  });
                }
              }}
            />
            <button
              className="hunt-pill-btn"
              disabled={!steerMsg.trim() || steerBusy}
              onClick={() => {
                setSteerBusy(true);
                steerHunt(hunt.huntId, steerMsg.trim()).then((r) => {
                  setSteerBusy(false);
                  if (r.ok) { setSteerSent(true); setSteerMsg(''); }
                  else toast.error(r.error || 'Could not send instruction');
                });
              }}
            >
              {steerBusy ? 'Sending…' : 'Send'}
            </button>
          </div>
          {steerSent && <div className="hunt-steer-ok">✓ The hunter will follow your instruction next round.</div>}
        </div>
      )}

      {/* Plain-English activity: what the agent is doing, in words anyone
          can understand. Below the controls so it's always visible. */}
      <div className="hunt-human-log">
        <div className="hunt-human-title">🤖 Agent activity</div>
        <div className="hunt-human-feed">
          {humanLogEntries.length === 0 && (
            <div className="hunt-human-empty">Waking up the agent…</div>
          )}
          {humanLogEntries.map((entry, idx) => (
            <div key={idx} className="hunt-human-line">
              <span className="log-time">[{elapsedStamp(entry.at)}]</span>
              <span className="hunt-human-emoji">{entry.emoji}</span>
              <span>{entry.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
