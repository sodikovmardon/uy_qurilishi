/**
 * Haptic vibration helper (Phase 11).
 *
 * Triggers a short vibration on supporting mobile browsers, reserved for
 * meaningful confirmatory actions only (save, bookmark, PDF, submit).
 * Fails silently on devices/browsers without vibration support.
 */
export function vibrate(pattern: number | number[] = 10): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // no vibration support — skip silently
  }
}
