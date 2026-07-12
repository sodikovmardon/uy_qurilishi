import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Globe, Target, Bot, type LucideIcon } from 'lucide-react';
import { AnimatedCounter } from '../ui/AnimatedCounter';
import type { StatItem } from '../../types';
import { api } from '../../api/client';

const iconMap: Record<StatItem['icon'], LucideIcon> = {
  FolderOpen,
  Globe,
  Target,
  Bot,
};

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

export function StatCards() {
  const [stats, setStats] = useState<StatItem[]>([
    { label: 'Bajarilgan loyihalar', value: 0, icon: 'FolderOpen', accent: 'from-blue-500 to-blue-600' },
    { label: 'Web loyihalar', value: 0, icon: 'Globe', accent: 'from-emerald-500 to-emerald-600' },
    { label: 'Aniqlik', value: 99, icon: 'Target', accent: 'from-amber-500 to-amber-600' },
    { label: 'AI yordam', value: 0, icon: 'Bot', accent: 'from-purple-500 to-purple-600' },
  ]);

  useEffect(() => {
    api.getDashboard().then(data => {
      setStats([
        { label: 'Bajarilgan loyihalar', value: data.total_projects, icon: 'FolderOpen', accent: 'from-blue-500 to-blue-600' },
        { label: 'Web loyihalar', value: data.web_projects, icon: 'Globe', accent: 'from-emerald-500 to-emerald-600' },
        { label: 'Aniqlik', value: 99, icon: 'Target', accent: 'from-amber-500 to-amber-600' },
        { label: 'AI yordam', value: data.ai_assisted, icon: 'Bot', accent: 'from-purple-500 to-purple-600' },
      ]);
    });
  }, []);

  return (
    <motion.div
      className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
    >
      {stats.map((stat) => {
        const Icon = iconMap[stat.icon];

        return (
          <motion.div
            key={stat.label}
            variants={cardVariants}
            className="rounded-2xl p-4 md:p-5 border transition-all duration-300 hover:-translate-y-0.5"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-card)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.accent} flex items-center justify-center shadow-lg`}
              style={{
                boxShadow: `0 4px 12px rgba(${stat.accent.includes('blue') ? '0,122,255' : stat.accent.includes('emerald') ? '52,199,89' : stat.accent.includes('amber') ? '255,149,0' : '175,82,222'},0.3)`,
              }}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="mt-3">
              <AnimatedCounter value={stat.value} suffix={stat.icon === 'Target' ? '%' : ''} />
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {stat.label}
            </p>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
