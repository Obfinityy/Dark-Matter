import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchHuntDesktopFrame,
  getMachineControl,
  takeMachineControl,
  releaseMachineControl,
  getControlTicket,
  controlWsUrl,
} from '../lib/api';

/**
 * LiveMachine — picture-in-picture view of the hunt machine's GUI desktop.
 *
 * ALWAYS OPEN FOR THE RUNNING HUNT (21:55 IST 27 Oct 2026, owner
 * order — supersedes the 25 Oct collapsed-by-default order): the
 * hunt view opens with the live PiP mounted and polling at once —
 * the running hunt's machine stays visible live the whole time, no
 * placeholder while the brain is acting. The bar/chip still exist:
 * ✕ on the PiP minimises to the chip, and the chip restores the
 * PiP — the owner can hide it, but it never starts hidden. This
 * is safe to default open because HuntCard mounts <LiveMachine>
 * ONLY for a running hunt (paused hunts mount none at all).
 *
 * TAKE CONTROL OF THIS MACHINE: the expanded overlay bar carries a
 * "Take Control of This Machine" button (owner order 25 Oct 2026 — the
 * button appears ONLY in the expanded view, never on the small docked
 * card or the minimised chip, so the small view stays clean). Clicking
 * it takes the per-hunt control lock, starts the interactive VNC inside
 * the container, and mounts a noVNC client on the live desktop — the owner
 * drives the whole Kali machine himself (mouse + keyboard, any tool)
 * while the agent's GUI/browser actions pause so the two drivers never
 * fight over the same screen. The hunt itself is never paused. Done
 * hands the machine back to the AI; Cancel exits control mode — both
 * release the lock and the agent's GUI actions resume. If the
 * interactive channel cannot start, the button shows the honest reason
 * and control is never pretended.
 *
 * When the desktop is not available yet (older hunt image, or the hunter
 * has not started its desktop), the card shows a placeholder instead of
 * a broken image.
 *
 * STACKING: only the running hunt's card mounts a LiveMachine now
 * (paused hunts mount none — 27 Oct 2026, live-machine fix), so at
 * most one live panel exists and exactly one slot is ever claimed.
 * The shared registry below is kept as a belt-and-braces for that
 * single card: it claims slot 0 and stacks upward from the
 * bottom-right corner if a second panel ever mounts again.
 *
 * EMBEDDED (28 Oct 2026, Be a Brain lane): `embedded` renders the same
 * component inline inside the Brain Console — static, full-width, no
 * slot claim, no minimise-to-chip — instead of the fixed bottom-right
 * PiP. Same frame poller, same fullscreen overlay, same Take Control.
 * Default is false: every existing mount behaves exactly as before.
 */
const REFRESH_MS = 3000;
const STACK_STEP_PX = 224;

// Shared across all mounted LiveMachine cards in this page session.
// Entry = mount token, null = freed slot waiting for reuse.
const liveMachineSlots = [];
let liveMachineToken = 0;

function claimLiveSlot() {
  const token = ++liveMachineToken;
  let slot = liveMachineSlots.indexOf(null);
  if (slot === -1) {
    slot = liveMachineSlots.length;
    liveMachineSlots.push(token);
  } else {
    liveMachineSlots[slot] = token;
  }
  return { slot, token };
}

function releaseLiveSlot(token) {
  const idx = liveMachineSlots.indexOf(token);
  if (idx !== -1) liveMachineSlots[idx] = null;
}

// Friendly wording for a failed take — the raw error code is never
// shown on its own, and control is never pretended.
function controlErrorText(res) {
  if (!res) return 'Control failed — please try again.';
  if (res.status === 409) {
    const holder = res.data && res.data.holder;
    return holder
      ? `Already controlled by ${holder} — only one person can drive this machine at a time.`
      : 'Already controlled — only one person can drive this machine at a time.';
  }
  if (res.status === 503) {
    const detail = res.data && res.data.detail;
    return `Control unavailable${detail ? `: ${detail}` : ' — the interactive desktop could not start.'}`;
  }
  if (res.status === 400) return 'This hunt is not running — control needs an active hunt.';
  if (res.status === 401 || res.status === 403) return 'You do not have access to control this machine.';
  return res.error || 'Control failed — please try again.';
}

export default function LiveMachine({ huntId, target, embedded = false }) {
  const [frameUrl, setFrameUrl] = useState('');
  const [available, setAvailable] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [slot, setSlot] = useState(0);
  // FIX (24 Oct 2026, owner report): the machine view used to go
  // fullscreen on stray clicks, and once closed there was no way back
  // except reopening the hunt. Now: ONLY a click on the screen itself
  // (or the ⛶ button) expands; the header/border do nothing. ✕ on the
  // docked card minimises it to a small chip in the same corner — the
  // live screen stays hidden until the chip is clicked again.
  const [minimized, setMinimized] = useState(false);
  // COLLAPSED BY DEFAULT (25 Oct 2026, owner order): the hunt view
  // opens with a single-line bar (LIVE + Open + ✕) and NO live
  // machine — no desktop image, no poll, no connection — until the
  // ALWAYS OPEN (21:55 IST 27 Oct 2026, owner order): the PiP mounts
  // open for the running hunt — the panel stays visible live the whole
  // time. The owner can still ✕ it to the minimised chip; the chip
  // restores the PiP. The bar and the chip are two doors to the same
  // hidden state, never shown at once.
  const [collapsed, setCollapsed] = useState(false);
  // Take Control state: off | taking | taken | on | error.
  // 'taking' = the take POST is in flight (the lock is NOT held yet);
  // 'taken' = the lock is held, the channel is mounting; 'on' means
  // the owner is driving. LANE AN (25 Oct 2026): the noVNC mount used
  // to fire on 'taking', so the ticket fetch raced the take POST —
  // if it arrived first the backend 403'd (lock not held yet) and the
  // first attempt failed at once with "Could not open the control
  // channel". The mount now waits for 'taken', i.e. the take POST
  // has succeeded.
  const [control, setControl] = useState('off');
  const [controlError, setControlError] = useState('');
  const [controlHolder, setControlHolder] = useState('');
  const controlScreenRef = useRef(null);
  const rfbRef = useRef(null);
  const controlRef = useRef('off');
  const intentionalDisconnectRef = useRef(false);

  const setControlState = useCallback((next) => {
    controlRef.current = next;
    setControl(next);
  }, []);

  // Escape exits the fullscreen overlay back to the docked card —
  // EXCEPT while the owner is driving or connecting: then Escape
  // belongs to the guest (e.g. closing a menu inside Metasploit), not
  // to us — and closing mid-connect would leave the lock held with
  // no channel to drive it.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !['on', 'taking', 'taken'].includes(controlRef.current)) setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);
  const frameUrlRef = useRef('');

  useEffect(() => {
    // Embedded mounts share no corner with the PiP — no slot needed.
    if (embedded) return undefined;
    const claimed = claimLiveSlot();
    setSlot(claimed.slot);
    return () => releaseLiveSlot(claimed.token);
  }, [embedded]);

  // Who holds the control lock right now (if anyone) — so the button
  // can say so honestly instead of letting the owner discover it by
  // clicking. Best-effort: a failed status fetch just leaves the
  // button enabled and the take call reports the truth. LAZY (25 Oct
  // 2026): no request at all while the bar or chip is showing — the
  // take call itself reports the holder on a 409, so the button is
  // never dishonest.
  useEffect(() => {
    if (collapsed || minimized) return;
    let cancelled = false;
    getMachineControl(huntId).then((res) => {
      if (cancelled || !res.ok || !res.data) return;
      if (res.data.controlled) setControlHolder(res.data.holder || '');
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [huntId, collapsed, minimized]);

  useEffect(() => {
    // COLLAPSED / MINIMISED = disconnected (25 Oct 2026, owner
    // order): no desktop.jpg fetch, no poll interval while the bar
    // or the chip is showing. The poller starts only when the user
    // opens the PiP (or the expanded view) and stops the moment the
    // view closes again — the cleanup below clears the timer and
    // revokes the frame URL, and this gate resets the LIVE dot and
    // the frame so a closed view never claims to be live.
    if (collapsed || minimized) {
      setAvailable(false);
      setFrameUrl('');
      return;
    }
    // While the owner drives (or is connecting), the noVNC canvas is
    // the view — the screenshot poller stands down and resumes when
    // control ends.
    if (control === 'on' || control === 'taking' || control === 'taken') return;
    let cancelled = false;
    let timer = null;

    const poll = async () => {
      const res = await fetchHuntDesktopFrame(huntId);
      if (cancelled) return;
      if (res.ok && res.blob) {
        const url = URL.createObjectURL(res.blob);
        if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current);
        frameUrlRef.current = url;
        setFrameUrl(url);
        setAvailable(true);
      } else {
        setAvailable(false);
      }
      if (!cancelled) timer = setTimeout(poll, REFRESH_MS);
    };
    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (frameUrlRef.current) {
        URL.revokeObjectURL(frameUrlRef.current);
        frameUrlRef.current = '';
      }
    };
  }, [huntId, control, collapsed, minimized]);

  // Mount the noVNC client once the overlay screen exists and the
  // lock is HELD. The effect runs on [control, expanded] so the RFB
  // instance is created exactly once per takeover — and only after
  // the take POST has succeeded ('taken'), never while it is still
  // in flight ('taking'): fetching the ticket before the lock exists
  // 403s and fails the first attempt (Lane AN). The noVNC client is
  // lazy-loaded (dynamic import) so its ~200 kB stays out of the main
  // bundle until someone actually takes control.
  useEffect(() => {
    if (control !== 'taken' || !expanded || !controlScreenRef.current || rfbRef.current) return;
    let dead = false;

    (async () => {
      const ticketRes = await getControlTicket(huntId).catch(() => null);
      if (dead) return;
      const ticket = ticketRes && ticketRes.ok && ticketRes.data && ticketRes.data.ticket;
      if (!ticket) {
        // No ticket: hand the lock straight back — never leave the
        // machine locked with no channel to drive it.
        releaseMachineControl(huntId).catch(() => {});
        setControlError('Could not open the control channel — please try again.');
        setControlState('error');
        return;
      }
      let RFB;
      try {
        ({ default: RFB } = await import('@novnc/novnc/lib/rfb.js'));
      } catch {
        releaseMachineControl(huntId).catch(() => {});
        setControlError('Could not load the remote-desktop client — please try again.');
        setControlState('error');
        return;
      }
      if (dead) return;
      let rfb;
      try {
        rfb = new RFB(controlScreenRef.current, controlWsUrl(huntId, ticket), {
          credentials: { password: '' },
          shared: true,
        });
      } catch (err) {
        releaseMachineControl(huntId).catch(() => {});
        setControlError(`Control channel failed to start: ${err.message || err}`);
        setControlState('error');
        return;
      }
      rfbRef.current = rfb;
      // Scale the 1280x800 desktop into the view; never resize the
      // remote display (the agent's Chromium is maximised there and
      // a resize would confuse its next turns).
      rfb.scaleViewport = true;
      rfb.resizeSession = false;
      rfb.addEventListener('connect', () => {
        if (dead) return;
        setControlError('');
        setControlState('on');
        try { rfb.focus(); } catch { /* focus is best-effort */ }
      });
      rfb.addEventListener('disconnect', (e) => {
        if (dead) return;
        rfbRef.current = null;
        if (intentionalDisconnectRef.current) return; // Done / Cancel
        // Unexpected drop mid-takeover: hand the lock back and say so.
        releaseMachineControl(huntId).catch(() => {});
        setControlError(
          e && e.detail && e.detail.clean === false
            ? 'The control connection dropped — the machine is back with the AI. Try again to retake it.'
            : 'The control connection closed — the machine is back with the AI.',
        );
        setControlState('error');
      });
      rfb.addEventListener('credentialsrequired', () => {
        // The control VNC runs -nopw (backend auth is the gate); a
        // credential prompt means the channel is misconfigured.
        if (dead) return;
        try { rfb.disconnect(); } catch { /* already closing */ }
        releaseMachineControl(huntId).catch(() => {});
        setControlError('The control channel asked for a password — it is misconfigured. The machine is back with the AI.');
        setControlState('error');
      });
    })();

    return () => {
      // The RFB belongs to the takeover lifecycle (endControl /
      // unmount), NOT to this effect: when the connection succeeds
      // the control flips 'taken' -> 'on' and this effect re-runs —
      // that must NOT kill the live desktop. Only the in-flight
      // ticket promise is cancelled here; a live RFB is torn down by
      // endControl (Done / Cancel) or the unmount cleanup.
      dead = true;
    };
  }, [control, expanded, huntId, setControlState]);

  // Unmount while driving: hand the machine back instead of leaving
  // the lock held for a tab that is gone (the backend's WS close also
  // releases, this is the belt to its braces).
  useEffect(() => () => {
    if (controlRef.current === 'on' || controlRef.current === 'taking' || controlRef.current === 'taken') {
      try { if (rfbRef.current) rfbRef.current.disconnect(); } catch { /* already closing */ }
      releaseMachineControl(huntId).catch(() => {});
    }
  }, [huntId]);

  const takeControl = useCallback(async () => {
    if (controlRef.current === 'taking' || controlRef.current === 'taken' || controlRef.current === 'on') return;
    setControlError('');
    setControlHolder('');
    setControlState('taking');
    setExpanded(true);
    const res = await takeMachineControl(huntId);
    if (!res.ok) {
      setControlError(controlErrorText(res));
      if (res.status === 409 && res.data && res.data.holder) setControlHolder(res.data.holder);
      setControlState('error');
      return;
    }
    // The lock is held; the [control, expanded] effect mounts the
    // noVNC client and flips 'taken' -> 'on' on connect.
    setControlState('taken');
  }, [huntId, setControlState]);

  // Done AND Cancel both hand the machine back to the AI — Done is the
  // deliberate hand-back, Cancel is the exit. Neither pauses or stops
  // the hunt; the agent's GUI actions simply resume next turn.
  const endControl = useCallback(async () => {
    if (controlRef.current === 'off') return;
    intentionalDisconnectRef.current = true;
    try { if (rfbRef.current) rfbRef.current.disconnect(); } catch { /* already closing */ }
    rfbRef.current = null;
    await releaseMachineControl(huntId).catch(() => {});
    intentionalDisconnectRef.current = false;
    setControlError('');
    setControlHolder('');
    setControlState('off');
  }, [huntId, setControlState]);

  const shortTarget = target ? target.replace(/^https?:\/\//, '') : huntId;
  const controlBusy = control === 'taking' || control === 'taken' || control === 'on';
  const controlButtonLabel = control === 'on'
    ? 'You are in control'
    : control === 'taking' || control === 'taken'
      ? 'Connecting…'
      : controlHolder
        ? `In control by ${controlHolder}`
        : 'Take Control of This Machine';
  const controlButtonTitle = controlHolder
    ? `This machine is already controlled by ${controlHolder}`
    : 'Take over this machine yourself — full mouse and keyboard. The AI pauses its GUI actions while you drive.';

  const controlButton = (
    <button
      type="button"
      className="live-machine-control-btn"
      onClick={takeControl}
      disabled={controlBusy || Boolean(controlHolder)}
      title={controlButtonTitle}
      aria-label="Take control of this machine"
    >
      {controlButtonLabel}
    </button>
  );

  const frame = available && frameUrl ? (
    <img
      className="live-machine-img"
      src={frameUrl}
      alt={`Live desktop of the hunt machine working on ${shortTarget}`}
      draggable={false}
    />
  ) : (
    <div className="live-machine-placeholder">
      Machine view starts when the hunter uses its desktop
    </div>
  );

  // While taking control or driving, the overlay shows the live noVNC
  // canvas instead of the 3-second screenshots.
  const overlayScreen = controlBusy ? (
    <div
      ref={controlScreenRef}
      className="live-machine-control-screen"
      aria-label="Interactive machine desktop — you are in control"
    />
  ) : (
    <div className="live-machine-screen live-machine-screen-full">{frame}</div>
  );

  // Embedded mounts never minimise or collapse — the console owns
  // the layout; the ✕/chip doors are PiP-only (see render below).
  if (minimized && !embedded) {
    return (
      <button
        type="button"
        className="live-machine-chip"
        style={{ bottom: 16 + slot * STACK_STEP_PX }}
        onClick={() => { setMinimized(false); setCollapsed(false); }}
        title={`Show live machine view — ${shortTarget}`}
        aria-label="Show live machine view"
      >
        <span className={`live-machine-dot${available ? ' on' : ''}`} aria-hidden="true" />
        <span className="live-machine-live">LIVE</span>
        <span className="live-machine-target">{shortTarget}</span>
        <span aria-hidden="true">▸</span>
      </button>
    );
  }

  // Collapsed only when the owner closes the PiP to the bar: one line,
  // no stream. Open mounts the PiP (which starts the poller); ✕
  // dismisses to the minimised chip. The Take Control button is
  // deliberately NOT here — it appears only in the expanded view
  // (owner order 25 Oct 2026).
  if (collapsed && !embedded) {
    return (
      <div
        className="live-machine-bar"
        aria-label="Live machine — collapsed"
        style={{ bottom: 16 + slot * STACK_STEP_PX }}
      >
        <span className="live-machine-dot" aria-hidden="true" />
        <span className="live-machine-live">LIVE</span>
        <span className="live-machine-target" title={target}>{shortTarget}</span>
        <button
          type="button"
          className="live-machine-bar-open"
          onClick={() => setCollapsed(false)}
          title="Open the live machine view"
        >
          Open
        </button>
        <button
          type="button"
          className="live-machine-expand"
          onClick={() => setMinimized(true)}
          title="Dismiss to a small chip"
          aria-label="Dismiss live machine bar"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className={`live-machine${embedded ? ' live-machine-embedded' : ''}`}
        aria-label="Live machine view"
        style={embedded ? undefined : { bottom: 16 + slot * STACK_STEP_PX }}
      >
        <div className="live-machine-header">
          <span className={`live-machine-dot${available ? ' on' : ''}`} aria-hidden="true" />
          <span className="live-machine-live">LIVE</span>
          <span className="live-machine-target" title={target}>{shortTarget}</span>
          <button
            type="button"
            className="live-machine-expand"
            onClick={() => setExpanded(true)}
            title="Expand machine view"
          >
            ⛶
          </button>
          {!embedded && (
            <button
              type="button"
              className="live-machine-expand"
              onClick={() => setMinimized(true)}
              title="Minimize to a small chip"
            >
              ✕
            </button>
          )}
        </div>
        {control === 'error' && controlError && (
          <div className="live-machine-control-error" role="alert">
            {controlError}
          </div>
        )}
        {control === 'on' && (
          <div className="live-machine-control-banner" role="status">
            <span aria-hidden="true">●</span> YOU ARE IN CONTROL — the AI&apos;s GUI actions are paused
          </div>
        )}
        <div
          className="live-machine-screen live-machine-screen-clickable"
          onClick={() => setExpanded(true)}
          title="Click to expand fullscreen"
          role="button"
          aria-label="Expand machine view fullscreen"
        >
          {frame}
        </div>
      </div>

      {expanded && (
        <div className="live-machine-overlay" role="dialog" aria-label="Live machine view — expanded">
          <div className="live-machine-overlay-bar">
            <span className={`live-machine-dot${available ? ' on' : ''}`} aria-hidden="true" />
            <span className="live-machine-live">LIVE</span>
            <span className="live-machine-target" title={target}>{shortTarget}</span>
            {control === 'on' ? (
              <>
                <span className="live-machine-control-banner" role="status">
                  <span aria-hidden="true">●</span> YOU ARE IN CONTROL — the AI&apos;s GUI actions are paused
                </span>
                <button
                  type="button"
                  className="live-machine-done"
                  onClick={endControl}
                  title="Hand the machine back to the AI"
                >
                  Done
                </button>
                <button
                  type="button"
                  className="live-machine-cancel"
                  onClick={endControl}
                  title="Exit control mode and hand the machine back to the AI"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className="live-machine-note">
                  {control === 'taking' || control === 'taken' ? 'Connecting to the machine…' : 'View only — the hunter is driving'}
                </span>
                {controlButton}
              </>
            )}
            <button
              type="button"
              className="live-machine-expand"
              onClick={() => {
                // ✕ while driving is Cancel: end control AND close.
                // Closing the overlay while still holding the lock
                // would hide the desktop but keep the machine locked.
                if (controlRef.current === 'on' || controlRef.current === 'taking' || controlRef.current === 'taken') {
                  endControl().then(() => setExpanded(false));
                } else {
                  setExpanded(false);
                }
              }}
              title={control === 'on' || control === 'taking' || control === 'taken' ? 'Exit control mode and close' : 'Close expanded view'}
            >
              ✕
            </button>
          </div>
          {control === 'error' && controlError && (
            <div className="live-machine-control-error" role="alert">
              {controlError}
            </div>
          )}
          {overlayScreen}
        </div>
      )}
    </>
  );
}
