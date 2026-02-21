import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import { apiRequest } from '../../utils/api';
import { Link } from 'react-router-dom';
import ProfileCompletion from '../Onboarding/ProfileCompletion';
import { formatBudget } from '../../utils/formatters';
import './Dashboard.css';

// ── Stat Card ───────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, color = '#2563eb' }) => (
  <div className="dash-stat-card">
    <div className="dash-stat-icon" style={{ background: `${color}15`, color }}>{icon}</div>
    <div className="dash-stat-info">
      <div className="dash-stat-value">{value}</div>
      <div className="dash-stat-label">{label}</div>
      {sub && <div className="dash-stat-sub">{sub}</div>}
    </div>
  </div>
);

// ── Activity Item ───────────────────────────────────────────────
const ActivityItem = ({ icon, title, meta, time, link, tag }) => (
  <Link to={link || '#'} className="activity-item">
    <div className="activity-icon">{icon}</div>
    <div className="activity-content">
      <div className="activity-title">{title}</div>
      <div className="activity-meta">{meta}</div>
    </div>
    <div className="activity-right">
      {tag && <span className={`activity-tag tag-${tag.type}`}>{tag.label}</span>}
      <span className="activity-time">{time}</span>
    </div>
  </Link>
);

// ── Quick Action Button ─────────────────────────────────────────
const QuickAction = ({ icon, label, to, primary }) => (
  <Link to={to} className={`quick-action ${primary ? 'primary' : ''}`}>
    <span className="quick-action-icon">{icon}</span>
    <span className="quick-action-label">{label}</span>
  </Link>
);

// ── Empty State ─────────────────────────────────────────────────
const EmptyActivity = ({ isClient }) => (
  <div className="dash-empty">
    <div className="dash-empty-icon">📋</div>
    <h3>No recent activity</h3>
    <p>{isClient
      ? 'Post your first job to start finding talented freelancers'
      : 'Browse available jobs or create a service offering to get started'
    }</p>
    <div className="dash-empty-actions">
      {isClient ? (
        <>
          <Link to="/post-job" className="btn-dash-primary">Post a Job</Link>
          <Link to="/browse-services" className="btn-dash-secondary">Browse Services</Link>
        </>
      ) : (
        <>
          <Link to="/browse-jobs" className="btn-dash-primary">Browse Jobs</Link>
          <Link to="/create-service" className="btn-dash-secondary">Create Service</Link>
        </>
      )}
    </div>
  </div>
);

// ── Time Ago Helper ─────────────────────────────────────────────
const timeAgo = (date) => {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

// ── Main Dashboard ──────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useAuth();
  const { currentRole, isFreelancerMode, isClientMode, switchRole } = useRole();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiRequest('/api/users/dashboard');
      setData(response);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  if (loading) {
    return (
      <div className="dash-container">
        <div className="dash-loading">
          <div className="dash-skeleton dash-skeleton-context" />
          <div className="dash-skeleton-row">
            <div className="dash-skeleton dash-skeleton-stat" />
            <div className="dash-skeleton dash-skeleton-stat" />
            <div className="dash-skeleton dash-skeleton-stat" />
            <div className="dash-skeleton dash-skeleton-stat" />
          </div>
          <div className="dash-skeleton dash-skeleton-main" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dash-container">
        <div className="dash-error">
          <p>⚠️ {error}</p>
          <button onClick={fetchData} className="btn-dash-primary">Retry</button>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const activity = data?.recentActivity || {};
  const shouldShowOnboarding = user && (
    !user.bio || !user.hourlyRate || !user.skills?.length || !user.phone || !user.profilePicture
  );

  // Build activity list
  const activityItems = [];

  if (isClientMode) {
    (activity.jobsAsClient || []).forEach(job => {
      activityItems.push({
        icon: '📋', title: job.title,
        meta: `${job.proposalCount || 0} proposals • ${formatBudget(job.budget)}`,
        time: timeAgo(job.createdAt), link: `/jobs/${job._id}`,
        tag: { label: job.status === 'open' ? 'Open' : job.status.replace(/_/g, ' '), type: job.status === 'open' ? 'success' : 'default' },
        date: new Date(job.createdAt)
      });
    });
    (activity.proposalsReceived || []).forEach(job => {
      const p = job.proposals?.[0];
      if (p) activityItems.push({
        icon: '🔔', title: `New proposal on "${job.title}"`,
        meta: `From ${p.freelancer?.firstName} • Bid: ${formatBudget(p.proposedBudget)}`,
        time: timeAgo(p.submittedAt), link: `/jobs/${job._id}`,
        tag: { label: 'New', type: 'new' },
        date: new Date(p.submittedAt)
      });
    });
  }

  if (isFreelancerMode) {
    (activity.jobsAsFreelancer || []).forEach(job => {
      activityItems.push({
        icon: '💼', title: job.title,
        meta: `Client: ${job.client?.firstName || 'Unknown'} • ${formatBudget(job.budget)}`,
        time: timeAgo(job.createdAt), link: `/jobs/${job._id}`,
        tag: { label: 'In Progress', type: 'warning' },
        date: new Date(job.createdAt)
      });
    });
    (activity.pendingProposals || []).forEach(job => {
      const p = job.proposals?.[0];
      activityItems.push({
        icon: '📨', title: job.title,
        meta: `Your bid: ${p ? formatBudget(p.proposedBudget) : 'N/A'}`,
        time: timeAgo(p?.submittedAt || job.createdAt), link: `/jobs/${job._id}`,
        tag: { label: 'Pending', type: 'warning' },
        date: new Date(p?.submittedAt || job.createdAt)
      });
    });
  }

  activityItems.sort((a, b) => b.date - a.date);

  return (
    <div className="dash-container">
      {/* ── Context Bar ────────────────────────────────────────── */}
      <div className="dash-context-bar">
        <div className="dash-welcome">
          <h1>Welcome back, {user?.firstName}!</h1>
          <p>Here's what's happening with your {currentRole === 'freelancer' ? 'freelance work' : 'projects'}</p>
        </div>
        <div className="dash-context-actions">
          <div className="dash-mode-toggle">
            <button
              className={`mode-btn ${currentRole === 'freelancer' ? 'active' : ''}`}
              onClick={() => switchRole('freelancer')}
            >
              👨‍💻 Freelancer
            </button>
            <button
              className={`mode-btn ${currentRole === 'client' ? 'active' : ''}`}
              onClick={() => switchRole('client')}
            >
              👔 Client
            </button>
          </div>
          {isClientMode ? (
            <Link to="/post-job" className="btn-dash-primary">Post a Job</Link>
          ) : (
            <Link to="/browse-jobs" className="btn-dash-primary">Find Work</Link>
          )}
        </div>
      </div>

      {/* ── Onboarding Card ────────────────────────────────────── */}
      {shouldShowOnboarding && (
        <div className="dash-onboarding">
          <ProfileCompletion showInDashboard={true} />
        </div>
      )}

      {/* ── Stats Row ──────────────────────────────────────────── */}
      <div className="dash-stats-row">
        {isClientMode ? (
          <>
            <StatCard icon="📋" label="Active Jobs" value={stats.activeJobsAsClient || 0} color="#2563eb" />
            <StatCard icon="📨" label="Proposals" value={stats.pendingProposals || 0} color="#f59e0b" />
            <StatCard icon="💰" label="Total Spent" value={formatCurrency(stats.totalSpent || 0)} color="#10b981" />
            <StatCard icon="💬" label="Messages" value={stats.unreadMessages || 0} sub={stats.unreadMessages > 0 ? 'unread' : ''} color="#8b5cf6" />
          </>
        ) : (
          <>
            <StatCard icon="💼" label="Active Jobs" value={stats.activeJobsAsFreelancer || 0} color="#2563eb" />
            <StatCard icon="📨" label="Proposals" value={stats.pendingProposals || 0} color="#f59e0b" />
            <StatCard icon="💰" label="Earnings" value={formatCurrency(stats.totalEarnings || 0)} color="#10b981" />
            <StatCard icon="💬" label="Messages" value={stats.unreadMessages || 0} sub={stats.unreadMessages > 0 ? 'unread' : ''} color="#8b5cf6" />
          </>
        )}
      </div>

      {/* ── Main Content Grid ──────────────────────────────────── */}
      <div className="dash-grid">
        {/* Recent Activity */}
        <div className="dash-main">
          <div className="dash-section-header">
            <h2>Recent Activity</h2>
          </div>
          {activityItems.length > 0 ? (
            <div className="activity-list">
              {activityItems.slice(0, 10).map((item, i) => (
                <ActivityItem key={i} {...item} />
              ))}
            </div>
          ) : (
            <EmptyActivity isClient={isClientMode} />
          )}
        </div>

        {/* Sidebar */}
        <div className="dash-sidebar">
          {/* Quick Actions */}
          <div className="dash-card">
            <h3 className="dash-card-title">Quick Actions</h3>
            <div className="quick-actions-grid">
              {isClientMode ? (
                <>
                  <QuickAction icon="📝" label="Post Job" to="/post-job" primary />
                  <QuickAction icon="🔍" label="Find Freelancers" to="/freelancers" />
                  <QuickAction icon="🛒" label="Browse Services" to="/browse-services" />
                  <QuickAction icon="💬" label="Messages" to="/messages" />
                </>
              ) : (
                <>
                  <QuickAction icon="🔍" label="Browse Jobs" to="/browse-jobs" primary />
                  <QuickAction icon="➕" label="Create Service" to="/create-service" />
                  <QuickAction icon="👤" label="Edit Profile" to="/profile" />
                  <QuickAction icon="💬" label="Messages" to="/messages" />
                </>
              )}
            </div>
          </div>

          {/* Recommendations */}
          <div className="dash-card">
            <h3 className="dash-card-title">Recommended Next</h3>
            <div className="dash-recommendations">
              {shouldShowOnboarding && (
                <Link to="/profile" className="recommendation-item">
                  <span className="rec-icon">👤</span>
                  <div>
                    <div className="rec-title">Complete your profile</div>
                    <div className="rec-desc">A complete profile increases visibility</div>
                  </div>
                </Link>
              )}
              {isFreelancerMode && (
                <Link to="/create-service" className="recommendation-item">
                  <span className="rec-icon">🎯</span>
                  <div>
                    <div className="rec-title">Create a service listing</div>
                    <div className="rec-desc">Let clients find and hire you directly</div>
                  </div>
                </Link>
              )}
              {isClientMode && (
                <Link to="/freelancers" className="recommendation-item">
                  <span className="rec-icon">🌟</span>
                  <div>
                    <div className="rec-title">Discover top freelancers</div>
                    <div className="rec-desc">Browse skilled professionals in your area</div>
                  </div>
                </Link>
              )}
              <Link to="/browse-services" className="recommendation-item">
                <span className="rec-icon">🛍️</span>
                <div>
                  <div className="rec-title">Explore services</div>
                  <div className="rec-desc">Find ready-made solutions for your needs</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer Help ────────────────────────────────────────── */}
      <div className="dash-footer">
        <div className="dash-footer-item">
          <span>📚</span> <a href="/help">Support & Help</a>
        </div>
        <div className="dash-footer-item">
          <span>🎓</span> <a href="/tutorials">Tutorials</a>
        </div>
        <div className="dash-footer-item">
          <span>📊</span> <span>Platform Status: <span className="status-ok">All systems operational</span></span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
