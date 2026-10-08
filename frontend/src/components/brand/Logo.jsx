/**
 * Dark Matter brand logo — the owner's gold emblem.
 * Gold-on-black (`/dark-matter-logo.png`) is the primary mark for the dark
 * UI; gold-on-white (`/dark-matter-logo-light.png`) for light surfaces.
 */
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
      style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
    >
      <img
        src={src}
        alt="Dark Matter logo"
        width={size}
        height={size}
        style={{ borderRadius: '50%', display: 'block' }}
        draggable={false}
      />
      {withWordmark && (
        <span
          style={{
            fontWeight: 800,
            fontSize: size * 0.52,
            letterSpacing: '-0.02em',
            color: 'var(--dm-text, #fff)',
          }}
        >
          Dark Matter
        </span>
      )}
    </span>
  );
}
