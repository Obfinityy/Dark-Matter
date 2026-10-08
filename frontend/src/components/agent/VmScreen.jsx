/**
 * VmScreen — live view of the Infinity VM's screen (noVNC/RFB over the
 * runner's /vm/vnc WebSocket proxy).
 *
 * Small live preview → click → fullscreen modal. There is ONE RFB
 * connection: React mounts the screen frame exactly once, and a DOM effect
 * re-parents the frame node between the preview slot and the fullscreen
 * modal (no reconnect on toggle).
 *
 * VIEW-ONLY while the agent runs (standing order): pointer input is blocked
 * by an overlay AND by RFB's viewOnly flag while `agentRunning` is true.
 * Input unlocks on pause/stop.
 *
 * Props:
 *   sessionId     — active VM session (null → placeholder)
 *   agentRunning  — true while the agent loop is running (locks input)
 *   canConnect    — whether a VNC connection should be attempted
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import RFB from '@novnc/novnc';
import { Monitor, Maximize2, X, RotateCcw } from 'lucide-react';
import { vncSocketUrl } from '../../services/vmRunnerApi';

export function VmScreen({ sessionId, agentRunning = false, canConnect = true }) {
  const frameRef = useRef(null);   // the whole screen frame — mounted ONCE, re-parented by DOM
  const hostRef = useRef(null);    // div the RFB canvas attaches to
  const previewSlotRef = useRef(null);
  const modalSlotRef = useRef(null);
  const rfbRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | disconnected | error
  const [detail, setDetail] = useState('');
  const [desktopName, setDesktopName] = useState('');

  const locked = Boolean(agentRunning);

  const disconnect = useCallback(() => {
    try { rfbRef.current?.disconnect(); } catch { /* noop */ }
    rfbRef.current = null;
  }, []);

  const connect = useCallback(() => {
    if (!sessionId || !canConnect) return;
    if (!hostRef.current) return;
    disconnect();
    setStatus('connecting');
    setDetail('');
    let rfb;
    try {
      rfb = new RFB(hostRef.current, vncSocketUrl(sessionId), {
        // Keep the guest's resolution; scale the view to fit our box.
        scaleViewport: true,
        resizeSession: false,
        viewOnly: true // starts locked; unlocked via effect when paused/stopped
      });
    } catch (err) {
      setStatus('error');
      setDetail(err?.message || 'Could not start the VNC client');
      return;
    }
    rfbRef.current = rfb;
    rfb.addEventListener('connect', () => {
      setStatus('connected');
      setDetail('');
    });
    rfb.addEventListener('disconnect', (e) => {
      setStatus('disconnected');
      setDetail(e?.detail?.clean ? '' : 'Connection closed unexpectedly');
      rfbRef.current = null;
    });
    rfb.addEventListener('securityfailure', (e) => {
      setStatus('error');
      setDetail(`VNC security failure: ${e?.detail?.reason || 'rejected'}`);
    });
    rfb.addEventListener('desktopname', (e) => {
      if (e?.detail?.name) setDesktopName(e.detail.name);
    });
  }, [sessionId, canConnect, disconnect]);

  // (Re)connect when the session becomes available.
  useEffect(() => {
    if (sessionId && canConnect) connect();
    else {
      disconnect();
      setStatus('idle');
      setDetail('');
    }
    return () => { try { rfbRef.current?.disconnect(); } catch { /* noop */ } rfbRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, canConnect]);

  // Enforce view-only while the agent runs; unlock on pause/stop.
  useEffect(() => {
    const rfb = rfbRef.current;
    if (rfb) rfb.viewOnly = locked;
  }, [locked]);

  // Move the whole frame between preview and fullscreen modal (DOM only —
  // the RFB canvas is never remounted, so the connection survives).
  useEffect(() => {
    const slot = fullscreen ? modalSlotRef.current : previewSlotRef.current;
    const frame = frameRef.current;
    if (slot && frame && frame.parentNode !== slot) slot.appendChild(frame);
  }, [fullscreen]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const statusLabel =
    status === 'connected' ? 'live' :
    status === 'connecting' ? 'connecting…' :
    status === 'error' ? 'error' :
    status === 'disconnected' ? 'disconnected' : 'idle';

  return (
    <div className="vm-screen" role="region" aria-label="VM screen">
      <div className="vm-screen-head">
        <span className="vm-screen-title"><Monitor size={14} aria-hidden="true" /> vm screen</span>
        <span className={`vm-screen-status is-${status}`}>
          {status === 'connected' ? '● live' : statusLabel}
        </span>
        {desktopName && <span className="dm-hint">{desktopName}</span>}
        <span className="vm-screen-lock" title={locked ? 'Input locked while the agent works' : 'Input unlocked — the agent is not running'}>
          {locked ? '🔒 view-only' : '🔓 input unlocked'}
        </span>
        <div className="vm-screen-actions">
          {status === 'connected' && (
            <button
              type="button"
              className="dm-btn dm-btn-ghost dm-btn-sm"
              onClick={() => setFullscreen(true)}
              aria-label="Open screen fullscreen"
            >
              <Maximize2 size={13} /> Fullscreen
            </button>
          )}
        </div>
      </div>

      {/* Preview slot. Clicking an empty preview does nothing. */}
      <div
        ref={previewSlotRef}
        className="vm-screen-preview"
        onClick={() => { if (status === 'connected' && !fullscreen) setFullscreen(true); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && status === 'connected' && !fullscreen) setFullscreen(true); }}
        role={status === 'connected' ? 'button' : undefined}
        tabIndex={status === 'connected' ? 0 : undefined}
        aria-label={status === 'connected' ? 'Open fullscreen screen' : 'VM screen preview'}
      >
        {/* The frame is mounted here exactly once; the effect above moves it
            into the fullscreen modal when needed. */}
        <div ref={frameRef} className="vm-screen-frame-wrap">
          <div className={`vm-screen-frame${locked ? ' vm-screen-locked' : ''}`}>
            <div ref={hostRef} className="vm-screen-host" />
            {status !== 'connected' && (
              <div className="vm-screen-empty">
                {status === 'error' ? (
                  <>
                    <span className="vm-screen-err">Screen unavailable: {detail || 'connection failed'}</span>
                    <button type="button" className="dm-btn dm-btn-ghost dm-btn-sm" onClick={(e) => { e.stopPropagation(); connect(); }}>
                      <RotateCcw size={13} /> Retry
                    </button>
                  </>
                ) : status === 'connecting' ? (
                  'Connecting to the VM screen…'
                ) : status === 'disconnected' ? (
                  <>
                    Screen disconnected. {detail}
                    <button type="button" className="dm-btn dm-btn-ghost dm-btn-sm" onClick={(e) => { e.stopPropagation(); connect(); }}>
                      <RotateCcw size={13} /> Reconnect
                    </button>
                  </>
                ) : (
                  'Start the VM to see its screen here.'
                )}
              </div>
            )}
            {/* While the agent runs, a transparent overlay blocks all pointer
                input — the user watches but cannot click (standing order). */}
            {locked && status === 'connected' && (
              <div className="vm-screen-input-blocker" title="View-only while the agent works" />
            )}
          </div>
        </div>
      </div>

      {fullscreen && createPortal(
        <div className="vm-screen-modal" role="dialog" aria-modal="true" aria-label="VM screen fullscreen">
          <div className="vm-screen-modal-bar">
            <span className="vm-screen-title"><Monitor size={14} aria-hidden="true" /> vm screen — fullscreen</span>
            <span className="vm-screen-lock">{locked ? '🔒 view-only while the agent works' : '🔓 input unlocked'}</span>
            <button type="button" className="dm-btn dm-btn-ghost dm-btn-sm" onClick={() => setFullscreen(false)} aria-label="Close fullscreen">
              <X size={14} /> Close
            </button>
          </div>
          <div ref={modalSlotRef} className="vm-screen-modal-body" />
        </div>,
        document.body
      )}
    </div>
  );
}
