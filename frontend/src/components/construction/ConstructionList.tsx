import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Calendar, HardHat } from 'lucide-react';
import { HistoryEmpty } from '../ui/EmptyIllustration';
import {
  getConstructionProjects,
  overduePhases,
  trackerProgress,
  isProjectFinished,
} from '../../lib/construction';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU');
}

/** "Mening qurilishim" — tracker list with per-project progress cards. */
export function ConstructionList({ embedded = false }: { embedded?: boolean }) {
  const projects = useMemo(() => getConstructionProjects(), []);

  const overdue = useMemo(
    () =>
      projects
        .map((p) => ({ project: p, phases: overduePhases(p) }))
        .filter((x) => x.phases.length > 0),
    [projects],
  );

  if (projects.length === 0) {
    return (
      <div className="card-surface flex flex-col items-center justify-center gap-4 py-20 text-center px-4 fade-in">
        <HistoryEmpty size={140} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Hali qurilish jarayoni boshlanmagan.
        </p>
        <Link to="/profil?tab=hisoblar" className="btn btn-primary">
          Hisobdan boshlash
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {!embedded && (
        <div className="flex items-baseline gap-3">
          <h1 className="text-[28px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
            Mening qurilishim
          </h1>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {projects.length} ta
          </span>
        </div>
      )}

      {overdue.length > 0 && (
        <div className="tracker-nudge fade-in" role="status">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            {overdue.slice(0, 2).map(({ project, phases }) => (
              <Link key={project.id} to={`/qurilish/${project.id}`} className="tracker-nudge-link">
                «{phases[0]?.title}» bosqichi rejalashtirilganidan uzoqroq davom etmoqda — {project.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="saved-grid">
        {projects.map((p) => {
          const progress = trackerProgress(p);
          const finished = isProjectFinished(p);
          return (
            <Link key={p.id} to={`/qurilish/${p.id}`} className="saved-card tracker-card no-underline">
              <div className="tracker-card-head">
                <span className="chip chip-duration">
                  {finished ? 'Tugallandi' : 'Faol'}
                </span>
                <span className="tracker-card-pct">
                  <HardHat className="w-4 h-4" aria-hidden="true" />
                  {progress.pct}%
                </span>
              </div>
              <span className="saved-spec">{p.name}</span>
              <div className="tracker-bar" aria-hidden="true">
                <div className="tracker-bar-fill" style={{ width: `${progress.pct}%` }} />
              </div>
              <div className="tracker-card-foot">
                <span className="tracker-meta">
                  <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                  {formatDate(p.startDate)}
                </span>
                <span className="tracker-meta">{progress.completed}/{progress.total} bosqich</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
