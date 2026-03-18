import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import SubtaskPanel from './SubtaskPanel';
import RoleAssignment from './RoleAssignment';
import JobChatPanel from './JobChatPanel';
import ProgressNotesPanel from './ProgressNotesPanel';
import ActivityFeedPanel from './ActivityFeedPanel';
import './TeamJobs.css';

const STATUS_LABELS = {
  accepted:      { label: 'Accepted',    color: 'var(--color-primary)' },
  pending_start: { label: 'Starting',    color: 'var(--color-accent)' },
  in_progress:   { label: 'In Progress', color: 'var(--color-warning-dark)' },
  delivered:     { label: 'Delivered',    color: 'var(--color-success-dark)' },
  completed:     { label: 'Completed',   color: 'var(--color-success)' },
  open:          { label: 'Open',        color: 'var(--color-text-secondary)' },
};

const KANBAN_COLUMNS = [
  { key: 'backlog',     label: 'Backlog' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review',      label: 'Review' },
  { key: 'done',        label: 'Done' },
];

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

const daysLeft = (date) => {
  if (!date) return null;
  return Math.ceil((new Date(date) - Date.now()) / 86_400_000);
};

function deadlineChipClass(days) {
  if (days === null) return '';
  if (days < 0) return 'tj-deadline-overdue';
  if (days <= 3) return 'tj-deadline-red';
  if (days <= 7) return 'tj-deadline-yellow';
  return 'tj-deadline-green';
}

function deadlineText(date) {
  if (!date) return null;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function workloadColor(count) {
  if (count <= 2) return 'var(--color-success)';
  if (count <= 5) return 'var(--color-warning-dark)';
  return 'var(--color-danger)';
}

export default function TeamJobs({ teamId, teamMembers = [] }) {
  const { user } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [tab, setTab]         = useState('active');
  const [assigningLead, setAssigningLead] = useState(null);
  const [expandedJob, setExpandedJob] = useState(null);
  const [openChat, setOpenChat] = useState(null);
  const [openActivity, setOpenActivity] = useState(null);
  const [workload, setWorkload] = useState({});
  const [quickMenu, setQuickMenu] = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [deadlinePicker, setDeadlinePicker] = useState(null);
  const [deadlineVal, setDeadlineVal] = useState('');

  // Kanban state - persisted per team in localStorage
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem(`tj_view_${teamId}`) || 'list'; }
    catch { return 'list'; }
  });

  // Drag state for kanban
  const [dragJobId, setDragJobId] = useState(null);
  const [dropCol, setDropCol] = useState(null);

  const members = teamMembers
    .filter(m => m.status === 'active')
    .map(m => {
      const u = m.user || {};
      return { _id: u._id || m._id, firstName: u.firstName || '', lastName: u.lastName || '', avatar: u.avatar || '' };
    });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/teams/${teamId}/jobs`);
      setData(res);
    } catch (e) {
      setError(e.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  const loadWorkload = useCallback(async () => {
    try {
      const res = await apiRequest(`/api/teams/${teamId}/members/workload`);
      setWorkload(res.workload || {});
    } catch { /* silent */ }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadWorkload(); }, [loadWorkload]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Don't trigger when typing in inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return;
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        toggleView();
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        // Focus subtask input in expanded card
        const el = document.querySelector('.st-add-input');
        if (el) el.focus();
      }
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        const el = document.querySelector('.jc-input');
        if (el) el.focus();
      }
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleView = () => {
    const next = viewMode === 'list' ? 'kanban' : 'list';
    setViewMode(next);
    try { localStorage.setItem(`tj_view_${teamId}`, next); } catch {}
  };

  const toggleExpand = (jobId) => setExpandedJob(prev => prev === jobId ? null : jobId);
  const toggleChat = (jobId) => setOpenChat(prev => prev === jobId ? null : jobId);
  const toggleActivity = (jobId) => setOpenActivity(prev => prev === jobId ? null : jobId);

  // Kanban drag handlers
  const onKanbanDragStart = (e, jobId) => {
    setDragJobId(jobId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onKanbanDragOver = (e, colKey) => {
    e.preventDefault();
    setDropCol(colKey);
  };
  const onKanbanDragLeave = () => setDropCol(null);
  const onKanbanDrop = async (e, colKey) => {
    e.preventDefault();
    if (!dragJobId) return;
    const oldCol = (data?.assignedJobs || []).find(j => j._id === dragJobId)?.kanbanColumn;
    if (oldCol === colKey) { setDragJobId(null); setDropCol(null); return; }

    // Optimistic update
    setData(prev => ({
      ...prev,
      assignedJobs: (prev?.assignedJobs || []).map(j =>
        j._id === dragJobId ? { ...j, kanbanColumn: colKey } : j
      ),
    }));
    setDragJobId(null);
    setDropCol(null);

    try {
      await apiRequest(`/api/teams/${teamId}/jobs/${dragJobId}/kanban`, {
        method: 'PUT',
        body: JSON.stringify({ column: colKey }),
      });
    } catch {
      load(); // Revert on error
    }
  };

  // Pin/unpin job
  const togglePin = async (jobId) => {
    const pinned = data?.pinnedJobs || [];
    const isPinned = pinned.includes(jobId);
    // Optimistic
    setData(prev => ({
      ...prev,
      pinnedJobs: isPinned
        ? (prev.pinnedJobs || []).filter(id => id !== jobId)
        : [...(prev.pinnedJobs || []), jobId],
    }));
    try {
      await apiRequest(`/api/teams/${teamId}/jobs/${jobId}/pin`, { method: 'POST' });
    } catch { load(); }
    setQuickMenu(null);
  };

  // Mark urgent
  const toggleUrgent = async (jobId, current) => {
    setData(prev => ({
      ...prev,
      assignedJobs: (prev?.assignedJobs || []).map(j =>
        j._id === jobId ? { ...j, urgent: !current } : j
      ),
    }));
    try {
      await apiRequest(`/api/teams/${teamId}/jobs/${jobId}/quick`, {
        method: 'PATCH',
        body: JSON.stringify({ urgent: !current }),
      });
    } catch { load(); }
    setQuickMenu(null);
  };

  // Set deadline
  const saveDeadline = async (jobId) => {
    const val = deadlineVal || null;
    setData(prev => ({
      ...prev,
      assignedJobs: (prev?.assignedJobs || []).map(j =>
        j._id === jobId ? { ...j, deadline: val } : j
      ),
    }));
    try {
      await apiRequest(`/api/teams/${teamId}/jobs/${jobId}/quick`, {
        method: 'PATCH',
        body: JSON.stringify({ deadline: val }),
      });
    } catch { load(); }
    setDeadlinePicker(null);
    setDeadlineVal('');
    setQuickMenu(null);
  };

  // Copy link
  const copyLink = (jobId) => {
    navigator.clipboard?.writeText(`${window.location.origin}/jobs/${jobId}`);
    setQuickMenu(null);
  };

  if (loading) return <div className="tj-loading">Loading jobs…</div>;
  if (error) return (
    <div className="tj-error">
      {error}
      <button className="tj-retry-btn" onClick={load}>Retry</button>
    </div>
  );

  const active = data?.assignedJobs || [];
  const pending = data?.pendingProposals || [];
  const pinnedJobs = data?.pinnedJobs || [];

  // Sort: pinned first, then by createdAt
  const sortedActive = [...active].sort((a, b) => {
    const aPin = pinnedJobs.includes(a._id) ? -1 : 0;
    const bPin = pinnedJobs.includes(b._id) ? -1 : 0;
    if (aPin !== bPin) return aPin - bPin;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  // Job summary stats
  const now = Date.now();
  const weekFromNow = now + 7 * 86_400_000;
  const overdue = active.filter(j => j.deadline && new Date(j.deadline) < now).length;
  const dueThisWeek = active.filter(j => j.deadline && new Date(j.deadline) >= now && new Date(j.deadline) <= weekFromNow).length;

  // Assign default kanban column for jobs without one
  const getKanbanCol = (job) => {
    if (job.kanbanColumn) return job.kanbanColumn;
    if (['accepted', 'pending_start'].includes(job.status)) return 'backlog';
    if (job.status === 'in_progress') return 'in_progress';
    if (job.status === 'delivered') return 'review';
    return 'backlog';
  };

  const renderDeadlineChip = (job) => {
    if (!job.deadline) return null;
    const d = daysLeft(job.deadline);
    const cls = deadlineChipClass(d);
    return (
      <span className={`tj-deadline-chip ${cls}`}>
        {d < 0 ? <s>{deadlineText(job.deadline)}</s> : deadlineText(job.deadline)}
      </span>
    );
  };

  const renderQuickActions = (job) => (
    <div className="tj-quick-menu">
      <button className="tj-quick-item" onClick={() => copyLink(job._id)}>📋 Copy link</button>
      <button className="tj-quick-item" onClick={() => toggleUrgent(job._id, job.urgent)}>
        {job.urgent ? '🔕 Remove urgent' : '🔴 Mark urgent'}
      </button>
      <button className="tj-quick-item" onClick={() => { setDeadlinePicker(job._id); setDeadlineVal(job.deadline ? new Date(job.deadline).toISOString().slice(0, 10) : ''); }}>
        📅 Set deadline
      </button>
      <button className="tj-quick-item" onClick={() => togglePin(job._id)}>
        {pinnedJobs.includes(job._id) ? '📌 Unpin' : '📌 Pin to top'}
      </button>
    </div>
  );

  const renderJobCard = (job, opts = {}) => {
    const s = STATUS_LABELS[job.status] || {};
    const auto = job.autoReleaseAt ? daysLeft(job.autoReleaseAt) : null;
    const isExpanded = expandedJob === job._id;
    const chatOpen = openChat === job._id;
    const activityOpen = openActivity === job._id;
    const isPinned = pinnedJobs.includes(job._id);
    const isKanban = opts.kanban;

    return (
      <div
        key={job._id}
        className={`tj-card${isExpanded ? ' tj-card--expanded' : ''}${job.urgent ? ' tj-card--urgent' : ''}${isPinned ? ' tj-card--pinned' : ''}`}
        draggable={isKanban}
        onDragStart={isKanban ? (e) => onKanbanDragStart(e, job._id) : undefined}
      >
        <div className="tj-card-header" onClick={() => toggleExpand(job._id)} style={{ cursor: 'pointer' }}>
          <div className="tj-card-header-left">
            {!isKanban && <span className={`tj-expand-icon${isExpanded ? ' tj-expanded' : ''}`}>▸</span>}
            {isPinned && <span className="tj-pin-icon" title="Pinned">📌</span>}
            <Link to={`/jobs/${job._id}`} className="tj-job-title" onClick={e => e.stopPropagation()}>{job.title}</Link>
          </div>
          <div className="tj-card-header-right">
            <button
              className="tj-activity-toggle"
              onClick={(e) => { e.stopPropagation(); toggleActivity(job._id); }}
              title="Activity feed"
            >
              📋
            </button>
            <button
              className={`tj-chat-toggle${chatOpen ? ' tj-chat-active' : ''}`}
              onClick={(e) => { e.stopPropagation(); toggleChat(job._id); }}
              title="Team chat"
            >
              💬
            </button>
            <div className="tj-quick-wrap" onClick={e => e.stopPropagation()}>
              <button
                className="tj-quick-btn"
                onClick={() => setQuickMenu(quickMenu === job._id ? null : job._id)}
                title="Quick actions"
              >
                ⋯
              </button>
              {quickMenu === job._id && renderQuickActions(job)}
            </div>
            <span className="tj-status-badge" style={{ background: s.color }}>{s.label}</span>
          </div>
        </div>
        <div className="tj-card-meta">
          <span>💰 {fmt(job.budget?.max || job.budget?.min || 0)}</span>
          {job.client && (
            <span>👤 <Link to={`/freelancers/${job.client.username || job.client._id}`}>{job.client.firstName} {job.client.lastName}</Link></span>
          )}
          {job.assignedTo && (
            <span>🔧 Lead: <Link to={`/freelancers/${job.assignedTo.username || job.assignedTo._id}`}>{job.assignedTo.firstName}</Link></span>
          )}
          {renderDeadlineChip(job)}
          {auto !== null && auto >= 0 && (
            <span className="tj-auto-release">⏱ Auto-release in {auto}d</span>
          )}
          {auto !== null && auto < 0 && (
            <span className="tj-auto-release tj-overdue">⏱ Auto-release overdue</span>
          )}
        </div>

        {/* Deadline picker inline */}
        {deadlinePicker === job._id && (
          <div className="tj-deadline-picker" onClick={e => e.stopPropagation()}>
            <input
              type="date"
              className="tj-deadline-input"
              value={deadlineVal}
              onChange={e => setDeadlineVal(e.target.value)}
            />
            <button className="tj-deadline-save" onClick={() => saveDeadline(job._id)}>Save</button>
            <button className="tj-deadline-cancel" onClick={() => setDeadlinePicker(null)}>Cancel</button>
          </div>
        )}

        {/* Lead dropdown with workload indicator */}
        {!isKanban && members.length > 0 && (
          <div className="tj-lead-row">
            <span className="tj-lead-label">Lead:</span>
            <select
              className="tj-lead-select"
              value={job.assignedTo?._id || ''}
              disabled={assigningLead === job._id}
              onChange={async (e) => {
                const memberId = e.target.value;
                if (!memberId) return;
                setAssigningLead(job._id);
                try {
                  await apiRequest(`/api/teams/${teamId}/jobs/${job._id}/lead`, {
                    method: 'PATCH',
                    body: JSON.stringify({ memberId }),
                  });
                  load();
                } catch (err) {
                  alert(err.message || 'Failed to assign lead');
                } finally {
                  setAssigningLead(null);
                }
              }}
            >
              <option value="">-- Assign lead --</option>
              {members.map(m => {
                const wl = workload[m._id] || 0;
                return (
                  <option key={m._id} value={m._id}>
                    {m.firstName} {m.lastName} ({wl} active)
                  </option>
                );
              })}
            </select>
            {job.assignedTo?._id && (
              <span
                className="tj-workload-dot"
                style={{ background: workloadColor(workload[job.assignedTo._id] || 0) }}
                title={`${workload[job.assignedTo._id] || 0} active items`}
              >
                {workload[job.assignedTo._id] || 0}
              </span>
            )}
          </div>
        )}

        {/* Expanded panels */}
        {isExpanded && (
          <div className="tj-expanded-panels">
            <RoleAssignment teamId={teamId} jobId={job._id} teamMembers={members} />
            <SubtaskPanel teamId={teamId} jobId={job._id} teamMembers={members} />
            <ProgressNotesPanel
              teamId={teamId}
              jobId={job._id}
              teamMembers={members}
              currentUserId={user?._id || user?.id}
            />
          </div>
        )}

        {/* Activity feed panel */}
        {activityOpen && (
          <div className="tj-activity-section">
            <ActivityFeedPanel teamId={teamId} jobId={job._id} />
          </div>
        )}

        {/* Chat panel */}
        {chatOpen && (
          <div className="tj-chat-section">
            <JobChatPanel
              teamId={teamId}
              jobId={job._id}
              teamMembers={members}
              currentUserId={user?._id || user?.id}
            />
          </div>
        )}

        {!isKanban && (
          <div className="tj-card-actions">
            <Link to={`/jobs/${job._id}`} className="tj-btn-view">View Job →</Link>
          </div>
        )}
      </div>
    );
  };

  const renderKanbanBoard = () => (
    <div className="tj-kanban">
      {KANBAN_COLUMNS.map(col => {
        const colJobs = sortedActive.filter(j => getKanbanCol(j) === col.key);
        const isDropTarget = dropCol === col.key;
        return (
          <div
            key={col.key}
            className={`tj-kanban-col${isDropTarget ? ' tj-kanban-col--drop' : ''}`}
            onDragOver={(e) => onKanbanDragOver(e, col.key)}
            onDragLeave={onKanbanDragLeave}
            onDrop={(e) => onKanbanDrop(e, col.key)}
          >
            <div className="tj-kanban-col-header">
              <span className="tj-kanban-col-title">{col.label}</span>
              <span className="tj-kanban-col-count">{colJobs.length}</span>
            </div>
            <div className="tj-kanban-col-body">
              {colJobs.length === 0 ? (
                <div className="tj-kanban-empty">No jobs</div>
              ) : (
                colJobs.map(job => renderJobCard(job, { kanban: true }))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="tj-wrap">
      {/* Shortcut hints overlay */}
      {showShortcuts && (
        <div className="tj-shortcuts-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="tj-shortcuts-box" onClick={e => e.stopPropagation()}>
            <h3>Keyboard Shortcuts</h3>
            <div className="tj-shortcut-row"><kbd>K</kbd> Toggle kanban / list view</div>
            <div className="tj-shortcut-row"><kbd>N</kbd> Focus add-subtask input</div>
            <div className="tj-shortcut-row"><kbd>M</kbd> Focus chat input</div>
            <div className="tj-shortcut-row"><kbd>?</kbd> Toggle this help</div>
            <button className="tj-shortcuts-close" onClick={() => setShowShortcuts(false)}>Got it</button>
          </div>
        </div>
      )}

      <div className="tj-header">
        <h2 className="tj-title">Team Jobs</h2>
        <div className="tj-header-actions">
          <button
            className={`tj-view-toggle${viewMode === 'kanban' ? ' tj-view-active' : ''}`}
            onClick={toggleView}
            title="Toggle kanban/list (K)"
          >
            {viewMode === 'kanban' ? '☰ List' : '▤ Kanban'}
          </button>
          <button className="tj-shortcuts-trigger" onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (?)">?</button>
        </div>
      </div>

      {/* Summary stats bar */}
      <div className="tj-summary-bar">
        <div className="tj-summary-stat">
          <span className="tj-summary-num">{active.length}</span>
          <span className="tj-summary-label">Active</span>
        </div>
        <div className="tj-summary-stat tj-summary-stat--danger">
          <span className="tj-summary-num">{overdue}</span>
          <span className="tj-summary-label">Overdue</span>
        </div>
        <div className="tj-summary-stat tj-summary-stat--warning">
          <span className="tj-summary-num">{dueThisWeek}</span>
          <span className="tj-summary-label">Due This Week</span>
        </div>
        <div className="tj-summary-stat">
          <span className="tj-summary-num">{pending.length}</span>
          <span className="tj-summary-label">Pending</span>
        </div>
      </div>

      <div className="tj-tabs">
        <button className={`tj-tab${tab === 'active' ? ' active' : ''}`} onClick={() => setTab('active')}>
          Active <span className="tj-count">{active.length}</span>
        </button>
        <button className={`tj-tab${tab === 'pending' ? ' active' : ''}`} onClick={() => setTab('pending')}>
          Pending Proposals <span className="tj-count">{pending.length}</span>
        </button>
      </div>

      {tab === 'active' && (
        viewMode === 'kanban' ? renderKanbanBoard() : (
          <div className="tj-list">
            {sortedActive.length === 0 ? (
              <div className="tj-empty">
                <span className="tj-empty-icon">📂</span>
                <p>No active jobs yet.</p>
                <p className="tj-empty-sub">When a client accepts a team proposal, the job will appear here.</p>
              </div>
            ) : sortedActive.map(job => renderJobCard(job))}
          </div>
        )
      )}

      {tab === 'pending' && (
        <div className="tj-list">
          {pending.length === 0 ? (
            <div className="tj-empty">
              <span className="tj-empty-icon">📮</span>
              <p>No pending proposals.</p>
              <p className="tj-empty-sub">Submit proposals on jobs using the "Bid as Team" option.</p>
            </div>
          ) : pending.map(job => {
            const tp = job.teamProposal;
            return (
              <div key={job._id} className="tj-card tj-card--pending">
                <div className="tj-card-header">
                  <Link to={`/jobs/${job._id}`} className="tj-job-title">{job.title}</Link>
                  <span className="tj-status-badge" style={{ background: 'var(--color-text-secondary)' }}>Awaiting Response</span>
                </div>
                <div className="tj-card-meta">
                  <span>💰 Proposed: {tp ? fmt(tp.proposedBudget) : '—'}</span>
                  {job.client && (
                    <span>👤 <Link to={`/freelancers/${job.client.username || job.client._id}`}>{job.client.firstName} {job.client.lastName}</Link></span>
                  )}
                  {tp?.proposedDuration && <span>🗓 {tp.proposedDuration}</span>}
                </div>
                <div className="tj-card-actions">
                  <Link to={`/jobs/${job._id}`} className="tj-btn-view">View Job →</Link>
                  {tp && tp.status === 'pending' && (
                    <button
                      className="tj-btn-withdraw"
                      onClick={async () => {
                        if (!window.confirm('Withdraw this team proposal?')) return;
                        try {
                          await apiRequest(`/api/teams/${teamId}/proposals/${tp._id}/withdraw`, { method: 'POST' });
                          load();
                        } catch (err) {
                          alert(err.message || 'Failed to withdraw');
                        }
                      }}
                    >Withdraw</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
