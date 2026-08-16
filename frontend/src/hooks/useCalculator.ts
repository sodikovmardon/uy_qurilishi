import { useEffect, useState } from 'react';
import type { CalculationResult } from '../types';

/**
 * Pure widget calculation mirroring the backend formula (api/views._calculate_materials).
 * Runs synchronously so the hero widget shows real numbers instantly and never
 * blocks on the network or spins forever.
 */
export function calculateWidget(area: number, rooms: number): CalculationResult {
  const safeArea = Math.max(area, 0);
  const safeRooms = Math.max(rooms, 0);
  const wallArea = Math.sqrt(safeArea) * 4 * 3 * 0.85;
  const bricks = Math.round(wallArea * 400);
  const cement = Math.round(((bricks / 1000) * 0.5) * 10) / 10;
  const sand = Math.round(cement * 3 * 10) / 10;

  let storeys = 1;
  if (safeArea >= 2600 || safeRooms >= 14) storeys = 3;
  else if (safeArea >= 900 || safeRooms >= 8) storeys = 2;

  return { bricks, cement, sand, storeys };
}

export interface WidgetResult extends CalculationResult {
  loading: boolean;
  error: boolean;
}

const RECALC_MS = 250;
const FAIL_MS = 2000;

/**
 * Live widget calculator.
 * - Initial state is computed synchronously → values visible on first paint.
 * - Brief spinner (250ms) during recalculation while the user drags the slider.
 * - Safety fallback: if the settle timeout is ever missed, error → "—" in the UI.
 */
export function useCalculator(area: number, rooms: number): WidgetResult {
  const [result, setResult] = useState<CalculationResult>(() => calculateWidget(area, rooms));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResult(calculateWidget(area, rooms));
    setError(false);
    setLoading(true);

    const settle = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, RECALC_MS);
    const guard = window.setTimeout(() => {
      if (!cancelled) setError(true);
    }, FAIL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(settle);
      window.clearTimeout(guard);
    };
  }, [area, rooms]);

  return { ...result, loading, error };
}
