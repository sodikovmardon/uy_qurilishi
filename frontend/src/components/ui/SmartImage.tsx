import { useState } from 'react';
import type { ReactNode } from 'react';

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  /** Above-the-fold images skip lazy-loading. */
  eager?: boolean;
  /** Branded placeholder rendered in place of the image on load failure. */
  fallback?: ReactNode;
}

/**
 * Image with shimmer skeleton + 200ms fade-in and native lazy-loading.
 *
 * Renders the optional `fallback` (or nothing) on error so no broken-image
 * icon shows. Parent containers MUST reserve explicit dimensions
 * (aspect-ratio / fixed height), which both prevents layout shift and lets
 * the absolutely-positioned image fill.
 */
export default function SmartImage({ src, alt, className = '', sizes, eager = false, fallback }: SmartImageProps) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return fallback ? (
      <span className={`smart-img smart-img-fallback${className ? ` ${className}` : ''}`} aria-hidden="true">
        {fallback}
      </span>
    ) : null;
  }

  return (
    <span className={`smart-img${ready ? ' is-ready' : ''}${className ? ` ${className}` : ''}`}>
      {!ready && <span className="smart-img-skeleton" aria-hidden="true" />}
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        sizes={sizes}
        onLoad={() => setReady(true)}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
