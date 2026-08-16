import { useMemo, useState } from 'react';
import { Banknote, ChevronDown, Wallet } from 'lucide-react';
import { formatUZS } from '../../lib/calculator';
import { useApp } from '../../context/AppContext';

interface Props {
  total: number;
}

const TERMS = [12, 24, 36];

/**
 * "Kredit kalkulyatori" — optional financing estimate next to the cost
 * breakdown. Standard amortization math; clearly labeled as an estimate.
 *
 * NOTE: TERMS, default rate and the amortization formula below are hardcoded
 * mock values. Replace with a real financing API (loan_terms, interest_rate)
 * when one exists.
 */
export default function LoanCalculator({ total }: Props) {
  const { showToast } = useApp();
  const [open, setOpen] = useState(false);
  const [down, setDown] = useState(() => Math.round(total * 0.3));
  const [term, setTerm] = useState(24);
  const [rate, setRate] = useState(24);

  const loanAmount = Math.max(0, total - down);

  const { monthly, totalInterest, totalRepaid } = useMemo(() => {
    if (loanAmount <= 0) return { monthly: 0, totalInterest: 0, totalRepaid: 0 };
    const r = rate / 100 / 12;
    const m = (loanAmount * r) / (1 - Math.pow(1 + r, -term));
    return {
      monthly: Math.round(m),
      totalInterest: Math.round(m * term - loanAmount),
      totalRepaid: Math.round(m * term),
    };
  }, [loanAmount, rate, term]);

  return (
    <div className="loan-panel" aria-labelledby="loan-title">
      <button
        type="button"
        className="loan-toggle"
        aria-expanded={open}
        aria-controls="loan-body"
        onClick={() => setOpen((v) => !v)}
      >
        <Banknote className="w-4 h-4" />
        <span>
          <span id="loan-title">Kredit kalkulyatori</span>
          <span className="loan-toggle-sub">Oylik to’lovni baholang</span>
        </span>
        <ChevronDown className={`w-4 h-4 chevron${open ? ' open' : ''}`} />
      </button>

      {open && (
        <div id="loan-body" className="loan-body fade-in">
          <div className="loan-fields">
            <div className="field">
              <label htmlFor="loan-down">Boshlang’ich to’lov (UZS)</label>
              <input
                id="loan-down"
                className="control"
                type="number"
                min="0"
                step="100000"
                value={down}
                onChange={(e) => setDown(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="loan-rate">Yillik foiz (%)</label>
              <input
                id="loan-rate"
                className="control"
                type="number"
                min="0.1"
                max="60"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="field">
            <label>Muddat</label>
            <div className="segmented loan-terms" role="group" aria-label="Kredit muddati">
              {TERMS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`segmented-btn${term === m ? ' is-active' : ''}`}
                  onClick={() => setTerm(m)}
                >
                  {m} oy
                </button>
              ))}
            </div>
          </div>

          <div className="loan-result">
            <div className="loan-result-main">
              <span className="tile-label">Oylik to’lov</span>
              <strong>{formatUZS(monthly)}</strong>
            </div>
            <div className="loan-result-side">
              <span className="loan-result-row">
                <span>Kredit miqdori</span>
                <strong>{formatUZS(loanAmount)}</strong>
              </span>
              <span className="loan-result-row">
                <span>Jami to’lanadigan foiz</span>
                <strong>{formatUZS(totalInterest)}</strong>
              </span>
              <span className="loan-result-row">
                <span>Jami qaytariladigan</span>
                <strong>{formatUZS(totalRepaid)}</strong>
              </span>
            </div>
          </div>

          <p className="loan-disclaimer">
            <Wallet className="w-3.5 h-3.5" />
            Taxminiy hisob — aniq shartlar bank bilan kelishiladi. Amortizatsiya va kreditor to’lovlari hisobga olingan.
          </p>
        </div>
      )}
    </div>
  );
}
