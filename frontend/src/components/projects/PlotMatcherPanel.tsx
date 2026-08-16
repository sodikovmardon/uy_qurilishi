import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Info,
  LandPlot,
  Ruler,
  Save,
  Shapes,
  Trash2,
  X,
} from 'lucide-react';
import type { ProjectItem } from './ProjectModal';
import {
  calcBuildable,
  fitsPlot,
  formatPlot,
  m2ToSotix,
  projectFootprint,
  sotixToM2,
  validatePlot,
  type PlotCalc,
} from '../../lib/plotMatcher';
import { clearPlot, getSavedPlot, savePlot } from '../../lib/storage';

type Unit = 'm2' | 'sotix';
type Shape = 'rect' | 'complex';

interface Props {
  /** Projects available for matching (loaded catalog + approved submissions). */
  projects: ProjectItem[];
  /** Set by the parent whenever the live calc changes (null clears matching). */
  onMatch: (calc: PlotCalc | null) => void;
  /** Open a project's detail modal from the overlay picker. */
  onOpenProject?: (p: ProjectItem) => void;
  /** Collapse the panel (matching stays active via the parent's chip). */
  onClose?: () => void;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * "Yer uchastkasi bo'yicha loyiha tanlash" — plot dimensions + buildable
 * footprint calculator with a proportional SVG preview. Self-contained form;
 * emits the computed PlotCalc upward so the catalog grid filters live.
 */
export default function PlotMatcherPanel({ projects, onMatch, onOpenProject, onClose }: Props) {
  const saved = useRef(getSavedPlot()).current;

  const [unit, setUnit] = useState<Unit>('m2');
  const [areaStr, setAreaStr] = useState(() => String(saved?.areaM2 ?? 600));
  const [shape, setShape] = useState<Shape>('rect');
  const [widthStr, setWidthStr] = useState(() => (saved?.width ? String(saved.width) : ''));
  const [lengthStr, setLengthStr] = useState(() => (saved?.length ? String(saved.length) : ''));
  const [coverage, setCoverage] = useState(saved?.coveragePct ?? 50);
  const [setbackStr, setSetbackStr] = useState(() => (saved && saved.setbackM > 0 ? String(saved.setbackM) : '0'));
  const [picked, setPicked] = useState<ProjectItem | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(saved?.savedAt ?? null);

  const num = (s: string): number => {
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : NaN;
  };

  const areaM2 = Number.isNaN(num(areaStr)) ? NaN : unit === 'm2' ? num(areaStr) : sotixToM2(num(areaStr));
  const width = shape === 'complex' && widthStr.trim() !== '' ? num(widthStr) : undefined;
  const length = shape === 'complex' && lengthStr.trim() !== '' ? num(lengthStr) : undefined;
  const setbackM = setbackStr.trim() !== '' ? Math.max(0, num(setbackStr)) : 0;

  const input = useMemo(
    () => ({ areaM2, width, length, coveragePct: coverage, setbackM }),
    [areaM2, width, length, coverage, setbackM],
  );
  const { errors, warnings } = useMemo(() => validatePlot(input), [input]);

  const calc = useMemo<PlotCalc | null>(() => {
    if (Object.keys(errors).length > 0) return null;
    return calcBuildable(input);
  }, [errors, input]);

  const matches = useMemo(
    () => (calc ? projects.filter((p) => fitsPlot(calc, p)) : []),
    [calc, projects],
  );

  // Emit the live calc upward (parent filters the grid) + auto-save to LocalStorage.
  useEffect(() => {
    onMatch(calc);
    if (!calc) return;
    const timer = window.setTimeout(() => {
      savePlot({
        areaM2: calc.areaM2,
        width: width && width > 0 ? width : undefined,
        length: length && length > 0 ? length : undefined,
        coveragePct: calc.coveragePct,
        setbackM,
        savedAt: new Date().toISOString(),
      });
      setSavedAt(new Date().toISOString());
    }, 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calc]);

  const switchUnit = (u: Unit) => {
    if (u === unit) return;
    const cur = Number.isNaN(areaM2) ? null : areaM2;
    setUnit(u);
    setAreaStr(cur == null ? '' : u === 'm2' ? String(Math.round(cur)) : String(round1(m2ToSotix(cur))));
  };

  const handleClear = () => {
    clearPlot();
    setAreaStr('600');
    setUnit('m2');
    setShape('rect');
    setWidthStr('');
    setLengthStr('');
    setCoverage(50);
    setSetbackStr('0');
    setPicked(null);
    setSavedAt(null);
    onMatch(null);
  };

  // --- SVG preview geometry (proportional to the plot, not real-world scale) ---
  const dims = useMemo(() => {
    const w = width && width > 0 ? width : Math.sqrt(areaM2 || 600);
    const l = length && length > 0 ? length : Math.sqrt(areaM2 || 600);
    return { w, l };
  }, [width, length, areaM2]);

  const preview = useMemo(() => {
    const { w, l } = dims;
    const maxDim = Math.max(w, l, 1);
    const scale = 96 / maxDim;
    const wU = w * scale;
    const lU = l * scale;
    const x = (100 - wU) / 2;
    const y = (100 - lU) / 2;
    const inset = setbackM * scale;
    return { wU, lU, x, y, inset };
  }, [dims, setbackM]);

  const zone = {
    x: preview.x + preview.inset,
    y: preview.y + preview.inset,
    w: Math.max(0, preview.wU - preview.inset * 2),
    h: Math.max(0, preview.lU - preview.inset * 2),
  };

  const footprintBox = useMemo(() => {
    if (!calc) return null;
    const frac = Math.sqrt(Math.max(calc.footprintM2, 0) / Math.max(calc.areaM2, 1));
    const w = zone.w * frac;
    const h = zone.h * frac;
    return { x: zone.x + (zone.w - w) / 2, y: zone.y + (zone.h - h) / 2, w, h };
  }, [calc, zone]);

  const pickBox = useMemo(() => {
    if (!picked || !calc) return null;
    const frac = Math.sqrt(projectFootprint(picked) / Math.max(calc.areaM2, 1));
    const w = zone.w * frac;
    const h = zone.h * frac;
    return { x: zone.x + (zone.w - w) / 2, y: zone.y + (zone.h - h) / 2, w, h };
  }, [picked, calc, zone]);

  const pickDisabled = calc == null || matches.length === 0;

  return (
    <section className="plot-matcher card-surface fade-in" aria-label="Uchastkangizga mos loyiha toping">
      <div className="plot-matcher-head">
        <div className="plot-matcher-title">
          <span className="stat-icon">
            <LandPlot className="w-5 h-5" />
          </span>
          <div>
            <h3 className="m-0">Uchastkangizga mos loyiha toping</h3>
            <p className="plot-matcher-sub">
              O’lchamlarni kiriting — katalogdan qaysi loyihalar mos kelishini ko’rsatamiz.
            </p>
          </div>
        </div>
        {savedAt && (
          <span className="chip chip-saved">
            <Save className="w-3.5 h-3.5" />
            Saqlangan
          </span>
        )}
        {onClose && (
          <button type="button" className="modal-close" aria-label="Yopish" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="plot-matcher-body">
        {/* ---- Inputs ---- */}
        <div className="plot-form">
          <div className="field">
            <label>
              Uchastka maydoni <span className="required-mark" aria-hidden="true">*</span>
            </label>
            <div className="plot-area-input">
              <div className="unit-toggle" role="group" aria-label="O’lchov birligi">
                <button
                  type="button"
                  className={`unit-toggle-btn${unit === 'm2' ? ' is-active' : ''}`}
                  aria-pressed={unit === 'm2'}
                  onClick={() => switchUnit('m2')}
                >
                  m²
                </button>
                <button
                  type="button"
                  className={`unit-toggle-btn${unit === 'sotix' ? ' is-active' : ''}`}
                  aria-pressed={unit === 'sotix'}
                  onClick={() => switchUnit('sotix')}
                >
                  sotix
                </button>
              </div>
              <input
                className={`control${errors.area ? ' is-invalid' : ''}`}
                type="number"
                min="0"
                step={unit === 'sotix' ? 0.1 : 1}
                value={areaStr}
                inputMode="decimal"
                onChange={(e) => setAreaStr(e.target.value)}
                aria-label="Uchastka maydoni"
              />
            </div>
            {errors.area && <span className="error-text">{errors.area}</span>}
            {!errors.area && !Number.isNaN(areaM2) && areaM2 > 0 && (
              <span className="plot-hint">
                <Info className="w-3.5 h-3.5" />
                {unit === 'm2' ? `${round1(m2ToSotix(areaM2))} sotix` : `${Math.round(areaM2)} m²`}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="plot-shape">Uchastka shakli</label>
            <div className="shape-toggle" role="group" aria-label="Uchastka shakli">
              <button
                type="button"
                className={`shape-toggle-btn${shape === 'rect' ? ' is-active' : ''}`}
                aria-pressed={shape === 'rect'}
                onClick={() => setShape('rect')}
              >
                To’g’ri to’rtburchak
              </button>
              <button
                type="button"
                className={`shape-toggle-btn${shape === 'complex' ? ' is-active' : ''}`}
                aria-pressed={shape === 'complex'}
                onClick={() => setShape('complex')}
              >
                Murakkab shakl
              </button>
            </div>
          </div>

          {shape === 'complex' && (
            <div className="calc-row-2">
              <div className="field">
                <label htmlFor="plot-width">Eni (m)</label>
                <div className="plot-dim-input">
                  <input
                    id="plot-width"
                    className={`control${errors.width ? ' is-invalid' : ''}`}
                    type="number"
                    min="1"
                    step="0.1"
                    value={widthStr}
                    inputMode="decimal"
                    onChange={(e) => setWidthStr(e.target.value)}
                  />
                  <Ruler className="plot-dim-icon w-4 h-4" />
                </div>
                {errors.width && <span className="error-text">{errors.width}</span>}
              </div>
              <div className="field">
                <label htmlFor="plot-length">Bo’yi (m)</label>
                <div className="plot-dim-input">
                  <input
                    id="plot-length"
                    className={`control${errors.length ? ' is-invalid' : ''}`}
                    type="number"
                    min="1"
                    step="0.1"
                    value={lengthStr}
                    inputMode="decimal"
                    onChange={(e) => setLengthStr(e.target.value)}
                  />
                  <Ruler className="plot-dim-icon w-4 h-4" />
                </div>
                {errors.length && <span className="error-text">{errors.length}</span>}
              </div>
            </div>
          )}

          {shape === 'complex' && (
            <p className="plot-note">
              <Shapes className="w-4 h-4" />
              Noto’g’ri shakldagi uchastkalar uchun to’g’ri to’rtburchak baho ishlatiladi — aniq ruxsat uchun mutaxassis
              ko’rigi tavsiya etiladi.
            </p>
          )}

          <div className="field">
            <div className="flex items-center justify-between mb-1.5">
              <label className="m-0 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                Qurilish uchun ajratilgan maydon
              </label>
              <span className="plot-coverage-value">{coverage}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={95}
              step={1}
              value={coverage}
              onChange={(e) => setCoverage(Number(e.target.value))}
              className="range-slider"
              style={{
                background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${coverage}%, var(--range-track) ${coverage}%)`,
              }}
              aria-label="Qurilish foizi"
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="plot-hint">
                <Info className="w-3.5 h-3.5" />
                Qolgan qism hovli, yashil maydon va yo’llar uchun qoldiriladi
              </span>
              <span className="plot-hint">5% – 95%</span>
            </div>
            {errors.coverage && <span className="error-text">{errors.coverage}</span>}
            {warnings.coverage && (
              <span className="plot-warning">
                <AlertTriangle className="w-4 h-4" />
                {warnings.coverage}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="plot-setback">
              Ko’chadan orqaga chekinish (m) <span className="plot-optional">— ixtiyoriy</span>
            </label>
            <input
              id="plot-setback"
              className={`control${errors.setback ? ' is-invalid' : ''}`}
              type="number"
              min="0"
              max="50"
              step="0.5"
              value={setbackStr}
              inputMode="decimal"
              onChange={(e) => setSetbackStr(e.target.value)}
            />
            {errors.setback && <span className="error-text">{errors.setback}</span>}
            {!errors.setback && Number(setbackStr) > 0 && (
              <span className="plot-hint">
                <Info className="w-3.5 h-3.5" />
                Chekinish chizig’i qurilish maydonidan chegiriladi
              </span>
            )}
          </div>
        </div>

        {/* ---- Summary + preview ---- */}
        <div className="plot-results">
          {calc ? (
            <>
              <div className="plot-summary">
                <p className="plot-summary-line">
                  <strong>Uchastkangiz:</strong> {formatPlot(calc.areaM2)}
                </p>
                <p className="plot-summary-line">
                  <strong>Qurilish uchun mos maydon:</strong> taxminan {Math.round(calc.footprintM2)} m²
                </p>
                {calc.hasSetback && (
                  <p className="plot-summary-line">
                    <strong>Chekinish maydoni:</strong> {Math.round(calc.setbackM2)} m²
                  </p>
                )}
              </div>

              <div className="plot-preview" aria-hidden="true">
                <svg viewBox="0 0 100 100" className="plot-svg" role="img" aria-label="Uchastka sxematik ko’rinishi">
                  <rect
                    x={preview.x}
                    y={preview.y}
                    width={preview.wU}
                    height={preview.lU}
                    rx={2}
                    className="plot-plot"
                  />
                  {calc.hasSetback && zone.w > 0 && zone.h > 0 && (
                    <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} rx={2} className="plot-zone" />
                  )}
                  {footprintBox && footprintBox.w > 0 && footprintBox.h > 0 && (
                    <rect
                      x={footprintBox.x}
                      y={footprintBox.y}
                      width={footprintBox.w}
                      height={footprintBox.h}
                      rx={2}
                      className="plot-footprint"
                    />
                  )}
                  {pickBox && pickBox.w > 0 && pickBox.h > 0 && (
                    <rect x={pickBox.x} y={pickBox.y} width={pickBox.w} height={pickBox.h} rx={2} className="plot-picked" />
                  )}
                  {!calc.hasSetback && <text x={50} y={51} textAnchor="middle" className="plot-label">{Math.round(calc.areaM2)} m²</text>}
                </svg>
                <div className="plot-legend">
                  <span className="plot-legend-item">
                    <span className="plot-legend-swatch plot-legend-plot" /> Uchastka
                  </span>
                  {calc.hasSetback && (
                    <span className="plot-legend-item">
                      <span className="plot-legend-swatch plot-legend-zone" /> Chekinish
                    </span>
                  )}
                  <span className="plot-legend-item">
                    <span className="plot-legend-swatch plot-legend-footprint" /> Qurilish maydoni
                  </span>
                  {pickBox && (
                    <span className="plot-legend-item">
                      <span className="plot-legend-swatch plot-legend-picked" /> Loyiha izi
                    </span>
                  )}
                </div>
              </div>

              <div className="field">
                <label htmlFor="plot-pick">Loyiha izini maydonda ko’rsatish</label>
                <div className="plot-pick-row">
                  <select
                    id="plot-pick"
                    className="control"
                    value={picked ? String(picked.id) : ''}
                    disabled={pickDisabled}
                    onChange={(e) => {
                      const p = matches.find((m) => String(m.id) === e.target.value);
                      setPicked(p ?? null);
                    }}
                  >
                    <option value="">
                      {pickDisabled ? 'Avval maydonni kiriting' : `${matches.length} ta mos loyiha`}
                    </option>
                    {matches.slice(0, 60).map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        #{m.id} · {Math.round(projectFootprint(m))} m² · {m.area} m² · {m.rooms} xona
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!picked}
                    onClick={() => {
                      if (picked && onOpenProject) onOpenProject(picked);
                    }}
                  >
                    Ko’rish
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="plot-placeholder">
              <LandPlot className="w-10 h-10" style={{ color: 'var(--text-muted)' }} />
              <p>Maydonni kiriting — hisob va sxema shu yerda paydo bo’ladi</p>
            </div>
          )}
        </div>
      </div>

      <div className="plot-matcher-footer">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!calc || matches.length === 0}
          onClick={() => {
            if (matches[0] && onOpenProject) onOpenProject(matches[0]);
          }}
        >
          {matches.length > 0 ? `${matches.length} ta mos loyiha ko’rish` : 'Mos loyihalar yo’q'}
        </button>
        <span className="plot-matcher-fits">
          {calc ? (
            matches.length > 0 ? (
              <>{matches.length} ta loyiha sizning uchastkangizga mos keladi</>
            ) : (
              'Hozircha mos loyiha topilmadi — foizni oshiring yoki boshqa loyihalarni ko’ring'
            )
          ) : (
            ''
          )}
        </span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleClear}>
          <Trash2 className="w-4 h-4" />
          Tozalash
        </button>
      </div>
    </section>
  );
}
