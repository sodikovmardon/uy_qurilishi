import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

/**
 * Icon-only theme switch — Sun/Moon crossfade inside a 40px circular button.
 * Both icons are rendered and cross-faded via opacity/scale for a smooth swap.
 */
export function ThemeToggle() {
  const { isDark, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Yorug’ rejimga o’tish' : 'Qorong’i rejimga o’tish'}
      className="theme-toggle"
    >
      <span className={`theme-icon ${isDark ? 'theme-icon-on' : ''}`}>
        <Sun className="w-4 h-4" />
      </span>
      <span className={`theme-icon ${isDark ? '' : 'theme-icon-on'}`}>
        <Moon className="w-4 h-4" />
      </span>
    </button>
  );
}
