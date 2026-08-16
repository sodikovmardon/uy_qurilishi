/**
 * Budget planner ("Byudjet rejalashtirish") — splits a user-entered total
 * budget across 6 construction phases and compares each phase against the
 * heuristic estimate produced by the stages engine (lib/stages.ts), so the
 * two tools stay consistent with one another.
 *
 * Allocation math keeps the six percentages summing to exactly 100 whenever a
 * slider moves ("Jami: 100%" / "Jami: 105% — tuzating" validation).
 */
import type { CalcInputs, CalcResult } from './calculator';
import { buildStagesPlan } from './stages';

export type BudgetPhaseId = 'poydevor' | 'devorlar' | 'tom' | 'ichki' | 'elektr' | 'zaxira';

export interface BudgetPhase {
  id: BudgetPhaseId;
  title: string;
  subtitle: string;
  color: string;
  defaultPct: number;
}

export const BUDGET_PHASES: BudgetPhase[] = [
  { id: 'poydevor', title: 'Poydevor', subtitle: 'Beton, armatura va shag’al', color: '#007AFF', defaultPct: 15 },
  { id: 'devorlar', title: 'Devorlar', subtitle: 'G’isht, sement va qum', color: '#34C759', defaultPct: 30 },
  { id: 'tom', title: 'Tom', subtitle: 'Metall profil va izolyatsiya', color: '#AF52DE', defaultPct: 15 },
  { id: 'ichki', title: 'Ichki pardozlash', subtitle: 'Bo’yoq, pollar va pardoz', color: '#FF2D92', defaultPct: 25 },
  { id: 'elektr', title: 'Elektr-santexnika', subtitle: 'Kabel, quvurlar va qurilmalar', color: '#00BFA6', defaultPct: 10 },
  { id: 'zaxira', title: 'Boshqa/zaxira', subtitle: 'Kutilmagan xarajatlar', color: '#F5A623', defaultPct: 5 },
];

export const DEFAULT_ALLOCATIONS = BUDGET_PHASES.map((p) => p.defaultPct);

export type BudgetStatus = 'ok' | 'tight' | 'over' | 'none';

export interface BudgetPhaseRow {
  id: BudgetPhaseId;
  title: string;
  subtitle: string;
  color: string;
  pct: number;
  /** UZS allocated to this phase from the total budget. */
  planned: number;
  /** Stages-engine estimate for this phase. */
  calculated: number;
  status: BudgetStatus;
}

export interface BudgetComparison {
  rows: BudgetPhaseRow[];
  totalBudget: number;
  calculatedTotal: number;
  calculatedMin: number;
  calculatedMax: number;
  overallStatus: BudgetStatus;
  /** Positive when the budget falls short of the calculated total. */
  overage: number;
  /** Positive when the budget exceeds the calculated total. */
  spare: number;
}

/**
 * Status thresholds: ≥100% → ok (green), ≥90% → tight (orange), else over (red).
 * `none` is reserved for phases with no calculated counterpart (zaxira).
 */
export function statusFor(planned: number, calculated: number): BudgetStatus {
  if (calculated <= 0) return 'none';
  if (planned >= calculated) return 'ok';
  if (planned >= calculated * 0.9) return 'tight';
  return 'over';
}

/**
 * Rebalance phase percentages after one slider moves so the six values always
 * sum to exactly 100. The remainder is redistributed to the other phases in
 * proportion to their current share; largest remainders absorb rounding drift.
 */
export function rebalanceAllocation(all: number[], changedIndex: number, newValue: number): number[] {
  const next = all.slice();
  const value = Math.min(100, Math.max(0, Math.round(newValue)));
  next[changedIndex] = value;
  const remaining = 100 - value;
  const others = all.map((_, i) => i).filter((i) => i !== changedIndex);
  const weightSum = others.reduce((s, i) => s + Math.max(0, all[i] ?? 0), 0);

  if (weightSum <= 0 || remaining <= 0) {
    const share = Math.floor(remaining / others.length);
    let acc = 0;
    others.forEach((i, k) => {
      const v = k === others.length - 1 ? remaining - acc : share;
      next[i] = v;
      acc += v;
    });
  } else {
    const raw = others.map((i) => (remaining * Math.max(0, all[i] ?? 0)) / weightSum);
    const ints = raw.map(Math.floor);
    others.forEach((i, k) => {
      next[i] = ints[k] ?? 0;
    });
    const drift = remaining - ints.reduce((s, v) => s + v, 0);
    const byFrac = others
      .map((i, k) => ({ i, frac: (raw[k] ?? 0) - (ints[k] ?? 0) }))
      .sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < drift; k++) {
      const target = byFrac[k % byFrac.length];
      if (target) next[target.i] = (next[target.i] ?? 0) + 1;
    }
  }

  // Guard against any remaining drift from integer edge cases.
  const total = next.reduce((s, v) => s + v, 0);
  if (total !== 100) {
    const delta = 100 - total;
    const idx = next.indexOf(Math.max(...next));
    if (idx >= 0) next[idx] = (next[idx] ?? 0) + delta;
  }
  return next;
}

/**
 * Build the per-phase comparison between the current allocation (percentages)
 * and the stages-engine estimate for the same inputs. The interior stage is
 * split into finishing vs. electric by re-reading the interior materials row,
 * so the six calculated segments still sum to the engine's grand total.
 */
export function buildBudgetComparison(
  inputs: CalcInputs,
  result: CalcResult,
  allocations: number[],
  budget: number,
): BudgetComparison {
  const plan = buildStagesPlan(inputs, result);
  const stage = (id: string) => plan.stages.find((s) => s.id === id);

  const interior = stage('ichki');
  const interiorCost = interior?.cost ?? 0;
  const electricCost =
    interior?.materials.find((m) => m.name.toLowerCase().includes('elektr'))?.cost ??
    Math.round(interiorCost * 0.28);

  const byId: Record<BudgetPhaseId, number> = {
    poydevor: stage('poydevor')?.cost ?? 0,
    devorlar: stage('devorlar')?.cost ?? 0,
    tom: stage('tom')?.cost ?? 0,
    ichki: Math.max(0, interiorCost - electricCost),
    elektr: electricCost,
    zaxira: 0,
  };

  const rows: BudgetPhaseRow[] = BUDGET_PHASES.map((phase, i) => {
    const pct = allocations[i] ?? phase.defaultPct;
    const planned = Math.round((budget * pct) / 100);
    const calculated = byId[phase.id];
    return {
      ...phase,
      pct,
      planned,
      calculated,
      status: statusFor(planned, calculated),
    };
  });

  const calculatedTotal = rows.reduce((s, r) => s + r.calculated, 0);

  return {
    rows,
    totalBudget: budget,
    calculatedTotal,
    calculatedMin: plan.grandMin,
    calculatedMax: plan.grandMax,
    overallStatus: statusFor(budget, calculatedTotal),
    overage: Math.max(0, calculatedTotal - budget),
    spare: Math.max(0, budget - calculatedTotal),
  };
}

/** Compact display for the donut centre (e.g. "150 mln"). */
export function shortUZS(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')} mlrd`;
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)} mln`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} ming`;
  return String(Math.round(n));
}

/** Parse a user-typed budget string (thousand separators stripped) into a number. */
export function parseBudget(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? Math.min(Number(digits), Number.MAX_SAFE_INTEGER) : 0;
}

/** Format a budget number with thin spaces as thousand separators (no suffix). */
export function formatBudget(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
