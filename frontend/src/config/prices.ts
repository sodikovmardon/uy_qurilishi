/**
 * Central pricing & preset config (Phase 9 — admin-configurable).
 * Update prices in this single file; later this can be served from an API.
 *
 * Region list lives in ./regions.ts (single source of truth for all 14).
 */
import { DEFAULT_REGION_ID } from './regions';

export interface BrickType {
  id: string;
  label: string;
  /** nominal dimensions in mm (length × width × height) */
  length: number;
  width: number;
  height: number;
  /** bricks per m² of single-layer wall (incl. mortar joint allowance) */
  perM2: number;
  /** price in UZS per piece */
  pricePerUnit: number;
}

export const BRICK_TYPES: BrickType[] = [
  { id: 'silikat', label: 'Silikat g’isht', length: 250, width: 120, height: 65, perM2: 62, pricePerUnit: 1900 },
  { id: 'keramik', label: 'Keramik g’isht', length: 250, width: 120, height: 65, perM2: 62, pricePerUnit: 2400 },
  { id: 'blok', label: 'Bloklar (gazblok)', length: 600, width: 250, height: 200, perM2: 8.3, pricePerUnit: 42000 },
];

/**
 * Wall thickness multiplier (how many brick layers deep the wall is).
 * Standard single wall = 25 cm (1×), reinforced = 38 cm (1.5×), double = 51 cm (2×).
 */
export const WALL_THICKNESS: { value: number; label: string; factor: number }[] = [
  { value: 25, label: '25 sm (standart)', factor: 1 },
  { value: 38, label: '38 sm (mustahkamlangan)', factor: 1.5 },
  { value: 51, label: '51 sm (ikki qavat)', factor: 2 },
];

export const MORTAR = {
  /** cement bags of 50 kg per 1000 bricks */
  cementBagsPer1000: 2.5,
  /** sand in m³ per 1000 bricks */
  sandM3Per1000: 0.3,
  /** price per 50 kg cement bag (UZS) */
  cementBagPrice: 78000,
  /** price per m³ of sand (UZS) */
  sandPrice: 95000,
  /** percentage waste added to material totals */
  wasteFactor: 0.07,
};

/** Default unit prices, keyed to the custom-price panel. Brick default is per type (see getDefaultPrice). */
export const DEFAULT_MATERIAL_PRICES = {
  brick: 1900, // silikat — getDefaultPrice() picks the active type
  cement: MORTAR.cementBagPrice,
  sand: MORTAR.sandPrice,
} as const;

/** Default 1-dona g'isht price for a given brick type. */
export function getDefaultBrickPrice(brickId: string): number {
  return BRICK_TYPES.find((b) => b.id === brickId)?.pricePerUnit ?? DEFAULT_MATERIAL_PRICES.brick;
}

export const DEFAULT_INPUTS = {
  wallLength: 12,
  wallHeight: 3,
  thickness: 25,
  brickId: 'silikat',
  rooms: 4,
  region: DEFAULT_REGION_ID,
};

/**
 * Estimated unit prices for the expanded project material breakdown
 * (roofing, windows/doors, tiles, paint, electrical/plumbing, pool,
 * terrace and facade). All UZS, applied with the Tashkent price index.
 */
export const FINISH_MATERIALS = {
  /** metallic profile roofing sheet, per m² */
  roofM2: 55_000,
  /** double-glazed window unit, per piece */
  windowUnit: 900_000,
  /** interior/exterior door, per piece */
  doorUnit: 650_000,
  /** floor/wall tile incl. adhesive, per m² */
  tileM2: 90_000,
  /** paint, per 10 L can */
  paintCan10L: 210_000,
  /** electrical cable, per metre */
  cableM: 4_500,
  /** plumbing pipe, per metre */
  pipeM: 7_500,
  /** socket/light fixture, per piece */
  outletUnit: 25_000,
  /** pool membrane/tile, per m² */
  poolMembraneM2: 120_000,
  /** pool filtration equipment, per set */
  poolEquipmentSet: 18_000_000,
  /** terrace decking/paving, per m² */
  terraceM2: 85_000,
  /** glass facade panel incl. frame, per m² */
  facadeM2: 350_000,
  /** landscaping/garden package, per set */
  gardenSet: 3_000_000,
} as const;
