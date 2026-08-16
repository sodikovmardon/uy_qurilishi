import { useEffect, useMemo, useState } from 'react';
import {
  getOwnReview,
  getReviews,
  getReviewSummary,
  ratingBreakdown,
  subscribeReviews,
  type Review,
  type ReviewItemType,
  type ReviewSummary,
} from '../lib/reviews';

export interface UseReviewsResult {
  reviews: Review[];
  summary: ReviewSummary;
  breakdown: { stars: number; count: number; pct: number }[];
  ownReview: Review | null;
}

/** Reactive reviews for an item — re-reads from LocalStorage on every change. */
export function useReviews(itemType: ReviewItemType, itemId: string): UseReviewsResult {
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeReviews(() => setTick((t) => t + 1)), []);

  return useMemo(
    () => ({
      reviews: getReviews(itemType, itemId),
      summary: getReviewSummary(itemType, itemId),
      breakdown: ratingBreakdown(itemType, itemId),
      ownReview: getOwnReview(itemType, itemId),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemType, itemId, tick],
  );
}
