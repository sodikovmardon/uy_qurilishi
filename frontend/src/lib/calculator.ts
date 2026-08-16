/**
 * Pure material-calculation engine (Phase 5).
 * Separated from UI so it can be reused by the projects modal estimate too.
 */
import { BRICK_TYPES, FINISH_MATERIALS, MORTAR, WALL_THICKNESS, type BrickType } from '../config/prices';
import { getRegionById, DEFAULT_REGION_ID, type Region } from '../config/regions';
import { getCurrency } from './storage';

export interface CalcInputs {
  wallLength: number; // metres
  wallHeight: number; // metres
  thickness: number; // cm
  brickId: string;
  rooms: number;
  region: string;
}

export interface CalcRow {
  material: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
}

export interface CalcResult {
  valid: boolean;
  bricks: number;
  cementBags: number;
  sandM3: number;
  rows: CalcRow[];
  total: number;
  currency: string;
}

/**
 * Optional custom unit-price overrides (Phase 9).
 * Absent fields fall back to the configured defaults for the selected region/brick.
 */
export interface PriceOverrides {
  brickPrice?: number;
  cementBagPrice?: number;
  sandPrice?: number;
}

/** Map persisted MaterialPrices (storage) onto engine PriceOverrides. */
export function pricesToOverrides(p: { brick?: number; cement?: number; sand?: number }): PriceOverrides {
  return { brickPrice: p.brick, cementBagPrice: p.cement, sandPrice: p.sand };
}

/** Format a number with thin spaces as thousand separators + currency suffix (so'm or UZS). */
export function formatUZS(n: number): string {
  const s = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return getCurrency() === 'uzs' ? `${s} UZS` : `${s} so’m`;
}

export function getBrickType(id: string): BrickType {
  return BRICK_TYPES.find((b) => b.id === id) ?? BRICK_TYPES[0]!;
}

export function getRegion(id: string): Region {
  return getRegionById(id);
}

export function getThicknessFactor(cm: number): number {
  return WALL_THICKNESS.find((t) => t.value === cm)?.factor ?? 1;
}

/** Validate inputs; returns an error map keyed by field name. */
export function validateInputs(i: CalcInputs): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!i.wallLength || i.wallLength <= 0) errors.wallLength = 'Devor uzunligi 0 dan katta bo’lishi kerak';
  if (i.wallLength > 500) errors.wallLength = 'Uzunlik juda katta (maks 500 m)';
  if (!i.wallHeight || i.wallHeight <= 0) errors.wallHeight = 'Devor balandligi 0 dan katta bo’lishi kerak';
  if (i.wallHeight > 20) errors.wallHeight = 'Balandlik juda katta (maks 20 m)';
  if (!i.rooms || i.rooms <= 0) errors.rooms = 'Xonalar soni 1 dan kichik bo’lmasin';
  if (i.rooms > 50) errors.rooms = 'Xonalar soni juda katta (maks 50)';
  return errors;
}

/** Validate user-entered prices; returns an error map keyed by field. */
export function validatePrices(p: { brick?: number; cement?: number; sand?: number }): Record<string, string> {
  const errors: Record<string, string> = {};
  const check = (label: string, v: number | undefined, key: string) => {
    if (v === undefined || v === null || v <= 0) errors[key] = `${label} narxi 0 dan katta bo’lishi kerak`;
  };
  check('G’isht', p.brick, 'brick');
  check('Sement', p.cement, 'cement');
  check('Qum', p.sand, 'sand');
  return errors;
}

/**
 * Bricks = (wall area ÷ perM2) × thickness factor × waste, rounded up.
 * Cement bags & sand scale with brick count. Costs scaled by region index.
 * Invalid (non-positive) custom prices drop that material's row from the total.
 */
export function calculateMaterials(inputs: CalcInputs, overrides?: PriceOverrides): CalcResult {
  const errors = validateInputs(inputs);
  if (Object.keys(errors).length > 0) {
    return { valid: false, bricks: 0, cementBags: 0, sandM3: 0, rows: [], total: 0, currency: 'so’m' };
  }

  const brick = getBrickType(inputs.brickId);
  const region = getRegion(inputs.region);
  const factor = getThicknessFactor(inputs.thickness);
  const idx = region.priceIndex;

  const wallArea = inputs.wallLength * inputs.wallHeight * inputs.rooms;
  const bricks = Math.ceil(wallArea * brick.perM2 * factor * (1 + MORTAR.wasteFactor));
  const cementBags = Math.ceil((bricks / 1000) * MORTAR.cementBagsPer1000);
  const sandM3 = Math.round(((bricks / 1000) * MORTAR.sandM3Per1000) * 100) / 100;

  const brickPrice = overrides?.brickPrice ?? brick.pricePerUnit;
  const cementPrice = overrides?.cementBagPrice ?? MORTAR.cementBagPrice;
  const sandPrice = overrides?.sandPrice ?? MORTAR.sandPrice;

  const rows: CalcRow[] = [];
  if (brickPrice > 0) {
    rows.push({
      material: brick.label,
      quantity: bricks,
      unit: 'dona',
      unitPrice: Math.round(brickPrice * idx),
      subtotal: Math.round(bricks * brickPrice * idx),
    });
  }
  if (cementPrice > 0) {
    rows.push({
      material: 'Sement (50 kg qop)',
      quantity: cementBags,
      unit: 'qop',
      unitPrice: Math.round(cementPrice * idx),
      subtotal: Math.round(cementBags * cementPrice * idx),
    });
  }
  if (sandPrice > 0) {
    rows.push({
      material: 'Qum',
      quantity: sandM3,
      unit: 'm³',
      unitPrice: Math.round(sandPrice * idx),
      subtotal: Math.round(sandM3 * sandPrice * idx),
    });
  }

  const total = rows.reduce((sum, r) => sum + r.subtotal, 0);
  return { valid: true, bricks, cementBags, sandM3, rows, total, currency: 'so’m' };
}

/**
 * Quick project estimate used by the projects page/modal:
 * derives a wall length from the square area and uses silikat + Toshkent defaults.
 */
export function estimateForArea(area: number, rooms: number, overrides?: PriceOverrides): CalcResult {
  const side = Math.sqrt(Math.max(area, 1));
  return calculateMaterials(
    {
      wallLength: Math.round(side * 100) / 100,
      wallHeight: 3,
      thickness: 25,
      brickId: 'silikat',
      rooms: Math.max(rooms, 1),
      region: DEFAULT_REGION_ID,
    },
    overrides,
  );
}

// ---------------------------------------------------------------------------
// Expanded project material breakdown (project detail modal)
// ---------------------------------------------------------------------------

/** Manual feature tags set at project submission time. */
export type ProjectFeature = 'pool' | 'garage' | 'terrace' | 'modern_facade' | 'garden';

export const PROJECT_FEATURE_OPTIONS: { value: ProjectFeature; label: string }[] = [
  { value: 'pool', label: 'Basseyn bormi?' },
  { value: 'garage', label: 'Garaj bormi?' },
  { value: 'terrace', label: 'Terassa bormi?' },
  { value: 'modern_facade', label: "Zamonaviy shisha fasad?" },
  { value: 'garden', label: "Bog' bormi?" },
];

export type MaterialGroupId = 'core' | 'interior' | 'extra';

export const MATERIAL_GROUP_LABELS: Record<MaterialGroupId, string> = {
  core: 'Asosiy qurilish materiallari',
  interior: 'Ichki pardozlash',
  extra: 'Qo’shimcha',
};

export interface ProjectMaterialRow {
  /** Stable key — drives the store matcher and card icons. */
  key: string;
  label: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
  group: MaterialGroupId;
}

export interface MaterialGroup {
  id: MaterialGroupId;
  label: string;
  rows: ProjectMaterialRow[];
  subtotal: number;
}

export interface ProjectMaterialsEstimate {
  groups: MaterialGroup[];
  rows: ProjectMaterialRow[];
  total: number;
}

export interface ProjectSpecs {
  area: number;
  rooms: number;
  bathrooms: number;
  features?: string[];
}

const roundUp = (n: number) => Math.ceil(n);

/** Rough storey count derived from total area + room count. */
function estimateStoreys(area: number, rooms: number): number {
  if (area >= 2600 || rooms >= 14) return 3;
  if (area >= 900 || rooms >= 8) return 2;
  return 1;
}

/**
 * Fuller, feature-aware material estimate for a project detail modal.
 *
 * The structural rows (g'isht/sement/qum) reuse the standard engine; the
 * finishing rows (tom, deraza, plitka, bo'yoq, elektr-santexnika) always
 * appear; pool/terrace/facade/garden rows are only included when the project
 * carries the matching manual feature tag.
 */
export function estimateProjectMaterials(specs: ProjectSpecs): ProjectMaterialsEstimate {
  const area = Math.max(specs.area, 1);
  const rooms = Math.max(specs.rooms, 1);
  const bathrooms = Math.max(specs.bathrooms, 1);
  const features = specs.features ?? [];
  const has = (f: string) => features.includes(f);

  const storeys = estimateStoreys(area, rooms);
  const footprint = area / storeys;
  const side = Math.sqrt(footprint);

  // Structural rows from the standard calculator (silikat + Tashkent index).
  const base = estimateForArea(area, rooms);
  const brickPrice = BRICK_TYPES.find((b) => b.id === 'silikat')?.pricePerUnit ?? BRICK_TYPES[0]!.pricePerUnit;

  const mk = (
    key: string,
    label: string,
    quantity: number,
    unit: string,
    unitPrice: number,
    group: MaterialGroupId,
  ): ProjectMaterialRow => ({
    key,
    label,
    quantity,
    unit,
    unitPrice,
    subtotal: Math.round(quantity * unitPrice),
    group,
  });

  const core: ProjectMaterialRow[] = [
    mk('bricks', 'G’isht (silikat)', base.bricks, 'dona', brickPrice, 'core'),
    mk('cement', 'Sement (50 kg qop)', base.cementBags, 'qop', MORTAR.cementBagPrice, 'core'),
    mk('sand', 'Qum', base.sandM3, 'm³', MORTAR.sandPrice, 'core'),
    mk('roof', 'Tom qoplamasi', roundUp(footprint * 1.35), 'm²', FINISH_MATERIALS.roofM2, 'core'),
  ];

  // Glass-heavy modern villas need more window area than traditional houses.
  const glassBonus = has('modern_facade') ? Math.ceil(rooms * 0.5) : 0;
  const windowCount = rooms + glassBonus;
  const doorCount = rooms + 1;

  const tileArea = bathrooms * 18 + area * 0.25;
  const paintArea = area * 2.4 + side * 4 * 3 * storeys;
  const paintLiters = paintArea / 5;

  const interior: ProjectMaterialRow[] = [
    mk('windows', 'Derazalar', windowCount, 'ta', FINISH_MATERIALS.windowUnit, 'interior'),
    mk('doors', 'Eshiklar', doorCount, 'ta', FINISH_MATERIALS.doorUnit, 'interior'),
    mk('tile', 'Plitka va kafel', roundUp(tileArea), 'm²', FINISH_MATERIALS.tileM2, 'interior'),
    mk('paint', 'Bo’yoq (ichki va tashqi)', roundUp(paintLiters / 10), '10 L', FINISH_MATERIALS.paintCan10L, 'interior'),
    mk('cable', 'Elektr kabeli', roundUp(area * 1.4), 'm', FINISH_MATERIALS.cableM, 'interior'),
    mk('pipe', 'Santexnika quvurlari', roundUp(area * 0.7), 'm', FINISH_MATERIALS.pipeM, 'interior'),
    mk('outlets', 'Rozetka va qurilmalar', rooms * 4 + bathrooms * 2 + 6, 'ta', FINISH_MATERIALS.outletUnit, 'interior'),
  ];

  const extra: ProjectMaterialRow[] = [];
  if (has('pool')) {
    const poolM2 = Math.min(60, Math.max(15, Math.round(footprint * 0.06)));
    extra.push(mk('pool_membrane', 'Basseyn qoplamasi / membrana', poolM2, 'm²', FINISH_MATERIALS.poolMembraneM2, 'extra'));
    extra.push(mk('pool_equipment', 'Basseyn uskunalari (filtratsiya)', 1, 'to’plam', FINISH_MATERIALS.poolEquipmentSet, 'extra'));
  }
  if (has('terrace')) {
    extra.push(mk('terrace', 'Terassa qoplamasi', roundUp(footprint * 0.18), 'm²', FINISH_MATERIALS.terraceM2, 'extra'));
  }
  if (has('modern_facade')) {
    const facadeM2 = Math.ceil(side * 4 * 3 * storeys * 0.35);
    extra.push(mk('facade', 'Shisha fasad panellari', facadeM2, 'm²', FINISH_MATERIALS.facadeM2, 'extra'));
  }
  if (has('garden')) {
    extra.push(mk('garden', 'Bog’ ko’kalamzorlash', 1, 'to’plam', FINISH_MATERIALS.gardenSet, 'extra'));
  }

  const groupEntries: [MaterialGroupId, ProjectMaterialRow[]][] = [
    ['core', core],
    ['interior', interior],
    ['extra', extra],
  ];

  // Only groups with at least one row are shown — a traditional house has no
  // "Qo'shimcha" section.
  const groups: MaterialGroup[] = groupEntries
    .map(([id, rows]) => ({
      id,
      label: MATERIAL_GROUP_LABELS[id],
      rows,
      subtotal: rows.reduce((sum, r) => sum + r.subtotal, 0),
    }))
    .filter((g) => g.rows.length > 0);

  const rows = groups.flatMap((g) => g.rows);
  return {
    groups,
    rows,
    total: rows.reduce((sum, r) => sum + r.subtotal, 0),
  };
}
