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

export default function TeamDashboard({ teamId, team }) {
  const [billing, setBilling] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [activity, setActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  const activeMembers = (team?.members || []).filter(m => m.status === 'active');
  const memberCount = activeMembers.length;

  const fetchData = useCallback(async () => {
    if (!teamId) return;
    setLoadingActivity(true);

    const [billingRes, approvalsRes, activityRes] = await Promise.allSettled([
      apiRequest(`/api/teams/${teamId}/billing`),
      apiRequest(`/api/teams/${teamId}/pending-approvals`),
      apiRequest(`/api/teams/${teamId}/activity`),
    ]);

    if (billingRes.status === 'fulfilled') setBilling(billingRes.value);
    if (approvalsRes.status === 'fulfilled') setPendingApprovals(approvalsRes.value?.count ?? 0);
    if (activityRes.status === 'fulfilled') setActivity(activityRes.value?.events || activityRes.value?.activity || []);

    setLoadingActivity(false);
  }, [teamId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Active jobs count from team data
  const activeJobs = team?.activeJobCount ?? 0;

  const displayMembers = activeMembers.slice(0, 6);

  return (
    <div className="td-root">
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
          <p className="td-muted">Loading activity…</p>
        ) : activity.length === 0 ? (
          <p className="td-muted">No recent activity.</p>
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
            <span className="td-view-all">View All ({memberCount})</span>
          )}
        </div>
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
      </section>

      {/* Quick Actions */}
      <section className="td-section">
        <h3 className="td-section-title">Quick Actions</h3>
        <div className="td-quick-actions">
          <button className="td-action-btn">Invite Member</button>
          <button className="td-action-btn">Add Funds</button>
          <button className="td-action-btn">Post Job as Team</button>
          <button className="td-action-btn">View Public Profile</button>
        </div>
      </section>
    </div>
  );
}
