import { useEffect, useRef, useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { VERIFIED_TOOLTIP } from '../../lib/verified';

/**
 * "Tasdiqlangan" badge — small green chip with a checkmark. Clicking shows a
 * popover explaining what verified means for the project.
 */
export default function VerifiedBadge({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <span ref={ref} className={`verified-wrap${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="chip chip-verified chip-verified-badge"
        aria-pressed={open}
        aria-label="Tasdiqlangan loyiha — batafsil"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <BadgeCheck className="w-3.5 h-3.5" />
        Tasdiqlangan
      </button>
      {open && (
        <span className="verified-popover fade-in" role="tooltip">
          {VERIFIED_TOOLTIP}
        </span>
      )}
    </span>
  );
}
