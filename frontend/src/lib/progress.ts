/**
 * Lightweight top-of-page progress store (Phase 11).
 *
 * A tiny pub/sub singleton so any async action (route navigation, PDF
 * generation, form submission) can surface a thin perceived-performance
 * progress bar without a heavyweight global-state dependency.
 */
type Listener = (value: number) => void;

let value = 0;
let running = false;
let rafId: number | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const fn of listeners) fn(value);
}

export function subscribeProgress(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Kick off an indeterminate run: start at ~12% and asymptotically creep toward 90%. */
export function startProgress(): void {
  if (running) return;
  running = true;
  value = 12;
  emit();

  const step = () => {
    if (!running) return;
    const target = value < 70 ? value + (70 - value) * 0.08 : value + (90 - value) * 0.02;
    value = Math.min(target, 90);
    emit();
    rafId = requestAnimationFrame(step);
  };
  rafId = requestAnimationFrame(step);
}

/** Complete the run at 100%, then reset the bar after it fades. */
export function finishProgress(): void {
  if (!running) return;
  running = false;
  if (rafId !== null) cancelAnimationFrame(rafId);
  value = 100;
  emit();
  window.setTimeout(() => {
    value = 0;
    emit();
  }, 300);
}

/** Run an async task behind the progress bar (starts + always finishes). */
export async function runWithProgress<T>(task: () => Promise<T>): Promise<T> {
  startProgress();
  try {
    return await task();
  } finally {
    finishProgress();
  }
}
