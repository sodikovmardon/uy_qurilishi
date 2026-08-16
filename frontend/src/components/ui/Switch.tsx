/**
 * iOS-style toggle switch (shared UI primitive).
 * Keyboard accessible via role="switch" + Space/Enter activation.
 */
interface SwitchProps {
  checked: boolean;
  onToggle: () => void;
  label?: string;
}

export default function Switch({ checked, onToggle, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch${checked ? ' is-on' : ''}`}
      onClick={onToggle}
    >
      <span className="switch-knob" aria-hidden="true" />
    </button>
  );
}
