import { useState, useEffect, useRef } from 'react';

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function useCountAnimation(
  target: number,
  duration = 1000,
  active = true
): number {
  const [current, setCurrent] = useState(0);
  const prevTarget = useRef(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setCurrent(0);
      prevTarget.current = 0;
      return;
    }

    const start = prevTarget.current;
    const diff = target - start;
    if (diff === 0) return;

    const begin = performance.now();

    function tick(now: number) {
      const elapsed = now - begin;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutExpo(progress);
      setCurrent(Math.round(start + diff * eased));

      if (progress < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        prevTarget.current = target;
      }
    }

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      prevTarget.current = target;
    };
  }, [target, duration, active]);

  return current;
}
