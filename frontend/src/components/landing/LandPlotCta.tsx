import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, LandPlot, MapPinned, Ruler, Sparkles } from 'lucide-react';

/**
 * "Uchastkangizga mos loyiha toping" CTA band (landing, Phase 16).
 * Prominent card that routes to the Loyihalar page with the plot matcher open.
 */
export function LandPlotCta() {
  return (
    <section className="mt-16 md:mt-24">
      <motion.div
        className="land-plot-cta"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <div className="land-plot-cta-text">
          <div className="land-plot-cta-chip">
            <Sparkles className="w-4 h-4" />
            Yangi
          </div>
          <h2>Uchastkangizga mos loyiha toping</h2>
          <p>
            Uchastka o’lchamlarini kiriting — sotix va kvadrat metr, qurilish foizi va chekinish masofasini hisobga
            olgan holda qaysi uy loyihalari to’liq sig’ishini ko’rsatamiz.
          </p>
          <div className="land-plot-cta-steps">
            <span>
              <Ruler className="w-4 h-4" />
              Maydonni kiriting
            </span>
            <span>
              <MapPinned className="w-4 h-4" />
              Chegara va foizni belgilang
            </span>
            <span>
              <LandPlot className="w-4 h-4" />
              Mos loyihalarni ko’ring
            </span>
          </div>
          <Link className="btn btn-primary" to="/loyihalar?uchastka=1">
            <LandPlot className="w-4 h-4" />
            Uchastkangizni kiritish
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="land-plot-cta-visual" aria-hidden="true">
          <svg viewBox="0 0 120 90" className="land-plot-cta-svg">
            <rect x={8} y={6} width={104} height={78} rx={4} className="cta-plot" />
            <rect x={22} y={18} width={76} height={54} rx={3} className="cta-zone" />
            <rect x={34} y={30} width={52} height={30} rx={2} className="cta-house" />
            <text x={60} y={63} textAnchor="middle" className="cta-label">
              6 sotix · 300 m²
            </text>
          </svg>
        </div>
      </motion.div>
    </section>
  );
}
