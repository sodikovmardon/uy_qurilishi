import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, ArrowDown } from 'lucide-react';
import { Hero } from '../components/landing/Hero';
import { StatCards } from '../components/landing/StatCards';
import { CalculatorForm } from '../components/calculator/CalculatorForm';
import { ResultPanel } from '../components/calculator/ResultPanel';
import { useCalculator } from '../hooks/useCalculator';

export function HomePage() {
  const [area, setArea] = useState(120);
  const [rooms, setRooms] = useState(4);
  const [showResult, setShowResult] = useState(false);
  const calcRef = useRef<HTMLDivElement>(null);

  const result = useCalculator(area, rooms);

  function handleScrollToCalc() {
    calcRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleCalculate() {
    setShowResult(true);
    setTimeout(() => {
      calcRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }

  return (
    <div>
      <Hero onScrollToCalculator={handleScrollToCalc} />

      <motion.div
        className="mt-8 md:mt-10"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <StatCards />
      </motion.div>

      <div ref={calcRef} className="mt-10 md:mt-14 scroll-mt-28">
        <div className="flex items-center gap-2 mb-5">
          <Calculator className="w-5 h-5 text-[#007AFF]" />
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Materiallarni hisoblash
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          <CalculatorForm
            area={area}
            rooms={rooms}
            onAreaChange={setArea}
            onRoomsChange={setRooms}
          />

          <AnimatePresence mode="wait">
            {showResult ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                <ResultPanel result={result} />
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                className="rounded-2xl p-6 border flex flex-col items-center justify-center text-center min-h-[200px]"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-card)',
                  boxShadow: 'var(--shadow-card)',
                }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <ArrowDown className="w-8 h-8 mb-3 text-[#007AFF] animate-bounce" />
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Maydon va xonalar sonini kiritib, natijani ko'ring
                </p>
                <button
                  onClick={handleCalculate}
                  className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-b from-[#007AFF] to-[#0051A8] shadow-[0_4px_14px_rgba(0,122,255,0.35)] hover:shadow-[0_6px_20px_rgba(0,122,255,0.5)] transition-all"
                >
                  Hisoblash
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-8 md:mt-10 p-5 md:p-6 rounded-2xl border" style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-card)',
        boxShadow: 'var(--shadow-card)',
      }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          Hisoblash formulasi
        </h3>
        <div className="grid sm:grid-cols-3 gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <div className="space-y-1">
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>G'isht</p>
            <p>Devor yuzasi × 400 dona/m²</p>
            <p>Devor = perimetr × 3m × 0.85</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Sement</p>
            <p>(G'isht / 1000) × 0.5 tonna</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Qum</p>
            <p>Sement × 3 m³</p>
          </div>
        </div>
      </div>
    </div>
  );
}
