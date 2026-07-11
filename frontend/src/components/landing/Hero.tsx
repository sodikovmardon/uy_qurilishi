import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface HeroProps {
  onScrollToCalculator: () => void;
}

export function Hero({ onScrollToCalculator }: HeroProps) {
  return (
    <motion.section
      className="pt-8 md:pt-12 pb-6 md:pb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <motion.h1
        className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight"
        style={{ color: 'var(--text-primary)' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
      >
        Uy qurish{' '}
        <span className="bg-gradient-to-r from-[#007AFF] to-[#5856D6] bg-clip-text text-transparent">
          materiallarini
        </span>
        <br />
        aniq hisoblang
      </motion.h1>

      <motion.p
        className="mt-4 text-base md:text-lg max-w-xl leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
      >
        G'isht, sement va qum miqdorini bir zumda hisoblab oling.
        AI yordamida eng to'g'ri qurilish tavsiyalarini oling.
      </motion.p>

      <motion.button
        onClick={onScrollToCalculator}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-b from-[#007AFF] to-[#0051A8] shadow-[0_4px_14px_rgba(0,122,255,0.35)] hover:shadow-[0_6px_20px_rgba(0,122,255,0.5)] transition-all duration-200"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        Hisoblashni boshlash
        <ArrowRight className="w-4 h-4" />
      </motion.button>
    </motion.section>
  );
}
