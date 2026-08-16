/**
 * Land-plot project matcher ("Yer uchastkasi bo'yicha loyiha tanlash").
 * Pure logic: sotix↔m² conversion, buildable-footprint calculation, fit test.
 * Kept UI-free so the ProjectsPage filter, the plot panel and the calculator
 * prefill all share one consistent model.
 */
import type { ProjectItem } from '../components/projects/ProjectModal';

/** 1 sotix = 100 m² (standard Uzbek land measure). */
export const SOTIX_TO_M2 = 100;

export interface PlotInput {
  /** Total plot area in m² — the single source of truth. */
  areaM2: number;
  /** Optional width (m) — drives the rectangle illustration & setback math. */
  width?: number;
  length?: number;
  /** Building coverage ratio, % of plot area (e.g. 50). */
  coveragePct: number;
  /** Street setback in metres (0 = none). */
  setbackM: number;
}

export interface PlotCalc {
  areaM2: number;
  sotix: number;
  /** Usable building footprint in m² (area × coverage, minus setback strip). */
  footprintM2: number;
  /** Square metres lost to the street setback. */
  setbackM2: number;
  coveragePct: number;
  hasSetback: boolean;
}

/** Estimated number of storeys from total area + rooms (shared across pages). */
export function estimateStoreys(area: number, rooms: number): number {
  if (area >= 2600 || rooms >= 14) return 3;
  if (area >= 900 || rooms >= 8) return 2;
  return 1;
}

export function m2ToSotix(m2: number): number {
  return m2 / SOTIX_TO_M2;
}

export function sotixToM2(sotix: number): number {
  return sotix * SOTIX_TO_M2;
}

/** Human-friendly dual-unit label: "6 sotix (600 m²)". */
export function formatPlot(areaM2: number): string {
  const m2 = Math.round(areaM2);
  const s = Math.round(m2ToSotix(areaM2) * 10) / 10;
  return `${s} sotix (${m2} m²)`;
}

/** Sanitized rectangular estimate: user dims, or a square of the same area. */
function rectDims(input: PlotInput): { w: number; l: number } {
  const hasDims = input.width != null && input.width > 0 && input.length != null && input.length > 0;
  if (hasDims) return { w: input.width!, l: input.length! };
  const side = Math.sqrt(input.areaM2);
  return { w: side, l: side };
}

/**
 * Validate user input. Returns an error map keyed by field; warnings are
 * advisory (e.g. unrealistically high coverage) and returned separately.
 */
export function validatePlot(input: PlotInput): { errors: Record<string, string>; warnings: Record<string, string> } {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  if (!Number.isFinite(input.areaM2) || input.areaM2 <= 0) {
    errors.area = 'Uchastka maydoni 0 dan katta bo’lishi kerak';
  } else if (input.areaM2 > 100_000) {
    errors.area = 'Maydon juda katta (maks 100 000 m²)';
  }

  if (input.width != null && input.width > 0 && input.length != null && input.length > 0) {
    if (input.width > 500) errors.width = 'Eni juda katta (maks 500 m)';
    if (input.length > 500) errors.length = 'Bo’yi juda katta (maks 500 m)';
  }

  if (!Number.isFinite(input.coveragePct) || input.coveragePct <= 0) {
    errors.coverage = 'Qurilish foizi 0 dan katta bo’lishi kerak';
  } else if (input.coveragePct > 95) {
    errors.coverage = 'Qurilish foizi 95% dan oshmasligi kerak';
  } else if (input.coveragePct >= 85) {
    warnings.coverage =
      '85% va undan yuqori ulush amaliyotda kam uchraydi — hovli, yashil maydon va yo’llar uchun joy qoldiring';
  }

  if (input.setbackM < 0) errors.setback = 'Chekinish 0 dan kichik bo’lmasin';
  else if (input.setbackM > 50) errors.setback = 'Chekinish juda katta (maks 50 m)';

  return { errors, warnings };
}

/**
 * Usable building footprint = (area × coverage ratio) minus the street
 * setback strip. The setback strip is computed on a rectangle — the entered
 * width×length or, failing that, a square of the same area.
 */
export function calcBuildable(input: PlotInput): PlotCalc {
  const { w, l } = rectDims(input);
  const inner = Math.max(w - 2 * input.setbackM, 0) * Math.max(l - 2 * input.setbackM, 0);
  const gross = input.areaM2 * (input.coveragePct / 100);
  const footprintM2 = Math.min(gross, inner);
  return {
    areaM2: input.areaM2,
    sotix: m2ToSotix(input.areaM2),
    footprintM2: Math.max(0, footprintM2),
    setbackM2: Math.max(0, input.areaM2 - inner),
    coveragePct: input.coveragePct,
    hasSetback: input.setbackM > 0,
  };
}

/** A project's ground footprint = total area ÷ storeys. */
export function projectFootprint(p: ProjectItem): number {
  const storeys = estimateStoreys(p.area, p.rooms);
  return p.area / Math.max(storeys, 1);
}

/** Whether the project's ground footprint fits the usable plot footprint. */
export function fitsPlot(calc: PlotCalc, p: ProjectItem): boolean {
  return projectFootprint(p) <= calc.footprintM2 + 1e-6;
}
