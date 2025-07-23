import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import './RatingsReview.css';

const RatingsReview = ({ jobId, revieweeId, revieweeName, onSubmit, onClose }) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [categories, setCategories] = useState({
    communication: 0,
    quality: 0,
    timeliness: 0,
    professionalism: 0,
    value: 0
  });
  const [loading, setLoading] = useState(false);

  const categoryLabels = {
    communication: 'Communication',
    quality: 'Quality of Work',
    timeliness: 'Timeliness',
    professionalism: 'Professionalism',
    value: 'Value for Money'
  };

  const handleRating = (value) => setRating(value);
  
  const handleCategoryRating = (category, value) => {
    setCategories(prev => ({
      ...prev,
      [category]: value
    }));
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      alert('Please provide an overall rating');
      return;
    }

    setLoading(true);
    try {
      const API_BASE_URL = process.env.NODE_ENV === 'production' 
        ? 'https://fetchwork-1.onrender.com' 
        : 'http://localhost:10000';
      
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/api/reviews`, {
        jobId,
        revieweeId,
        rating,
        title: title.trim(),
        comment: comment.trim(),
        categories: Object.fromEntries(
          Object.entries(categories).filter(([_, value]) => value > 0)
        )
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      onSubmit(response.data.review);
      onClose();
    } catch (error) {
      console.error('Error submitting review:', error);
      alert(error.response?.data?.error || 'Failed to submit review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const StarRating = ({ value, onChange, size = 'large' }) => (
    <div className={`star-rating ${size}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={star <= (hoverRating || value) ? 'filled' : ''}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHoverRating(star)}
          onMouseLeave={() => setHoverRating(0)}
        >
          ★
        </span>
      ))}
    </div>
  );

  return (
    <div className="modal-review-overlay">
      <div className="modal-review-wrapper">
        <div className="modal-header">
          <h2>Leave a Review for {revieweeName}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="review-section">
            <h3>Overall Rating *</h3>
            <StarRating value={rating} onChange={handleRating} />
          </div>

          <div className="review-section">
            <h3>Review Title</h3>
            <input
              type="text"
              className="review-title-input"
              placeholder="Summarize your experience..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="review-section">
            <h3>Detailed Review</h3>
            <textarea
              className="review-comment"
              placeholder="Share details about your experience working together..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={2000}
            />
            <div className="char-count">{comment.length}/2000 characters</div>
          </div>

          <div className="review-section">
            <h3>Category Ratings (Optional)</h3>
            <div className="category-ratings">
              {Object.entries(categoryLabels).map(([key, label]) => (
                <div key={key} className="category-rating">
                  <label>{label}</label>
                  <StarRating 
                    value={categories[key]} 
                    onChange={(value) => handleCategoryRating(key, value)}
                    size="small"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={handleSubmit}
            disabled={loading || rating === 0}
          >
            {loading ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RatingsReview;
