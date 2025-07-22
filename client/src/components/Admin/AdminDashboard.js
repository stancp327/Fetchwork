import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import './AdminDashboard.css';

const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:10000';
  }
  return 'https://fetchwork-1.onrender.com';
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [usersData, setUsersData] = useState(null);
  const [jobsData, setJobsData] = useState(null);
  const [paymentsData, setPaymentsData] = useState(null);
  const [reviewsData, setReviewsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const apiBaseUrl = getApiBaseUrl();
  const isAdminAuthenticated = user?.isAdmin;

  useEffect(() => {
    if (!isAdminAuthenticated) {
      console.log('Admin not authenticated - user does not have admin privileges');
    }
  }, [isAdminAuthenticated]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await axios.get(`${apiBaseUrl}/api/admin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setDashboardData(response.data);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      if (error.response?.status === 401) {
        setError('Authentication failed - please log in again');
      } else {
        setError(error.response?.data?.error || 'Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  const fetchUsersData = useCallback(async (page = 1, search = '', status = 'all') => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${apiBaseUrl}/api/admin/users`, {
        params: { page, search, status, limit: 10 },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setUsersData(response.data);
    } catch (error) {
      console.error('Failed to fetch users data:', error);
    }
  }, [apiBaseUrl]);

  const fetchJobsData = useCallback(async (page = 1, status = 'all') => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${apiBaseUrl}/api/admin/jobs`, {
        params: { page, status, limit: 10 },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setJobsData(response.data);
    } catch (error) {
      console.error('Failed to fetch jobs data:', error);
    }
  }, [apiBaseUrl]);

  const fetchPaymentsData = useCallback(async (page = 1, status = 'all') => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${apiBaseUrl}/api/admin/payments`, {
        params: { page, status, limit: 10 },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setPaymentsData(response.data);
    } catch (error) {
      console.error('Failed to fetch payments data:', error);
    }
  }, [apiBaseUrl]);

  const fetchReviewsData = useCallback(async (page = 1, status = 'all') => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${apiBaseUrl}/api/admin/reviews`, {
        params: { page, status, limit: 10 },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setReviewsData(response.data);
    } catch (error) {
      console.error('Failed to fetch reviews data:', error);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchDashboardData();
    }
  }, [isAdminAuthenticated, fetchDashboardData]);

  useEffect(() => {
    if (activeTab === 'users' && isAdminAuthenticated) {
      fetchUsersData();
    } else if (activeTab === 'jobs' && isAdminAuthenticated) {
      fetchJobsData();
    } else if (activeTab === 'payments' && isAdminAuthenticated) {
      fetchPaymentsData();
    } else if (activeTab === 'reviews' && isAdminAuthenticated) {
      fetchReviewsData();
    }
  }, [activeTab, isAdminAuthenticated, fetchUsersData, fetchJobsData, fetchPaymentsData, fetchReviewsData]);


  const suspendUser = async (userId, reason) => {
    try {
      await axios.put(`${apiBaseUrl}/api/admin/users/${userId}/suspend`, { reason });
      fetchUsersData();
    } catch (error) {
      console.error('Failed to suspend user:', error);
    }
  };

  const unsuspendUser = async (userId) => {
    try {
      await axios.put(`${apiBaseUrl}/api/admin/users/${userId}/unsuspend`);
      fetchUsersData();
    } catch (error) {
      console.error('Failed to unsuspend user:', error);
    }
  };

  const StatCard = ({ title, value, subtitle, className = '' }) => (
    <div className={`stat-card ${className}`}>
      <h3>{title}</h3>
      <div className="stat-value">{value}</div>
      {subtitle && <div className="stat-subtitle">{subtitle}</div>}
    </div>
  );

  const TabButton = ({ id, label, active, onClick }) => (
    <button
      className={`tab-button ${active ? 'active' : ''}`}
      onClick={() => onClick(id)}
    >
      {label}
    </button>
  );

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="error-container">
          <h2>Dashboard Error</h2>
          <p>{error}</p>
          <button onClick={fetchDashboardData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <div className="header-actions">
          <button onClick={fetchDashboardData} className="refresh-button">
            Refresh Data
          </button>
        </div>
      </header>

      <div className="dashboard-tabs">
        <TabButton
          id="overview"
          label="Overview"
          active={activeTab === 'overview'}
          onClick={setActiveTab}
        />
        <TabButton
          id="users"
          label="Users"
          active={activeTab === 'users'}
          onClick={setActiveTab}
        />
        <TabButton
          id="jobs"
          label="Jobs"
          active={activeTab === 'jobs'}
          onClick={setActiveTab}
        />
        <TabButton
          id="payments"
          label="Payments"
          active={activeTab === 'payments'}
          onClick={setActiveTab}
        />
        <TabButton
          id="reviews"
          label="Reviews"
          active={activeTab === 'reviews'}
          onClick={setActiveTab}
        />
      </div>

      <div className="dashboard-content">
        {activeTab === 'overview' && dashboardData && (
          <div className="overview-tab">
            <div className="stats-grid">
              <StatCard
                title="Total Users"
                value={dashboardData.users?.total || 0}
                subtitle={`${dashboardData.users?.active || 0} active`}
                className="users-stat"
              />
              <StatCard
                title="Total Jobs"
                value={dashboardData.jobs?.total || 0}
                subtitle={`${dashboardData.jobs?.active || 0} active`}
                className="jobs-stat"
              />
              <StatCard
                title="Payment Volume"
                value={`$${(dashboardData.payments?.volume || 0).toLocaleString()}`}
                subtitle={`${dashboardData.payments?.total || 0} payments`}
                className="payments-stat"
              />
              <StatCard
                title="Average Rating"
                value={(dashboardData.reviews?.average || 0).toFixed(1)}
                subtitle={`${dashboardData.reviews?.total || 0} total reviews`}
                className="reviews-stat"
              />
            </div>

            <div className="recent-activity">
              <h2>Recent Activity</h2>
              <div className="activity-grid">
                <div className="activity-section">
                  <h3>New Users</h3>
                  <div className="activity-list">
                    {dashboardData.recent?.users?.length > 0 ? dashboardData.recent.users.map((user, index) => (
                      <div key={index} className="activity-item">
                        <div>
                          <div className="user-name">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="user-email">{user.email}</div>
                        </div>
                        <div className="activity-date">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    )) : <p>No recent users</p>}
                  </div>
                </div>

                <div className="activity-section">
                  <h3>Recent Jobs</h3>
                  <div className="activity-list">
                    {dashboardData.recent?.jobs?.length > 0 ? dashboardData.recent.jobs.map((job, index) => (
                      <div key={index} className="activity-item">
                        <div>
                          <div className="job-title">{job.title}</div>
                          <div className="job-budget">${job.budget}</div>
                        </div>
                        <div className="activity-date">
                          {new Date(job.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    )) : <p>No recent jobs</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="users-tab">
            <h2>User Management</h2>
            {usersData ? (
              <div className="users-management">
                <div className="users-controls">
                  <input
                    type="text"
                    placeholder="Search users..."
                    className="search-input"
                    onChange={(e) => fetchUsersData(1, e.target.value)}
                  />
                  <select
                    className="status-filter"
                    onChange={(e) => fetchUsersData(1, '', e.target.value)}
                  >
                    <option value="all">All Users</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="users-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersData.users.map((user) => (
                        <tr key={user._id}>
                          <td>{user.firstName} {user.lastName}</td>
                          <td>{user.email}</td>
                          <td>
                            <span className={`status ${user.isSuspended ? 'suspended' : user.isActive ? 'active' : 'inactive'}`}>
                              {user.isSuspended ? 'Suspended' : user.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                          <td>
                            {user.isSuspended ? (
                              <button
                                className="action-btn unsuspend"
                                onClick={() => unsuspendUser(user._id)}
                              >
                                Unsuspend
                              </button>
                            ) : (
                              <button
                                className="action-btn suspend"
                                onClick={() => {
                                  const reason = prompt('Reason for suspension:');
                                  if (reason) suspendUser(user._id, reason);
                                }}
                              >
                                Suspend
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="pagination">
                  <span>Page {usersData.pagination.current} of {usersData.pagination.pages}</span>
                  <span>Total: {usersData.pagination.total} users</span>
                </div>
              </div>
            ) : (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading users...</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="jobs-tab">
            <h2>Job Management</h2>
            {jobsData ? (
              <div className="jobs-management">
                <div className="jobs-controls">
                  <select
                    className="status-filter"
                    onChange={(e) => fetchJobsData(1, e.target.value)}
                  >
                    <option value="all">All Jobs</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="jobs-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Client</th>
                        <th>Budget</th>
                        <th>Status</th>
                        <th>Posted</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobsData.jobs.length > 0 ? jobsData.jobs.map((job) => (
                        <tr key={job._id}>
                          <td>{job.title}</td>
                          <td>{job.client ? `${job.client.firstName} ${job.client.lastName}` : 'N/A'}</td>
                          <td>${job.budget}</td>
                          <td>
                            <span className={`status ${job.status}`}>
                              {job.status}
                            </span>
                          </td>
                          <td>{new Date(job.createdAt).toLocaleDateString()}</td>
                          <td>
                            <button
                              className="action-btn cancel"
                              onClick={() => {
                                const reason = prompt('Reason for cancellation:');
                                if (reason) {
                                  axios.put(`${apiBaseUrl}/api/admin/jobs/${job._id}/cancel`, { reason })
                                    .then(() => fetchJobsData())
                                    .catch(err => console.error('Failed to cancel job:', err));
                                }
                              }}
                            >
                              Cancel
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="6" className="no-data">No jobs found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="pagination">
                  <span>Page {jobsData.pagination.current} of {jobsData.pagination.pages}</span>
                  <span>Total: {jobsData.pagination.total} jobs</span>
                </div>
              </div>
            ) : (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading jobs...</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="payments-tab">
            <h2>Payment Management</h2>
            {paymentsData ? (
              <div className="payments-management">
                <div className="payments-controls">
                  <select
                    className="status-filter"
                    onChange={(e) => fetchPaymentsData(1, e.target.value)}
                  >
                    <option value="all">All Payments</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
                <div className="payments-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Amount</th>
                        <th>Client</th>
                        <th>Freelancer</th>
                        <th>Job</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentsData.payments.length > 0 ? paymentsData.payments.map((payment) => (
                        <tr key={payment._id}>
                          <td>${payment.amount}</td>
                          <td>{payment.client ? `${payment.client.firstName} ${payment.client.lastName}` : 'N/A'}</td>
                          <td>{payment.freelancer ? `${payment.freelancer.firstName} ${payment.freelancer.lastName}` : 'N/A'}</td>
                          <td>{payment.job ? payment.job.title : 'N/A'}</td>
                          <td>
                            <span className={`status ${payment.status}`}>
                              {payment.status}
                            </span>
                          </td>
                          <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
                          <td>
                            <button className="action-btn view">View Details</button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="7" className="no-data">No payments found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="pagination">
                  <span>Page {paymentsData.pagination.current} of {paymentsData.pagination.pages}</span>
                  <span>Total: {paymentsData.pagination.total} payments</span>
                </div>
              </div>
            ) : (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading payments...</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="reviews-tab">
            <h2>Review Management</h2>
            {reviewsData ? (
              <div className="reviews-management">
                <div className="reviews-controls">
                  <select
                    className="status-filter"
                    onChange={(e) => fetchReviewsData(1, e.target.value)}
                  >
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
                      {reviewsData.reviews.length > 0 ? reviewsData.reviews.map((review) => (
                        <tr key={review._id}>
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
                              <button
                                className="action-btn approve"
                                onClick={() => {
                                  axios.put(`${apiBaseUrl}/api/admin/reviews/${review._id}/moderate`, {
                                    status: 'approved'
                                  }).then(() => fetchReviewsData()).catch(err => console.error('Failed to approve review:', err));
                                }}
                              >
                                Approve
                              </button>
                              <button
                                className="action-btn reject"
                                onClick={() => {
                                  const notes = prompt('Reason for rejection:');
                                  axios.put(`${apiBaseUrl}/api/admin/reviews/${review._id}/moderate`, {
                                    status: 'rejected',
                                    notes
                                  }).then(() => fetchReviewsData()).catch(err => console.error('Failed to reject review:', err));
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="7" className="no-data">No reviews found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="pagination">
                  <span>Page {reviewsData.pagination.current} of {reviewsData.pagination.pages}</span>
                  <span>Total: {reviewsData.pagination.total} reviews</span>
                </div>
              </div>
            ) : (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading reviews...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
