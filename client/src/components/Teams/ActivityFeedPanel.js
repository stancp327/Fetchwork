import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';

const EVENT_CONFIG = {
  job_lead_assigned:   { dot: 'var(--color-primary)', label: (e) => `${actorName(e)} assigned a new lead` },
  job_role_set:        { dot: 'var(--color-primary)', label: (e) => `${actorName(e)} updated job roles` },
  subtask_created:     { dot: 'var(--color-success)', label: (e) => `${actorName(e)} created subtask "${e.metadata?.title || ''}"` },
  subtask_completed:   { dot: 'var(--color-success)', label: (e) => `${actorName(e)} completed a subtask` },
  subtask_assigned:    { dot: 'var(--color-success)', label: (e) => `${actorName(e)} assigned a subtask` },
  job_status_changed:  { dot: 'var(--color-warning)', label: (e) => `${actorName(e)} changed job status` },
  progress_note_added: { dot: 'var(--color-text-muted)', label: (e) => `${actorName(e)} added a progress note` },
  job_kanban_updated:  { dot: 'var(--color-warning)', label: (e) => `${actorName(e)} moved to ${e.after?.kanbanColumn || 'column'}` },
  job_pinned:          { dot: 'var(--color-warning)', label: (e) => `${actorName(e)} pinned this job` },
  job_unpinned:        { dot: 'var(--color-warning)', label: (e) => `${actorName(e)} unpinned this job` },
  chat_message_sent:   { dot: 'var(--color-text-muted)', label: (e) => `${actorName(e)} sent a message` },
};

function actorName(entry) {
  return entry.actor?.firstName || 'Someone';
}

const relTime = (d) => {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
};

export default function ActivityFeedPanel({ teamId, jobId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiRequest(`/api/teams/${teamId}/jobs/${jobId}/activity`);
      setEntries(res.entries || []);
    } catch (e) {
      setError(e.message || 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [teamId, jobId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="af-loading">Loading activity…</div>;
  if (error) return (
    <div className="af-error">
      {error} <button className="af-retry-btn" onClick={load}>Retry</button>
    </div>
  );

  if (entries.length === 0) {
    return (
      <div className="af-panel">
        <div className="af-empty">
          <span className="af-empty-icon">📋</span>
          <p>No activity yet.</p>
          <p className="af-empty-sub">Actions on this job will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="af-panel">
      <div className="af-header">
        <span className="af-label">Activity</span>
      </div>
      <div className="af-list">
        {entries.map(entry => {
          const config = EVENT_CONFIG[entry.action] || { dot: 'var(--color-text-muted)', label: () => `${actorName(entry)} performed ${entry.action}` };
          return (
            <div key={entry._id} className="af-entry">
              <span className="af-dot" style={{ background: config.dot }} />
              <div className="af-entry-content">
                <span className="af-entry-text">{config.label(entry)}</span>
                <span className="af-entry-time">{relTime(entry.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
