import { motion } from 'framer-motion';
import { Ruler, Calculator, FolderOpen, ShoppingBag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Step {
  icon: LucideIcon;
  title: string;
  text: string;
}

const STEPS: Step[] = [
  {
    icon: Ruler,
    title: 'Uy o’lchamlarini kiriting',
    text: 'Devor uzunligi, balandligi va g’isht turini tanlang.',
  },
  {
    icon: Calculator,
    title: 'Material hisobini oling',
    text: 'G’isht, sement va qum miqdori hamda umumiy xarajat — bir zumda.',
  },
  {
    icon: FolderOpen,
    title: 'Loyihalarni ko’ring',
    text: 'Tayyor uy loyihalarini o’rganing va o’zingizga mosini tanlang.',
  },
  {
    icon: ShoppingBag,
    title: 'Do’kondan buyurtma bering',
    text: 'Materiallarni savatga qo’shib, to’g’ridan-to’g’ri buyurtma qiling.',
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
};

/** "Qanday ishlaydi" — 4-step visual explainer (landing, Phase 15). */
export function HowItWorks() {
  return (
    <section className="mt-16 md:mt-24">
      <div className="section-head">
        <h2>Qanday ishlaydi</h2>
        <p>To’rt oddiy qadamda qurilish rejangizni aniq hisoblang.</p>
      </div>

      <motion.div
        className="steps-grid"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
      >
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.div key={step.title} variants={itemVariants} className="card-surface step-card">
              <div className="step-card-top">
                <span className="step-card-num">{i + 1}</span>
                <div className="stat-icon">
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
