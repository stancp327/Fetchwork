import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:10000';
    }
    return window.location.origin.replace(/:\d+/, ':10000');
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/api/admin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading">Loading admin dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <div className="admin-user-info">
          <span>Welcome, {user?.profile?.firstName} {user?.profile?.lastName}</span>
          <span className="admin-badge">Administrator</span>
        </div>
      </div>

      <div className="admin-tabs">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          User Management
        </button>
        <button 
          className={`tab-button ${activeTab === 'jobs' ? 'active' : ''}`}
          onClick={() => setActiveTab('jobs')}
        >
          Job Management
        </button>
        <button 
          className={`tab-button ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          Payment Management
        </button>
        <button 
          className={`tab-button ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          Review Moderation
        </button>
        <button 
          className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Analytics
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'overview' && (
          <OverviewTab dashboardData={dashboardData} formatCurrency={formatCurrency} formatDate={formatDate} />
        )}
        {activeTab === 'users' && (
          <UserManagementTab />
        )}
        {activeTab === 'jobs' && (
          <JobManagementTab />
        )}
        {activeTab === 'payments' && (
          <PaymentManagementTab formatCurrency={formatCurrency} formatDate={formatDate} />
        )}
        {activeTab === 'reviews' && (
          <ReviewModerationTab formatDate={formatDate} />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsTab formatCurrency={formatCurrency} />
        )}
      </div>
    </div>
  );
};

const OverviewTab = ({ dashboardData, formatCurrency, formatDate }) => {
  if (!dashboardData) return <div>No data available</div>;

  const { overview, stats, recent, alerts } = dashboardData;

  return (
    <div className="overview-tab">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{overview.totalUsers}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{overview.totalJobs}</div>
          <div className="stat-label">Total Jobs</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{overview.totalPayments}</div>
          <div className="stat-label">Total Payments</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{overview.totalReviews}</div>
          <div className="stat-label">Total Reviews</div>
        </div>
      </div>

      <div className="alerts-section">
        <h3>Alerts & Notifications</h3>
        <div className="alert-cards">
          <div className="alert-card warning">
            <div className="alert-number">{alerts.flaggedReviews}</div>
            <div className="alert-label">Flagged Reviews</div>
          </div>
          <div className="alert-card info">
            <div className="alert-number">{alerts.pendingPayments}</div>
            <div className="alert-label">Pending Payments</div>
          </div>
        </div>
      </div>

      <div className="recent-activity">
        <div className="recent-section">
          <h3>Recent Users</h3>
          <div className="recent-list">
            {recent.users.map(user => (
              <div key={user._id} className="recent-item">
                <div className="recent-info">
                  <span className="recent-name">{user.profile?.firstName} {user.profile?.lastName}</span>
                  <span className="recent-email">{user.email}</span>
                </div>
                <div className="recent-date">{formatDate(user.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="recent-section">
          <h3>Recent Jobs</h3>
          <div className="recent-list">
            {recent.jobs.map(job => (
              <div key={job._id} className="recent-item">
                <div className="recent-info">
                  <span className="recent-name">{job.title}</span>
                  <span className="recent-email">by {job.clientId?.email}</span>
                </div>
                <div className="recent-date">{formatDate(job.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const UserManagementTab = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:10000';
    }
    return window.location.origin.replace(/:\d+/, ':10000');
  };

  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchTerm, userTypeFilter, statusFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: currentPage,
        search: searchTerm,
        userType: userTypeFilter,
        status: statusFilter
      });

      const response = await fetch(`${getApiBaseUrl()}/api/admin/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users);
      setTotalPages(data.pagination.pages);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendUser = async (userId, suspend, reason = '') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/api/admin/users/${userId}/suspend`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ suspend, reason })
      });

      if (!response.ok) {
        throw new Error('Failed to update user status');
      }

      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  return (
    <div className="user-management-tab">
      <div className="management-header">
        <h3>User Management</h3>
        <div className="filters">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select
            value={userTypeFilter}
            onChange={(e) => setUserTypeFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Types</option>
            <option value="client">Clients</option>
            <option value="freelancer">Freelancers</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading users...</div>
      ) : (
        <>
          <div className="users-table">
            <div className="table-header">
              <div className="table-cell">User</div>
              <div className="table-cell">Type</div>
              <div className="table-cell">Rating</div>
              <div className="table-cell">Status</div>
              <div className="table-cell">Joined</div>
              <div className="table-cell">Actions</div>
            </div>
            {users.map(user => (
              <div key={user._id} className="table-row">
                <div className="table-cell">
                  <div className="user-info">
                    <div className="user-name">
                      {user.profile?.firstName} {user.profile?.lastName}
                    </div>
                    <div className="user-email">{user.email}</div>
                  </div>
                </div>
                <div className="table-cell">
                  <span className={`user-type ${user.userType}`}>
                    {user.userType}
                  </span>
                </div>
                <div className="table-cell">
                  <div className="rating">
                    ⭐ {user.rating?.average?.toFixed(1) || '0.0'} ({user.rating?.count || 0})
                  </div>
                </div>
                <div className="table-cell">
                  <span className={`status ${user.isSuspended ? 'suspended' : 'active'}`}>
                    {user.isSuspended ? 'Suspended' : 'Active'}
                  </span>
                </div>
                <div className="table-cell">
                  {new Date(user.createdAt).toLocaleDateString()}
                </div>
                <div className="table-cell">
                  <div className="action-buttons">
                    {user.isSuspended ? (
                      <button
                        onClick={() => handleSuspendUser(user._id, false)}
                        className="action-btn unsuspend"
                      >
                        Unsuspend
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          const reason = prompt('Reason for suspension:');
                          if (reason) handleSuspendUser(user._id, true, reason);
                        }}
                        className="action-btn suspend"
                      >
                        Suspend
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pagination">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              Previous
            </button>
            <span className="pagination-info">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="pagination-btn"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const JobManagementTab = () => {
  return (
    <div className="job-management-tab">
      <h3>Job Management</h3>
      <p>Job management features coming soon...</p>
    </div>
  );
};

const PaymentManagementTab = ({ formatCurrency, formatDate }) => {
  return (
    <div className="payment-management-tab">
      <h3>Payment Management</h3>
      <p>Payment management features coming soon...</p>
    </div>
  );
};

const ReviewModerationTab = ({ formatDate }) => {
  return (
    <div className="review-moderation-tab">
      <h3>Review Moderation</h3>
      <p>Review moderation features coming soon...</p>
    </div>
  );
};

const AnalyticsTab = ({ formatCurrency }) => {
  return (
    <div className="analytics-tab">
      <h3>Platform Analytics</h3>
      <p>Analytics features coming soon...</p>
    </div>
  );
};

export default AdminDashboard;
