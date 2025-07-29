import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import AdminDisputePanel from './AdminDisputePanel';
import AdminEmailPanel from './AdminEmailPanel';
import ActivitySection from './ActivitySection';
import StatCard from '../common/StatCard';
import TabButton from '../common/TabButton';
import AnalyticsTab from './AnalyticsTab';
import './AdminDashboard.css';
import './AdminMonitoring.css';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [usersData, setUsersData] = useState(null);
  const [jobsData, setJobsData] = useState(null);
  const [paymentsData, setPaymentsData] = useState(null);
  const [reviewsData, setReviewsData] = useState(null);
  const [monitoringData, setMonitoringData] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const isAdminAuthenticated = user?.isAdmin;

  useEffect(() => {
    if (!isAdminAuthenticated) {
      setError('Admin access required. Please contact support if you believe this is an error.');
    }
  }, [isAdminAuthenticated, setError]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await apiRequest('/api/admin/dashboard');
      
      setDashboardData(response);
      setError(null);
    } catch (error) {
      console.error('AdminDashboard fetch error:', error);
      if (error.response?.status === 401) {
        setError('Authentication failed - please log in again');
      } else {
        setError('Unable to load dashboard data. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsersData = useCallback(async (page = 1, search = '', status = 'all') => {
    try {
      const response = await apiRequest('/api/admin/users', {
        params: { page, search, status, limit: 10 }
      });
      setUsersData(response);
    } catch (error) {
      console.error('Failed to fetch users data:', error);
    }
  }, []);

  const fetchJobsData = useCallback(async (page = 1, status = 'all') => {
    try {
      const response = await apiRequest('/api/admin/jobs', {
        params: { page, status, limit: 10 }
      });
      setJobsData(response);
    } catch (error) {
      console.error('Failed to fetch jobs data:', error);
    }
  }, []);

  const fetchPaymentsData = useCallback(async (page = 1, status = 'all') => {
    try {
      const response = await apiRequest('/api/admin/payments', {
        params: { page, status, limit: 10 }
      });
      setPaymentsData(response);
    } catch (error) {
      console.error('Failed to fetch payments data:', error);
    }
  }, []);

  const fetchReviewsData = useCallback(async (page = 1, status = 'all') => {
    try {
      const response = await apiRequest('/api/admin/reviews', {
        params: { page, status, limit: 10 }
      });
      setReviewsData(response);
    } catch (error) {
      console.error('Failed to fetch reviews data:', error);
    }
  }, []);

  const fetchMonitoringData = useCallback(async () => {
    try {
      const response = await apiRequest('/api/admin/monitoring');
      setMonitoringData(response);
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
    }
  }, []);

  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchDashboardData().catch(error => {
        console.error('Failed to fetch dashboard data on mount:', error);
      });
    }
  }, [isAdminAuthenticated, fetchDashboardData]);

  useEffect(() => {
    if (activeTab === 'users' && isAdminAuthenticated) {
      fetchUsersData().catch(error => {
        console.error('Failed to fetch users data:', error);
      });
    } else if (activeTab === 'jobs' && isAdminAuthenticated) {
      fetchJobsData().catch(error => {
        console.error('Failed to fetch jobs data:', error);
      });
    } else if (activeTab === 'payments' && isAdminAuthenticated) {
      fetchPaymentsData().catch(error => {
        console.error('Failed to fetch payments data:', error);
      });
    } else if (activeTab === 'reviews' && isAdminAuthenticated) {
      fetchReviewsData().catch(error => {
        console.error('Failed to fetch reviews data:', error);
      });
    } else if (activeTab === 'monitoring' && isAdminAuthenticated) {
      fetchMonitoringData().catch(error => {
        console.error('Failed to fetch monitoring data:', error);
      });
    }
  }, [activeTab, isAdminAuthenticated, fetchUsersData, fetchJobsData, fetchPaymentsData, fetchReviewsData, fetchMonitoringData]);

  useEffect(() => {
    let interval;
    if (activeTab === 'monitoring' && autoRefresh && isAdminAuthenticated) {
      interval = setInterval(() => {
        fetchMonitoringData().catch(error => {
          console.error('Failed to fetch monitoring data on interval:', error);
        });
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, autoRefresh, isAdminAuthenticated, fetchMonitoringData]);


  const suspendUser = async (userId, reason) => {
    try {
      await apiRequest(`/api/admin/users/${userId}/suspend`, {
        method: 'PUT',
        body: JSON.stringify({ reason })
      });
      fetchUsersData();
    } catch (error) {
      console.error('Failed to suspend user:', error);
    }
  };

  const unsuspendUser = async (userId) => {
    try {
      await apiRequest(`/api/admin/users/${userId}/unsuspend`, {
        method: 'PUT'
      });
      fetchUsersData();
    } catch (error) {
      console.error('Failed to unsuspend user:', error);
    }
  };

  const promoteUser = async (userId) => {
    try {
      const response = await apiRequest(`/api/admin/users/${userId}/promote`, {
        method: 'PUT'
      });
      if (response) {
        alert('User promoted to admin successfully');
        fetchUsersData();
      }
    } catch (error) {
      console.error('Error promoting user:', error);
      alert('Failed to promote user: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  const demoteUser = async (userId) => {
    try {
      const response = await apiRequest(`/api/admin/users/${userId}/demote`, {
        method: 'PUT'
      });
      if (response) {
        alert('User demoted from admin successfully');
        fetchUsersData();
      }
    } catch (error) {
      console.error('Error demoting user:', error);
      alert('Failed to demote user: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

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
        <TabButton
          id="disputes"
          label="Disputes"
          active={activeTab === 'disputes'}
          onClick={setActiveTab}
        />
        <TabButton
          id="email"
          label="Email"
          active={activeTab === 'email'}
          onClick={setActiveTab}
        />
        <TabButton
          id="monitoring"
          label="Monitoring"
          active={activeTab === 'monitoring'}
          onClick={setActiveTab}
        />
        <TabButton
          id="analytics"
          label="Analytics"
          active={activeTab === 'analytics'}
          onClick={setActiveTab}
        />
      </div>

      <div className="dashboard-content">
        {activeTab === 'overview' && dashboardData && (
          <div className="overview-tab">
            <div className="stats-grid">
              <StatCard
                title="Total Users"
                value={dashboardData.stats?.users?.total || 0}
                subtitle={`${dashboardData.stats?.users?.active || 0} active`}
                className="users-stat"
              />
              <StatCard
                title="Total Jobs"
                value={dashboardData.stats?.jobs?.total || 0}
                subtitle={`${dashboardData.stats?.jobs?.active || 0} active`}
                className="jobs-stat"
              />
              <StatCard
                title="Payment Volume"
                value={`$${(dashboardData.stats?.payments?.totalVolume || 0).toLocaleString()}`}
                subtitle={`${dashboardData.stats?.payments?.thisMonth || 0} this month`}
                className="payments-stat"
              />
              <StatCard
                title="Average Rating"
                value={(dashboardData.stats?.reviews?.averageRating || 0).toFixed(1)}
                subtitle={`${dashboardData.stats?.reviews?.total || 0} total reviews`}
                className="reviews-stat"
              />
            </div>

            <div className="recent-activity">
              <h2>Recent Activity</h2>
              <div className="activity-grid">
                <ActivitySection
                  title="New Users"
                  items={dashboardData.recentActivity?.newUsers}
                  renderItem={(user) => (
                    <>
                      <div>
                        <div className="user-name">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="user-email">{user.email}</div>
                      </div>
                      <div className="activity-date">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </>
                  )}
                />

                <ActivitySection
                  title="Recent Jobs"
                  items={dashboardData.recentActivity?.recentJobs}
                  renderItem={(job) => (
                    <>
                      <div>
                        <div className="job-title">{job.title}</div>
                        <div className="job-budget">${job.budget}</div>
                      </div>
                      <div className="activity-date">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </div>
                    </>
                  )}
                />
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
                            <div className="action-buttons">
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
                              {user.isAdminPromoted ? (
                                <button
                                  className="action-btn demote"
                                  onClick={() => demoteUser(user._id)}
                                >
                                  Remove Admin
                                </button>
                              ) : (
                                <button
                                  className="action-btn promote"
                                  onClick={() => promoteUser(user._id)}
                                >
                                  Make Admin
                                </button>
                              )}
                            </div>
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
                              onClick={async () => {
                                const reason = prompt('Reason for cancellation:');
                                if (reason) {
                                  try {
                                    await apiRequest(`/api/admin/jobs/${job._id}/cancel`, {
                                      method: 'PUT',
                                      body: JSON.stringify({ reason })
                                    });
                                    fetchJobsData();
                                  } catch (err) {
                                    console.error('Failed to cancel job:', err);
                                  }
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
                                onClick={async () => {
                                  try {
                                    await apiRequest(`/api/admin/reviews/${review._id}/moderate`, {
                                      method: 'PUT',
                                      body: JSON.stringify({ status: 'approved' })
                                    });
                                    fetchReviewsData();
                                  } catch (err) {
                                    console.error('Failed to approve review:', err);
                                  }
                                }}
                              >
                                Approve
                              </button>
                              <button
                                className="action-btn reject"
                                onClick={async () => {
                                  const notes = prompt('Reason for rejection:');
                                  try {
                                    await apiRequest(`/api/admin/reviews/${review._id}/moderate`, {
                                      method: 'PUT',
                                      body: JSON.stringify({ status: 'rejected', notes })
                                    });
                                    fetchReviewsData();
                                  } catch (err) {
                                    console.error('Failed to reject review:', err);
                                  }
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

        {activeTab === 'disputes' && (
          <div className="disputes-tab">
            <h2>Dispute Management</h2>
            <AdminDisputePanel />
          </div>
        )}

        {activeTab === 'email' && (
          <div className="email-tab">
            <h2>Email Management</h2>
            <AdminEmailPanel />
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="monitoring-tab">
            <div className="monitoring-header">
              <h2>Real-time System Monitoring</h2>
              <div className="monitoring-controls">
                <label>
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                  Auto-refresh (30s)
                </label>
                <button onClick={fetchMonitoringData} className="refresh-button">
                  Refresh Now
                </button>
              </div>
            </div>

            {monitoringData ? (
              <div className="monitoring-content">
                <div className="stats-grid">
                  <StatCard
                    title="Active Connections"
                    value={monitoringData.connectionStats?.totalConnections || 0}
                    subtitle={`${monitoringData.connectionStats?.uniqueUsers || 0} unique users`}
                    className="connections-stat"
                  />
                  <StatCard
                    title="Messages (24h)"
                    value={monitoringData.messageStats?.totalMessages || 0}
                    subtitle={`${monitoringData.messageStats?.groupMessages || 0} group, ${monitoringData.messageStats?.directMessages || 0} direct`}
                    className="messages-stat"
                  />
                  <StatCard
                    title="Active Rooms"
                    value={monitoringData.roomStats?.activeRooms || 0}
                    subtitle={`${monitoringData.roomStats?.totalRooms || 0} total rooms`}
                    className="rooms-stat"
                  />
                  <StatCard
                    title="Unread Messages"
                    value={monitoringData.messageStats?.unreadMessages || 0}
                    subtitle="Across all users"
                    className="unread-stat"
                  />
                </div>

                <div className="monitoring-sections">
                  <div className="online-users-section">
                    <h3>Online Users ({monitoringData.onlineUsers?.length || 0})</h3>
                    <div className="online-users-list">
                      {monitoringData.onlineUsers?.length > 0 ? monitoringData.onlineUsers.map((user, index) => (
                        <div key={index} className="online-user-item">
                          <div className="user-info">
                            <div className="user-name">{user.firstName} {user.lastName}</div>
                            <div className="user-email">{user.email}</div>
                          </div>
                          <div className="connection-indicator online"></div>
                        </div>
                      )) : <p>No users currently online</p>}
                    </div>
                  </div>

                  <div className="system-health-section">
                    <h3>System Health</h3>
                    <div className="health-metrics">
                      <div className="health-item">
                        <span className="metric-label">Uptime:</span>
                        <span className="metric-value">
                          {Math.floor((monitoringData.systemHealth?.uptime || 0) / 3600)}h {Math.floor(((monitoringData.systemHealth?.uptime || 0) % 3600) / 60)}m
                        </span>
                      </div>
                      <div className="health-item">
                        <span className="metric-label">Memory Usage:</span>
                        <span className="metric-value">
                          {Math.round((monitoringData.systemHealth?.memoryUsage?.used || 0) / 1024 / 1024)}MB
                        </span>
                      </div>
                      <div className="health-item">
                        <span className="metric-label">Last Updated:</span>
                        <span className="metric-value">
                          {new Date(monitoringData.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading monitoring data...</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab />
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
