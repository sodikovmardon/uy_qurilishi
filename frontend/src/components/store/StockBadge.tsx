import { STOCK_STYLE, type StockStatus } from '../../lib/store';

export function StockBadge({ status }: { status: string }) {
  return (
    <span className={STOCK_STYLE[status as StockStatus] ?? 'stock-badge'}>{status}</span>
  );
}
