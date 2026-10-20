import { useEffect, useRef, useState } from 'react';
import { fetchHuntDesktopFrame } from '../lib/api';

/**
 * LiveMachine — picture-in-picture view of the hunt machine's GUI desktop.
 *
 * Fixed bottom-right card (~320x180) that refreshes the desktop frame
 * every 3 seconds via GET /api/v1/hunts/:id/desktop.jpg (JWT-authenticated
 * fetch, blob URL). STRICTLY READ-ONLY: the image has pointer-events
 * disabled and there is no input path to the machine from here — the
 * owner controls the hunt only through the hunt card's pause/stop
 * controls. The expand button opens the same stream full-screen.
 *
 * When the desktop is not available yet (older hunt image, or the hunter
 * has not started its desktop), the card shows a placeholder instead of
 * a broken image.
 */
const REFRESH_MS = 3000;

export default function LiveMachine({ huntId, target }) {
  const [frameUrl, setFrameUrl] = useState('');
  const [available, setAvailable] = useState(false);
  const [expanded, setExpanded] = useState(false);
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
  }, [huntId]);

  const shortTarget = target ? target.replace(/^https?:\/\//, '') : huntId;

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

  return (
    <>
      <div className="live-machine" aria-label="Live machine view">
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
        </div>
        <div className="live-machine-screen">{frame}</div>
      </div>

      {expanded && (
        <div className="live-machine-overlay" role="dialog" aria-label="Live machine view — expanded">
          <div className="live-machine-overlay-bar">
            <span className={`live-machine-dot${available ? ' on' : ''}`} aria-hidden="true" />
            <span className="live-machine-live">LIVE</span>
            <span className="live-machine-target" title={target}>{shortTarget}</span>
            <span className="live-machine-note">View only — the hunter is driving</span>
            <button
              type="button"
              className="live-machine-expand"
              onClick={() => setExpanded(false)}
              title="Close expanded view"
            >
              ✕
            </button>
          </div>
          <div className="live-machine-screen live-machine-screen-full">{frame}</div>
        </div>
      )}
    </>
  );
}
