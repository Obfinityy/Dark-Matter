/**
 * NotFound — Infinity AI 404 page.
 *
 * Unknown top-level routes land here instead of silently redirecting to
 * /agent. Real links back to the landing page and the agent console.
 * Decorative layers (giant watermark, radar rings) are aria-hidden so
 * screen readers hear only the heading, copy and the two actions.
 */
import { Link } from 'react-router-dom';
import { Ghost, ArrowLeft, Radar } from 'lucide-react';
import './NotFound.css';

export default function NotFound() {
  return (
    <main className="nf-root">
      <span className="nf-giant" aria-hidden="true">404</span>
      <div className="nf-radar" aria-hidden="true" />
      <div className="nf-card">
        <span className="nf-badge"><Ghost size={18} aria-hidden="true" /> 404 · NOT FOUND</span>
        <h1 className="nf-title">This corner of the void is empty.</h1>
        <p className="nf-sub">
          The page you were looking for doesn&apos;t exist or was moved.
          Infinity AI hunts bugs — not missing pages — so let&apos;s get you
          back on track.
        </p>
        <div className="nf-actions">
          <Link to="/" className="nf-btn nf-btn-primary">
            <ArrowLeft size={16} aria-hidden="true" /> Back to home
          </Link>
          <Link to="/agent" className="nf-btn nf-btn-ghost">
            <Radar size={16} aria-hidden="true" /> Open the agent
          </Link>
        </div>
      </div>
    </main>
  );
}
