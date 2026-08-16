/**
 * Comparison builders — normalize saved calculations and projects into a
 * single data shape consumed by ComparisonModal, so both features share
 * the same comparison component and logic.
 */
import type { SavedCalculation } from './storage';
import { estimateForArea, formatUZS, type PriceOverrides } from './calculator';

export interface CompareRow {
  label: string;
  a: number;
  b: number;
  format: (n: number) => string;
}

export interface ComparisonData {
  titleA: string;
  titleB: string;
  rows: CompareRow[];
  totalLabel: string;
  totalA: number;
  totalB: number;
}

const int = (n: number) => Math.round(n).toLocaleString('ru-RU');

export function buildSavedCalcComparison(a: SavedCalculation, b: SavedCalculation): ComparisonData {
  const rows: CompareRow[] = [
    { label: 'Maydoni (m²)', a: a.wallLength * a.wallHeight * a.rooms, b: b.wallLength * b.wallHeight * b.rooms, format: int },
    { label: 'G’isht soni', a: a.bricks, b: b.bricks, format: int },
    { label: 'Sement (qop)', a: a.cementBags, b: b.cementBags, format: int },
    { label: 'Qum (m³)', a: a.sandM3, b: b.sandM3, format: (n) => String(n) },
  ];
  return {
    titleA: `${a.wallLength}×${a.wallHeight} m · ${a.rooms} xona`,
    titleB: `${b.wallLength}×${b.wallHeight} m · ${b.rooms} xona`,
    rows,
    totalLabel: 'Jami narx (UZS)',
    totalA: a.total,
    totalB: b.total,
  };
}

export function buildProjectComparison(a: ProjectLike, b: ProjectLike, prices?: PriceOverrides): ComparisonData {
  const ea = estimateForArea(a.area, a.rooms, prices);
  const eb = estimateForArea(b.area, b.rooms, prices);
  const rows: CompareRow[] = [
    { label: 'Maydoni (m²)', a: a.area, b: b.area, format: int },
    { label: 'Xonalar', a: a.rooms, b: b.rooms, format: int },
    { label: 'Taxminiy smeta (UZS)', a: ea.total, b: eb.total, format: formatUZS },
  ];
  return {
    titleA: `#${a.id} · ${a.area} m² · ${a.rooms} xona`,
    titleB: `#${b.id} · ${b.area} m² · ${b.rooms} xona`,
    rows,
    totalLabel: 'Taxminiy narx (UZS)',
    totalA: ea.total,
    totalB: eb.total,
  };
}

export interface ProjectLike {
  id: number | string;
  area: number;
  rooms: number;
}

/** "+2 350 000 so’m (18% qimmatroq)" — diff + percentage of the pricier one. */
export function totalDiffText(totalA: number, totalB: number): string {
  if (totalA === totalB) return 'Narxlar teng';
  const diff = Math.abs(totalA - totalB);
  const pct = Math.round((diff / Math.max(totalA, totalB)) * 100);
  return `+${formatUZS(diff)} (${pct}% qimmatroq)`;
}
