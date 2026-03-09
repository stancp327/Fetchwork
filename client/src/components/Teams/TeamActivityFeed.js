import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './TeamActivityFeed.css';

const ACTION_ICONS = {
  invite_sent: '👋', member_invited: '👋', invite: '👋',
  invite_accepted: '✅', member_joined: '✅', accept: '✅',
  job_assigned: '📋', assign: '📋',
  approval_requested: '✅', approval_decided: '✅', approve: '✅',
  approval_approved: '✅',
  approval_rejected: '❌', reject: '❌',
  wallet_funded: '💰', wallet_credit: '💰', fund: '💰',
  member_removed: '👋', remove: '👋',
  role_changed: '🔄', transfer: '🔄', ownership_transferred: '🔄',
  spend_alert: '⚠️', settings_updated: '⚙️',
};

const FILTER_CATEGORIES = {
  All: null,
  Members: ['member_invited', 'member_joined', 'member_removed', 'invite_sent', 'invite_accepted', 'role_changed'],
  Finance: ['wallet_credit', 'wallet_funded', 'spend_alert', 'approval_requested', 'approval_decided', 'approval_approved', 'approval_rejected'],
  Work: ['job_assigned', 'job_posted', 'settings_updated', 'ownership_transferred'],
};

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dateGroupLabel(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function groupByDate(events) {
  const groups = {};
  events.forEach(event => {
    const key = new Date(event.at).toDateString();
    if (!groups[key]) groups[key] = { label: dateGroupLabel(event.at), events: [] };
    groups[key].events.push(event);
  });
  return Object.values(groups);
}

export default function TeamActivityFeed({ teamId }) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [expandedId, setExpandedId] = useState(null);
  const [visibleCount, setVisibleCount] = useState(20);

  const fetchActivity = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/api/teams/${teamId}/activity`);
      setActivity(data.activity || []);
    } catch (err) {
      setError(err.message || 'Failed to load activity');
      setActivity([]);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const filtered = filter === 'All'
    ? activity
    : activity.filter(e => (FILTER_CATEGORIES[filter] || []).includes(e.type));

  const visible = filtered.slice(0, visibleCount);
  const groups = groupByDate(visible);
  const hasMore = visibleCount < filtered.length;

  if (loading) {
    return <div className="taf-root"><div className="taf-loading">Loading activity...</div></div>;
  }

  return (
    <div className="taf-root">
      <h3 className="taf-title">Activity Feed</h3>

      {error && (
        <div className="taf-error">
          <span>{error}</span>
          <button className="taf-retry-btn" onClick={fetchActivity}>Retry</button>
        </div>
      )}

      {/* Filter bar */}
      <div className="taf-filters">
        {Object.keys(FILTER_CATEGORIES).map(key => (
          <button
            key={key}
            className={`taf-filter-btn ${filter === key ? 'taf-filter-btn--active' : ''}`}
            onClick={() => { setFilter(key); setVisibleCount(20); }}
          >
            {key}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="taf-empty">No activity to show</div>
      ) : (
        <div className="taf-groups">
          {groups.map(group => (
            <div className="taf-group" key={group.label}>
              <div className="taf-date-label">{group.label}</div>
              <div className="taf-event-list">
                {group.events.map((event, i) => {
                  const icon = ACTION_ICONS[event.type] || '📌';
                  const eventId = `${event.type}-${event.at}-${i}`;
                  const isExpanded = expandedId === eventId;
                  return (
                    <div
                      className={`taf-event ${isExpanded ? 'taf-event--expanded' : ''}`}
                      key={eventId}
                      onClick={() => setExpandedId(isExpanded ? null : eventId)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter') setExpandedId(isExpanded ? null : eventId); }}
                    >
                      <span className="taf-event-icon">{icon}</span>
                      <div className="taf-event-body">
                        <span className="taf-event-msg">{event.message}</span>
                        <span className="taf-event-time">{relativeTime(event.at)}</span>
                        {isExpanded && event.metadata && (
                          <div className="taf-event-meta">
                            {Object.entries(event.metadata).map(([k, v]) => (
                              <div className="taf-meta-row" key={k}>
                                <span className="taf-meta-key">{k}</span>
                                <span className="taf-meta-val">{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <button
          className="taf-load-more"
          onClick={() => setVisibleCount(prev => prev + 20)}
        >
          Load more
        </button>
      )}
    </div>
  );
}
