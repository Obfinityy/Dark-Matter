/**
 * DarkMatter brand logo — "The Singularity".
 * A black hole with a glowing accretion disk and radar sweep:
 * invisible matter, visible power. Security that sees what others can't.
 */
export default function Logo({ size = 36, withWordmark = false, className = '' }) {
  return (
    <span className={`dm-logo ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-label="DarkMatter logo">
        <defs>
          <radialGradient id="dm-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0b0b14" />
            <stop offset="70%" stopColor="#0b0b14" />
            <stop offset="100%" stopColor="#1a1033" />
          </radialGradient>
          <linearGradient id="dm-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="50%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
          <linearGradient id="dm-sweep" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <ellipse cx="32" cy="32" rx="29" ry="11" fill="none" stroke="url(#dm-ring)" strokeWidth="2" opacity="0.35" transform="rotate(-24 32 32)" />
        <circle cx="32" cy="32" r="14" fill="url(#dm-core)" stroke="url(#dm-ring)" strokeWidth="2.5" />
        <circle cx="32" cy="32" r="14" fill="none" stroke="#22d3ee" strokeWidth="1" opacity="0.5" />
        <path d="M32 32 L32 20 A12 12 0 0 1 40.5 25.5 Z" fill="url(#dm-sweep)" opacity="0.85" />
        <circle cx="32" cy="32" r="4.5" fill="#22d3ee" />
        <circle cx="32" cy="32" r="4.5" fill="white" opacity="0.25" />
        <circle cx="54" cy="20" r="2.6" fill="#c084fc" />
        <circle cx="54" cy="20" r="4.2" fill="none" stroke="#c084fc" strokeWidth="1" opacity="0.5" />
      </svg>
      {withWordmark && (
        <span style={{ fontWeight: 800, fontSize: size * 0.52, letterSpacing: '-0.02em', color: 'var(--dm-text)' }}>
          Dark<span style={{ background: 'linear-gradient(135deg,#22d3ee,#c084fc)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Matter</span>
        </span>
      )}
    </span>
  );
}
