import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api';
import './BookingReviewDisplay.css';

function Stars({ value, size = 'sm' }) {
  return (
    <span className={`review-stars review-stars--${size}`} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={n <= value ? 'star-filled' : 'star-empty'}>★</span>
      ))}
    </span>
  );
}

function DistBar({ label, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="dist-bar">
      <span className="dist-bar-label">{label}</span>
      <div className="dist-bar-track">
        <div className="dist-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="dist-bar-count">{count}</span>
    </div>
  );
}

export default function BookingReviewDisplay({ userId, role, showStats = true }) {
  const [reviews, setReviews] = useState([]);
  const [stats,   setStats]   = useState(null);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(0);
  const PER_PAGE = 10;

  useEffect(() => {
    if (!userId) return;
    const params = new URLSearchParams({ limit: PER_PAGE, offset: page * PER_PAGE, ...(role && { role }) });
    Promise.all([
      apiRequest(`/api/booking-reviews/${userId}?${params}`),
      showStats ? apiRequest(`/api/booking-reviews/stats/${userId}${role ? `?role=${role}` : ''}`) : Promise.resolve(null),
    ]).then(([revData, statsData]) => {
      setReviews(revData.reviews || []);
      setTotal(revData.total || 0);
      if (statsData) setStats(statsData);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [userId, role, page, showStats]);

  const fmtDate = iso => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  if (loading) return <div className="review-display-loading">Loading reviews…</div>;
  if (!reviews.length && !stats?.totalReviews) return null;

  return (
    <div className="review-display">
      {showStats && stats && stats.totalReviews > 0 && (
        <div className="review-stats">
          <div className="review-stats-score">
            <span className="review-stats-avg">{stats.averageRating.toFixed(1)}</span>
            <Stars value={Math.round(stats.averageRating)} size="md" />
            <span className="review-stats-count">{stats.totalReviews} review{stats.totalReviews !== 1 ? 's' : ''}</span>
          </div>

          <div className="review-stats-dist">
            {[5, 4, 3, 2, 1].map(n => (
              <DistBar
                key={n}
                label={`${n}★`}
                count={stats.ratingDistribution?.[n] || 0}
                total={stats.totalReviews}
              />
            ))}
          </div>

          {(stats.avgPunctuality || stats.avgCommunication || stats.avgQuality) && (
            <div className="review-sub-avgs">
              {stats.avgPunctuality   && <span>Punctuality: <strong>{stats.avgPunctuality.toFixed(1)}</strong></span>}
              {stats.avgCommunication && <span>Communication: <strong>{stats.avgCommunication.toFixed(1)}</strong></span>}
              {stats.avgQuality       && <span>Quality: <strong>{stats.avgQuality.toFixed(1)}</strong></span>}
            </div>
          )}
        </div>
      )}

      <div className="review-list">
        {reviews.map(r => (
          <div key={r.id} className="review-item">
            <div className="review-item-header">
              <Stars value={r.rating} size="sm" />
              <span className="review-item-date">{fmtDate(r.createdAt)}</span>
              <span className="review-item-role">{r.role}</span>
            </div>
            {r.comment && <p className="review-item-comment">{r.comment}</p>}
            {(r.punctualityRating || r.communicationRating || r.qualityRating) && (
              <div className="review-item-sub">
                {r.punctualityRating   && <span>Punctuality: <Stars value={r.punctualityRating}   size="xs" /></span>}
                {r.communicationRating && <span>Communication: <Stars value={r.communicationRating} size="xs" /></span>}
                {r.qualityRating       && <span>Quality: <Stars value={r.qualityRating}       size="xs" /></span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {total > PER_PAGE && (
        <div className="review-pagination">
          <button
            className="review-page-btn"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </button>
          <span className="review-page-info">
            {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, total)} of {total}
          </span>
          <button
            className="review-page-btn"
            onClick={() => setPage(p => p + 1)}
            disabled={(page + 1) * PER_PAGE >= total}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
