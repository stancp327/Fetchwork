import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import { categoryLabelMap } from '../../utils/categories';
import './ProjectManagement.css';

// ── Status helpers ──────────────────────────────────────────────
const STATUS_LABELS = {
  draft: 'Draft',
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};

const CATEGORY_LABELS = categoryLabelMap;

const formatCurrency = (amount, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

const timeAgo = (date) => {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};

// ── Milestone Progress ──────────────────────────────────────────
const MilestoneProgress = ({ milestones }) => {
  if (!milestones || milestones.length === 0) return null;

  const completed = milestones.filter(
    (m) => m.status === 'completed' || m.status === 'approved'
  ).length;
  const pct = Math.round((completed / milestones.length) * 100);

  return (
    <div className="pm-milestones">
      <h4>Milestones ({completed}/{milestones.length})</h4>
      <div className="pm-progress">
        <div className="pm-progress-bar">
          <div className="pm-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="pm-progress-label">{pct}% complete</div>
      </div>
      {milestones.map((m, i) => {
        const done = m.status === 'completed' || m.status === 'approved';
        return (
          <div key={m._id || i} className="pm-milestone-item">
            <span className="milestone-title">
              <span className={`milestone-check ${done ? 'done' : ''}`}>
                {done ? '✓' : ''}
              </span>
              {m.title}
            </span>
            <span className="milestone-amount">{formatCurrency(m.amount)}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── Proposal List (for clients reviewing proposals on their jobs) ──
const ProposalList = ({ proposals, jobId, onAccept }) => {
  const pending = (proposals || []).filter((p) => p.status === 'pending');
  if (pending.length === 0) return null;

  return (
    <div className="pm-proposals">
      <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
        Pending Proposals ({pending.length})
      </h4>
      {pending.map((p) => {
        const fl = p.freelancer || {};
        const initials = `${(fl.firstName || '?')[0]}${(fl.lastName || '?')[0]}`;
        const name = `${fl.firstName || 'Unknown'} ${fl.lastName || ''}`.trim();
        return (
          <div key={p._id} className="pm-proposal-item">
            <div className="pm-proposal-info">
              <div className="pm-proposal-avatar">{initials}</div>
              <div className="pm-proposal-details">
                <div className="proposal-name">{name}</div>
                <div className="proposal-meta">
                  {formatCurrency(p.proposedBudget)} · {p.proposedDuration?.replace(/_/g, ' ')}
                </div>
              </div>
            </div>
            <div className="pm-proposal-actions">
              <button
                className="btn-accept"
                onClick={() => onAccept(jobId, p._id)}
              >
                Accept
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Project Card ────────────────────────────────────────────────
const ProjectCard = ({ job, userRole, onAcceptProposal, onComplete }) => {
  const navigate = useNavigate();
  const budget = job.budget || {};
  const status = job.status || 'draft';
  const freelancer = job.freelancer || {};
  const client = job.client || {};
  const partner = userRole === 'client' ? freelancer : client;
  const partnerName = partner?.firstName
    ? `${partner.firstName} ${partner.lastName || ''}`.trim()
    : null;

  return (
    <div className="pm-project-card">
      <div className="pm-project-header">
        <span
          className="pm-project-title"
          onClick={() => navigate(`/jobs/${job._id}`)}
        >
          {job.title}
        </span>
        <span className={`pm-status-badge ${status}`}>
          {STATUS_LABELS[status] || status}
        </span>
      </div>

      <div className="pm-project-meta">
        <span className="meta-item">
          💰 {formatCurrency(budget.amount)} ({budget.type})
        </span>
        <span className="meta-item">
          📁 {CATEGORY_LABELS[job.category] || job.category}
        </span>
        {partnerName && (
          <span className="meta-item">
            👤 {userRole === 'client' ? 'Freelancer' : 'Client'}: {partnerName}
          </span>
        )}
        {job.proposals && (
          <span className="meta-item">📨 {job.proposals.length} proposals</span>
        )}
      </div>

      {job.description && (
        <div className="pm-project-desc">{job.description}</div>
      )}

      {/* Milestone progress for in-progress/completed jobs */}
      {(status === 'in_progress' || status === 'completed') && (
        <MilestoneProgress milestones={job.milestones} />
      )}

      {/* Proposals for client's open jobs */}
      {userRole === 'client' && status === 'open' && (
        <ProposalList
          proposals={job.proposals}
          jobId={job._id}
          onAccept={onAcceptProposal}
        />
      )}

      {/* Complete button for in-progress jobs */}
      {status === 'in_progress' && userRole === 'client' && (
        <button className="btn-complete" onClick={() => onComplete(job._id)}>
          ✓ Mark as Complete
        </button>
      )}

      <div className="pm-project-footer">
        <span className="footer-left">
          Created {timeAgo(job.createdAt)}
          {job.escrowAmount > 0 && ` · Escrow: ${formatCurrency(job.escrowAmount)}`}
          {job.totalPaid > 0 && ` · Paid: ${formatCurrency(job.totalPaid)}`}
        </span>
      </div>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────
const TABS = [
  { key: 'all', label: 'All Projects' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'open', label: 'Open' },
  { key: 'completed', label: 'Completed' },
  { key: 'proposals', label: 'My Proposals' },
];

const ProjectManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [proposalJobs, setProposalJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');

  const userId = user?._id || user?.id || user?.userId;

  // Fetch jobs where user is client or freelancer
  const fetchJobs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      // Fetch jobs where user is client
      const clientData = await apiRequest(`/api/jobs?client=${userId}&limit=100`);
      const clientJobs = (clientData.jobs || clientData || []).map((j) => ({
        ...j,
        _userRole: 'client',
      }));

      // Fetch jobs where user is freelancer
      const freelancerData = await apiRequest(`/api/jobs?freelancer=${userId}&limit=100`);
      const freelancerJobs = (freelancerData.jobs || freelancerData || []).map((j) => ({
        ...j,
        _userRole: 'freelancer',
      }));

      // Fetch jobs where user has submitted proposals
      let myProposalJobs = [];
      try {
        const proposalData = await apiRequest(`/api/jobs?proposer=${userId}&limit=100`);
        myProposalJobs = (proposalData.jobs || proposalData || []).map((j) => ({
          ...j,
          _userRole: 'proposer',
        }));
      } catch (e) {
        // proposer filter may not be supported — that's OK
      }

      // Deduplicate by _id
      const seen = new Set();
      const all = [...clientJobs, ...freelancerJobs].filter((j) => {
        if (seen.has(j._id)) return false;
        seen.add(j._id);
        return true;
      });

      // Sort by most recent
      all.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      myProposalJobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setJobs(all);
      setProposalJobs(myProposalJobs);
    } catch (err) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleAcceptProposal = async (jobId, proposalId) => {
    try {
      await apiRequest(`/api/jobs/${jobId}/proposals/${proposalId}/accept`, {
        method: 'POST',
      });
      fetchJobs();
    } catch (err) {
      setError(err.message || 'Failed to accept proposal');
    }
  };

  const handleComplete = async (jobId) => {
    if (!window.confirm('Mark this project as complete? This will trigger payment release.')) return;
    try {
      await apiRequest(`/api/jobs/${jobId}/complete`, { method: 'POST' });
      fetchJobs();
    } catch (err) {
      setError(err.message || 'Failed to complete project');
    }
  };

  // Filter jobs by tab
  const filteredJobs =
    tab === 'proposals'
      ? proposalJobs
      : tab === 'all'
      ? jobs
      : jobs.filter((j) => j.status === tab);

  // Stats
  const stats = {
    total: jobs.length,
    active: jobs.filter((j) => j.status === 'in_progress').length,
    open: jobs.filter((j) => j.status === 'open').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
  };

  // Tab counts
  const tabCounts = {
    all: jobs.length,
    in_progress: stats.active,
    open: stats.open,
    completed: stats.completed,
    proposals: proposalJobs.length,
  };

  if (loading) {
    return (
      <div className="pm-container">
        <div className="pm-loading">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="pm-container">
      <h1>Projects</h1>

      {error && <div className="pm-error">{error}</div>}

      {/* Stats */}
      <div className="pm-stats">
        <div className="pm-stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Projects</div>
        </div>
        <div className="pm-stat-card">
          <div className="stat-value">{stats.active}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="pm-stat-card">
          <div className="stat-value">{stats.open}</div>
          <div className="stat-label">Open</div>
        </div>
        <div className="pm-stat-card">
          <div className="stat-value">{stats.completed}</div>
          <div className="stat-label">Completed</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="pm-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`pm-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {tabCounts[t.key] > 0 && (
              <span className="tab-count">{tabCounts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Project List */}
      {filteredJobs.length === 0 ? (
        <div className="pm-empty">
          <div className="empty-icon">📋</div>
          <p>
            {tab === 'proposals'
              ? "You haven't submitted any proposals yet"
              : tab === 'all'
              ? "You don't have any projects yet"
              : `No ${STATUS_LABELS[tab]?.toLowerCase() || tab} projects`}
          </p>
          <a href="/jobs/post" className="btn-create-job">
            Post a Job
          </a>
        </div>
      ) : (
        filteredJobs.map((job) => (
          <ProjectCard
            key={job._id}
            job={job}
            userRole={job._userRole || 'client'}
            onAcceptProposal={handleAcceptProposal}
            onComplete={handleComplete}
          />
        ))
      )}
    </div>
  );
};

export default ProjectManagement;

