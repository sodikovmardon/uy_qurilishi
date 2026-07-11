import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export function ThemeToggle() {
  const { isDark, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className="relative w-14 h-7 rounded-full bg-black/10 dark:bg-white/10 transition-colors duration-300 flex items-center cursor-pointer"
    >
      <motion.div
        className="absolute w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center"
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{ left: isDark ? 'calc(100% - 22px)' : '2px' }}
      >
        {isDark ? (
          <Moon className="w-3 h-3 text-slate-800" />
        ) : (
          <Sun className="w-3 h-3 text-amber-500" />
        )}
      </motion.div>
    </button>
  );
}
