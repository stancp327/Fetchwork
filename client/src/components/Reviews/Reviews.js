import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import './Reviews.css';

const Reviews = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMyReviews();
  }, []);

  const fetchMyReviews = async () => {
    try {
      setLoading(true);
      const API_BASE_URL = process.env.NODE_ENV === 'production' 
        ? 'https://fetchwork-1.onrender.com' 
        : 'http://localhost:10000';
      
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/reviews/my-reviews`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setReviews(response.data.reviews || []);
      setError(null);
    } catch (error) {
      console.error('Error fetching my reviews:', error);
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

  if (loading) {
    return (
      <div className="reviews-page">
        <h1>My Reviews</h1>
        <div className="loading">Loading reviews...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reviews-page">
        <h1>My Reviews</h1>
        <div className="error">{error}</div>
      </div>
    );
  }

  const givenReviews = reviews.filter(r => r.reviewer._id === user._id);
  const receivedReviews = reviews.filter(r => r.reviewee._id === user._id);

  return (
    <div className="reviews-page">
      <h1>My Reviews</h1>
      
      <div className="reviews-tabs">
        <div className="reviews-section">
          <h2>Reviews I've Received ({receivedReviews.length})</h2>
          {receivedReviews.length === 0 ? (
            <p>No reviews received yet</p>
          ) : (
            receivedReviews.map(review => (
              <div key={review._id} className="review-card">
                <div className="review-header">
                  <div className="reviewer-info">
                    <strong>{review.reviewer.firstName} {review.reviewer.lastName}</strong>
                    <span className="review-date">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {renderStars(review.rating)}
                </div>
                {review.title && <h3>{review.title}</h3>}
                {review.comment && <p>{review.comment}</p>}
                <div className="job-info">Project: {review.job.title}</div>
              </div>
            ))
          )}
        </div>

        <div className="reviews-section">
          <h2>Reviews I've Given ({givenReviews.length})</h2>
          {givenReviews.length === 0 ? (
            <p>No reviews given yet</p>
          ) : (
            givenReviews.map(review => (
              <div key={review._id} className="review-card">
                <div className="review-header">
                  <div className="reviewer-info">
                    <strong>To: {review.reviewee.firstName} {review.reviewee.lastName}</strong>
                    <span className="review-date">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {renderStars(review.rating)}
                </div>
                {review.title && <h3>{review.title}</h3>}
                {review.comment && <p>{review.comment}</p>}
                <div className="job-info">Project: {review.job.title}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Reviews;
