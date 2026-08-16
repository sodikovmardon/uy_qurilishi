/**
 * Construction-stages estimate ("Qurilish bosqichlari").
 * Breaks the flat material total into 4 phases — poydevor, devorlar, tom,
 * ichki ishlar — each with its own material breakdown, cost and duration.
 *
 * NOTE: foundation / roof / interior figures are heuristic estimates derived
 * from the wall inputs (footprint = rooms × 18 m²). Replace the constants and
 * formulas below with a real backend stage-engine when one exists.
 */
import type { CalcInputs, CalcResult } from './calculator';
import { formatUZS, getRegion } from './calculator';
import { REGIONS } from '../config/regions';

export type StageIcon = 'foundation' | 'walls' | 'roof' | 'interior';

export interface StageMaterial {
  name: string;
  quantity: string;
  cost: number;
}

export interface Stage {
  id: string;
  title: string;
  subtitle: string;
  icon: StageIcon;
  duration: string;
  cost: number;
  /** Interior finishing is a heuristic range — min/max defined for the last stage. */
  costMin?: number;
  costMax?: number;
  materials: StageMaterial[];
}

export interface StagesPlan {
  stages: Stage[];
  grandTotal: number;
  grandMin: number;
  grandMax: number;
  totalWeeks: string;
  footprint: number;
}

/* ---- heuristic constants (region-index scaled) ---- */
const FOUNDATION = {
  concretePerM2: 0.3, // m³ concrete per m² of slab+footings
  rebarKgPerM3: 70, // kg rebar per m³ concrete
  gravelPerM2: 0.15, // m³ gravel bed per m² footprint
  concretePrice: 1_150_000, // UZS/m³ (Toshkent base)
  rebarPrice: 9_500, // UZS/kg
  gravelPrice: 220_000, // UZS/m³
};

const ROOF = {
  factor: 1.25, // roof area = footprint × factor (slope + overhang)
  perM2: 145_000, // UZS/m² metal-profile roofing (Toshkent base)
  insulationPerM2: 0.55, // m² insulation per m² roof
};

const INTERIOR = {
  /** Interior range = [walls × 0.45, walls × 0.85] of the walls-stage cost. */
  minFactor: 0.45,
  maxFactor: 0.85,
  paintShare: 0.32,
  flooringShare: 0.4,
  electricShare: 0.28,
};

const ROOMS_PER_M2 = 18;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function buildStagesPlan(inputs: CalcInputs, result: CalcResult, overrides?: { brick?: number; cement?: number; sand?: number }): StagesPlan {
  const region = getRegion(inputs.region);
  const idx = region.priceIndex;
  const footprint = inputs.rooms * ROOMS_PER_M2;
  const wallsCost = result.valid
    ? result.rows.reduce((s, r) => s + r.subtotal, 0)
    : 0;

  const r = (n: number) => Math.round(n);

  /* ---- Poydevor (foundation) ---- */
  const concrete = Math.round(footprint * FOUNDATION.concretePerM2 * 100) / 100;
  const rebar = Math.round(concrete * FOUNDATION.rebarKgPerM3);
  const gravel = Math.round(footprint * FOUNDATION.gravelPerM2 * 100) / 100;
  const concreteCost = r(concrete * FOUNDATION.concretePrice * idx);
  const rebarCost = r(rebar * FOUNDATION.rebarPrice * idx);
  const gravelCost = r(gravel * FOUNDATION.gravelPrice * idx);
  const foundationCost = concreteCost + rebarCost + gravelCost;
  const foundationWeeks = clamp(Math.round(footprint / 45) + 1, 2, 4);

  /* ---- Devorlar (walls) ---- */
  const wallsMaterials: StageMaterial[] = result.rows.map((row) => ({
    name: row.material,
    quantity: `${row.quantity} ${row.unit}`,
    cost: row.subtotal,
  }));
  const wallsWeeks = [clamp(Math.round(result.bricks / 5000), 2, 6), clamp(Math.round(result.bricks / 3000), 2, 8)];

  /* ---- Tom (roof) ---- */
  const roofArea = Math.round(footprint * ROOF.factor * 100) / 100;
  const roofCost = r(roofArea * ROOF.perM2 * idx);
  const insulationM2 = Math.round(roofArea * ROOF.insulationPerM2 * 100) / 100;
  const insulationCost = r(insulationM2 * 48_000 * idx);

  /* ---- Ichki ishlar (interior) — heuristic % range ---- */
  const interiorMin = Math.round(wallsCost * INTERIOR.minFactor);
  const interiorMax = Math.round(wallsCost * INTERIOR.maxFactor);
  const interiorMid = Math.round((interiorMin + interiorMax) / 2);

  const stages: Stage[] = [
    {
      id: 'poydevor',
      title: 'Poydevor',
      subtitle: 'Beton, armatura va shag’al',
      icon: 'foundation',
      duration: `${foundationWeeks - 1}-${foundationWeeks} hafta`,
      cost: foundationCost,
      materials: [
        { name: 'Beton (B15/B20)', quantity: `${concrete} m³`, cost: concreteCost },
        { name: 'Armatura', quantity: `${rebar} kg`, cost: rebarCost },
        { name: 'Shag’al (to’shama)', quantity: `${gravel} m³`, cost: gravelCost },
      ],
    },
    {
      id: 'devorlar',
      title: 'Devorlar',
      subtitle: 'G’isht, sement va qum',
      icon: 'walls',
      duration: `${wallsWeeks[0]}-${wallsWeeks[1]} hafta`,
      cost: wallsCost,
      materials: wallsMaterials,
    },
    {
      id: 'tom',
      title: 'Tom',
      subtitle: 'Metall profil va izolyatsiya',
      icon: 'roof',
      duration: '2-3 hafta',
      cost: roofCost + insulationCost,
      materials: [
        { name: 'Metall profil (tom yopma)', quantity: `${roofArea} m²`, cost: roofCost },
        { name: 'Izolyatsiya', quantity: `${insulationM2} m²`, cost: insulationCost },
      ],
    },
    {
      id: 'ichki',
      title: 'Ichki ishlar',
      subtitle: 'Bo’yoq, pollar, elektr va sanitariya',
      icon: 'interior',
      duration: '4-8 hafta',
      cost: interiorMid,
      costMin: interiorMin,
      costMax: interiorMax,
      materials: [
        { name: 'Bo’yoq va pardoz', quantity: 'taxminan', cost: Math.round(interiorMid * INTERIOR.paintShare) },
        { name: 'Yopiq pollar', quantity: 'taxminan', cost: Math.round(interiorMid * INTERIOR.flooringShare) },
        { name: 'Elektr va sanitariya', quantity: 'taxminan', cost: Math.round(interiorMid * INTERIOR.electricShare) },
      ],
    },
  ];

  const fixed = stages.filter((s) => s.costMin === undefined).reduce((s, st) => s + st.cost, 0);
  const grandTotal = fixed + interiorMid;
  const grandMin = fixed + interiorMin;
  const grandMax = fixed + interiorMax;

  const wMin = stages.reduce((s, st) => s + parseInt(st.duration.split('-')[0] || '0', 10), 0);
  const wMax = stages.reduce((s, st) => s + parseInt(st.duration.split('-')[1]?.split(' ')[0] || '0', 10), 0);

  return { stages, grandTotal, grandMin, grandMax, totalWeeks: `${wMin}-${wMax} hafta`, footprint };
}

export function stageCurrency(stage: Stage): string {
  return stage.costMin !== undefined
    ? `${formatUZS(stage.costMin)} – ${formatUZS(stage.costMax ?? stage.cost)}`
    : formatUZS(stage.cost);
}

/** Region base prices reused by the stages engine (index-scaled). */
export { REGIONS, formatUZS };
