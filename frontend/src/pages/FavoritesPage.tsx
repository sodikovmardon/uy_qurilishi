import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, HardHat } from 'lucide-react';
import { api } from '../api/client';
import ProjectModal, { type ProjectItem } from '../components/projects/ProjectModal';
import { FavButton } from '../components/ui/FavButton';
import { FavoritesEmpty } from '../components/ui/EmptyIllustration';
import { StartConstructionModal } from '../components/construction/StartConstructionModal';
import ReviewSummary from '../components/reviews/ReviewSummary';
import { useApp } from '../context/AppContext';
import { t } from '../lib/i18n';
import { weightsFromProject } from '../lib/construction';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU');
}

/** Bookmarked projects — fetches pages until every favorite is resolved. */
export function FavoritesPage({ embedded = false }: { embedded?: boolean }) {
  const { favorites, favOf, toggleFav } = useApp();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProjectItem | null>(null);
  const [startProject, setStartProject] = useState<ProjectItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ids = new Set(Object.keys(favorites));
    if (ids.size === 0) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const found: ProjectItem[] = [];
      let page = 1;
      while (page <= 20) {
        const data = await api.getProjects(page);
        if (data.results.length === 0) break;
        for (const p of data.results) {
          if (ids.has(String(p.id))) found.push(p);
        }
        if (page * data.results.length >= data.total || found.length >= ids.size) break;
        page += 1;
      }
      if (!cancelled) {
        setProjects(found);
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [favorites]);

  const removeFav = useCallback(
    (id: string) => {
      toggleFav(id);
      setProjects((prev) => prev.filter((p) => String(p.id) !== id));
    },
    [toggleFav],
  );

  const favoritesCount = Object.keys(favorites).length;

  return (
    <div className="w-full">
      {!embedded && (
        <div className="flex items-baseline gap-3">
          <h1 className="text-[28px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
            {t('favorites.title')}
          </h1>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {favoritesCount} ta
          </span>
        </div>
      )}

      {loading ? (
        <div className="projects-grid mt-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="project-card">
              <div className="project-thumb">
                <div className="skeleton h-full w-full" />
              </div>
              <div className="p-5 space-y-3">
                <div className="skeleton h-3 w-2/3" />
                <div className="skeleton h-5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="card-surface flex flex-col items-center justify-center gap-4 py-20 text-center px-4 mt-8 fade-in">
          <FavoritesEmpty size={140} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('favorites.empty')}
          </p>
          <Link to="/loyihalar" className="btn btn-primary">
            {t('favorites.emptyCta')}
          </Link>
        </div>
      ) : (
        <div className="projects-grid mt-8 fade-in">
          {projects.map((p) => {
            const fav = favOf(String(p.id));
            return (
              <article key={p.id} className="project-card" onClick={() => setSelected(p)}>
                <div className="project-thumb">
                  <Building2 className="w-10 h-10" style={{ color: 'var(--text-secondary)' }} />
                </div>

                <FavButton
                  active={fav}
                  className="bookmark-heart"
                  label="Sevimlilardan olib tashlash"
                  onToggle={() => removeFav(String(p.id))}
                />

                <div className="p-5">
                  <span className="project-id">#{p.id}</span>

                  <div className="project-rating-row mt-2">
                    <ReviewSummary itemType="project" itemId={String(p.id)} />
                  </div>

                  <p className="project-spec mt-3">
                    {p.area} m²{' '}
                    <span style={{ color: 'var(--text-muted)' }}>•</span> {p.rooms} xona
                  </p>

                  <div className="flex gap-2 flex-wrap mt-3">
                    <span className="chip">{p.rooms} xona</span>
                    <span className="chip">{p.area} m²</span>
                  </div>

                  <div className="project-footer">
                    <span className="truncate">{p.user_name || 'Anonim'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0">{formatDate(p.created_at)}</span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm w-full tracker-start-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStartProject(p);
                    }}
                  >
                    <HardHat className="w-4 h-4" aria-hidden="true" />
                    Qurilishni boshladim
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ProjectModal project={selected} onClose={() => setSelected(null)} />

      <StartConstructionModal
        open={!!startProject}
        defaultName={startProject ? `Mening uyim · ${startProject.area} m², ${startProject.rooms} xona` : undefined}
        source={startProject ? { type: 'project', id: String(startProject.id) } : undefined}
        weights={startProject ? weightsFromProject(startProject.area, startProject.rooms) : undefined}
        onClose={() => setStartProject(null)}
        onCreated={(p) => navigate(`/qurilish/${p.id}`)}
      />
    </div>
  );
}
