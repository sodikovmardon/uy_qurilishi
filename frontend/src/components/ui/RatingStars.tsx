import { useState, type CSSProperties } from 'react';
import { Star } from 'lucide-react';

interface RatingStarsProps {
  /** 0..5 — fractional values render partial fill (display mode). */
  value: number;
  /** Pixel size of each star. */
  size?: number;
  /** Interactive mode (rating input) instead of read-only display. */
  interactive?: boolean;
  onChange?: (value: number) => void;
  ariaLabel?: string;
}

/** Clamp a star's fill share to [0, 100]%. */
function fillPercent(value: number, index: number): number {
  return Math.min(100, Math.max(0, (value - index) * 100));
}

export default function RatingStars({
  value,
  size = 14,
  interactive = false,
  onChange,
  ariaLabel,
}: RatingStarsProps) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  if (interactive) {
    return (
      <div
        className="rating-stars"
        role="radiogroup"
        aria-label={ariaLabel ?? 'Baholash'}
        style={{ '--rs-size': `${size}px` } as CSSProperties}
        onMouseLeave={() => setHover(0)}
      >
        {Array.from({ length: 5 }).map((_, i) => {
          const active = shown >= i + 1;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${i + 1} yulduz`}
              className={`rating-star-btn${active ? ' is-active' : ''}`}
              onMouseEnter={() => setHover(i + 1)}
              onClick={() => onChange?.(i + 1)}
            >
              <Star className="rs-star" fill="currentColor" strokeWidth={1} />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="rating-stars"
      role="img"
      aria-label={ariaLabel ?? `Baholash: ${value} yulduz`}
      style={{ '--rs-size': `${size}px` } as CSSProperties}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className="rs-star-wrap">
          <Star className="rs-star rs-star-bg" fill="currentColor" strokeWidth={1} />
          <span className="rs-star-fill" style={{ width: `${fillPercent(value, i)}%` }}>
            <Star className="rs-star rs-star-filled" fill="currentColor" strokeWidth={1} />
          </span>
        </span>
      ))}
    </div>
  );
}
