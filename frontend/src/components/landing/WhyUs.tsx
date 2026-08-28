import { motion } from 'framer-motion';
import { BadgeCheck, Bot, Store, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Benefit {
  icon: LucideIcon;
  title: string;
  text: string;
  gradient: string;
}

const BENEFITS: Benefit[] = [
  {
    icon: BadgeCheck,
    title: 'Aniq hisob-kitob',
    text: 'Xatolarga yo’l qo’ymaslik uchun material miqdori formula asosida aniq hisoblanadi.',
    gradient: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
  },
  {
    icon: Store,
    title: 'Real narxlar',
    text: 'Do’kon katalogi bilan bog’langan narxlar sizga haqiqiy bozor qiymatini ko’rsatadi.',
    gradient: 'linear-gradient(135deg, #10B981, #047857)',
  },
  {
    icon: Bot,
    title: 'AI yordam',
    text: 'Aqlli yordamchi savollaringizga javob beradi va hisob-kitobda yo’l ko’rsatadi.',
    gradient: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
  },
  {
    icon: Wallet,
    title: 'Do’kon integratsiyasi',
    text: 'Natijalarni savatga yuborib, materiallarni to’g’ridan-to’g’ri buyurtma qiling.',
    gradient: 'linear-gradient(135deg, #F59E0B, #B45309)',
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

/** "Nega bizni tanlashadi" — benefit cards (landing, Phase 15). */
export function WhyUs() {
  return (
    <section className="mt-16 md:mt-24">
      <div className="section-head">
        <h2>Nega bizni tanlashadi</h2>
        <p>Bitta platformada — hisob-kitob, loyihalar va qurilish materiallari.</p>
      </div>

      <motion.div
        className="why-grid"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
      >
        {BENEFITS.map((b) => {
          const Icon = b.icon;
          return (
            <motion.div key={b.title} variants={itemVariants} className="card-surface why-card">
              <div className="stat-icon" style={{ background: b.gradient }}>
                <Icon className="w-6 h-6" />
              </div>
              <h3>{b.title}</h3>
              <p>{b.text}</p>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
