/**
 * RunnerStatusCard.jsx — Infinity AI Runner presence card.
 *
 * Auto-detects the desktop Runner on this PC (http://127.0.0.1:4100/health):
 *   - Runner up   → green "connected" state, nothing for the user to do.
 *   - Runner down → "Download Infinity AI Runner" prompt (one-click Windows
 *                   installer; no terminal, no setup).
 *
 * No manual URL entry anywhere — detection is automatic.
 */
import { useEffect, useState } from 'react';
import { RUNNER_DOWNLOAD_URL, probeRunner, probeRunnerReadiness } from '../../services/runnerDownload.js';
import './RunnerStatusCard.css';

export function RunnerStatusCard() {
  const [state, setState] = useState('checking'); // checking | connected | setup-needed | missing
  const [version, setVersion] = useState(null);
  const [missing, setMissing] = useState([]);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const r = await probeRunner();
      if (!alive) return;
      if (!r.up) {
        setState('missing');
        return;
      }
      setVersion(r.version || null);
      const ready = await probeRunnerReadiness();
      if (!alive) return;
      if (ready.ready) {
        setState('connected');
      } else {
        setState('setup-needed');
        setMissing(ready.missing);
      }
    };
    check();
    const timer = setInterval(check, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (state === 'checking') {
    return (
      <div className="runner-card runner-checking">
        <span className="runner-pulse" aria-hidden="true" />
        <span>Looking for Infinity AI Runner on this PC…</span>
      </div>
    );
  }

  if (state === 'connected') {
    return (
      <div className="runner-card runner-connected">
        <span className="runner-dot ok" aria-hidden="true" />
        <div className="runner-text">
          <strong>Infinity AI Runner connected ✅</strong>
          <span>Your PC is ready — hunts and the Kali sandbox run locally{version ? ` (v${version})` : ''}.</span>
        </div>
      </div>
    );
  }

  if (state === 'setup-needed') {
    return (
      <div className="runner-card runner-setup">
        <span className="runner-dot amber" aria-hidden="true" />
        <div className="runner-text">
          <strong>Runner connected — one-time setup needed</strong>
          <span>
            Open the <b>Infinity AI Runner</b> window from your system tray (near the clock)
            {missing.length ? ` — still needed: ${missing.join(', ')}` : ''}. It sets
            everything up by itself; no technical steps for you.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="runner-card runner-missing">
      <div className="runner-text">
        <strong>Run hunts on your own PC</strong>
        <span>
          Install the Infinity AI Runner once — it runs the Kali sandbox and the 24/7 hunt
          agent in the background. No terminal, no setup.
        </span>
        <ol className="runner-steps">
          <li>Download and run the installer</li>
          <li>It starts automatically and lives in your system tray</li>
          <li>Come back here — this card turns green</li>
        </ol>
      </div>
      <a className="runner-download-btn" href={RUNNER_DOWNLOAD_URL}>
        ⬇ Download Infinity AI Runner for Windows
      </a>
    </div>
  );
}
