/**
 * Construction progress tracker ("Qurilish jarayoni") — Phase 14.
 * Lets a user who actually started building track real progress against the
 * 5 construction phases (Poydevor, Devorlar, Tom, Ichki pardozlash,
 * Elektr-santexnika) that the calculator's stage engine estimates.
 *
 * Data lives in LocalStorage under "uy:construction-projects" and mirrors the
 * schema of the Budget Planner so a linked plan can later pull real
 * completion dates for planned-vs-actual reporting.
 */
import type { CalcInputs, CalcResult } from './calculator';
import { calculateMaterials } from './calculator';
import { BUDGET_PHASES, type BudgetPhaseId } from './budget';
import { buildStagesPlan } from './stages';
import { DEFAULT_REGION_ID } from '../config/regions';
import type { SavedCalculation } from './storage';

export type PhaseStatus = 'not_started' | 'in_progress' | 'completed';

export interface ConstructionPhoto {
  id: string;
  dataUrl: string;
  caption: string;
  createdAt: string;
}

export interface ConstructionNote {
  id: string;
  text: string;
  milestone: boolean;
  createdAt: string;
}

export interface TrackedPhase {
  /** Matches BUDGET_PHASE id (poydevor/devorlar/tom/ichki/elektr — no zaxira). */
  id: string;
  title: string;
  status: PhaseStatus;
  startedAt?: string;
  completedAt?: string;
  /** Estimated cost share (UZS) — used to weight overall progress; 1 = equal weight. */
  weight: number;
  /** Estimated duration range in weeks (from the stages-engine heuristics). */
  durationMin: number;
  durationMax: number;
  photos: ConstructionPhoto[];
}

export interface ConstructionProject {
  id: string;
  name: string;
  /** ISO date the user started (defaults to today). */
  startDate: string;
  sourceType?: 'calculation' | 'project' | 'budget';
  sourceId?: string;
  phases: TrackedPhase[];
  notes: ConstructionNote[];
  createdAt: string;
  updatedAt: string;
}

/** Tracked phase ids — the 5 progress phases (zaxira is not trackable). */
export const TRACKED_PHASE_IDS: BudgetPhaseId[] = ['poydevor', 'devorlar', 'tom', 'ichki', 'elektr'];

/** Estimated duration per phase (weeks) — mirrors lib/stages.ts heuristics. */
export const PHASE_DURATION_WEEKS: Record<BudgetPhaseId, { min: number; max: number }> = {
  poydevor: { min: 2, max: 4 },
  devorlar: { min: 2, max: 6 },
  tom: { min: 2, max: 3 },
  ichki: { min: 4, max: 8 },
  elektr: { min: 2, max: 3 },
  zaxira: { min: 0, max: 0 },
};

export const MAX_TRACKER_PHOTOS = 12;

const KEY = 'uy:construction-projects';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readAll(): ConstructionProject[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ConstructionProject[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(list: ConstructionProject[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function getConstructionProjects(): ConstructionProject[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getConstructionProject(id: string): ConstructionProject | undefined {
  return readAll().find((p) => p.id === id);
}

/** Insert or update a project; bumps updatedAt. Returns the new full list. */
export function saveConstructionProject(project: ConstructionProject): ConstructionProject[] {
  const list = readAll();
  const index = list.findIndex((p) => p.id === project.id);
  const next: ConstructionProject = { ...project, updatedAt: new Date().toISOString() };
  if (index >= 0) list[index] = next;
  else list.push(next);
  writeAll(list);
  return list;
}

export function deleteConstructionProject(id: string): ConstructionProject[] {
  const list = readAll().filter((p) => p.id !== id);
  writeAll(list);
  return list;
}

export function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Per-phase estimated cost share (UZS) for the 5 tracked phases, derived from
 * the stages engine the same way the Budget Planner splits its totals.
 * Returns null when the inputs are invalid.
 */
export function calcWeights(inputs: CalcInputs, result: CalcResult): number[] | null {
  if (!result.valid) return null;
  const plan = buildStagesPlan(inputs, result);
  const stage = (id: string) => plan.stages.find((s) => s.id === id);
  const interior = stage('ichki');
  const interiorCost = interior?.cost ?? 0;
  const electricCost =
    interior?.materials.find((m) => m.name.toLowerCase().includes('elektr'))?.cost ??
    Math.round(interiorCost * 0.28);
  const weights = [
    stage('poydevor')?.cost ?? 0,
    stage('devorlar')?.cost ?? 0,
    stage('tom')?.cost ?? 0,
    Math.max(0, interiorCost - electricCost),
    electricCost,
  ];
  return weights.map(Math.round);
}

/** Weights from a saved calculation ("Mening hisoblarim"). */
export function weightsFromSavedCalc(calc: SavedCalculation): number[] | null {
  if (!calc.wallLength || !calc.wallHeight || !calc.rooms) return null;
  const inputs: CalcInputs = {
    wallLength: calc.wallLength,
    wallHeight: calc.wallHeight,
    thickness: calc.thickness || 25,
    brickId: calc.brickId,
    rooms: calc.rooms,
    region: calc.region || DEFAULT_REGION_ID,
  };
  return calcWeights(inputs, calculateMaterials(inputs));
}

/** Weights from a bookmarked project (area + rooms → derived inputs). */
export function weightsFromProject(area: number, rooms: number): number[] | null {
  const side = Math.sqrt(Math.max(area, 1));
  const inputs: CalcInputs = {
    wallLength: Math.round(side * 100) / 100,
    wallHeight: 3,
    thickness: 25,
    brickId: 'silikat',
    rooms: Math.max(rooms, 1),
    region: DEFAULT_REGION_ID,
  };
  return calcWeights(inputs, calculateMaterials(inputs));
}

export function createConstructionProject(opts: {
  name: string;
  startDate: string;
  source?: { type: 'calculation' | 'project' | 'budget'; id: string };
  weights?: number[] | null;
}): ConstructionProject {
  const now = new Date().toISOString();
  const phases: TrackedPhase[] = TRACKED_PHASE_IDS.map((id, i) => {
    const meta = BUDGET_PHASES.find((p) => p.id === id);
    const dur = PHASE_DURATION_WEEKS[id];
    const weight = opts.weights?.[i] && opts.weights[i] > 0 ? opts.weights[i] : 1;
    return {
      id,
      title: meta?.title ?? id,
      status: 'not_started',
      weight,
      durationMin: dur.min,
      durationMax: dur.max,
      photos: [],
    };
  });
  const project: ConstructionProject = {
    id: uid(),
    name: opts.name,
    startDate: opts.startDate,
    sourceType: opts.source?.type,
    sourceId: opts.source?.id,
    phases,
    notes: [],
    createdAt: now,
    updatedAt: now,
  };
  saveConstructionProject(project);
  return project;
}

export interface TrackerProgress {
  pct: number;
  completed: number;
  total: number;
}

/** Overall progress weighted by each phase's estimated cost share. */
export function trackerProgress(project: ConstructionProject): TrackerProgress {
  const total = project.phases.reduce((s, ph) => s + ph.weight, 0);
  const done = project.phases.reduce((s, ph) => s + (ph.status === 'completed' ? ph.weight : 0), 0);
  return {
    pct: total > 0 ? Math.round((done / total) * 100) : 0,
    completed: project.phases.filter((ph) => ph.status === 'completed').length,
    total: project.phases.length,
  };
}

export function isProjectFinished(project: ConstructionProject): boolean {
  return project.phases.every((ph) => ph.status === 'completed');
}

export function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Inclusive days actually spent on a completed phase. */
export function phaseDurationDays(phase: TrackedPhase): number | null {
  if (!phase.startedAt || !phase.completedAt) return null;
  return daysBetween(phase.startedAt, phase.completedAt) + 1;
}

export interface DurationComparison {
  days: number;
  lateWeeks: number;
  onTime: boolean;
}

/** Estimated (weeks) vs actual (days) for a completed phase. */
export function compareDuration(phase: TrackedPhase): DurationComparison | null {
  const days = phaseDurationDays(phase);
  if (days === null) return null;
  const lateWeeks = Math.max(0, Math.round((days - phase.durationMax * 7) / 7));
  return { days, lateWeeks, onTime: lateWeeks <= 0 };
}

export function durationText(phase: TrackedPhase): string {
  const est = `${phase.durationMin}-${phase.durationMax} hafta`;
  const cmp = compareDuration(phase);
  if (!cmp) return `Rejalashtirilgan: ${est}`;
  const actualWeeks = Math.max(1, Math.round(cmp.days / 7));
  const outcome = cmp.onTime
    ? `Haqiqiy: ${actualWeeks} hafta — rejaga mos`
    : `Haqiqiy: ${actualWeeks} hafta — ${cmp.lateWeeks} hafta kechikish`;
  return `Rejalashtirilgan: ${est} · ${outcome}`;
}

/** Phases still "Jarayonda" past their estimated max duration. */
export function overduePhases(project: ConstructionProject, now: Date = new Date()): TrackedPhase[] {
  const today = todayIso();
  return project.phases.filter(
    (ph) => ph.status === 'in_progress' && ph.startedAt && daysBetween(ph.startedAt, today) >= ph.durationMax * 7,
  );
}

/**
 * Downscale an image file to a JPEG data-URL so photos survive LocalStorage.
 * Falls back to the raw data-URL when the image cannot be decoded.
 */
export async function fileToResizedDataUrl(file: File, maxWidth = 900, quality = 0.8): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  if (!raw.startsWith('data:image/')) return raw;
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / (img.width || 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round((img.width || 1) * scale));
      canvas.height = Math.max(1, Math.round((img.height || 1) * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(raw);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(raw);
    img.src = raw;
  });
}
