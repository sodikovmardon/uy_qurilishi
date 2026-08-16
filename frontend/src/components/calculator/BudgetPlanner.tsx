import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Lightbulb,
  PieChart,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react';
import type { CalcInputs, CalcResult } from '../../lib/calculator';
import { formatUZS } from '../../lib/calculator';
import {
  BUDGET_PHASES,
  buildBudgetComparison,
  DEFAULT_ALLOCATIONS,
  formatBudget,
  parseBudget,
  rebalanceAllocation,
  shortUZS,
  type BudgetPhaseRow,
  type BudgetStatus,
} from '../../lib/budget';
import { deleteBudgetPlan, getBudgetPlans, saveBudgetPlan, type BudgetPlan } from '../../lib/storage';
import { trackEvent } from '../../lib/analytics';
import { vibrate } from '../../lib/haptics';
import { useApp } from '../../context/AppContext';
import { useChat } from '../../context/ChatContext';
import Button from '../ui/Button';
import { AnimatedValue } from '../ui/AnimatedValue';

interface Props {
  inputs: CalcInputs;
  result: CalcResult;
}

/**
 * "Byudjet rejalashtirish" — total-budget planner that auto-splits the money
 * across 6 construction phases (sliders always balance to 100%) and compares
 * each phase against the stages-engine estimate. Plans persist to a versioned
 * "Mening byudjetlarim" list in localStorage.
 */
export default function BudgetPlanner({ inputs, result }: Props) {
  const { showToast } = useApp();
  const { open: openChat } = useChat();

  const [budgetText, setBudgetText] = useState('');
  const [allocations, setAllocations] = useState<number[]>(DEFAULT_ALLOCATIONS);
  const [view, setView] = useState<'bar' | 'donut'>('bar');
  const [plans, setPlans] = useState<BudgetPlan[]>(() => getBudgetPlans());

  const budget = useMemo(() => parseBudget(budgetText), [budgetText]);
  const comparison = useMemo(
    () => buildBudgetComparison(inputs, result, allocations, budget),
    [inputs, result, allocations, budget],
  );
  const pctTotal = allocations.reduce((s, v) => s + v, 0);
  const lowBudget = budget > 0 && comparison.calculatedTotal > 0 && budget < comparison.calculatedTotal * 0.1;

  const handleBudgetChange = (raw: string) => setBudgetText(formatBudget(parseBudget(raw)));

  const handleSlider = (index: number, value: number) => {
    setAllocations((prev) => rebalanceAllocation(prev, index, value));
  };

  const handleSave = () => {
    if (budget <= 0 || pctTotal !== 100) return;
    const next = saveBudgetPlan({
      budget,
      allocations,
      calculatedTotal: comparison.calculatedTotal,
      wallLength: inputs.wallLength,
      wallHeight: inputs.wallHeight,
      thickness: inputs.thickness,
      brickId: inputs.brickId,
      rooms: inputs.rooms,
      region: inputs.region,
    });
    setPlans(next);
    trackEvent('budget_save', { budget, region: inputs.region });
    vibrate(10);
    showToast(`Byudjet rejasi saqlandi (v${next[0]?.version ?? ''})`);
  };

  const handleDelete = (id: string) => {
    setPlans(deleteBudgetPlan(id));
    showToast('Byudjet rejasi o’chirildi');
  };

  const handleRestore = (plan: BudgetPlan) => {
    setBudgetText(formatBudget(plan.budget));
    setAllocations(plan.allocations);
    vibrate(10);
    showToast(`v${plan.version} rejasi tiklandi`);
  };

  const openAi = () => {
    const prompt =
      `Byudjet rejalashtirish bo'yicha maslahat bering.\n` +
      `Umumiy byudjet: ${formatUZS(comparison.totalBudget)}.\n` +
      `Hisoblangan smeta: ${formatUZS(comparison.calculatedMin)} – ${formatUZS(comparison.calculatedMax)}.\n` +
      `Taqsimot: ${comparison.rows
        .map((r) => `${r.title} ${r.pct}% (reja ${formatUZS(r.planned)}, hisob ${formatUZS(r.calculated)})`)
        .join('; ')}.\n` +
      `Qanday taqsimlashni tavsiya qilasiz?`;
    openChat(prompt);
    vibrate(10);
  };

  return (
    <section className="card-surface budget-section" id="budget-planner" aria-labelledby="budget-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="budget-title" className="step-title" style={{ marginBottom: 4 }}>
            Byudjet rejalashtirish
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Umumiy byudjetni 6 bosqichga bo’ling va hisoblangan smeta bilan solishtiring
          </p>
        </div>
        {budget > 0 && !lowBudget && (
          <div className="segmented budget-view-toggle" role="tablist" aria-label="Ko’rinish">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'bar'}
              className={`segmented-btn${view === 'bar' ? ' is-active' : ''}`}
              onClick={() => setView('bar')}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Taqsimot
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'donut'}
              className={`segmented-btn${view === 'donut' ? ' is-active' : ''}`}
              onClick={() => setView('donut')}
            >
              <PieChart className="w-3.5 h-3.5" />
              Do’ira
            </button>
          </div>
        )}
      </div>

      {/* Budget input */}
      <div className="budget-input-row">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="budget-total">Umumiy byudjet (so’m)</label>
          <div className="price-input">
            <input
              id="budget-total"
              className="control"
              type="text"
              inputMode="numeric"
              pattern="[0-9 ]*"
              placeholder="Masalan: 250 000 000"
              value={budgetText}
              onChange={(e) => handleBudgetChange(e.target.value)}
            />
            <span className="price-unit">so’m</span>
          </div>
        </div>
        {budget > 0 && (
          <Button variant="secondary" onClick={openAi}>
            <Sparkles className="w-4 h-4" />
            AI’dan maslahat olish
          </Button>
        )}
      </div>

      {budget === 0 ? (
        <div className="budget-empty fade-in">
          <Wallet className="budget-empty-icon" />
          <p>Byudjet rejalashtirishni boshlash uchun umumiy byudjetingizni kiriting</p>
          <p className="budget-empty-hint">
            Byudjet avtomatik taqsimlanadi (Poydevor 15%, Devorlar 30%, Tom 15%, Ichki pardozlash 25%, Elektr-santexnika
            10%, Zaxira 5%) va hisoblangan smeta bilan solishtiriladi.
          </p>
        </div>
      ) : (
        <>
          {lowBudget && (
            <div className="budget-low-banner fade-in" role="alert">
              <AlertTriangle className="w-4 h-4" />
              <div>
                <strong>Byudjet hisoblangan smetadan ancha past</strong>
                <p>
                  U smetaning taxminan {Math.max(1, Math.round((budget / comparison.calculatedTotal) * 100))}% qismini
                  qoplaydi ({formatUZS(comparison.overage)} kam). Byudjetni oshiring yoki o’lchamlarni qayta ko’ring.
                </p>
              </div>
            </div>
          )}

          {!lowBudget && (
            <div className="budget-planner-body fade-in">
              {/* Total validation chip */}
              <div className="budget-total-line">
                <span className={`chip ${pctTotal === 100 ? 'budget-total-ok' : 'budget-total-bad'}`} aria-live="polite">
                  {pctTotal === 100 ? 'Jami: 100%' : `Jami: ${pctTotal}% — tuzating`}
                </span>
                <span className="budget-total-note">
                  Umumiy byudjet: <AnimatedValue value={budget}>{formatUZS(budget)}</AnimatedValue>
                </span>
              </div>

              {/* Visualization */}
              {view === 'donut' ? (
                <Donut rows={comparison.rows} budget={budget} />
              ) : (
                <div className="budget-bar" role="img" aria-label="Byudjet taqsimoti (segmentlar)">
                  {comparison.rows.map((r) => (
                    <span
                      key={r.id}
                      className="budget-bar-seg"
                      style={{ width: `${r.pct}%`, background: r.color }}
                      title={`${r.title}: ${r.pct}%`}
                    />
                  ))}
                </div>
              )}

              {/* Phase rows (legend + sliders) */}
              <div className="budget-rows">
                {comparison.rows.map((row, i) => (
                  <BudgetRow
                    key={row.id}
                    row={row}
                    onChange={(v) => handleSlider(i, v)}
                    onChangeStart={() => vibrate(5)}
                  />
                ))}
              </div>
            </div>
          )}

          <OverallSummary comparison={comparison} />

          {budget > 0 && !lowBudget && (
            <div className="budget-actions">
              <Button onClick={handleSave} disabled={pctTotal !== 100}>
                <Save className="w-4 h-4" />
                Byudjetni saqlash
              </Button>
            </div>
          )}
        </>
      )}

      {/* Saved plans / version history — always visible */}
      <SavedPlans plans={plans} onDelete={handleDelete} onRestore={handleRestore} />
    </section>
  );
}

/* ------------------------------- Donut ------------------------------- */

function Donut({ rows, budget }: { rows: BudgetPhaseRow[]; budget: number }) {
  const R = 32;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="budget-donut-wrap">
      <svg viewBox="0 0 80 80" role="img" aria-label="Byudjet taqsimoti (do’ira diagramma)">
        {rows.map((r) => {
          const frac = r.pct / 100;
          const dash = Math.max(0, frac * C - 1.4);
          const offset = -acc * C;
          acc += frac;
          return (
            <circle
              key={r.id}
              cx="40"
              cy="40"
              r={R}
              fill="none"
              stroke={r.color}
              strokeWidth="11"
              strokeDasharray={`${dash.toFixed(2)} ${C.toFixed(2)}`}
              strokeDashoffset={offset.toFixed(2)}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
            />
          );
        })}
      </svg>
      <div className="budget-donut-center">
        <strong>{shortUZS(budget)}</strong>
        <span>umumiy byudjet</span>
      </div>
    </div>
  );
}

/* ------------------------------ Phase row ----------------------------- */

const STATUS_META: Record<BudgetStatus, { chip: string; label: string }> = {
  ok: { chip: 'budget-status-ok', label: 'Yetarli' },
  tight: { chip: 'budget-status-tight', label: 'Chegarada' },
  over: { chip: 'budget-status-over', label: 'Oshib ketdi' },
  none: { chip: 'budget-status-none', label: 'Zaxira' },
};

function BudgetRow({
  row,
  onChange,
  onChangeStart,
}: {
  row: BudgetPhaseRow;
  onChange: (value: number) => void;
  onChangeStart: () => void;
}) {
  const meta = STATUS_META[row.status];
  const diff = Math.abs(row.calculated - row.planned);
  const diffText =
    row.status === 'none'
      ? 'Hisoblangan qiymat yo’q'
      : row.status === 'ok'
        ? `${formatUZS(diff)} bo’sh qoladi`
        : `byudjetdan ${formatUZS(diff)} oshib ketdi`;

  return (
    <div className="budget-row">
      <div className="budget-row-head">
        <span className="budget-dot" style={{ background: row.color }} aria-hidden="true" />
        <div className="budget-row-title">
          <strong>{row.title}</strong>
          <span>{row.subtitle}</span>
        </div>
        <span className={`budget-row-pct${row.pct === 0 ? ' is-zero' : ''}`}>{row.pct}%</span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        className="range-slider"
        aria-label={`${row.title} ulushi`}
        value={row.pct}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={onChangeStart}
      />

      <div className="budget-row-amounts">
        <span>
          Reja: <strong>{formatUZS(row.planned)}</strong>
        </span>
        <span>
          Hisob: <strong>{row.calculated > 0 ? formatUZS(row.calculated) : '—'}</strong>
        </span>
        <span className={`budget-diff ${meta.chip}`}>{diffText}</span>
      </div>
    </div>
  );
}

/* ---------------------------- Overall summary --------------------------- */

function OverallSummary({ comparison }: { comparison: ReturnType<typeof buildBudgetComparison> }) {
  const { overallStatus, totalBudget, calculatedMin, calculatedMax } = comparison;
  let cls = 'budget-overall-ok';
  let icon: 'ok' | 'warn' | 'err' = 'ok';
  let text: string;
  if (overallStatus === 'ok') {
    cls = 'budget-overall-ok';
    icon = 'ok';
    text = `Byudjet hisoblangan smetani qoplaydi — ${formatUZS(comparison.spare)} zaxira mavjud`;
  } else if (overallStatus === 'tight') {
    cls = 'budget-overall-tight';
    icon = 'warn';
    text = `Byudjet smetaga juda yaqin — ${formatUZS(comparison.overage)} oshib ketdi, qisqartirish tavsiya etiladi`;
  } else {
    cls = 'budget-overall-over';
    icon = 'err';
    text = `Byudjetdan ${formatUZS(comparison.overage)} oshib ketdi — xarajatlarni qisqartiring yoki byudjetni oshiring`;
  }

  return (
    <div className={`budget-overall ${cls}${comparison.overallStatus === 'over' ? ' has-tip' : ''}`}>
      <div className="budget-overall-cols">
        <div>
          <span className="tile-label">Umumiy byudjet</span>
          <strong>{formatUZS(totalBudget)}</strong>
        </div>
        <div>
          <span className="tile-label">Hisoblangan smeta (6 bosqich)</span>
          <strong>{formatUZS(calculatedMin)} – {formatUZS(calculatedMax)}</strong>
        </div>
      </div>
      <div className="budget-overall-status">
        {icon === 'err' ? (
          <AlertTriangle className="w-4 h-4" />
        ) : icon === 'warn' ? (
          <AlertTriangle className="w-4 h-4" />
        ) : (
          <span className="budget-check" aria-hidden="true">✓</span>
        )}
        <span>{text}</span>
      </div>
      {comparison.overallStatus === 'over' && comparison.overage > comparison.calculatedTotal * 0.1 && (
        <p className="budget-tip">
          <Lightbulb className="w-3.5 h-3.5" />
          Maslahat: bo’shliqni yopish uchun byudjetga {formatUZS(comparison.overage)} qo’shing yoki Devorlar va Ichki
          pardozlash ulushlarini 5–10% ga qisqartiring.
        </p>
      )}
    </div>
  );
}

/* ------------------------------ Saved plans ----------------------------- */

function SavedPlans({
  plans,
  onDelete,
  onRestore,
}: {
  plans: BudgetPlan[];
  onDelete: (id: string) => void;
  onRestore: (plan: BudgetPlan) => void;
}) {
  return (
    <div className="budget-saved">
      <h4>Mening byudjetlarim</h4>
      {plans.length === 0 ? (
        <p className="budget-saved-empty">
          Hozircha byudjet rejasi saqlanmagan. Rejangizni saqlang va bu yerda versiya tarixi paydo bo’ladi.
        </p>
      ) : (
        <div className="budget-saved-grid fade-in">
          {plans.map((p) => (
            <div className="budget-saved-card" key={p.id}>
              <div className="budget-saved-head">
                <span className="budget-saved-version">v{p.version}</span>
                <span className="budget-saved-date">{new Date(p.createdAt).toLocaleDateString('uz-UZ')}</span>
                <button className="saved-trash" aria-label="O’chirish" onClick={() => onDelete(p.id)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <span className="budget-saved-spec">
                {p.wallLength}×{p.wallHeight} m · {p.rooms} xona
              </span>
              <strong className="budget-saved-total">{formatUZS(p.budget)}</strong>
              <div className="budget-saved-mini" aria-hidden="true">
                {p.allocations.map((v, i) => (
                  <span key={i} style={{ width: `${v}%`, background: BUDGET_PHASES[i]?.color }} />
                ))}
              </div>
              <Button variant="secondary" size="sm" onClick={() => onRestore(p)}>
                <RotateCcw className="w-3.5 h-3.5" />
                Qayta yuklash
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
