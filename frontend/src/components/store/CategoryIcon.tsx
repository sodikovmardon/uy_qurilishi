import type { LucideIcon } from 'lucide-react';
import {
  BrickWall,
  DoorOpen,
  Droplets,
  Flame,
  Hammer,
  Layers,
  Package,
  PaintBucket,
  Paintbrush,
  Plug,
  Shovel,
  Timer,
  TreePine,
  Truck,
  Wrench,
} from 'lucide-react';

/**
 * Category-based placeholder icon shown when a product has no photo.
 * Every store category maps to a distinct icon; unknown categories fall
 * back to a generic package icon.
 */
const CATEGORY_ICONS: Record<string, { Icon: LucideIcon; tone: string }> = {
  'Poydevor va tuproq ishlari': { Icon: Shovel, tone: 'tile-icon-green' },
  'Beton va tarkibiy qismlari': { Icon: Package, tone: 'tile-icon-blue' },
  'Devor materiallari': { Icon: BrickWall, tone: 'tile-icon-orange' },
  'Metall va armatura': { Icon: Hammer, tone: 'tile-icon-purple' },
  "Yog'och materiallari": { Icon: TreePine, tone: 'tile-icon-green' },
  'Tom yopish materiallari': { Icon: Timer, tone: 'tile-icon-amber' },
  'Izolyatsiya': { Icon: Layers, tone: 'tile-icon-cyan' },
  'Deraza va eshiklar': { Icon: DoorOpen, tone: 'tile-icon-amber' },
  'Elektr materiallari': { Icon: Plug, tone: 'tile-icon-indigo' },
  'Santexnika': { Icon: Droplets, tone: 'tile-icon-cyan' },
  'Isitish va shamollatish': { Icon: Flame, tone: 'tile-icon-pink' },
  'Ichki pardozlash': { Icon: Paintbrush, tone: 'tile-icon-pink' },
  'Tashqi pardozlash': { Icon: PaintBucket, tone: 'tile-icon-blue' },
  "Bog'lovchi materiallar": { Icon: Layers, tone: 'tile-icon-orange' },
  'Asbob-uskunalar': { Icon: Wrench, tone: 'tile-icon-purple' },
  'Basseyn va tashqi maydon': { Icon: TreePine, tone: 'tile-icon-teal' },

  // legacy aliases so old category names still render a matching icon
  "G'isht": { Icon: BrickWall, tone: 'tile-icon-orange' },
  Sement: { Icon: Package, tone: 'tile-icon-blue' },
  Qum: { Icon: Truck, tone: 'tile-icon-green' },
  Metall: { Icon: Hammer, tone: 'tile-icon-purple' },
  "Bo'yoqlar": { Icon: PaintBucket, tone: 'tile-icon-blue' },
};

const DEFAULT = { Icon: Package as LucideIcon, tone: 'tile-icon-blue' };

export default function CategoryIcon({ category, size = 28 }: { category: string; size?: number }) {
  const { Icon, tone } = CATEGORY_ICONS[category] ?? DEFAULT;
  return (
    <span className={`store-cat-icon ${tone}`} aria-hidden="true">
      <Icon style={{ width: size, height: size }} />
    </span>
  );
}
