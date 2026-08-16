import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  Lock,
  LogOut,
  Package,
  PackagePlus,
  PackageX,
  Pencil,
  Percent,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { api, type StoreOrder, type StoreProduct } from '../../api/client';
import { formatPrice, timeAgo } from '../../lib/store';
import { StockBadge } from '../../components/store/StockBadge';
import ImageUploader from '../../components/admin/ImageUploader';

interface Owner {
  id: number;
  username: string;
  name: string;
}

interface ProductForm {
  id?: number;
  name: string;
  category: string;
  unit: string;
  price: string;
  stock_quantity: string;
  sku: string;
  description: string;
}

const EMPTY_FORM: ProductForm = { name: '', category: '', unit: 'dona', price: '', stock_quantity: '', sku: '', description: '' };

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

function AdminLogin({ onSuccess }: { onSuccess: (owner: Owner) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const owner = await api.storeLogin(username, password);
      onSuccess(owner);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login xato');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-login-wrap">
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <span className="admin-login-logo">
            <Store className="w-6 h-6" />
          </span>
          <div>
            <h1>Do'kon boshqaruvi</h1>
            <p>Xo'jalik mollari do'koni — egasi paneli</p>
          </div>
        </div>

        <form className="admin-login" onSubmit={submit}>
          <label className="field admin-field">
            <span>Login</span>
            <div className="admin-input-wrap">
              <User />
              <input
                className="control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                placeholder="Egası logini"
              />
            </div>
          </label>
          <label className="field admin-field">
            <span>Parol</span>
            <div className="admin-input-wrap">
              <Lock />
              <input
                className="control"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </label>
          {error && <p className="store-order-error">{error}</p>}
          <button type="submit" className="btn btn-primary admin-login-btn" disabled={busy || !username || !password}>
            {busy ? 'Kirilmoqda...' : 'Kirish'}
          </button>
        </form>

        <div className="admin-login-feats">
          <span><Boxes className="w-4 h-4" /> Mahsulotlar</span>
          <span><ClipboardList className="w-4 h-4" /> Buyurtmalar</span>
          <span><Percent className="w-4 h-4" /> Ommaviy narx</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard tab
// ---------------------------------------------------------------------------

function DashboardView() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.adminDashboard>> | null>(null);

  useEffect(() => {
    api.adminDashboard().then(setData).catch(() => setData(null));
  }, []);

  if (!data) return <div className="store-empty"><p>Ma'lumot yuklanmoqda...</p></div>;

  const t = data.totals;
  const stats = [
    { label: 'Jami mahsulot', value: t.total, icon: Boxes, tone: 'blue' },
    { label: 'Mavjud', value: t.in_stock, icon: Package, tone: 'green' },
    { label: 'Kam qoldi', value: t.low_stock, icon: AlertTriangle, tone: 'amber', danger: t.low_stock > 0 },
    { label: 'Tugagan', value: t.out_of_stock, icon: PackageX, tone: 'red', danger: t.out_of_stock > 0 },
    { label: 'Buyurtmalar', value: t.orders, icon: ShoppingBag, tone: 'purple' },
  ];

  return (
    <div className="admin-view">
      <div className="admin-view-head">
        <p className="admin-kicker">Do'kon paneli</p>
        <h2 className="admin-view-title">Umumiy holat</h2>
      </div>

      <div className="admin-stats">
        {stats.map((s) => (
          <div key={s.label} className={`admin-stat${s.danger ? ' admin-stat-danger' : ''}`}>
            <span className={`stat-icon tone-${s.tone}`}>
              <s.icon />
            </span>
            <div className="stat-body">
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-cols">
        <div className="admin-col">
          <div className="admin-col-head">
            <h3 className="admin-col-title">
              <AlertTriangle />
              Kam qolgan mahsulotlar
            </h3>
            <span className="admin-col-note">≤ {data.low_stock_threshold}</span>
          </div>
          {data.low_stock.length === 0 ? (
            <p className="admin-muted">Hammasi yaxshi — kam qolgan mahsulot yo'q.</p>
          ) : (
            <div className="admin-low-list">
              {data.low_stock.map((p) => (
                <Link key={p.id} to="/boshqaruv/mahsulotlar" className="admin-low-item">
                  <span className="list-ico tone-amber">
                    <AlertTriangle />
                  </span>
                  <span className="admin-low-name">{p.name}</span>
                  <span className="admin-low-qty">{p.stock_quantity} dona</span>
                  <StockBadge status={p.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="admin-col">
          <div className="admin-col-head">
            <h3 className="admin-col-title">
              <Clock3 />
              Oxirgi yangilanganlar
            </h3>
          </div>
          <div className="admin-recent">
            {data.recent.map((p) => (
              <Link key={p.id} to="/boshqaruv/mahsulotlar" className="admin-recent-item">
                <span className="list-ico tone-blue">
                  <Clock3 />
                </span>
                <span className="admin-recent-name">{p.name}</span>
                <span className="admin-recent-price">{formatPrice(p.price)}</span>
                <span className="admin-recent-time">{timeAgo(p.last_updated)}</span>
              </Link>
            ))}
          </div>
          <Link to="/boshqaruv/mahsulotlar" className="admin-col-foot">
            Barcha mahsulotlar
            <ArrowRight />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product form modal (add / edit)
// ---------------------------------------------------------------------------

function ProductModal({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: StoreProduct | null;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProductForm>(() =>
    product
      ? {
          id: product.id,
          name: product.name,
          category: product.category,
          unit: product.unit,
          price: String(product.price),
          stock_quantity: String(product.stock_quantity),
          sku: product.sku,
          description: product.description,
        }
      : EMPTY_FORM,
  );
  const [images, setImages] = useState<string[]>(() => product?.images ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!form.name.trim()) {
      setError('Nomi kiritilishi shart');
      return;
    }
    setError('');
    setBusy(true);
    const fd = new FormData();
    fd.set('name', form.name);
    fd.set('category', form.category || 'Boshqa');
    fd.set('unit', form.unit || 'dona');
    fd.set('price', form.price || '0');
    fd.set('stock_quantity', form.stock_quantity || '0');
    fd.set('sku', form.sku);
    fd.set('description', form.description);
    try {
      if (product) await api.adminUpdateProduct(product.id, fd);
      else await api.adminCreateProduct(fd);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saqlashda xato');
    } finally {
      setBusy(false);
    }
  };

  const set = (key: keyof ProductForm, value: string) => setForm({ ...form, [key]: value });

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Mahsulot formasi">
      <div className="admin-modal">
        <div className="admin-modal-head">
          <div className="modal-title">
            <span className="modal-icon tone-blue">
              <Package />
            </span>
            <div>
              <h2>{product ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}</h2>
              <p>{product ? product.name : "Do'konga yangi mahsulot qo'shish"}</p>
            </div>
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Yopish">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="admin-modal-body">
          <p className="admin-section-label">Asosiy ma'lumotlar</p>
          <div className="admin-form-grid">
            <label className="field">
              <span>Nomi *</span>
              <input className="control" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <label className="field">
              <span>Kategoriya</span>
              <input
                className="control"
                list="store-category-list"
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                placeholder="Masalan: G'isht"
              />
              <datalist id="store-category-list">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span>O'lchov birligi</span>
              <input className="control" list="store-unit-list" value={form.unit} onChange={(e) => set('unit', e.target.value)} />
              <datalist id="store-unit-list">
                {['dona', 'qop', 'm³', 'kg', 'tonna', 'rulon', 'litr'].map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span>Narx (so'm)</span>
              <input className="control" type="number" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} />
            </label>
            <label className="field">
              <span>Ombordagi soni</span>
              <input className="control" type="number" min="0" value={form.stock_quantity} onChange={(e) => set('stock_quantity', e.target.value)} />
            </label>
            <label className="field">
              <span>SKU / shtrix-kod</span>
              <input className="control" value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="Ixtiyoriy" />
            </label>
          </div>

          <label className="field">
            <span>Tavsif</span>
            <textarea className="control" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </label>

          <p className="admin-section-label">Rasmlar</p>
          {product ? (
            <ImageUploader
              images={images}
              onChange={setImages}
              onUpload={(files, onProgress) =>
                api.adminUploadProductImages(product.id, files, onProgress).then((r) => r.images)
              }
              onPersist={(list) => api.adminReorderProductImages(product.id, list).then(() => undefined)}
            />
          ) : (
            <p className="admin-img-hint">Mahsulotni saqlagach, rasmlarni qo‘shishingiz mumkin.</p>
          )}

          {error && <p className="store-order-error">{error}</p>}
        </div>

        <div className="admin-modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Bekor qilish
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
            {busy ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Products tab
// ---------------------------------------------------------------------------

function ProductsView() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [modal, setModal] = useState<{ open: boolean; product: StoreProduct | null }>({ open: false, product: null });
  const [stockDraft, setStockDraft] = useState<Record<number, string>>({});
  const [deleting, setDeleting] = useState<number | null>(null);
  const debounceRef = useRef<number>(0);

  const load = useCallback(() => {
    api.adminProducts({ search: search || undefined, category: category || undefined }).then(setProducts).catch(() => setProducts([]));
  }, [search, category]);

  useEffect(() => {
    api.adminCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(load, 300);
    return () => window.clearTimeout(debounceRef.current);
  }, [search, category, load]);

  const saveStock = (p: StoreProduct) => {
    const raw = stockDraft[p.id];
    if (raw === undefined) return;
    const qty = Number(raw);
    if (Number.isNaN(qty) || qty < 0) return;
    void api.adminStockBulk([{ id: p.id, quantity: Math.round(qty) }]).then(() => load());
  };

  const remove = async (p: StoreProduct) => {
    if (!window.confirm(`"${p.name}" mahsulotini o'chirasizmi?`)) return;
    setDeleting(p.id);
    try {
      await api.adminDeleteProduct(p.id);
      load();
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="admin-view">
      <div className="admin-view-head">
        <p className="admin-kicker">Katalog</p>
        <h2 className="admin-view-title">Mahsulotlar</h2>
      </div>

      <div className="admin-toolbar">
        <div className="admin-toolbar-left">
          <div className="admin-search">
            <Search className="admin-search-icon" />
            <input className="control admin-search-input" placeholder="Qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="admin-cats" role="group" aria-label="Kategoriya filtri">
            <button
              type="button"
              className={`admin-chip${category === '' ? ' is-active' : ''}`}
              onClick={() => setCategory('')}
            >
              Barchasi
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className={`admin-chip${category === c ? ' is-active' : ''}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-primary admin-add-btn" onClick={() => setModal({ open: true, product: null })}>
          <PackagePlus className="w-4 h-4" />
          Yangi mahsulot
        </button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Mahsulot</th>
              <th>Kategoriya</th>
              <th>Birlik</th>
              <th>Narx</th>
              <th>Omborda</th>
              <th>Holat</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="admin-cell-name">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="admin-cell-img" />
                    ) : (
                      <div className="admin-cell-ph">
                        <Package />
                      </div>
                    )}
                    <div>
                      <div className="admin-cell-title">{p.name}</div>
                      {p.sku && <div className="admin-cell-sku">#{p.sku}</div>}
                    </div>
                  </div>
                </td>
                <td><span className="admin-chip admin-chip-muted">{p.category}</span></td>
                <td><span className="admin-unit">{p.unit}</span></td>
                <td className="admin-cell-price">{formatPrice(p.price)}</td>
                <td>
                  <input
                    className="admin-stock-input"
                    type="number"
                    min="0"
                    value={stockDraft[p.id] ?? String(p.stock_quantity)}
                    onChange={(e) => setStockDraft({ ...stockDraft, [p.id]: e.target.value })}
                    onBlur={() => saveStock(p)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    aria-label={`${p.name} — ombordagi soni`}
                  />
                </td>
                <td><StockBadge status={p.stock_status} /></td>
                <td>
                  <div className="admin-row-actions">
                    <button type="button" className="admin-icon-btn" title="Tahrirlash" onClick={() => setModal({ open: true, product: p })}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" className="admin-icon-btn admin-icon-danger" title="O'chirish" disabled={deleting === p.id} onClick={() => void remove(p)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="admin-table-empty">Mahsulot topilmadi</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal.open && (
        <ProductModal product={modal.product} categories={categories} onClose={() => setModal({ open: false, product: null })} onSaved={load} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk price tab
// ---------------------------------------------------------------------------

function BulkPriceView() {
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('all');
  const [percent, setPercent] = useState('5');
  const [result, setResult] = useState<{ updated: number; category: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.adminCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const apply = async () => {
    const value = Number(percent);
    if (Number.isNaN(value) || value === 0) return;
    setBusy(true);
    try {
      const res = await api.adminPriceBulk(category, value);
      setResult({ updated: res.updated, category: category === 'all' ? 'Barcha kategoriyalar' : category });
    } catch {
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-view admin-view-narrow">
      <div className="admin-view-head">
        <p className="admin-kicker">Narxlar</p>
        <h2 className="admin-view-title">Narxlarni ommaviy o'zgartirish</h2>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <span className="modal-icon tone-amber">
            <Percent />
          </span>
          <div>
            <h2>Ommaviy o'zgartirish</h2>
            <p>Kategoriya bo'yicha barcha narxlarni foizga oshiring yoki kamaytiring (manfiy foiz ham mumkin).</p>
          </div>
        </div>

        <div className="admin-bulk-form">
          <label className="field">
            <span>Kategoriya</span>
            <select className="control" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">Barcha mahsulotlar</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Foiz</span>
            <div className="admin-percent-wrap">
              <input className="control" type="number" step="0.5" value={percent} onChange={(e) => setPercent(e.target.value)} />
              <span className="admin-percent-suffix">%</span>
            </div>
            <p className="admin-muted">Masalan: 5 = 5% oshirish, -5 = 5% kamaytirish</p>
          </label>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => void apply()} disabled={busy}>
            {percent.startsWith('-') ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
            {busy ? "Qo'llanmoqda..." : "Qo'llash"}
          </button>
        </div>
      </div>

      {result && (
        <div className="admin-bulk-result">
          <CheckCircle2 className="w-4 h-4" />
          <span>
            {result.updated} ta mahsulot narxi yangilandi ({result.category}, {percent}%)
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders tab
// ---------------------------------------------------------------------------

function OrdersView() {
  const [orders, setOrders] = useState<StoreOrder[]>([]);

  useEffect(() => {
    api.adminOrders().then(setOrders).catch(() => setOrders([]));
  }, []);

  return (
    <div className="admin-view">
      <div className="admin-view-head">
        <p className="admin-kicker">Xaridorlar</p>
        <h2 className="admin-view-title">Buyurtmalar</h2>
      </div>
      {orders.length === 0 ? (
        <p className="admin-muted">Hozircha buyurtmalar yo'q.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mahsulot</th>
                <th>Miqdor</th>
                <th>Mijoz</th>
                <th>Telefon</th>
                <th>Izoh</th>
                <th>Vaqt</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <span className="admin-order-product">
                      <span className="order-ico tone-purple">
                        <ShoppingBag />
                      </span>
                      {o.product}
                    </span>
                  </td>
                  <td><span className="admin-qty-pill">{o.quantity}</span></td>
                  <td>{o.customer_name || '—'}</td>
                  <td><a href={`tel:${o.phone}`}>{o.phone}</a></td>
                  <td className="admin-cell-note">{o.note || '—'}</td>
                  <td>{timeAgo(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export function AdminPage() {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [checked, setChecked] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api
      .storeStatus()
      .then((s) => setOwner(s.authenticated && s.owner ? s.owner : null))
      .catch(() => setOwner(null))
      .finally(() => setChecked(true));
  }, []);

  const logout = async () => {
    await api.storeLogout().catch(() => undefined);
    setOwner(null);
  };

  if (!checked) return <div className="store-empty"><p>Yuklanmoqda...</p></div>;

  if (!owner) return <AdminLogin onSuccess={setOwner} />;

  const active = location.pathname.startsWith('/boshqaruv/mahsulotlar')
    ? 'products'
    : location.pathname.startsWith('/boshqaruv/narxlar')
      ? 'prices'
      : location.pathname.startsWith('/boshqaruv/buyurtmalar')
        ? 'orders'
        : 'dashboard';

  const tabs = [
    { key: 'dashboard', label: 'Panel', to: '/boshqaruv', icon: LayoutDashboard },
    { key: 'products', label: 'Mahsulotlar', to: '/boshqaruv/mahsulotlar', icon: Package },
    { key: 'prices', label: 'Narxlar', to: '/boshqaruv/narxlar', icon: Percent },
    { key: 'orders', label: 'Buyurtmalar', to: '/boshqaruv/buyurtmalar', icon: ClipboardList },
  ];

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="admin-brand">
          <span className="admin-logo">
            <Store className="w-5 h-5" />
          </span>
          <div>
            <div className="admin-brand-name">Do'kon paneli</div>
            <div className="admin-brand-sub">Xo'jalik mollari</div>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Panel bo'limlari">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              to={tab.to}
              className={`admin-nav-item${active === tab.key ? ' is-active' : ''}`}
            >
              <span className="nav-icon">
                <tab.icon />
              </span>
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="admin-side-foot">
          <div className="admin-owner">
            <span className="owner-avatar">{(owner.name || owner.username).charAt(0).toUpperCase()}</span>
            <div className="owner-meta">
              <div className="owner-name">{owner.name}</div>
              <div className="owner-role">Do'kon egasi</div>
            </div>
          </div>
          <button type="button" className="admin-logout" onClick={() => void logout()}>
            <LogOut className="w-4 h-4" />
            Chiqish
          </button>
          <Link to="/api-docs" className="admin-api-link">API hujjatlari</Link>
        </div>
      </aside>

      <main className="admin-main">
        {active === 'dashboard' && <DashboardView />}
        {active === 'products' && <ProductsView />}
        {active === 'prices' && <BulkPriceView />}
        {active === 'orders' && <OrdersView />}
      </main>
    </div>
  );
}
