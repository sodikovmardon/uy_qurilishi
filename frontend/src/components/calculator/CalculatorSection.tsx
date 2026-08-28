import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ExternalLink, RefreshCw, Settings2, ShoppingBag, Store, Trash2 } from 'lucide-react';
import { BRICK_TYPES, DEFAULT_INPUTS, DEFAULT_MATERIAL_PRICES, getDefaultBrickPrice, WALL_THICKNESS } from '../../config/prices';
import { REGIONS } from '../../config/regions';
import { useGlassTrack } from '../../hooks/useGlassTrack';
import {
  calculateMaterials,
  formatUZS,
  getBrickType,
  getRegion,
  validateInputs,
} from '../../lib/calculator';
import {
  applyStorePricing,
  catalogUpdatedAt,
  DEFAULT_STORE_SOURCE,
  fetchStoreCatalog,
  type StorePricedRow,
  type StorePricing,
} from '../../lib/storeApi';
import { timeAgo } from '../../lib/store';
import type { StoreProduct } from '../../api/client';
import { StockBadge } from '../store/StockBadge';
import {
  clearCalcDraft,
  clearHistory,
  deleteCalculation,
  getCalcDraft,
  getDefaultRegion,
  getHistory,
  getMaterialPrices,
  getSavedPlot,
  resetMaterialPrices,
  saveCalcDraft,
  saveCalculation,
  saveMaterialPrices,
  type SavedCalculation,
} from '../../lib/storage';
import { downloadSmeta, type SmetaDoc } from '../../lib/pdf';
import { addManyToCart } from '../../lib/cart';
import { trackEvent } from '../../lib/analytics';
import { t } from '../../lib/i18n';
import { calcBuildable, formatPlot } from '../../lib/plotMatcher';
import { vibrate } from '../../lib/haptics';
import { runWithProgress } from '../../lib/progress';
import { useApp } from '../../context/AppContext';
import { useCompareSelection } from '../../hooks/useCompareSelection';
import { useDebouncedEffect } from '../../hooks/useDebounced';
import { buildSavedCalcComparison, type ComparisonData } from '../../lib/compare';
import Button from '../ui/Button';
import Skeleton from '../ui/Skeleton';
import ComparisonModal from '../comparison/ComparisonModal';
import { AnimatedValue } from '../ui/AnimatedValue';
import { HistoryEmpty } from '../ui/EmptyIllustration';
import StagesSection from './StagesSection';
import BudgetPlanner from './BudgetPlanner';
import TransparencyPanel from './TransparencyPanel';
import LoanCalculator from './LoanCalculator';
import RegionComparison from './RegionComparison';
import PriceHistoryChart from './PriceHistoryChart';
import OrientationAdvisor from '../projects/OrientationAdvisor';
import type { OrientationId } from '../../lib/orientation';

/** Blocks "-", "+" and exponent chars so numeric inputs reject them as typed. */
function rejectInvalidKey(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') e.preventDefault();
}

export default function CalculatorSection() {
  const { showToast } = useApp();
  const navigate = useNavigate();
  const compare = useCompareSelection(2);

  const trackBricksRef = useGlassTrack<HTMLDivElement>();
  const trackCementRef = useGlassTrack<HTMLDivElement>();
  const trackSandRef = useGlassTrack<HTMLDivElement>();

  const [wallLength, setWallLength] = useState(DEFAULT_INPUTS.wallLength);
  const [wallHeight, setWallHeight] = useState(DEFAULT_INPUTS.wallHeight);
  const [thickness, setThickness] = useState(DEFAULT_INPUTS.thickness);
  const [brickId, setBrickId] = useState(DEFAULT_INPUTS.brickId);
  const [rooms, setRooms] = useState(DEFAULT_INPUTS.rooms);
  const [region, setRegion] = useState(() => getDefaultRegion());
  const [history, setHistory] = useState<SavedCalculation[]>(() => getHistory());
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null);
  const [mobileOpen, setMobileOpen] = useState(true);
  const [orientation, setOrientation] = useState<OrientationId | null>(null);

  // ---- live store pricing (partner hardware store) ----
  const [storeCatalog, setStoreCatalog] = useState<StoreProduct[] | null>(null);
  const [storeState, setStoreState] = useState<'loading' | 'ready' | 'error'>('loading');

  const compareData = useMemo<ComparisonData | null>(() => {
    if (!compareIds) return null;
    const a = history.find((h) => h.id === compareIds[0]);
    const b = history.find((h) => h.id === compareIds[1]);
    if (!a || !b) return null;
    return buildSavedCalcComparison(a, b);
  }, [compareIds, history]);

  const compareAlternatives = useMemo(
    () =>
      compareIds
        ? history
            .filter((h) => !compareIds.includes(h.id))
            .map((h) => ({
              id: h.id,
              title: `${h.wallLength}×${h.wallHeight} m · ${h.rooms} xona · ${formatUZS(h.total)}`,
            }))
        : [],
    [compareIds, history],
  );

  // ---- custom prices (Phase 9) ----
  const storedPrices = useMemo(() => getMaterialPrices(), []);
  const [prices, setPrices] = useState({
    brick: String(storedPrices.brick ?? getDefaultBrickPrice(DEFAULT_INPUTS.brickId)),
    cement: String(storedPrices.cement ?? DEFAULT_MATERIAL_PRICES.cement),
    sand: String(storedPrices.sand ?? DEFAULT_MATERIAL_PRICES.sand),
  });
  const [pricesOpen, setPricesOpen] = useState(false);
  const brickPriceTouched = useRef(Boolean(storedPrices.brick));
  const pricePersistBlock = useRef(false);

  // ---- draft restore banner ----
  const [draftBanner, setDraftBanner] = useState(false);

  // ---- saved-plot suggestion banner (Yer uchastkasi matcher) ----
  const plotSuggestion = useMemo(() => {
    const plot = getSavedPlot();
    if (!plot) return null;
    return calcBuildable({
      areaM2: plot.areaM2,
      width: plot.width,
      length: plot.length,
      coveragePct: plot.coveragePct,
      setbackM: plot.setbackM,
    });
  }, []);
  const [plotBanner, setPlotBanner] = useState(Boolean(plotSuggestion));

  const applyPlotSize = () => {
    if (!plotSuggestion) return;
    const side = Math.sqrt(Math.max(plotSuggestion.footprintM2, 1));
    setWallLength(Math.round(side * 2) / 2);
    setPlotBanner(false);
    showToast(`Uchastkangizga mos o’lcham qo’llandi (${Math.round(side)} m)`, 'success');
  };

  const parsedPrices = useMemo(
    () => ({ brick: Number(prices.brick), cement: Number(prices.cement), sand: Number(prices.sand) }),
    [prices],
  );
  const priceErrors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!(parsedPrices.brick > 0)) e.brick = 'G’isht narxi 0 dan katta bo’lishi kerak';
    if (!(parsedPrices.cement > 0)) e.cement = 'Sement narxi 0 dan katta bo’lishi kerak';
    if (!(parsedPrices.sand > 0)) e.sand = 'Qum narxi 0 dan katta bo’lishi kerak';
    return e;
  }, [parsedPrices]);

  const inputs = { wallLength, wallHeight, thickness, brickId, rooms, region };
  const errors = useMemo(() => validateInputs(inputs), [wallLength, wallHeight, rooms]);
  const result = useMemo(() => {
    if (Object.keys(errors).length > 0) return null;
    return calculateMaterials(inputs, {
      brickPrice: parsedPrices.brick,
      cementBagPrice: parsedPrices.cement,
      sandPrice: parsedPrices.sand,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallLength, wallHeight, thickness, brickId, rooms, region, parsedPrices, errors]);

  // ---- deep-link: `/kalkulyator?byudjet=1` scrolls to the budget planner ----
  const location = useLocation();
  const budgetScrolledRef = useRef(false);
  useEffect(() => {
    const wantBudget = new URLSearchParams(location.search).get('byudjet') === '1';
    if (!wantBudget || budgetScrolledRef.current) return;
    if (!result) return;
    budgetScrolledRef.current = true;
    window.setTimeout(() => {
      document.getElementById('budget-planner')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }, [result, location.search]);

  // ---- live store catalog (cached ~3 min by storeApi) ----
  useEffect(() => {
    let cancelled = false;
    setStoreState('loading');
    fetchStoreCatalog(DEFAULT_STORE_SOURCE)
      .then((catalog) => {
        if (cancelled) return;
        setStoreCatalog(catalog);
        setStoreState(catalog ? 'ready' : 'error');
      })
      .catch(() => {
        if (!cancelled) setStoreState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const storePricing = useMemo<StorePricing>(() => {
    if (!result) return { rows: [], total: 0, estimatedCount: 0 };
    return applyStorePricing(result, storeCatalog, brickId);
  }, [result, storeCatalog, brickId]);

  const liveTotal = storePricing?.total ?? result?.total ?? 0;

  const storeOrderItems = useMemo(() => {
    if (!storePricing) return [];
    return storePricing.rows
      .filter((r): r is StorePricedRow & { store: StoreProduct } => r.isStorePrice && Boolean(r.store))
      .map((r) => ({
        product_id: r.store.id,
        quantity: Math.max(1, Math.ceil(r.quantity)),
        name: r.store.name,
        unit: r.unit,
      }));
  }, [storePricing]);

  const updatedNote = useMemo(() => {
    if (!storeCatalog) return null;
    const ts = catalogUpdatedAt(storeCatalog);
    return ts ? timeAgo(ts) : null;
  }, [storeCatalog]);

  const handleOrderAll = () => {
    if (!storePricing) return;
    const entries = storePricing.rows
      .filter((r): r is StorePricedRow & { store: StoreProduct } => r.isStorePrice && Boolean(r.store))
      .map((r) => ({
        product: r.store,
        quantity: Math.max(1, Math.ceil(r.quantity)),
      }));
    if (!entries.length) return;
    addManyToCart(entries);
    vibrate(10);
    showToast(`Savatga ${entries.length} ta material qo'shildi`, 'success');
    trackEvent('calc_store_inquiry', { items: entries.length });
    navigate('/dokon', { state: { fromCalculator: entries.length } });
  };

  // ---- restore in-progress draft on mount ----
  useEffect(() => {
    const draft = getCalcDraft();
    if (draft) {
      setWallLength(draft.wallLength);
      setWallHeight(draft.wallHeight);
      setThickness(draft.thickness);
      setBrickId(draft.brickId);
      setRooms(draft.rooms);
      setRegion(draft.region);
      clearCalcDraft();
      setDraftBanner(true);
      showToast(t('calc.draftRestored'), 'info');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- auto-save draft (debounced 500ms) ----
  useDebouncedEffect(
    JSON.stringify({ wallLength, wallHeight, thickness, brickId, rooms, region }),
    500,
    () => saveCalcDraft({ wallLength, wallHeight, thickness, brickId, rooms, region }),
  );

  // ---- persist custom prices (debounced 500ms); only valid values ----
  useDebouncedEffect(prices, 500, () => {
    if (pricePersistBlock.current) return;
    const defBrick = getDefaultBrickPrice(brickId);
    const toSave = {
      brick: parsedPrices.brick > 0 && parsedPrices.brick !== defBrick ? parsedPrices.brick : undefined,
      cement: parsedPrices.cement > 0 ? parsedPrices.cement : undefined,
      sand: parsedPrices.sand > 0 ? parsedPrices.sand : undefined,
    };
    if (toSave.brick || toSave.cement || toSave.sand) saveMaterialPrices(toSave);
    else resetMaterialPrices();
    showToast(t('calc.pricesUpdated'));
  });

  const resetAll = () => {
    setWallLength(DEFAULT_INPUTS.wallLength);
    setWallHeight(DEFAULT_INPUTS.wallHeight);
    setThickness(DEFAULT_INPUTS.thickness);
    setBrickId(DEFAULT_INPUTS.brickId);
    setRooms(DEFAULT_INPUTS.rooms);
    setRegion(DEFAULT_INPUTS.region);
  };

  const dismissDraftStartFresh = () => {
    clearCalcDraft();
    resetAll();
    setDraftBanner(false);
  };

  const dismissDraftKeep = () => {
    clearCalcDraft();
    setDraftBanner(false);
  };

  const handleBrickChange = (id: string) => {
    setBrickId(id);
    if (!brickPriceTouched.current) {
      setPrices((p) => ({ ...p, brick: String(getDefaultBrickPrice(id)) }));
    }
  };

  const handleResetPrices = () => {
    pricePersistBlock.current = true;
    brickPriceTouched.current = false;
    setPrices({
      brick: String(getDefaultBrickPrice(brickId)),
      cement: String(DEFAULT_MATERIAL_PRICES.cement),
      sand: String(DEFAULT_MATERIAL_PRICES.sand),
    });
    resetMaterialPrices();
    showToast('Standart narxlarga qaytarildi');
    window.setTimeout(() => {
      pricePersistBlock.current = false;
    }, 600);
  };

  /** RegionComparison → applies a region's prices to the active calculation. */
  const applyRegionPrices = ({ brick, cement, sand }: { brick: number; cement: number; sand: number }) => {
    brickPriceTouched.current = true;
    setPrices({ brick: String(brick), cement: String(cement), sand: String(sand) });
    setPricesOpen(true);
  };

  const handleSave = () => {
    if (!result) return;
    const next = saveCalculation({
      wallLength, wallHeight, thickness, brickId, rooms, region,
      bricks: result.bricks, cementBags: result.cementBags, sandM3: result.sandM3, total: storePricing.total,
    });
    setHistory(next);
    trackEvent('calc_submit', { brickId, region });
    vibrate(10);
    showToast(t('calc.saved'));
  };

  const handlePdf = async () => {
    if (!result) return;
    const brick = getBrickType(brickId);
    const reg = getRegion(region);
    const doc: SmetaDoc = {
      id: `HIS-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      date: new Date().toLocaleDateString('uz-UZ'),
      inputs: [
        `Devor uzunligi: ${wallLength} m · Balandligi: ${wallHeight} m · Qalinligi: ${thickness} sm`,
        `G’isht: ${brick.label} · Xonalar: ${rooms} · Hudud: ${reg.name}`,
      ],
      rows: storePricing.rows.map((r) => ({
        material: r.material,
        quantity: `${r.quantity} ${r.unit}`,
        unitPrice: formatUZS(r.unitPrice),
        subtotal: formatUZS(r.subtotal),
      })),
      total: formatUZS(storePricing.total),
    };
    showToast(t('calc.pdfLoading'), 'info', 1200);
    try {
      await runWithProgress(() => downloadSmeta(doc));
      trackEvent('calc_pdf');
      vibrate(10);
      showToast(t('calc.pdfReady'));
    } catch {
      showToast(t('calc.pdfError'), 'error');
    }
  };

  const openCompare = () => {
    if (compare.selected.length !== 2) return;
    const [a, b] = compare.selected.map((id) => history.find((h) => h.id === id));
    if (a && b) setCompareIds([a.id, b.id]);
  };

  const handleSwap = (index: number, id: string) => {
    setCompareIds((prev) => {
      if (!prev) return prev;
      const next: [string, string] = [prev[0], prev[1]];
      next[index] = id;
      return next;
    });
  };

  const selectedCalcs = compare.selected.map((id) => history.find((h) => h.id === id)).filter(Boolean);

  const priceFields: { key: 'brick' | 'cement' | 'sand'; label: string }[] = [
    { key: 'brick', label: t('calc.pricesBrick') },
    { key: 'cement', label: t('calc.pricesCement') },
    { key: 'sand', label: t('calc.pricesSand') },
  ];

  return (
    <section id="calc" className="container" aria-labelledby="calc-title">
      <div className="section-head">
        <h2 id="calc-title">{t('calc.title')}</h2>
        <p>{t('calc.subtitle')}</p>
      </div>

      {draftBanner && (
        <div className="draft-banner" role="status">
          <span>{t('calc.draftRestored')}</span>
          <button className="btn btn-secondary btn-sm" onClick={dismissDraftStartFresh}>
            {t('calc.draftDismiss')}
          </button>
          <button className="modal-close" aria-label="Yopish" onClick={dismissDraftKeep}>
            ×
          </button>
        </div>
      )}

      {plotBanner && plotSuggestion && (
        <div className="draft-banner" role="status">
          <span>
            Mening uchastkam: {formatPlot(plotSuggestion.areaM2)} — qurilish uchun mos maydon taxminan{' '}
            {Math.round(plotSuggestion.footprintM2)} m². Shu asosda o’lchamni qo’llaysizmi?
          </span>
          <button className="btn btn-primary btn-sm" onClick={applyPlotSize}>
            Qo’llash
          </button>
          <button className="modal-close" aria-label="Yopish" onClick={() => setPlotBanner(false)}>
            ×
          </button>
        </div>
      )}

      <div className="calc-layout">
        <div className="card-surface calc-card" style={{ padding: 24 }}>
          <h3 className="step-title">{t('calc.step1')}</h3>

          <div className="field">
            <label htmlFor="wallLength">
              {t('calc.wallLength')} <span className="required-mark" aria-hidden="true">*</span>
            </label>
            <input
              id="wallLength"
              className="control"
              type="number"
              min="0.5"
              max="500"
              step="0.5"
              required
              value={wallLength}
              onKeyDown={rejectInvalidKey}
              onChange={(e) => setWallLength(Number(e.target.value))}
            />
            {errors.wallLength && <span className="error-text">{errors.wallLength}</span>}
          </div>

          <div className="field">
            <label htmlFor="wallHeight">
              {t('calc.wallHeight')} <span className="required-mark" aria-hidden="true">*</span>
            </label>
            <input
              id="wallHeight"
              className="control"
              type="number"
              min="0.5"
              max="20"
              step="0.1"
              required
              value={wallHeight}
              onKeyDown={rejectInvalidKey}
              onChange={(e) => setWallHeight(Number(e.target.value))}
            />
            {errors.wallHeight && <span className="error-text">{errors.wallHeight}</span>}
          </div>

          <div className="field">
            <label htmlFor="thickness">{t('calc.thickness')}</label>
            <select id="thickness" className="control" value={thickness} onChange={(e) => setThickness(Number(e.target.value))}>
              {WALL_THICKNESS.map((tw) => (
                <option key={tw.value} value={tw.value}>{tw.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="brick">{t('calc.brick')}</label>
            <select id="brick" className="control" value={brickId} onChange={(e) => handleBrickChange(e.target.value)}>
              {BRICK_TYPES.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </div>

          <div className="calc-row-2">
            <div className="field">
              <label htmlFor="rooms">
                {t('calc.rooms')} <span className="required-mark" aria-hidden="true">*</span>
              </label>
              <input
                id="rooms"
                className="control"
                type="number"
                min="1"
                max="50"
                required
                value={rooms}
                onKeyDown={rejectInvalidKey}
                onChange={(e) => setRooms(Number(e.target.value))}
              />
              {errors.rooms && <span className="error-text">{errors.rooms}</span>}
            </div>
            <div className="field">
              <label htmlFor="region">{t('calc.region')}</label>
              <select id="region" className="control" value={region} onChange={(e) => setRegion(e.target.value)}>
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ---- Price settings (Phase 9) ---- */}
          <div className="price-panel">
            <button
              type="button"
              className="price-panel-toggle"
              aria-expanded={pricesOpen}
              aria-controls="price-panel-body"
              onClick={() => setPricesOpen((v) => !v)}
            >
              <Settings2 className="w-4 h-4" />
              {t('calc.pricesTitle')}
              <ChevronDown className={`w-4 h-4 chevron${pricesOpen ? ' open' : ''}`} />
            </button>

            {pricesOpen && (
              <div id="price-panel-body" className="price-panel-body">
                {priceFields.map(({ key, label }) => (
                  <div className="field" key={key}>
                    <label htmlFor={`price-${key}`}>
                      {label} <span className="required-mark" aria-hidden="true">*</span>
                    </label>
                    <div className="price-input">
                      <input
                        id={`price-${key}`}
                        className="control"
                        type="number"
                        min="1"
                        required
                        value={prices[key]}
                        onKeyDown={rejectInvalidKey}
                        onChange={(e) => {
                          if (key === 'brick') brickPriceTouched.current = true;
                          setPrices((p) => ({ ...p, [key]: e.target.value }));
                        }}
                      />
                      <span className="price-unit">UZS</span>
                    </div>
                    {priceErrors[key] && <span className="error-text">{priceErrors[key]}</span>}
                  </div>
                ))}
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleResetPrices}>
                  {t('calc.pricesReset')}
                </button>
              </div>
            )}
          </div>

          {/* ---- Market modules: price history + regional comparison ---- */}
          <div className="market-modules">
            <PriceHistoryChart />
            <RegionComparison brickId={brickId} currentRegion={region} onApplyPrices={applyRegionPrices} />
          </div>

          <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
            Natijalar o’zgarishlar bilan birga real vaqtda yangilanadi.
          </p>
        </div>

        <div className={`calc-results${mobileOpen ? '' : ' is-collapsed'}`}>
          <button
            type="button"
            className="calc-mobile-toggle"
            aria-expanded={mobileOpen}
            aria-controls="calc-result-wrap"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? 'Natijani yashirish' : 'Natijani ko’rish'}
            <ChevronDown className={`w-4 h-4 chevron${mobileOpen ? ' open' : ''}`} />
          </button>

          <div id="calc-result-wrap" className="calc-result-wrap">
            {!result ? (
              <div className="card-surface calc-placeholder" aria-live="polite">
                <p>{Object.values(errors)[0] ? t('calc.step2') : t('calc.step2')}</p>
                <p className="hint">
                  {Object.values(errors)[0] || 'Natija ko’rsatilishi uchun maydonlarni to’ldiring'}
                </p>
              </div>
            ) : (
              <div className="card-surface calc-result-card" aria-live="polite">
                <h3 className="step-title">{t('calc.step2')}</h3>

              <div className="metric-grid">
                <div className="metric-tile glass-card--track" ref={trackBricksRef}>
                  <span className="tile-label">{t('calc.bricks')}</span>
                  <strong>
                    <AnimatedValue value={result.bricks}>{result.bricks.toLocaleString('ru-RU')}</AnimatedValue>
                  </strong>
                  <span className="tile-sub">dona</span>
                </div>
                <div className="metric-tile glass-card--track" ref={trackCementRef}>
                  <span className="tile-label">{t('calc.cement')}</span>
                  <strong>
                    <AnimatedValue value={result.cementBags}>{result.cementBags.toLocaleString('ru-RU')}</AnimatedValue>
                  </strong>
                  <span className="tile-sub">qop (50 kg)</span>
                </div>
                <div className="metric-tile glass-card--track" ref={trackSandRef}>
                  <span className="tile-label">{t('calc.sand')}</span>
                  <strong>
                    <AnimatedValue value={result.sandM3}>{result.sandM3}</AnimatedValue>
                  </strong>
                  <span className="tile-sub">m³</span>
                </div>
              </div>

              <table className="data-table calc-store-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th className="num">Miqdor</th>
                    <th className="num">Birlik narxi (UZS)</th>
                    <th className="num">Jami (UZS)</th>
                  </tr>
                </thead>
                <tbody>
                  {storeState === 'loading' ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="calc-store-skeleton-row" aria-hidden="true">
                        <td><Skeleton width={150} height={14} /></td>
                        <td className="num"><Skeleton width={60} height={14} /></td>
                        <td className="num"><Skeleton width={80} height={14} /></td>
                        <td className="num"><Skeleton width={92} height={14} /></td>
                      </tr>
                    ))
                  ) : (
                    storePricing.rows.map((row) => (
                      <Fragment key={row.material}>
                        <tr>
                          <td>
                            <div className="calc-store-material">
                              <span>{row.material}</span>
                              {row.isStorePrice && row.store && <StockBadge status={row.store.stock_status} />}
                            </div>
                              {row.isStorePrice && row.store ? (
                              <Link to={`/dokon?product=${row.store.id}`} className="calc-store-buy-link">
                                <Store className="w-3.5 h-3.5" />
                                Do'kondan sotib olish
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            ) : (
                              <span className="calc-store-estimated">Taxminiy narx</span>
                            )}
                          </td>
                          <td className="num">{row.quantity} {row.unit}</td>
                          <td className="num">
                            <div className="calc-store-price-cell">
                              {formatUZS(row.unitPrice)}
                              {row.isStorePrice && (
                                <span className="calc-store-badge" title={DEFAULT_STORE_SOURCE.name}>
                                  <Store className="w-3 h-3" />
                                  Do'kondan
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="num">{formatUZS(row.subtotal)}</td>
                        </tr>
                        {row.insufficient && row.store && (
                          <tr className="calc-store-warning-row" role="alert">
                            <td colSpan={4}>
                              <span className="calc-store-warning">
                                <AlertTriangle className="w-4 h-4" />
                                Do'konda yetarli emas — faqat {row.store.stock_quantity.toLocaleString('ru-RU')} {row.unit} mavjud
                              </span>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))
                  )}
                  <tr className="total-row">
                    <td colSpan={3}>{t('calc.total')}</td>
                    <td className="num">
                      {storeState === 'loading' ? (
                        <Skeleton width={100} height={16} />
                      ) : (
                        <AnimatedValue value={liveTotal}>{formatUZS(liveTotal)}</AnimatedValue>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              {storeState === 'ready' && updatedNote && (
                <p className="calc-store-updated-note">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Narxlar {updatedNote} yangilangan · {DEFAULT_STORE_SOURCE.name}
                </p>
              )}
              {storeState === 'error' && (
                <p className="calc-store-fallback-note">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Do'kon narxlarini yuklab bo'lmadi, taxminiy narxlar ko'rsatilmoqda
                </p>
              )}

              <div className="calc-actions">
                <Button onClick={handleSave}>{t('calc.save')}</Button>
                <Button onClick={handlePdf}>{t('calc.pdf')}</Button>
                <Button variant="secondary" onClick={resetAll}>{t('calc.reset')}</Button>
              </div>

              {storeState === 'ready' && storeOrderItems.length > 0 && (
                <Button className="calc-order-all" onClick={handleOrderAll}>
                  <ShoppingBag className="w-4 h-4" />
                  Barcha materiallarni buyurtma qilish
                </Button>
              )}

              <div className="calc-result-modules">
                <TransparencyPanel inputs={inputs} result={{ ...result, rows: storePricing.rows, total: storePricing.total }} />
                <LoanCalculator total={liveTotal} />
                <OrientationAdvisor direction={orientation} onDirectionChange={setOrientation} />
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {result && <StagesSection inputs={inputs} result={result} />}
      {result && <BudgetPlanner inputs={inputs} result={result} />}

      <SavedCalculations
        history={history}
        onDelete={(id) => {
          setHistory(deleteCalculation(id));
          compare.clear();
          setCompareIds(null);
        }}
        onClearAll={() => setHistory(clearHistory())}
        compare={compare}
      />

      {compare.selected.length === 2 && selectedCalcs.length === 2 && (
        <div className="floating-compare" role="status">
          <button className="btn btn-primary btn-sm" onClick={openCompare}>
            Taqqoslash (2)
          </button>
          <button className="modal-close" aria-label="Bekor qilish" onClick={compare.clear}>
            ×
          </button>
        </div>
      )}

      <ComparisonModal
        data={compareData}
        onClose={() => setCompareIds(null)}
        alternatives={compareAlternatives}
        onSwap={handleSwap}
      />
    </section>
  );
}

function formatSavedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('uz-UZ');
}

function SavedCalculations({
  history,
  onDelete,
  onClearAll,
  compare,
}: {
  history: SavedCalculation[];
  onDelete: (id: string) => void;
  onClearAll: () => void;
  compare: ReturnType<typeof useCompareSelection>;
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  const full = compare.selected.length === 2;

  return (
    <div className="card-surface" style={{ marginTop: 32, padding: 24 }}>
      <div className="saved-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h3>{t('calc.historyTitle')}</h3>
          {full && <span className="compare-hint">{t('compare.limit')}</span>}
        </div>
        {history.length > 0 &&
          (confirmClear ? (
            <div className="saved-confirm" role="alert">
              <span>{t('calc.historyClearConfirm')}</span>
              <Button variant="secondary" size="sm" onClick={() => { onClearAll(); setConfirmClear(false); }}>
                {t('calc.historyClearYes')}
              </Button>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmClear(false)}>
                {t('calc.historyClearNo')}
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={() => setConfirmClear(true)}>
              {t('calc.historyClear')}
            </button>
          ))}
      </div>

      {history.length === 0 ? (
        <div className="saved-empty fade-in">
          <HistoryEmpty size={140} />
          <p>{t('calc.historyEmpty')}</p>
          <Button onClick={() => document.getElementById('calc')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            {t('calc.historyEmptyCta')}
          </Button>
        </div>
      ) : (
        <div className="saved-grid fade-in">
          {history.map((h) => {
            const isSelected = compare.selected.includes(h.id);
            const disabled = full && !isSelected;
            return (
              <div key={h.id} className={`saved-card${isSelected ? ' is-compare-selected' : ''}`}>
                <div className="saved-card-head">
                  <span className="saved-date">{formatSavedDate(h.createdAt)}</span>
                  <button className="saved-trash" aria-label="O’chirish" onClick={() => onDelete(h.id)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <span className="saved-spec">
                  {getBrickType(h.brickId).label} · {h.wallLength}×{h.wallHeight} m · {h.rooms} xona
                </span>
                <span className="saved-total">{formatUZS(h.total)}</span>
                <label className={`compare-check${disabled ? ' is-disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={disabled}
                    onChange={() => compare.toggle(h.id)}
                  />
                  <span className="compare-check-label">{t('calc.comparePick')}</span>
                </label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
