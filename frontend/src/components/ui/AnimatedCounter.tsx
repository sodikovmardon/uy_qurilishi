import { motion } from 'framer-motion';
import { useCountAnimation } from '../../hooks/useCountAnimation';

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
}

export function AnimatedCounter({ value, suffix = '' }: AnimatedCounterProps) {
  const count = useCountAnimation(value);

  return (
    <motion.span
      className="text-3xl font-bold tracking-tight"
      style={{ color: 'var(--text-primary)' }}
      key={count}
    >
      {count.toLocaleString()}{suffix}
    </motion.span>
  );
}
