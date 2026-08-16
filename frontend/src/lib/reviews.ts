/**
 * User reviews & ratings ("Sharhlar") — Phase 15.
 *
 * Reviews are stored in LocalStorage under "uy:reviews" (demo/prototype
 * store). Every item (project or product) can carry multiple reviews. The
 * reviewer is identified by a stable per-browser id ("uy:reviewer-id") so a
 * user can update their own review and mark "Foydali" only once.
 *
 * The schema keeps an `itemType`/`itemId` pair so a future backend migration
 * can map reviews onto /api/projects/:id and /v1/products/:id.
 */
import { trackEvent } from './analytics';
import { getProfile } from './storage';

export type ReviewItemType = 'project' | 'product';
export type ReviewStatus = 'visible' | 'hidden';
export type ReviewSort = 'newest' | 'helpful';

export interface Review {
  id: string;
  itemType: ReviewItemType;
  itemId: string;
  /** Stable per-browser reviewer id (uy:reviewer-id) — never displayed. */
  reviewerId: string;
  /** Display name — profile name, else "Mehmon". */
  authorName: string;
  /** 1..5 whole stars. */
  rating: number;
  /** Optional free text. */
  comment: string;
  helpfulCount: number;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSummary {
  count: number;
  /** Exact arithmetic mean (0 when there are no reviews). */
  avg: number;
  /** Star value to render — average rounded to the nearest 0.5. */
  display: number;
}

const REVIEWS_KEY = 'uy:reviews';
const REVIEWER_KEY = 'uy:reviewer-id';
const HELPFUL_KEY = 'uy:review-helpful';

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readAll(): Review[] {
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Review[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(list: Review[]): boolean {
  try {
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

// ---- change notifications (cards + detail sections stay in sync) ----

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

export function subscribeReviews(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// ---- reviewer identity ----

export function getReviewerId(): string {
  try {
    let id = localStorage.getItem(REVIEWER_KEY);
    if (!id) {
      id = uid();
      localStorage.setItem(REVIEWER_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

export function getReviewerName(): string {
  const name = getProfile()?.name?.trim();
  return name || 'Mehmon';
}

// ---- reads ----

export function getReviews(itemType: ReviewItemType, itemId: string): Review[] {
  return readAll()
    .filter((r) => r.itemType === itemType && r.itemId === itemId && r.status === 'visible')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getOwnReview(itemType: ReviewItemType, itemId: string): Review | null {
  const reviewerId = getReviewerId();
  return (
    readAll().find(
      (r) =>
        r.itemType === itemType &&
        r.itemId === itemId &&
        r.reviewerId === reviewerId &&
        r.status === 'visible',
    ) ?? null
  );
}

export function hasReviewed(itemType: ReviewItemType, itemId: string): boolean {
  return getOwnReview(itemType, itemId) !== null;
}

export function getReviewSummary(itemType: ReviewItemType, itemId: string): ReviewSummary {
  const list = getReviews(itemType, itemId);
  const count = list.length;
  if (count === 0) return { count: 0, avg: 0, display: 0 };
  const avg = list.reduce((s, r) => s + r.rating, 0) / count;
  return { count, avg, display: Math.round(avg * 2) / 2 };
}

/** Average rating (0 when none) — used by "Reyting bo'yicha" sorts. */
export function ratingOf(itemType: ReviewItemType, itemId: string): number {
  return getReviewSummary(itemType, itemId).avg;
}

export function reviewCountOf(itemType: ReviewItemType, itemId: string): number {
  return getReviewSummary(itemType, itemId).count;
}

/** 5→1 star counts with share percentages for the breakdown bars. */
export function ratingBreakdown(itemType: ReviewItemType, itemId: string): { stars: number; count: number; pct: number }[] {
  const list = getReviews(itemType, itemId);
  const total = list.length;
  const out: { stars: number; count: number; pct: number }[] = [];
  for (let s = 5; s >= 1; s--) {
    const count = list.filter((r) => r.rating === s).length;
    out.push({ stars: s, count, pct: total ? Math.round((count / total) * 100) : 0 });
  }
  return out;
}

export function sortReviews(list: Review[], sort: ReviewSort): Review[] {
  const arr = [...list];
  if (sort === 'helpful') {
    arr.sort((a, b) => b.helpfulCount - a.helpfulCount || b.createdAt.localeCompare(a.createdAt));
  } else {
    arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return arr;
}

// ---- mutations ----

/** Insert or update the current reviewer's review for the item. */
export function submitReview(
  itemType: ReviewItemType,
  itemId: string,
  rating: number,
  comment: string,
): { review: Review; created: boolean } {
  const list = readAll();
  const reviewerId = getReviewerId();
  const now = new Date().toISOString();
  const existing = list.find(
    (r) =>
      r.itemType === itemType && r.itemId === itemId && r.reviewerId === reviewerId && r.status === 'visible',
  );
  if (existing) {
    const updated: Review = { ...existing, rating, comment: comment.trim(), updatedAt: now };
    list[list.indexOf(existing)] = updated;
    writeAll(list);
    trackEvent('review_update', { itemType, itemId, rating });
    emit();
    return { review: updated, created: false };
  }
  const review: Review = {
    id: uid(),
    itemType,
    itemId,
    reviewerId,
    authorName: getReviewerName(),
    rating,
    comment: comment.trim(),
    helpfulCount: 0,
    status: 'visible',
    createdAt: now,
    updatedAt: now,
  };
  list.push(review);
  writeAll(list);
  trackEvent('review_submit', { itemType, itemId, rating });
  emit();
  return { review, created: true };
}

function readVotes(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(HELPFUL_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeVotes(votes: Record<string, string[]>): void {
  try {
    localStorage.setItem(HELPFUL_KEY, JSON.stringify(votes));
  } catch {
    /* quota — ignore */
  }
}

/** Toggle "Foydali" for the current reviewer; returns the new liked state. */
export function toggleHelpful(reviewId: string): boolean {
  const list = readAll();
  const review = list.find((r) => r.id === reviewId);
  if (!review) return false;
  const reviewerId = getReviewerId();
  const votes = readVotes();
  const arr = votes[reviewId] ?? [];
  const idx = arr.indexOf(reviewerId);
  let liked: boolean;
  if (idx >= 0) {
    arr.splice(idx, 1);
    liked = false;
  } else {
    arr.push(reviewerId);
    liked = true;
  }
  votes[reviewId] = arr;
  writeVotes(votes);
  review.helpfulCount = arr.length;
  writeAll(list);
  trackEvent('review_helpful', { reviewId, liked });
  emit();
  return liked;
}

export function isHelpfulByMe(reviewId: string): boolean {
  return (readVotes()[reviewId] ?? []).includes(getReviewerId());
}

// ---- time formatting ----

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'hozirgina';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} daqiqa oldin`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} soat oldin`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} kun oldin`;
  return new Date(iso).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---- moderation (profanity / spam / shouting) ----

const PROFANITY = new Set<string>([
  // uzbek
  'ahmoq', 'axmoq', 'debil', 'idiot', 'kreting', 'urvo', 'zapadlo',
  // russian
  'бля', 'блядь', 'сука', 'хуй', 'хуя', 'хер', 'нахер', 'пизд', 'заеб', 'ебан', 'мразь',
  'тварь', 'ублюдок', 'говно', 'дерьмо', 'жопа', 'пиздец', 'охуен', 'нахуй', 'шлюха',
  'лох', 'дурак', 'дебил', 'идиот', 'козел', 'сволочь', 'сучка', 'сосать',
  // english
  'fuck', 'fucking', 'shit', 'bitch', 'asshole', 'bastard', 'damn', 'crap', 'dick',
  'douche', 'moron', 'retard', 'dumbass', 'motherfucker', 'piss', 'whore', 'slut',
  'twat', 'wanker',
]);

const LINK_PATTERN = /(https?:\/\/|www\.)|\b[\w-]+\.(com|net|org|ru|uz|info|io|xyz|biz)\b/i;
const REPEATED_PATTERN = /([a-zа-яёўәғқңҳөүіӣ])\1{4,}/i;
const EXCESS_PUNCT = /!{4,}|\?{4,}/;

/** Returns a user-facing (Uzbek) warning message, or null when the text is clean. */
export function containsFlaggedContent(text: string): string | null {
  const cleaned = text.toLowerCase().replace(/[0134@$5]/g, (ch) =>
    ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '@': 'a', '$': 's', '5': 's' })[ch] ?? ch,
  );
  const tokens = cleaned.split(/[^a-zа-яёўәғқңҳөүіӣ]+/).filter(Boolean);
  if (tokens.some((tk) => PROFANITY.has(tk))) {
    return 'Iltimos, haqoratli so\'zlardan saqlaning.';
  }
  if (LINK_PATTERN.test(text)) {
    return 'Sharhda havola (link) yuborish mumkin emas.';
  }
  if (/(^|[\s(])[A-ZА-ЯЁӢӮЎҒҚҢҲ]{4,}[\s.).!?,]/.test(text)) {
    return 'Iltimos, katta harflarda yozmang.';
  }
  if (REPEATED_PATTERN.test(text)) {
    return 'Yozuvda takrorlanuvchi harflar juda ko\'p.';
  }
  if (EXCESS_PUNCT.test(text)) {
    return 'Ortiqcha belgilar (!!!, ???) ishlatmang.';
  }
  return null;
}
