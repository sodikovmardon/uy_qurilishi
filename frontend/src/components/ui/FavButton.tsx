import { useState, type CSSProperties, type MouseEvent } from 'react';
import { Heart } from 'lucide-react';
import { vibrate } from '../../lib/haptics';

interface FavButtonProps {
  active: boolean;
  /** Button surface class — e.g. "bookmark-heart" (card) or "bookmark-btn" (modal). */
  className: string;
  label: string;
  onToggle: () => void;
}

/** Confetti only fires once per page session, on the very first bookmark. */
let burstShownOnce = false;

const BURST_DOTS: { dx: number; dy: number; color: string }[] = [
  { dx: -14, dy: -16, color: '#60a5fa' },
  { dx: 14, dy: -18, color: '#a78bfa' },
  { dx: -22, dy: 2, color: '#f472b6' },
  { dx: 22, dy: 4, color: '#34d399' },
  { dx: -10, dy: 18, color: '#fbbf24' },
  { dx: 12, dy: 20, color: '#3b82f6' },
];

/**
 * Unified bookmark control (Phase 11): pop animation on tap, a one-time subtle
 * confetti burst on first bookmark, and haptic feedback on becoming active.
 */
export function FavButton({ active, className, label, onToggle }: FavButtonProps) {
  const [popping, setPopping] = useState(false);
  const [burst, setBurst] = useState(false);

  const iconClass = className.includes('bookmark-heart') ? 'bookmark-heart-icon' : 'bookmark-btn-icon';

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onToggle();
    if (!active) {
      vibrate(10);
      if (!burstShownOnce) {
        burstShownOnce = true;
        setBurst(true);
        window.setTimeout(() => setBurst(false), 600);
      }
    }
    setPopping(false);
    requestAnimationFrame(() => setPopping(true));
  };

  return (
    <button
      type="button"
      className={`${className}${popping ? ' is-popping' : ''}`}
      aria-pressed={active}
      aria-label={label}
      onClick={handleClick}
      onAnimationEnd={() => setPopping(false)}
    >
      <span className={iconClass}>
        <Heart className="w-4 h-4" fill={active ? 'currentColor' : 'none'} />
      </span>
      {burst && (
        <span className="burst" aria-hidden="true">
          {BURST_DOTS.map((d, i) => (
            <span
              key={i}
              className="burst-dot"
              style={{ '--dx': `${d.dx}px`, '--dy': `${d.dy}px`, background: d.color } as CSSProperties}
            />
          ))}
        </span>
      )}
    </button>
  );
}
