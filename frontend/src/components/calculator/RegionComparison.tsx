import { useMemo, useState } from 'react';
import { ArrowDownToLine, BadgeCheck, MapPin, Table2 } from 'lucide-react';
import { REGION_PRICES, regionPricesForBrick, type RegionPrice } from '../../lib/market';
import { formatUZS } from '../../lib/calculator';
import { useApp } from '../../context/AppContext';
import { vibrate } from '../../lib/haptics';

interface Props {
  brickId: string;
  currentRegion: string;
  onApplyPrices: (prices: { brick: number; cement: number; sand: number }) => void;
}

/**
 * "Mintaqalar bo'yicha narxlar" — primary bar-chart view with a toggle to the
 * table. Data comes from lib/market.ts (mock REGION_PRICES); swap for a real
 * /api/prices/regional/ endpoint when available.
 */
export default function RegionComparison({ brickId, currentRegion, onApplyPrices }: Props) {
  const { showToast } = useApp();
  const [showTable, setShowTable] = useState(false);

  // Recompute regional unit prices scaled to the selected brick type.
  const rows = useMemo(
    () =>
      REGION_PRICES.map((r) => ({
        ...r,
        ...regionPricesForBrick(r.id, brickId),
      })),
    [brickId],
  );

  const maxBrick = Math.max(...rows.map((r) => r.brick));
  const minBrick = Math.min(...rows.map((r) => r.brick));
  const cheapest = rows.filter((r) => r.brick === minBrick);
  const mostExpensive = rows.filter((r) => r.brick === maxBrick);

  const apply = (r: RegionPrice) => {
    onApplyPrices(regionPricesForBrick(r.id, brickId));
    vibrate(10);
    showToast(`${r.name} narxlari qo’llandi`);
  };

  return (
    <div className="region-compare">
      <div className="region-compare-head">
        <div>
          <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Mintaqalar bo’yicha narxlar
          </h4>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Regionga bosib narxlarni kalkulyatorga qo’llang
          </p>
        </div>
        <button
          type="button"
          className="region-toggle"
          aria-expanded={showTable}
          onClick={() => setShowTable((v) => !v)}
        >
          <Table2 className="w-4 h-4" />
          {showTable ? 'Grafik' : 'Batafsil jadval'}
        </button>
      </div>

      {/* Cheapest / most expensive highlight line */}
      <div className="region-insight">
        <span className="region-insight-cheap">
          <BadgeCheck className="w-3.5 h-3.5" /> Eng arzon: {cheapest.map((r) => r.name).join(', ')}
        </span>
        <span className="region-insight-expensive">
          <MapPin className="w-3.5 h-3.5" /> Eng qimmat: {mostExpensive.map((r) => r.name).join(', ')}
        </span>
      </div>

      {showTable ? (
        <table className="data-table region-table">
          <thead>
            <tr>
              <th>Region</th>
              <th className="num">G’isht</th>
              <th className="num">Sement</th>
              <th className="num">Qum</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isCurrent = r.id === currentRegion;
              return (
                <tr key={r.id} className={isCurrent ? 'is-current' : ''}>
                  <td>
                    <button type="button" className="region-cell" onClick={() => apply(r)}>
                      {r.name}
                      {isCurrent && <span className="chip chip-current">joriy</span>}
                    </button>
                  </td>
                  <td className="num">{formatUZS(r.brick)}</td>
                  <td className="num">{formatUZS(r.cement)}</td>
                  <td className="num">{formatUZS(r.sand)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div className="region-bars">
          {rows.map((r) => {
            const width = Math.max(8, (r.brick / maxBrick) * 100);
            const isCheap = r.brick === minBrick;
            const isExpensive = r.brick === maxBrick;
            const isCurrent = r.id === currentRegion;
            return (
              <button
                type="button"
                key={r.id}
                className={`region-bar${isCheap ? ' is-cheap' : ''}${isExpensive ? ' is-expensive' : ''}${isCurrent ? ' is-current' : ''}`}
                onClick={() => apply(r)}
              >
                <span className="region-bar-label">{r.name}</span>
                <span className="region-bar-track">
                  <span className="region-bar-fill" style={{ width: `${width}%` }}>
                    {isCurrent && <ArrowDownToLine className="region-bar-arrow w-3.5 h-3.5" />}
                  </span>
                </span>
                <span className="region-bar-value">{formatUZS(r.brick)}</span>
              </button>
            );
          })}
        </div>
      )}

      <p className="region-note">G’isht narxi bo’yicha taqqoslanmoqda (tanlangan g’isht turi asosida).</p>
    </div>
  );
}
