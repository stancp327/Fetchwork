import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import '../UserComponents.css';

const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:10000';
  }
  return 'https://fetchwork-1.onrender.com';
};

const Dashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const apiBaseUrl = getApiBaseUrl();

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${apiBaseUrl}/api/users/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setDashboardData(response.data);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError(error.response?.data?.error || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatJobStatus = (status) => {
    const statusMap = {
      'open': 'Open',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'draft': 'Draft'
    };
    return statusMap[status] || status;
  };

  const getStatusTag = (status) => {
    const statusClasses = {
      'open': 'tag success',
      'in_progress': 'tag warning',
      'completed': 'tag primary',
      'cancelled': 'tag danger',
      'draft': 'tag'
    };
    return statusClasses[status] || 'tag';
  };

  if (loading) {
    return (
      <div className="user-container">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-container">
        <div className="error">{error}</div>
      </div>
    );
  }

  const stats = dashboardData?.stats || {};
  const recentActivity = dashboardData?.recentActivity || {};

  return (
    <div className="user-container">
      <div className="user-header">
        <h1>Welcome back, {user?.firstName}!</h1>
        <p>Here's what's happening with your projects</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Jobs Posted</h3>
          <div className="value">{stats.activeJobsAsClient || 0}</div>
          <div className="change">Active projects</div>
        </div>

        <div className="stat-card">
          <h3>Jobs Working On</h3>
          <div className="value">{stats.activeJobsAsFreelancer || 0}</div>
          <div className="change">In progress</div>
        </div>

        <div className="stat-card">
          <h3>Total Earned</h3>
          <div className="value">{formatCurrency(stats.totalEarnings || 0)}</div>
          <div className="change">As freelancer</div>
        </div>

        <div className="stat-card">
          <h3>Total Spent</h3>
          <div className="value">{formatCurrency(stats.totalSpent || 0)}</div>
          <div className="change">As client</div>
        </div>

        <div className="stat-card">
          <h3>Unread Messages</h3>
          <div className="value">{stats.unreadMessages || 0}</div>
          <div className="change">New notifications</div>
        </div>

        <div className="stat-card">
          <h3>Pending Proposals</h3>
          <div className="value">{stats.pendingProposals || 0}</div>
          <div className="change">Awaiting response</div>
        </div>
      </div>

      <div className="content-grid">
        <div className="main-content">
          <div className="section-title">Recent Activity</div>

          {recentActivity.jobsAsClient && recentActivity.jobsAsClient.length > 0 && (
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ marginBottom: '15px', color: '#495057' }}>Jobs You Posted</h3>
              {recentActivity.jobsAsClient.map((job) => (
                <div key={job._id} className="card">
                  <div className="card-header">
                    <div>
                      <h4 className="card-title">{job.title}</h4>
                      <div className="card-meta">
                        Posted {new Date(job.createdAt).toLocaleDateString()} • 
                        ${job.budget.amount} {job.budget.type === 'hourly' ? '/hr' : 'fixed'}
                      </div>
                    </div>
                    <span className={getStatusTag(job.status)}>
                      {formatJobStatus(job.status)}
                    </span>
                  </div>
                  <div className="card-footer">
                    <div className="card-meta">
                      {job.proposalCount} proposals • {job.views} views
                    </div>
                    <Link to={`/jobs/${job._id}`} className="btn btn-outline">
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {recentActivity.jobsAsFreelancer && recentActivity.jobsAsFreelancer.length > 0 && (
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ marginBottom: '15px', color: '#495057' }}>Jobs You're Working On</h3>
              {recentActivity.jobsAsFreelancer.map((job) => (
                <div key={job._id} className="card">
                  <div className="card-header">
                    <div>
                      <h4 className="card-title">{job.title}</h4>
                      <div className="card-meta">
                        Client: {job.client.firstName} {job.client.lastName} • 
                        ${job.budget.amount} {job.budget.type === 'hourly' ? '/hr' : 'fixed'}
                      </div>
                    </div>
                    <span className={getStatusTag(job.status)}>
                      {formatJobStatus(job.status)}
                    </span>
                  </div>
                  <div className="card-footer">
                    <div className="card-meta">
                      Started {new Date(job.startDate || job.createdAt).toLocaleDateString()}
                    </div>
                    <Link to={`/jobs/${job._id}`} className="btn btn-outline">
                      View Project
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {recentActivity.pendingProposals && recentActivity.pendingProposals.length > 0 && (
            <div>
              <h3 style={{ marginBottom: '15px', color: '#495057' }}>Pending Proposals</h3>
              {recentActivity.pendingProposals.map((job) => (
                <div key={job._id} className="card">
                  <div className="card-header">
                    <div>
                      <h4 className="card-title">{job.title}</h4>
                      <div className="card-meta">
                        Applied {new Date(job.proposals[0].submittedAt).toLocaleDateString()} • 
                        Your bid: ${job.proposals[0].proposedBudget}
                      </div>
                    </div>
                    <span className="tag warning">Pending</span>
                  </div>
                  <div className="card-footer">
                    <div className="card-meta">
                      Budget: ${job.budget.amount} {job.budget.type === 'hourly' ? '/hr' : 'fixed'}
                    </div>
                    <Link to={`/jobs/${job._id}`} className="btn btn-outline">
                      View Job
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(!recentActivity.jobsAsClient || recentActivity.jobsAsClient.length === 0) &&
           (!recentActivity.jobsAsFreelancer || recentActivity.jobsAsFreelancer.length === 0) &&
           (!recentActivity.pendingProposals || recentActivity.pendingProposals.length === 0) && (
            <div className="empty-state">
              <h3>No recent activity</h3>
              <p>Start by posting a job or browsing available opportunities</p>
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '20px' }}>
                <Link to="/post-job" className="btn btn-primary">
                  Post a Job
                </Link>
                <Link to="/browse-jobs" className="btn btn-outline">
                  Browse Jobs
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="sidebar">
          <div className="section-title">Quick Actions</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Link to="/post-job" className="btn btn-primary">
              Post a New Job
            </Link>
            <Link to="/browse-jobs" className="btn btn-outline">
              Browse Jobs
            </Link>
            <Link to="/messages" className="btn btn-outline">
              View Messages
              {stats.unreadMessages > 0 && (
                <span style={{ 
                  background: '#dc3545', 
                  color: 'white', 
                  borderRadius: '50%', 
                  padding: '2px 6px', 
                  fontSize: '0.7rem',
                  marginLeft: '8px'
                }}>
                  {stats.unreadMessages}
                </span>
              )}
            </Link>
            <Link to="/profile" className="btn btn-outline">
              Edit Profile
            </Link>
          </div>

          <div style={{ marginTop: '30px' }}>
            <div className="section-title">Account Summary</div>
            <div style={{ fontSize: '0.9rem', color: '#6c757d', lineHeight: '1.6' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Member since:</strong> {new Date(user?.createdAt || Date.now()).toLocaleDateString()}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Profile completion:</strong> 85%
              </div>
              <div>
                <strong>Account status:</strong> <span style={{ color: '#28a745' }}>Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
