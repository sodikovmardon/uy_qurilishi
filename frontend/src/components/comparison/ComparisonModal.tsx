import { useState } from 'react';
import { ArrowLeftRight, Check } from 'lucide-react';
import Modal from '../ui/Modal';
import { formatUZS } from '../../lib/calculator';
import { totalDiffText, type ComparisonData } from '../../lib/compare';
import { t } from '../../lib/i18n';

export interface CompareAlternative {
  id: string;
  title: string;
}

interface ComparisonModalProps {
  data: ComparisonData | null;
  onClose: () => void;
  /** Optional list of alternatives for the per-side "swap without closing" picker. */
  alternatives?: CompareAlternative[];
  onSwap?: (index: number, id: string) => void;
}

function ValueCell({
  value,
  format,
  lower,
  strong,
}: {
  value: number;
  format: (n: number) => string;
  lower: boolean;
  strong?: boolean;
}) {
  return (
    <span className={`compare-value${lower ? ' compare-value-lower' : ''}${strong ? ' compare-value-strong' : ''}`}>
      {lower && <Check className="w-3.5 h-3.5 compare-tick" aria-hidden="true" />}
      {format(value)}
    </span>
  );
}

/** Side-by-side comparison of two items; lower value per row gets the green accent. */
export default function ComparisonModal({ data, onClose, alternatives, onSwap }: ComparisonModalProps) {
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  if (!data) return null;

  const swapEnabled = typeof onSwap === 'function' && Array.isArray(alternatives);
  const list = swapEnabled ? alternatives : [];

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={t('compare.title')}
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          {t('compare.close')}
        </button>
      }
    >
      <div className="compare-grid">
        <div className="compare-row compare-head">
          <span className="compare-label" aria-hidden="true" />
          <span className="compare-title-cell">
            <span className="compare-title">{data.titleA}</span>
            {swapEnabled && (
              <button
                type="button"
                className={`compare-swap-icon${pickerFor === 0 ? ' is-open' : ''}`}
                aria-label={t('compare.swap')}
                aria-expanded={pickerFor === 0}
                onClick={() => setPickerFor(pickerFor === 0 ? null : 0)}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>
            )}
          </span>
          <span className="compare-title-cell">
            <span className="compare-title">{data.titleB}</span>
            {swapEnabled && (
              <button
                type="button"
                className={`compare-swap-icon${pickerFor === 1 ? ' is-open' : ''}`}
                aria-label={t('compare.swap')}
                aria-expanded={pickerFor === 1}
                onClick={() => setPickerFor(pickerFor === 1 ? null : 1)}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>
            )}
          </span>
        </div>

        {pickerFor !== null && swapEnabled && (
          <div className="compare-swap-picker" role="listbox" aria-label={t('compare.swap')}>
            <p>{t('compare.pickOther')}</p>
            <div className="compare-swap-list">
              {list.length === 0 && <span className="compare-swap-item" aria-disabled="true">Tanlash uchun hisob yo’q</span>}
              {list.map((alt) => (
                <button
                  key={alt.id}
                  type="button"
                  role="option"
                  className="compare-swap-item"
                  onClick={() => {
                    onSwap?.(pickerFor, alt.id);
                    setPickerFor(null);
                  }}
                >
                  {alt.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {data.rows.map((row) => (
          <div key={row.label} className="compare-row">
            <span className="compare-label">{row.label}</span>
            <ValueCell value={row.a} format={row.format} lower={row.a <= row.b} />
            <ValueCell value={row.b} format={row.format} lower={row.b < row.a} />
          </div>
        ))}

        <div className="compare-row compare-total">
          <span className="compare-label">{data.totalLabel}</span>
          <ValueCell value={data.totalA} format={formatUZS} lower={data.totalA <= data.totalB} strong />
          <ValueCell value={data.totalB} format={formatUZS} lower={data.totalB < data.totalA} strong />
        </div>
      </div>

      <p className="compare-diff" role="status">
        {totalDiffText(data.totalA, data.totalB)}
      </p>
    </Modal>
  );
}
