import { useEffect, useRef } from 'react';

/**
 * Debounced effect — runs `fn` `ms` after `value` changes.
 * Skips the first run so restored state is not immediately re-saved.
 */
export function useDebouncedEffect(value: unknown, ms: number, fn: () => void): void {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(fn, ms);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ms]);
}
