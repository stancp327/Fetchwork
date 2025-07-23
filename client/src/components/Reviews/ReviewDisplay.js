import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ReviewDisplay.css';

const ReviewDisplay = ({ userId, showTitle = true }) => {
  const [reviewsData, setReviewsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReviews();
  }, [userId]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const API_BASE_URL = process.env.NODE_ENV === 'production' 
        ? 'https://fetchwork-1.onrender.com' 
        : 'http://localhost:10000';
      
      const response = await axios.get(`${API_BASE_URL}/api/reviews/user/${userId}`);
      setReviewsData(response.data);
      setError(null);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setError('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="star-display">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className={star <= rating ? 'filled' : ''}>
            ★
          </span>
        ))}
      </div>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="reviews-section">
        {showTitle && <h3>Reviews</h3>}
        <div className="loading-reviews">Loading reviews...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reviews-section">
        {showTitle && <h3>Reviews</h3>}
        <div className="error-reviews">{error}</div>
      </div>
    );
  }

  const { reviews, averageRating, pagination } = reviewsData;

  return (
    <div className="reviews-section">
      {showTitle && <h3>Reviews ({pagination?.total || reviews.length})</h3>}
      
      {reviews.length > 0 && (
        <div className="reviews-summary">
          <div className="average-rating">
            {renderStars(Math.round(averageRating))}
            <span className="rating-number">
              {averageRating.toFixed(1)} ({pagination?.total || reviews.length} reviews)
            </span>
          </div>
        </div>
      )}

      <div className="reviews-list">
        {reviews.length === 0 ? (
          <div className="no-reviews">No reviews yet</div>
        ) : (
          reviews.map((review) => (
            <div key={review._id} className="review-item">
              <div className="review-header">
                <div className="reviewer-info">
                  <img 
                    src={review.reviewer.profilePicture || '/default-avatar.png'} 
                    alt={`${review.reviewer.firstName} ${review.reviewer.lastName}`}
                    className="reviewer-avatar"
                  />
                  <div>
                    <div className="reviewer-name">
                      {review.reviewer.firstName} {review.reviewer.lastName}
                    </div>
                    <div className="review-date">{formatDate(review.createdAt)}</div>
                  </div>
                </div>
                {renderStars(review.rating)}
              </div>
              
              {review.title && (
                <h4 className="review-title">{review.title}</h4>
              )}
              
              {review.comment && (
                <p className="review-comment">{review.comment}</p>
              )}
              
              {review.job && (
                <div className="review-job">
                  <span className="job-label">Project:</span> {review.job.title}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ReviewDisplay;
