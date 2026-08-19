/**
 * 2D Floor Plan Generator — rule-based rectangular subdivision.
 *
 * Given total area, room count, and floor count, produces a schematic
 * top-down floor plan with proportionally-sized rooms placed by
 * simple space-planning heuristics.
 */

export interface Room {
  id: string;
  name: string;
  nameRu?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  area: number;
  color: string;
  isBathroom?: boolean;
  isEntrance?: boolean;
}

export interface FloorPlan {
  rooms: Room[];
  width: number;
  height: number;
  buildingArea: number;
  floorIndex: number;
}

export interface PlanOptions {
  totalArea: number;
  rooms: number;
  storeys: number;
  hasGarage?: boolean;
  hasPool?: boolean;
  hasTerrace?: boolean;
  variant?: number;
  floorIndex?: number;
}

const ROOM_COLORS: Record<string, string> = {
  'Yashash xonasi': '#4da3ff22',
  'Mehmonxona': '#4da3ff18',
  'Yotoqxona': '#34c75918',
  'Master yotoqxona': '#34c75922',
  'Oshxona': '#ff950018',
  'Hammom': '#00bfa618',
  'Kirish': '#af52de18',
  'Koridor': '#8e8e9318',
  'Garaj': '#ff2d9218',
  'Balkon': '#5856d618',
  'Hovuz': '#00b8d918',
};

const ROOM_NAMES_UZ = [
  'Yashash xonasi',
  'Mehmonxona',
  'Yotoqxona',
  'Master yotoqxona',
  'Oshxona',
  'Hammom',
  'Kirish',
  'Koridor',
];

interface RoomSpec {
  name: string;
  ratio: number;
  isBathroom?: boolean;
}

function generateRoomSpecs(totalRooms: number, opts: PlanOptions): RoomSpec[] {
  const specs: RoomSpec[] = [];
  const n = Math.max(3, totalRooms);

  specs.push({ name: 'Yashash xonasi', ratio: 0.20 });
  specs.push({ name: 'Oshxona', ratio: 0.12 });
  specs.push({ name: 'Hammom', ratio: 0.05, isBathroom: true });
  specs.push({ name: 'Kirish', ratio: 0.04 });

  const remaining = n - 4;
  const bedroomCount = Math.max(1, remaining - 1);
  specs.push({ name: 'Master yotoqxona', ratio: 0.14 });
  for (let i = 1; i < bedroomCount; i++) {
    specs.push({ name: 'Yotoqxona', ratio: 0.09 });
  }

  const hallwayRatio = 0.08;
  specs.push({ name: 'Koridor', ratio: hallwayRatio });

  if (opts.hasGarage) specs.push({ name: 'Garaj', ratio: 0.0 });
  if (opts.hasTerrace) specs.push({ name: 'Balkon', ratio: 0.0 });

  const usedRatio = specs.reduce((s, r) => s + r.ratio, 0);
  const extraRatio = Math.max(0, 1 - usedRatio);
  if (specs.length < n) {
    const needed = n - specs.length;
    const perRoom = extraRatio / Math.max(1, needed);
    for (let i = 0; i < needed; i++) {
      specs.push({ name: 'Yotoqxona', ratio: perRoom });
    }
  } else {
    const boost = extraRatio / specs.length;
    specs.forEach((s) => { s.ratio += boost; });
  }

  const total = specs.reduce((s, r) => s + r.ratio, 0);
  specs.forEach((s) => { s.ratio /= total; });

  return specs;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function subdivideRect(
  rect: Rect,
  count: number,
  rng: () => number,
  minSize: number,
): Rect[] {
  if (count <= 1) return [rect];

  const { x, y, w, h } = rect;
  if (w < minSize * 2 && h < minSize * 2) return [rect];

  const horizontal = h > w ? 0.7 : w > h ? 0.3 : 0.5;
  const goHorizontal = rng() < horizontal;

  if (goHorizontal && h >= minSize * 2) {
    const ratio = 0.3 + rng() * 0.4;
    const split = Math.round(h * ratio);
    const topH = Math.max(minSize, Math.min(split, h - minSize));
    const top: Rect = { x, y, w, h: topH };
    const bottom: Rect = { x, y: y + topH, w, h: h - topH };

    const topCount = Math.max(1, Math.round(count * (topH / h)));
    const bottomCount = count - topCount;

    const results: Rect[] = [];
    results.push(...subdivideRect(top, topCount, rng, minSize));
    if (bottomCount > 0) {
      results.push(...subdivideRect(bottom, bottomCount, rng, minSize));
    }
    return results;
  }

  if (w >= minSize * 2) {
    const ratio = 0.3 + rng() * 0.4;
    const split = Math.round(w * ratio);
    const leftW = Math.max(minSize, Math.min(split, w - minSize));
    const left: Rect = { x, y, w: leftW, h };
    const right: Rect = { x: x + leftW, y, w: w - leftW, h };

    const leftCount = Math.max(1, Math.round(count * (leftW / w)));
    const rightCount = count - leftCount;

    const results: Rect[] = [];
    results.push(...subdivideRect(left, leftCount, rng, minSize));
    if (rightCount > 0) {
      results.push(...subdivideRect(right, rightCount, rng, minSize));
    }
    return results;
  }

  return [rect];
}

function assignRoomsToRects(
  rooms: RoomSpec[],
  rects: Rect[],
  totalArea: number,
  buildingW: number,
  buildingH: number,
  pxPerM2: number,
): Room[] {
  const sorted = [...rooms].sort((a, b) => b.ratio - a.ratio);

  const rectsByArea = [...rects].sort((a, b) => (b.w * b.h) - (a.w * a.h));

  const assigned: Room[] = [];
  const used = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    const spec = sorted[i];
    const targetArea = spec.ratio * totalArea;

    let bestIdx = -1;
    let bestScore = Infinity;

    for (let j = 0; j < rectsByArea.length; j++) {
      if (used.has(j)) continue;
      const r = rectsByArea[j];
      const rArea = r.w * r.h / pxPerM2;
      const score = Math.abs(rArea - targetArea) / targetArea;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = j;
      }
    }

    if (bestIdx >= 0) {
      used.add(bestIdx);
      const r = rectsByArea[bestIdx];
      const actualArea = (r.w * r.h) / pxPerM2;
      assigned.push({
        id: `room-${i}`,
        name: spec.name,
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
        area: Math.round(actualArea * 10) / 10,
        color: ROOM_COLORS[spec.name] || '#8e8e9318',
        isBathroom: spec.isBathroom,
      });
    }
  }

  return assigned;
}

export function generateFloorPlan(opts: PlanOptions): FloorPlan {
  const seed = (opts.variant ?? 0) * 1000 + (opts.floorIndex ?? 0) * 137 + Math.round(opts.totalArea) * 7;
  const rng = seededRandom(seed);

  const totalArea = opts.totalArea;
  const areaPerFloor = totalArea / opts.storeys;

  const aspect = 1.0 + rng() * 0.5;
  const buildingW = Math.round(Math.sqrt(areaPerFloor * aspect) * 10) / 10;
  const buildingH = Math.round((areaPerFloor / buildingW) * 10) / 10;

  const pxPerM2 = 800 / Math.max(buildingW * buildingH, 1) * 8;
  const svgW = Math.max(400, Math.min(800, Math.round(buildingW * pxPerM2)));
  const svgH = Math.max(300, Math.min(600, Math.round(buildingH * pxPerM2)));

  const roomSpecs = generateRoomSpecs(opts.rooms, opts);
  const minSize = 30;
  const rects = subdivideRect(
    { x: 0, y: 0, w: svgW, h: svgH },
    roomSpecs.length,
    rng,
    minSize,
  );

  const rooms = assignRoomsToRects(
    roomSpecs,
    rects,
    areaPerFloor,
    buildingW,
    buildingH,
    pxPerM2,
  );

  const entrance = rooms.find((r) => r.name === 'Kirish');
  if (entrance) {
    entrance.isEntrance = true;
  }

  return {
    rooms,
    width: svgW,
    height: svgH,
    buildingArea: areaPerFloor,
    floorIndex: opts.floorIndex ?? 0,
  };
}

export function generateAllFloors(opts: PlanOptions): FloorPlan[] {
  const plans: FloorPlan[] = [];
  for (let i = 0; i < opts.storeys; i++) {
    plans.push(
      generateFloorPlan({
        ...opts,
        floorIndex: i,
      }),
    );
  }
  return plans;
}

export function downloadSVG(svgEl: SVGSVGElement, filename: string) {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPNG(svgEl: SVGSVGElement, filename: string, scale = 2) {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const w = Number(svgEl.getAttribute('width')) || svgEl.clientWidth || 800;
  const h = Number(svgEl.getAttribute('height')) || svgEl.clientHeight || 600;

  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const img = new Image();
  const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  img.onload = () => {
    ctx.drawImage(img, 0, 0, w * scale, h * scale);
    canvas.toBlob((b) => {
      if (!b) return;
      const u = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = u;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(u);
    }, 'image/png');
    URL.revokeObjectURL(url);
  };
  img.src = url;
}
