import { motion } from 'framer-motion';
import { ArrowRight, FolderOpen, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../lib/i18n';

/**
 * Hero section — pure landing copy + canonical CTA buttons.
 * The calculator now lives on its own route; both CTAs navigate.
 */
export function Hero() {
  const navigate = useNavigate();

  return (
    <section className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center pt-8 md:pt-12 pb-6 md:pb-8">
      <motion.div
        className="flex flex-col items-start"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <motion.h1
          className="text-3xl md:text-5xl lg:text-6xl font-extrabold leading-[1.12] tracking-tight mb-5"
          style={{ color: 'var(--text-primary)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
        >
          {t('hero.title')}
        </motion.h1>

        <motion.p
          className="text-base md:text-lg max-w-[520px] leading-relaxed mb-8"
          style={{ color: 'var(--text-secondary)' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
        >
          {t('hero.subtitle')}
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-3 sm:gap-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <button className="btn btn-primary w-full sm:w-auto justify-center" onClick={() => navigate('/kalkulyator')}>
            {t('hero.cta')}
            <ArrowRight className="w-4 h-4 btn-arrow" />
          </button>
          <button className="btn btn-secondary w-full sm:w-auto justify-center" onClick={() => navigate('/loyihalar')}>
            <FolderOpen className="w-4 h-4" />
            {t('hero.cta2')}
          </button>
        </motion.div>
      </motion.div>

      {/* Right column — replaced the live calculator with a stat-proof visual */}
      <motion.div
        className="hidden lg:flex flex-col gap-4"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.35, duration: 0.6 }}
      >
        <div className="card-surface p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="stat-icon" style={{ background: 'linear-gradient(135deg, var(--accent-blue), #0060DF)' }}>
              <FolderOpen className="w-6 h-6" />
            </span>
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Aniq hisob-kitob</p>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Devor o'lchamlari, g'isht turi va hudud narxlari asosida g'isht, sement va qum
            miqdorini — hamda umumiy xarajatni — bir zumda oling.
          </p>
        </div>
        <div className="card-surface p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="stat-icon" style={{ background: 'linear-gradient(135deg, var(--accent-green), #047857)' }}>
              <Sparkles className="w-6 h-6" />
            </span>
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Do'kon bilan bog'langan narxlar</p>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Materiallar narxlari do'kon katalogidan real vaqtda yangilanadi va natijalarni
            to'g'ridan-to'g'ri savatga yuborish mumkin.
          </p>
        </div>
      </motion.div>
    </section>
  );
}
