import { useMemo } from 'react';
import type { CalculationResult } from '../types';

function estimateStoreys(area: number, rooms: number): number {
  if (area >= 2600 || rooms >= 14) return 3;
  if (area >= 900 || rooms >= 8) return 2;
  return 1;
}

export function useCalculator(area: number, rooms: number): CalculationResult {
  return useMemo(() => {
    const perimeter = Math.sqrt(area) * 4;
    const wallArea = perimeter * 3 * 0.85;
    const bricks = Math.round(wallArea * 400);
    const cement = parseFloat(((bricks / 1000) * 0.5).toFixed(1));
    const sand = parseFloat((cement * 3).toFixed(1));
    const storeys = estimateStoreys(area, rooms);

    return { bricks, cement, sand, storeys };
  }, [area, rooms]);
}
