import React, { useState } from 'react';
import { apiRequest } from '../../utils/api';
import './BookingReviewForm.css';

const SUB_RATINGS = [
  { key: 'punctualityRating',   label: 'Punctuality' },
  { key: 'communicationRating', label: 'Communication' },
  { key: 'qualityRating',       label: 'Quality of work' },
];

function StarRow({ value, onChange, label, size = 'lg' }) {
  const [hover, setHover] = useState(0);
  return (
    <div className={`star-row star-row--${size}`}>
      {label && <span className="star-row-label">{label}</span>}
      <div className="stars">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            className={`star-btn ${n <= (hover || value) ? 'star-btn--filled' : ''}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            aria-label={`${n} star${n !== 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
      </div>
      {size === 'lg' && value > 0 && (
        <span className="star-value-label">
          {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][value]}
        </span>
      )}
    </div>
  );
}

export default function BookingReviewForm({ bookingId, onSubmitted, onCancel }) {
  const [rating,              setRating]              = useState(0);
  const [comment,             setComment]             = useState('');
  const [showSubRatings,      setShowSubRatings]      = useState(false);
  const [punctualityRating,   setPunctualityRating]   = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [qualityRating,       setQualityRating]       = useState(0);
  const [submitting,          setSubmitting]          = useState(false);
  const [error,               setError]               = useState(null);

  const handleSubmit = async () => {
    if (!rating) { setError('Please select a rating.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        bookingId,
        rating,
        comment: comment.trim() || undefined,
        ...(showSubRatings && punctualityRating   && { punctualityRating }),
        ...(showSubRatings && communicationRating && { communicationRating }),
        ...(showSubRatings && qualityRating       && { qualityRating }),
      };
      const data = await apiRequest('/api/booking-reviews', { method: 'POST', body: JSON.stringify(body) });
      onSubmitted?.(data.review);
    } catch (err) {
      setError(err.message || 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="review-form">
      <h3 className="review-form-title">Leave a Review</h3>
      <p className="review-form-sub">Your feedback helps the community. How was your experience?</p>

      {error && <div className="review-form-error">{error}</div>}

      <div className="review-form-section">
        <label className="review-form-label">Overall rating *</label>
        <StarRow value={rating} onChange={setRating} size="lg" />
      </div>

      <div className="review-form-section">
        <label className="review-form-label" htmlFor="review-comment">Comment (optional)</label>
        <textarea
          id="review-comment"
          className="review-form-textarea"
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Share details about your experience…"
          rows={3}
          maxLength={1000}
        />
        <span className="review-form-char-count">{comment.length}/1000</span>
      </div>

      <button
        type="button"
        className="review-form-toggle-sub"
        onClick={() => setShowSubRatings(v => !v)}
      >
        {showSubRatings ? '▲ Hide detailed ratings' : '▼ Add detailed ratings (optional)'}
      </button>

      {showSubRatings && (
        <div className="review-form-sub-ratings">
          {SUB_RATINGS.map(({ key, label }) => {
            const val = key === 'punctualityRating' ? punctualityRating
              : key === 'communicationRating'       ? communicationRating
              : qualityRating;
            const setter = key === 'punctualityRating' ? setPunctualityRating
              : key === 'communicationRating'           ? setCommunicationRating
              : setQualityRating;
            return (
              <StarRow key={key} value={val} onChange={setter} label={label} size="sm" />
            );
          })}
        </div>
      )}

      <div className="review-form-actions">
        <button
          className="review-form-submit-btn"
          onClick={handleSubmit}
          disabled={submitting || !rating}
        >
          {submitting ? 'Submitting…' : 'Submit Review'}
        </button>
        {onCancel && (
          <button className="review-form-cancel-btn" onClick={onCancel} type="button">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
