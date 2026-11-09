// Hunt card — ChatGPT idiom: an assistant message with a progress card.
// Status line ("Hunting <target>…"), expandable event feed, findings stream,
// and Pause/Resume/Stop pill buttons. All stream/control logic unchanged.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { pauseHunt, resumeHunt, stopHunt, getHuntCost, setHuntBudget, getHuntEvents, steerHunt, listHunts, getHuntBrain, setHuntBrain, getHuntProcess, setBrainMode, agentChat, requestAiAnalysis } from '../lib/api';
import { HuntStreamClient, createSimulatedStream, isDemoMode } from '../lib/huntStream';
import { normalizeAiAnalysis, shouldAutoAnalyze } from '../lib/aiAnalysis';
import { toast } from '../lib/toast';
import { processSummary } from '../lib/brainActions';
import { groupFindingsByRoute } from '../lib/routeGroup';

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
import BrainConsole from './BrainConsole';
import FindingDetail from './FindingDetail';

export default function HuntCard({ hunt, onStatusChange, onRerun, onStartFresh, onTalkWithAI, onGetReport }) {
  const [status, setStatus] = useState(hunt.status || 'idle');
  // FIX (#448): status used to come from the useState initial value
  // only, so a NEW hunt snapshot for the same card (parent refetch:
  // 'starting' -> 'running') never moved the card. Adopt genuine
  // prop changes — the ref tracks the prop, not the local state, so
  // stream/control updates to local status are never clobbered by
  // this effect; only a changed prop value is adopted. Plain
  // setStatus, not updateStatus: echoing the parent's own value
  // back through onStatusChange would be noise.
  const prevHuntStatusRef = useRef(hunt.status);
  useEffect(() => {
    if (hunt.status && hunt.status !== prevHuntStatusRef.current) {
      prevHuntStatusRef.current = hunt.status;
      setStatus(hunt.status);
    }
  }, [hunt.status]);
  // MODEL-SWITCHER: model id -> display label. The loaded brain
  // state carries the list; the static map covers the render
  // before it arrives (and any id the list does not know).
  const BRAIN_LABELS = {
    'darkmatter-v1': 'Dark Matter V1',
    'muse-spark-1.3': 'Muse Spark 1.3',
    'muse-spark-1.2': 'Muse Spark 1.2',
    'muse-spark-1.1': 'Muse Spark 1.1',
    'muse-spark-1.3-contributor': 'Muse Spark 1.3 Contributor',
    'muse-spark-1.2-contributor': 'Muse Spark 1.2 Contributor',
    'muse-wonder-1.0': 'Muse Wonder 1.0',
  };
  const brainLabel = (id) => {
    const fromList = (brain && Array.isArray(brain.models) && brain.models.find((m) => m.id === id)) || null;
    return (fromList && fromList.label) || BRAIN_LABELS[id] || (id ? String(id) : '');
  };
  // BRAIN JSON (28 Oct 2026): the dropdown's "Be a Brain" option —
  // the parent as a selectable "model". Selecting it takes over as
  // the brain; selecting a model while the parent is the brain hands
  // back to the AI first — a model change must never silently bypass
  // the brain-mode switch.
  const PARENT_BRAIN_VALUE = 'parent-brain';
  // MODEL-SWITCHER (26 Oct 2026): the hunt's brain — Dark Matter V1
  // (local 8B, default) or a Meta text model, switched mid-hunt
  // from this card. `brain` holds the backend's state: selected,
  // active (V1 while the automatic fallback is covering for a
  // silent Meta), fallback, and the model list with availability.
  const [brain, setBrain] = useState(null);
  const [brainBusy, setBrainBusy] = useState(false);
  // FINDING DETAIL (28 Oct 2026): the title of the finding whose
  // detail modal is open, or null. Opening/closing it changes NO
  // hunt state — it only fetches that one finding's recorded detail.
  const [selectedFindingTitle, setSelectedFindingTitle] = useState(null);
  // BE A BRAIN (28 Oct 2026, owner order): who is the brain — 'ai'
  // (the loop drives) or 'parent' (the owner drives from the Brain
  // Console). null = unknown yet (backend predates the lane or the
  // process call failed); the button still works and the POST
  // reports the truth. Loaded from GET /process on mount so a
  // reload while the parent is the brain still shows the badge.
  const [brainMode, setBrainModeState] = useState(null);
  // LIVE UI (28 Oct 2026, owner order): the live process state from
  // GET /process — in_process, the activity line, the last action and
  // the desktop. Polled while the parent is the brain (the hunt is
  // 'paused' by design then, yet the work is live — the old UI showed
  // only 'PAUSED' and hid the machine entirely).
  const [liveProc, setLiveProc] = useState(null);
  const [brainConsoleOpen, setBrainConsoleOpen] = useState(false);
  const [brainModeBusy, setBrainModeBusy] = useState(false);
  // Button visibility rule (owner's spec): a live hunt shows Pause + Stop;
  // a paused hunt shows Resume + Stop. Terminal hunts show nothing clickable.
  const isPaused = status === 'paused' || status === 'out_of_credits';
  const isTerminal = ['done', 'stopped', 'failed', 'error'].includes(status);
  const isActive = ['running', 'paused'].includes(status);
  const isRunning = status === 'running' || status === 'starting';
  // LIVE MACHINE GATE (27 Oct 2026, live-machine fix): the live panel
  // renders ONLY while the hunt is actually running. A paused hunt's
  // container stays up, so its frozen desktop used to render a second
  // "live" panel next to the running hunt's — the owner saw two DVWA
  // live panels. Paused hunts show no live panel at all.
  const [showPiP, setShowPiP] = useState(false);
  const [showTerminalModal, setShowTerminalModal] = useState(false);
  const [cost, setCost] = useState(null);
  const [balance, setBalance] = useState(null);
  // BUDGET CAP (27 Oct 2026, owner order): the user's per-hunt spend
  // cap. The cost endpoint carries budgetUsd + pausedReason, refreshed
  // every 30s with the spend, so the display stays live.
  const budgetUsd = cost && typeof cost.budgetUsd === 'number' ? cost.budgetUsd : null;
  const spentUsd = cost && cost.totalUsd ? cost.totalUsd : 0;
  const isBudgetPaused = isPaused && cost && cost.pausedReason === 'budget_reached';
  const [budgetInput, setBudgetInput] = useState('');
  const [budgetBusy, setBudgetBusy] = useState(false);
  const refreshCost = () => {
    // COST ENVELOPE (27 Oct 2026): api.js wraps every response as
    // {ok, status, data} — the cost payload lives in res.data.
    // Storing the envelope made cost.budgetUsd undefined forever, so
    // the "Budget $X" chip and the "Spent $X of $Y" line could never
    // render and the input fell back to a literal '10' placeholder.
    return getHuntCost(hunt.huntId).then((res) => {
      if (res.ok && res.data) setCost(res.data);
    }).catch(() => {});
  };
  const saveBudget = async (value) => {
    setBudgetBusy(true);
    const res = await setHuntBudget(hunt.huntId, value);
    setBudgetBusy(false);
    if (res.ok) {
      // Apply the POST response at once — the owner sees the new cap
      // immediately instead of waiting for the next 30s cost poll.
      // POST returns {budgetUsd, spentUsd}; map spentUsd onto the
      // GET shape's totalUsd so the "Spent $X of $Y" line is right.
      if (res.data) {
        setCost((prev) => ({
          ...(prev || {}),
          budgetUsd: typeof res.data.budgetUsd === 'number' ? res.data.budgetUsd : null,
          totalUsd: typeof res.data.spentUsd === 'number' ? res.data.spentUsd : (prev && prev.totalUsd) || 0,
        }));
      }
      // Leave the saved value visible in the input; only a clear
      // blanks it. Clearing the input after a save is what made $5
      // look like it had reverted to 10.
      setBudgetInput(value === null ? '' : String((res.data && typeof res.data.budgetUsd === 'number') ? res.data.budgetUsd : value));
      refreshCost();
      toast(value === null ? 'Budget cleared.' : `Budget set to $${Number(value).toFixed(2)} — the hunt auto-pauses there.`, 'success');
    } else {
      toast((res.data && (res.data.message || res.data.error)) || res.error || 'Could not set the budget.', 'error');
    }
  };
  const ITERATION_PRICE = { normal: 0.1, medium: 0.15, high: 0.25, ultra_high: 0.4, max: 0.6, infinity: 1.0 };
  const perIter = ITERATION_PRICE[hunt.mode] || ITERATION_PRICE.normal;
  const [logs, setLogs] = useState(hunt.logs || []);
  const [findings, setFindings] = useState(hunt.findings || []);
  const [phase, setPhase] = useState(hunt.phase || '');
  const [busy, setBusy] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [streamReconnecting, setStreamReconnecting] = useState(false);
  const streamRef = useRef(null);
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
          .filter((e) => e.type === 'thinking' || e.type === 'tool_call' || e.type === 'dedup_block' || e.type === 'model_switch')
          .map((e) => {
            const at = (e.at || e.cachedAt) ? new Date(e.at || e.cachedAt).getTime() : Date.now();
            if (e.type === 'tool_call') return { kind: 'tool', text: toolCallText(e), at };
            if (e.type === 'dedup_block') {
              return { kind: 'thinking', text: `dedup_block: ${e.tool || ''} ${e.detail || ''}`.trim(), at };
            }
            if (e.type === 'model_switch') {
              const label = (id) => (brainLabel(id) || id);
              return { kind: 'thinking', text: `Brain switched: ${label(e.from)} → ${label(e.to)} (${e.reason || 'switch'})`, at };
            }
            return { kind: 'thinking', text: e.text || e.message || e.detail || '', at };
          })
          .filter((l) => l.text);
        if (mapped.length) setLogs(mapped.slice(-99));
        // PHASE 8 (31 Oct 2026): if createdAt still unresolved, fall back to
        // the earliest event timestamp — prevents the --:--:-- timer on
        // fresh loads where hunt.createdAt and listHunts() lack the field.
        const earliest = evts
          .map((e) => (e.at || e.cachedAt) ? new Date(e.at || e.cachedAt).getTime() : 0)
          .filter((t) => t > 0)
          .sort((a, b) => a - b)[0];
        if (earliest) {
          setResolvedCreatedAt((prev) => prev || new Date(earliest).toISOString());
        }
      }).catch(() => { if (!cancelled) setHistoryLoaded(true); })
    );
    return () => { cancelled = true; };
  }, [hunt.huntId]);

  // BE A BRAIN: learn who the brain is (GET /process carries
  // brainMode). A 404/failed call just leaves it unknown — the
  // console's own load reports the same, and the POST is the
  // authority when the owner clicks.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getHuntProcess(hunt.huntId).then((r) => {
        if (!cancelled && r && r.ok && r.data) {
          if (r.data.brainMode) setBrainModeState(r.data.brainMode);
          setLiveProc(processSummary(r.data));
        }
      }).catch(() => {});
    };
    load();
    // While the parent is the brain the hunt is paused yet live — poll
    // the process state so the activity line and the live panel follow
    // the work. Otherwise the mount load is enough.
    const timer = setInterval(() => { if (brainMode === 'parent') load(); }, 15000);
    return () => { cancelled = true; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hunt.huntId, brainMode]);

  // BE A BRAIN: take over as the brain — POST brain-mode
  // {mode:'parent'} pauses the AI loop, then open the console.
  // If the parent is already the brain, just open the console.
  const takeOverAsBrain = async () => {
    if (brainMode === 'parent') {
      setBrainConsoleOpen(true);
      return;
    }
    setBrainModeBusy(true);
    const res = await setBrainMode(hunt.huntId, 'parent');
    setBrainModeBusy(false);
    if (res.ok) {
      setBrainModeState('parent');
      if (res.data && res.data.state) updateStatus(res.data.state);
      setBrainConsoleOpen(true);
      toast('You are the brain now — the AI loop is paused.', 'success');
    } else {
      toast(res.error || 'Could not take over as the brain.', 'error');
    }
  };

  // BE A BRAIN: the console handed back — the AI loop resumes.
  const handleBrainModeChange = (mode, state) => {
    setBrainModeState(mode);
    if (state) updateStatus(state);
  };

  // BRAIN JSON (28 Oct 2026): the Brain/model dropdown's change.
  // Selecting "Be a Brain" does exactly what the gold button does
  // (POST brain-mode {mode:'parent'} + open the console). Selecting
  // a model while the parent is the brain hands back to the AI
  // FIRST (POST brain-mode {mode:'ai'}, console closes) and only
  // then switches the model — the dropdown never offers a model
  // change that bypasses the brain-mode switch. If the hand-back
  // fails, the model is NOT switched.
  const handleBrainSelect = async (e) => {
    const value = e.target.value;
    if (value === PARENT_BRAIN_VALUE) {
      await takeOverAsBrain();
      return;
    }
    if (!value) return;
    if (brainMode === 'parent') {
      setBrainBusy(true);
      const r = await setBrainMode(hunt.huntId, 'ai');
      if (!r.ok) {
        setBrainBusy(false);
        toast((r.data && (r.data.message || r.data.error)) || r.error || 'Could not hand back to the AI.', 'error');
        refreshBrain();
        return;
      }
      setBrainModeState('ai');
      if (r.data && r.data.state) updateStatus(r.data.state);
      setBrainConsoleOpen(false);
      const m = await setHuntBrain(hunt.huntId, value);
      setBrainBusy(false);
      if (m.ok && m.data && m.data.brain) {
        setBrain(m.data.brain);
        toast(`Handed back to the AI — brain switched to ${brainLabel(value)}.`, 'success');
      } else {
        toast((m.data && (m.data.message || m.data.error)) || m.error || 'Handed back to the AI, but the brain could not be switched.', 'error');
        refreshBrain();
      }
      return;
    }
    if (value === brain.selected) return;
    setBrainBusy(true);
    const r = await setHuntBrain(hunt.huntId, value);
    setBrainBusy(false);
    if (r.ok && r.data && r.data.brain) {
      setBrain(r.data.brain);
      toast(`Brain switched to ${brainLabel(value)}.`, 'success');
    } else {
      toast((r.data && (r.data.message || r.data.error)) || r.error || 'Could not switch brain.', 'error');
      refreshBrain();
    }
  };
  // MODEL-SWITCHER: load the hunt's brain state once (selected /
  // active model, fallback, model list). Refreshed after a switch
  // and whenever a model_switch event arrives on the stream.
  const refreshBrain = () => {
    getHuntBrain(hunt.huntId).then((r) => {
      if (r && r.ok && r.data && r.data.brain) setBrain(r.data.brain);
    }).catch(() => {});
  };
  useEffect(() => {
    refreshBrain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // FIX (#448): the old effect early-returned when createdAt was
    // set — which is the common case for hunts from history — so the
    // status refresh inside it NEVER ran for those hunts, and the
    // card kept its mount-time status. The createdAt resolution
    // keeps its fast path, but the status refresh now runs
    // regardless, via a single listHunts call. The functional
    // setStatus also drops the stale-closure comparison against
    // the mount-time status value.
    if (hunt.createdAt) setResolvedCreatedAt(hunt.createdAt);
    let cancelled = false;
    listHunts().then((r) => {
      if (cancelled || !r.ok) return;
      const found = (r.data.hunts || []).find((h) => h.huntId === hunt.huntId);
      if (!found) return;
      if (!hunt.createdAt && found.createdAt) setResolvedCreatedAt(found.createdAt);
      if (found.status) setStatus((s) => (found.status !== s ? found.status : s));
    });
    return () => { cancelled = true; };
  }, [hunt.huntId]);
  const [steerMsg, setSteerMsg] = useState('');
  const [steerSent, setSteerSent] = useState(false);
  const [steerBusy, setSteerBusy] = useState(false);
  // AGENT CHAT (3 Nov 2026, owner order): talk to the scan agent about an
  // Autonomous hunt — scoped to the hunt's findings, answered by Meta API.
  const [agentChatOpen, setAgentChatOpen] = useState(false);
  const [agentChatMsgs, setAgentChatMsgs] = useState([]);
  const [agentChatInput, setAgentChatInput] = useState('');
  const [agentChatBusy, setAgentChatBusy] = useState(false);
  // AI BEHAVIOUR ANALYSIS (8 Nov 2026, owner idea): when a scanner hunt
  // finishes, the card fires ONE POST /ai-analysis automatically. The
  // backend is idempotent; the ref guard makes it one attempt per
  // huntId per session — never loop on failure.
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const aiAnalysisAttemptedRef = useRef(new Set());
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
      if (!cancelled && res.ok && res.data) setCost(res.data);
    }).catch(() => {});
    import('../lib/api').then(({ getPaymentStatus }) =>
      getPaymentStatus().then((res) => {
        if (!cancelled && res.ok && res.data) setBalance(res.data.balanceUsd);
      }).catch(() => {})
    );
    const t = setInterval(() => {
      getHuntCost(hunt.huntId).then((res) => {
        if (!cancelled && res.ok && res.data) setCost(res.data);
      }).catch(() => {});
      import('../lib/api').then(({ getPaymentStatus }) =>
        getPaymentStatus().then((res) => {
          if (!cancelled && res.ok && res.data) setBalance(res.data.balanceUsd);
        }).catch(() => {})
      );
    }, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, [hunt.huntId]);

  useEffect(() => {
    const handlers = {
      onEvent: (type, payload) => {
        // A live event means the socket is back: clear the
        // reconnecting banner (FIX #443).
        setStreamReconnecting(false);
        if (type === 'thinking') {
          setLogs((prev) => [...prev.slice(-99), { kind: 'thinking', text: payload.text || payload.message || '', at: eventTimeMs(payload) }]);
        } else if (type === 'tool_call') {
          const line = payload.output
            ? `${payload.tool} → output received`
            : toolCallText(payload);
          setLogs((prev) => [...prev.slice(-99), { kind: 'tool', text: line, at: eventTimeMs(payload) }]);
        } else if (type === 'dedup_block') {
          setLogs((prev) => [...prev.slice(-99), { kind: 'thinking', text: `dedup_block: ${payload.tool || ''} ${payload.detail || ''}`.trim(), at: eventTimeMs(payload) }]);
        } else if (type === 'chat_answer') {
          // REAL-HUMAN (26 Oct 2026): the brain answered an owner
          // question in-turn — surface it in the hunt feed so the
          // owner sees the answer even while looking at the hunt
          // card, not just in the chat thread.
          const line = (payload.answer || '').slice(0, 200);
          setLogs((prev) => [...prev.slice(-99), { kind: 'thinking', text: `Answered your question: ${line}`, at: eventTimeMs(payload) }]);
        } else if (type === 'model_switch') {
          // MODEL-SWITCHER (26 Oct 2026): the brain changed — a
          // manual switch, an automatic fallback to the 8B, or a
          // switch back after Meta recovered. Surface it in the
          // feed and refresh the control so it shows the model
          // actually answering now.
          const line = `Brain switched: ${brainLabel(payload.from)} → ${brainLabel(payload.to)} (${payload.reason || 'switch'})`;
          setLogs((prev) => [...prev.slice(-99), { kind: 'thinking', text: line, at: eventTimeMs(payload) }]);
          refreshBrain();
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
      // FIX (#443): the client now auto-reconnects on a transient
      // drop (up to 5 attempts, backoff). Show "reconnecting"
      // instead of the error banner; only a final close after
      // exhausted retries surfaces the error + Retry button.
      onReconnecting: () => {
        setStreamReconnecting(true);
        setStreamError(false);
      },
      onClose: (reason) => {
        setStreamReconnecting(false);
        if (reason === 'exhausted') setStreamError(true);
      },
    };

    let stream;
    try {
      stream = isDemoMode()
        ? createSimulatedStream(hunt.huntId, handlers)
        : new HuntStreamClient(hunt.huntId, handlers);
      streamRef.current = stream;
      stream.connect();
    } catch (err) {
      setStreamError(true);
      setStatus('error');
    }
    return () => {
      streamRef.current = null;
      stream && stream.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hunt.huntId]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [logs]);

  // 100% truth rule: only VERIFIED findings are shown as vulnerabilities.
  // Unverified leads are hypotheses, not vulnerabilities — they are
  // NEVER given a verified badge. But they ARE shown (27 Oct 2026,
  // live-report fix): before this change a hunt with 0 verified
  // findings showed only the bare count "N leads under investigation"
  // with no title, severity or evidence — the owner could not see any
  // report building live. Leads now render as lead rows (title +
  // severity + evidence snippet + "under investigation" badge) while
  // the verified list above stays verified-only.
  // P0 (31 Oct 2026): probe/test names must never count as verified
  // findings, even if the backend stamped verified:true (defense in
  // depth — the backend guard is primary). A title starting with
  // "probe_" (or matching test-name patterns) is a probe note, not a
  // vulnerability.
  const isProbeName = (t) => {
    const s = String(t || '').trim().toLowerCase();
    return /^probe[_-]/.test(s) || /[_-]probe([_-]|$)/.test(s) || /[_-]test([_-]|$)/.test(s) || /^test[_-]/.test(s);
  };
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

  const totalFindings = uniqueVerifiedFindings.length;

  // FINDINGS BY ROUTE (9 Nov 2026, /* scope): a whole-site hunt
  // groups its findings under the route each was found on, so the
  // panel answers "which route had what". Page-scope hunts keep the
  // flat list. The route comes from the panel row's url (the backend
  // carries the verified stamp's URL on the row); rows without one
  // group under the hunt target.
  const isSiteScope = hunt.scanScope === 'site';
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
        onClick={() => setSelectedFindingTitle(f.title)}
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
        onClick={() => setSelectedFindingTitle(f.title)}
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

  // AUTONOMOUS MODE (3 Nov 2026, owner order): the rule-based scanner hunt
  // ("Infinity Autonomous") spends $0 and has no brain to take over — so the
  // Brain button, Brain model selector, money strip and budget controls are
  // hidden for scanner hunts. Hunt ID, agent activity, chat, report and
  // terminal controls stay visible.
  const isScanner = brainMode === 'scanner' || (!brainMode && hunt.brainMode === 'scanner');

  // AI BEHAVIOUR ANALYSIS (8 Nov 2026, owner idea): fire the one
  // automatic POST /ai-analysis the moment a scanner hunt reaches
  // finished/done. Skipped in demo mode (no backend). The result —
  // suggestions are LEADS, never confirmed findings — renders in the
  // "AI analysis" section below.
  useEffect(() => {
    if (isDemoMode()) return;
    if (!shouldAutoAnalyze({ isScanner, status, huntId: hunt.huntId, attemptedHuntIds: aiAnalysisAttemptedRef.current })) return;
    aiAnalysisAttemptedRef.current.add(hunt.huntId);
    let cancelled = false;
    setAiAnalysis({ state: 'loading', suggestions: [], error: null, note: null });
    requestAiAnalysis(hunt.huntId)
      .then((r) => {
        if (cancelled) return;
        if (r && r.ok) setAiAnalysis(normalizeAiAnalysis(r));
        else setAiAnalysis({ state: 'error', suggestions: [], error: 'AI analysis ka jawab nahi mila.', note: null });
      })
      .catch(() => {
        if (cancelled) return;
        setAiAnalysis({ state: 'error', suggestions: [], error: 'AI analysis ka jawab nahi mila.', note: null });
      });
    return () => { cancelled = true; };
  }, [isScanner, status, hunt.huntId]);

  // AGENT CHAT: send one message to the scan agent, append the scoped reply.
  async function sendAgentChatMsg() {
    const text = agentChatInput.trim();
    if (!text || agentChatBusy) return;
    setAgentChatBusy(true);
    setAgentChatMsgs((prev) => [...prev, { role: 'user', text }]);
    setAgentChatInput('');
    try {
      const r = await agentChat(hunt.huntId, text);
      const reply = r && r.ok && r.data && r.data.reply;
      setAgentChatMsgs((prev) => [...prev, {
        role: 'agent',
        text: reply || 'Agent se jawab nahi mila — thodi der me phir try karo.',
      }]);
    } catch {
      setAgentChatMsgs((prev) => [...prev, {
        role: 'agent',
        text: 'Agent se connect nahi ho paya — thodi der me phir try karo.',
      }]);
    } finally {
      setAgentChatBusy(false);
    }
  }

  return (
    <div className="hunt-card">
      <div className="hunt-statusline">
        <span className={statusClass(status)}><span className="dot" aria-hidden="true" />{statusLabel(status)}</span>
        <span className="hunt-id-badge" title={`Full hunt ID: ${hunt.huntId}`}>{hunt.huntId ? hunt.huntId.slice(0, 12) : ''}</span>
        <span className="hunt-status-text">{statusText(status, hunt.target)}</span>
        {brainMode === 'parent' && (
          <span className="brain-mode-badge" role="status" title={isPaused ? "The AI loop is paused — you are driving this hunt from the Brain Console" : "Parent-brain mode — the hunt loop is live; you supply each turn's decision from the Brain Console"}>
            🧠 You are the brain
          </span>
        )}
        {(brainMode === 'scanner' || (!brainMode && hunt.brainMode === 'scanner')) && (
          <span className="brain-mode-badge" role="status" title="Infinity Autonomous — rule-based scan, no AI, $0">
            ⚡ Autonomous
          </span>
        )}
        {(brainMode === 'ai' || (hunt.brainMode && hunt.brainMode !== 'scanner')) && (
          <span className="brain-mode-badge" role="status" title="Infinity AI — AI agent hunts autonomously">
            🤖 AI
          </span>
        )}
        {brainMode === 'parent' && liveProc && liveProc.activity && (
          <span className="hunt-live-activity" role="status" title={liveProc.in_process ? 'A process is running right now' : 'No process running right now'}>
            <span className={liveProc.in_process ? 'hunt-live-dot live' : 'hunt-live-dot'} aria-hidden="true" />
            {liveProc.activity}
            {liveProc.in_process ? ' · in process' : ' · idle'}
          </span>
        )}
        {!isTerminal && (
          <span className="hunt-timer" title={isPaused ? "Total time elapsed (hunt paused)" : "Time since this hunt started"}>
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

      {isBudgetPaused && (
        <div className="hunt-budget-banner">
          ⏸ Paused — budget reached (${budgetUsd !== null ? `$${budgetUsd.toFixed(2)}` : 'budget'}). Spent ${spentUsd.toFixed(2)}.
          Raise the budget above ${spentUsd.toFixed(2)}, then press Resume — the hunt continues from its checkpoint, never from scratch.
        </div>
      )}

      {streamReconnecting && (
        <div className="hunt-stream-warning">
          Live stream reconnecting — live output will resume automatically.
        </div>
      )}

      {streamError && (
        <div className="hunt-stream-warning">
          Live stream unavailable — control buttons still work, but live output will not update.
          <button className="btn btn-ghost btn-sm" onClick={() => { setStreamError(false); const s = streamRef.current; if (s) { if (s.reconnect) s.reconnect(); else s.connect(); } }}>
            Retry
          </button>
        </div>
      )}

      {showFeed && (
        <>
        {!isScanner && (
        <div className="hunt-money-strip" title="Wallet balance, money burnt on this hunt, and burn rate per iteration">
          <span className="hunt-money">💰 {balance === null ? '…' : `$${Number(balance).toFixed(2)}`} balance</span>
          <span className="hunt-money">🔥 ${cost && cost.totalUsd ? cost.totalUsd.toFixed(2) : '0.00'} burnt</span>
          {budgetUsd !== null && (
            <span className="hunt-money" title="Spend cap for this hunt — the hunt auto-pauses at the budget">🎯 Budget ${budgetUsd.toFixed(2)}</span>
          )}
          <span className="hunt-money hunt-burn-rate">⚡ ${perIter.toFixed(2)}/iter</span>
        </div>
        )}
        {!isScanner && (
        <div className="hunt-budget-row" title="Spend cap for this hunt — at the budget the hunt auto-pauses with a checkpoint; Resume continues from there">
          <label className="hunt-budget-label" htmlFor={`budget-${hunt.huntId}`}>Budget $</label>
          <input
            id={`budget-${hunt.huntId}`}
            className="hunt-budget-input"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder={budgetUsd !== null ? `Current $${budgetUsd.toFixed(2)}` : 'No budget set'}
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            disabled={budgetBusy}
          />
          <button
            className="btn btn-sm"
            disabled={budgetBusy || budgetInput.trim() === ''}
            onClick={() => saveBudget(budgetInput.trim())}
          >
            Set
          </button>
          {budgetUsd !== null && (
            <button className="btn btn-ghost btn-sm" disabled={budgetBusy} onClick={() => saveBudget(null)}>
              Clear
            </button>
          )}
          {budgetUsd !== null && (
            <span className="hunt-budget-spent">Spent ${spentUsd.toFixed(2)} of ${budgetUsd.toFixed(2)}</span>
          )}
        </div>
        )}
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
      )}

      {/* FINDING DETAIL (28 Oct 2026): the modal for the selected
          row. Closing it returns to the list with no state change. */}
      {selectedFindingTitle && (
        <FindingDetail
          huntId={hunt.huntId}
          title={selectedFindingTitle}
          onClose={() => setSelectedFindingTitle(null)}
        />
      )}

      <div className="hunt-controls">
        {/* MONEY DISPLAY (owner order 3 Nov): scanner hunts show $0 and no
            spend UI — hide the burnt-money pill like the money strip. */}
        {!isScanner && cost && cost.totalUsd > 0 && (
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
        {isPaused && onStartFresh && (
          <button
            className="hunt-pill-btn"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              onStartFresh(hunt).finally(() => setBusy(false));
            }}
            title="Start a brand-new hunt against the same target — fresh memory, the paused hunt stays untouched with its checkpoint"
          >
            ↻ Start from scratch
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
        {isScanner && (
          <button
            className="hunt-pill-btn talk"
            onClick={() => setAgentChatOpen((v) => !v)}
            aria-expanded={agentChatOpen}
            title="Chat with the scan agent about this hunt's findings — answers from the scan data, stays on topic"
          >
            💬 {agentChatOpen ? 'Hide Agent Chat' : 'Chat with Agent'}
          </button>
        )}
        {onGetReport && (
          <button
            className="hunt-pill-btn"
            onClick={() => onGetReport(hunt.huntId, isScanner ? 'scanner' : brainMode)}
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
        {isActive && !isScanner && (
          <button
            className="hunt-pill-btn brain-takeover"
            disabled={brainModeBusy}
            onClick={takeOverAsBrain}
            title={brainMode === 'parent'
              ? 'Open the Brain Console — you are already the brain'
              : 'Become the brain: pause the AI loop and drive the next actions yourself'}
          >
            {brainModeBusy ? 'Taking over…' : brainMode === 'parent' ? '🧠 Open Brain Console' : '🧠 Be a Brain'}
          </button>
        )}
        {brain && !isScanner && (
          <label className="hunt-model" title="The brain thinking for this hunt — switch mid-hunt; the new brain continues with the same state, history and memory">
            <span className="hunt-model-label">Brain:</span>
            <select
              className="hunt-model-select"
              value={brainMode === 'parent' ? PARENT_BRAIN_VALUE : brain.selected}
              disabled={brainBusy || isTerminal}
              onChange={handleBrainSelect}
            >
              {/* BRAIN JSON: the parent as a selectable "model" — same
                  takeover as the gold "Be a Brain" button. While the
                  parent is the brain this option stays selected. */}
              <option value={PARENT_BRAIN_VALUE}>🧠 Be a Brain (you)</option>
              {(brain.models || []).map((m) => (
                <option key={m.id} value={m.id} disabled={!m.available} title={m.available ? m.blurb : 'Not available — the Meta API key is not configured on the backend'}>
                  {m.label}{m.available ? '' : ' (unavailable)'}
                </option>
              ))}
            </select>
            {brain.fallback && (
              <span className="hunt-model-fallback" title={`Meta (${brainLabel(brain.selected)}) is not responding — the hunt is answering on Dark Matter V1 until Meta recovers`}>
                fallback: answering on V1
              </span>
            )}
          </label>
        )}
        <span className="hunt-id">ID: {hunt.huntId}</span>
      </div>

      {/* AGENT CHAT (3 Nov 2026, owner order): text chat with the scan agent
          for Autonomous hunts — scoped to this hunt's findings. */}
      {isScanner && agentChatOpen && (
        <div className="hunt-agent-chat">
          <div className="hunt-agent-chat-title">💬 Agent chat — is scan ke findings pe sawal poocho</div>
          <div className="hunt-agent-chat-feed">
            {agentChatMsgs.length === 0 && (
              <div className="hunt-agent-chat-empty">
                e.g. "kitni findings mili?", "sabse serious kaunsi hai?", "ise kaise fix karun?"
              </div>
            )}
            {agentChatMsgs.map((m, idx) => (
              <div key={idx} className={`hunt-agent-chat-line ${m.role}`}>
                <span className="hunt-agent-chat-who">{m.role === 'user' ? 'You' : 'Agent'}</span>
                <span>{m.text}</span>
              </div>
            ))}
            {agentChatBusy && <div className="hunt-agent-chat-line agent"><span className="hunt-agent-chat-who">Agent</span><span>soch raha hai…</span></div>}
          </div>
          <div className="hunt-agent-chat-row">
            <input
              className="hunt-agent-chat-input"
              value={agentChatInput}
              onChange={(e) => setAgentChatInput(e.target.value)}
              placeholder="Is scan ke baare me poocho…"
              maxLength={500}
              disabled={agentChatBusy}
              onKeyDown={(e) => { if (e.key === 'Enter') sendAgentChatMsg(); }}
            />
            <button
              className="hunt-pill-btn"
              disabled={!agentChatInput.trim() || agentChatBusy}
              onClick={sendAgentChatMsg}
            >
              {agentChatBusy ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}

      {/* AI BEHAVIOUR ANALYSIS (8 Nov 2026, owner idea): Meta AI read
          the hunt's full behaviour and proposes NEW vulnerabilities the
          predefined battery may have missed. Suggestions are LEADS —
          labelled "AI-suggested lead — unverified" — never confirmed
          findings, and never counted in the findings totals above. */}
      {isScanner && aiAnalysis && (
        <div className="hunt-agent-chat">
          <div className="hunt-agent-chat-title">🤖 AI analysis — behaviour se nayi leads</div>
          {aiAnalysis.state === 'loading' && (
            <div className="hunt-agent-chat-empty">AI analysis chal rahi hai…</div>
          )}
          {aiAnalysis.state === 'ready' && aiAnalysis.suggestions.length === 0 && (
            <div className="hunt-agent-chat-empty">AI ko behaviour se koi nayi lead nahi mili.</div>
          )}
          {aiAnalysis.state === 'ready' && aiAnalysis.suggestions.length > 0 && (
            <div className="hunt-agent-chat-feed">
              {aiAnalysis.suggestions.map((s, idx) => (
                <div key={idx} className="hunt-agent-chat-line agent">
                  <span className="hunt-agent-chat-who">Lead</span>
                  <span>
                    <strong>{s.title}</strong> [{s.severity}]
                    <br />AI-suggested lead — unverified
                    {s.reasoning ? (<><br />{s.reasoning}</>) : null}
                    {s.verification ? (<><br />Verify: {s.verification}</>) : null}
                  </span>
                </div>
              ))}
            </div>
          )}
          {aiAnalysis.state === 'unavailable' && (
            <div className="hunt-agent-chat-empty">Meta AI abhi available nahi hai{aiAnalysis.error ? ` (${aiAnalysis.error})` : ''}.</div>
          )}
          {aiAnalysis.state === 'error' && (
            <div className="hunt-agent-chat-empty">{aiAnalysis.error || 'AI analysis ka jawab nahi mila.'}</div>
          )}
        </div>
      )}

      {/* BE A BRAIN (28 Oct 2026): the console replaces the floating
          LiveMachine while it is open — the console embeds its own
          LiveMachine, so the PiP would double the screen. */}
      {brainConsoleOpen && (
        <BrainConsole
          huntId={hunt.huntId}
          target={hunt.target}
          onClose={() => setBrainConsoleOpen(false)}
          onBrainModeChange={handleBrainModeChange}
        />
      )}
      {showPiP && isActive && (
        <HuntPiP
          huntId={hunt.huntId}
          target={hunt.target}
          onExpand={() => setShowTerminalModal(true)}
          onClose={() => setShowPiP(false)}
        />
      )}
      {/* Live Machine: read-only picture-in-picture of the hunt machine's
          GUI desktop while this hunt is running. Running hunts, PLUS
          parent-brain hunts with a process actually running (28 Oct
          2026, owner order): a parent-brain hunt is 'paused' by design
          — the AI loop is off — yet the parent IS working the machine
          live, and the old gate hid the machine exactly then. A paused
          hunt with NO running process still shows no panel (the 27 Oct
          fix stands: a frozen desktop is not 'live'). View-only by
          design — the pause/stop controls above remain the only way
          to control it. */}
      {(isRunning || (brainMode === 'parent' && liveProc && liveProc.in_process)) && !brainConsoleOpen && (
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
                    else toast(r.error || 'Could not send instruction', 'error');
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
                  else toast(r.error || 'Could not send instruction', 'error');
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
