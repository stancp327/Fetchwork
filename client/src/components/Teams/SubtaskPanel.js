import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '../../utils/api';

const STATUS_CYCLE = ['todo', 'in_progress', 'review', 'done'];
const STATUS_ICONS = { todo: '○', in_progress: '◑', review: '◕', done: '●' };
const STATUS_COLORS = { todo: 'var(--color-text-secondary)', in_progress: 'var(--color-warning-dark)', review: 'var(--color-accent)', done: 'var(--color-success)' };
const PRIORITY_COLORS = { low: 'var(--color-text-secondary)', medium: 'var(--color-primary)', high: 'var(--color-warning-dark)', urgent: 'var(--color-danger)' };

export default function SubtaskPanel({ teamId, jobId, teamMembers = [] }) {
  const [subtasks, setSubtasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [dragIdx, setDragIdx] = useState(null);
  const [dropIdx, setDropIdx] = useState(null);
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest(`/api/teams/${teamId}/jobs/${jobId}/subtasks`);
      setSubtasks(res.subtasks || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [teamId, jobId]);

  useEffect(() => { load(); }, [load]);

  const addSubtask = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle('');
    try {
      const res = await apiRequest(`/api/teams/${teamId}/jobs/${jobId}/subtasks`, {
        method: 'POST',
        body: JSON.stringify({ title }),
      });
      setSubtasks(prev => [...prev, res.subtask]);
    } catch (err) { alert(err.message || 'Failed to add subtask'); }
  };

  const cycleStatus = async (subtask) => {
    const idx = STATUS_CYCLE.indexOf(subtask.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    // Optimistic update
    setSubtasks(prev => prev.map(s => s._id === subtask._id ? { ...s, status: next } : s));
    try {
      await apiRequest(`/api/teams/${teamId}/jobs/${jobId}/subtasks/${subtask._id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: next }),
      });
    } catch { load(); }
  };

  const updateAssignee = async (subtask, userId) => {
    setSubtasks(prev => prev.map(s => s._id === subtask._id ? { ...s, assignedTo: userId ? { _id: userId } : null } : s));
    try {
      await apiRequest(`/api/teams/${teamId}/jobs/${jobId}/subtasks/${subtask._id}`, {
        method: 'PUT',
        body: JSON.stringify({ assignedTo: userId || null }),
      });
    } catch { load(); }
  };

  const deleteSubtask = async (subtask) => {
    setSubtasks(prev => prev.filter(s => s._id !== subtask._id));
    try {
      await apiRequest(`/api/teams/${teamId}/jobs/${jobId}/subtasks/${subtask._id}`, { method: 'DELETE' });
    } catch { load(); }
  };

  // Drag-to-reorder handlers
  const onDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e, idx) => {
    e.preventDefault();
    setDropIdx(idx);
  };
  const onDragEnd = async () => {
    if (dragIdx === null || dropIdx === null || dragIdx === dropIdx) {
      setDragIdx(null);
      setDropIdx(null);
      return;
    }
    const items = [...subtasks];
    const [moved] = items.splice(dragIdx, 1);
    items.splice(dropIdx, 0, moved);
    setSubtasks(items);
    setDragIdx(null);
    setDropIdx(null);
    // Persist order (batch update all positions)
    try {
      const reorderPayload = items.map((s, i) => ({ id: s._id, order: i }));
      await apiRequest(`/api/teams/${teamId}/jobs/${jobId}/subtasks/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ order: reorderPayload }),
      });
    } catch { load(); }
  };

  const doneCount = subtasks.filter(s => s.status === 'done').length;
  const total = subtasks.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  if (loading) return <div className="st-loading">Loading subtasks…</div>;

  return (
    <div className="st-panel">
      <div className="st-header">
        <span className="st-label">Subtasks</span>
        {total > 0 && (
          <span className="st-progress-text">{doneCount}/{total} done</span>
        )}
      </div>
      {total > 0 && (
        <div className="st-progress-bar">
          <div className="st-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="st-list">
        {subtasks.map((st, idx) => {
          const isOverdue = st.dueDate && new Date(st.dueDate) < Date.now() && st.status !== 'done';
          return (
            <div
              key={st._id}
              className={`st-item${dropIdx === idx && dragIdx !== null ? ' st-drop-target' : ''}${dragIdx === idx ? ' st-dragging' : ''}`}
              draggable
              onDragStart={(e) => onDragStart(e, idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDragEnd={onDragEnd}
            >
              <button
                className="st-status-btn"
                style={{ color: STATUS_COLORS[st.status] }}
                onClick={() => cycleStatus(st)}
                title={`Status: ${st.status} (click to cycle)`}
              >
                {STATUS_ICONS[st.status]}
              </button>
              <span className={`st-title${st.status === 'done' ? ' st-done' : ''}`}>{st.title}</span>
              {st.dueDate && (
                <span className={`st-due${isOverdue ? ' st-overdue' : ''}`}>
                  {new Date(st.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
              <select
                className="st-assignee-select"
                value={st.assignedTo?._id || ''}
                onChange={(e) => updateAssignee(st, e.target.value)}
                title="Assign member"
              >
                <option value="">—</option>
                {teamMembers.map(m => (
                  <option key={m._id} value={m._id}>{m.firstName}</option>
                ))}
              </select>
              <button className="st-delete-btn" onClick={() => deleteSubtask(st)} title="Delete">×</button>
            </div>
          );
        })}
      </div>
      <div className="st-add-row">
        <input
          ref={inputRef}
          className="st-add-input"
          placeholder="Add a subtask…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addSubtask(); }}
        />
      </div>
    </div>
  );
}
