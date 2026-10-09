/**
 * Dark Matter brand logo — the owner's gold emblem.
 * Gold-on-black (`/dark-matter-logo.png`) is the primary mark for the dark
 * UI; gold-on-white (`/dark-matter-logo-light.png`) for light surfaces.
 *
 * The wordmark is aria-hidden: the emblem image already announces
 * "Dark Matter logo", so screen readers would otherwise hear it twice.
 */
import './Logo.css';

export default function Logo({
  size = 36,
  variant = 'dark',
  withWordmark = false,
  className = '',
}) {
  const src = variant === 'light' ? '/dark-matter-logo-light.png' : '/dark-matter-logo.png';
  return (
    <span
      className={`dm-logo ${className}`}
      style={{ '--dm-logo-size': `${size}px` }}
    >
      <img
        src={src}
        alt="Dark Matter logo"
        width={size}
        height={size}
        draggable={false}
      />
      {withWordmark && (
        <span className="dm-logo-wordmark" aria-hidden="true">
          Dark Matter
        </span>
      )}
    </span>
  );
}
