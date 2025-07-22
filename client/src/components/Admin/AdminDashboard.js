import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminDashboard.css';

const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:10000';
  }
  return 'https://fetchwork-1.onrender.com';
};

const AdminDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const apiBaseUrl = getApiBaseUrl();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${apiBaseUrl}/api/admin/dashboard`);
      setDashboardData(response.data);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError(error.response?.data?.error || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
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
                subtitle={`$${(dashboardData.stats?.payments?.thisMonth || 0).toLocaleString()} this month`}
                className="payments-stat"
              />
              <StatCard
                title="Average Rating"
                value={dashboardData.stats?.reviews?.averageRating || 0}
                subtitle={`${dashboardData.stats?.reviews?.total || 0} total reviews`}
                className="reviews-stat"
              />
            </div>

            <div className="recent-activity">
              <h2>Recent Activity</h2>
              <div className="activity-grid">
                <div className="activity-section">
                  <h3>New Users</h3>
                  <div className="activity-list">
                    {dashboardData.recentActivity?.newUsers?.map((user, index) => (
                      <div key={index} className="activity-item">
                        <span className="user-name">
                          {user.firstName} {user.lastName}
                        </span>
                        <span className="user-email">{user.email}</span>
                        <span className="activity-date">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    )) || <p>No recent users</p>}
                  </div>
                </div>

                <div className="activity-section">
                  <h3>Recent Jobs</h3>
                  <div className="activity-list">
                    {dashboardData.recentActivity?.recentJobs?.map((job, index) => (
                      <div key={index} className="activity-item">
                        <span className="job-title">{job.title}</span>
                        <span className="job-budget">${job.budget}</span>
                        <span className="job-status">{job.status}</span>
                        <span className="activity-date">
                          {new Date(job.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    )) || <p>No recent jobs</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="users-tab">
            <h2>User Management</h2>
            <p>User management functionality will be implemented here.</p>
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="jobs-tab">
            <h2>Job Management</h2>
            <p>Job management functionality will be implemented here.</p>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="payments-tab">
            <h2>Payment Management</h2>
            <p>Payment management functionality will be implemented here.</p>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="reviews-tab">
            <h2>Review Management</h2>
            <p>Review management functionality will be implemented here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
