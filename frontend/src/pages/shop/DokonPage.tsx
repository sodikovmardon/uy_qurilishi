import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { api, type StoreProduct } from '../../api/client';
import { DEFAULT_STORE_SOURCE, fetchStoreCatalog } from '../../lib/storeApi';
import { formatPrice } from '../../lib/store';
import {
  addManyToCart,
  addToCart,
  clearCart,
  getCart,
  getCartCount,
  getMaxQty,
  removeFromCart,
  setCartQuantity,
  subscribeCart,
  type CartItem,
} from '../../lib/cart';
import { useApp } from '../../context/AppContext';
import { vibrate } from '../../lib/haptics';
import { StockBadge } from '../../components/store/StockBadge';
import CategoryIcon from '../../components/store/CategoryIcon';
import SmartImage from '../../components/ui/SmartImage';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import { SearchEmpty } from '../../components/ui/EmptyIllustration';
import ReviewSummary from '../../components/reviews/ReviewSummary';
import ReviewSection from '../../components/reviews/ReviewSection';
import { ratingOf, subscribeReviews } from '../../lib/reviews';

type LoadState = 'loading' | 'ready' | 'error';
type SortKey = 'default' | 'price-asc' | 'price-desc' | 'new' | 'rating';
type RatingFilter = 'all' | '3' | '4';

/** Product thumbnail — shimmer/lazy image with a category-based icon fallback. */
function ProductImage({
  product,
  className,
  eager = false,
}: {
  product: StoreProduct;
  className: string;
  eager?: boolean;
}) {
  const src = product.images?.[0];
  if (!src) {
    return (
      <span className="store-img-fallback">
        <CategoryIcon category={product.category} />
      </span>
    );
  }
  return (
    <SmartImage
      src={src}
      alt={product.name}
      className={className}
      eager={eager}
      fallback={
        <span className="store-img-fallback">
          <CategoryIcon category={product.category} />
        </span>
      }
    />
  );
}

/** Quantity stepper — clamps to [1, max]. */
function QtyStepper({
  value,
  max,
  onChange,
  ariaLabel,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  ariaLabel: string;
}) {
  return (
    <div className="qty-stepper" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className="qty-step"
        aria-label="Kamaytirish"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        className="qty-input"
        type="number"
        min={1}
        max={max}
        value={value}
        aria-label="Miqdor"
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isNaN(n)) return;
          onChange(Math.min(Math.max(1, n), max));
        }}
      />
      <button
        type="button"
        className="qty-step"
        aria-label="Oshirish"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/** Product detail modal opened from the catalog grid. */
function ProductModal({
  product,
  onClose,
  onAdd,
}: {
  product: StoreProduct;
  onClose: () => void;
  onAdd: (product: StoreProduct, qty: number) => void;
}) {
  const [qty, setQty] = useState(1);
  const [active, setActive] = useState(0);
  const max = getMaxQty(product);
  const images = product.images ?? [];
  const shown = images[active] ?? images[0];

  return (
    <Modal open onClose={onClose} title={product.name} wide>
      <div className="dokon-modal">
        <div className="dokon-modal-media">
          <div className="dokon-modal-img">
            {shown ? (
              <SmartImage src={shown} alt={product.name} sizes="260px" eager />
            ) : (
              <span className="store-img-fallback">
                <CategoryIcon category={product.category} size={56} />
              </span>
            )}
          </div>
          {images.length > 1 && (
            <div className="dokon-thumbs" role="tablist" aria-label="Mahsulot rasmlari">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  aria-label={`Rasm ${i + 1}`}
                  className={`dokon-thumb${i === active ? ' is-active' : ''}`}
                  onClick={() => setActive(i)}
                >
                  <img src={src} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="dokon-modal-info">
          <div className="dokon-modal-top">
            <span className="store-card-cat">{product.category}</span>
            <StockBadge status={product.stock_status} />
          </div>
          <div className="dokon-modal-rating">
            <ReviewSummary itemType="product" itemId={String(product.id)} size={15} />
          </div>
          <h2 className="dokon-modal-name">{product.name}</h2>
          {product.description && <p className="dokon-modal-desc">{product.description}</p>}
          <div className="dokon-modal-price-row">
            <strong className="store-price dokon-modal-price">{formatPrice(product.price)}</strong>
            <span className="store-unit">/ {product.unit}</span>
          </div>
          {product.sku && <span className="dokon-modal-sku">SKU: {product.sku}</span>}
          <p className="dokon-modal-stock">
            {product.stock_quantity > 0 ? (
              <>Do&apos;konda {product.stock_quantity.toLocaleString('ru-RU')} {product.unit} bor</>
            ) : (
              <>Mahsulot vaqtincha tugagan — so&apos;rov qoldiring</>
            )}
          </p>
          <div className="dokon-modal-actions">
            <QtyStepper value={qty} max={max} onChange={setQty} ariaLabel={`${product.name} miqdori`} />
            <Button
              className="dokon-modal-add"
              disabled={product.stock_status === 'Tugagan'}
              onClick={() => onAdd(product, qty)}
            >
              <ShoppingBag className="w-4 h-4" />
              Savatga qo&apos;shish — {formatPrice(product.price * qty)}
            </Button>
          </div>
          <ReviewSection itemType="product" itemId={String(product.id)} />
        </div>
      </div>
    </Modal>
  );
}

/** Slide-in cart panel (right side). */
function CartDrawer({
  open,
  items,
  subtotal,
  onClose,
  onCheckout,
}: {
  open: boolean;
  items: CartItem[];
  subtotal: number;
  onClose: () => void;
  onCheckout: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div className={`cart-drawer-backdrop${open ? ' is-open' : ''}`} onMouseDown={onClose}>
      <aside
        className={`cart-drawer${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Savat"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="cart-drawer-head">
          <h2 className="cart-drawer-title">
            <ShoppingBag className="w-5 h-5" />
            Savat
          </h2>
          <button className="modal-close" aria-label="Yopish" onClick={onClose}>
            ×
          </button>
        </header>

        {items.length === 0 ? (
          <div className="cart-empty">
            <ShoppingBag className="cart-empty-icon" />
            <p>Savat bo&apos;sh</p>
            <p className="cart-empty-hint">Mahsulotlarni tanlang va buyurtma so&apos;rovini yuboring</p>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {items.map((item) => (
                <div key={item.product.id} className="cart-item">
                  <div className="cart-item-img">
                    <ProductImage product={item.product} className="cart-item-ph" />
                  </div>
                  <div className="cart-item-info">
                    <span className="cart-item-cat">{item.product.category}</span>
                    <h3 className="cart-item-name">{item.product.name}</h3>
                    <div className="cart-item-price">
                      {formatPrice(item.product.price)}
                      <span className="store-unit">/ {item.product.unit}</span>
                    </div>
                    <div className="cart-item-actions">
                      <QtyStepper
                        value={item.quantity}
                        max={getMaxQty(item.product)}
                        ariaLabel={`${item.product.name} miqdori`}
                        onChange={(next) => setCartQuantity(item.product.id, next)}
                      />
                      <span className="cart-item-total">{formatPrice(item.product.price * item.quantity)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="cart-item-remove"
                    aria-label={`${item.product.name}ni o'chirish`}
                    onClick={() => removeFromCart(item.product.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <footer className="cart-drawer-foot">
              <div className="cart-subtotal">
                <span>Jami</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>
              <Button className="cart-checkout-btn" onClick={onCheckout}>
                Buyurtma berish
                <ArrowRight className="w-4 h-4" />
              </Button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

/** Checkout modal — inquiry form + success confirmation. */
function CheckoutModal({
  open,
  items,
  subtotal,
  onClose,
}: {
  open: boolean;
  items: CartItem[];
  subtotal: number;
  onClose: () => void;
}) {
  const { showToast } = useApp();
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ name: '', phone: '', address: '' });
      setError('');
      setDone(false);
    }
  }, [open]);

  const submit = async () => {
    const phone = form.phone.trim();
    if (phone.length < 7) {
      setError('Telefon raqamingizni to\'liq kiriting');
      return;
    }
    if (!items.length) return;
    setError('');
    setSending(true);
    try {
      await api.calcInquiry({
        name: form.name.trim(),
        phone,
        note: form.address.trim(),
        items: items.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
      });
      clearCart();
      setDone(true);
      vibrate(20);
      showToast('So\'rov do\'konga yuborildi', 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Buyurtma so'rovi" wide>
      {done ? (
        <div className="store-order-success">
          <CheckCircle2 className="store-order-success-icon" />
          <h3>So&apos;rov do&apos;konga yuborildi!</h3>
          <p>Operator siz bilan tez orada bog&apos;lanadi va narxlarni telefon orqali tasdiqlaydi.</p>
          <Button onClick={onClose}>Yopish</Button>
        </div>
      ) : (
        <form
          className="store-order-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="checkout-summary">
            {items.length} ta mahsulot · jami <strong>{formatPrice(subtotal)}</strong>
          </p>
          <div className="checkout-list">
            {items.map((i) => (
              <div key={i.product.id} className="checkout-list-item">
                <span className="checkout-list-name">{i.product.name}</span>
                <span className="checkout-list-qty">
                  {i.quantity} {i.product.unit}
                </span>
              </div>
            ))}
          </div>
          <label className="field">
            <span>Ismingiz</span>
            <input
              className="control"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ism (ixtiyoriy)"
            />
          </label>
          <label className="field">
            <span>Telefon raqami *</span>
            <input
              className="control"
              type="tel"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+998 90 123 45 67"
            />
          </label>
          <label className="field">
            <span>Yetkazib berish manzili</span>
            <textarea
              className="control"
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Manzil yoki izoh (ixtiyoriy)"
            />
          </label>
          {error && <p className="store-order-error">{error}</p>}
          <div className="store-order-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Bekor qilish
            </button>
            <button type="submit" className="btn btn-primary" disabled={sending}>
              {sending ? 'Yuborilmoqda...' : 'So\'rovni yuborish'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function DokonPage() {
  const { showToast } = useApp();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [catalog, setCatalog] = useState<StoreProduct[] | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [reloadKey, setReloadKey] = useState(0);

  const [categories, setCategories] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [sort, setSort] = useState<SortKey>('default');
  /** Bumped whenever reviews change so rating sort/filter re-run live. */
  const [reviewsTick, bumpReviews] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    return subscribeReviews(bumpReviews);
  }, []);

  const [selected, setSelected] = useState<StoreProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [cartItems, setCartItems] = useState<CartItem[]>(() => getCart());
  const [cartCount, setCartCount] = useState(() => getCartCount());

  const initialFromCalc = (location.state as { fromCalculator?: number } | null)?.fromCalculator ?? null;
  const [bannerCount, setBannerCount] = useState<number | null>(initialFromCalc);

  const debounceRef = useRef<number>(0);

  // ---- catalog (shared 3-min cache with the calculator) ----
  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    fetchStoreCatalog(DEFAULT_STORE_SOURCE, reloadKey > 0)
      .then((c) => {
        if (cancelled) return;
        setCatalog(c);
        setLoadState(c ? 'ready' : 'error');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // ---- categories (live from the store's /api/v1/categories, fallback from catalog) ----
  useEffect(() => {
    api
      .getStoreCategories()
      .then((cs) => setCategories(cs.map((x) => x.category)))
      .catch(() => {
        // fallback: derive from the fetched catalog
        if (catalog) setCategories(Array.from(new Set(catalog.map((p) => p.category))));
      });
  }, [catalog]);

  // ---- debounced search ----
  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setSearch(q.trim()), 250);
    return () => window.clearTimeout(debounceRef.current);
  }, [q]);

  // ---- cart reactivity ----
  useEffect(() => {
    return subscribeCart(() => {
      setCartItems(getCart());
      setCartCount(getCartCount());
    });
  }, []);

  // ---- open a product directly via ?product=ID (calculator "buy" links) ----
  useEffect(() => {
    const pid = searchParams.get('product');
    if (pid && catalog) {
      const p = catalog.find((x) => String(x.id) === pid);
      if (p) setSelected(p);
    }
  }, [catalog, searchParams]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const needle = search.toLowerCase();
    let list = catalog.filter((p) => {
      const inCat = !category || p.category === category;
      const inSearch =
        !needle ||
        p.name.toLowerCase().includes(needle) ||
        p.category.toLowerCase().includes(needle) ||
        p.description.toLowerCase().includes(needle) ||
        p.sku.toLowerCase().includes(needle);
      const inRating = ratingFilter === 'all' || ratingOf('product', String(p.id)) >= Number(ratingFilter);
      return inCat && inSearch && inRating;
    });
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
    else if (sort === 'new') list = [...list].sort((a, b) => (b.last_updated ?? '').localeCompare(a.last_updated ?? ''));
    else if (sort === 'rating') list = [...list].sort((a, b) => ratingOf('product', String(b.id)) - ratingOf('product', String(a.id)));
    return list;
  }, [catalog, search, category, ratingFilter, sort, reviewsTick]);

  const subtotal = cartItems.reduce((s, i) => s + i.product.price * i.quantity, 0);

  const quickAdd = (p: StoreProduct) => {
    if (p.stock_status === 'Tugagan') {
      showToast('Mahsulot vaqtincha tugagan', 'info');
      return;
    }
    addToCart(p, 1);
    vibrate(10);
    showToast(`${p.name} savatga qo'shildi`, 'success');
  };

  const addFromModal = (p: StoreProduct, qty: number) => {
    addToCart(p, qty);
    setSelected(null);
    vibrate(10);
    showToast(`${p.name} savatga qo'shildi`, 'success');
  };

  const openCart = () => setCartOpen(true);
  const startCheckout = () => {
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  const retry = () => {
    setCatalog(null);
    setReloadKey((k) => k + 1);
  };

  const clearFilters = () => {
    setQ('');
    setSearch('');
    setCategory('');
    setRatingFilter('all');
    setSort('default');
  };

  const openProduct = (p: StoreProduct) => setSelected(p);

  const onCardKeyDown = (e: React.KeyboardEvent, p: StoreProduct) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openProduct(p);
    }
  };

  return (
    <div className="store-page dokon-page">
      <header className="store-hero">
        <div>
          <h1 className="store-title">Do&apos;kon</h1>
          <p className="store-subtitle">
            Xo&apos;jalik mollari do&apos;koni — qurilish materiallari: g&apos;isht, sement, qum va
            asbob-uskunalar. Narxlar har kuni yangilanadi.
          </p>
        </div>
        <button type="button" className="btn btn-secondary cart-launch" onClick={openCart}>
          <ShoppingBag className="w-4 h-4" />
          Savat
          {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </button>
      </header>

      {bannerCount !== null && (
        <div className="dokon-banner" role="status">
          <ShoppingBag className="dokon-banner-icon" />
          <span>
            Kalkulyatordan qo&apos;shilgan materiallar — {bannerCount} ta mahsulot savatga qo&apos;shildi
          </span>
          <button
            type="button"
            className="dokon-banner-close"
            aria-label="Yopish"
            onClick={() => setBannerCount(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className="dokon-toolbar">
        <div className="store-search">
          <Search className="store-search-icon" />
          <input
            className="control store-search-input"
            type="search"
            placeholder="Mahsulot qidirish..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Mahsulot qidirish"
          />
        </div>
        <div className="dokon-filters">
          <select
            className="control dokon-select"
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value as RatingFilter)}
            aria-label="Reyting"
          >
            <option value="all">Reyting: barchasi</option>
            <option value="3">3+ yulduz</option>
            <option value="4">4+ yulduz</option>
          </select>
          <select
            className="control dokon-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Saralash"
          >
            <option value="default">Tavsiya etilgan</option>
            <option value="rating">Reyting bo'yicha</option>
            <option value="price-asc">Narx: arzondan qimmatga</option>
            <option value="price-desc">Narx: qimmatdan arzonga</option>
            <option value="new">Eng yangilar</option>
          </select>
        </div>
      </div>

      <div className="store-cats" role="tablist" aria-label="Kategoriyalar">
        <button
          type="button"
          className={`chip${category === '' ? ' chip-active' : ''}`}
          onClick={() => setCategory('')}
        >
          Barchasi
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={`chip${category === c ? ' chip-active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {loadState === 'loading' ? (
        <div className="store-grid store-grid-skeleton" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="store-card skeleton-card" aria-hidden="true" />
          ))}
        </div>
      ) : loadState === 'error' ? (
        <div className="store-empty">
          <Package className="store-empty-icon" />
          <p>Do&apos;kon katalogini yuklab bo&apos;lmadi</p>
          <button type="button" className="btn btn-secondary" onClick={retry}>
            Qayta urinish
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="store-empty">
          <SearchEmpty size={140} />
          <p>Mahsulot topilmadi</p>
          <button type="button" className="btn btn-secondary" onClick={clearFilters}>
            Filtrlarni tozalash
          </button>
        </div>
      ) : (
        <div className="store-grid">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="store-card dokon-card glass-card glass-card--grid"
              role="button"
              tabIndex={0}
              aria-label={`${p.name} — ${formatPrice(p.price)}`}
              onClick={() => openProduct(p)}
              onKeyDown={(e) => onCardKeyDown(e, p)}
            >
              <div className="store-card-img">
                <ProductImage product={p} className="store-card-ph" />
              </div>
              <div className="store-card-body">
                <span className="store-card-cat">{p.category}</span>
                <div className="store-card-rating">
                  <ReviewSummary itemType="product" itemId={String(p.id)} />
                </div>
                <h3 className="store-card-name">{p.name}</h3>
                <div className="store-card-meta">
                  <strong className="store-price">{formatPrice(p.price)}</strong>
                  <span className="store-unit">/ {p.unit}</span>
                </div>
                <div className="store-card-foot">
                  <StockBadge status={p.stock_status} />
                  {p.stock_quantity > 0 && <span className="store-qty">{p.stock_quantity} {p.unit}</span>}
                  <button
                    type="button"
                    className="store-quick-add"
                    aria-label={`${p.name}ni savatga qo'shish`}
                    disabled={p.stock_status === 'Tugagan'}
                    onClick={(e) => {
                      e.stopPropagation();
                      quickAdd(p);
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <ProductModal product={selected} onClose={() => setSelected(null)} onAdd={addFromModal} />
      )}

      <CartDrawer
        open={cartOpen}
        items={cartItems}
        subtotal={subtotal}
        onClose={() => setCartOpen(false)}
        onCheckout={startCheckout}
      />

      <CheckoutModal
        open={checkoutOpen}
        items={cartItems}
        subtotal={subtotal}
        onClose={() => setCheckoutOpen(false)}
      />
    </div>
  );
}
