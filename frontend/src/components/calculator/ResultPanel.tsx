import { motion } from 'framer-motion';
import { BrickWall, Package, Truck, Building2 } from 'lucide-react';
import type { CalculationResult } from '../../types';

interface ResultPanelProps {
  result: CalculationResult;
}

const items = [
  {
    key: 'bricks' as const,
    icon: BrickWall,
    label: 'G\'isht',
    suffix: ' dona',
    color: '#FF6B35',
    bg: 'rgba(255,107,53,0.1)',
  },
  {
    key: 'cement' as const,
    icon: Package,
    label: 'Sement',
    suffix: ' t',
    color: '#007AFF',
    bg: 'rgba(0,122,255,0.1)',
  },
  {
    key: 'sand' as const,
    icon: Truck,
    label: 'Qum',
    suffix: ' m³',
    color: '#34C759',
    bg: 'rgba(52,199,89,0.1)',
  },
  {
    key: 'storeys' as const,
    icon: Building2,
    label: 'Qavat',
    suffix: '',
    color: '#AF52DE',
    bg: 'rgba(175,82,222,0.1)',
  },
];

export function ResultPanel({ result }: ResultPanelProps) {
  return (
    <motion.div
      className="rounded-2xl p-5 md:p-6 border"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-card)',
        boxShadow: 'var(--shadow-card)',
      }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.2 }}
    >
      <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
        Loyiha natijasi
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {items.map((item, i) => {
          const Icon = item.icon;
          const value = result[item.key];

          return (
            <motion.div
              key={item.key}
              className="rounded-xl p-4 border"
              style={{
                backgroundColor: item.bg,
                borderColor: 'var(--border-card)',
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.08 }}
            >
              <Icon className="w-5 h-5 mb-2" style={{ color: item.color }} />
              <p className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {typeof value === 'number' ? value.toLocaleString() : value}
                <span className="text-sm font-medium ml-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {item.suffix}
                </span>
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {item.label}
              </p>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
