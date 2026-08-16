import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Leaf, ShoppingBag, Sun, SunMedium } from 'lucide-react';
import {
  ORIENTATION_BY_ID,
  orientationEnergyScore,
  orientationScoreLabel,
  productsForOrientation,
  type OrientationId,
  type StoreProductLike,
} from '../../lib/orientation';
import { fetchStoreCatalog } from '../../lib/storeApi';
import { formatPrice } from '../../lib/store';
import { StockBadge } from '../store/StockBadge';
import CategoryIcon from '../store/CategoryIcon';
import SmartImage from '../ui/SmartImage';
import CompassWidget from './CompassWidget';

function ProductThumb({ p }: { p: StoreProductLike }) {
  const src = p.images?.[0];
  if (!src) {
    return (
      <span className="orientation-product-fallback">
        <CategoryIcon category={p.category} size={20} />
      </span>
    );
  }
  return (
    <SmartImage
      src={src}
      alt={p.name}
      className="orientation-product-img"
      fallback={
        <span className="orientation-product-fallback">
          <CategoryIcon category={p.category} size={20} />
        </span>
      }
    />
  );
}

function OrientationProduct({ p }: { p: StoreProductLike }) {
  return (
    <Link to={`/dokon?product=${p.id}`} className="orientation-product">
      <ProductThumb p={p} />
      <span className="orientation-product-body">
        <span className="orientation-product-cat">{p.category}</span>
        <span className="orientation-product-name">{p.name}</span>
        <span className="orientation-product-meta">
          <strong className="orientation-product-price">{formatPrice(p.price)}</strong>
          <StockBadge status={p.stock_status} />
        </span>
      </span>
      <ChevronRight className="orientation-product-arrow" aria-hidden="true" />
    </Link>
  );
}

interface OrientationAdvisorProps {
  direction: OrientationId | null;
  /** Omit to make the compass read-only (project detail view). */
  onDirectionChange?: (dir: OrientationId) => void;
  /** Pre-fetched catalog (avoids a duplicate fetch when the parent has one). */
  products?: StoreProductLike[] | null;
  /** Compact read-only layout used inside the project modal. */
  compact?: boolean;
}

/**
 * Quyosh yo'nalishi bo'yicha maslahat — interactive compass plus an advisory
 * card: energy score, what the orientation does well, what needs care, and
 * store products matched to the orientation's needs.
 */
export default function OrientationAdvisor({
  direction,
  onDirectionChange,
  products: injectedProducts,
  compact = false,
}: OrientationAdvisorProps) {
  const [catalog, setCatalog] = useState<StoreProductLike[] | null>(injectedProducts ?? null);
  const interactive = Boolean(onDirectionChange);

  useEffect(() => {
    if (injectedProducts !== undefined) {
      setCatalog(injectedProducts);
      return;
    }
    let cancelled = false;
    fetchStoreCatalog()
      .then((c) => {
        if (!cancelled) setCatalog(c);
      })
      .catch(() => {
        /* products optional — advisory still renders without them */
      });
    return () => {
      cancelled = true;
    };
  }, [injectedProducts]);

  const info = direction ? ORIENTATION_BY_ID[direction] : null;
  const score = useMemo(() => (direction ? orientationEnergyScore(direction) : null), [direction]);
  const recommended = useMemo(
    () => (direction && catalog ? productsForOrientation(catalog, direction) : []),
    [direction, catalog],
  );

  return (
    <section
      className={`orientation-advisor card-surface${compact ? ' is-compact' : ''}`}
      aria-labelledby="orientation-advisor-title"
    >
      <header className="orientation-advisor-head">
        <span className="orientation-advisor-icon" aria-hidden="true">
          {direction ? <SunMedium /> : <Sun />}
        </span>
        <div>
          <h3 id="orientation-advisor-title" className="orientation-advisor-title">
            Quyosh yo\u2019nalishi bo\u2019yicha maslahat
          </h3>
          <p className="orientation-advisor-sub">
            {interactive
              ? direction
                ? "Boshqa yo\u2019nalishni ham sinab ko\u2019ring"
                : 'Bino qaysi tomonga qaragan bo\u2019ladi?'
              : "Ushbu loyihada belgilangan yo'nalish"}
          </p>
        </div>
      </header>

      <div className="orientation-advisor-body">
        <CompassWidget value={direction} onChange={onDirectionChange} size={compact ? 168 : 200} compact={compact} />

        {!info ? (
          <p className="orientation-advisor-empty">
            Yo\u2019nalish tanlang — izolyatsiya, oyna joylashuvi va energiya samaradorligi bo\u2019yicha maslahat ko\u2019rsatamiz.
          </p>
        ) : (
          <div className="orientation-advisor-info">
            <div className="orientation-advisor-summary">
              <strong>{info.label}</strong>
              <span>{info.summary}</span>
            </div>

            {score !== null && (
              <div className="orientation-energy">
                <div className="orientation-energy-head">
                  <span className="orientation-energy-title">Energiya samaradorligi</span>
                  <span className="orientation-energy-score">{score} / 100</span>
                </div>
                <div className="orientation-energy-track" role="img" aria-label={`Energiya samaradorligi ${score} ball`}>
                  <div className="orientation-energy-fill" style={{ width: `${score}%` }} />
                </div>
                <span className="orientation-energy-tag">{orientationScoreLabel(score)}</span>
              </div>
            )}

            {info.advantages.length > 0 && (
              <div className="orientation-note is-good">
                <span className="orientation-note-label">Afzalliklar</span>
                <ul>
                  {info.advantages.map((a) => (
                    <li key={a}>
                      <Leaf className="orientation-note-icon" aria-hidden="true" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {info.cautions.length > 0 && (
              <div className="orientation-note is-caution">
                <span className="orientation-note-label">E\u2019tibor kerak</span>
                <ul>
                  {info.cautions.map((c) => (
                    <li key={c}>
                      <AlertTriangle className="orientation-note-icon" aria-hidden="true" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recommended.length > 0 && (
              <div className="orientation-products">
                <span className="orientation-products-label">
                  <ShoppingBag className="orientation-products-icon" aria-hidden="true" />
                  Tavsiya etilgan mahsulotlar
                </span>
                <div className="orientation-products-list">
                  {recommended.map((p) => (
                    <OrientationProduct key={p.id} p={p} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
