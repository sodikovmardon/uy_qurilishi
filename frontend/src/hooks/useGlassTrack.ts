import { useEffect, useRef } from 'react';

/**
 * Cursor-following specular highlight for liquid-glass cards.
 *
 * Sets `--mx` / `--my` CSS custom properties (% of the element) which the
 * `.glass-card--track` / `.glass-surface--track` background radial-gradient
 * consumes to position a glossy highlight under the pointer. Disabled for
 * coarse pointers (touch) and prefers-reduced-motion so touch devices and
 * motion-sensitive users get the static glass only.
 *
 * @returns ref to attach to the tracked element.
 */
export function useGlassTrack<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: none)').matches;

    // Touch/reduced-motion users don't get the cursor glow — same rule as CSS.
    if (reduceMotion || coarse) return;

    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '30%');

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty('--mx', `${x.toFixed(2)}%`);
      el.style.setProperty('--my', `${y.toFixed(2)}%`);
    };

    const onLeave = () => {
      el.style.setProperty('--mx', '50%');
      el.style.setProperty('--my', '30%');
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return ref;
}
