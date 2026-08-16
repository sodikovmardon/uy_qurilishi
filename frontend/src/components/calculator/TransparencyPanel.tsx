import { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import type { CalcInputs, CalcResult } from '../../lib/calculator';
import { formatUZS, getBrickType, getThicknessFactor } from '../../lib/calculator';
import { MORTAR } from '../../config/prices';

interface Props {
  inputs: CalcInputs;
  result: CalcResult;
}

interface Row {
  id: string;
  title: string;
  plain: string;
  example: string;
  source: string;
}

/**
 * "Qanday hisoblanadi?" — expandable formula explanations in plain language,
 * with a worked example built from the user's current inputs.
 */
export default function TransparencyPanel({ inputs, result }: Props) {
  const [open, setOpen] = useState<string | null>('brick');

  if (!result.valid) return null;

  const brick = getBrickType(inputs.brickId);
  const factor = getThicknessFactor(inputs.thickness);
  const wallArea = Math.round(inputs.wallLength * inputs.wallHeight * inputs.rooms * 100) / 100;

  const rows: Row[] = [
    {
      id: 'brick',
      title: 'G’isht soni',
      plain: `Devor maydoni (uzunlik × balandlik × xonalar) ${brick.perM2} dona/m² tezligiga bo’linadi. Keyin devor qalinligi omili va ${Math.round(MORTAR.wasteFactor * 100)}% zaxira qo’shiladi — chunki qurilishda g’isht siniq va kesilgan qismlar bo’ladi.`,
      example: `${inputs.wallLength} × ${inputs.wallHeight} × ${inputs.rooms} = ${wallArea} m² → ${Math.round(wallArea * brick.perM2 * factor)} × 1,0${Math.round(MORTAR.wasteFactor * 100)} ≈ ${result.bricks} dona`,
      source: 'bosqich: devorlar',
    },
    {
      id: 'cement',
      title: 'Sement (qop)',
      plain: 'Har 1000 dona g’isht uchun o’rtacha 2,5 qop (50 kg) sement qorishmasi kerak bo’ladi. Ya’ni g’isht sonini 1000 ga bo’lib, 2,5 ga ko’paytiramiz.',
      example: `${result.bricks} ÷ 1000 × ${MORTAR.cementBagsPer1000} ≈ ${result.cementBags} qop`,
      source: 'bosqich: devorlar',
    },
    {
      id: 'sand',
      title: 'Qum (m³)',
      plain: 'Har 1000 dona g’isht uchun 0,3 m³ qum qorishma tayyorlashga sarflanadi. Sementga o’xshab, g’isht soniga nisbatan hisoblanadi.',
      example: `${result.bricks} ÷ 1000 × ${MORTAR.sandM3Per1000} ≈ ${result.sandM3} m³`,
      source: 'bosqich: devorlar',
    },
    {
      id: 'total',
      title: 'Umumiy summa',
      plain: `Har bir material miqdori uning narxiga ko’paytiriladi va natijalar qo’shiladi. Hudud tanlovi narxlarga mintaqaviy koeffitsiyent qo’shadi.`,
      example: `G’isht + sement + qum = ${formatUZS(result.total)}`,
      source: 'narxlar: sozlash paneli',
    },
  ];

  return (
    <div className="transparency-panel" aria-labelledby="transparency-title">
      <div className="transparency-head">
        <div>
          <h4 id="transparency-title" className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Qanday hisoblanadi?
          </h4>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Joriy qiymatlaringiz bilan misol — raqamlar sizning kiritgan o’lchamlaringizdan olingan
          </p>
        </div>
        <Info className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
      </div>

      <div className="transparency-rows">
        {rows.map((row) => {
          const isOpen = open === row.id;
          return (
            <div key={row.id} className="transparency-row">
              <button
                type="button"
                className="transparency-toggle"
                aria-expanded={isOpen}
                aria-controls={`transparency-body-${row.id}`}
                onClick={() => setOpen(isOpen ? null : row.id)}
              >
                <span>{row.title}</span>
                <span className="transparency-src">{row.source}</span>
                <ChevronDown className={`w-4 h-4 chevron${isOpen ? ' open' : ''}`} />
              </button>
              {isOpen && (
                <div id={`transparency-body-${row.id}`} className="transparency-body fade-in">
                  <p>{row.plain}</p>
                  <div className="transparency-example">
                    <span>Masalan:</span> {row.example}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
