import { useTheme } from '../../context/ThemeContext';

export function TrafficLights() {
  const { isDark } = useTheme();

  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      <div className="w-3 h-3 rounded-full bg-[var(--apple-red)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]" />
      <div className="w-3 h-3 rounded-full bg-[var(--apple-yellow)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]" />
      <div className="w-3 h-3 rounded-full bg-[var(--apple-green)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]" />
      <span className="ml-3 text-xs font-semibold tracking-tight" style={{ color: 'var(--text-secondary)' }}>
        Uy Loyiha Studio
      </span>
    </div>
  );
}
