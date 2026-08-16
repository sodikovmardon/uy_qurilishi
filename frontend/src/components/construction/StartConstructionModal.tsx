import { useEffect, useMemo, useState } from 'react';
import { HardHat } from 'lucide-react';
import Modal from '../ui/Modal';
import { useApp } from '../../context/AppContext';
import { vibrate } from '../../lib/haptics';
import { trackEvent } from '../../lib/analytics';
import {
  createConstructionProject,
  todayIso,
  PHASE_DURATION_WEEKS,
  TRACKED_PHASE_IDS,
  type ConstructionProject,
} from '../../lib/construction';
import { BUDGET_PHASES } from '../../lib/budget';

interface StartConstructionModalProps {
  open: boolean;
  defaultName?: string;
  source?: { type: 'calculation' | 'project' | 'budget'; id: string };
  weights?: number[] | null;
  onClose: () => void;
  onCreated: (project: ConstructionProject) => void;
}

/** Confirmation dialog — project name, start date, phase breakdown preview. */
export function StartConstructionModal({
  open,
  defaultName,
  source,
  weights,
  onClose,
  onCreated,
}: StartConstructionModalProps) {
  const { showToast } = useApp();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');

  useEffect(() => {
    if (open) {
      setName(defaultName || 'Mening uyim');
      setStartDate(todayIso());
    }
  }, [open, defaultName]);

  const phases = useMemo(
    () =>
      TRACKED_PHASE_IDS.map((id, i) => {
        const meta = BUDGET_PHASES.find((p) => p.id === id);
        const dur = PHASE_DURATION_WEEKS[id];
        const w = weights?.[i] && weights[i] > 0 ? weights[i] : 1;
        const totalWeight = (weights ?? []).reduce((s, x) => s + (x > 0 ? x : 1), 0) || weights?.length || 5;
        return {
          id,
          title: meta?.title ?? id,
          color: meta?.color ?? '#007AFF',
          duration: `${dur.min}-${dur.max} hafta`,
          share: weights && weights.length ? Math.round((w / totalWeight) * 100) : 20,
        };
      }),
    [weights],
  );

  const valid = name.trim().length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(startDate);

  const handleCreate = () => {
    if (!valid) return;
    const project = createConstructionProject({
      name: name.trim(),
      startDate,
      source,
      weights,
    });
    trackEvent('tracker_start', { sourceType: source?.type });
    vibrate(12);
    showToast('Qurilish jarayoni boshlandi');
    onCreated(project);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Qurilishni boshlash"
      footer={
        <button className="btn btn-primary w-full" disabled={!valid} onClick={handleCreate}>
          <HardHat className="w-4 h-4" aria-hidden="true" />
          Qurilishni boshlash
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Loyihangiz uchun qurilish jarayonini yaratamiz — bosqichlarni real holatiga qarab yangilab borasiz.
        </p>

        <div className="field">
          <label htmlFor="tracker-name">Loyiha nomi</label>
          <input
            id="tracker-name"
            className="control"
            value={name}
            placeholder="Mening uyim"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="tracker-start">Boshlangan sana</label>
          <input
            id="tracker-start"
            type="date"
            className="control"
            value={startDate}
            max={todayIso()}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div>
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Kuzatiladigan bosqichlar
          </span>
          <ul className="tracker-phase-preview">
            {phases.map((ph) => (
              <li key={ph.id}>
                <span className="tracker-dot" style={{ background: ph.color }} aria-hidden="true" />
                <span className="tracker-preview-name">{ph.title}</span>
                <span className="chip chip-duration">{ph.duration}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
