/**
 * LocalStorage persistence helpers (Phase 7).
 * All keys are namespaced under "uy:" to avoid collisions.
 */

import { DEFAULT_REGION_ID, normalizeRegionId } from '../config/regions';

export interface SavedCalculation {
  id: string;
  createdAt: string;
  wallLength: number;
  wallHeight: number;
  thickness: number;
  brickId: string;
  rooms: number;
  region: string;
  bricks: number;
  cementBags: number;
  sandM3: number;
  total: number;
}

export interface Favorites {
  [projectId: string]: string; // projectId -> date bookmarked (ISO)
}

/**
 * User-overridden material unit prices (Phase 9 — custom pricing).
 * Absent fields fall back to the defaults in config/prices.ts.
 */
export interface MaterialPrices {
  brick?: number; // 1 dona g'isht uchun (UZS)
  cement?: number; // 1 qop sement uchun (UZS)
  sand?: number; // 1 m³ qum uchun (UZS)
}

/** In-progress calculator form (auto-saved draft, Phase 9). */
export interface CalcDraft {
  wallLength: number;
  wallHeight: number;
  thickness: number;
  brickId: string;
  rooms: number;
  region: string;
}

/** Editable profile fields persisted locally (Phase 10 — profile page). */
export interface UserProfile {
  name: string;
  phone: string;
  email: string;
  region: string;
  createdAt?: string;
}

/**
 * Saved budget plan ("Mening byudjetlarim" — Phase 13).
 * Each save is a new versioned snapshot linked to the input dimensions so the
 * list doubles as a lightweight version history.
 */
export interface BudgetPlan {
  id: string;
  createdAt: string;
  version: number;
  /** Total budget in UZS. */
  budget: number;
  /** Six phase percentages (poydevor/devorlar/tom/ichki/elektr/zaxira) summing to 100. */
  allocations: number[];
  /** Stages-engine grand total at save time. */
  calculatedTotal: number;
  wallLength: number;
  wallHeight: number;
  thickness: number;
  brickId: string;
  rooms: number;
  region: string;
}

/** Notification preference toggles. */
export interface NotificationsPrefs {
  newProjects: boolean;
  priceChanges: boolean;
  email: boolean;
  sms: boolean;
}

/**
 * Saved land-plot profile for the "Yer uchastkasi bo'yicha loyiha tanlash"
 * matcher. areaM2 is the single source of truth; sotix is derived (1 sotix = 100 m²).
 */
export interface SavedPlot {
  /** Total plot area in m². */
  areaM2: number;
  /** Optional plot width (m) — only when the user enters dimensions. */
  width?: number;
  length?: number;
  /** Building coverage ratio (% of plot area). */
  coveragePct: number;
  /** Street setback in metres (0 = none). */
  setbackM: number;
  savedAt: string;
}

/** App-wide currency display format. */
export type CurrencyFormat = 'som' | 'uzs';

/** App-wide base font size. */
export type FontSize = 'small' | 'medium' | 'large';

const KEYS = {
  favorites: 'uy:favorites',
  history: 'uy:calc-history',
  budgetPlans: 'uy:budget-plans',
  materialPrices: 'uy:material-prices',
  calcDraft: 'uy:calc-draft',
  profile: 'uy:profile',
  avatar: 'uy:profile-avatar',
  notifications: 'uy:notifications',
  language: 'uy:language',
  currency: 'uy:currency',
  defaultRegion: 'uy:default-region',
  fontSize: 'uy:font-size',
  phoneVerified: 'uy:phone-verified',
  plot: 'uy:plot',
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage may be unavailable (private mode) — fail silently
  }
}

export function getFavorites(): Favorites {
  return read(KEYS.favorites, {});
}

export function isFavorite(id: string): boolean {
  return Boolean(getFavorites()[id]);
}

export function toggleFavorite(id: string): boolean {
  const favs = getFavorites();
  if (favs[id]) {
    delete favs[id];
  } else {
    favs[id] = new Date().toISOString();
  }
  write(KEYS.favorites, favs);
  return Boolean(favs[id]);
}

export function getHistory(): SavedCalculation[] {
  return read<SavedCalculation[]>(KEYS.history, []);
}

export function saveCalculation(calc: Omit<SavedCalculation, 'id' | 'createdAt'>): SavedCalculation[] {
  const entry: SavedCalculation = { ...calc, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  const next = [entry, ...getHistory()].slice(0, 20); // keep last 20
  write(KEYS.history, next);
  return next;
}

export function deleteCalculation(id: string): SavedCalculation[] {
  const next = getHistory().filter((c) => c.id !== id);
  write(KEYS.history, next);
  return next;
}

export function clearHistory(): SavedCalculation[] {
  try {
    localStorage.removeItem(KEYS.history);
  } catch {
    // ignore
  }
  return [];
}

export function getBudgetPlans(): BudgetPlan[] {
  return read<BudgetPlan[]>(KEYS.budgetPlans, []);
}

/** Prepend a new budget version (version = count of prior plans + 1), keep last 12. */
export function saveBudgetPlan(plan: Omit<BudgetPlan, 'id' | 'createdAt' | 'version'>): BudgetPlan[] {
  const entry: BudgetPlan = {
    ...plan,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    version: getBudgetPlans().length + 1,
  };
  const next = [entry, ...getBudgetPlans()].slice(0, 12);
  write(KEYS.budgetPlans, next);
  return next;
}

export function deleteBudgetPlan(id: string): BudgetPlan[] {
  const next = getBudgetPlans().filter((p) => p.id !== id);
  write(KEYS.budgetPlans, next);
  return next;
}

export function getMaterialPrices(): MaterialPrices {
  return read<MaterialPrices>(KEYS.materialPrices, {});
}

export function saveMaterialPrices(prices: MaterialPrices): void {
  write(KEYS.materialPrices, prices);
}

export function resetMaterialPrices(): void {
  try {
    localStorage.removeItem(KEYS.materialPrices);
  } catch {
    // ignore
  }
}

export function getCalcDraft(): CalcDraft | null {
  const draft = read<CalcDraft | null>(KEYS.calcDraft, null);
  if (draft) draft.region = normalizeRegionId(draft.region);
  return draft;
}

export function saveCalcDraft(draft: CalcDraft): void {
  write(KEYS.calcDraft, draft);
}

export function clearCalcDraft(): void {
  try {
    localStorage.removeItem(KEYS.calcDraft);
  } catch {
    // ignore
  }
}

export function getProfile(): UserProfile | null {
  const profile = read<UserProfile | null>(KEYS.profile, null);
  if (profile) profile.region = normalizeRegionId(profile.region);
  return profile;
}

export function saveProfile(profile: UserProfile): void {
  write(KEYS.profile, profile);
}

export function getAvatar(): string | null {
  return read<string | null>(KEYS.avatar, null);
}

export function saveAvatar(dataUrl: string): void {
  write(KEYS.avatar, dataUrl);
}

export function getNotifications(): NotificationsPrefs {
  return read<NotificationsPrefs>(KEYS.notifications, { newProjects: true, priceChanges: true, email: true, sms: true });
}

export function saveNotifications(prefs: NotificationsPrefs): void {
  write(KEYS.notifications, prefs);
}

export function getLanguage(): string {
  return read<string>(KEYS.language, 'uz');
}

export function saveLanguage(lang: string): void {
  write(KEYS.language, lang);
}

export function getCurrency(): CurrencyFormat {
  return read<CurrencyFormat>(KEYS.currency, 'som');
}

export function saveCurrency(fmt: CurrencyFormat): void {
  write(KEYS.currency, fmt);
}

export function getDefaultRegion(): string {
  return normalizeRegionId(read<string>(KEYS.defaultRegion, DEFAULT_REGION_ID));
}

export function saveDefaultRegion(id: string): void {
  write(KEYS.defaultRegion, normalizeRegionId(id));
}

export function getFontSize(): FontSize {
  return read<FontSize>(KEYS.fontSize, 'medium');
}

export function saveFontSize(size: FontSize): void {
  write(KEYS.fontSize, size);
}

export function getPhoneVerified(): boolean {
  return read<boolean>(KEYS.phoneVerified, false);
}

export function savePhoneVerified(verified: boolean): void {
  write(KEYS.phoneVerified, verified);
}

export function getSavedPlot(): SavedPlot | null {
  return read<SavedPlot | null>(KEYS.plot, null);
}

export function savePlot(plot: SavedPlot): void {
  write(KEYS.plot, plot);
}

export function clearPlot(): void {
  try {
    localStorage.removeItem(KEYS.plot);
  } catch {
    // ignore
  }
}

export function clearFavorites(): void {
  try {
    localStorage.removeItem(KEYS.favorites);
  } catch {
    // ignore
  }
}

/** Wipe every namespaced "uy:" key — used by the "clear all local data" action. */
export function clearAllLocalData(): void {
  try {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
