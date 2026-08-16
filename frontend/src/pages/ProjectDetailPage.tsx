import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bath,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Images,
  Layers,
  Phone,
  Ruler,
  Send,
  User,
  Users,
} from 'lucide-react';
import { api, type TechnicalDrawing } from '../api/client';
import { useApp } from '../context/AppContext';
import { FavButton } from '../components/ui/FavButton';
import { GalleryEmpty } from '../components/ui/EmptyIllustration';
import SmartImage from '../components/ui/SmartImage';
import VerifiedBadge from '../components/projects/VerifiedBadge';
import TechnicalDrawingsSection from '../components/projects/TechnicalDrawingsSection';
import OrientationAdvisor from '../components/projects/OrientationAdvisor';
import { compassValueFromLabel } from '../components/projects/CompassWidget';
import ReviewSummary from '../components/reviews/ReviewSummary';
import ReviewSection from '../components/reviews/ReviewSection';
import {
  DetailBodySkeleton,
  EstimateSection,
  estimateStoreys,
  formatDate,
  type ProjectItem,
} from '../components/projects/ProjectModal';
import { isProjectVerified } from '../lib/verified';
import { t } from '../lib/i18n';

function ProjectDetailSkeleton() {
  return (
    <div className="project-page">
      <div className="skeleton h-8 w-48 mb-6" />
      <div className="skeleton h-[360px] w-full rounded-xl mb-6" />
      <div className="project-detail-grid">
        <div className="space-y-5">
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
        </div>
        <div className="space-y-5">
          <div className="skeleton h-6 w-1/3" />
          <div className="skeleton h-32 w-full" />
        </div>
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast, favOf, toggleFav } = useApp();
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [slide, setSlide] = useState(0);
  const [activeTab, setActiveTab] = useState<'photos' | 'drawings'>('photos');
  const [showContact, setShowContact] = useState(false);
  const [storeys, setStoreys] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const [lightboxBroken, setLightboxBroken] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number>(0);

  // Fetch project
  useEffect(() => {
    if (!id) return;
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getProject(numeric)
      .then((d) => {
        if (cancelled) return;
        setProject(d as unknown as ProjectItem);
        setStoreys(d.storeys ?? null);
      })
      .catch(() => {
        if (!cancelled) setProject(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // SEO
  useEffect(() => {
    if (project) {
      const title = project.id >= 100_000
        ? `${project.user_name} — Uy Loyiha Studio`
        : `Loyiha #${project.id} — Uy Loyiha Studio`;
      document.title = title;

      let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      const desc = `${project.area} m², ${project.rooms} xona, ${project.bathrooms} hammom`;
      meta.setAttribute('content', desc);
    }
    return () => {
      document.title = 'Uy Loyiha Studio';
    };
  }, [project]);

  // Lightbox keyboard
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

  if (loading) return <ProjectDetailSkeleton />;
  if (!project) {
    return (
      <div className="project-page">
        <Link to="/loyihalar" className="project-back-link">
          <ArrowLeft className="w-4 h-4" />
          Loyihalarga qaytish
        </Link>
        <div className="card-surface flex flex-col items-center justify-center gap-4 py-20 text-center">
          <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Loyiha topilmadi
          </p>
          <Link to="/loyihalar" className="btn btn-primary">
            Loyihalar ro'yxatiga qaytish
          </Link>
        </div>
      </div>
    );
  }

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
    <div className="project-page">
      <Link to="/loyihalar" className="project-back-link">
        <ArrowLeft className="w-4 h-4" />
        Loyihalarga qaytish
      </Link>

      {/* Gallery */}
      <div
        className="project-page-gallery"
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
                    sizes="(max-width: 768px) 100vw, 800px"
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
      </div>

      {/* Tabs */}
      <div className="profile-tabs project-page-tabs" role="tablist" aria-label="Loyiha bo'limlari">
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

      {/* Content — two-column on desktop */}
      <div className="project-detail-grid" ref={scrollRef}>
        {activeTab === 'drawings' ? (
          <div className="project-detail-grid-full">
            <TechnicalDrawingsSection
              drawings={project.technical_drawings ?? []}
              projectId={project.id}
              onAddDrawing={() => navigate('/yangi-loyiha')}
            />
          </div>
        ) : (
          <>
            {/* Left column: specs + description + materials */}
            <div className="project-detail-left">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    {project.id >= 100_000 ? project.user_name : `Loyiha #${project.id}`}
                    {(project.id >= 100_000 || isProjectVerified(project.id)) && <VerifiedBadge />}
                  </h1>
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

              {project.description && (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {project.description}
                </p>
              )}

              {compassValueFromLabel(project.orientation) && (
                <OrientationAdvisor
                  direction={compassValueFromLabel(project.orientation)}
                  compact
                />
              )}

              <EstimateSection project={project} />
            </div>

            {/* Right column: reviews + contact */}
            <div className="project-detail-right">
              <ReviewSection itemType="project" itemId={String(project.id)} />

              <div className="project-page-contact">
                <div className="flex items-center justify-between gap-3 border-t pt-4" style={{ borderColor: 'var(--border-card)' }}>
                  <span className="text-sm flex items-center gap-2 min-w-0" style={{ color: 'var(--text-muted)' }}>
                    <User className="w-4 h-4 shrink-0" />
                    <span className="truncate">{project.user_name || 'Anonim'}</span>
                  </span>
                </div>

                <button className="btn btn-primary w-full" onClick={() => setShowContact((v) => !v)}>
                  <Phone className="w-4 h-4" />
                  {t('projects.contact')}
                </button>

                {showContact && (
                  <div className="contact-reveal">
                    <a href="tel:+998901234567" onClick={() => showToast("Quruvchi bilan bog'lanildi")}>
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
            </div>
          </>
        )}
      </div>

      {/* Lightbox */}
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
    </div>
  );
}
