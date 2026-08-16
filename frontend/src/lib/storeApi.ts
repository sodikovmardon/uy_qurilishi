/**
 * Live store-price integration for the material calculator.
 *
 * Fetches real prices/stock from the partner hardware store's public API and
 * maps the store's products onto the calculator's internal material types.
 * Requests are proxied through the app's own backend (`/api/calc/...`) so any
 * API key the store requires stays server-side and never reaches the browser.
 *
 * Multi-store ready: `STORE_SOURCES` lists every partner store; only one is
 * wired up today. Add a second entry + a matching proxy view to extend.
 */
import type { CalcResult, CalcRow, ProjectMaterialRow } from './calculator';
import type { StoreProduct } from '../api/client';

export interface StoreSource {
  id: string;
  /** Display name shown near the calculator results. */
  name: string;
  /** Same-origin proxy that returns the catalog as StoreProduct[].
   *  The proxy forwards to the store's public API with its key server-side. */
  proxyUrl: string;
  /** Store's own public API base URL (informational — used by the proxy). */
  apiUrl?: string;
}

/**
 * Partner stores. The API key itself lives in the backend proxy (see
 * api/calc.py), never in this client config.
 */
export const STORE_SOURCES: StoreSource[] = [
  {
    id: 'xo-jalik',
    name: "Xo'jalik mollari do'koni",
    proxyUrl: '/api/calc/store-prices/',
    apiUrl: '/api/v1/products/',
  },
];

/** Default source used by the calculator. */
export const DEFAULT_STORE_SOURCE = STORE_SOURCES[0]!;

// ---------------------------------------------------------------------------
// Material → store-product mapping
// ---------------------------------------------------------------------------

export type MaterialKey =
  | 'cement'
  | 'sand'
  | `brick:${string}`
  | 'roof'
  | 'windows'
  | 'doors'
  | 'tile'
  | 'paint'
  | 'cable'
  | 'pipe'
  | 'outlets'
  | 'pool_membrane'
  | 'pool_equipment'
  | 'terrace'
  | 'facade'
  | 'garden';

/** Ordered match rules; the first rule that hits a product wins. */
export interface StoreMatchRule {
  /** Exact category match (e.g. "G'isht"). */
  category?: string;
  /** All keywords must appear in the product name (case-insensitive). */
  keywords?: string[];
  /** None of these may appear in the product name. */
  excludeKeywords?: string[];
  /** Exact SKU match. */
  sku?: string;
}

/**
 * Match rules keyed by calculator material key. Because these are keyword
 * rules (not hardcoded ids), a store-side rename ("Silikat g'isht" →
 * "Silikat g'isht (yangi)") keeps working — the fallback rules also catch
 * anything else in the same category.
 */
const MATERIAL_MATCHERS: Record<MaterialKey, StoreMatchRule[]> = {
  'brick:silikat': [{ category: "G'isht", keywords: ['silikat'] }, { category: "G'isht" }],
  'brick:keramik': [{ category: "G'isht", keywords: ['keramik'] }, { category: "G'isht" }],
  'brick:blok': [],
  cement: [{ category: 'Sement', keywords: ['m400'] }, { category: 'Sement' }],
  sand: [
    { category: 'Qum', keywords: ['qurilish'] },
    { category: 'Qum', keywords: ['qum'], excludeKeywords: ['shag'] },
  ],
  roof: [],
  windows: [],
  doors: [],
  tile: [{ category: "Bog'lovchi materiallar", keywords: ['kafel'] }],
  paint: [
    { category: "Bo'yoqlar", keywords: ['akril'] },
    { category: "Bo'yoqlar", keywords: ['fasad'] },
    { category: "Bo'yoqlar" },
  ],
  cable: [],
  pipe: [],
  outlets: [],
  pool_membrane: [{ category: "Bog'lovchi materiallar", keywords: ['gidroizol'] }],
  pool_equipment: [],
  terrace: [],
  facade: [],
  garden: [],
};

/** Resolve which store product backs a calculator material row (null = none). */
export function matchMaterial(
  catalog: StoreProduct[],
  materialKey: MaterialKey,
): StoreProduct | null {
  const rules = MATERIAL_MATCHERS[materialKey] ?? [];
  for (const rule of rules) {
    const hit = catalog.find((p) => {
      if (rule.sku && p.sku !== rule.sku) return false;
      if (rule.category && p.category !== rule.category) return false;
      const name = p.name.toLowerCase();
      if (rule.keywords && !rule.keywords.every((k) => name.includes(k.toLowerCase()))) return false;
      if (rule.excludeKeywords && rule.excludeKeywords.some((k) => name.includes(k.toLowerCase()))) return false;
      return true;
    });
    if (hit) return hit;
  }
  return null;
}

/** Map a CalcRow to the material key, using the selected brick type for bricks. */
export function rowMaterialKey(row: { key?: string; unit: string }, brickId: string): MaterialKey {
  if (row.key === 'bricks') return `brick:${brickId}`;
  if (row.key === 'cement') return 'cement';
  if (row.key === 'sand') return 'sand';
  if (row.key) return row.key as MaterialKey;
  if (row.unit === 'qop') return 'cement';
  if (row.unit === 'm³') return 'sand';
  return `brick:${brickId}`;
}

// ---------------------------------------------------------------------------
// Fetch + short-lived cache (in-memory, ~3 min, stale-while-revalidate)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 3 * 60 * 1000;

interface CacheEntry {
  fetchedAt: number;
  products: StoreProduct[] | null;
}

const catalogCache = new Map<string, CacheEntry>();

/** Console-stubbed logger so integration failures are diagnosable offline. */
export function storeLog(level: 'log' | 'warn' | 'error', message: string, ...args: unknown[]): void {
  // Lightweight logging stub — extend with a remote logger if needed.
  // eslint-disable-next-line no-console
  console[level](`[storeApi] ${message}`, ...args);
}

async function fetchCatalog(source: StoreSource): Promise<StoreProduct[] | null> {
  try {
    const res = await fetch(source.proxyUrl, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`store "${source.id}" returned HTTP ${res.status}`);
    const data = (await res.json()) as StoreProduct[];
    if (!Array.isArray(data)) throw new Error(`store "${source.id}" returned non-array payload`);
    return data;
  } catch (err) {
    storeLog('error', 'fetchCatalog failed', source.id, err);
    return null;
  }
}

/**
 * Fetch the store catalog with an in-memory cache:
 *  - fresh (< TTL): return cached instantly, no network
 *  - stale (< 2×TTL): return cached immediately, refresh in background
 *  - older: block on a fresh fetch
 * Never throws — returns null on failure so the caller can fall back.
 */
export async function fetchStoreCatalog(
  source: StoreSource = DEFAULT_STORE_SOURCE,
  force = false,
): Promise<StoreProduct[] | null> {
  const now = Date.now();
  const entry = catalogCache.get(source.id);

  if (entry && entry.products && !force) {
    if (now - entry.fetchedAt < CACHE_TTL_MS) return entry.products;
    if (now - entry.fetchedAt < CACHE_TTL_MS * 2) {
      void fetchCatalog(source).then((p) => {
        if (p) catalogCache.set(source.id, { fetchedAt: Date.now(), products: p });
      });
      return entry.products;
    }
  }

  const fresh = await fetchCatalog(source);
  if (fresh) catalogCache.set(source.id, { fetchedAt: Date.now(), products: fresh });
  return fresh ?? entry?.products ?? null;
}

/** Latest `last_updated` across the catalog (feeds the "X min ago" note). */
export function catalogUpdatedAt(catalog: StoreProduct[]): string | null {
  let max: string | null = null;
  for (const p of catalog) {
    if (p.last_updated && (!max || p.last_updated > max)) max = p.last_updated;
  }
  return max;
}

// ---------------------------------------------------------------------------
// Pricing enrichment
// ---------------------------------------------------------------------------

export interface StorePricedRow extends CalcRow {
  /** Price came from the store (true) or from the app's custom/default config. */
  isStorePrice: boolean;
  /** Matched store product (null when no store price available). */
  store: StoreProduct | null;
  /** Whether required quantity exceeds what the store currently has. */
  insufficient: boolean;
}

export interface StorePricing {
  rows: StorePricedRow[];
  total: number;
  /** Materials that had no store match and used app defaults. */
  estimatedCount: number;
}

/**
 * Enrich a CalcResult's rows with live store prices. Rows that match a store
 * product use the store's real price/unit; unmatched rows keep the app's
 * custom/default price. Totals are recomputed from the enriched rows.
 */
export function applyStorePricing(
  result: CalcResult,
  catalog: StoreProduct[] | null,
  brickId: string,
): StorePricing {
  const rows: StorePricedRow[] = result.rows.map((row) => {
    const store = catalog ? matchMaterial(catalog, rowMaterialKey(row, brickId)) : null;
    const live = store && store.price > 0 ? store : null;
    const unitPrice = live ? live.price : row.unitPrice;
    const quantity = row.quantity;
    return {
      ...row,
      isStorePrice: live !== null,
      store: live,
      unitPrice,
      subtotal: Math.round(unitPrice * quantity),
      insufficient: live ? live.stock_quantity < quantity : false,
    };
  });

  const total = rows.reduce((sum, r) => sum + r.subtotal, 0);
  const estimatedCount = rows.filter((r) => !r.isStorePrice).length;
  return { rows, total, estimatedCount };
}

export interface ProjectStorePricedRow extends ProjectMaterialRow {
  /** Price came from the store (true) or from the app's estimated config. */
  isStorePrice: boolean;
  /** Matched store product (null when no store price available). */
  store: StoreProduct | null;
}

/**
 * Enrich the expanded project material breakdown with live store prices.
 * Matched rows use the store's real price; the rest keep the estimated
 * config price. Used by the project detail modal's "order all" button.
 */
export function applyProjectStorePricing(
  rows: ProjectMaterialRow[],
  catalog: StoreProduct[] | null,
): ProjectStorePricedRow[] {
  return rows.map((row) => {
    const store = catalog ? matchMaterial(catalog, rowMaterialKey(row, 'silikat')) : null;
    const live = store && store.price > 0 ? store : null;
    const unitPrice = live ? live.price : row.unitPrice;
    return {
      ...row,
      isStorePrice: live !== null,
      store: live,
      unitPrice,
      subtotal: Math.round(unitPrice * row.quantity),
    };
  });
}
