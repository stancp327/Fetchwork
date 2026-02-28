import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import { categoryLabelMap } from '../../utils/categories';
import './ProjectManagement.css';

// ── Helpers ─────────────────────────────────────────────────────
const STATUS_LABELS = {
  draft: 'Draft', open: 'Open', in_progress: 'In Progress',
  completed: 'Completed', cancelled: 'Cancelled', disputed: 'Disputed',
};

const MILESTONE_STATUS_META = {
  pending:     { label: 'Pending',     color: '#6b7280', bg: '#f3f4f6' },
  in_progress: { label: 'In Progress', color: '#2563eb', bg: '#eff6ff' },
  completed:   { label: 'Completed',   color: '#f59e0b', bg: '#fefce8' },
  approved:    { label: 'Approved',    color: '#10b981', bg: '#ecfdf5' },
};

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

const timeAgo = (date) => {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(date).toLocaleDateString();
};

// ── Milestone Row ───────────────────────────────────────────────
const MilestoneRow = ({ milestone, index, isFreelancer, isClient, onUpdate }) => {
  const [acting, setActing] = useState(false);
  const meta = MILESTONE_STATUS_META[milestone.status] || MILESTONE_STATUS_META.pending;
  const done = milestone.status === 'completed' || milestone.status === 'approved';

  const act = async (status) => {
    setActing(true);
    try { await onUpdate(index, status); } finally { setActing(false); }
  };

  return (
    <div className={`pm-milestone-row ${done ? 'done' : ''}`}>
      <div className="pm-ms-left">
        <button
          className={`pm-ms-check ${done ? 'done' : ''}`}
          disabled={!isFreelancer || done || acting}
          title={isFreelancer && !done ? 'Mark as completed' : ''}
          onClick={() => isFreelancer && !done && act(
            milestone.status === 'pending' ? 'in_progress' : 'completed'
          )}
        >
          {done ? '✓' : ''}
        </button>
        <div className="pm-ms-info">
          <span className="pm-ms-title">{milestone.title}</span>
          {milestone.description && (
            <span className="pm-ms-desc">{milestone.description}</span>
          )}
        </div>
      </div>
      <div className="pm-ms-right">
        <span className="pm-ms-amount">{fmt(milestone.amount)}</span>
        <span className="pm-ms-badge" style={{ color: meta.color, background: meta.bg }}>
          {meta.label}
        </span>
        {/* Freelancer next-step actions */}
        {isFreelancer && milestone.status === 'pending' && (
          <button className="pm-ms-action start" disabled={acting} onClick={() => act('in_progress')}>
            Start
          </button>
        )}
        {isFreelancer && milestone.status === 'in_progress' && (
          <button className="pm-ms-action complete" disabled={acting} onClick={() => act('completed')}>
            {acting ? '…' : 'Done ✓'}
          </button>
        )}
        {/* Client can approve or request revision */}
        {isClient && milestone.status === 'completed' && (
          <>
            <button className="pm-ms-action approve" disabled={acting} onClick={() => act('approved')}>
              Approve
            </button>
            <button className="pm-ms-action revision" disabled={acting} onClick={() => act('in_progress')}>
              Revise
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ── Quick Update Form ───────────────────────────────────────────
const QuickUpdate = ({ jobId, onPosted }) => {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [posting, setPosting] = useState(false);

  const submit = async () => {
    if (!msg.trim()) return;
    setPosting(true);
    try {
      await apiRequest(`/api/jobs/${jobId}/progress`, {
        method: 'POST',
        body: JSON.stringify({ message: msg.trim() })
      });
      setMsg('');
      setOpen(false);
      if (onPosted) onPosted();
    } catch (err) {
      alert(err.message || 'Failed to post update');
    } finally { setPosting(false); }
  };

  if (!open) return (
    <button className="pm-quick-update-btn" onClick={() => setOpen(true)}>
      💬 Post Update
    </button>
  );

  return (
    <div className="pm-quick-update-form">
      <textarea
        rows={2}
        placeholder="Share a progress update with the client…"
        value={msg}
        onChange={e => setMsg(e.target.value)}
      />
      <div className="pm-quick-update-actions">
        <button className="pm-qua-cancel" onClick={() => { setOpen(false); setMsg(''); }}>
          Cancel
        </button>
        <button className="pm-qua-send" disabled={posting || !msg.trim()} onClick={submit}>
          {posting ? 'Posting…' : 'Post Update'}
        </button>
      </div>
    </div>
  );
};

// ── Project Card ────────────────────────────────────────────────
const ProjectCard = ({ job, onAcceptProposal, onComplete, onMilestoneUpdate, onRefresh }) => {
  const navigate = useNavigate();
  const budget       = job.budget || {};
  const status       = job.status || 'draft';
  const isFreelancer = job._userRole === 'freelancer';
  const isClient     = job._userRole === 'client';
  const isProposer   = job._userRole === 'proposer';
  const myProposal   = job._myProposal || null;
  const partner  = isFreelancer ? (job.client || {}) : (job.freelancer || {});
  const partnerLabel = isFreelancer ? 'Client' : 'Freelancer';
  const partnerName  = partner?.firstName
    ? `${partner.firstName} ${partner.lastName || ''}`.trim() : null;

  const milestones = job.milestones || [];
  const msDone  = milestones.filter(m => m.status === 'completed' || m.status === 'approved').length;
  const msTotal = milestones.length;
  const msPct   = msTotal > 0 ? Math.round((msDone / msTotal) * 100) : null;
  const allMsDone = msTotal > 0 && msDone === msTotal;

  const escrow   = job.escrowAmount || 0;
  const totalPaid = job.totalPaid || 0;

  return (
    <div className={`pm-project-card ${isFreelancer ? 'freelancer-card' : ''}`}>
      {/* Header */}
      <div className="pm-project-header">
        <div className="pm-project-title-row">
          <button
            className="pm-project-title"
            onClick={() => {
              // Client on open job → go straight to proposals review
              if (isClient && status === 'open') {
                navigate(`/jobs/${job._id}/proposals`);
              } else {
                navigate(`/jobs/${job._id}`);
              }
            }}
          >
            {job.title}
          </button>
          <span className={`pm-status-badge ${status}`}>{STATUS_LABELS[status] || status}</span>
        </div>
        <div className="pm-project-meta">
          {budget.min != null && (
            <span className="meta-item">💰 {fmt(budget.min)}{budget.max && budget.max !== budget.min ? `–${fmt(budget.max)}` : ''}</span>
          )}
          {job.category && (
            <span className="meta-item">📁 {categoryLabelMap[job.category] || job.category}</span>
          )}
          {partnerName && (
            <span className="meta-item">👤 {partnerLabel}: {partnerName}</span>
          )}
        </div>
      </div>

      {/* Payment status (prominent for freelancers) */}
      {status === 'in_progress' && (
        <div className={`pm-payment-pill ${escrow > 0 ? 'funded' : 'unfunded'}`}>
          {escrow > 0
            ? `🔒 ${fmt(escrow)} secured — payment ready`
            : isClient
              ? `⚠️ Payment not secured yet — fund before work begins`
              : `⏳ Awaiting client payment`
          }
          {totalPaid > 0 && ` · ${fmt(totalPaid)} released`}
        </div>
      )}

      {/* Milestones */}
      {msTotal > 0 && (status === 'in_progress' || status === 'completed') && (
        <div className="pm-milestones-section">
          <div className="pm-ms-header">
            <span className="pm-ms-heading">Milestones</span>
            <span className="pm-ms-count">{msDone}/{msTotal}</span>
            {msPct !== null && (
              <div className="pm-ms-progress">
                <div className="pm-ms-progress-fill" style={{ width: `${msPct}%` }} />
              </div>
            )}
          </div>
          {milestones.map((m, i) => (
            <MilestoneRow
              key={m._id || i}
              milestone={m}
              index={i}
              isFreelancer={isFreelancer}
              isClient={isClient}
              onUpdate={(idx, s) => onMilestoneUpdate(job._id, idx, s)}
            />
          ))}
        </div>
      )}

      {/* My Proposal (proposer view) */}
      {isProposer && myProposal && (
        <div className="pm-my-proposal">
          <div className="pm-my-proposal-header">
            <span className="pm-my-proposal-label">My Proposal</span>
            <span className={`pm-proposal-status-badge ${myProposal.status}`}>
              {myProposal.status === 'pending'  ? '⏳ Awaiting review'
               : myProposal.status === 'accepted' ? '✅ Accepted!'
               : myProposal.status === 'declined' ? '❌ Declined'
               : myProposal.status}
            </span>
          </div>
          <div className="pm-my-proposal-terms">
            <span>💰 {fmt(myProposal.proposedBudget)}</span>
            <span>⏱ {myProposal.proposedDuration?.replace(/_/g, ' ')}</span>
          </div>
          {myProposal.coverLetter && (
            <div className="pm-my-proposal-cover">
              {myProposal.coverLetter.substring(0, 140)}{myProposal.coverLetter.length > 140 ? '…' : ''}
            </div>
          )}
          {myProposal.status === 'accepted' && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#059669', fontWeight: 600 }}>
              🎉 You got the job! Check your active work.
            </div>
          )}
        </div>
      )}

      {isProposer && !myProposal && (
        <div className="pm-no-proposals" style={{ fontStyle: 'normal', color: '#9ca3af', fontSize: '0.8rem' }}>
          Proposal data unavailable — <Link to={`/jobs/${job._id}`} style={{ color: '#2563eb' }}>view job</Link>
        </div>
      )}

      {/* Proposals CTA (client only) — sends to full review page */}
      {isClient && status === 'open' && (() => {
        const pending = (job.proposals || []).filter(p => p.status === 'pending').length;
        const total   = (job.proposals || []).length;
        if (total === 0) return (
          <div className="pm-no-proposals">No proposals yet — share your job to attract freelancers.</div>
        );
        return (
          <div className="pm-proposals-cta">
            <div className="pm-proposals-cta-text">
              <span className="pm-proposals-badge">{pending > 0 ? `${pending} new` : `${total}`}</span>
              {pending > 0
                ? ` proposal${pending !== 1 ? 's' : ''} waiting for your review`
                : ` proposal${total !== 1 ? 's' : ''} received`}
            </div>
            <Link to={`/jobs/${job._id}/proposals`} className="pm-btn-review">
              Review Proposals →
            </Link>
          </div>
        );
      })()}

      {/* Footer actions */}
      <div className="pm-card-actions">
        {status === 'in_progress' && (
          <Link to={`/jobs/${job._id}/progress`} className="pm-btn-track">
            📊 Full Progress View
          </Link>
        )}
        {isFreelancer && status === 'in_progress' && (
          <QuickUpdate jobId={job._id} onPosted={onRefresh} />
        )}
        {isFreelancer && status === 'in_progress' && allMsDone && (
          <button className="pm-btn-complete" onClick={() => onComplete(job._id)}>
            ✓ Mark Job Complete
          </button>
        )}
        {isFreelancer && status === 'in_progress' && msTotal === 0 && (
          <button className="pm-btn-complete" onClick={() => onComplete(job._id)}>
            ✓ Mark Job Complete
          </button>
        )}
        {isClient && status === 'in_progress' && (
          <button className="pm-btn-complete client" onClick={() => onComplete(job._id)}>
            ✓ Mark Complete & Release
          </button>
        )}
      </div>

      <div className="pm-project-footer">
        <span>Updated {timeAgo(job.updatedAt || job.createdAt)}</span>
      </div>
    </div>
  );
};

// ── Service Order Card ──────────────────────────────────────────
const SERVICE_ORDER_STATUS = {
  pending:            { label: '⏳ Awaiting Payment', color: '#f59e0b', bg: '#fef3c7' },
  in_progress:        { label: '🔨 In Progress',       color: '#2563eb', bg: '#dbeafe' },
  delivered:          { label: '📦 Delivered',          color: '#8b5cf6', bg: '#ede9fe' },
  revision_requested: { label: '🔄 Revision Requested', color: '#f59e0b', bg: '#fef3c7' },
  completed:          { label: '✅ Completed',           color: '#10b981', bg: '#d1fae5' },
  cancelled:          { label: '❌ Cancelled',           color: '#ef4444', bg: '#fee2e2' },
};

const ServiceOrderCard = ({ item, onAction }) => {
  const { service, order } = item;
  const [acting, setActing] = useState(false);
  const sm = SERVICE_ORDER_STATUS[order.status] || { label: order.status, color: '#6b7280', bg: '#f3f4f6' };

  const doAction = async (action, body = {}) => {
    setActing(true);
    try {
      await apiRequest(`/api/services/${service._id}/orders/${order._id}/${action}`, {
        method: 'PUT', body: JSON.stringify(body)
      });
      onAction();
    } catch (err) { alert(err.message || 'Action failed'); }
    finally { setActing(false); }
  };

  return (
    <div className="pm-project-card freelancer-card">
      <div className="pm-project-title-row">
        <Link
          to={order._id ? `/services/${service._id}/orders/${order._id}` : `/services/${service._id}`}
          className="pm-project-title"
          style={{ textDecoration: 'none' }}
        >
          {service.title}
        </Link>
        <span className="pm-ms-badge" style={{ color: sm.color, background: sm.bg, fontSize: '0.78rem', padding: '3px 10px' }}>
          {sm.label}
        </span>
      </div>
      <div className="pm-project-meta">
        <span className="meta-item">📦 {order.package}</span>
        <span className="meta-item">💰 {fmt(order.price)}</span>
        {order.escrowAmount > 0 && <span className="meta-item" style={{ color: '#10b981' }}>🔒 Secured</span>}
      </div>
      {order.requirements && (
        <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '0.5rem' }}>
          📋 {order.requirements.slice(0, 120)}{order.requirements.length > 120 ? '…' : ''}
        </div>
      )}

      {/* Pending: client hasn't paid yet — show waiting state */}
      {order.status === 'pending' && (
        <div className="pm-payment-pill unfunded" style={{ marginBottom: '0.5rem' }}>
          ⏳ Waiting for client to complete payment before you can start work.
        </div>
      )}

      <div className="pm-card-actions">
        {order.status === 'in_progress' && (
          <button className="pm-btn-complete" disabled={acting}
            onClick={() => {
              const note = window.prompt('Add a delivery note (optional):');
              doAction('deliver', { deliveryNote: note || '' });
            }}>
            📦 Mark Delivered
          </button>
        )}
        {order.status === 'revision_requested' && (
          <button className="pm-btn-complete" disabled={acting}
            onClick={() => doAction('deliver', {})}>
            📦 Resubmit Delivery
          </button>
        )}
        {order.status === 'completed' && (
          <Link to={`/services/${service._id}/orders/${order._id}`} className="pm-btn-track">✅ View Order</Link>
        )}
        {order.status === 'pending' && (
          <button className="pm-btn-complete" disabled={acting}
            style={{ background: '#f59e0b' }}
            onClick={() => {
              const msg = window.prompt("Send a reminder to the client (optional message):");
              if (msg !== null) doAction('remind', { message: msg });
            }}>
            🔔 Remind Client
          </button>
        )}
        <Link to="/messages" className="pm-btn-track">💬 Messages</Link>
      </div>
      <div className="pm-project-footer">Ordered {timeAgo(order.orderDate)}</div>
    </div>
  );
};

// ── Tab definitions per role ──────────────────────────────────────
const CLIENT_TABS = [
  { key: 'open',        label: 'Open Jobs' },      // posted, collecting proposals
  { key: 'in_progress', label: 'In Progress' },    // hired, work underway
  { key: 'completed',   label: 'Completed' },
];

const FREELANCER_TABS = [
  { key: 'in_progress',   label: 'Active Work' },  // jobs I'm working on
  { key: 'proposals',     label: 'Proposals Sent' },
  { key: 'service_orders', label: 'Service Orders' },
  { key: 'completed',     label: 'Completed' },
];

// ── Main ─────────────────────────────────────────────────────────
const ProjectManagement = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Role split
  const [clientJobs,     setClientJobs]     = useState([]);
  const [freelancerJobs, setFreelancerJobs] = useState([]);
  const [proposalJobs,   setProposalJobs]   = useState([]);
  const [serviceOrders,  setServiceOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // viewMode driven by ?view= URL param so dashboard links land correctly
  const rawView   = searchParams.get('view');
  const viewMode  = rawView === 'freelancer' ? 'freelancer' : 'client';
  const setViewMode = (v) => {
    setSearchParams({ view: v });
    setTab(v === 'client' ? 'open' : 'in_progress');
  };

  const [tab, setTab] = useState(viewMode === 'client' ? 'open' : 'in_progress');

  const userId = user?._id || user?.id || user?.userId;

  const fetchJobs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      // Use the correct authenticated user-specific endpoint
      const [postedData, workingData, appliedData] = await Promise.all([
        apiRequest(`/api/users/jobs?type=posted&limit=100`),
        apiRequest(`/api/users/jobs?type=working&limit=100`),
        apiRequest(`/api/users/jobs?type=applied&limit=100`),
      ]);

      const cJobs = (postedData.jobs || [])
        .map(j => ({ ...j, _userRole: 'client' }))
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

      const fJobs = (workingData.jobs || [])
        .map(j => ({ ...j, _userRole: 'freelancer' }))
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

      // For applied jobs, attach the user's own proposal for display
      const pJobs = (appliedData.jobs || []).map(j => {
        const myProposal = (j.proposals || []).find(p => {
          const flId = p.freelancer?._id?.toString() || p.freelancer?.toString();
          return flId === String(userId);
        });
        return { ...j, _userRole: 'proposer', _myProposal: myProposal || null };
      }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setClientJobs(cJobs);
      setFreelancerJobs(fJobs);
      setProposalJobs(pJobs);

      // Service orders (freelancer role)
      try {
        const soData = await apiRequest('/api/services/orders/my?role=freelancer');
        setServiceOrders(soData.orders || []);
      } catch (_) {}
    } catch (err) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // ── Handlers ───────────────────────────────────────────────────
  const handleAcceptProposal = async (jobId, proposalId) => {
    try {
      await apiRequest(`/api/jobs/${jobId}/proposals/${proposalId}/accept`, { method: 'POST' });
      fetchJobs();
    } catch (err) { setError(err.message); }
  };

  const handleComplete = async (jobId) => {
    const allJobs = [...clientJobs, ...freelancerJobs];
    const job = allJobs.find(j => j._id === jobId);
    const msg = job?._userRole === 'client'
      ? 'Mark as complete and release payment to the freelancer?'
      : 'Mark this job as complete? The client will be notified.';
    if (!window.confirm(msg)) return;
    try {
      await apiRequest(`/api/jobs/${jobId}/complete`, { method: 'POST' });
      fetchJobs();
    } catch (err) { setError(err.message); }
  };

  const handleMilestoneUpdate = async (jobId, milestoneIndex, status) => {
    try {
      await apiRequest(`/api/jobs/${jobId}/milestones/${milestoneIndex}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      fetchJobs();
    } catch (err) { alert(err.message || 'Failed to update milestone'); }
  };

  // ── Per-view data ──────────────────────────────────────────────
  const isClientView     = viewMode === 'client';
  const displayJobs      = isClientView ? clientJobs : freelancerJobs;
  const activeTabs       = isClientView ? CLIENT_TABS : FREELANCER_TABS;

  const pendingProposalsCount = clientJobs.reduce(
    (acc, j) => acc + (j.proposals || []).filter(p => p.status === 'pending').length, 0
  );

  const clientCounts = {
    open:        clientJobs.filter(j => j.status === 'open').length,
    in_progress: clientJobs.filter(j => j.status === 'in_progress').length,
    completed:   clientJobs.filter(j => j.status === 'completed').length,
  };

  const freelancerCounts = {
    in_progress:   freelancerJobs.filter(j => j.status === 'in_progress').length,
    proposals:     proposalJobs.length,
    service_orders: serviceOrders.filter(s => !['completed', 'cancelled'].includes(s.order.status)).length,
    completed:     freelancerJobs.filter(j => j.status === 'completed').length,
  };

  const counts = isClientView ? clientCounts : freelancerCounts;

  const filteredJobs = tab === 'proposals'
    ? proposalJobs
    : tab === 'service_orders'
      ? []
      : displayJobs.filter(j => j.status === tab);

  const hasContent = isClientView
    ? (clientJobs.length > 0)
    : (freelancerJobs.length > 0 || proposalJobs.length > 0 || serviceOrders.length > 0);

  const hasBothRoles = clientJobs.length > 0 && (freelancerJobs.length > 0 || proposalJobs.length > 0);

  // ── Stat definitions per view ─────────────────────────────────
  const clientStats = [
    { label: 'Open Jobs',    value: clientCounts.open,        color: '#f59e0b', tab: 'open' },
    { label: 'In Progress',  value: clientCounts.in_progress, color: '#2563eb', tab: 'in_progress' },
    { label: 'Proposals In', value: pendingProposalsCount,    color: '#ef4444', tab: 'open' },
    { label: 'Completed',    value: clientCounts.completed,   color: '#10b981', tab: 'completed' },
  ];

  const freelancerStats = [
    { label: 'Active Work',     value: freelancerCounts.in_progress,   color: '#2563eb', tab: 'in_progress' },
    { label: 'Proposals Sent',  value: freelancerCounts.proposals,      color: '#8b5cf6', tab: 'proposals' },
    { label: 'Service Orders',  value: freelancerCounts.service_orders, color: '#f59e0b', tab: 'service_orders' },
    { label: 'Completed',       value: freelancerCounts.completed,      color: '#10b981', tab: 'completed' },
  ];

  const activeStats = isClientView ? clientStats : freelancerStats;

  if (loading) return <div className="pm-container"><div className="pm-loading">Loading projects…</div></div>;

  return (
    <div className="pm-container">
      {/* ── Page header ──────────────────────────────────────── */}
      <div className="pm-page-header">
        <div>
          <h1>{isClientView ? 'Jobs I Posted' : 'My Work'}</h1>
          <p className="pm-subtitle">
            {isClientView
              ? 'Review proposals, track progress, manage your posted jobs'
              : 'Jobs you\'re working on, proposals you\'ve sent, service orders'}
          </p>
        </div>
        {isClientView
          ? <Link to="/jobs/post" className="pm-btn-post">+ Post a Job</Link>
          : <Link to="/browse-jobs" className="pm-btn-post">Browse Jobs</Link>
        }
      </div>

      {error && <div className="pm-error">{error}</div>}

      {/* ── Role toggle (only shown if user has both roles) ─── */}
      {hasBothRoles && (
        <div className="pm-role-toggle">
          <button
            className={`pm-role-btn ${isClientView ? 'active' : ''}`}
            onClick={() => setViewMode('client')}
          >
            📋 Jobs I Posted
            {clientCounts.open > 0 && <span className="pm-role-badge">{clientCounts.open}</span>}
          </button>
          <button
            className={`pm-role-btn ${!isClientView ? 'active' : ''}`}
            onClick={() => setViewMode('freelancer')}
          >
            💼 My Work
            {freelancerCounts.in_progress > 0 && <span className="pm-role-badge">{freelancerCounts.in_progress}</span>}
          </button>
        </div>
      )}

      {/* ── Attention banner (client: pending proposals) ───── */}
      {isClientView && pendingProposalsCount > 0 && (
        <div className="pm-attention-banner">
          🔔 <strong>{pendingProposalsCount} proposal{pendingProposalsCount !== 1 ? 's' : ''}</strong> waiting for your review
          — click any job below to see applicants.
        </div>
      )}

      {/* ── Stats strip ──────────────────────────────────────── */}
      <div className="pm-stats">
        {activeStats.map(s => (
          <button
            key={s.label}
            className={`pm-stat-card pm-stat-btn ${tab === s.tab ? 'pm-stat-active' : ''}`}
            style={{ borderTopColor: s.color }}
            onClick={() => setTab(s.tab)}
          >
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </button>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="pm-tabs">
        {activeTabs.map(t => (
          <button
            key={t.key}
            className={`pm-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {counts[t.key] > 0 && <span className="tab-count">{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      {tab === 'service_orders' ? (
        serviceOrders.length === 0 ? (
          <div className="pm-empty">
            <div className="empty-icon">📦</div>
            <p><strong>No service orders yet</strong></p>
            <p>Service orders appear here when clients order your services directly.</p>
          </div>
        ) : (
          <div className="pm-job-list">
            {serviceOrders.map((item, i) => (
              <ServiceOrderCard key={item.order._id || i} item={item} onAction={fetchJobs} />
            ))}
          </div>
        )
      ) : filteredJobs.length === 0 ? (
        <div className="pm-empty">
          <div className="empty-icon">{isClientView ? '📋' : '💼'}</div>
          {tab === 'open' && isClientView && (
            <>
              <p><strong>No open jobs yet</strong></p>
              <p>Post a job to start receiving proposals from freelancers.</p>
              <Link to="/jobs/post" className="pm-btn-browse">Post a Job</Link>
            </>
          )}
          {tab === 'in_progress' && isClientView && (
            <>
              <p><strong>No jobs in progress</strong></p>
              <p>Accept a proposal on one of your open jobs to get started.</p>
              {clientCounts.open > 0 && (
                <button className="pm-btn-browse" onClick={() => setTab('open')}>
                  View Open Jobs ({clientCounts.open})
                </button>
              )}
            </>
          )}
          {tab === 'in_progress' && !isClientView && (
            <>
              <p><strong>No active work right now</strong></p>
              <p>Browse available jobs and submit a proposal to get hired.</p>
              <Link to="/browse-jobs" className="pm-btn-browse">Browse Jobs</Link>
            </>
          )}
          {tab === 'proposals' && !isClientView && (
            <>
              <p><strong>No proposals sent yet</strong></p>
              <p>Find jobs that match your skills and submit a proposal.</p>
              <Link to="/browse-jobs" className="pm-btn-browse">Browse Jobs</Link>
            </>
          )}
          {(tab === 'completed') && (
            <p><strong>No completed {isClientView ? 'jobs' : 'work'} yet</strong></p>
          )}
        </div>
      ) : (
        <div className="pm-job-list">
          {filteredJobs.map(job => (
            <ProjectCard
              key={job._id}
              job={job}
              onAcceptProposal={handleAcceptProposal}
              onComplete={handleComplete}
              onMilestoneUpdate={handleMilestoneUpdate}
              onRefresh={fetchJobs}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectManagement;
