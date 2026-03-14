import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import './TeamJobs.css';

const STATUS_LABELS = {
  accepted:      { label: 'Accepted',    color: '#2563eb' },
  pending_start: { label: 'Starting',    color: '#7c3aed' },
  in_progress:   { label: 'In Progress', color: '#d97706' },
  delivered:     { label: 'Delivered',   color: '#059669' },
  completed:     { label: 'Completed',   color: '#16a34a' },
  open:          { label: 'Open',        color: '#6b7280' },
};

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

const daysLeft = (date) => {
  if (!date) return null;
  const diff = Math.ceil((new Date(date) - Date.now()) / 86_400_000);
  return diff;
};

export default function TeamJobs({ teamId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [tab, setTab]         = useState('active'); // 'active' | 'pending'

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

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="tj-loading">Loading jobs…</div>;
  if (error)   return <div className="tj-error">{error}</div>;

  const active  = data?.assignedJobs    || [];
  const pending = data?.pendingProposals || [];

  return (
    <div className="tj-wrap">
      <div className="tj-header">
        <h2 className="tj-title">Team Jobs</h2>
        <div className="tj-tabs">
          <button className={`tj-tab${tab === 'active' ? ' active' : ''}`} onClick={() => setTab('active')}>
            Active <span className="tj-count">{active.length}</span>
          </button>
          <button className={`tj-tab${tab === 'pending' ? ' active' : ''}`} onClick={() => setTab('pending')}>
            Pending Proposals <span className="tj-count">{pending.length}</span>
          </button>
        </div>
      </div>

      {tab === 'active' && (
        <div className="tj-list">
          {active.length === 0 ? (
            <div className="tj-empty">
              <p>No active jobs yet.</p>
              <p className="tj-empty-sub">When a client accepts a team proposal, the job will appear here.</p>
            </div>
          ) : active.map(job => {
            const s = STATUS_LABELS[job.status] || {};
            const auto = job.autoReleaseAt ? daysLeft(job.autoReleaseAt) : null;
            return (
              <div key={job._id} className="tj-card">
                <div className="tj-card-header">
                  <Link to={`/jobs/${job._id}`} className="tj-job-title">{job.title}</Link>
                  <span className="tj-status-badge" style={{ background: s.color }}>{s.label}</span>
                </div>
                <div className="tj-card-meta">
                  <span>💰 {fmt(job.budget?.max || job.budget?.min || 0)}</span>
                  {job.client && (
                    <span>👤 <Link to={`/freelancers/${job.client.username || job.client._id}`}>{job.client.firstName} {job.client.lastName}</Link></span>
                  )}
                  {job.assignedTo && (
                    <span>🔧 Lead: <Link to={`/freelancers/${job.assignedTo.username || job.assignedTo._id}`}>{job.assignedTo.firstName}</Link></span>
                  )}
                  {auto !== null && auto >= 0 && (
                    <span className="tj-auto-release">⏱ Auto-release in {auto}d</span>
                  )}
                  {auto !== null && auto < 0 && (
                    <span className="tj-auto-release tj-overdue">⏱ Auto-release overdue</span>
                  )}
                </div>
                <div className="tj-card-actions">
                  <Link to={`/jobs/${job._id}`} className="tj-btn-view">View Job →</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'pending' && (
        <div className="tj-list">
          {pending.length === 0 ? (
            <div className="tj-empty">
              <p>No pending proposals.</p>
              <p className="tj-empty-sub">Submit proposals on jobs using the "Bid as Team" option.</p>
            </div>
          ) : pending.map(job => {
            const tp = job.teamProposal;
            return (
              <div key={job._id} className="tj-card tj-card--pending">
                <div className="tj-card-header">
                  <Link to={`/jobs/${job._id}`} className="tj-job-title">{job.title}</Link>
                  <span className="tj-status-badge" style={{ background: '#6b7280' }}>Awaiting Response</span>
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
