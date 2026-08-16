import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'md' | 'sm';
}

/** Canonical buttons (Phase 3) — always a real <button>, never a div. */
export default function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }: ButtonProps) {
  const classes = ['btn', variant === 'primary' ? 'btn-primary' : 'btn-secondary', size === 'sm' ? 'btn-sm' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
