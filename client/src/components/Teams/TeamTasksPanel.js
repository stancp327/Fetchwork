import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import './TeamTasks.css';

// ── Constants ────────────────────────────────────────────────────
const STATUS_LABELS = {
  open:        'Open',
  in_progress: 'In Progress',
  submitted:   'Submitted',
  approved:    'Approved',
  paid:        'Paid',
  rejected:    'Rejected',
};

const ALL_STATUSES = ['open', 'in_progress', 'submitted', 'approved', 'paid', 'rejected'];

function StatusBadge({ status }) {
  return (
    <span className={`tt-badge tt-badge--${status}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function formatMember(member) {
  if (!member) return '—';
  if (member.firstName || member.lastName) {
    return `${member.firstName || ''} ${member.lastName || ''}`.trim();
  }
  return member.email || member.username || String(member._id || member);
}

// ── Create / Edit Task Modal ──────────────────────────────────────
function TaskFormModal({ task, teamMembers, onClose, onSaved, teamId }) {
  const isEdit = Boolean(task?._id);
  const [form, setForm] = useState({
    title:       task?.title       || '',
    description: task?.description || '',
    assignee:    task?.assignee?._id || task?.assignee || '',
    payType:     task?.payType     || 'per_job',
    flatAmount:  task?.flatAmount  != null ? String(task.flatAmount) : '',
    hourlyRate:  task?.hourlyRate  != null ? String(task.hourlyRate) : '',
    selfApprovePayout: task?.selfApprovePayout || false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (form.payType === 'per_job' && !form.flatAmount) {
      setError('Amount is required for fixed-price tasks.');
      return;
    }
    if (form.payType === 'per_hour' && !form.hourlyRate) {
      setError('Hourly rate is required for hourly tasks.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = {
        title:       form.title.trim(),
        description: form.description.trim(),
        assignee:    form.assignee || undefined,
        payType:     form.payType,
        selfApprovePayout: form.selfApprovePayout,
      };
      if (form.payType === 'per_job') {
        body.flatAmount = parseFloat(form.flatAmount);
      } else {
        body.hourlyRate = parseFloat(form.hourlyRate);
      }
      if (isEdit) {
        await apiRequest(`/api/teams/${teamId}/tasks/${task._id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        await apiRequest(`/api/teams/${teamId}/tasks`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tt-modal-overlay" onClick={onClose}>
      <div className="tt-modal" onClick={e => e.stopPropagation()}>
        <h3 className="tt-modal-title">{isEdit ? 'Edit Task' : 'Create Task'}</h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* Title */}
          <div className="tt-field">
            <label className="tt-label">Title *</label>
            <input
              className="tt-input"
              required
              maxLength={200}
              placeholder="Task name"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>

          {/* Description */}
          <div className="tt-field">
            <label className="tt-label">Description</label>
            <textarea
              className="tt-textarea"
              maxLength={2000}
              placeholder="What needs to be done?"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Assignee */}
          <div className="tt-field">
            <label className="tt-label">Assign To</label>
            <select
              className="tt-select"
              value={form.assignee}
              onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}
            >
              <option value="">Unassigned</option>
              {teamMembers.map(m => {
                const uid = String(m.user?._id || m.user?.id || m.user || '');
                const name = formatMember(m.user);
                return (
                  <option key={uid} value={uid}>{name}</option>
                );
              })}
            </select>
          </div>

          {/* Pay Type */}
          <div className="tt-field">
            <label className="tt-label">Pay Type</label>
            <div className="tt-pay-toggle">
              <label className={`tt-pay-option${form.payType === 'per_job' ? ' tt-pay-option--selected' : ''}`}>
                <input
                  type="radio"
                  value="per_job"
                  checked={form.payType === 'per_job'}
                  onChange={() => setForm(f => ({ ...f, payType: 'per_job' }))}
                />
                💼 Fixed Price
              </label>
              <label className={`tt-pay-option${form.payType === 'per_hour' ? ' tt-pay-option--selected' : ''}`}>
                <input
                  type="radio"
                  value="per_hour"
                  checked={form.payType === 'per_hour'}
                  onChange={() => setForm(f => ({ ...f, payType: 'per_hour' }))}
                />
                ⏱ Per Hour
              </label>
            </div>
          </div>

          {/* Amount / Rate */}
          {form.payType === 'per_job' ? (
            <div className="tt-field">
              <label className="tt-label">Amount ($)</label>
              <input
                className="tt-input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={form.flatAmount}
                onChange={e => setForm(f => ({ ...f, flatAmount: e.target.value }))}
              />
            </div>
          ) : (
            <div className="tt-field">
              <label className="tt-label">Hourly Rate ($/hr)</label>
              <input
                className="tt-input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={form.hourlyRate}
                onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))}
              />
            </div>
          )}

          {/* Self-approve option */}
          <div className="tt-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
              <input
                type="checkbox"
                checked={form.selfApprovePayout}
                onChange={e => setForm(f => ({ ...f, selfApprovePayout: e.target.checked }))}
              />
              Allow assignee to self-approve payout
            </label>
          </div>

          {error && <p className="tt-form-error">{error}</p>}

          <div className="tt-modal-actions">
            <button type="button" className="tt-btn tt-btn--secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="tt-btn tt-btn--primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Log Hours Modal ───────────────────────────────────────────────
function LogHoursModal({ task, teamId, onClose, onSaved }) {
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const h = parseFloat(hours);
    if (!h || h <= 0) { setError('Enter a valid number of hours.'); return; }
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/api/teams/${teamId}/tasks/${task._id}/log-hours`, {
        method: 'POST',
        body: JSON.stringify({ hours: h, note: note.trim() }),
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to log hours');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tt-modal-overlay" onClick={onClose}>
      <div className="tt-modal" onClick={e => e.stopPropagation()}>
        <h3 className="tt-modal-title">Log Hours</h3>
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          Task: <strong>{task.title}</strong>
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="tt-field">
            <label className="tt-label">Hours Worked *</label>
            <input
              className="tt-input"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="e.g. 2.5"
              value={hours}
              onChange={e => setHours(e.target.value)}
              autoFocus
            />
          </div>
          <div className="tt-field">
            <label className="tt-label">Note (optional)</label>
            <textarea
              className="tt-textarea"
              maxLength={500}
              placeholder="What did you work on?"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
            />
          </div>
          {error && <p className="tt-form-error">{error}</p>}
          <div className="tt-modal-actions">
            <button type="button" className="tt-btn tt-btn--secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="tt-btn tt-btn--primary" disabled={saving}>
              {saving ? 'Logging…' : 'Log Hours'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Task Card ─────────────────────────────────────────────────────
function TaskCard({ task, teamId, currentUserId, isOwnerOrAdmin, onRefresh, teamMembers }) {
  const [actionLoading, setActionLoading] = useState(null);
  const [showLogHours, setShowLogHours] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const assigneeId = String(task.assignee?._id || task.assignee || '');
  const isAssignee = assigneeId === currentUserId;
  const canManage = isOwnerOrAdmin;

  const doAction = useCallback(async (endpoint, method = 'POST', body = {}) => {
    setActionLoading(endpoint);
    try {
      await apiRequest(`/api/teams/${teamId}${endpoint}`, {
        method,
        body: JSON.stringify(body),
      });
      onRefresh();
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  }, [teamId, onRefresh]);

  const handleDelete = async () => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    await doAction(`/tasks/${task._id}`, 'DELETE');
  };

  const payInfo = task.payType === 'per_job'
    ? `$${(task.flatAmount || 0).toFixed(2)} fixed`
    : `$${(task.hourlyRate || 0).toFixed(2)}/hr`;

  const hoursText = task.payType === 'per_hour' && task.hoursLogged != null
    ? `${task.hoursLogged.toFixed(2)} hrs logged`
    : null;

  const totalEarned = task.payType === 'per_hour' && task.hoursLogged
    ? `= $${((task.hourlyRate || 0) * task.hoursLogged).toFixed(2)}`
    : null;

  return (
    <>
      <div className="tt-task-card">
        {/* Top row: title + badge */}
        <div className="tt-task-top">
          <h3 className="tt-task-title">{task.title}</h3>
          <StatusBadge status={task.status} />
        </div>

        {/* Description */}
        {task.description && (
          <p className="tt-task-desc">{task.description}</p>
        )}

        {/* Meta */}
        <div className="tt-task-meta">
          {task.assignee && (
            <span className="tt-meta-item">
              <span className="tt-meta-icon">👤</span>
              {formatMember(task.assignee)}
            </span>
          )}
          <span className="tt-meta-item">
            <span className="tt-meta-icon">💰</span>
            {payInfo}
          </span>
          {hoursText && (
            <span className="tt-meta-item">
              <span className="tt-meta-icon">⏱</span>
              {hoursText}
              {totalEarned && <span style={{ color: '#16a34a', marginLeft: 4 }}>{totalEarned}</span>}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="tt-task-actions">
          {/* Edit / Delete — owner/admin on any non-paid task */}
          {canManage && task.status !== 'paid' && (
            <>
              <button
                className="tt-btn tt-btn--secondary"
                onClick={() => setShowEdit(true)}
                disabled={!!actionLoading}
              >
                Edit
              </button>
              <button
                className="tt-btn tt-btn--danger"
                onClick={handleDelete}
                disabled={!!actionLoading}
              >
                Delete
              </button>
            </>
          )}

          {/* Log Hours — assignee when in_progress and per_hour */}
          {isAssignee && task.status === 'in_progress' && task.payType === 'per_hour' && (
            <button
              className="tt-btn tt-btn--secondary"
              onClick={() => setShowLogHours(true)}
              disabled={!!actionLoading}
            >
              ⏱ Log Hours
            </button>
          )}

          {/* Start — assignee when task is open */}
          {isAssignee && task.status === 'open' && (
            <button
              className="tt-btn tt-btn--primary"
              onClick={() => doAction(`/tasks/${task._id}`, 'PUT', { status: 'in_progress' })}
              disabled={actionLoading === `/tasks/${task._id}`}
            >
              {actionLoading === `/tasks/${task._id}` ? '…' : 'Start'}
            </button>
          )}

          {/* Submit — assignee when in_progress */}
          {isAssignee && task.status === 'in_progress' && (
            <button
              className="tt-btn tt-btn--primary"
              onClick={() => doAction(`/tasks/${task._id}/submit`)}
              disabled={actionLoading === `/tasks/${task._id}/submit`}
            >
              {actionLoading === `/tasks/${task._id}/submit` ? '…' : '✔ Submit'}
            </button>
          )}

          {/* Approve / Reject — owner/admin when submitted */}
          {isOwnerOrAdmin && task.status === 'submitted' && (
            <>
              <button
                className="tt-btn tt-btn--success"
                onClick={() => doAction(`/tasks/${task._id}/approve`)}
                disabled={!!actionLoading}
              >
                {actionLoading === `/tasks/${task._id}/approve` ? '…' : '✔ Approve'}
              </button>
              <button
                className="tt-btn tt-btn--danger"
                onClick={() => doAction(`/tasks/${task._id}/reject`)}
                disabled={!!actionLoading}
              >
                {actionLoading === `/tasks/${task._id}/reject` ? '…' : '✖ Reject'}
              </button>
            </>
          )}

          {/* Pay — owner/admin when approved */}
          {isOwnerOrAdmin && task.status === 'approved' && (
            <button
              className="tt-btn tt-btn--pay"
              onClick={() => doAction(`/tasks/${task._id}/pay`)}
              disabled={actionLoading === `/tasks/${task._id}/pay`}
            >
              {actionLoading === `/tasks/${task._id}/pay` ? '…' : '💸 Pay Out'}
            </button>
          )}
        </div>
      </div>

      {/* Log Hours Modal */}
      {showLogHours && (
        <LogHoursModal
          task={task}
          teamId={teamId}
          onClose={() => setShowLogHours(false)}
          onSaved={() => { setShowLogHours(false); onRefresh(); }}
        />
      )}

      {/* Edit Modal */}
      {showEdit && (
        <TaskFormModal
          task={task}
          teamMembers={teamMembers}
          teamId={teamId}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); onRefresh(); }}
        />
      )}
    </>
  );
}

// ── Main Panel ────────────────────────────────────────────────────
export default function TeamTasksPanel({ teamId, team }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const currentUserId = String(user?._id || user?.id || '');
  const myMember = team?.members?.find(m =>
    String(m.user?._id || m.user?.id || m.user || '') === currentUserId
  );
  const isOwnerOrAdmin = Boolean(
    team?.currentUserIsOwner ||
    team?.currentUserRole === 'owner' ||
    team?.currentUserRole === 'admin' ||
    myMember?.role === 'owner' ||
    myMember?.role === 'admin'
  );
  const activeMembers = (team?.members || []).filter(m => m.status === 'active');

  const fetchTasks = useCallback(async () => {
    setError('');
    try {
      const data = await apiRequest(`/api/teams/${teamId}/tasks`);
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const filteredTasks = statusFilter
    ? tasks.filter(t => t.status === statusFilter)
    : tasks;

  if (loading) {
    return (
      <div className="tt-skeleton">
        <div className="tt-skeleton-card" />
        <div className="tt-skeleton-card" />
        <div className="tt-skeleton-card" />
      </div>
    );
  }

  return (
    <div className="tt-container">
      {/* Header */}
      <div className="tt-header">
        <h2>Tasks</h2>
        {isOwnerOrAdmin && (
          <button className="tt-btn tt-btn--primary" onClick={() => setShowCreate(true)}>
            + New Task
          </button>
        )}
      </div>

      {/* Error */}
      {error && <div className="tt-error">{error}</div>}

      {/* Status filter */}
      <div className="tt-filter-bar">
        <button
          className={`tt-filter-btn${statusFilter === '' ? ' tt-filter-btn--active' : ''}`}
          onClick={() => setStatusFilter('')}
        >
          All ({tasks.length})
        </button>
        {ALL_STATUSES.map(s => {
          const count = tasks.filter(t => t.status === s).length;
          if (count === 0) return null;
          return (
            <button
              key={s}
              className={`tt-filter-btn${statusFilter === s ? ' tt-filter-btn--active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {STATUS_LABELS[s]} ({count})
            </button>
          );
        })}
      </div>

      {/* Task list */}
      {filteredTasks.length === 0 ? (
        <div className="tt-empty">
          <div className="tt-empty-icon">📋</div>
          <p className="tt-empty-text">
            {statusFilter ? `No ${STATUS_LABELS[statusFilter]?.toLowerCase()} tasks.` : 'No tasks yet.'}
          </p>
        </div>
      ) : (
        <div className="tt-task-list">
          {filteredTasks.map(task => (
            <TaskCard
              key={task._id}
              task={task}
              teamId={teamId}
              currentUserId={currentUserId}
              isOwnerOrAdmin={isOwnerOrAdmin}
              onRefresh={fetchTasks}
              teamMembers={activeMembers}
            />
          ))}
        </div>
      )}

      {/* Create Task Modal */}
      {showCreate && (
        <TaskFormModal
          task={null}
          teamMembers={activeMembers}
          teamId={teamId}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); fetchTasks(); }}
        />
      )}
    </div>
  );
}
