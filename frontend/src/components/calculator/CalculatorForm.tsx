import { useState } from 'react';
import { motion } from 'framer-motion';
import { Ruler, DoorOpen, HardHat } from 'lucide-react';

interface CalculatorFormProps {
  area: number;
  rooms: number;
  onAreaChange: (v: number) => void;
  onRoomsChange: (v: number) => void;
}

export function CalculatorForm({ area, rooms, onAreaChange, onRoomsChange }: CalculatorFormProps) {
  const [focused, setFocused] = useState<string | null>(null);

  const inputClass = (name: string) =>
    `w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 outline-none border ${
      focused === name
        ? 'border-[#007AFF] ring-2 ring-[#007AFF]/20'
        : ''
    }`
    .trim();

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
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
    >
      <div className="flex items-center gap-2 mb-5">
        <HardHat className="w-5 h-5 text-[#007AFF]" />
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Qurilish kalkulyatori
        </h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Uy maydoni (m²)
          </label>
          <div className="relative">
            <Ruler className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="number"
              value={area}
              onChange={(e) => onAreaChange(Math.max(1, parseInt(e.target.value) || 0))}
              onFocus={() => setFocused('area')}
              onBlur={() => setFocused(null)}
              className={inputClass('area')}
              style={{
                backgroundColor: 'var(--input-bg)',
                borderColor: focused === 'area' ? '#007AFF' : 'var(--input-border)',
                color: 'var(--text-primary)',
              }}
              min={1}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Xonalar soni
          </label>
          <div className="relative">
            <DoorOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="number"
              value={rooms}
              onChange={(e) => onRoomsChange(Math.max(1, parseInt(e.target.value) || 0))}
              onFocus={() => setFocused('rooms')}
              onBlur={() => setFocused(null)}
              className={inputClass('rooms')}
              style={{
                backgroundColor: 'var(--input-bg)',
                borderColor: focused === 'rooms' ? '#007AFF' : 'var(--input-border)',
                color: 'var(--text-primary)',
              }}
              min={1}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
