/**
 * Mock market data — regional prices + 12-month price history ("Mintaqalar
 * bo'yicha narxlar" + "Narxlar tarixi").
 *
 * NOTE: All figures here are realistic *sample* data so the UI is fully
 * demoable. Replace REGION_PRICES and PRICE_HISTORY with a real backend API
 * (e.g. GET /api/prices/?material=...) when the market feed is wired up.
 * Region unit prices are scaled from the Toshkent shahri base by each
 * region's priceIndex (config/regions.ts) and are therefore estimates.
 */
import { getDefaultBrickPrice } from '../config/prices';
import { getRegionById, REGIONS, type Region } from '../config/regions';

export type MaterialKey = 'brick' | 'cement' | 'sand';
export type RegionId = (typeof REGIONS)[number]['id'];

export interface RegionPrice {
  id: RegionId;
  name: string;
  /** per-unit base price in UZS (brick = 1 dona, cement = 1 qop, sand = 1 m³) */
  brick: number;
  cement: number;
  sand: number;
}

/** Base (Toshkent shahri) prices per material; regions vary these by priceIndex. */
const BASE_PRICES = { brick: 1900, cement: 78000, sand: 95000 } as const;

/** Estimated per-region prices = base × region.priceIndex (rounded to 10 UZS). */
const round10 = (v: number) => Math.round(v / 10) * 10;

export const REGION_PRICES: RegionPrice[] = REGIONS.map((r: Region) => ({
  id: r.id as RegionId,
  name: r.name,
  brick: round10(BASE_PRICES.brick * r.priceIndex),
  cement: round10(BASE_PRICES.cement * r.priceIndex),
  sand: round10(BASE_PRICES.sand * r.priceIndex),
}));

const BASE_REGION_PRICE = REGION_PRICES.find((r) => r.id === 'toshkent_shahar') ?? REGION_PRICES[REGION_PRICES.length - 1]!;

export function getRegionPrice(regionId: string): RegionPrice {
  return REGION_PRICES.find((r) => r.id === getRegionById(regionId).id) ?? BASE_REGION_PRICE;
}

/**
 * Full custom-price set for a region, scaled to the currently selected brick
 * type (the base brick price above is for silikat, so we rescale).
 */
export function regionPricesForBrick(regionId: string, brickId: string): { brick: number; cement: number; sand: number } {
  const base = getRegionPrice(regionId);
  const brick = Math.round(getDefaultBrickPrice(brickId) * (base.brick / BASE_REGION_PRICE.brick));
  return { brick, cement: base.cement, sand: base.sand };
}

export interface HistoryPoint {
  /** "2026-01" style month key */
  month: string;
  label: string;
  price: number;
}

const MONTH_KEYS = ['dek', 'yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy'];

/**
 * 12-month mock price history per material (ending this month).
 * Built once at module load from relative seeds so the chart always has data.
 */
function buildHistory(basePrice: number, seed: number): HistoryPoint[] {
  const now = new Date();
  const pts: HistoryPoint[] = [];
  let v = basePrice * (0.82 + (seed % 5) * 0.02);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    v *= 1 + ((seed * 7 + i * 5) % 11 - 4) / 100; // ±0.4%..0.6% monthly drift
    pts.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: MONTH_KEYS[12 - i - 1] ?? '',
      price: Math.round(v / 10) * 10,
    });
  }
  return pts;
}

export const PRICE_HISTORY: Record<MaterialKey, HistoryPoint[]> = {
  brick: buildHistory(1900, 3),
  cement: buildHistory(78000, 8),
  sand: buildHistory(95000, 5),
};

export const MATERIAL_LABELS: Record<MaterialKey, string> = {
  brick: 'G’isht (1 dona)',
  cement: 'Sement (1 qop)',
  sand: 'Qum (1 m³)',
};

/** Plain-Uzbek trend line: "So'nggi 3 oyda g'isht narxi 8% oshdi". */
export function getPriceInsight(material: MaterialKey): string {
  const series = PRICE_HISTORY[material];
  const last = series[series.length - 1]!;
  const threeAgo = series[Math.max(0, series.length - 4)]!;
  const pct = ((last.price - threeAgo.price) / threeAgo.price) * 100;
  const label = MATERIAL_LABELS[material].split(' ')[0]!.toLowerCase();
  if (Math.abs(pct) < 0.5) return `So’nggi 3 oyda ${label} narxi barqaror`;
  if (pct > 0) return `So’nggi 3 oyda ${label} narxi ${Math.abs(Math.round(pct))}% oshdi`;
  return `So’nggi 3 oyda ${label} narxi ${Math.abs(Math.round(pct))}% arzonlashdi`;
}
