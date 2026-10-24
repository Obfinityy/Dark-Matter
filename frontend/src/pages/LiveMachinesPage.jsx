import { useEffect, useRef, useState } from 'react';
import { listHunts, fetchHuntDesktopFrame } from '../lib/api';

/**
 * LiveMachinesPage — the all-machines-at-once view.
 *
 * The owner asked to see every hunter's screen together: the hunt cards
 * show one machine per view, so this page renders a grid of ALL active
 * hunts' live desktops side by side, each refreshing every 3 seconds
 * via GET /api/v1/hunts/:id/desktop.jpg (same source as the PiP card).
 * STRICTLY READ-ONLY, like the PiP: images have pointer-events
 * disabled and there is no input path to any machine. Clicking a card
 * jumps to that hunt's chat (via onOpenHunt); it never drives the hunt.
 *
 * The hunt list itself refreshes every 15 seconds so newly started or
 * finished hunts appear/disappear without a reload.
 */
const FRAME_MS = 3000;
const LIST_MS = 15000;

function MachineFrame({ huntId, target }) {
  const [frameUrl, setFrameUrl] = useState('');
  const [available, setAvailable] = useState(false);
  const frameUrlRef = useRef('');

  useEffect(() => {
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
      if (!cancelled) timer = setTimeout(poll, FRAME_MS);
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
  }, [huntId]);

  const shortTarget = target ? target.replace(/^https?:\/\//, '') : huntId;

  return (
    <div className="machine-screen">
      {available && frameUrl ? (
        <img
          className="machine-img"
          src={frameUrl}
          alt={`Live desktop of the hunt machine working on ${shortTarget}`}
          draggable={false}
        />
      ) : (
        <div className="machine-placeholder">
          Machine view starts when the hunter uses its desktop
        </div>
      )}
    </div>
  );
}

export default function LiveMachinesPage({ onOpenHunt }) {
  const [hunts, setHunts] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const load = async () => {
      const res = await listHunts();
      if (cancelled) return;
      const all = (res.ok && res.data && res.data.hunts) || [];
      // Active machines only: running hunts plus paused ones (their
      // containers stay up, so their last desktop frame still serves).
      setHunts(all.filter((h) => h.status === 'running' || h.status === 'paused'));
      if (!cancelled) timer = setTimeout(load, LIST_MS);
    };
    load();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <div className="machines-page">
      <h2 className="machines-title">Live machines</h2>
      <p className="machines-sub">
        Every active hunter&apos;s screen, together. View only — the hunters are driving.
      </p>
      {hunts === null && <p className="machines-empty">Loading machines…</p>}
      {hunts !== null && hunts.length === 0 && (
        <p className="machines-empty">No active hunts right now. Start a hunt to see its machine here.</p>
      )}
      {hunts !== null && hunts.length > 0 && (
        <div className="machines-grid">
          {hunts.map((h) => {
            const shortTarget = h.target ? h.target.replace(/^https?:\/\//, '') : h.huntId;
            return (
              <button
                key={h.huntId}
                type="button"
                className="machine-card"
                onClick={() => onOpenHunt && onOpenHunt(h.huntId)}
                title="Open this hunt's chat"
              >
                <div className="machine-header">
                  <span className={`machine-dot${h.status === 'running' ? ' on' : ''}`} aria-hidden="true" />
                  <span className="machine-live">{h.status === 'running' ? 'LIVE' : 'PAUSED'}</span>
                  <span className="machine-target" title={h.target}>{shortTarget}</span>
                </div>
                <MachineFrame huntId={h.huntId} target={h.target} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
