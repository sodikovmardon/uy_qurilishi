import { useMemo, useRef } from 'react';
import { Download, Image, RefreshCw } from 'lucide-react';
import type { FloorPlan } from '../../lib/floorPlanGenerator';
import { downloadPNG, downloadSVG } from '../../lib/floorPlanGenerator';

interface FloorPlanSVGProps {
  plan: FloorPlan;
  theme?: 'dark' | 'blueprint';
  onRegenerate?: () => void;
  floorCount?: number;
  activeFloor?: number;
  onFloorChange?: (i: number) => void;
  allPlans?: FloorPlan[];
}

const WALL_OUTER = 2.5;
const WALL_INNER = 1.5;
const DOOR_GAP = 14;
const DOOR_ARC_R = 12;
const PADDING = 28;
const SCALE_BAR_M = 2;

export function FloorPlanSVG({
  plan,
  theme = 'dark',
  onRegenerate,
  floorCount = 1,
  activeFloor = 0,
  onFloorChange,
  allPlans,
}: FloorPlanSVGProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isDark = theme === 'dark';
  const bg = isDark ? '#0d0d10' : '#f0f4f8';
  const wallColor = isDark ? '#e0e0e0' : '#1a2332';
  const textColor = isDark ? '#c8c8cc' : '#2c3e50';
  const labelColor = isDark ? '#8e8e93' : '#6b7280';
  const gridColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
  const doorColor = isDark ? '#4da3ff' : '#2563eb';
  const entranceColor = isDark ? '#34c759' : '#16a34a';
  const scaleColor = isDark ? '#8e8e93' : '#6b7280';

  const totalW = plan.width + PADDING * 2;
  const totalH = plan.height + PADDING * 2 + 40;

  const doors = useMemo(() => {
    const result: { x: number; y: number; angle: number; main?: boolean }[] = [];
    const r = plan.rooms;
    for (let i = 0; i < r.length; i++) {
      for (let j = i + 1; j < r.length; j++) {
        const a = r[i];
        const b = r[j];
        const sharedX = Math.abs(a.x - b.x) < 2 && Math.abs(a.x + a.w - (b.x + b.w)) < 2;
        const sharedY = Math.abs(a.y - b.y) < 2 && Math.abs(a.y + a.h - (b.y + b.h)) < 2;

        if (sharedX && Math.abs(a.y + a.h - b.y) < 4) {
          const doorX = a.x + Math.min(a.w, b.w) * 0.35 + PADDING;
          const doorY = a.y + a.h + PADDING;
          result.push({ x: doorX, y: doorY, angle: 0 });
        } else if (sharedX && Math.abs(b.y + b.h - a.y) < 4) {
          const doorX = b.x + Math.min(b.w, a.w) * 0.35 + PADDING;
          const doorY = b.y + b.h + PADDING;
          result.push({ x: doorX, y: doorY, angle: 0 });
        } else if (sharedY && Math.abs(a.x + a.w - b.x) < 4) {
          const doorX = a.x + a.w + PADDING;
          const doorY = a.y + Math.min(a.h, b.h) * 0.35 + PADDING;
          result.push({ x: doorX, y: doorY, angle: 90 });
        } else if (sharedY && Math.abs(b.x + b.w - a.x) < 4) {
          const doorX = b.x + b.w + PADDING;
          const doorY = b.y + Math.min(b.h, a.h) * 0.35 + PADDING;
          result.push({ x: doorX, y: doorY, angle: 90 });
        }
      }
    }

    const entrance = r.find((room) => room.isEntrance);
    if (entrance) {
      result.push({
        x: entrance.x + entrance.w * 0.4 + PADDING,
        y: entrance.y + entrance.h + PADDING,
        angle: 0,
        main: true,
      });
    }

    return result;
  }, [plan]);

  const scaleBarPx = SCALE_BAR_M * (plan.width / (totalW - PADDING * 2)) * (totalW - PADDING * 2) / (totalW / 80);

  return (
    <div className="floor-plan-container">
      {floorCount > 1 && onFloorChange && (
        <div className="floor-plan-tabs">
          {Array.from({ length: floorCount }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`floor-tab${activeFloor === i ? ' is-active' : ''}`}
              onClick={() => onFloorChange(i)}
            >
              {i + 1}-qavat
            </button>
          ))}
        </div>
      )}

      <div className="floor-plan-svg-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${totalW} ${totalH}`}
          className="floor-plan-svg"
          style={{ background: bg }}
        >
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke={gridColor} strokeWidth="0.5" />
            </pattern>
          </defs>

          <rect width={totalW} height={totalH} fill={gridColor} />
          <rect
            x={PADDING}
            y={PADDING}
            width={plan.width}
            height={plan.height}
            fill="url(#grid)"
            stroke={gridColor}
            strokeWidth="0"
          />

          {plan.rooms.map((room) => (
            <g key={room.id}>
              <rect
                x={room.x + PADDING}
                y={room.y + PADDING}
                width={room.w}
                height={room.h}
                fill={room.color}
                stroke={wallColor}
                strokeWidth={WALL_OUTER}
                rx="1"
              />

              <text
                x={room.x + room.w / 2 + PADDING}
                y={room.y + room.h / 2 + PADDING - 6}
                textAnchor="middle"
                fill={textColor}
                fontSize="11"
                fontWeight="600"
                fontFamily="system-ui, sans-serif"
              >
                {room.name}
              </text>
              <text
                x={room.x + room.w / 2 + PADDING}
                y={room.y + room.h / 2 + PADDING + 8}
                textAnchor="middle"
                fill={labelColor}
                fontSize="9"
                fontFamily="system-ui, sans-serif"
              >
                {room.area} m²
              </text>
            </g>
          ))}

          {plan.rooms.map((room) => (
            <g key={`wall-${room.id}`}>
              <line
                x1={room.x + PADDING}
                y1={room.y + PADDING}
                x2={room.x + room.w + PADDING}
                y2={room.y + PADDING}
                stroke={wallColor}
                strokeWidth={WALL_INNER}
                opacity="0.4"
              />
              <line
                x1={room.x + PADDING}
                y1={room.y + room.h + PADDING}
                x2={room.x + room.w + PADDING}
                y2={room.y + room.h + PADDING}
                stroke={wallColor}
                strokeWidth={WALL_INNER}
                opacity="0.4"
              />
              <line
                x1={room.x + PADDING}
                y1={room.y + PADDING}
                x2={room.x + PADDING}
                y2={room.y + room.h + PADDING}
                stroke={wallColor}
                strokeWidth={WALL_INNER}
                opacity="0.4"
              />
              <line
                x1={room.x + room.w + PADDING}
                y1={room.y + PADDING}
                x2={room.x + room.w + PADDING}
                y2={room.y + room.h + PADDING}
                stroke={wallColor}
                strokeWidth={WALL_INNER}
                opacity="0.4"
              />
            </g>
          ))}

          {doors.map((d, i) => (
            <g key={`door-${i}`}>
              <rect
                x={d.x - (d.angle === 90 ? 1 : DOOR_GAP / 2)}
                y={d.y - (d.angle === 90 ? DOOR_GAP / 2 : 1)}
                width={d.angle === 90 ? 2 : DOOR_GAP}
                height={d.angle === 90 ? DOOR_GAP : 2}
                fill={d.main ? entranceColor : doorColor}
                opacity="0.8"
              />
              <path
                d={
                  d.angle === 0
                    ? `M ${d.x - DOOR_GAP / 2} ${d.y} A ${DOOR_ARC_R} ${DOOR_ARC_R} 0 0 1 ${d.x + DOOR_GAP / 2} ${d.y - DOOR_ARC_R}`
                    : `M ${d.x} ${d.y - DOOR_GAP / 2} A ${DOOR_ARC_R} ${DOOR_ARC_R} 0 0 1 ${d.x + DOOR_ARC_R} ${d.y + DOOR_GAP / 2}`
                }
                fill="none"
                stroke={d.main ? entranceColor : doorColor}
                strokeWidth="1"
                opacity="0.5"
                strokeDasharray="2 1"
              />
            </g>
          ))}

          <g transform={`translate(${PADDING}, ${totalH - 12})`}>
            <line x1="0" y1="0" x2={scaleBarPx} y2="0" stroke={scaleColor} strokeWidth="1.5" />
            <line x1="0" y1="-3" x2="0" y2="3" stroke={scaleColor} strokeWidth="1.5" />
            <line x1={scaleBarPx} y1="-3" x2={scaleBarPx} y2="3" stroke={scaleColor} strokeWidth="1.5" />
            <text x={scaleBarPx / 2} y="-5" textAnchor="middle" fill={scaleColor} fontSize="8" fontFamily="system-ui, sans-serif">
              {SCALE_BAR_M}m
            </text>
          </g>

          <g transform={`translate(${totalW - 30}, ${PADDING + 15})`}>
            <line x1="0" y1="12" x2="0" y2="-8" stroke={scaleColor} strokeWidth="1.2" markerEnd="url(#arrow)" />
            <defs>
              <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill={scaleColor} />
              </marker>
            </defs>
            <text x="5" y="-2" fill={scaleColor} fontSize="7" fontFamily="system-ui, sans-serif">Shimol</text>
          </g>

          <text x={PADDING} y={14} fill={labelColor} fontSize="9" fontFamily="system-ui, sans-serif" fontWeight="500">
            {plan.buildingArea} m² · {plan.floorIndex + 1}-qavat
          </text>
        </svg>
      </div>

      <div className="floor-plan-actions">
        {onRegenerate && (
          <button type="button" className="fp-action-btn" onClick={onRegenerate} title="Boshqa variant">
            <RefreshCw className="w-3.5 h-3.5" />
            Boshqa variant
          </button>
        )}
        <button
          type="button"
          className="fp-action-btn"
          onClick={() => svgRef.current && downloadSVG(svgRef.current, `reja-${plan.floorIndex + 1}qavat.svg`)}
          title="SVG yuklab olish"
        >
          <Download className="w-3.5 h-3.5" />
          SVG
        </button>
        <button
          type="button"
          className="fp-action-btn"
          onClick={() => svgRef.current && downloadPNG(svgRef.current, `reja-${plan.floorIndex + 1}qavat.png`)}
          title="PNG yuklab olish"
        >
          <Image className="w-3.5 h-3.5" />
          PNG
        </button>
      </div>
    </div>
  );
}
