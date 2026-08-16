import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2 } from 'lucide-react';
import { api } from '../../api/client';
import type { ProjectItem } from '../projects/ProjectModal';
import SmartImage from '../ui/SmartImage';
import VerifiedBadge from '../projects/VerifiedBadge';
import { isProjectVerified } from '../../lib/verified';

const FEATURED_COUNT = 4;

function estimateStoreys(area: number, rooms: number): number {
  if (area >= 2600 || rooms >= 14) return 3;
  if (area >= 900 || rooms >= 8) return 2;
  return 1;
}

/** Homepage teaser — a few featured project cards + link to the full catalog. */
export function FeaturedProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getProjects(1)
      .then((data) => {
        if (!cancelled) setProjects(data.results.slice(0, FEATURED_COUNT));
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mt-16 md:mt-24">
      <div className="section-head">
        <h2>Ommabop loyihalar</h2>
        <p>Katalogdan tanlab olingan namunaviy uy loyihalari.</p>
      </div>

      {!projects ? (
        <div className="projects-grid">
          {Array.from({ length: FEATURED_COUNT }).map((_, i) => (
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
        <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Loyihalar hozircha mavjud emas.
        </p>
      ) : (
        <div className="projects-grid">
          {projects.map((p) => (
            <article
              key={p.id}
              className="project-card"
              onClick={() => navigate(`/loyihalar/${p.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/loyihalar/${p.id}`);
              }}
            >
              <div className="project-thumb">
                {p.images?.length ? (
                  <SmartImage src={p.images[0]!} alt={`Loyiha #${p.id}`} sizes="(max-width: 640px) 100vw, 25vw" />
                ) : (
                  <span className="project-thumb-placeholder">
                    <Building2 className="w-10 h-10" style={{ color: 'var(--text-secondary)' }} />
                  </span>
                )}
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="project-id">#{p.id}</span>
                  {isProjectVerified(p.id) && <VerifiedBadge />}
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
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="flex justify-center mt-10">
        <Link className="btn btn-secondary" style={{ padding: '12px 32px' }} to="/loyihalar">
          Barcha loyihalarni ko’rish
          <ArrowRight className="w-4 h-4 btn-arrow" />
        </Link>
      </div>
    </section>
  );
}
