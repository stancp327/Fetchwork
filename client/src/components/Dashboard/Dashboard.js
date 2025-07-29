import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import { apiRequest } from '../../utils/api';
import { Link } from 'react-router-dom';
import ProfileCompletion from '../Onboarding/ProfileCompletion';
import OnboardingMilestone from '../Onboarding/OnboardingMilestone';
import '../UserComponents.css';

const Dashboard = () => {
  const { user } = useAuth();
  const { currentRole, isFreelancerMode, isClientMode } = useRole();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiRequest('/api/users/dashboard');
      setDashboardData(response);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError(error.response?.data?.error || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const shouldShowOnboarding = user && (
    !user.bio || 
    !user.hourlyRate || 
    !user.skills || 
    user.skills.length === 0 ||
    !user.phone ||
    !user.profilePicture
  );

  const stats = dashboardData?.stats || {};
  const recentActivity = dashboardData?.recentActivity || {};

  return (
    <div className="user-container">
      <div className="user-header">
        <div className="dashboard-role-header">
          <div>
            <h1>Welcome back, {user?.firstName}!</h1>
            <p>Here's what's happening with your projects</p>
          </div>
          <div className="role-badge">
            {currentRole === 'freelancer' ? '👨‍💻 Freelancer View' : '👔 Client View'}
          </div>
        </div>
      </div>

      {shouldShowOnboarding && (
        <div className="dashboard-onboarding">
          <div className="onboarding-row">
            <div className="dashboard-profile-completion">
              <ProfileCompletion showInDashboard={true} />
            </div>
            <div className="dashboard-milestone-tracker">
              <OnboardingMilestone showInDashboard={true} />
            </div>
          </div>
        </div>
      )}

      <div className="stats-grid">
        {isClientMode && (
          <>
            <div className="stat-card">
              <h3>Jobs Posted</h3>
              <div className="value">{stats.activeJobsAsClient || 0}</div>
              <div className="change">Active projects</div>
            </div>

            <div className="stat-card">
              <h3>Total Spent</h3>
              <div className="value">{formatCurrency(stats.totalSpent || 0)}</div>
              <div className="change">As client</div>
            </div>
          </>
        )}

        {isFreelancerMode && (
          <>
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
              <h3>Pending Proposals</h3>
              <div className="value">{stats.pendingProposals || 0}</div>
              <div className="change">Awaiting response</div>
            </div>
          </>
        )}

        <div className="stat-card">
          <h3>Unread Messages</h3>
          <div className="value">{stats.unreadMessages || 0}</div>
          <div className="change">New notifications</div>
        </div>
      </div>

      <div className="content-grid">
        <div className="main-content">
          <div className="section-title">
            Recent Activity - {currentRole === 'freelancer' ? 'Freelancer View' : 'Client View'}
          </div>

          {isClientMode && recentActivity.jobsAsClient && recentActivity.jobsAsClient.length > 0 && (
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

          {isFreelancerMode && recentActivity.jobsAsFreelancer && recentActivity.jobsAsFreelancer.length > 0 && (
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

          {isClientMode && recentActivity.proposalsReceived && recentActivity.proposalsReceived.length > 0 && (
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ marginBottom: '15px', color: '#495057', display: 'flex', alignItems: 'center' }}>
                🔔 New Proposals Received
                <span style={{ 
                  background: '#dc3545', 
                  color: 'white', 
                  borderRadius: '50%', 
                  padding: '4px 8px', 
                  fontSize: '0.7rem',
                  marginLeft: '10px',
                  minWidth: '20px',
                  textAlign: 'center'
                }}>
                  {recentActivity.proposalsReceived.length}
                </span>
              </h3>
              {recentActivity.proposalsReceived.map((job) => (
                <div key={job._id} className="card" style={{ border: '2px solid #28a745', background: '#f8fff9' }}>
                  <div className="card-header">
                    <div>
                      <h4 className="card-title" style={{ color: '#28a745' }}>
                        💼 {job.title}
                      </h4>
                      <div className="card-meta">
                        <strong>New proposal from:</strong> {job.proposals[0].freelancer.firstName} {job.proposals[0].freelancer.lastName} • 
                        <strong>Bid:</strong> ${job.proposals[0].proposedBudget} • 
                        <strong>Timeline:</strong> {job.proposals[0].proposedDuration}
                      </div>
                      <div className="card-meta" style={{ marginTop: '5px', fontSize: '0.85rem' }}>
                        📅 Received {new Date(job.proposals[0].submittedAt).toLocaleString()}
                      </div>
                    </div>
                    <span className="tag success" style={{ background: '#28a745' }}>
                      NEW
                    </span>
                  </div>
                  <div className="card-footer">
                    <div className="card-meta">
                      Total proposals: {job.proposalCount} • Job budget: ${job.budget.amount} {job.budget.type === 'hourly' ? '/hr' : 'fixed'}
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <Link to={`/jobs/${job._id}/proposals`} className="btn btn-primary">
                        View All Proposals
                      </Link>
                      <Link to={`/messages`} className="btn btn-outline">
                        Message Freelancer
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isFreelancerMode && recentActivity.pendingProposals && recentActivity.pendingProposals.length > 0 && (
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

          {((isClientMode && (!recentActivity.jobsAsClient || recentActivity.jobsAsClient.length === 0) && (!recentActivity.proposalsReceived || recentActivity.proposalsReceived.length === 0)) ||
            (isFreelancerMode && (!recentActivity.jobsAsFreelancer || recentActivity.jobsAsFreelancer.length === 0) && (!recentActivity.pendingProposals || recentActivity.pendingProposals.length === 0))) && (
            <div className="empty-state">
              <h3>No recent activity</h3>
              <p>
                {isClientMode 
                  ? 'Start by posting a job to find talented freelancers' 
                  : 'Start by browsing jobs or creating service offerings'
                }
              </p>
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '20px' }}>
                {isClientMode ? (
                  <>
                    <Link to="/post-job" className="btn btn-primary">
                      Post a Job
                    </Link>
                    <Link to="/browse-services" className="btn btn-outline">
                      Browse Services
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/browse-jobs" className="btn btn-primary">
                      Browse Jobs
                    </Link>
                    <Link to="/create-service" className="btn btn-outline">
                      Create Service
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="sidebar">
          <div className="section-title">Quick Actions</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {isClientMode && (
              <Link to="/post-job" className="btn btn-primary">
                Post a New Job
              </Link>
            )}
            {isFreelancerMode && (
              <>
                <Link to="/browse-jobs" className="btn btn-primary">
                  Browse Jobs
                </Link>
                <Link to="/create-service" className="btn btn-outline">
                  Create Service
                </Link>
              </>
            )}
            <Link to="/browse-services" className="btn btn-outline">
              Browse Services
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
