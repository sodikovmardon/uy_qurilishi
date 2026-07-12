import { useState, useEffect } from 'react';
import type { CalculationResult } from '../types';
import { api } from '../api/client';

export function useCalculator(area: number, rooms: number): CalculationResult & { loading: boolean } {
  const [result, setResult] = useState<CalculationResult>({ bricks: 0, cement: 0, sand: 0, storeys: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.calculate({ area, rooms }).then(data => {
      if (!cancelled) {
        setResult(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [area, rooms]);

  return { ...result, loading };
}
