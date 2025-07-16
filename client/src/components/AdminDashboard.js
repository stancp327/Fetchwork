import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from './Navigation';

const AdminDashboard = () => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token && user?.userType === 'admin') {
      fetchDashboardData();
    }
  }, [token, user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes, jobsRes, paymentsRes, reviewsRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/jobs', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/payments', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/reviews/flagged', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (jobsRes.ok) setJobs(await jobsRes.json());
      if (paymentsRes.ok) setPayments(await paymentsRes.json());
      if (reviewsRes.ok) setReviews(await reviewsRes.json());

      setError('');
    } catch (error) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async (userId, action) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        fetchDashboardData();
        alert(`User ${action} successful`);
      } else {
        const data = await response.json();
        alert(data.message || `Failed to ${action} user`);
      }
    } catch (error) {
      alert('Network error. Please try again.');
    }
  };

  const handlePaymentOverride = async (paymentId, action, reason) => {
    if (!reason) {
      reason = prompt(`Enter reason for ${action}:`);
      if (!reason) return;
    }

    try {
      const response = await fetch(`/api/payments/${paymentId}/admin-override`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, reason })
      });

      if (response.ok) {
        fetchDashboardData();
        alert(`Payment ${action} successful`);
      } else {
        const data = await response.json();
        alert(data.message || `Failed to ${action} payment`);
      }
    } catch (error) {
      alert('Network error. Please try again.');
    }
  };

  const handleReviewModeration = async (reviewId, isVisible, adminNotes) => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}/moderate`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isVisible, adminNotes })
      });

      if (response.ok) {
        fetchDashboardData();
        alert('Review moderated successfully');
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to moderate review');
      }
    } catch (error) {
      alert('Network error. Please try again.');
    }
  };

  if (!user || user.userType !== 'admin') {
    return (
      <div>
        <Navigation />
        <div className="page-container">
          <div className="admin-dashboard">
            <h1>Access Denied</h1>
            <p>You need admin privileges to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div className="page-container">
        <div className="admin-dashboard">
          <h1>Admin Dashboard</h1>
          
          {error && <div className="error-message">{error}</div>}
          
          <div className="admin-tabs">
            <button 
              className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button 
              className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              Users
            </button>
            <button 
              className={`tab-btn ${activeTab === 'jobs' ? 'active' : ''}`}
              onClick={() => setActiveTab('jobs')}
            >
              Jobs
            </button>
            <button 
              className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
              onClick={() => setActiveTab('payments')}
            >
              Payments
            </button>
            <button 
              className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
              onClick={() => setActiveTab('reviews')}
            >
              Reviews
            </button>
          </div>

          {loading ? (
            <div className="loading">Loading dashboard data...</div>
          ) : (
            <div className="admin-content">
              {activeTab === 'overview' && (
                <div className="overview-tab">
                  <h2>Platform Overview</h2>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <h3>Total Users</h3>
                      <p className="stat-number">{stats.totalUsers || 0}</p>
                    </div>
                    <div className="stat-card">
                      <h3>Active Jobs</h3>
                      <p className="stat-number">{stats.activeJobs || 0}</p>
                    </div>
                    <div className="stat-card">
                      <h3>Total Revenue</h3>
                      <p className="stat-number">${(stats.totalRevenue || 0).toLocaleString()}</p>
                    </div>
                    <div className="stat-card">
                      <h3>Pending Disputes</h3>
                      <p className="stat-number">{stats.pendingDisputes || 0}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'users' && (
                <div className="users-tab">
                  <h2>User Management</h2>
                  <div className="users-list">
                    {users.map(user => (
                      <div key={user._id} className="user-item">
                        <div className="user-info">
                          <h4>{user.name}</h4>
                          <p>{user.email}</p>
                          <span className={`user-type ${user.userType}`}>{user.userType}</span>
                          <span className={`user-status ${user.isActive ? 'active' : 'inactive'}`}>
                            {user.isActive ? 'Active' : 'Suspended'}
                          </span>
                        </div>
                        <div className="user-actions">
                          {user.isActive ? (
                            <button 
                              className="suspend-btn"
                              onClick={() => handleUserAction(user._id, 'suspend')}
                            >
                              Suspend
                            </button>
                          ) : (
                            <button 
                              className="activate-btn"
                              onClick={() => handleUserAction(user._id, 'activate')}
                            >
                              Activate
                            </button>
                          )}
                          <button 
                            className="ban-btn"
                            onClick={() => handleUserAction(user._id, 'ban')}
                          >
                            Ban
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'jobs' && (
                <div className="jobs-tab">
                  <h2>Job Management</h2>
                  <div className="jobs-list">
                    {jobs.map(job => (
                      <div key={job._id} className="job-item">
                        <div className="job-info">
                          <h4>{job.title}</h4>
                          <p>Client: {job.client?.name}</p>
                          <p>Freelancer: {job.freelancer?.name || 'Not assigned'}</p>
                          <span className={`job-status ${job.status}`}>{job.status}</span>
                        </div>
                        <div className="job-actions">
                          <button className="view-btn">View Details</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'payments' && (
                <div className="payments-tab">
                  <h2>Payment Management</h2>
                  <div className="payments-list">
                    {payments.map(payment => (
                      <div key={payment._id} className="payment-item">
                        <div className="payment-info">
                          <h4>Job: {payment.job?.title}</h4>
                          <p>Amount: ${payment.amount}</p>
                          <p>Client: {payment.client?.name}</p>
                          <p>Freelancer: {payment.freelancer?.name}</p>
                          <span className={`payment-status ${payment.status}`}>{payment.status}</span>
                        </div>
                        <div className="payment-actions">
                          {payment.status === 'escrowed' && (
                            <>
                              <button 
                                className="release-btn"
                                onClick={() => handlePaymentOverride(payment._id, 'release')}
                              >
                                Force Release
                              </button>
                              <button 
                                className="refund-btn"
                                onClick={() => handlePaymentOverride(payment._id, 'refund')}
                              >
                                Force Refund
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="reviews-tab">
                  <h2>Review Moderation</h2>
                  <div className="reviews-list">
                    {reviews.map(review => (
                      <div key={review._id} className="review-item">
                        <div className="review-info">
                          <h4>Job: {review.job?.title}</h4>
                          <p>Reviewer: {review.reviewer?.name}</p>
                          <p>Reviewee: {review.reviewee?.name}</p>
                          <p>Rating: {'⭐'.repeat(review.rating)}</p>
                          <p>Comment: {review.comment}</p>
                          <p>Flags: {review.flaggedBy?.length || 0}</p>
                        </div>
                        <div className="review-actions">
                          <button 
                            className="hide-btn"
                            onClick={() => handleReviewModeration(review._id, false, 'Hidden by admin')}
                          >
                            Hide Review
                          </button>
                          <button 
                            className="show-btn"
                            onClick={() => handleReviewModeration(review._id, true, 'Approved by admin')}
                          >
                            Show Review
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
