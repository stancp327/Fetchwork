import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  const budget   = job.budget || {};
  const status   = job.status || 'draft';
  const isFreelancer = job._userRole === 'freelancer';
  const isClient     = job._userRole === 'client';
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
          <button className="pm-project-title" onClick={() => navigate(`/jobs/${job._id}`)}>
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

      {/* Proposal list (client only) */}
      {isClient && status === 'open' && (job.proposals || []).filter(p => p.status === 'pending').length > 0 && (
        <div className="pm-proposals">
          <h4>Pending Proposals ({job.proposals.filter(p => p.status === 'pending').length})</h4>
          {job.proposals.filter(p => p.status === 'pending').map(p => {
            const fl = p.freelancer || {};
            return (
              <div key={p._id} className="pm-proposal-item">
                <div className="pm-proposal-info">
                  <div className="pm-proposal-avatar">
                    {(fl.firstName || '?')[0]}{(fl.lastName || '?')[0]}
                  </div>
                  <div className="pm-proposal-details">
                    <div className="proposal-name">{fl.firstName} {fl.lastName}</div>
                    <div className="proposal-meta">{fmt(p.proposedBudget)} · {p.proposedDuration?.replace(/_/g, ' ')}</div>
                  </div>
                </div>
                <button className="btn-accept" onClick={() => onAcceptProposal(job._id, p._id)}>
                  Accept
                </button>
              </div>
            );
          })}
        </div>
      )}

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
        <Link to={`/services/${service._id}/orders/${order._id}`} className="pm-project-title" style={{ textDecoration: 'none' }}>
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

// ── Main ─────────────────────────────────────────────────────────
const TABS = [
  { key: 'in_progress', label: 'Active' },
  { key: 'open',        label: 'Open' },
  { key: 'proposals',   label: 'Proposals' },
  { key: 'service_orders', label: 'Service Orders' },
  { key: 'completed',   label: 'Completed' },
  { key: 'all',         label: 'All' },
];

const ProjectManagement = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [proposalJobs, setProposalJobs] = useState([]);
  const [serviceOrders, setServiceOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('in_progress');

  const userId = user?._id || user?.id || user?.userId;

  const fetchJobs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const [clientData, freelancerData] = await Promise.all([
        apiRequest(`/api/jobs?client=${userId}&limit=100`),
        apiRequest(`/api/jobs?freelancer=${userId}&limit=100`),
      ]);

      const clientJobs     = (clientData.jobs     || clientData     || []).map(j => ({ ...j, _userRole: 'client' }));
      const freelancerJobs = (freelancerData.jobs || freelancerData || []).map(j => ({ ...j, _userRole: 'freelancer' }));

      let myProposalJobs = [];
      try {
        const pd = await apiRequest(`/api/jobs?proposer=${userId}&limit=100`);
        myProposalJobs = (pd.jobs || pd || []).map(j => ({ ...j, _userRole: 'proposer' }));
      } catch (_) {}

      const seen = new Set();
      const all = [...freelancerJobs, ...clientJobs].filter(j => {
        if (seen.has(j._id)) return false;
        seen.add(j._id);
        return true;
      });
      all.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      myProposalJobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setJobs(all);
      setProposalJobs(myProposalJobs);

      // Fetch service orders where user is the freelancer
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

  const handleAcceptProposal = async (jobId, proposalId) => {
    try {
      await apiRequest(`/api/jobs/${jobId}/proposals/${proposalId}/accept`, { method: 'POST' });
      fetchJobs();
    } catch (err) { setError(err.message); }
  };

  const handleComplete = async (jobId) => {
    const job = jobs.find(j => j._id === jobId);
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

  const filteredJobs = tab === 'proposals'
    ? proposalJobs
    : tab === 'service_orders'
      ? []   // handled separately
      : tab === 'all'
        ? jobs
        : jobs.filter(j => j.status === tab);

  const activeServiceOrders = serviceOrders.filter(
    s => ['in_progress', 'delivered', 'revision_requested'].includes(s.order.status)
  );

  const counts = {
    in_progress:    jobs.filter(j => j.status === 'in_progress').length,
    open:           jobs.filter(j => j.status === 'open').length,
    completed:      jobs.filter(j => j.status === 'completed').length,
    proposals:      proposalJobs.length,
    service_orders: serviceOrders.filter(s => s.order.status !== 'completed' && s.order.status !== 'cancelled').length,
    all:            jobs.length,
  };

  if (loading) return <div className="pm-container"><div className="pm-loading">Loading projects…</div></div>;

  return (
    <div className="pm-container">
      <div className="pm-page-header">
        <div>
          <h1>My Projects</h1>
          <p className="pm-subtitle">Manage your active jobs, milestones, and proposals</p>
        </div>
        <Link to="/jobs/post" className="pm-btn-post">+ Post Job</Link>
      </div>

      {error && <div className="pm-error">{error}</div>}

      {/* Stats strip */}
      <div className="pm-stats">
        {[
          { label: 'Active',    value: counts.in_progress, color: '#2563eb' },
          { label: 'Open',      value: counts.open,        color: '#f59e0b' },
          { label: 'Proposals', value: counts.proposals,   color: '#8b5cf6' },
          { label: 'Completed', value: counts.completed,   color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="pm-stat-card" style={{ borderTopColor: s.color }}>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="pm-tabs">
        {TABS.map(t => (
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

      {/* Job list */}
      {tab === 'service_orders' ? (
        serviceOrders.length === 0 ? (
          <div className="pm-empty">
            <div className="empty-icon">📦</div>
            <p>No service orders yet</p>
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
          <div className="empty-icon">📋</div>
          <p>{tab === 'in_progress' ? "No active jobs right now" : `No ${STATUS_LABELS[tab] || tab} projects`}</p>
          {tab === 'in_progress' && (
            <Link to="/browse-jobs" className="pm-btn-browse">Browse Jobs</Link>
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
