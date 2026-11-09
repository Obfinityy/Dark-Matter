// Hunt card — ChatGPT idiom: an assistant message with a progress card.
// Status line ("Hunting <target>…"), expandable event feed, findings stream,
// and Pause/Resume/Stop pill buttons. All stream/control logic unchanged.
// Split (P6): status line -> huntcard/HuntStatusLine, money strip ->
// huntcard/HuntMoneyStrip, findings -> huntcard/HuntFindings, controls +
// steer -> huntcard/HuntControls, agent panels -> huntcard/HuntAgentPanels,
// activity humanizer -> huntcard/humanizeActivity.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getHuntCost, setHuntBudget, getHuntEvents, listHunts, getHuntBrain, setHuntBrain, getHuntProcess, setBrainMode, agentChat, requestAiAnalysis } from '../lib/api';
import { HuntStreamClient, createSimulatedStream, isDemoMode } from '../lib/huntStream';
import { normalizeAiAnalysis, shouldAutoAnalyze } from '../lib/aiAnalysis';
import { toast } from '../lib/toast';
import { processSummary } from '../lib/brainActions';
import { humanizeActivityLogs } from './huntcard/humanizeActivity';
import HuntStatusLine from './huntcard/HuntStatusLine';
import HuntMoneyStrip from './huntcard/HuntMoneyStrip';
import HuntFindings from './huntcard/HuntFindings';
import HuntControls from './huntcard/HuntControls';
import HuntAgentPanels from './huntcard/HuntAgentPanels';

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

  // MODEL-SWITCHER: load the hunt's brain state once (selected /
  // active model, fallback, model list). Refreshed after a switch
  // and whenever a model_switch event arrives on the stream.
  // Stable per huntId (refs + setters only) so effects can list it
  // as a dep instead of disabling exhaustive-deps.
  const refreshBrain = useCallback(() => {
    getHuntBrain(hunt.huntId).then((r) => {
      if (r && r.ok && r.data && r.data.brain) setBrain(r.data.brain);
    }).catch(() => {});
  }, [hunt.huntId]);

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
  useEffect(() => {
    refreshBrain();
  }, [refreshBrain]);

  // Lane V: keep the panel's findings on the reconciled snapshot
  // while the stream runs. A streamed 'finding'/'retraction' event
  // is a signal to re-read the snapshot (debounced), never a row to
  // append raw — raw accumulation is what desynced the panel from
  // chat (dropped `verified`, no retractions, duplicate stamps).
  const findingsTimerRef = useRef(null);
  const refreshFindings = useCallback(() => {
    getHuntEvents(hunt.huntId, 200).then((r) => {
      if (r && r.ok && r.data && Array.isArray(r.data.findings)) setFindings(r.data.findings);
    }).catch(() => {});
  }, [hunt.huntId]);
  const refreshFindingsSoon = useCallback(() => {
    if (findingsTimerRef.current) clearTimeout(findingsTimerRef.current);
    findingsTimerRef.current = setTimeout(refreshFindings, 800);
  }, [refreshFindings]);
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

  // Plain-English activity feed (see huntcard/humanizeActivity).
  const humanLogEntries = humanizeActivityLogs(logs, hunt.target);

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

  // Latest-callback ref for the stream effect below: the stream
  // subscribes once per huntId and must NOT reconnect when the
  // callbacks change identity each render (brainLabel reads `brain`
  // state; updateStatus closes over the onStatusChange prop). The
  // handlers read the ref at event time, so they always see the
  // latest callbacks without re-subscribing. Refs are exempt from
  // exhaustive-deps, so [hunt.huntId] is the complete dep list.
  const streamCallbacksRef = useRef({});
  useEffect(() => {
    streamCallbacksRef.current = { brainLabel, updateStatus, refreshBrain, refreshFindingsSoon };
  });

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
          const line = `Brain switched: ${streamCallbacksRef.current.brainLabel(payload.from)} → ${streamCallbacksRef.current.brainLabel(payload.to)} (${payload.reason || 'switch'})`;
          setLogs((prev) => [...prev.slice(-99), { kind: 'thinking', text: line, at: eventTimeMs(payload) }]);
          streamCallbacksRef.current.refreshBrain();
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
            streamCallbacksRef.current.refreshFindingsSoon();
          }
        } else if (type === 'status') {
          if (payload.status) streamCallbacksRef.current.updateStatus(payload.status);
          if (payload.phase) setPhase(payload.phase);
        } else if (type === 'done') {
          streamCallbacksRef.current.updateStatus('done');
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
  }, [hunt.huntId]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [logs]);

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

  // FINDINGS BY ROUTE (9 Nov 2026, /* scope): a whole-site hunt
  // groups its findings under the route each was found on, so the
  // panel answers "which route had what". Page-scope hunts keep the
  // flat list.
  const isSiteScope = hunt.scanScope === 'site';

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
      <HuntStatusLine
        status={status}
        huntId={hunt.huntId}
        target={hunt.target}
        huntBrainMode={hunt.brainMode}
        brainMode={brainMode}
        liveProc={liveProc}
        elapsedStr={elapsedStr}
        phase={phase}
        hasLogs={logs.length > 0}
        showFeed={showFeed}
        onToggleFeed={() => setShowFeed((v) => !v)}
        isPaused={isPaused}
        isTerminal={isTerminal}
      />

      {isBudgetPaused && (
        <div className="hunt-budget-banner">
          ⏸ Paused — budget reached (${budgetUsd !== null ? `$${budgetUsd.toFixed(2)}` : 'budget'}). Spent ${spentUsd.toFixed(2)}.
          Raise the budget above ${spentUsd.toFixed(2)}, then press Resume — the hunt continues from its checkpoint, never from scratch.
        </div>
      )}

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
        <HuntMoneyStrip
          isScanner={isScanner}
          balance={balance}
          cost={cost}
          budgetUsd={budgetUsd}
          spentUsd={spentUsd}
          perIter={perIter}
          budgetInput={budgetInput}
          onBudgetInput={setBudgetInput}
          budgetBusy={budgetBusy}
          onSaveBudget={saveBudget}
          huntId={hunt.huntId}
        />
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

      <HuntFindings
        findings={findings}
        hunt={hunt}
        isSiteScope={isSiteScope}
        onSelectFinding={setSelectedFindingTitle}
      />

      {/* FINDING DETAIL (28 Oct 2026): the modal for the selected
          row. Closing it returns to the list with no state change. */}
      {selectedFindingTitle && (
        <FindingDetail
          huntId={hunt.huntId}
          title={selectedFindingTitle}
          onClose={() => setSelectedFindingTitle(null)}
        />
      )}

      <HuntControls
        hunt={hunt}
        isScanner={isScanner}
        cost={cost}
        isPaused={isPaused}
        isTerminal={isTerminal}
        isActive={isActive}
        busy={busy}
        onBusy={setBusy}
        runControl={runControl}
        onRerun={onRerun}
        onStartFresh={onStartFresh}
        onTalkWithAI={onTalkWithAI}
        agentChatOpen={agentChatOpen}
        onToggleAgentChat={() => setAgentChatOpen((v) => !v)}
        onGetReport={onGetReport}
        brainMode={brainMode}
        showPiP={showPiP}
        onTogglePiP={() => setShowPiP((v) => !v)}
        brainModeBusy={brainModeBusy}
        onTakeOverAsBrain={takeOverAsBrain}
        brain={brain}
        brainBusy={brainBusy}
        onBrainSelect={handleBrainSelect}
        brainLabel={brainLabel}
        parentBrainValue={PARENT_BRAIN_VALUE}
        steerMsg={steerMsg}
        setSteerMsg={setSteerMsg}
        steerSent={steerSent}
        setSteerSent={setSteerSent}
        steerBusy={steerBusy}
        setSteerBusy={setSteerBusy}
      />

      <HuntAgentPanels
        isScanner={isScanner}
        agentChatOpen={agentChatOpen}
        agentChatMsgs={agentChatMsgs}
        agentChatInput={agentChatInput}
        onAgentChatInput={setAgentChatInput}
        agentChatBusy={agentChatBusy}
        onSendAgentChat={sendAgentChatMsg}
        aiAnalysis={aiAnalysis}
      />

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
