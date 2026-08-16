import { useState } from 'react';
import { motion } from 'framer-motion';
import { BrickWall, Package, Truck, Building2, HardHat, Minus, Plus, Loader2 } from 'lucide-react';
import { useCalculator } from '../../hooks/useCalculator';
import { AnimatedValue } from '../ui/AnimatedValue';

interface CalculatorWidgetProps {
  compact?: boolean;
}

interface TileConfig {
  key: 'bricks' | 'cement' | 'sand' | 'storeys';
  icon: typeof BrickWall;
  label: string;
  suffix: string;
  iconClass: string;
}

const tiles: TileConfig[] = [
  { key: 'bricks', icon: BrickWall, label: 'G’isht', suffix: ' dona', iconClass: 'tile-icon-orange' },
  { key: 'cement', icon: Package, label: 'Sement', suffix: ' t', iconClass: 'tile-icon-blue' },
  { key: 'sand', icon: Truck, label: 'Qum', suffix: ' m³', iconClass: 'tile-icon-green' },
  { key: 'storeys', icon: Building2, label: 'Qavat', suffix: '', iconClass: 'tile-icon-purple' },
];

const MIN_AREA = 50;
const MAX_AREA = 2000;
const MIN_ROOMS = 1;
const MAX_ROOMS = 20;

/**
 * Reusable live calculator.
 * compact → hero variant (sliders + stepper, tighter layout)
 * full    → standalone section variant
 */
export function CalculatorWidget({ compact = false }: CalculatorWidgetProps) {
  const [area, setArea] = useState(120);
  const [rooms, setRooms] = useState(4);

  // Synchronous local calculation → instant values, brief 250ms spinner on input change
  const result = useCalculator(area, rooms);

  const stepRooms = (delta: number) => setRooms((r) => Math.min(MAX_ROOMS, Math.max(MIN_ROOMS, r + delta)));

  const fillPct = ((area - MIN_AREA) / (MAX_AREA - MIN_AREA)) * 100;

  return (
    <motion.div
      className="calculator-widget"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
    >
      <div className="calc-widget-head">
        <HardHat className="w-5 h-5" style={{ color: 'var(--accent)' }} />
        <h2>Qurilish kalkulyatori</h2>
      </div>

      {/* Inputs */}
      <div className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Uy maydoni
            </label>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {area} m²
            </span>
          </div>
          <input
            type="range"
            min={MIN_AREA}
            max={MAX_AREA}
            step={10}
            value={area}
            onChange={(e) => setArea(parseInt(e.target.value, 10))}
            className="range-slider"
            style={{
              background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${fillPct}%, var(--range-track) ${fillPct}%)`,
            }}
            aria-label="Uy maydoni"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="calc-widget-minmax">{MIN_AREA} m²</span>
            <span className="calc-widget-minmax">{MAX_AREA} m²</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Xonalar soni
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => stepRooms(-1)}
              className="stepper-btn"
              disabled={rooms <= MIN_ROOMS}
              aria-label="Xonalar sonini kamaytirish"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="stepper-value" aria-live="polite">
              {rooms}
            </span>
            <button
              type="button"
              onClick={() => stepRooms(1)}
              className="stepper-btn"
              disabled={rooms >= MAX_ROOMS}
              aria-label="Xonalar sonini oshirish"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic results */}
      <div className="calc-tile-grid">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          const value = result[tile.key];
          const showDash = result.error || typeof value !== 'number' || !Number.isFinite(value);
          return (
            <div key={tile.key} className={`calc-tile glass-card glass-accent-${tile.iconClass.replace('tile-icon-', '')}`}>
              <div className={`calc-tile-icon ${tile.iconClass}`}>
                <Icon className="w-6 h-6" />
              </div>
              <p className="calc-tile-value">
                {result.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent)' }} />
                ) : showDash ? (
                  '—'
                ) : (
                  <AnimatedValue value={value}>
                    {value.toLocaleString('ru-RU')}
                    <span className="calc-tile-suffix">{tile.suffix}</span>
                  </AnimatedValue>
                )}
              </p>
              <p className="calc-tile-label">{tile.label}</p>
            </div>
          );
        })}
      </div>

      <p className="calc-widget-note">
        Hisob-kitob taxminiydir va qavat tavsiyasi bilan birga avtomatik yangilanadi.
      </p>
    </motion.div>
  );
}
