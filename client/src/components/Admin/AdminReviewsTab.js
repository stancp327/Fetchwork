import React, { useState } from 'react';
import { apiRequest } from '../../utils/api';
import TracingErrorBoundary from '../common/TracingErrorBoundary';

const AdminReviewsTab = ({ reviewsData, fetchReviewsData }) => {
  const [checkResults, setCheckResults] = useState({});
  const [checkingId, setCheckingId] = useState(null);

  const handleAICheck = async (review) => {
    setCheckingId(review._id);
    try {
      const data = await apiRequest('/api/ai/detect-fake-review', {
        method: 'POST',
        body: JSON.stringify({
          reviewText: review.comment || review.text || '',
          rating: review.rating,
          reviewerHistory: {
            totalReviews: review.reviewer?.reviewCount,
            avgRating: review.reviewer?.avgRating,
            accountAgeDays: review.reviewer?.createdAt
              ? Math.floor((Date.now() - new Date(review.reviewer.createdAt).getTime()) / 86400000)
              : undefined,
          },
        }),
      });
      setCheckResults(prev => ({ ...prev, [review._id]: data }));
    } catch {
      alert('Failed to analyze review.');
    } finally { setCheckingId(null); }
  };

  return (
    <TracingErrorBoundary componentName="ReviewsTab">
      <div className="reviews-tab">
        <h2>Review Management</h2>
        {reviewsData ? (
          <div className="reviews-management">
            <div className="reviews-controls">
              <select className="status-filter" onChange={(e) => fetchReviewsData(1, e.target.value)}>
                <option value="all">All Reviews</option>
                <option value="flagged">Flagged</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
            <div className="reviews-table">
              <table>
                <thead>
                  <tr>
                    <th>Rating</th>
                    <th>Reviewer</th>
                    <th>Reviewee</th>
                    <th>Job</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(reviewsData?.reviews) && reviewsData.reviews.length > 0 ? reviewsData.reviews.map((review) => (
                    <React.Fragment key={review._id}>
                      <tr>
                        <td>
                          <div className="rating">
                            {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                          </div>
                        </td>
                        <td>{review.reviewer ? `${review.reviewer.firstName} ${review.reviewer.lastName}` : 'N/A'}</td>
                        <td>{review.reviewee ? `${review.reviewee.firstName} ${review.reviewee.lastName}` : 'N/A'}</td>
                        <td>{review.job ? review.job.title : 'N/A'}</td>
                        <td>
                          <span className={`status ${review.moderationStatus || 'pending'}`}>
                            {review.moderationStatus || 'Pending'}
                          </span>
                        </td>
                        <td>{new Date(review.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div className="review-actions">
                            <button className="action-btn approve" onClick={async () => {
                              try {
                                await apiRequest(`/api/admin/reviews/${review._id}/moderate`, {
                                  method: 'PUT', body: JSON.stringify({ status: 'approved' })
                                });
                                fetchReviewsData();
                              } catch (err) { console.error('Failed to approve review:', err); }
                            }}>Approve</button>
                            <button className="action-btn reject" onClick={async () => {
                              const notes = prompt('Reason for rejection:');
                              try {
                                await apiRequest(`/api/admin/reviews/${review._id}/moderate`, {
                                  method: 'PUT', body: JSON.stringify({ status: 'rejected', notes })
                                });
                                fetchReviewsData();
                              } catch (err) { console.error('Failed to reject review:', err); }
                            }}>Reject</button>
                            <button className="adm-ai-rev-btn" disabled={checkingId === review._id} onClick={() => handleAICheck(review)}>
                              {checkingId === review._id ? '⏳ Checking…' : '🤖 AI Check'}
                            </button>
                            <button className="action-btn" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
                              onClick={async () => {
                                if (!window.confirm(`Delete this review by ${review.reviewer?.firstName || 'unknown'}? This will recalculate the reviewee's rating.`)) return;
                                try {
                                  await apiRequest(`/api/admin/reviews/${review._id}`, { method: 'DELETE' });
                                  fetchReviewsData();
                                } catch (err) { alert('Failed to delete: ' + (err.message || 'Unknown error')); }
                              }}>🗑️ Delete</button>
                          </div>
                        </td>
                      </tr>
                      {checkResults[review._id] && (
                        <tr className="adm-ai-rev-result-row">
                          <td colSpan="7">
                            <div className={`adm-ai-rev-result ${checkResults[review._id].isSuspicious ? 'adm-ai-rev-suspicious' : 'adm-ai-rev-ok'}`}>
                              <span className="adm-ai-rev-verdict">
                                {checkResults[review._id].isSuspicious ? '⚠️ Suspicious' : '✅ Looks authentic'}
                              </span>
                              <span className={`adm-ai-rev-confidence ${checkResults[review._id].confidence}`}>
                                {checkResults[review._id].confidence} confidence
                              </span>
                              <span className="adm-ai-rev-rec">
                                Recommendation: <strong>{checkResults[review._id].recommendation}</strong>
                              </span>
                              {checkResults[review._id].flags?.length > 0 && (
                                <div className="adm-ai-rev-flags">
                                  {checkResults[review._id].flags.map((f, i) => (
                                    <span key={i} className="adm-ai-rev-flag">{f}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )) : (
                    <tr><td colSpan="7" className="no-data">No reviews found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>Page {reviewsData?.pagination?.current || 1} of {reviewsData?.pagination?.pages || 1}</span>
              <span>Total: {reviewsData?.pagination?.total || 0} reviews</span>
            </div>
          </div>
        ) : (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading reviews...</p>
          </div>
        )}
      </div>
    </TracingErrorBoundary>
  );
};

export default AdminReviewsTab;
