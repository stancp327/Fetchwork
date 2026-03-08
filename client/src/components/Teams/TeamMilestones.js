import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import './TeamMilestones.css';

const COLUMNS = [
  { key: 'pending',     label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review',      label: 'In Review' },
  { key: 'completed',   label: 'Completed' },
  { key: 'blocked',     label: 'Blocked' },
];

const STATUS_OPTIONS = COLUMNS.map((c) => ({ value: c.key, label: c.label }));

function dueDateClass(dueDate) {
  if (!dueDate) return '';
  const now = new Date();
  const due = new Date(dueDate);
  const diff = (due - now) / (1000 * 60 * 60 * 24);
  if (diff < 0) return 'tm-overdue';
  if (diff <= 3) return 'tm-due-soon';
  return '';
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function avatarInitials(user) {
  if (!user) return '?';
  return ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || '?';
}

const TeamMilestones = ({ teamId, members = [], jobs = [] }) => {
  const { user } = useAuth();
  const [milestones, setMilestones] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form, setForm] = useState({ title: '', description: '', assignee: '', dueDate: '', amount: '', job: '' });

  // Status change modal
  const [activeCard, setActiveCard] = useState(null);

  // Completion note modal
  const [completingId, setCompletingId] = useState(null);
  const [completionNote, setCompletionNote] = useState('');

  const fetchMilestones = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiRequest(`/api/team-milestones/${teamId}`);
      setMilestones(data.milestones || []);
      setUserRole(data.userRole || null);
    } catch (err) {
      setError(err.message || 'Failed to load milestones');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchMilestones(); }, [fetchMilestones]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreateError('');
    setCreating(true);
    try {
      await apiRequest(`/api/team-milestones/${teamId}`, {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          assignee: form.assignee || undefined,
          dueDate: form.dueDate || undefined,
          amount: form.amount ? Number(form.amount) : undefined,
          job: form.job || undefined,
        }),
      });
      setForm({ title: '', description: '', assignee: '', dueDate: '', amount: '', job: '' });
      setShowCreate(false);
      fetchMilestones();
    } catch (err) {
      setCreateError(err.message || 'Failed to create milestone');
    } finally {
      setCreating(false);
    }
  };

  const changeStatus = async (milestoneId, newStatus) => {
    try {
      await apiRequest(`/api/team-milestones/${teamId}/${milestoneId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      setActiveCard(null);
      fetchMilestones();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleComplete = async (milestoneId) => {
    try {
      await apiRequest(`/api/team-milestones/${teamId}/${milestoneId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ completionNote }),
      });
      setCompletingId(null);
      setCompletionNote('');
      fetchMilestones();
    } catch (err) {
      alert(err.message || 'Failed to complete milestone');
    }
  };

  const handleApprove = async (milestoneId) => {
    try {
      await apiRequest(`/api/team-milestones/${teamId}/${milestoneId}/approve`, {
        method: 'POST',
      });
      fetchMilestones();
    } catch (err) {
      alert(err.message || 'Failed to approve milestone');
    }
  };

  const handleDelete = async (milestoneId) => {
    if (!window.confirm('Delete this milestone?')) return;
    try {
      await apiRequest(`/api/team-milestones/${teamId}/${milestoneId}`, {
        method: 'DELETE',
      });
      setActiveCard(null);
      fetchMilestones();
    } catch (err) {
      alert(err.message || 'Failed to delete milestone');
    }
  };

  const isManager = ['owner', 'admin', 'manager'].includes(userRole);
  const canDelete = ['owner', 'admin'].includes(userRole);

  const grouped = {};
  COLUMNS.forEach((c) => { grouped[c.key] = []; });
  milestones.forEach((m) => {
    if (grouped[m.status]) grouped[m.status].push(m);
  });

  if (loading) return <div className="tm-loading">Loading milestones…</div>;
  if (error) return (
    <div className="tm-error">
      <p>{error}</p>
      <button className="btn btn-primary btn-sm" onClick={fetchMilestones}>Retry</button>
    </div>
  );

  const activeMembers = members.filter((m) => {
    const status = m.status || (m.memberStatus);
    return status === 'active' || !status;
  });

  return (
    <div className="tm-container">
      <div className="tm-header">
        <h3>Milestones</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ Add Milestone'}
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="tm-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="tm-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Add Milestone</h4>
            <form onSubmit={handleCreate}>
              <div className="tm-form-group">
                <label>Title *</label>
                <input
                  type="text" required maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Milestone title"
                />
              </div>
              <div className="tm-form-group">
                <label>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                  rows={3}
                  maxLength={2000}
                />
              </div>
              <div className="tm-form-row">
                <div className="tm-form-group">
                  <label>Assignee</label>
                  <select
                    value={form.assignee}
                    onChange={(e) => setForm({ ...form, assignee: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {activeMembers.map((m) => {
                      const u = m.user || m;
                      const uid = u._id || u.id || m._id;
                      return (
                        <option key={uid} value={uid}>
                          {u.firstName} {u.lastName}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="tm-form-group">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="tm-form-row">
                <div className="tm-form-group">
                  <label>Amount ($)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="tm-form-group">
                  <label>Linked Job</label>
                  <select
                    value={form.job}
                    onChange={(e) => setForm({ ...form, job: e.target.value })}
                  >
                    <option value="">None</option>
                    {jobs.map((j) => (
                      <option key={j._id} value={j._id}>{j.title}</option>
                    ))}
                  </select>
                </div>
              </div>
              {createError && <p className="tm-form-error">{createError}</p>}
              <div className="tm-form-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                  {creating ? 'Creating…' : 'Create Milestone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Completion Note Modal */}
      {completingId && (
        <div className="tm-modal-overlay" onClick={() => setCompletingId(null)}>
          <div className="tm-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Submit for Review</h4>
            <div className="tm-form-group">
              <label>Completion Note</label>
              <textarea
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                placeholder="Describe what was done…"
                rows={3}
                maxLength={2000}
              />
            </div>
            <div className="tm-form-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setCompletingId(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={() => handleComplete(completingId)}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="tm-board">
        {COLUMNS.map((col) => (
          <div key={col.key} className="tm-column">
            <div className="tm-column-header">
              <span className="tm-column-title">{col.label}</span>
              <span className="tm-column-count">{grouped[col.key].length}</span>
            </div>
            <div className="tm-column-cards">
              {grouped[col.key].length === 0 && (
                <div className="tm-empty-col">No milestones</div>
              )}
              {grouped[col.key].map((m) => (
                <div
                  key={m._id}
                  className={`tm-card ${dueDateClass(m.dueDate)} ${activeCard === m._id ? 'tm-card-active' : ''}`}
                  onClick={() => setActiveCard(activeCard === m._id ? null : m._id)}
                >
                  <div className="tm-card-title">{m.title}</div>
                  {m.assignee && (
                    <div className="tm-card-assignee">
                      {m.assignee.profileImage ? (
                        <img src={m.assignee.profileImage} alt="" className="tm-avatar" />
                      ) : (
                        <span className="tm-avatar tm-avatar-initials">{avatarInitials(m.assignee)}</span>
                      )}
                      <span>{m.assignee.firstName} {m.assignee.lastName}</span>
                    </div>
                  )}
                  {m.dueDate && (
                    <div className={`tm-card-due ${dueDateClass(m.dueDate)}`}>
                      Due: {formatDate(m.dueDate)}
                    </div>
                  )}
                  {m.job && (
                    <div className="tm-card-job">{m.job.title}</div>
                  )}
                  {m.amount != null && (
                    <div className="tm-card-amount">${Number(m.amount).toLocaleString()}</div>
                  )}

                  {/* Status change dropdown */}
                  {activeCard === m._id && (
                    <div className="tm-card-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="tm-status-options">
                        {STATUS_OPTIONS.filter((s) => s.value !== m.status).map((s) => (
                          s.value === 'review' ? (
                            <button key={s.value} className="tm-status-btn" onClick={() => {
                              setActiveCard(null);
                              setCompletingId(m._id);
                            }}>
                              Submit for Review
                            </button>
                          ) : s.value === 'completed' ? null : (
                            <button key={s.value} className="tm-status-btn" onClick={() => changeStatus(m._id, s.value)}>
                              Move to {s.label}
                            </button>
                          )
                        ))}
                      </div>
                      {/* Approve button for managers on review cards */}
                      {m.status === 'review' && isManager && (
                        <button className="btn btn-primary btn-sm tm-approve-btn" onClick={() => handleApprove(m._id)}>
                          Approve
                        </button>
                      )}
                      {canDelete && (
                        <button className="tm-delete-btn" onClick={() => handleDelete(m._id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  )}

                  {/* Approved info */}
                  {m.status === 'completed' && m.approvedBy && (
                    <div className="tm-card-approved">
                      Approved by {m.approvedBy.firstName} {m.approvedBy.lastName}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeamMilestones;
