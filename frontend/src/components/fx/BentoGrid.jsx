/**
 * BentoGrid — asymmetric editorial grid where every tile carries a
 * cursor-following spotlight. Original implementation.
 */
import { SpotlightCard } from './SpotlightCard';
import './BentoGrid.css';

export function BentoGrid({ children, className = '' }) {
  return <div className={`bento-grid ${className}`}>{children}</div>;
}

export function BentoTile({ children, span = '1x1', glowColor, className = '', ...rest }) {
  return (
    <SpotlightCard
      className={`bento-tile bento-${span} ${className}`}
      glowColor={glowColor}
      {...rest}
    >
      {children}
    </SpotlightCard>
  );
}
