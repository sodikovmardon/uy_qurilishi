import { useMemo, useRef, useState } from 'react';
import { Info, TrendingUp } from 'lucide-react';
import {
  getPriceInsight,
  MATERIAL_LABELS,
  PRICE_HISTORY,
  type HistoryPoint,
  type MaterialKey,
} from '../../lib/market';
import { formatUZS } from '../../lib/calculator';

/**
 * "Narxlar tarixi" — SVG line chart fed by PRICE_HISTORY from lib/market.ts
 * (mock monthly data). Replace with a real /api/prices/history/ endpoint when
 * available.
 */

const W = 320;
const H = 140;
const PAD = 26;

const MATERIALS: MaterialKey[] = ['brick', 'cement', 'sand'];

/**
 * "Narxlar tarixi" — clean SVG line chart (primary blue line, gradient fill,
 * muted grid lines) with a hover tooltip and a plain-Uzbek trend insight.
 */
export default function PriceHistoryChart() {
  const [material, setMaterial] = useState<MaterialKey>('brick');
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const series = PRICE_HISTORY[material];

  const { linePath, areaPath, points, min, max } = useMemo(() => {
    const minP = Math.min(...series.map((p) => p.price));
    const maxP = Math.max(...series.map((p) => p.price));
    const range = maxP - minP || 1;
    const pts = series.map((p, i) => ({
      ...p,
      x: PAD + (i * (W - PAD * 2)) / (series.length - 1),
      y: H - PAD - ((p.price - minP) / range) * (H - PAD * 2),
    }));
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1]!.x.toFixed(1)},${H - PAD} L${pts[0]!.x.toFixed(1)},${H - PAD} Z`;
    return { linePath: line, areaPath: area, points: pts, min: minP, max: maxP };
  }, [series]);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(ratio * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, idx)));
  };

  const active = hover !== null ? points[hover] : null;

  return (
    <div className="history-chart">
      <div className="history-chart-head">
        <div>
          <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Narxlar tarixi (12 oy)
          </h4>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Tanlangan material narxining o’zgarishi
          </p>
        </div>
        <div className="segmented history-chart-tabs" role="tablist" aria-label="Material">
          {MATERIALS.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={material === m}
              className={`segmented-btn${material === m ? ' is-active' : ''}`}
              onClick={() => {
                setMaterial(m);
                setHover(null);
              }}
            >
              {m === 'brick' ? 'G’isht' : m === 'cement' ? 'Sement' : 'Qum'}
            </button>
          ))}
        </div>
      </div>

      {/* Insight line */}
      <div className="history-insight">
        <TrendingUp className="w-4 h-4" />
        {getPriceInsight(material)}
      </div>

      <div
        ref={wrapRef}
        className="history-plot"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        onTouchMove={(e) => {
          const rect = wrapRef.current?.getBoundingClientRect();
          if (!rect) return;
          const t = e.touches[0];
          if (!t) return;
          const ratio = (t.clientX - rect.left) / rect.width;
          setHover(Math.round(Math.max(0, Math.min(1, ratio)) * (points.length - 1)));
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${MATERIAL_LABELS[material]} narxlar grafigi`}>
          <defs>
            <linearGradient id="histFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* muted grid lines */}
          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={t}
              x1={PAD}
              x2={W - PAD}
              y1={PAD + t * (H - PAD * 2)}
              y2={PAD + t * (H - PAD * 2)}
              stroke="var(--range-track)"
              strokeWidth="1"
            />
          ))}

          <path d={areaPath} fill="url(#histFill)" />
          <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {active && (
            <>
              <line x1={active.x} x2={active.x} y1={PAD} y2={H - PAD} stroke="var(--border-card-hover)" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={active.x} cy={active.y} r="4.5" fill="#3b82f6" stroke="#fff" strokeWidth="2" />
            </>
          )}
        </svg>

        {/* Hover tooltip */}
        {active && (
          <div className="history-tooltip" style={{ left: `${(active.x / W) * 100}%`, top: `${(active.y / H) * 100}%` }}>
            <span className="history-tooltip-date">{active.label}</span>
            <strong>{formatUZS(active.price)}</strong>
          </div>
        )}
      </div>

      <div className="history-axis">
        <span>{series[0]?.label}</span>
        <span>{formatUZS(min)}</span>
        <span>{series[series.length - 1]?.label}</span>
        <span>{formatUZS(max)}</span>
      </div>

      <p className="history-note">
        <Info className="w-3.5 h-3.5" />
        Narxlar mintaqaviy o’rtacha qiymat bo’lib, bozor sharoitiga qarab o’zgarishi mumkin.
      </p>
    </div>
  );
}
