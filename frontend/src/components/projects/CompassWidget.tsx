import { useRef, type KeyboardEvent } from 'react';
import { ORIENTATIONS, ORIENTATION_BY_ID, type OrientationId } from '../../lib/orientation';

const SIZE = 220;
const C = SIZE / 2;
const POINT_R = 60;
const LABEL_R = 90;
const SUN_R = 82;
const HIT_R = 21;

function pt(azimuth: number, r: number) {
  const rad = ((azimuth - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
}

/** Illustrative sun path: arcs from East through South to West. */
function sunArcPath() {
  const pts: string[] = [];
  for (let az = 96; az <= 264; az += 4) {
    const p = pt(az, SUN_R);
    pts.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
  }
  return pts.join(' ');
}

interface CompassWidgetProps {
  value: OrientationId | null;
  /** Omit to render a read-only compass (project detail view). */
  onChange?: (dir: OrientationId) => void;
  /** Display size in px (viewBox scales cleanly). */
  size?: number;
  /** Compact mode hides the cardinal cross + outer ring flourish. */
  compact?: boolean;
  labelledBy?: string;
}

/**
 * Interactive 8-direction SVG compass. Arrow keys move the selection around
 * the dial (Up/Down step north/south, Left/Right step clockwise/widdershins),
 * Enter/Space confirms — same as clicking a segment. Each segment carries a
 * ~44px hit target and an aria-label for screen readers.
 */
export default function CompassWidget({
  value,
  onChange,
  size = 220,
  compact = false,
  labelledBy,
}: CompassWidgetProps) {
  const liveRef = useRef<HTMLSpanElement>(null);
  const interactive = Boolean(onChange);
  const selectedIndex = value ? ORIENTATIONS.findIndex((o) => o.id === value) : -1;

  const move = (delta: number) => {
    if (!onChange) return;
    const from = selectedIndex === -1 ? 0 : selectedIndex;
    const next = (from + delta + ORIENTATIONS.length) % ORIENTATIONS.length;
    const dir = ORIENTATIONS[next]!;
    onChange(dir.id);
    const live = liveRef.current;
    if (live) live.textContent = `Tanlangan: ${dir.label}`;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onChange) return;
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        move(-1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-2);
        break;
      case 'ArrowDown':
        e.preventDefault();
        move(2);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (selectedIndex !== -1) {
          const dir = ORIENTATIONS[selectedIndex]!;
          onChange(dir.id);
          const live = liveRef.current;
          if (live) live.textContent = `Tasdiqlandi: ${dir.label}`;
        }
        break;
      default:
        break;
    }
  };

  return (
    <div
      className={`compass${compact ? ' is-compact' : ''}${interactive ? ' is-interactive' : ''}`}
      style={{ width: size }}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={interactive ? 'Quyosh yo\u2019nalishini tanlang' : 'Quyosh yo\u2019nalishi'}
      aria-labelledby={labelledBy}
      tabIndex={interactive ? 0 : -1}
      onKeyDown={onKeyDown}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={size} height={size} aria-hidden="true">
        <circle className="compass-face" cx={C} cy={C} r={102} />
        {!compact && <circle className="compass-ring" cx={C} cy={C} r={70} />}
        {!compact && (
          <>
            <line className="compass-cross" x1={C} y1={12} x2={C} y2={C - POINT_R - 2} />
            <line className="compass-cross" x1={C} y1={C + POINT_R + 2} x2={C} y2={208} />
            <line className="compass-cross" x1={12} y1={C} x2={C - POINT_R - 2} y2={C} />
            <line className="compass-cross" x1={C + POINT_R + 2} y1={C} x2={208} y2={C} />
          </>
        )}

        {/* Sun path (illustrative): arcs from East → South → West */}
        <polyline className="compass-sun-arc" points={sunArcPath()} fill="none" />
        <circle className="compass-sun" cx={pt(150, SUN_R).x} cy={pt(150, SUN_R).y} r={5} />

        {ORIENTATIONS.map((o) => {
          const p = pt(o.azimuth, POINT_R);
          const lp = pt(o.azimuth, LABEL_R);
          const selected = o.id === value;
          return (
            <g
              key={o.id}
              className={`compass-dir${selected ? ' is-selected' : ''}`}
              role={interactive ? 'radio' : undefined}
              aria-checked={interactive ? selected : undefined}
              aria-label={`${o.label} yo\u2019nalishi`}
              onClick={() => onChange?.(o.id)}
              style={{ cursor: interactive ? 'pointer' : 'default' }}
            >
              <circle className="compass-hit" cx={p.x} cy={p.y} r={HIT_R} />
              {selected && <circle className="compass-glow" cx={p.x} cy={p.y} r={17} />}
              <circle className="compass-point" cx={p.x} cy={p.y} r={selected ? 13 : 10} />
              {selected && <circle className="compass-dot" cx={p.x} cy={p.y} r={4.5} />}
              <text
                className={`compass-label${selected ? ' is-selected' : ''}`}
                x={lp.x}
                y={lp.y}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {o.short}
              </text>
            </g>
          );
        })}
      </svg>
      <span ref={liveRef} className="sr-only" aria-live="polite" />
    </div>
  );
}

export function compassValueFromLabel(label: string | null | undefined): OrientationId | null {
  if (!label) return null;
  const found = ORIENTATIONS.find((o) => o.label === label);
  return found ? found.id : null;
}

export function orientationLabel(dir: OrientationId | null | undefined): string {
  if (!dir) return '';
  return ORIENTATION_BY_ID[dir]?.label ?? '';
}
