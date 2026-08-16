import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppWindow,
  Bath,
  BrickWall,
  Cable,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Clock,
  DoorOpen,
  Droplet,
  Droplets,
  ExternalLink,
  FileDown,
  FileText,
  Gauge,
  Home,
  Images,
  Layers,
  LayoutGrid,
  Package,
  PaintRoller,
  PanelsTopLeft,
  Phone,
  PlugZap,
  Ruler,
  Send,
  ShoppingBag,
  Sprout,
  Sun,
  Truck,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Modal from '../ui/Modal';
import { FavButton } from '../ui/FavButton';
import { GalleryEmpty } from '../ui/EmptyIllustration';
import SmartImage from '../ui/SmartImage';
import VerifiedBadge from './VerifiedBadge';
import TechnicalDrawingsSection from './TechnicalDrawingsSection';
import OrientationAdvisor from './OrientationAdvisor';
import CompassWidget, { compassValueFromLabel } from './CompassWidget';
import ReviewSummary from '../reviews/ReviewSummary';
import ReviewSection from '../reviews/ReviewSection';
import { isProjectVerified } from '../../lib/verified';
import { useApp } from '../../context/AppContext';
import { api, type StoreProduct, type TechnicalDrawing } from '../../api/client';
import { estimateProjectMaterials, formatUZS } from '../../lib/calculator';
import { applyProjectStorePricing, fetchStoreCatalog, type ProjectStorePricedRow } from '../../lib/storeApi';
import { downloadSmeta, type SmetaDoc } from '../../lib/pdf';
import { addManyToCart } from '../../lib/cart';
import { runWithProgress } from '../../lib/progress';
import { saveCalcDraft } from '../../lib/storage';
import { DEFAULT_REGION_ID } from '../../config/regions';
import { STORE_URL } from '../../config/links';
import { t } from '../../lib/i18n';

export interface ProjectItem {
  id: number;
  user_name: string;
  area: number;
  rooms: number;
  bathrooms: number;
  has_pool: boolean;
  has_garage: boolean;
  has_terrace: boolean;
  /** Manual feature tags ("pool", "terrace", "modern_facade", "garden", …). */
  features?: string[];
  source: string;
  created_at: string;
  /** Ordered image URLs; the first is the primary (project card). */
  images?: string[];
  /** Technical drawings (texnik chizmalar); local submissions may carry dataURLs. */
  technical_drawings?: TechnicalDrawing[];
  /** Local-only: user-submitted projects may carry a description (feature 5). */
  description?: string;
  /** Local-only: stored quyosh yo'nalishi label ("Janub", "Shimoli-sharq", …). */
  orientation?: string;
}

interface ProjectModalProps {
  project: ProjectItem | null;
  onClose: () => void;
}

export function estimateStoreys(area: number, rooms: number): number {
  if (area >= 2600 || rooms >= 14) return 3;
  if (area >= 900 || rooms >= 8) return 2;
  return 1;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uz-UZ');
}

export const ROW_ICONS: Record<string, LucideIcon> = {
  bricks: BrickWall,
  cement: Package,
  sand: Truck,
  roof: Home,
  windows: PanelsTopLeft,
  doors: DoorOpen,
  tile: LayoutGrid,
  paint: PaintRoller,
  cable: Cable,
  pipe: Droplet,
  outlets: PlugZap,
  pool_membrane: Droplets,
  pool_equipment: Gauge,
  terrace: Sun,
  facade: AppWindow,
  garden: Sprout,
};

export const ROW_ICON_CLASS: Record<string, string> = {
  bricks: 'tile-icon-orange',
  cement: 'tile-icon-blue',
  sand: 'tile-icon-green',
  roof: 'tile-icon-purple',
  windows: 'tile-icon-indigo',
  doors: 'tile-icon-amber',
  tile: 'tile-icon-teal',
  paint: 'tile-icon-pink',
  cable: 'tile-icon-amber',
  pipe: 'tile-icon-cyan',
  outlets: 'tile-icon-indigo',
  pool_membrane: 'tile-icon-cyan',
  pool_equipment: 'tile-icon-blue',
  terrace: 'tile-icon-green',
  facade: 'tile-icon-purple',
  garden: 'tile-icon-green',
};

export function MaterialTile({ row }: { row: ProjectStorePricedRow }) {
  const Icon = ROW_ICONS[row.key] ?? Package;
  const iconClass = ROW_ICON_CLASS[row.key] ?? 'tile-icon-blue';
  const accentClass = `glass-accent-${iconClass.replace('tile-icon-', '')}`;
  const hasStore = row.isStorePrice && !!row.store;
  const storeUrl = hasStore ? `${STORE_URL.replace(/\/$/, '')}/mahsulot/${row.store!.id}` : '';

  const handleClick = () => {
    if (hasStore) {
      window.location.href = storeUrl;
    }
  };

  return (
    <div
      className={`calc-tile material-tile glass-card ${accentClass}${hasStore ? ' is-linkable' : ''}`}
      onClick={hasStore ? handleClick : undefined}
      role={hasStore ? 'link' : undefined}
      tabIndex={hasStore ? 0 : undefined}
      onKeyDown={hasStore ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } } : undefined}
    >
      <div className={`calc-tile-icon ${iconClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="calc-tile-value">
        {Math.round(row.quantity).toLocaleString('ru-RU')}
        <span className="calc-tile-suffix"> {row.unit}</span>
      </p>
      <p className="calc-tile-label">{row.label}</p>
      {hasStore && (
        <span className="material-store-badge" title={`Do'kondan: ${row.store!.name}`}>
          Do'kondan
        </span>
      )}
      {hasStore && (
        <span className="material-store-link">
          Do'kondan ko'rish
          <ExternalLink className="w-3 h-3" />
        </span>
      )}
    </div>
  );
}

export function EstimateSection({ project }: { project: ProjectItem }) {
  const { showToast } = useApp();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [catalog, setCatalog] = useState<StoreProduct[] | null>(null);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const estimate = useMemo(
    () =>
      estimateProjectMaterials({
        area: project.area,
        rooms: project.rooms,
        bathrooms: project.bathrooms,
        features: project.features ?? [],
      }),
    [project],
  );

  const pricedRows = useMemo(
    () => applyProjectStorePricing(estimate.rows, catalog),
    [estimate, catalog],
  );

  const pricedTotal = useMemo(() => pricedRows.reduce((s, r) => s + r.subtotal, 0), [pricedRows]);

  const pricedGroups = useMemo(() => {
    return estimate.groups.map((g) => {
      const rows = pricedRows.filter((r) => r.group === g.id);
      return {
        id: g.id,
        label: g.label,
        rows,
        subtotal: rows.reduce((s, r) => s + r.subtotal, 0),
      };
    });
  }, [estimate, pricedRows]);

  const updateScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtTop(el.scrollTop <= 2);
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
  };

  useEffect(() => {
    updateScroll();
  }, [estimate.groups.length]);

  useEffect(() => {
    let cancelled = false;
    fetchStoreCatalog()
      .then((c) => {
        if (!cancelled) setCatalog(c);
      })
      .catch(() => {
        /* catalog optional — estimated prices are the fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    const doc: SmetaDoc = {
      id: `HIS-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      date: new Date().toLocaleDateString('uz-UZ'),
      inputs: [
        `Loyiha: ${project.id >= 100_000 ? project.user_name : `#${project.id}`} · ${project.area} m² · ${project.rooms} xona · ${project.bathrooms} hammom`,
        `Xususiyatlar: ${project.features && project.features.length > 0 ? project.features.join(', ') : '—'}`,
      ],
      rows: pricedRows.map((r) => ({
        material: r.label,
        quantity: `${r.quantity} ${r.unit}`,
        unitPrice: formatUZS(r.unitPrice),
        subtotal: formatUZS(r.subtotal),
      })),
      total: formatUZS(pricedTotal),
    };
    showToast('PDF tayyorlanmoqda…', 'info', 1200);
    try {
      await runWithProgress(() => downloadSmeta(doc));
      showToast('PDF yuklab olindi', 'success');
    } catch {
      showToast('PDF generatsiya xatosi', 'error');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleOrderAll = () => {
    const entries = pricedRows
      .filter((r): r is ProjectStorePricedRow & { store: StoreProduct } => r.isStorePrice && Boolean(r.store))
      .map((r) => ({ product: r.store, quantity: Math.max(1, Math.ceil(r.quantity)) }));
    if (!entries.length) {
      showToast('Do’konda mos materiallar topilmadi', 'info');
      return;
    }
    addManyToCart(entries);
    showToast(`Savatga ${entries.length} ta material qo’shildi`, 'success');
    navigate('/dokon', { state: { fromCalculator: entries.length } });
  };

  const handleOpenInCalculator = () => {
    const side = Math.round(Math.sqrt(project.area) * 4);
    saveCalcDraft({
      wallLength: Math.max(side, 10),
      wallHeight: 3,
      thickness: 25,
      brickId: 'silikat',
      rooms: Math.max(Math.round(project.rooms), 1),
      region: DEFAULT_REGION_ID,
    });
    navigate('/kalkulyator');
  };

  return (
    <section className="material-section">
      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
        Taxminiy material ro’yxati
      </h3>

      <div className={`material-scroll-wrap${atTop ? ' is-top' : ''}${atBottom ? ' is-bottom' : ''}`}>
        <div
          ref={scrollRef}
          className="material-scroll"
          onScroll={updateScroll}
        >
          {pricedGroups.map((group) => (
            <div key={group.id} className="material-group">
              <div className="material-group-head">
                <h4 className="material-group-title">{group.label}</h4>
                <span className="material-group-subtotal">{formatUZS(group.subtotal)}</span>
              </div>
              <div className="calc-tile-grid material-grid">
                {group.rows.map((row) => (
                  <MaterialTile key={row.key} row={row} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="material-total">
        <span>Umumiy baho</span>
        <strong>{formatUZS(pricedTotal)}</strong>
      </div>

      <div className="material-actions">
        <button type="button" className="btn btn-secondary" onClick={() => void handlePdf()} disabled={pdfBusy}>
          <FileDown className="w-4 h-4" />
          PDF smetani yuklab olish
        </button>
        <button type="button" className="btn btn-secondary" onClick={handleOpenInCalculator}>
          <Calculator className="w-4 h-4" />
          Kalkulyatorda ochish
        </button>
        <button type="button" className="btn btn-primary" onClick={handleOrderAll}>
          <ShoppingBag className="w-4 h-4" />
          Barcha materiallarni buyurtma qilish
        </button>
      </div>
    </section>
  );
}

export function DetailBodySkeleton() {
  return (
    <div className="p-5 md:p-6 space-y-5">
      <div className="skeleton h-6 w-1/2" />
      <div className="spec-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="spec-card">
            <div className="skeleton h-10 w-10" />
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        ))}
      </div>
      <div className="calc-tile-grid" style={{ marginTop: 0 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="calc-tile">
            <div className="skeleton h-10 w-10" />
            <div className="skeleton h-5 w-2/3" />
            <div className="skeleton h-3 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProjectModal({ project, onClose }: ProjectModalProps) {
  const { showToast, favOf, toggleFav } = useApp();
  const navigate = useNavigate();
  const [slide, setSlide] = useState(0);
  const [activeTab, setActiveTab] = useState<'photos' | 'drawings'>('photos');
  const [showContact, setShowContact] = useState(false);
  const [storeys, setStoreys] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [lightboxBroken, setLightboxBroken] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const touchX = useRef<number>(0);

  const images = project?.images ?? [];

  useEffect(() => {
    if (lightbox) {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setLightbox(false);
        if (e.key === 'ArrowLeft') setSlide((s) => Math.max(0, s - 1));
        if (e.key === 'ArrowRight') setSlide((s) => Math.min(images.length - 1, s + 1));
      };
      document.addEventListener('keydown', onKey);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', onKey);
        document.body.style.overflow = prevOverflow;
      };
    }
    return undefined;
  }, [lightbox, images.length]);

  useEffect(() => {
    if (project) {
      prevFocus.current = document.activeElement as HTMLElement | null;
      setSlide(0);
      setActiveTab('photos');
      setShowContact(false);
      setStoreys(null);
      setLightbox(false);
      setLightboxBroken(false);
      let cancelled = false;
      setLoading(true);
      api
        .getProject(project.id)
        .then((d) => {
          if (!cancelled) setStoreys(d.storeys ?? null);
        })
        .catch(() => {
          /* list data is already enough — fall back to local estimate */
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }
    prevFocus.current?.focus();
    return undefined;
  }, [project?.id]);

  if (!project) return null;

  const isFav = favOf(String(project.id));
  const floors = storeys ?? estimateStoreys(project.area, project.rooms);
  const showGalleryNav = images.length > 1;
  const hasImages = images.length > 0;

  const handleBookmark = () => {
    const nowFav = toggleFav(String(project.id));
    showToast(nowFav ? t('toast.bookmarkAdded') : t('toast.bookmarkRemoved'));
  };

  const specs = [
    { icon: Users, label: 'Xonalar', value: `${project.rooms}`, iconClass: 'tile-icon-blue' },
    { icon: Layers, label: 'Qavatlar', value: `${floors}`, iconClass: 'tile-icon-purple' },
    { icon: Ruler, label: 'Umumiy maydon', value: `${project.area} m²`, iconClass: 'tile-icon-orange' },
    { icon: Bath, label: 'Hammomlar', value: `${project.bathrooms}`, iconClass: 'tile-icon-green' },
  ];

  return (
    <>
      <Modal open onClose={onClose} title={`Loyiha #${project.id}`} detail>
        <div className="project-detail">
          <div
            className="project-gallery project-detail-gallery"
            onTouchStart={(e) => {
              touchX.current = e.touches[0]?.clientX ?? 0;
            }}
            onTouchEnd={(e) => {
              if (!showGalleryNav) return;
              const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
              if (dx > 40) setSlide((s) => Math.max(0, s - 1));
              else if (dx < -40) setSlide((s) => Math.min(images.length - 1, s + 1));
            }}
          >
            {loading ? (
              <div className="skeleton h-full w-full" />
            ) : (
              <>
                <div
                  className="project-gallery-track"
                  style={{ transform: `translateX(-${slide * 100}%)` }}
                >
                  {hasImages ? (
                    images.map((src, i) => (
                      <div key={src} className="project-gallery-slide">
                        <button
                          type="button"
                          className="project-gallery-zoom"
                          aria-label={`Rasmni kattalashtirish ${i + 1}`}
                          onClick={() => {
                            setLightboxBroken(false);
                            setLightbox(true);
                          }}
                        >
                          <SmartImage
                            src={src}
                            alt={`Loyiha #${project.id} chizmasi ${i + 1}`}
                            sizes="(max-width: 640px) 100vw, 640px"
                            fallback={<GalleryEmpty size={90} />}
                          />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="project-gallery-slide">
                      <GalleryEmpty size={120} />
                    </div>
                  )}
                </div>

                {hasImages && (
                  <span className="project-gallery-count" aria-hidden="true">
                    {slide + 1} / {images.length}
                  </span>
                )}

                {showGalleryNav && (
                  <>
                    <button
                      className="project-gallery-arrow prev"
                      aria-label="Oldingi rasm"
                      onClick={() => setSlide((s) => Math.max(0, s - 1))}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      className="project-gallery-arrow next"
                      aria-label="Keyingi rasm"
                      onClick={() => setSlide((s) => Math.min(images.length - 1, s + 1))}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <div className="project-gallery-dots">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          className={`project-gallery-dot${i === slide ? ' is-active' : ''}`}
                          aria-label={`Rasm ${i + 1}`}
                          onClick={() => setSlide(i)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <div className="profile-tabs project-detail-tabs" role="tablist" aria-label="Loyiha bo’limlari">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'photos'}
              className={`nav-link${activeTab === 'photos' ? ' is-active' : ''}`}
              onClick={() => {
                setActiveTab('photos');
                scrollRef.current?.scrollTo({ top: 0 });
              }}
            >
              <Images className="w-4 h-4" />
              Rasmlar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'drawings'}
              className={`nav-link${activeTab === 'drawings' ? ' is-active' : ''}`}
              onClick={() => {
                setActiveTab('drawings');
                scrollRef.current?.scrollTo({ top: 0 });
              }}
            >
              <FileText className="w-4 h-4" />
              Texnik hujjatlar
            </button>
          </div>

          <div className="project-detail-scroll" ref={scrollRef}>
            {activeTab === 'drawings' ? (
              <div className="p-5 md:p-6">
                <TechnicalDrawingsSection
                  drawings={project.technical_drawings ?? []}
                  projectId={project.id}
                  onAddDrawing={() => navigate('/yangi-loyiha')}
                />
              </div>
            ) : loading ? (
              <DetailBodySkeleton />
            ) : (
              <div className="p-5 md:p-6 space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      {project.id >= 100_000 ? project.user_name : `Loyiha #${project.id}`}
                      {(project.id >= 100_000 || isProjectVerified(project.id)) && <VerifiedBadge />}
                    </h2>
                    <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      <Clock className="w-3 h-3" />
                      {formatDate(project.created_at)}
                    </p>
                    <div className="mt-1.5">
                      <ReviewSummary itemType="project" itemId={String(project.id)} size={15} />
                    </div>
                  </div>
                  <FavButton
                    active={isFav}
                    className="bookmark-btn"
                    label={isFav ? t('projects.bookmarked') : t('projects.bookmark')}
                    onToggle={handleBookmark}
                  />
                </div>

                <div className="spec-grid">
                  {specs.map((s) => {
                    const Icon = s.icon;
                    return (
                      <div key={s.label} className="spec-card">
                        <div className={`spec-card-icon ${s.iconClass}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <p className="spec-card-value">{s.value}</p>
                        <p className="spec-card-label">{s.label}</p>
                      </div>
                    );
                  })}
                </div>

                {(project as ProjectItem & { description?: string }).description && (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {(project as ProjectItem & { description?: string }).description}
                  </p>
                )}

                {compassValueFromLabel(project.orientation) && (
                  <OrientationAdvisor
                    direction={compassValueFromLabel(project.orientation)}
                    compact
                  />
                )}

                <EstimateSection project={project} />

                <ReviewSection itemType="project" itemId={String(project.id)} />

                <div className="flex items-center justify-between gap-3 border-t pt-4" style={{ borderColor: 'var(--border-card)' }}>
                  <span className="text-sm flex items-center gap-2 min-w-0" style={{ color: 'var(--text-muted)' }}>
                    <User className="w-4 h-4 shrink-0" />
                    <span className="truncate">{project.user_name || 'Anonim'}</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {!loading && (
            <div className="project-detail-footer">
              <button className="btn btn-primary w-full sm:w-auto" onClick={() => setShowContact((v) => !v)}>
                <Phone className="w-4 h-4" />
                {t('projects.contact')}
              </button>

              {showContact && (
                <div className="contact-reveal">
                  <a href="tel:+998901234567" onClick={() => showToast('Quruvchi bilan bog’lanildi')}>
                    <Phone className="w-4 h-4" />
                    +998 90 123 45 67
                  </a>
                  <a href="https://t.me/uy_loyiha_studio" target="_blank" rel="noreferrer">
                    <Send className="w-4 h-4" />
                    Telegram
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

    {lightbox && hasImages && (
      <div className="lightbox" role="dialog" aria-modal="true" aria-label="Rasm kattalashtirilgan ko'rinish">
        <button
          className="lightbox-close"
          aria-label="Yopish"
          onClick={() => setLightbox(false)}
        >
          ×
        </button>
        {showGalleryNav && (
          <button
            className="lightbox-arrow prev"
            aria-label="Oldingi rasm"
            onClick={() => setSlide((s) => Math.max(0, s - 1))}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        <div className="lightbox-body" onClick={() => setLightbox(false)}>
          {lightboxBroken ? (
            <GalleryEmpty size={120} />
          ) : (
            <img
              src={images[slide]}
              alt={`Loyiha #${project.id} — rasm ${slide + 1}`}
              onError={() => setLightboxBroken(true)}
              onLoad={() => setLightboxBroken(false)}
            />
          )}
        </div>
        {showGalleryNav && (
          <button
            className="lightbox-arrow next"
            aria-label="Keyingi rasm"
            onClick={() => setSlide((s) => Math.min(images.length - 1, s + 1))}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
        <span className="lightbox-count">
          {slide + 1} / {images.length}
        </span>
      </div>
    )}
    </>
  );
}