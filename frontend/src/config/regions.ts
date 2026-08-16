/**
 * Single source of truth for Uzbekistan's 14 regions (13 viloyat + Qoraqalpog'iston + Toshkent shahri).
 * Import REGIONS from here everywhere a region list/selector is needed —
 * do NOT define region arrays in other files.
 *
 * NOTE: priceIndex values are ESTIMATED variance multipliers vs. the base
 * (Toshkent shahri = 1.0). They are placeholder market data until a real
 * backend feed is wired up; treat them as ±5–15% estimates.
 */

export interface Region {
  id: string;
  /** Human-readable Uzbek name (typographic apostrophe). */
  name: string;
  /** Estimated price variance vs. Toshkent shahri (base). */
  priceIndex: number;
}

/** Standard display order (all 14 regions). */
export const REGIONS: Region[] = [
  { id: 'andijon', name: 'Andijon', priceIndex: 0.9 },
  { id: 'buxoro', name: 'Buxoro', priceIndex: 0.93 },
  { id: 'fargona', name: 'Farg’ona', priceIndex: 0.9 },
  { id: 'jizzax', name: 'Jizzax', priceIndex: 0.92 },
  { id: 'namangan', name: 'Namangan', priceIndex: 0.9 },
  { id: 'navoiy', name: 'Navoiy', priceIndex: 0.95 },
  { id: 'qashqadaryo', name: 'Qashqadaryo', priceIndex: 0.91 },
  { id: 'qoraqalpogiston', name: 'Qoraqalpog’iston Respublikasi', priceIndex: 0.95 },
  { id: 'samarqand', name: 'Samarqand', priceIndex: 0.95 },
  { id: 'sirdaryo', name: 'Sirdaryo', priceIndex: 0.94 },
  { id: 'surxondaryo', name: 'Surxondaryo', priceIndex: 0.92 },
  { id: 'toshkent_viloyati', name: 'Toshkent viloyati', priceIndex: 0.97 },
  { id: 'xorazm', name: 'Xorazm', priceIndex: 0.93 },
  { id: 'toshkent_shahar', name: 'Toshkent shahri', priceIndex: 1 },
] as const;

/** Base region (highest prices) used as default / fallback. */
export const DEFAULT_REGION_ID = 'toshkent_shahar';

export function getRegionById(id: string): Region {
  const normalized = normalizeRegionId(id);
  return REGIONS.find((r) => r.id === normalized) ?? REGIONS[REGIONS.length - 1]!;
}

/**
 * Legacy id mapping + safety net. Older builds stored the single
 * 'toshkent' id, which now splits into 'toshkent_shahar' / 'toshkent_viloyati'.
 * Unknown values fall back to the default (Toshkent shahri).
 */
export function normalizeRegionId(id: string | undefined | null): string {
  if (!id) return DEFAULT_REGION_ID;
  if (id === 'toshkent') return DEFAULT_REGION_ID;
  if (REGIONS.some((r) => r.id === id)) return id;
  return DEFAULT_REGION_ID;
}
