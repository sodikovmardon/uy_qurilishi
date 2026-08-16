import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  deleteSubmission,
  getSubmissionStatusLabel,
  getSubmissions,
  type Submission,
  type SubmissionStatus,
} from '../../lib/submissions';
import { REGIONS } from '../../config/regions';
import { GalleryEmpty } from '../ui/EmptyIllustration';

const STATUS_CHIP: Record<SubmissionStatus, string> = {
  pending: 'chip-status chip-pending',
  approved: 'chip-status chip-approved',
  rejected: 'chip-status chip-rejected',
};

/**
 * "Mening loyihalarim" — user's submissions with moderation status chips.
 * Approved projects appear in the main Loyihalar catalog (see ProjectsPage).
 */
export function MySubmissions({ tick, onChanged }: { tick: number; onChanged: () => void }) {
  const { showToast } = useApp();
  const [list, setList] = useState<Submission[]>(getSubmissions());
  void tick;

  const regionLabel = (id: string) => REGIONS.find((r) => r.id === id)?.name ?? id;

  if (list.length === 0) {
    return (
      <div className="saved-empty fade-in">
        <GalleryEmpty size={140} style={{ color: '#60A5FA' }} />
        <p>Siz yuborgan loyihalar bu yerda ko’rinadi. «Yangi loyiha» bo’limidan loyihangizni yuklang.</p>
      </div>
    );
  }

  return (
    <div className="submission-list fade-in">
      {list.map((s) => (
        <div key={s.id} className="submission-card">
          <div className="submission-thumbs">
            {s.images.slice(0, 3).map((img) =>
              img.dataUrl ? <img key={img.name} src={img.dataUrl} alt={img.name} /> : null,
            )}
            {s.images.length === 0 && <span className="submission-thumb-empty">No rasm</span>}
          </div>
          <div className="submission-info">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.title}</h4>
              <span className={STATUS_CHIP[s.status]}>{getSubmissionStatusLabel(s)}</span>
            </div>
            <p className="submission-spec">
              {s.area} m² · {s.rooms} xona · {s.storeys} qavat · {regionLabel(s.region)}
            </p>
            <p className="submission-desc">{s.description}</p>
            <p className="submission-meta">
              {new Date(s.createdAt).toLocaleDateString('uz-UZ')}
              {s.status === 'approved' && ' · Katalogga qo’shildi'}
              {s.status === 'pending' && ' · Mutaxassis ko’rib chiqmoqda'}
            </p>
          </div>
          <button
            type="button"
            className="saved-trash"
            aria-label="O’chirish"
            onClick={() => {
              setList(deleteSubmission(s.id));
              onChanged();
              showToast('Loyiha o’chirildi');
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
