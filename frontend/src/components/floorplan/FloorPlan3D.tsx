import { useEffect, useRef, useState, useCallback } from 'react';
import { Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import type { FloorPlan } from '../../lib/floorPlanGenerator';

interface FloorPlan3DProps {
  plans: FloorPlan[];
  wallHeight?: number;
  roofStyle?: 'flat' | 'gable' | 'hip';
  roofColor?: string;
}

interface Vec3 { x: number; y: number; z: number; }

function project(p: Vec3, cx: number, cy: number, scale: number, rotY: number): [number, number] {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const rx = p.x * cos - p.z * sin;
  const rz = p.x * sin + p.z * cos;
  const iso = 0.6;
  const px = cx + rx * scale;
  const py = cy - p.y * scale + rz * scale * iso;
  return [px, py];
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  pts: Vec3[],
  cx: number, cy: number, scale: number, rotY: number,
  fill: string,
  stroke?: string,
  strokeWidth?: number,
) {
  const projected = pts.map((p) => project(p, cx, cy, scale, rotY));
  ctx.beginPath();
  ctx.moveTo(projected[0][0], projected[0][1]);
  for (let i = 1; i < projected.length; i++) {
    ctx.lineTo(projected[i][0], projected[i][1]);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth || 0.5;
    ctx.stroke();
  }
}

export function FloorPlan3D({ plans, wallHeight = 3, roofStyle = 'flat', roofColor = '#b0b0b0' }: FloorPlan3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotY, setRotY] = useState(0.5);
  const [zoom, setZoom] = useState(1);
  const dragging = useRef(false);
  const lastX = useRef(0);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const darkMode = document.documentElement.classList.contains('dark');
    const bgColor = darkMode ? '#0d0d10' : '#f0f4f8';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    if (plans.length === 0) return;

    const firstPlan = plans[0];
    const bldgW = firstPlan.width / 80;
    const bldgD = firstPlan.height / 80;
    const totalH = plans.length * wallHeight;
    const maxDim = Math.max(bldgW, bldgD, totalH);
    const scale = (Math.min(w, h) * 0.35 / maxDim) * zoom;
    const cx = w / 2;
    const cy = h / 2 + totalH * scale * 0.2;

    const wallColor = darkMode ? 'rgba(220,220,230,0.85)' : 'rgba(40,50,60,0.85)';
    const wallStroke = darkMode ? 'rgba(180,180,190,0.6)' : 'rgba(20,30,40,0.4)';
    const windowColor = darkMode ? 'rgba(77,163,255,0.4)' : 'rgba(37,99,235,0.3)';
    const floorColor = darkMode ? 'rgba(60,60,70,0.3)' : 'rgba(200,200,210,0.3)';

    const floors = plans.map((plan, fi) => {
      const baseY = fi * wallHeight;
      const rooms = plan.rooms;
      return { baseY, rooms, fi };
    });

    const sortedFaces: { z: number; draw: () => void }[] = [];

    floors.forEach(({ baseY, rooms }) => {
      sortedFaces.push({
        z: -bldgD / 2,
        draw: () => {
          drawFace(ctx,
            [
              { x: -bldgW / 2, y: baseY, z: -bldgD / 2 },
              { x: bldgW / 2, y: baseY, z: -bldgD / 2 },
              { x: bldgW / 2, y: baseY + wallHeight, z: -bldgD / 2 },
              { x: -bldgW / 2, y: baseY + wallHeight, z: -bldgD / 2 },
            ],
            cx, cy, scale, rotY,
            floorColor, wallStroke, 0.8,
          );
        },
      });

      sortedFaces.push({
        z: -bldgW / 2,
        draw: () => {
          drawFace(ctx,
            [
              { x: -bldgW / 2, y: baseY, z: -bldgD / 2 },
              { x: -bldgW / 2, y: baseY, z: bldgD / 2 },
              { x: -bldgW / 2, y: baseY + wallHeight, z: bldgD / 2 },
              { x: -bldgW / 2, y: baseY + wallHeight, z: -bldgD / 2 },
            ],
            cx, cy, scale, rotY,
            wallColor, wallStroke, 0.8,
          );
        },
      });

      const numWindows = Math.max(1, Math.floor(bldgW / 3));
      for (let i = 0; i < numWindows; i++) {
        const wx = -bldgW / 2 + (i + 1) * bldgW / (numWindows + 1);
        const ww = bldgW / (numWindows + 1) * 0.4;
        const wh = wallHeight * 0.45;
        const wy = baseY + wallHeight * 0.35;
        sortedFaces.push({
          z: -bldgD / 2 + 0.01,
          draw: () => {
            drawFace(ctx,
              [
                { x: wx - ww / 2, y: wy, z: -bldgD / 2 - 0.01 },
                { x: wx + ww / 2, y: wy, z: -bldgD / 2 - 0.01 },
                { x: wx + ww / 2, y: wy + wh, z: -bldgD / 2 - 0.01 },
                { x: wx - ww / 2, y: wy + wh, z: -bldgD / 2 - 0.01 },
              ],
              cx, cy, scale, rotY,
              windowColor,
            );
          },
        });
      }

      sortedFaces.push({
        z: bldgW / 2,
        draw: () => {
          drawFace(ctx,
            [
              { x: bldgW / 2, y: baseY, z: -bldgD / 2 },
              { x: bldgW / 2, y: baseY, z: bldgD / 2 },
              { x: bldgW / 2, y: baseY + wallHeight, z: bldgD / 2 },
              { x: bldgW / 2, y: baseY + wallHeight, z: -bldgD / 2 },
            ],
            cx, cy, scale, rotY,
            wallColor, wallStroke, 0.8,
          );
        },
      });

      sortedFaces.push({
        z: bldgD / 2,
        draw: () => {
          drawFace(ctx,
            [
              { x: -bldgW / 2, y: baseY, z: bldgD / 2 },
              { x: bldgW / 2, y: baseY, z: bldgD / 2 },
              { x: bldgW / 2, y: baseY + wallHeight, z: bldgD / 2 },
              { x: -bldgW / 2, y: baseY + wallHeight, z: bldgD / 2 },
            ],
            cx, cy, scale, rotY,
            wallColor, wallStroke, 0.8,
          );
        },
      });
    });

    const topY = plans.length * wallHeight;
    sortedFaces.push({
      z: 0,
      draw: () => {
        if (roofStyle === 'gable') {
          drawFace(ctx,
            [
              { x: -bldgW / 2, y: topY, z: -bldgD / 2 },
              { x: bldgW / 2, y: topY, z: -bldgD / 2 },
              { x: bldgW / 2, y: topY, z: bldgD / 2 },
              { x: -bldgW / 2, y: topY, z: bldgD / 2 },
            ],
            cx, cy, scale, rotY,
            roofColor,
          );
          drawFace(ctx,
            [
              { x: -bldgW / 2, y: topY, z: -bldgD / 2 },
              { x: bldgW / 2, y: topY, z: -bldgD / 2 },
              { x: 0, y: topY + wallHeight * 0.5, z: -bldgD / 2 },
            ],
            cx, cy, scale, rotY,
            roofColor, wallStroke, 0.5,
          );
          drawFace(ctx,
            [
              { x: -bldgW / 2, y: topY, z: bldgD / 2 },
              { x: bldgW / 2, y: topY, z: bldgD / 2 },
              { x: 0, y: topY + wallHeight * 0.5, z: bldgD / 2 },
            ],
            cx, cy, scale, rotY,
            roofColor, wallStroke, 0.5,
          );
          drawFace(ctx,
            [
              { x: -bldgW / 2, y: topY, z: -bldgD / 2 },
              { x: -bldgW / 2, y: topY, z: bldgD / 2 },
              { x: 0, y: topY + wallHeight * 0.5, z: bldgD / 2 },
              { x: 0, y: topY + wallHeight * 0.5, z: -bldgD / 2 },
            ],
            cx, cy, scale, rotY,
            roofColor, wallStroke, 0.5,
          );
          drawFace(ctx,
            [
              { x: bldgW / 2, y: topY, z: -bldgD / 2 },
              { x: bldgW / 2, y: topY, z: bldgD / 2 },
              { x: 0, y: topY + wallHeight * 0.5, z: bldgD / 2 },
              { x: 0, y: topY + wallHeight * 0.5, z: -bldgD / 2 },
            ],
            cx, cy, scale, rotY,
            roofColor, wallStroke, 0.5,
          );
        } else if (roofStyle === 'hip') {
          const inset = Math.min(bldgW, bldgD) * 0.15;
          drawFace(ctx,
            [
              { x: -bldgW / 2 + inset, y: topY + wallHeight * 0.4, z: -bldgD / 2 + inset },
              { x: bldgW / 2 - inset, y: topY + wallHeight * 0.4, z: -bldgD / 2 + inset },
              { x: bldgW / 2, y: topY, z: -bldgD / 2 },
              { x: -bldgW / 2, y: topY, z: -bldgD / 2 },
            ],
            cx, cy, scale, rotY,
            roofColor, wallStroke, 0.5,
          );
          drawFace(ctx,
            [
              { x: -bldgW / 2 + inset, y: topY + wallHeight * 0.4, z: bldgD / 2 - inset },
              { x: bldgW / 2 - inset, y: topY + wallHeight * 0.4, z: bldgD / 2 - inset },
              { x: bldgW / 2, y: topY, z: bldgD / 2 },
              { x: -bldgW / 2, y: topY, z: bldgD / 2 },
            ],
            cx, cy, scale, rotY,
            roofColor, wallStroke, 0.5,
          );
          drawFace(ctx,
            [
              { x: -bldgW / 2 + inset, y: topY + wallHeight * 0.4, z: -bldgD / 2 + inset },
              { x: -bldgW / 2 + inset, y: topY + wallHeight * 0.4, z: bldgD / 2 - inset },
              { x: -bldgW / 2, y: topY, z: bldgD / 2 },
              { x: -bldgW / 2, y: topY, z: -bldgD / 2 },
            ],
            cx, cy, scale, rotY,
            roofColor, wallStroke, 0.5,
          );
          drawFace(ctx,
            [
              { x: bldgW / 2 - inset, y: topY + wallHeight * 0.4, z: -bldgD / 2 + inset },
              { x: bldgW / 2 - inset, y: topY + wallHeight * 0.4, z: bldgD / 2 - inset },
              { x: bldgW / 2, y: topY, z: bldgD / 2 },
              { x: bldgW / 2, y: topY, z: -bldgD / 2 },
            ],
            cx, cy, scale, rotY,
            roofColor, wallStroke, 0.5,
          );
          drawFace(ctx,
            [
              { x: -bldgW / 2 + inset, y: topY + wallHeight * 0.4, z: -bldgD / 2 + inset },
              { x: bldgW / 2 - inset, y: topY + wallHeight * 0.4, z: -bldgD / 2 + inset },
              { x: bldgW / 2 - inset, y: topY + wallHeight * 0.4, z: bldgD / 2 - inset },
              { x: -bldgW / 2 + inset, y: topY + wallHeight * 0.4, z: bldgD / 2 - inset },
            ],
            cx, cy, scale, rotY,
            roofColor,
          );
        } else {
          drawFace(ctx,
            [
              { x: -bldgW / 2, y: topY, z: -bldgD / 2 },
              { x: bldgW / 2, y: topY, z: -bldgD / 2 },
              { x: bldgW / 2, y: topY, z: bldgD / 2 },
              { x: -bldgW / 2, y: topY, z: bldgD / 2 },
            ],
            cx, cy, scale, rotY,
            roofColor, wallStroke, 0.5,
          );
        }
      },
    });

    sortedFaces.sort((a, b) => {
      const cos = Math.cos(rotY);
      const sin = Math.sin(rotY);
      const za = a.z * sin;
      const zb = b.z * sin;
      return za - zb;
    });

    sortedFaces.forEach((f) => f.draw());

    const labelColor = darkMode ? '#8e8e93' : '#6b7280';
    ctx.fillStyle = labelColor;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${plans.length * wallHeight}m balandlik · ${plans.length} qavat`, cx, h - 10);
  }, [plans, rotY, zoom, wallHeight, roofStyle, roofColor]);

  useEffect(() => {
    render();
  }, [render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e: MouseEvent | TouchEvent) => {
      dragging.current = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      lastX.current = clientX;
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const dx = clientX - lastX.current;
      lastX.current = clientX;
      setRotY((r) => r + dx * 0.008);
    };
    const onUp = () => { dragging.current = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)));
    };

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('touchstart', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <div className="floor-plan-3d-container">
      <canvas
        ref={canvasRef}
        className="floor-plan-3d-canvas"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      />
      <div className="floor-plan-3d-controls">
        <button type="button" className="fp-action-btn" onClick={() => setRotY(0.5)} title="Qayta ishga tushirish">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="fp-action-btn" onClick={() => setZoom((z) => Math.min(3, z + 0.2))} title="Kattalashtirish">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="fp-action-btn" onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))} title="Kichiklashtirish">
          <Minimize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
