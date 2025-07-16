import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Reviews.css';

const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:10000';
  }
  return window.location.origin.replace(':3000', ':10000');
};

const Reviews = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [userJobs, setUserJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [categoryAverages, setCategoryAverages] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });

  useEffect(() => {
    if (user) {
      fetchUserReviews();
      fetchEligibleJobs();
    }
  }, [user]);

  const fetchUserReviews = async (page = 1) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/reviews/user/${user.id}?page=${page}&limit=10`);
      const data = await response.json();
      
      if (response.ok) {
        setReviews(data.reviews);
        setAverageRating(data.averageRating);
        setTotalReviews(data.totalReviews);
        setCategoryAverages(data.categoryAverages);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEligibleJobs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/api/jobs/my-jobs`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const jobs = await response.json();
        const completedJobs = jobs.filter(job => job.status === 'completed');
        setUserJobs(completedJobs);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={i} className="star filled">★</span>);
    }
    
    if (hasHalfStar) {
      stars.push(<span key="half" className="star half">★</span>);
    }
    
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<span key={`empty-${i}`} className="star empty">☆</span>);
    }
    
    return stars;
  };

  const getReviewTypeLabel = (reviewType) => {
    return reviewType === 'client_to_freelancer' ? 'Client Review' : 'Freelancer Review';
  };

  if (loading) {
    return <div className="reviews-loading">Loading reviews...</div>;
  }

  return (
    <div className="reviews-container">
      <div className="reviews-header">
        <h1>Reviews & Ratings</h1>
        <button 
          className="create-review-btn"
          onClick={() => setShowCreateModal(true)}
          disabled={userJobs.length === 0}
        >
          Write a Review
        </button>
      </div>

      <div className="rating-summary">
        <div className="overall-rating">
          <div className="rating-display">
            <span className="rating-number">{averageRating.toFixed(1)}</span>
            <div className="rating-stars">
              {renderStars(averageRating)}
            </div>
            <span className="rating-count">({totalReviews} reviews)</span>
          </div>
        </div>

        {Object.keys(categoryAverages).length > 0 && (
          <div className="category-ratings">
            <h3>Category Breakdown</h3>
            <div className="category-grid">
              {Object.entries(categoryAverages).map(([category, rating]) => (
                <div key={category} className="category-item">
                  <span className="category-name">
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </span>
                  <div className="category-rating">
                    <span className="category-score">{rating.toFixed(1)}</span>
                    <div className="category-stars">
                      {renderStars(rating)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="reviews-list">
        <h2>Reviews Received</h2>
        {reviews.length === 0 ? (
          <div className="no-reviews">
            <p>No reviews yet. Complete some jobs to start receiving reviews!</p>
          </div>
        ) : (
          <>
            {reviews.map(review => (
              <div key={review._id} className="review-card">
                <div className="review-header">
                  <div className="reviewer-info">
                    <div className="reviewer-avatar">
                      {review.reviewerId.profile?.firstName?.[0]}{review.reviewerId.profile?.lastName?.[0]}
                    </div>
                    <div className="reviewer-details">
                      <h4>{review.reviewerId.profile?.firstName} {review.reviewerId.profile?.lastName}</h4>
                      <span className="review-type">{getReviewTypeLabel(review.reviewType)}</span>
                    </div>
                  </div>
                  <div className="review-rating">
                    <div className="rating-stars">
                      {renderStars(review.rating)}
                    </div>
                    <span className="rating-number">{review.rating}/5</span>
                  </div>
                </div>

                <div className="review-content">
                  <h3 className="review-title">{review.title}</h3>
                  <p className="review-comment">{review.comment}</p>
                  
                  {review.categories && Object.keys(review.categories).length > 0 && (
                    <div className="review-categories">
                      {Object.entries(review.categories).map(([category, rating]) => (
                        <div key={category} className="category-rating-item">
                          <span>{category.charAt(0).toUpperCase() + category.slice(1)}</span>
                          <div className="mini-stars">
                            {renderStars(rating)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="review-footer">
                  <div className="review-meta">
                    <span className="job-title">Job: {review.jobId?.title}</span>
                    <span className="review-date">{formatDate(review.createdAt)}</span>
                  </div>
                  
                  {review.response?.hasResponse && (
                    <div className="review-response">
                      <h5>Response:</h5>
                      <p>{review.response.responseText}</p>
                      <span className="response-date">{formatDate(review.response.responseDate)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {pagination.pages > 1 && (
              <div className="pagination">
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={`page-btn ${pagination.current === page ? 'active' : ''}`}
                    onClick={() => fetchUserReviews(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showCreateModal && (
        <CreateReviewModal
          jobs={userJobs}
          user={user}
          onClose={() => setShowCreateModal(false)}
          onReviewCreated={() => {
            setShowCreateModal(false);
            fetchUserReviews();
          }}
        />
      )}
    </div>
  );
};

const CreateReviewModal = ({ jobs, user, onClose, onReviewCreated }) => {
  const [formData, setFormData] = useState({
    jobId: '',
    revieweeId: '',
    rating: 5,
    title: '',
    comment: '',
    reviewType: '',
    categories: {
      communication: 5,
      quality: 5,
      timeliness: 5,
      professionalism: 5
    }
  });

  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    if (formData.jobId) {
      const job = jobs.find(j => j._id === formData.jobId);
      setSelectedJob(job);
      
      if (job) {
        const isClient = job.clientId === user.id;
        setFormData(prev => ({
          ...prev,
          revieweeId: isClient ? job.assignedTo : job.clientId,
          reviewType: isClient ? 'client_to_freelancer' : 'freelancer_to_client'
        }));
      }
    }
  }, [formData.jobId, jobs, user.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/api/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onReviewCreated();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to create review');
      }
    } catch (error) {
      console.error('Error creating review:', error);
      alert('Failed to create review');
    }
  };

  const handleCategoryChange = (category, value) => {
    setFormData(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: parseInt(value)
      }
    }));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content review-modal">
        <div className="modal-header">
          <h2>Write a Review</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="review-form">
          <div className="form-group">
            <label>Select Job:</label>
            <select
              value={formData.jobId}
              onChange={(e) => setFormData(prev => ({ ...prev, jobId: e.target.value }))}
              required
            >
              <option value="">Choose a completed job...</option>
              {jobs.map(job => (
                <option key={job._id} value={job._id}>
                  {job.title}
                </option>
              ))}
            </select>
          </div>

          {selectedJob && (
            <>
              <div className="form-group">
                <label>Overall Rating:</label>
                <div className="rating-input">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      className={`star-btn ${formData.rating >= star ? 'filled' : ''}`}
                      onClick={() => setFormData(prev => ({ ...prev, rating: star }))}
                    >
                      ★
                    </button>
                  ))}
                  <span className="rating-label">{formData.rating}/5</span>
                </div>
              </div>

              <div className="form-group">
                <label>Review Title:</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Brief summary of your experience"
                  maxLength={100}
                  required
                />
              </div>

              <div className="form-group">
                <label>Review Comment:</label>
                <textarea
                  value={formData.comment}
                  onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
                  placeholder="Share your detailed experience..."
                  maxLength={1000}
                  rows={4}
                  required
                />
              </div>

              <div className="category-ratings-form">
                <h3>Category Ratings</h3>
                {Object.entries(formData.categories).map(([category, rating]) => (
                  <div key={category} className="category-form-group">
                    <label>{category.charAt(0).toUpperCase() + category.slice(1)}:</label>
                    <div className="category-rating-input">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          className={`star-btn small ${rating >= star ? 'filled' : ''}`}
                          onClick={() => handleCategoryChange(category, star)}
                        >
                          ★
                        </button>
                      ))}
                      <span className="rating-label">{rating}/5</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Submit Review
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default Reviews;
