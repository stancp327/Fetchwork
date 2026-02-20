import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import './Reviews.css';

// ── Stars Component ─────────────────────────────────────────────
const Stars = ({ rating, size = 'sm' }) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <span key={i} className={`star ${i <= Math.round(rating) ? 'filled' : ''}`}>
        ★
      </span>
    );
  }
  return <span className={`stars stars-${size}`}>{stars}</span>;
};

// ── Star Input Component ────────────────────────────────────────
const StarInput = ({ value, onChange, label }) => {
  const [hover, setHover] = useState(0);
  return (
    <div className="form-group">
      {label && <label>{label}</label>}
      <div className="star-input">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`star-btn ${star <= (hover || value) ? 'active' : ''}`}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Rating Distribution Bars ────────────────────────────────────
const RatingBars = ({ reviews, total }) => {
  const distribution = [0, 0, 0, 0, 0];
  reviews.forEach((r) => {
    const idx = Math.min(Math.max(Math.round(r.rating) - 1, 0), 4);
    distribution[idx]++;
  });

  return (
    <div className="reviews-summary-bars">
      {[5, 4, 3, 2, 1].map((rating) => {
        const count = distribution[rating - 1];
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={rating} className="rating-bar-row">
            <span className="label">{rating} star</span>
            <div className="rating-bar-track">
              <div className="rating-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="count">{count}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── Review Card ─────────────────────────────────────────────────
const ReviewCard = ({ review, currentUserId, onHelpful }) => {
  const reviewer = review.reviewer || {};
  const initials = `${(reviewer.firstName || '?')[0]}${(reviewer.lastName || '?')[0]}`;
  const name = `${reviewer.firstName || 'Anonymous'} ${reviewer.lastName || ''}`.trim();
  const date = new Date(review.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const categories = review.categories || {};
  const categoryEntries = Object.entries(categories).filter(
    ([, val]) => val !== null && val !== undefined
  );

  const hasVoted =
    review.helpfulVotes?.voters?.includes(currentUserId) || false;

  return (
    <div className="review-card">
      <div className="review-card-header">
        <div className="review-card-author">
          <div className="review-card-avatar">
            {reviewer.profilePicture ? (
              <img src={reviewer.profilePicture} alt={name} />
            ) : (
              initials
            )}
          </div>
          <div className="review-card-author-info">
            <div className="name">{name}</div>
            <div className="meta">
              {review.reviewerType === 'client' ? 'Client' : 'Freelancer'} · {date}
              {review.isEdited && ' · Edited'}
            </div>
          </div>
        </div>
        <div className="review-card-rating">
          <Stars rating={review.rating} />
          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {review.rating.toFixed(1)}
          </span>
        </div>
      </div>

      {review.title && <div className="review-card-title">{review.title}</div>}

      {review.comment && (
        <div className="review-card-comment">{review.comment}</div>
      )}

      {categoryEntries.length > 0 && (
        <div className="review-card-categories">
          {categoryEntries.map(([key, val]) => (
            <span key={key} className="category-badge">
              {key}: <span className="category-score">{val}/5</span>
            </span>
          ))}
        </div>
      )}

      {review.response?.comment && (
        <div className="review-response">
          <div className="response-label">Response from freelancer</div>
          <div className="response-text">{review.response.comment}</div>
        </div>
      )}

      <div className="review-card-footer">
        <div className="review-card-job">
          {review.job?.title && <>Job: {review.job.title}</>}
        </div>
        <div className="review-card-actions">
          <button
            className={`btn-helpful ${hasVoted ? 'voted' : ''}`}
            onClick={() => onHelpful(review._id)}
          >
            👍 Helpful{' '}
            {review.helpfulVotes?.count > 0 && `(${review.helpfulVotes.count})`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Write Review Form ───────────────────────────────────────────
const WriteReviewForm = ({ jobId, revieweeId, reviewerType, onSubmit, onCancel }) => {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [categories, setCategories] = useState({
    communication: 0,
    quality: 0,
    timeliness: 0,
    professionalism: 0,
    value: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleCategoryChange = (key, val) => {
    setCategories((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Please select an overall rating');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const catPayload = {};
      Object.entries(categories).forEach(([k, v]) => {
        if (v > 0) catPayload[k] = v;
      });

      await apiRequest('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          jobId,
          revieweeId,
          reviewerType,
          rating,
          title,
          comment,
          categories: Object.keys(catPayload).length > 0 ? catPayload : undefined,
        }),
      });
      onSubmit();
    } catch (err) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="write-review-form" onSubmit={handleSubmit}>
      <h2>Write a Review</h2>

      {error && <div className="reviews-error">{error}</div>}

      <StarInput value={rating} onChange={setRating} label="Overall Rating *" />

      <div className="form-group">
        <label>Title (optional)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Summarize your experience"
          maxLength={100}
        />
      </div>

      <div className="form-group">
        <label>Your Review</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share details about your experience..."
          maxLength={2000}
        />
      </div>

      <div className="form-group">
        <label>Category Ratings (optional)</label>
        <div className="category-ratings">
          {Object.entries(categories).map(([key, val]) => (
            <div key={key} className="category-rating-item">
              <label>{key}</label>
              <StarInput value={val} onChange={(v) => handleCategoryChange(key, v)} />
            </div>
          ))}
        </div>
      </div>

      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn-submit" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit Review'}
        </button>
      </div>
    </form>
  );
};

// ── Main Reviews Component ──────────────────────────────────────
const Reviews = () => {
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();

  const revieweeId = searchParams.get('revieweeId') || (user?._id || user?.userId);
  const jobId = searchParams.get('jobId');
  const reviewerType = searchParams.get('reviewerType');
  const showForm = searchParams.get('write') === 'true';

  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState({ averageRating: 0, totalReviews: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [sortBy, setSortBy] = useState('newest');
  const [showWriteForm, setShowWriteForm] = useState(showForm);

  const fetchReviews = useCallback(async () => {
    if (!revieweeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(
        `/api/reviews?revieweeId=${revieweeId}&page=${page}&limit=10`
      );
      let sorted = [...(data.reviews || [])];
      if (sortBy === 'highest') sorted.sort((a, b) => b.rating - a.rating);
      else if (sortBy === 'lowest') sorted.sort((a, b) => a.rating - b.rating);
      else sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setReviews(sorted);
      setPagination(data.pagination || { total: 0, pages: 1 });
      setAverageRating(data.averageRating || { averageRating: 0, totalReviews: 0 });
    } catch (err) {
      setError(err.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [revieweeId, page, sortBy]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleHelpful = async (reviewId) => {
    try {
      await apiRequest(`/api/reviews/${reviewId}/helpful`, { method: 'POST' });
      fetchReviews();
    } catch (err) {
      console.error('Failed to vote helpful:', err);
    }
  };

  const handleReviewSubmitted = () => {
    setShowWriteForm(false);
    setPage(1);
    fetchReviews();
  };

  const currentUserId = user?._id || user?.userId;

  if (loading) {
    return (
      <div className="reviews-container">
        <div className="reviews-loading">Loading reviews...</div>
      </div>
    );
  }

  return (
    <div className="reviews-container">
      <h1>Reviews</h1>

      {error && <div className="reviews-error">{error}</div>}

      {/* Summary */}
      {averageRating.totalReviews > 0 && (
        <div className="reviews-summary">
          <div className="reviews-summary-score">
            <div className="score">
              {averageRating.averageRating?.toFixed(1) || '0.0'}
            </div>
            <Stars rating={averageRating.averageRating || 0} />
            <div className="total">{averageRating.totalReviews} review{averageRating.totalReviews !== 1 ? 's' : ''}</div>
          </div>
          <RatingBars reviews={reviews} total={averageRating.totalReviews} />
        </div>
      )}

      {/* Write Review */}
      {showWriteForm && jobId && revieweeId && reviewerType && (
        <WriteReviewForm
          jobId={jobId}
          revieweeId={revieweeId}
          reviewerType={reviewerType}
          onSubmit={handleReviewSubmitted}
          onCancel={() => setShowWriteForm(false)}
        />
      )}

      {/* Toolbar */}
      {reviews.length > 0 && (
        <div className="reviews-toolbar">
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Showing {reviews.length} of {pagination.total} reviews
          </span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest">Highest Rated</option>
            <option value="lowest">Lowest Rated</option>
          </select>
        </div>
      )}

      {/* Review List */}
      {reviews.length === 0 && !loading && (
        <div className="reviews-empty">
          <div className="empty-icon">⭐</div>
          <p>No reviews yet</p>
        </div>
      )}

      {reviews.map((review) => (
        <ReviewCard
          key={review._id}
          review={review}
          currentUserId={currentUserId}
          onHelpful={handleHelpful}
        />
      ))}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)' }}>
          <button
            className="btn-cancel"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Previous
          </button>
          <span style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Page {page} of {pagination.pages}
          </span>
          <button
            className="btn-cancel"
            disabled={page === pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default Reviews;
