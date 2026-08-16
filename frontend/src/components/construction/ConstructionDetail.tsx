import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Flag,
  ImagePlus,
  Play,
  Trash2,
  X,
} from 'lucide-react';
import {
  deleteConstructionProject,
  fileToResizedDataUrl,
  durationText,
  getConstructionProject,
  isProjectFinished,
  MAX_TRACKER_PHOTOS,
  saveConstructionProject,
  trackerProgress,
  uid,
  type ConstructionNote,
  type ConstructionProject,
  type ConstructionPhoto,
  type PhaseStatus,
  type TrackedPhase,
} from '../../lib/construction';
import { useApp } from '../../context/AppContext';
import { vibrate } from '../../lib/haptics';
import { trackEvent } from '../../lib/analytics';
import { validateImageFile } from '../../lib/image';

const NEXT_STATUS: Record<PhaseStatus, PhaseStatus> = {
  not_started: 'in_progress',
  in_progress: 'completed',
  completed: 'not_started',
};

const STATUS_LABEL: Record<PhaseStatus, string> = {
  not_started: 'Boshlanmagan',
  in_progress: 'Jarayonda',
  completed: 'Tugallandi',
};

function toDateInput(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU');
}

export function ConstructionDetail({ projectId }: { projectId: string }) {
  const { showToast } = useApp();
  const [project, setProject] = useState<ConstructionProject | null>(() =>
    getConstructionProject(projectId) ?? null,
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [lightbox, setLightbox] = useState<{ phaseId: string; index: number } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteMilestone, setNoteMilestone] = useState(false);

  useEffect(() => {
    setProject(getConstructionProject(projectId) ?? null);
  }, [projectId]);

  useEffect(() => {
    if (lightbox) {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setLightbox(null);
      };
      document.addEventListener('keydown', onKey);
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', onKey);
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [lightbox]);

  const update = useCallback((next: ConstructionProject) => {
    saveConstructionProject(next);
    setProject(next);
  }, []);

  if (!project) {
    return (
      <div className="card-surface flex flex-col items-center justify-center gap-4 py-20 text-center px-4">
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Qurilish jarayoni topilmadi.
        </p>
        <Link to="/qurilish" className="btn btn-primary">
          Barcha jarayonlar
        </Link>
      </div>
    );
  }

  const progress = trackerProgress(project);
  const finished = isProjectFinished(project);

  const cycleStatus = (phase: TrackedPhase) => {
    const next = NEXT_STATUS[phase.status];
    const nowIso = new Date().toISOString();
    const updated: TrackedPhase = { ...phase, status: next };
    if (next === 'in_progress' && !updated.startedAt) updated.startedAt = nowIso;
    if (next === 'completed') updated.completedAt = nowIso;
    if (next === 'not_started') {
      updated.startedAt = undefined;
      updated.completedAt = undefined;
    }
    trackEvent('tracker_phase', { phase: phase.id, status: next });
    vibrate(8);
    showToast(`${phase.title}: ${STATUS_LABEL[next]}`, 'info');
    update({
      ...project,
      phases: project.phases.map((ph) => (ph.id === phase.id ? updated : ph)),
    });
  };

  const setCompletedDate = (phase: TrackedPhase, value: string) => {
    if (!value) return;
    update({
      ...project,
      phases: project.phases.map((ph) =>
        ph.id === phase.id
          ? { ...ph, completedAt: new Date(`${value}T12:00:00`).toISOString() }
          : ph,
      ),
    });
  };

  const addPhotos = async (phaseId: string, files: FileList | null) => {
    const phase = project.phases.find((ph) => ph.id === phaseId);
    if (!phase || !files || files.length === 0) return;
    const room = MAX_TRACKER_PHOTOS - phase.photos.length;
    const picked = Array.from(files).slice(0, room);
    if (picked.length < files.length) showToast(`Har bir bosqich uchun maks ${MAX_TRACKER_PHOTOS} ta rasm`, 'info');
    const added: ConstructionPhoto[] = [];
    for (const file of picked) {
      const error = validateImageFile(file);
      if (error) {
        showToast(error, 'error');
        continue;
      }
      try {
        const dataUrl = await fileToResizedDataUrl(file);
        added.push({ id: uid(), dataUrl, caption: '', createdAt: new Date().toISOString() });
      } catch {
        showToast('Rasmni yuklashda xatolik', 'error');
      }
    }
    if (added.length === 0) return;
    trackEvent('tracker_photo', { phase: phaseId, count: added.length });
    update({
      ...project,
      phases: project.phases.map((ph) =>
        ph.id === phaseId ? { ...ph, photos: [...ph.photos, ...added] } : ph,
      ),
    });
  };

  const setCaption = (phaseId: string, photoId: string, caption: string) => {
    update({
      ...project,
      phases: project.phases.map((ph) =>
        ph.id === phaseId
          ? { ...ph, photos: ph.photos.map((pt) => (pt.id === photoId ? { ...pt, caption } : pt)) }
          : ph,
      ),
    });
  };

  const removePhoto = (phaseId: string, photoId: string) => {
    update({
      ...project,
      phases: project.phases.map((ph) =>
        ph.id === phaseId ? { ...ph, photos: ph.photos.filter((pt) => pt.id !== photoId) } : ph,
      ),
    });
  };

  const addNote = () => {
    const text = noteText.trim();
    if (!text) return;
    const note: ConstructionNote = {
      id: uid(),
      text,
      milestone: noteMilestone,
      createdAt: new Date().toISOString(),
    };
    trackEvent('tracker_note', { milestone: noteMilestone });
    update({ ...project, notes: [...project.notes, note] });
    setNoteText('');
    setNoteMilestone(false);
    vibrate(8);
    showToast(noteMilestone ? 'Muhim voqea qayd etildi' : 'Yozuv saqlandi');
  };

  const removeNote = (noteId: string) => {
    update({ ...project, notes: project.notes.filter((n) => n.id !== noteId) });
  };

  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    trackEvent('tracker_delete');
    deleteConstructionProject(project.id);
    showToast('Qurilish jarayoni o\'chirildi');
    window.location.href = '/qurilish';
  };

  const sortedNotes = [...project.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const lbPhoto = lightbox ? project.phases.find((ph) => ph.id === lightbox.phaseId)?.photos[lightbox.index] : null;

  return (
    <div className="tracker-detail w-full max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link to="/qurilish" className="btn btn-secondary btn-sm" aria-label="Orqaga">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Barcha jarayonlar
        </Link>
        <button
          className={`btn btn-sm tracker-delete-btn ml-auto${confirmingDelete ? ' btn-danger' : ' btn-secondary'}`}
          onClick={handleDelete}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
          {confirmingDelete ? 'Yana bosing — o\'chirish' : 'O\'chirish'}
        </button>
      </div>

      <div className="card-surface tracker-hero">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-[26px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {project.name}
            </h1>
            <p className="mt-1 text-sm flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
              <Calendar className="w-4 h-4" aria-hidden="true" />
              Boshlangan: {formatDate(project.startDate)}
            </p>
          </div>
          <span className="chip chip-duration">{finished ? 'Tugallandi' : 'Faol'}</span>
        </div>

        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Umumiy jarayon
            </span>
            <strong className="tracker-hero-pct">{progress.pct}%</strong>
          </div>
          <div className="tracker-bar tracker-bar-lg mt-2" aria-hidden="true">
            <div className="tracker-bar-fill" style={{ width: `${progress.pct}%` }} />
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            {progress.completed}/{progress.total} bosqich tugallandi
          </p>
        </div>
      </div>

      <h2 className="tracker-section-title">Bosqichlar</h2>
      <div className="tracker-steps">
        {project.phases.map((phase, index) => {
          const isLast = index === project.phases.length - 1;
          return (
            <div
              key={phase.id}
              className={`stage-item${phase.status === 'in_progress' ? ' is-active' : ''}${phase.status === 'completed' ? ' is-done' : ''}`}
            >
              <div className="stage-rail">
                <span className="stage-node">
                  {phase.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  ) : phase.status === 'in_progress' ? (
                    <Play className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Circle className="w-4 h-4" aria-hidden="true" />
                  )}
                </span>
                {!isLast && <span className="stage-line" />}
              </div>

              <div className="stage-card tracker-phase-card">
                <div className="stage-card-head tracker-phase-head">
                  <div className="stage-title-wrap">
                    <span className="stage-index">0{index + 1}</span>
                    <div>
                      <h4>{phase.title}</h4>
                      <p className="stage-subtitle">{durationText(phase)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`chip tracker-status is-${phase.status}`}
                    onClick={() => cycleStatus(phase)}
                  >
                    {STATUS_LABEL[phase.status]}
                  </button>
                </div>

                {(phase.startedAt || phase.completedAt) && (
                  <div className="tracker-dates">
                    {phase.startedAt && (
                      <span className="tracker-meta">
                        Boshlangan: {formatDate(phase.startedAt)}
                      </span>
                    )}
                    {phase.status === 'completed' && (
                      <label className="tracker-meta tracker-date-edit">
                        Tugallangan:
                        <input
                          type="date"
                          value={toDateInput(phase.completedAt)}
                          max={new Date().toISOString().slice(0, 10)}
                          onChange={(e) => setCompletedDate(phase, e.target.value)}
                          aria-label={`${phase.title} tugallangan sana`}
                        />
                      </label>
                    )}
                  </div>
                )}

                <div className="tracker-photos">
                  <div className="tracker-photo-strip">
                    {phase.photos.map((photo, i) => (
                      <figure
                        key={photo.id}
                        className="tracker-photo"
                        onClick={() => setLightbox({ phaseId: phase.id, index: i })}
                      >
                        <img src={photo.dataUrl} alt={photo.caption || phase.title} loading="lazy" />
                        <button
                          type="button"
                          className="tracker-photo-del"
                          aria-label="Rasmni o\'chirish"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePhoto(phase.id, photo.id);
                          }}
                        >
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <figcaption>
                          <input
                            type="text"
                            value={photo.caption}
                            placeholder="Izoh…"
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setCaption(phase.id, photo.id, e.target.value)}
                          />
                        </figcaption>
                      </figure>
                    ))}
                    {phase.photos.length < MAX_TRACKER_PHOTOS && (
                      <div className="tracker-photo-add-wrap">
                        <button
                          type="button"
                          className="tracker-photo-add"
                          onClick={() => document.getElementById(`tracker-file-${phase.id}`)?.click()}
                        >
                          <ImagePlus className="w-5 h-5" aria-hidden="true" />
                          <span>Rasm qo\'shish</span>
                        </button>
                        <input
                          id={`tracker-file-${phase.id}`}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          className="sr-only"
                          aria-hidden="true"
                          tabIndex={-1}
                          onChange={(e) => {
                            addPhotos(phase.id, e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="tracker-section-title">Yozuvlar va muhim voqealar</h2>
      <div className="card-surface tracker-notes">
        <div className="tracker-note-compose">
          <textarea
            className="control"
            rows={2}
            placeholder="Qurilish borasida eslatma yozing…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <label className="tracker-milestone-toggle">
              <input
                type="checkbox"
                checked={noteMilestone}
                onChange={(e) => setNoteMilestone(e.target.checked)}
              />
              <Flag className="w-4 h-4" aria-hidden="true" />
              Muhim voqea
            </label>
            <button
              type="button"
              className="btn btn-primary btn-sm ml-auto"
              disabled={!noteText.trim()}
              onClick={addNote}
            >
              Qo\'shish
            </button>
          </div>
        </div>

        {sortedNotes.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
            Hali yozuvlar yo\'q.
          </p>
        ) : (
          <ul className="tracker-note-list">
            {sortedNotes.map((note) => (
              <li key={note.id} className={`tracker-note${note.milestone ? ' is-milestone' : ''}`}>
                <div className="tracker-note-head">
                  <span className="tracker-note-date">{formatDate(note.createdAt)}</span>
                  {note.milestone && (
                    <span className="chip tracker-milestone-chip">
                      <Flag className="w-3 h-3" aria-hidden="true" />
                      Muhim voqea
                    </span>
                  )}
                  <button
                    type="button"
                    className="tracker-note-del"
                    aria-label="Yozuvni o\'chirish"
                    onClick={() => removeNote(note.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
                <p>{note.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lbPhoto && lightbox && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Rasm kattalashtirilgan ko\'rinish">
          <button
            className="lightbox-close"
            aria-label="Yopish"
            onClick={() => setLightbox(null)}
          >
            ×
          </button>
          <div className="lightbox-body" onClick={() => setLightbox(null)}>
            <img src={lbPhoto.dataUrl} alt={lbPhoto.caption || 'Qurilish surati'} />
          </div>
          <span className="lightbox-count">
            {lbPhoto.caption || 'Qurilish surati'}
          </span>
        </div>
      )}
    </div>
  );
}
