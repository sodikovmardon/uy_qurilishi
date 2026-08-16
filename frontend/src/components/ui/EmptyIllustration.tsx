import type { CSSProperties, ReactNode } from 'react';

const BLUE = '#3B82F6';
const BLUE_LIGHT = '#60A5FA';
const MUTED = '#94A3B8';

interface IllustrationProps {
  size?: number;
  style?: CSSProperties;
}

/**
 * Lightweight self-contained SVG illustrations (Phase 11).
 * Line-art / duotone, matching the app's blue + muted palette.
 * Decorative — hidden from assistive tech (surrounding text carries meaning).
 */
export function EmptyIllustration({ size = 140, style, children }: IllustrationProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className="empty-illustration"
      style={style}
    >
      {children}
    </svg>
  );
}

function Sparkle({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={BLUE_LIGHT} strokeWidth="2" strokeLinecap="round">
      <line x1={x - 5} y1={y} x2={x + 5} y2={y} />
      <line x1={x} y1={y - 5} x2={x} y2={y + 5} />
    </g>
  );
}

/** Empty favorites — outlined heart with two sparkles. */
export function FavoritesEmpty(props: IllustrationProps) {
  return (
    <EmptyIllustration {...props}>
      <path
        d="M60 97 C36 81 22 67 22 50 C22 37 31 28 42 28 C48 28 55 32 58 38 L60 41 L62 38 C65 32 72 28 78 28 C89 28 98 37 98 50 C98 67 84 81 60 97 Z"
        stroke={BLUE}
        strokeWidth="3"
        strokeLinejoin="round"
        fill="rgba(59,130,246,0.10)"
      />
      <Sparkle x={27} y={15} />
      <Sparkle x={94} y={20} />
      <path d="M104 78 h4 M106 76 v4" stroke="#A5B4FC" strokeWidth="2" strokeLinecap="round" />
    </EmptyIllustration>
  );
}

/** Empty search results — magnifier over a small house silhouette. */
export function SearchEmpty(props: IllustrationProps) {
  return (
    <EmptyIllustration {...props}>
      <circle cx="51" cy="51" r="23" stroke={BLUE} strokeWidth="3" fill="rgba(59,130,246,0.08)" />
      <line x1="68" y1="68" x2="90" y2="90" stroke={BLUE} strokeWidth="5" strokeLinecap="round" />
      <path
        d="M42 60 V50 L51 41 L60 50 V60 Z"
        stroke={BLUE_LIGHT}
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="rgba(96,165,250,0.15)"
      />
      <path d="M48 60 V54 h6 v6" stroke={BLUE_LIGHT} strokeWidth="2" fill="none" />
    </EmptyIllustration>
  );
}

/** Empty saved calculations — clipboard with receipt rows. */
export function HistoryEmpty(props: IllustrationProps) {
  return (
    <EmptyIllustration {...props}>
      <path d="M49 24 V20 h22 v4" stroke={BLUE} strokeWidth="3" strokeLinejoin="round" />
      <rect x="39" y="22" width="42" height="78" rx="8" stroke={BLUE} strokeWidth="3" fill="rgba(59,130,246,0.08)" />
      <line x1="47" y1="37" x2="73" y2="37" stroke={BLUE_LIGHT} strokeWidth="2.5" strokeLinecap="round" />
      <g stroke={MUTED} strokeWidth="2" strokeLinecap="round">
        <line x1="47" y1="50" x2="73" y2="50" />
        <line x1="47" y1="58" x2="73" y2="58" />
        <line x1="47" y1="66" x2="73" y2="66" />
        <line x1="47" y1="74" x2="66" y2="74" />
      </g>
      <line x1="66" y1="86" x2="73" y2="86" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round" />
    </EmptyIllustration>
  );
}

/** Empty gallery placeholder — house blueprint on a dashed drawing sheet. */
export function GalleryEmpty(props: IllustrationProps) {
  return (
    <EmptyIllustration {...props}>
      <rect x="24" y="24" width="72" height="72" rx="4" stroke={MUTED} strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />
      <path
        d="M36 74 V52 L50 39 L64 52 V74 Z"
        stroke={BLUE}
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="rgba(59,130,246,0.10)"
      />
      <path d="M45 74 V62 h10 v12" stroke={BLUE} strokeWidth="2" fill="none" />
      <line x1="33" y1="84" x2="67" y2="84" stroke={BLUE_LIGHT} strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="33" y1="88" x2="33" y2="80" stroke={BLUE_LIGHT} strokeWidth="1.5" />
      <line x1="67" y1="88" x2="67" y2="80" stroke={BLUE_LIGHT} strokeWidth="1.5" />
      <path d="M72 40 h12 v12" stroke={BLUE_LIGHT} strokeWidth="1.5" fill="none" />
      <path d="M84 43 l3 3 l-3 3" stroke={BLUE_LIGHT} strokeWidth="1.5" fill="none" />
    </EmptyIllustration>
  );
}
