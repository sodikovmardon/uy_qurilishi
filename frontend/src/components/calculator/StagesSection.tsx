import { useEffect, useMemo, useRef, useState } from 'react';
import { BrickWall, CheckCircle2, FileText, HardHat, Home, Layers, PaintRoller } from 'lucide-react';
import type { CalcInputs, CalcResult } from '../../lib/calculator';
import { formatUZS } from '../../lib/calculator';
import { buildStagesPlan, stageCurrency, type Stage, type StagesPlan, type StageIcon } from '../../lib/stages';
import { downloadStagesPdf, type StagePdfDoc } from '../../lib/pdf';
import { runWithProgress } from '../../lib/progress';
import { vibrate } from '../../lib/haptics';
import { trackEvent } from '../../lib/analytics';
import { useApp } from '../../context/AppContext';
import Button from '../ui/Button';

const STAGE_ICONS: Record<StageIcon, typeof Home> = {
  foundation: Layers,
  walls: BrickWall,
  roof: HardHat,
  interior: PaintRoller,
};

interface Props {
  inputs: CalcInputs;
  result: CalcResult;
}

/**
 * "Qurilish bosqichlari" — vertical stepper/timeline breaking the estimate
 * into Poydevor / Devorlar / Tom / Ichki ishlar. A sticky summary shows the
 * running cumulative total as the active stage scrolls into view.
 */
export default function StagesSection({ inputs, result }: Props) {
  const { showToast } = useApp();
  const plan = useMemo(() => buildStagesPlan(inputs, result), [inputs, result]);
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const idx = refs.current.indexOf(e.target as HTMLDivElement);
            if (idx >= 0) setActive(idx);
          }
        });
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: 0 },
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [plan.stages.length]);

  if (!plan.stages.length) return null;

  const cumulative = plan.stages.slice(0, active + 1).reduce((s, st) => s + st.cost, 0);
  const done = plan.stages.slice(0, active + 1).reduce((s, st) => s + (st.costMin === undefined ? 1 : 0), 0);

  const handlePdf = async () => {
    const reg = (() => inputs.region)();
    const doc: StagePdfDoc = {
      id: `BOSQ-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      date: new Date().toLocaleDateString('uz-UZ'),
      inputs: [
        `Devor uzunligi: ${inputs.wallLength} m · Balandligi: ${inputs.wallHeight} m · Qalinligi: ${inputs.thickness} sm`,
        `G’isht turi tanlangan · Xonalar: ${inputs.rooms} · Hudud indeksi: ${reg}`,
        plan.totalWeeks,
      ],
      stages: plan.stages.map((st) => ({
        title: st.title,
        subtitle: st.subtitle,
        duration: st.duration,
        total: stageCurrency(st),
        rows: st.materials.map((m) => ({ material: m.name, quantity: m.quantity, cost: formatUZS(m.cost) })),
      })),
      grandTotal: `${formatUZS(plan.grandMin)} – ${formatUZS(plan.grandMax)}`,
    };
    showToast('PDF tayyorlanmoqda…', 'info', 1200);
    try {
      await runWithProgress(() => downloadStagesPdf(doc));
      trackEvent('calc_stages_pdf');
      vibrate(10);
      showToast('Bosqichlar PDF yuklab olindi');
    } catch {
      showToast('Xatolik yuz berdi, qaytadan urinib ko’ring', 'error');
    }
  };

  return (
    <section className="card-surface stages-section" aria-labelledby="stages-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="stages-title" className="step-title" style={{ marginBottom: 4 }}>
            Qurilish bosqichlari
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Umumiy smeta 4 bosqichga bo’lindi · taxminiy muddat: {plan.totalWeeks}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handlePdf}>
          <FileText className="w-4 h-4" />
          Bosqichlar bo’yicha PDF
        </Button>
      </div>

      {/* Sticky running cumulative total */}
      <div className="stages-sticky-summary" aria-live="polite">
        <span className="stages-summary-step">
          {active + 1}/{plan.stages.length} — {plan.stages[active]?.title}
        </span>
        <span className="stages-summary-total">
          Jami bosqichlar: <strong>{formatUZS(cumulative)}</strong>
        </span>
      </div>

      <div className="stages-timeline">
        {plan.stages.map((stage, i) => (
          <StageCard
            key={stage.id}
            stage={stage}
            index={i}
            isActive={i === active}
            isDone={i < active}
            isLast={i === plan.stages.length - 1}
            refCb={(el) => {
              refs.current[i] = el;
            }}
          />
        ))}
      </div>

      <div className="stages-grand">
        <div className="stages-grand-left">
          <span className="tile-label">Umumiy summa (barcha bosqichlar)</span>
          <strong>{formatUZS(plan.grandMin)} – {formatUZS(plan.grandMax)}</strong>
          <span className="tile-sub">Ichki ishlar {formatUZS(plan.grandMax - plan.grandMin)} oralig’ida baholanadi</span>
        </div>
        <div className="stages-grand-right">
          <span className="tile-label">Qurilish muddati</span>
          <strong>{plan.totalWeeks}</strong>
          <span className="tile-sub">Poydevordan qurib bitkazishgacha</span>
        </div>
      </div>

      <p className="stages-note">
        {done}/{plan.stages.length} bosqich aniqlik bilan, ichki ishlar umumiy summaning foizli bahosi orqali
        hisoblandi. Aniq smeta uchun mutaxassis bilan bog’laning.
      </p>
    </section>
  );
}

function StageCard({
  stage,
  index,
  isActive,
  isDone,
  isLast,
  refCb,
}: {
  stage: Stage;
  index: number;
  isActive: boolean;
  isDone: boolean;
  isLast: boolean;
  refCb: (el: HTMLDivElement | null) => void;
}) {
  const Icon = STAGE_ICONS[stage.icon];
  return (
    <div className={`stage-item${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`} ref={refCb}>
      <div className="stage-rail">
        <span className="stage-node">
          {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
        </span>
        {!isLast && <span className="stage-line" />}
      </div>
      <div className="stage-card">
        <div className="stage-card-head">
          <div className="stage-title-wrap">
            <span className="stage-index">0{index + 1}</span>
            <div>
              <h4>{stage.title}</h4>
              <p className="stage-subtitle">{stage.subtitle}</p>
            </div>
          </div>
          <div className="stage-meta">
            <span className="chip chip-duration">
              <ClockDot />
              {stage.duration}
            </span>
            <strong className="stage-cost">{stageCurrency(stage)}</strong>
          </div>
        </div>

        {isActive && (
          <div className="stage-body fade-in">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th className="num">Miqdor</th>
                  <th className="num">Baholangan qiymat</th>
                </tr>
              </thead>
              <tbody>
                {stage.materials.map((m) => (
                  <tr key={m.name}>
                    <td>{m.name}</td>
                    <td className="num">{m.quantity}</td>
                    <td className="num">{formatUZS(m.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ClockDot() {
  return <span aria-hidden="true" className="chip-dot" />;
}
