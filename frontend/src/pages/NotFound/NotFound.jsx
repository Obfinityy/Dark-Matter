/**
 * NotFound — Infinity AI 404 page.
 *
 * Kinetic redesign (issue #292): the giant outlined "404" drifts, the radar
 * sweep keeps its quiet brand nod, and the card title arrives letter by
 * letter. Decorative layers are aria-hidden so screen readers hear only the
 * heading, copy and the two actions. Real links back to the landing page and
 * the agent console.
 */
import { Link } from 'react-router-dom';
import { Ghost, ArrowLeft, Radar } from 'lucide-react';
import '../../styles/kinetic-acct.css';

/** Kinetic letter spans for a title string. Parent must carry aria-label. */
function kineticLetters(text) {
  let i = 0;
  return text.split(' ').map((word, wi, words) => (
    <span key={wi} className="kac-word" aria-hidden="true">
      {word.split('').map(ch => {
        const idx = i++;
        return (
          <span key={idx} className="kac-ch" style={{ '--kac-i': idx }} aria-hidden="true">
            {ch}
          </span>
        );
      })}
      {wi < words.length - 1 ? ' ' : null}
    </span>
  ));
}

export default function NotFound() {
  return (
    <main className="kac-nf">
      <span className="kac-nf-giant" aria-hidden="true">
        404
      </span>
      <div className="kac-nf-radar" aria-hidden="true" />
      <div className="kac-nf-card kac-in">
        <span className="kac-nf-badge">
          <Ghost size={18} aria-hidden="true" /> 404 · NOT FOUND
        </span>
        <h1 className="kac-title kac-nf-title" aria-label="This corner of the void is empty.">
          {kineticLetters('This corner of the void is empty.')}
        </h1>
        <p className="kac-sub">
          The page you were looking for doesn&apos;t exist or was moved. Dark Matter hunts bugs —
          not missing pages — so let&apos;s get you back on track.
        </p>
        <div className="kac-nf-actions">
          <Link to="/" className="kac-btn kac-btn-primary">
            <ArrowLeft size={16} aria-hidden="true" /> Back to home
          </Link>
          <Link to="/agent" className="kac-btn kac-btn-ghost">
            <Radar size={16} aria-hidden="true" /> Open the agent
          </Link>
        </div>
      </div>
    </main>
  );
}
