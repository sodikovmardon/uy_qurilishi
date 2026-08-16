import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { subscribeProgress } from '../../lib/progress';

/** Thin top-of-page progress bar driven by the global progress store. */
export function ProgressBar() {
  const reduce = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const unsub = subscribeProgress((value) => {
      setProgress(value);
      setVisible(value > 0 && value < 100);
    });
    return unsub;
  }, []);

  if (reduce) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="progress-bar"
          role="progressbar"
          aria-hidden="true"
          style={{ transform: 'scaleX(0)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transform: `scaleX(${progress / 100})` }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        />
      )}
    </AnimatePresence>
  );
}
