import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface AnimatedValueProps {
  /** Key to track — the value that triggers the scale-pulse when it changes. */
  value: string | number;
  children: ReactNode;
}

/**
 * Number/scale-pulse wrapper (Phase 11): whenever `value` changes, the wrapped
 * content briefly scales up (1.08 → 1, ~300ms) so recalculation feels alive.
 * Uses transform/opacity only and respects reduced motion.
 */
export function AnimatedValue({ value, children }: AnimatedValueProps) {
  const reduce = useReducedMotion();
  const [pulse, setPulse] = useState(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPulse((k) => k + 1);
  }, [value]);

  return (
    <motion.span
      key={pulse}
      className="inline-block"
      initial={reduce || pulse === 0 ? false : { scale: 1.08 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.span>
  );
}
