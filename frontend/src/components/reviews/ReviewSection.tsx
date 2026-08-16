import { useEffect, useMemo, useState } from 'react';
import { MessageSquare, PenLine, ThumbsUp } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useReviews } from '../../hooks/useReviews';
import RatingStars from '../ui/RatingStars';
import {
  containsFlaggedContent,
  isHelpfulByMe,
  sortReviews,
  submitReview,
  timeAgo,
  toggleHelpful,
  type Review,
  type ReviewItemType,
  type ReviewSort,
} from '../../lib/reviews';

interface ReviewSectionProps {
  itemType: ReviewItemType;
  itemId: string;
}

const INITIAL_LIMIT = 5;

function ReviewItem({
  review,
  own,
  onEdit,
}: {
  review: Review;
  own: boolean;
  onEdit: () => void;
}) {
  const liked = isHelpfulByMe(review.id);
  const initial = (review.authorName || 'M').charAt(0).toUpperCase();

  return (
    <li className="review-item">
      <div className="review-item-top">
        <span className="review-avatar" aria-hidden="true">
          {initial}
        </span>
        <div className="review-item-main">
          <div className="review-item-head">
            <span className="review-author">
              {review.authorName}
              {own && <span className="review-own-badge">Siz</span>}
            </span>
            <span className="review-time">{timeAgo(review.createdAt)}</span>
          </div>
          <RatingStars value={review.rating} size={13} ariaLabel={`${review.rating} yulduz`} />
        </div>
        <div className="review-item-side">
          <button
            type="button"
            className={`review-helpful${liked ? ' is-liked' : ''}`}
            aria-pressed={liked}
            onClick={() => void toggleHelpful(review.id)}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>{review.helpfulCount > 0 ? review.helpfulCount : ''}</span>
            Foydali
          </button>
          {own && (
            <button type="button" className="review-edit-btn" onClick={onEdit}>
              <PenLine className="w-3.5 h-3.5" />
              Tahrirlash
            </button>
          )}
        </div>
      </div>
      {review.comment && <p className="review-comment">{review.comment}</p>}
    </li>
  );
}

/** Full ratings block for detail views — summary, breakdown, form and list. */
export default function ReviewSection({ itemType, itemId }: ReviewSectionProps) {
  const { showToast } = useApp();
  const { reviews, summary, breakdown, ownReview } = useReviews(itemType, itemId);

  const [formOpen, setFormOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [limit, setLimit] = useState(INITIAL_LIMIT);

  useEffect(() => {
    setFormOpen(false);
    setRating(0);
    setComment('');
    setError(null);
    setSort('newest');
    setLimit(INITIAL_LIMIT);
  }, [itemId]);

  const openForm = (prefill: Review | null) => {
    setRating(prefill?.rating ?? 0);
    setComment(prefill?.comment ?? '');
    setError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setRating(0);
    setComment('');
    setError(null);
  };

  const handleSubmit = () => {
    if (rating < 1 || rating > 5) {
      setError('Yulduzcha tanlang (1–5)');
      return;
    }
    if (comment.trim()) {
      const flagged = containsFlaggedContent(comment);
      if (flagged) {
        setError(flagged);
        return;
      }
    }
    const { created } = submitReview(itemType, itemId, rating, comment);
    setFormOpen(false);
    setRating(0);
    setComment('');
    setError(null);
    setLimit(INITIAL_LIMIT);
    showToast(created ? 'Sharhingiz uchun rahmat!' : 'Sharhingiz yangilandi', 'success');
  };

  const sorted = useMemo(() => sortReviews(reviews, sort), [reviews, sort]);
  const shown = sorted.slice(0, limit);
  const canSort = reviews.length > 5;

  return (
    <section className="review-section">
      <div className="review-section-head">
        <div>
          <h3 className="review-section-title">Sharhlar</h3>
          {summary.count > 0 ? (
            <div className="review-section-score">
              <RatingStars value={summary.display} size={18} />
              <span className="review-section-avg">{summary.avg.toFixed(1)}</span>
              <span className="review-section-muted">
                {summary.count} ta sharh
              </span>
            </div>
          ) : (
            <p className="review-section-muted">Hali sharh qoldirilmagan</p>
          )}
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => (formOpen ? closeForm() : openForm(ownReview))}
        >
          {ownReview ? 'Sharhingizni tahrirlash' : 'Sharh qoldirish'}
        </button>
      </div>

      {summary.count >= 3 && (
        <div className="review-breakdown">
          {breakdown.map((b) => (
            <div key={b.stars} className="review-break-row">
              <span className="review-break-label">{b.stars}</span>
              <span className="review-break-track">
                <span className="review-break-fill" style={{ width: `${b.pct}%` }} />
              </span>
              <span className="review-break-count">{b.count}</span>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <form
          className="review-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="review-form-row">
            <span className="review-form-label">Baholash</span>
            <RatingStars value={rating} interactive size={26} onChange={setRating} ariaLabel="Yulduzlar soni" />
          </div>
          <textarea
            className="review-form-text"
            placeholder="Fikringizni yozing (ixtiyoriy)..."
            value={comment}
            maxLength={500}
            rows={3}
            onChange={(e) => {
              setComment(e.target.value);
              if (error) setError(null);
            }}
          />
          {error && (
            <p className="review-form-error" role="alert">
              {error}
            </p>
          )}
          <div className="review-form-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={closeForm}>
              Bekor qilish
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Yuborish
            </button>
          </div>
        </form>
      )}

      {reviews.length === 0 && (
        <div className="review-empty">
          <MessageSquare className="review-empty-icon" />
          <p>Hali hech kim sharh qoldirmagan. Birinchi bo&apos;ling!</p>
        </div>
      )}

      {canSort && (
        <div className="review-sort">
          <select
            className="review-sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as ReviewSort)}
            aria-label="Sharhlarni saralash"
          >
            <option value="newest">Eng yangi</option>
            <option value="helpful">Eng foydali</option>
          </select>
        </div>
      )}

      {shown.length > 0 && (
        <ul className="review-list">
          {shown.map((r) => (
            <ReviewItem
              key={r.id}
              review={r}
              own={r.id === ownReview?.id}
              onEdit={() => openForm(r)}
            />
          ))}
        </ul>
      )}

      {reviews.length > limit && (
        <button type="button" className="review-more" onClick={() => setLimit((l) => l + 5)}>
          Ko&apos;proq ko&apos;rsatish ({reviews.length - shown.length})
        </button>
      )}
    </section>
  );
}
