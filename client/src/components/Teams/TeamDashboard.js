import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './TeamDashboard.css';

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function activityIcon(type) {
  const icons = {
    invite_sent: '📨',
    invite_accepted: '✅',
    member_joined: '👋',
    member_removed: '🚪',
    job_assigned: '📋',
    job_posted: '📝',
    wallet_funded: '💰',
    approval_requested: '🔔',
    approval_decided: '⚖️',
    role_changed: '🔄',
    settings_updated: '⚙️',
  };
  return icons[type] || '📌';
}

function formatCurrency(amount) {
  if (amount == null) return '$0.00';
  return `$${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function TeamDashboard({ teamId, team, onNavigateTab }) {
  const [billing, setBilling] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [activity, setActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const activeMembers = (team?.members || []).filter(m => m.status === 'active');
  const memberCount = activeMembers.length;

  const fetchData = useCallback(async () => {
    if (!teamId) return;
    setLoadingActivity(true);
    setFetchError('');

    const [billingRes, approvalsRes, activityRes] = await Promise.allSettled([
      apiRequest(`/api/teams/${teamId}/billing`),
      apiRequest(`/api/teams/${teamId}/pending-approvals`),
      apiRequest(`/api/teams/${teamId}/activity`),
    ]);

    if (billingRes.status === 'fulfilled') setBilling(billingRes.value);
    if (approvalsRes.status === 'fulfilled') setPendingApprovals(approvalsRes.value?.count ?? 0);
    if (activityRes.status === 'fulfilled') setActivity(activityRes.value?.events || activityRes.value?.activity || []);

    // Show error if all calls failed
    const allFailed = [billingRes, approvalsRes, activityRes].every(r => r.status === 'rejected');
    if (allFailed) setFetchError('Could not load dashboard data. Please try again.');

    setLoadingActivity(false);
  }, [teamId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Active jobs count from team data
  const activeJobs = team?.activeJobCount ?? 0;

  const displayMembers = activeMembers.slice(0, 6);

  return (
    <div className="td-root">
      {fetchError && (
        <div className="td-error-banner">
          <span>{fetchError}</span>
          <button className="td-error-retry" onClick={fetchData}>Retry</button>
        </div>
      )}

      {/* Stat cards */}
      <div className="td-stats">
        <div className="td-stat-card">
          <span className="td-stat-label">Team Balance</span>
          <span className="td-stat-value">{formatCurrency(billing?.balance)}</span>
        </div>
        <div className="td-stat-card">
          <span className="td-stat-label">Active Jobs</span>
          <span className="td-stat-value">{activeJobs}</span>
        </div>
        <div className="td-stat-card">
          <span className="td-stat-label">Members</span>
          <span className="td-stat-value">{memberCount}</span>
        </div>
        <div className="td-stat-card">
          <span className="td-stat-label">Pending Approvals</span>
          <span className="td-stat-value">{pendingApprovals}</span>
        </div>
      </div>

      {/* Recent Activity */}
      <section className="td-section">
        <h3 className="td-section-title">Recent Activity</h3>
        {loadingActivity ? (
          <div className="td-activity-skeleton">
            <div className="td-skeleton-line" />
            <div className="td-skeleton-line" />
            <div className="td-skeleton-line" />
          </div>
        ) : activity.length === 0 ? (
          <div className="td-empty-state">
            <p className="td-muted">No recent activity yet.</p>
            <p className="td-muted-hint">Activity will appear here as your team collaborates.</p>
          </div>
        ) : (
          <ul className="td-activity-list">
            {activity.slice(0, 10).map((evt, i) => (
              <li key={evt._id || i} className="td-activity-item">
                <span className="td-activity-icon">{activityIcon(evt.type || evt.action)}</span>
                <div className="td-activity-body">
                  <span className="td-activity-text">{evt.description || evt.message || evt.action}</span>
                  <span className="td-activity-time">{relativeTime(evt.createdAt || evt.date)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Members preview */}
      <section className="td-section">
        <div className="td-section-header">
          <h3 className="td-section-title">Members</h3>
          {memberCount > 6 && (
            <button className="td-view-all-btn" onClick={() => onNavigateTab?.('members')}>
              View All ({memberCount})
            </button>
          )}
        </div>
        {displayMembers.length === 0 ? (
          <p className="td-muted">No members yet. Invite someone to get started.</p>
        ) : (
          <div className="td-members-grid">
            {displayMembers.map(m => {
              const u = m.user || {};
              const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Member';
              const initials = ((u.firstName?.[0] || '') + (u.lastName?.[0] || '')).toUpperCase() || '?';
              return (
                <div key={m._id} className="td-member-card">
                  {u.profileImage ? (
                    <img src={u.profileImage} alt="" className="td-member-avatar" />
                  ) : (
                    <span className="td-member-avatar td-member-avatar--placeholder">{initials}</span>
                  )}
                  <span className="td-member-name">{name}</span>
                  <span className={`td-role-badge td-role-badge--${m.role}`}>{m.role}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Quick Actions — wired to tab navigation */}
      <section className="td-section">
        <h3 className="td-section-title">Quick Actions</h3>
        <div className="td-quick-actions">
          <button className="td-action-btn" onClick={() => onNavigateTab?.('members')}>
            Invite Member
          </button>
          <button className="td-action-btn" onClick={() => onNavigateTab?.('wallet')}>
            Add Funds
          </button>
          <button className="td-action-btn" onClick={() => onNavigateTab?.('analytics')}>
            View Analytics
          </button>
          <button className="td-action-btn" onClick={() => onNavigateTab?.('activity')}>
            View Activity
          </button>
        </div>
      </section>
    </div>
  );
}
