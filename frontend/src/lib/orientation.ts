/**
 * Quyosh yo'nalishi bo'yicha maslahat (Sun-orientation advisory).
 *
 * Pure data + logic only — no React. The compass dial, advisory cards and
 * energy score all read from here so the rules stay consistent across the
 * project detail, the submission form and the calculator quick-check.
 *
 * Rules use Northern-hemisphere reasoning (Uzbekistan, ~37–45°N):
 *  - Janub faces the sun all day in winter (free passive heating) but
 *    over-heats in summer, so glazing there needs shading.
 *  - Shimol is the coolest / most consistent light; little passive heating.
 *  - Sharq catches morning sun; G'arb the hot afternoon/evening sun.
 *  - The four diagonals blend the effects of the adjacent cardinals.
 */

export type OrientationId =
  | 'shimol'
  | 'shimoli_sharq'
  | 'sharq'
  | 'janubi_sharq'
  | 'janub'
  | 'janubi_garb'
  | 'garb'
  | 'shimoli_garb';

export interface OrientationMeta {
  id: OrientationId;
  /** Full Uzbek display name. */
  label: string;
  /** Compact dial label (kept short so it fits around the compass). */
  short: string;
  /** Compass heading in degrees, North = 0, clockwise. */
  azimuth: number;
  /** One-line takeaway shown under the compass. */
  summary: string;
  /** What this orientation does well. */
  advantages: string[];
  /** What needs design attention (shading, insulation, glazing, …). */
  cautions: string[];
  /** Contribution to the 0–100 energy-efficiency score (orientation only). */
  energyBonus: number;
  /** Store category keywords used to pick recommended products. */
  tags: string[];
}

export const ORIENTATIONS: OrientationMeta[] = [
  {
    id: 'shimol',
    label: 'Shimol',
    short: 'Shimol',
    azimuth: 0,
    summary: "Eng salqin va bir xil yorug'lik",
    advantages: [
      "Yozda qizib ketmaydi — tabiiy salqinlik",
      "Doimiy, bir xil yorug'lik (ofis / yotoqxona uchun qulay)",
    ],
    cautions: [
      "Qishda quyosh isitishi deyarli yo'q",
      "Shimoliy devorga qo'shimcha izolyatsiya kerak",
    ],
    energyBonus: -2,
    tags: ['Izolyatsiya', 'Devor materiallari'],
  },
  {
    id: 'shimoli_sharq',
    label: 'Shimoli-sharq',
    short: 'Sh-sharq',
    azimuth: 45,
    summary: "Ertalab yorug'lik va yozda salqinlik",
    advantages: [
      "Ertalab yumshoq quyosh — oshxona yoki bolalar xonasi uchun yaxshi",
      "Yozda peshindan keyin salqin turadi",
    ],
    cautions: [
      "Qishda quyosh isitishi cheklangan",
      "Shimoliy-sharqiy devorga izolyatsiya qatlamini ko'paytiring",
    ],
    energyBonus: 0,
    tags: ['Izolyatsiya', 'Deraza va eshiklar'],
  },
  {
    id: 'sharq',
    label: 'Sharq',
    short: 'Sharq',
    azimuth: 90,
    summary: "Erta tongda yaxshi tabiiy yorug'lik",
    advantages: [
      "Nonushta / oshxona hududi uchun ertalab ideal yorug'lik",
      "Peshindan keyin quyosh pasayadi — xona tez sovuydi",
    ],
    cautions: [
      "Tongda tez qizib ketishi mumkin",
      "Kechki ishlatiladigan xonalar uchun kam yorug'lik",
    ],
    energyBonus: 2,
    tags: ['Deraza va eshiklar'],
  },
  {
    id: 'janubi_sharq',
    label: 'Janubi-sharq',
    short: 'J-sharq',
    azimuth: 135,
    summary: "Qishda yaxshi isitish + ertalab yorug'lik",
    advantages: [
      "Qishda kuchli tabiiy isitish oladi",
      "Kunning ko'p qismi yorug' bo'ladi",
    ],
    cautions: [
      "Yozda peshin vaqtida qizib ketishi mumkin",
      "Katta oynalarga soyabon yoki jalyuzi o'rnating",
    ],
    energyBonus: 4,
    tags: ['Deraza va eshiklar', 'Tashqi pardozlash'],
  },
  {
    id: 'janub',
    label: 'Janub',
    short: 'Janub',
    azimuth: 180,
    summary: 'Yashash xonalari uchun eng yaxshi yo\u2019nalish',
    advantages: [
      'Qishda tabiiy quyosh isitishi — isitish xarajatini kamaytiradi',
      "Eng ko'p va uzoq davom etadigan tabiiy yorug'lik",
    ],
    cautions: [
      'Yozda haddan tashqari qizib ketishi mumkin',
      "Janubiy oynalar oldiga karniz / soyabon / daraxt qo'ying",
    ],
    energyBonus: 6,
    tags: ['Deraza va eshiklar', 'Tashqi pardozlash'],
  },
  {
    id: 'janubi_garb',
    label: "Janubi-g'arb",
    short: "J-g'arb",
    azimuth: 225,
    summary: "Qishda issiq, yozda kechki quyoshdan ehtiyot",
    advantages: ['Qishda iliq quyosh isitishiga ega'],
    cautions: [
      'Yozda kechqurun qattiq qizib ketadi — soyabon zarur',
      "Konditsioner yuklamasi oshishi mumkin",
    ],
    energyBonus: 1,
    tags: ['Deraza va eshiklar', 'Tashqi pardozlash'],
  },
  {
    id: 'garb',
    label: "G'arb",
    short: "G'arb",
    azimuth: 270,
    summary: "Kechki kuchli quyosh — dam olish xonasi uchun",
    advantages: ['Kechki yumshoq yorug\'lik — dam olish xonasi uchun qulay'],
    cautions: [
      "Yozda kechqurun xona juda qizishi mumkin",
      "Katta oynalarni cheklang yoki daraxt / jalyuzi bilan himoyalang",
      "Sovutish xarajati oshishi mumkin",
    ],
    energyBonus: -3,
    tags: ['Deraza va eshiklar', 'Tashqi pardozlash', 'Isitish va shamollatish'],
  },
  {
    id: 'shimoli_garb',
    label: 'Shimoli-g\u2019arb',
    short: 'Sh-g\'arb',
    azimuth: 315,
    summary: "Yozda salqin, kechki yumshoq yorug'lik",
    advantages: [
      'Yozda salqin turadi',
      "Kechki ishlatiladigan xonalar uchun yumshoq yorug'lik",
    ],
    cautions: ['Qishda quyosh isitishi kam', 'Shimoliy-g\u2019arbiy devorga izolyatsiya kerak'],
    energyBonus: -1,
    tags: ['Izolyatsiya'],
  },
];

export const ORIENTATION_BY_ID: Record<OrientationId, OrientationMeta> = Object.fromEntries(
  ORIENTATIONS.map((o) => [o.id, o]),
) as Record<OrientationId, OrientationMeta>;

export function isOrientationId(value: string | null | undefined): value is OrientationId {
  return Boolean(value && value in ORIENTATION_BY_ID);
}

/** 0–100 energy-efficiency score contribution from orientation alone. */
export function orientationEnergyScore(dir: OrientationId): number {
  const bonus = ORIENTATION_BY_ID[dir].energyBonus;
  return Math.max(40, Math.min(95, 72 + bonus * 4));
}

export function orientationScoreLabel(score: number): string {
  if (score >= 85) return 'Juda yaxshi';
  if (score >= 72) return 'Yaxshi';
  if (score >= 60) return "O'rtacha";
  return 'Past';
}

/**
 * Pick up to `limit` store products relevant to the chosen orientation.
 * Matches against free-form category + product name keywords (the store has
 * no category enum), preferring in-stock items first.
 */
export function productsForOrientation(
  catalog: StoreProductLike[],
  dir: OrientationId,
  limit = 4,
): StoreProductLike[] {
  const tags = ORIENTATION_BY_ID[dir].tags;
  const hay = tags.join('|').toLowerCase();
  const hit = (p: StoreProductLike) => {
    const name = (p.name ?? '').toLowerCase();
    const cat = (p.category ?? '').toLowerCase();
    return (
      tags.some((tag) => cat.includes(tag.toLowerCase())) ||
      name.split(/\s+/).some((w) => hay.includes(w.toLowerCase()))
    );
  };
  return catalog
    .filter((p) => hit(p))
    .sort((a, b) => {
      const stock = (p: StoreProductLike) => (p.stock_status === 'Tugagan' ? 0 : p.stock_status === 'Kam qoldi' ? 1 : 2);
      const sd = stock(b) - stock(a);
      return sd !== 0 ? sd : b.stock_quantity - a.stock_quantity;
    })
    .slice(0, limit);
}

/** Minimal structural type so this module stays free of api imports. */
export interface StoreProductLike {
  id: number;
  name: string;
  category: string;
  unit: string;
  price: number;
  stock_quantity: number;
  stock_status: string;
  images?: string[];
}
