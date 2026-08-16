import { useReviews } from '../../hooks/useReviews';
import RatingStars from '../ui/RatingStars';
import type { ReviewItemType } from '../../lib/reviews';

interface ReviewSummaryProps {
  itemType: ReviewItemType;
  itemId: string;
  size?: number;
  /** Show the "no reviews yet" placeholder when there are none. */
  placeholder?: boolean;
}

/** Compact inline rating (stars + avg + count) for cards and detail headers. */
export default function ReviewSummary({
  itemType,
  itemId,
  size = 13,
  placeholder = true,
}: ReviewSummaryProps) {
  const { summary } = useReviews(itemType, itemId);

  if (summary.count === 0) {
    if (!placeholder) return null;
    return <span className="review-summary review-summary-empty">Hali sharh yo&apos;q</span>;
  }

  return (
    <span className="review-summary">
      <RatingStars value={summary.display} size={size} ariaLabel={`O'rtacha baho ${summary.avg.toFixed(1)}`} />
      <span className="review-summary-num">{summary.avg.toFixed(1)}</span>
      <span className="review-summary-count">({summary.count})</span>
    </span>
  );
}
