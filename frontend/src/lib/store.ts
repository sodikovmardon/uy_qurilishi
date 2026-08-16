/** Shared store helpers: price/date formatting + stock-status labels. */

export function formatPrice(price: number): string {
  return `${new Intl.NumberFormat('uz-UZ').format(price)} so'm`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return 'hozirgina';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min} daqiqa oldin`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} soat oldin`;
  return `${Math.floor(hours / 24)} kun oldin`;
}

export type StockStatus = 'Mavjud' | 'Kam qoldi' | 'Tugagan';

export const STOCK_STYLE: Record<StockStatus, string> = {
  Mavjud: 'stock-badge stock-in',
  'Kam qoldi': 'stock-badge stock-low',
  Tugagan: 'stock-badge stock-out',
};
