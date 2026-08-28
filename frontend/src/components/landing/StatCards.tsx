import { motion } from 'framer-motion';
import { FolderOpen, Target, PiggyBank, Bot, type LucideIcon } from 'lucide-react';
import { useCountAnimation } from '../../hooks/useCountAnimation';
import { useInView } from '../../hooks/useInView';
import { useGlassTrack } from '../../hooks/useGlassTrack';
import { t } from '../../lib/i18n';

interface StatCardConfig {
  id: string;
  label: string;
  target: number;
  format: (value: number) => string;
  icon: LucideIcon;
  gradient: string;
  live?: boolean;
}

const STATS: StatCardConfig[] = [
  {
    id: 'calculated',
    label: t('stat.calculated'),
    target: 1250,
    format: (v) => `${v.toLocaleString('en-US')}+`,
    icon: FolderOpen,
    gradient: 'linear-gradient(135deg, #0A84FF, #0060DF)',
  },
  {
    id: 'accuracy',
    label: t('stat.accuracy'),
    target: 994,
    format: (v) => `${(v / 10).toFixed(1)}%`,
    icon: Target,
    gradient: 'linear-gradient(135deg, #10B981, #047857)',
  },
  {
    id: 'savings',
    label: t('stat.savings'),
    target: 45,
    format: (v) => `${v}-50%`,
    icon: PiggyBank,
    gradient: 'linear-gradient(135deg, #F59E0B, #B45309)',
  },
  {
    id: 'ai',
    label: t('stat.ai'),
    target: 24,
    format: (v) => `${v}/7`,
    icon: Bot,
    gradient: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
    live: true,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 25 },
  },
};

const ACCENT_CLASS: Record<string, string> = {
  calculated: 'glass-accent-blue',
  accuracy: 'glass-accent-green',
  savings: 'glass-accent-amber',
  ai: 'glass-accent-purple',
};

function StatValue({ card, active }: { card: StatCardConfig; active: boolean }) {
  const count = useCountAnimation(card.target, 1400, active);
  return <span className="stat-value">{card.format(count)}</span>;
}

function StatCardItem({ card, active }: { card: StatCardConfig; active: boolean }) {
  const Icon = card.icon;
  const trackRef = useGlassTrack<HTMLDivElement>();
  return (
    <motion.div
      key={card.id}
      variants={cardVariants}
      ref={trackRef}
      className={`stat-card glass-card glass-card--track ${ACCENT_CLASS[card.id] ?? ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="stat-icon" style={{ background: card.gradient }}>
          <Icon className="w-6 h-6" />
        </div>
        {card.live && (
          <span className="live-badge">
            <span className="live-dot" aria-hidden="true" />
            {t('stat.live')}
          </span>
        )}
      </div>
      <div className="stat-value-wrap">
        <StatValue card={card} active={active} />
      </div>
      <p className="stat-label">{card.label}</p>
    </motion.div>
  );
}

/**
 * Statistics section — glassmorphic cards with scroll-triggered count-up.
 * Metrics are curated marketing figures; counter animates via IntersectionObserver.
 */
export function StatCards() {
  const { ref, inView } = useInView<HTMLDivElement>('-40px');

  return (
    <motion.div
      ref={ref}
      className="stats-grid"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
    >
      {STATS.map((card) => (
        <StatCardItem key={card.id} card={card} active={inView} />
      ))}
    </motion.div>
  );
}
