import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BadgeCheck, Search, Building2, Loader2, RotateCcw, LandPlot, Pencil, X, Plus } from 'lucide-react';
import { api } from '../api/client';
import { type ProjectItem } from '../components/projects/ProjectModal';
import ComparisonModal from '../components/comparison/ComparisonModal';
import PlotMatcherPanel from '../components/projects/PlotMatcherPanel';
import { FavButton } from '../components/ui/FavButton';
import { SearchEmpty } from '../components/ui/EmptyIllustration';
import SmartImage from '../components/ui/SmartImage';
import VerifiedBadge from '../components/projects/VerifiedBadge';
import ReviewSummary from '../components/reviews/ReviewSummary';
import { approvedAsProjects } from '../lib/submissions';
import { isProjectVerified } from '../lib/verified';
import { useApp } from '../context/AppContext';
import { useCompareSelection } from '../hooks/useCompareSelection';
import { buildProjectComparison, type ComparisonData } from '../lib/compare';
import { pricesToOverrides } from '../lib/calculator';
import { clearPlot, getMaterialPrices, getSavedPlot } from '../lib/storage';
import { estimateStoreys, fitsPlot, formatPlot, type PlotCalc } from '../lib/plotMatcher';
import { ratingOf, subscribeReviews } from '../lib/reviews';
import { t } from '../lib/i18n';

type RoomsFilter = 'all' | '1-2' | '3-4' | '5+';
type AreaFilter = 'all' | '<100' | '100-200' | '200+';
type StoreysFilter = 'all' | '1' | '2' | '3';
type RatingFilter = 'all' | '3' | '4';
type Sort = 'newest' | 'area-asc' | 'area-desc' | 'rooms' | 'rating';

const ROOM_FILTERS: { value: RoomsFilter; label: string }[] = [
  { value: 'all', label: 'Barchasi' },
  { value: '1-2', label: '1-2 xona' },
  { value: '3-4', label: '3-4 xona' },
  { value: '5+', label: '5+ xona' },
];

const AREA_FILTERS: { value: AreaFilter; label: string }[] = [
  { value: 'all', label: 'Barchasi' },
  { value: '<100', label: '<100 m²' },
  { value: '100-200', label: '100-200 m²' },
  { value: '200+', label: '200+ m²' },
];

const STOREYS_FILTERS: { value: StoreysFilter; label: string }[] = [
  { value: 'all', label: t('projects.qavat') + ': barchasi' },
  { value: '1', label: '1 qavat' },
  { value: '2', label: '2 qavat' },
  { value: '3', label: '3 qavat' },
];

const RATING_FILTERS: { value: RatingFilter; label: string }[] = [
  { value: 'all', label: 'Reyting: barchasi' },
  { value: '3', label: '3+ yulduz' },
  { value: '4', label: '4+ yulduz' },
];

const SORTS: { value: Sort; label: string }[] = [
  { value: 'newest', label: 'Eng yangi' },
  { value: 'rating', label: 'Reyting bo’yicha' },
  { value: 'area-asc', label: 'Maydon o’sishi' },
  { value: 'area-desc', label: 'Maydon kamayishi' },
  { value: 'rooms', label: 'Xonalar soni' },
];

const PER_PAGE = 12;

function statusBadges(p: ProjectItem): string[] {
  const badges: string[] = [];
  const days = (Date.now() - new Date(p.created_at).getTime()) / 86_400_000;
  if (days < 7) badges.push('Yangi');
  if (p.area >= 200 || p.rooms >= 8) badges.push('Mashhur');
  return badges;
}

/** Local (approved-submission) projects count as verified; others use the mock hash. */
function isVerified(p: ProjectItem): boolean {
  return p.id >= 100_000 || isProjectVerified(p.id);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU');
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast, favOf, toggleFav } = useApp();
  const compare = useCompareSelection(2);
  const [compareData, setCompareData] = useState<ComparisonData | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roomsFilter, setRoomsFilter] = useState<RoomsFilter>('all');
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('all');
  const [storeysFilter, setStoreysFilter] = useState<StoreysFilter>('all');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  /** Plot matcher ("Yer uchastkasi bo'yicha loyiha tanlash"). */
  const [matcherOpen, setMatcherOpen] = useState(
    () => new URLSearchParams(location.search).get('uchastka') === '1' || Boolean(getSavedPlot()),
  );
  const [matchingCalc, setMatchingCalc] = useState<PlotCalc | null>(null);
  const savedPlot = getSavedPlot();
  /** Approved user submissions merged into the catalog (Feature: Loyiha yuklash). */
  const [localProjects, setLocalProjects] = useState<ProjectItem[]>(() => approvedAsProjects(''));
  /** Bumped whenever reviews change so rating sort/filter re-run live. */
  const [reviewsTick, bumpReviews] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    return subscribeReviews(bumpReviews);
  }, []);

  useEffect(() => {
    const onFocus = () => setLocalProjects(approvedAsProjects(''));
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const fetchPage = useCallback(async (p: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const data = await api.getProjects(p);
      setProjects((prev) => (append ? [...prev, ...data.results] : data.results));
      setTotal(data.total);
      setPage(p);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(1, false);
  }, [fetchPage]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const combined = [...localProjects, ...projects];
    const list = combined.filter((p) => {
      const storeys = estimateStoreys(p.area, p.rooms);
      if (q) {
        const haystack = `${p.id} ${p.user_name} ${p.area} ${p.rooms}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (roomsFilter === '1-2' && !(p.rooms >= 1 && p.rooms <= 2)) return false;
      if (roomsFilter === '3-4' && !(p.rooms >= 3 && p.rooms <= 4)) return false;
      if (roomsFilter === '5+' && !(p.rooms >= 5)) return false;
      if (areaFilter === '<100' && !(p.area < 100)) return false;
      if (areaFilter === '100-200' && !(p.area >= 100 && p.area <= 200)) return false;
      if (areaFilter === '200+' && !(p.area > 200)) return false;
      if (storeysFilter !== 'all' && storeys !== Number(storeysFilter)) return false;
      if (verifiedOnly && !(isVerified(p))) return false;
      if (ratingFilter !== 'all' && ratingOf('project', String(p.id)) < Number(ratingFilter)) return false;
      if (matchingCalc && !fitsPlot(matchingCalc, p)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      switch (sort) {
        case 'area-asc':
          return a.area - b.area;
        case 'area-desc':
          return b.area - a.area;
        case 'rooms':
          return b.rooms - a.rooms;
        case 'rating': {
          const ra = ratingOf('project', String(a.id));
          const rb = ratingOf('project', String(b.id));
          return rb - ra;
        }
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [projects, localProjects, debouncedSearch, roomsFilter, areaFilter, storeysFilter, ratingFilter, sort, verifiedOnly, reviewsTick, matchingCalc]);

  const filtersActive =
    debouncedSearch.trim() !== '' ||
    roomsFilter !== 'all' ||
    areaFilter !== 'all' ||
    storeysFilter !== 'all' ||
    ratingFilter !== 'all' ||
    Boolean(matchingCalc);

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setRoomsFilter('all');
    setAreaFilter('all');
    setStoreysFilter('all');
    setRatingFilter('all');
  };

  const handleClearPlot = () => {
    clearPlot();
    setMatchingCalc(null);
    setMatcherOpen(false);
  };

  const handleCardClick = (p: ProjectItem) => {
    navigate(`/loyihalar/${p.id}`);
  };

  const handleBookmark = (id: string) => {
    const nowFav = toggleFav(id);
    showToast(nowFav ? t('toast.bookmarkAdded') : t('toast.bookmarkRemoved'));
  };

  const hasMore = page * PER_PAGE < total;
  const countText = filtersActive ? filtered.length : total;

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <h1 className="text-[28px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
          Loyihalar
        </h1>
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {countText} ta loyiha
        </span>
        <Link to="/yangi-loyiha" className="btn btn-primary btn-sm ml-auto">
          <Plus className="w-4 h-4" aria-hidden="true" />
          Yangi loyiha
        </Link>
      </div>

      {/* ---- Yer uchastkasi bo'yicha loyiha tanlash ---- */}
      {matcherOpen ? (
        <PlotMatcherPanel
          projects={[...localProjects, ...projects]}
          onMatch={setMatchingCalc}
          onOpenProject={handleCardClick}
          onClose={() => setMatcherOpen(false)}
        />
      ) : matchingCalc || savedPlot ? (
        <div className="matcher-chip-bar fade-in">
          <span className="chip matcher-chip">
            <LandPlot className="w-4 h-4" />
            Mening uchastkam: {formatPlot(matchingCalc?.areaM2 ?? savedPlot!.areaM2)}
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMatcherOpen(true)}>
            <Pencil className="w-4 h-4" />
            O’zgartirish
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleClearPlot}>
            <X className="w-4 h-4" />
            Olib tashlash
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 my-5 mb-8">
        <div className="relative w-full md:w-[320px] overflow-hidden rounded-[var(--radius-md)]">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('projects.search')}
            className="projects-search"
            aria-label={t('projects.search')}
          />
        </div>

        <select value={roomsFilter} onChange={(e) => setRoomsFilter(e.target.value as RoomsFilter)} className="projects-filter" aria-label={t('projects.rooms')}>
          {ROOM_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value as AreaFilter)} className="projects-filter" aria-label="Maydoni">
          {AREA_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        <select value={storeysFilter} onChange={(e) => setStoreysFilter(e.target.value as StoreysFilter)} className="projects-filter" aria-label={t('projects.qavat')}>
          {STOREYS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        <select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value as RatingFilter)} className="projects-filter" aria-label="Reyting">
          {RATING_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className={`verified-filter${matcherOpen ? ' is-active' : ''}`}
            aria-pressed={matcherOpen}
            onClick={() => setMatcherOpen((v) => !v)}
          >
            <LandPlot className="w-4 h-4" />
            Uchastka bo’yicha
          </button>
          <button
            type="button"
            className={`verified-filter${verifiedOnly ? ' is-active' : ''}`}
            aria-pressed={verifiedOnly}
            onClick={() => setVerifiedOnly((v) => !v)}
          >
            <BadgeCheck className="w-4 h-4" />
            Faqat tasdiqlangan
          </button>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="projects-filter" aria-label="Saralash">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="projects-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="project-card">
              <div className="project-thumb">
                <div className="skeleton h-full w-full" />
              </div>
              <div className="p-5 space-y-3">
                <div className="skeleton h-3 w-2/3" />
                <div className="skeleton h-5 w-1/2" />
                <div className="flex gap-2">
                  <div className="skeleton h-6 w-16" />
                  <div className="skeleton h-6 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 && matchingCalc ? (
        <div className="card-surface flex flex-col items-center justify-center gap-3 py-16 text-center px-4 fade-in">
          <div className="stat-icon">
            <LandPlot className="w-8 h-8" />
          </div>
          <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {formatPlot(matchingCalc.areaM2)} maydonga mos loyiha topilmadi
          </p>
          <p className="text-sm max-w-md" style={{ color: 'var(--text-secondary)' }}>
            Sizning qurilish uchun mos maydoningiz taxminan {Math.round(matchingCalc.footprintM2)} m². Buni qanday
            oshirish mumkin:
          </p>
          <ul className="plot-empty-suggest">
            <li>Qurilish foizini oshiring (masalan, 60–70% gacha)</li>
            <li>Ko’chadan chekinish masofasini kamaytiring</li>
            <li>Bir qavatli yoki kichikroq maydonli loyihalarni ko’ring</li>
          </ul>
          <div className="flex gap-3 mt-2 flex-wrap justify-center">
            <button className="empty-reset" onClick={() => setMatcherOpen(true)}>
              <Pencil className="w-3.5 h-3.5" />
              O’lchamlarni o’zgartirish
            </button>
            <button className="empty-reset" onClick={handleClearPlot}>
              <X className="w-3.5 h-3.5" />
              Barcha loyihalarni ko’rish
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-surface flex flex-col items-center justify-center gap-4 py-20 text-center px-4 fade-in">
          <SearchEmpty size={140} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Hech narsa topilmadi
          </p>
          {filtersActive && (
            <button className="empty-reset" onClick={resetFilters}>
              <RotateCcw className="w-3.5 h-3.5" />
              Filtrni tozalash
            </button>
          )}
        </div>
      ) : (
        <div className="projects-grid fade-in">
          {filtered.map((p) => {
            const badges = statusBadges(p);
            const fav = favOf(String(p.id));
            const isSelected = compare.selected.includes(String(p.id));
            const compareDisabled = compare.selected.length === 2 && !isSelected;
            return (
              <article
                key={p.id}
                className={`project-card${isSelected ? ' is-compare-selected' : ''}`}
                onClick={() => handleCardClick(p)}
              >
                <div className="project-thumb">
                  {p.images?.length ? (
                    <SmartImage
                      src={p.images[0]!}
                      alt={`Loyiha #${p.id}`}
                      sizes="(max-width: 640px) 100vw, 25vw"
                    />
                  ) : (
                    <span className="project-thumb-placeholder">
                      <Building2 className="w-10 h-10" style={{ color: 'var(--text-secondary)' }} />
                    </span>
                  )}
                </div>

                <FavButton
                  active={fav}
                  className="bookmark-heart"
                  label={fav ? t('projects.bookmarked') : t('projects.bookmark')}
                  onToggle={() => handleBookmark(String(p.id))}
                />

                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="project-id">#{p.id}</span>
                    <div className="flex items-center gap-2">
                      {badges.map((b) => (
                        <span key={b} className="chip">{b}</span>
                      ))}
                      {isVerified(p) && <VerifiedBadge />}
                    </div>
                  </div>

                  <div className="project-rating-row mt-2">
                    <ReviewSummary itemType="project" itemId={String(p.id)} />
                  </div>

                  <p className="project-spec mt-3">
                    {p.area} m²{' '}
                    <span style={{ color: 'var(--text-muted)' }}>•</span>{' '}
                    {p.rooms} xona
                  </p>

                  <div className="flex gap-2 flex-wrap mt-3">
                    <span className="chip">{p.rooms} xona</span>
                    <span className="chip">{p.area} m²</span>
                    <span className="chip">{estimateStoreys(p.area, p.rooms)} qavat</span>
                  </div>

                  <div className="project-footer">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{p.user_name || 'Anonim'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0">{formatDate(p.created_at)}</span>
                    </div>
                    <label
                      className={`compare-check shrink-0${compareDisabled ? ' is-disabled' : ''}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={compareDisabled}
                        onChange={() => compare.toggle(String(p.id))}
                      />
                    </label>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && !filtersActive && hasMore && (
        <div className="flex justify-center mt-10">
          <button
            onClick={() => fetchPage(page + 1, true)}
            disabled={loadingMore}
            className="btn btn-secondary"
            style={{ padding: '12px 32px' }}
          >
            {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
            {loadingMore ? t('common.loading') : t('common.showMore')}
          </button>
        </div>
      )}

      {compare.selected.length === 2 && (
        <div className="floating-compare" role="status">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              const ids = compare.selected;
              const a = projects.find((p) => String(p.id) === ids[0]);
              const b = projects.find((p) => String(p.id) === ids[1]);
              if (a && b) setCompareData(buildProjectComparison(a, b, pricesToOverrides(getMaterialPrices())));
            }}
          >
            Taqqoslash (2)
          </button>
          <button className="modal-close" aria-label="Bekor qilish" onClick={compare.clear}>
            ×
          </button>
        </div>
      )}

      <ComparisonModal data={compareData} onClose={() => setCompareData(null)} />
    </div>
  );
}
