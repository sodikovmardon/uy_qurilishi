import { useCallback, useMemo, useState } from 'react';
import {
  generateAllFloors,
  generateFloorPlan,
  type FloorPlan,
  type PlanOptions,
} from '../../lib/floorPlanGenerator';
import { FloorPlanSVG } from './FloorPlanSVG';
import { FloorPlan3D } from './FloorPlan3D';

interface FloorPlanGeneratorProps {
  totalArea: number;
  rooms: number;
  storeys: number;
  hasGarage?: boolean;
  hasPool?: boolean;
  hasTerrace?: boolean;
}

type ViewMode = '2d' | '3d';

export default function FloorPlanGenerator({
  totalArea,
  rooms,
  storeys,
  hasGarage,
  hasPool,
  hasTerrace,
}: FloorPlanGeneratorProps) {
  const [variant, setVariant] = useState(0);
  const [activeFloor, setActiveFloor] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('2d');
  const [theme, setTheme] = useState<'dark' | 'blueprint'>('blueprint');

  const opts: PlanOptions = useMemo(
    () => ({
      totalArea: Math.max(20, totalArea),
      rooms: Math.max(3, Math.min(50, rooms)),
      storeys: Math.max(1, Math.min(5, storeys)),
      hasGarage,
      hasPool,
      hasTerrace,
      variant,
    }),
    [totalArea, rooms, storeys, hasGarage, hasPool, hasTerrace, variant],
  );

  const plans: FloorPlan[] = useMemo(() => generateAllFloors(opts), [opts]);

  const activePlan = plans[Math.min(activeFloor, plans.length - 1)] || plans[0];

  const handleRegenerate = useCallback(() => {
    setVariant((v) => v + 1);
    setActiveFloor(0);
  }, []);

  if (totalArea < 20 || rooms < 1) {
    return (
      <div className="floor-plan-placeholder">
        <p>Maydon va xonalar sonini kiriting — reja avtomatik yaratiladi</p>
      </div>
    );
  }

  return (
    <div className="floor-plan-generator">
      <div className="fp-header">
        <h3 className="fp-title">Auto-reja</h3>
        <div className="fp-header-actions">
          <div className="fp-view-toggle">
            <button
              type="button"
              className={`fp-view-btn${viewMode === '2d' ? ' is-active' : ''}`}
              onClick={() => setViewMode('2d')}
            >
              2D chizma
            </button>
            <button
              type="button"
              className={`fp-view-btn${viewMode === '3d' ? ' is-active' : ''}`}
              onClick={() => setViewMode('3d')}
            >
              3D ko'rinish
            </button>
          </div>
          {viewMode === '2d' && (
            <button
              type="button"
              className="fp-theme-btn"
              onClick={() => setTheme((t) => (t === 'dark' ? 'blueprint' : 'dark'))}
              title="Rejim o'zgartirish"
            >
              {theme === 'dark' ? 'Blueprint' : 'Dark'}
            </button>
          )}
        </div>
      </div>

      {viewMode === '2d' ? (
        <FloorPlanSVG
          plan={activePlan}
          theme={theme}
          onRegenerate={handleRegenerate}
          floorCount={storeys}
          activeFloor={activeFloor}
          onFloorChange={setActiveFloor}
          allPlans={plans}
        />
      ) : (
        <FloorPlan3D plans={plans} roofStyle="flat" />
      )}
    </div>
  );
}
