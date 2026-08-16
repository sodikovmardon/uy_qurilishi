/** Lightweight skeleton placeholder — marks content as loading for screen readers. */
export default function Skeleton({ width = '100%', height = 16 }: { width?: number | string; height?: number | string }) {
  return <div className="skeleton" style={{ width, height }} aria-hidden="true" />;
}
