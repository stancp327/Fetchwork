import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import { apiRequest } from '../../utils/api';
import EscrowModal from '../Payments/EscrowModal';
import TipModal from '../Payments/TipModal';
import SEO from '../common/SEO';
import { fmt } from './helpers';
import ProjectCard from './ProjectCard';
import ServiceOrderCard from './ServiceOrderCard';
import MilestoneChangeModal from './MilestoneChangeModal';
import './ProjectManagement.css';

// ── Tab definitions per role ──────────────────────────────────────
const CLIENT_TABS = [
  { key: 'open',           label: 'Open Jobs' },
  { key: 'awaiting_start', label: 'Awaiting Start' },
  { key: 'in_progress',    label: 'In Progress' },
  { key: 'completed',      label: 'Completed' },
  { key: 'history',        label: 'History' },
];

const FREELANCER_TABS = [
  { key: 'awaiting_start', label: 'Accepted' },
  { key: 'in_progress',    label: 'Active Work' },
  { key: 'proposals',      label: 'Proposals Sent' },
  { key: 'service_orders', label: 'Service Orders' },
  { key: 'completed',      label: 'Completed' },
  { key: 'history',        label: 'History' },
];

// ── Main ─────────────────────────────────────────────────────────
const ProjectManagement = () => {
  const { user } = useAuth();
  const { currentRole, switchRole } = useRole();
  const [searchParams, setSearchParams] = useSearchParams();

  const [clientJobs,     setClientJobs]     = useState([]);
  const [freelancerJobs, setFreelancerJobs] = useState([]);
  const [proposalJobs,   setProposalJobs]   = useState([]);
  const [serviceOrders,  setServiceOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const rawView = searchParams.get('view');
  const viewMode = rawView === 'freelancer' ? 'freelancer'
    : rawView === 'client' ? 'client'
    : currentRole;
  const setViewMode = (v) => {
    switchRole(v);
    setSearchParams({ view: v });
    setTab(v === 'client' ? 'open' : 'in_progress');
  };

  const [tab, setTab] = useState(viewMode === 'client' ? 'open' : 'in_progress');

  useEffect(() => {
    if (rawView) return;
    setTab(currentRole === 'client' ? 'open' : 'in_progress');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRole]);

  const userId = user?._id || user?.id || user?.userId;

  const fetchJobs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
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
    const isClient = job?._userRole === 'client';
    const hasFunds = (job?.escrowAmount || 0) > 0;
    const msg = isClient
      ? hasFunds
        ? `Approve this job and release $${job.escrowAmount} to the freelancer? This cannot be undone.`
        : 'Mark this job as complete? (No payment was secured for this job.)'
      : 'Mark this job as complete? The client will be notified to review and release payment.';
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

  const handleStartJob = async (jobId) => {
    if (!window.confirm('Signal to the client that you\'re ready to start?\nThey\'ll have 24 hours to review milestones and approve.')) return;
    try {
      await apiRequest(`/api/jobs/${jobId}/start`, { method: 'POST' });
      fetchJobs();
    } catch (err) { setError(err.message || 'Failed to start job'); }
  };

  const handleBeginJob = async (jobId, milestones) => {
    if (!window.confirm('Approve the start of this job? Work will begin immediately.')) return;
    try {
      await apiRequest(`/api/jobs/${jobId}/begin`, {
        method: 'POST',
        body: JSON.stringify({ milestones: milestones || [] })
      });
      fetchJobs();
    } catch (err) { setError(err.message || 'Failed to begin job'); }
  };

  const [msModalJob, setMsModalJob] = useState(null);
  const [tipJob,     setTipJob]     = useState(null);
  const [milestoneFunding, setMilestoneFunding] = useState(null);

  const handleFundMilestone = async (jobId, index) => {
    try {
      const res = await apiRequest(`/api/jobs/${jobId}/milestones/${index}/fund`, { method: 'POST' });
      setMilestoneFunding({ jobId, index, ...res });
    } catch (err) { alert(err.message || 'Failed to start payment'); }
  };

  const handleReleaseMilestone = async (jobId, index) => {
    const job = clientJobs.find(j => j._id === jobId);
    const ms  = job?.milestones?.[index];
    if (!window.confirm(`Release ${fmt(ms?.escrowAmount || ms?.amount)} for milestone "${ms?.title}"?\nThis cannot be undone.`)) return;
    try {
      await apiRequest(`/api/jobs/${jobId}/milestones/${index}/release`, { method: 'POST' });
      fetchJobs();
    } catch (err) { alert(err.message || 'Failed to release payment'); }
  };

  const handleMilestonePaid = async (paymentIntent) => {
    if (!milestoneFunding) return;
    const { jobId, index } = milestoneFunding;
    try {
      await apiRequest(`/api/jobs/${jobId}/milestones/${index}/fund/confirm`, {
        method: 'POST',
        body: JSON.stringify({ paymentIntentId: paymentIntent.id || milestoneFunding.paymentIntentId })
      });
    } catch (err) {
      console.error('Confirm failed:', err.message);
    }
    setMilestoneFunding(null);
    fetchJobs();
  };

  // ── Per-view data ──────────────────────────────────────────────
  const isClientView     = viewMode === 'client';
  const displayJobs      = isClientView ? clientJobs : freelancerJobs;
  const activeTabs       = isClientView ? CLIENT_TABS : FREELANCER_TABS;

  const pendingProposalsCount = clientJobs.reduce(
    (acc, j) => acc + (j.proposals || []).filter(p => p.status === 'pending').length, 0
  );

  const clientCounts = {
    open:           clientJobs.filter(j => j.status === 'open'           && !j.isArchived).length,
    awaiting_start: clientJobs.filter(j => ['accepted', 'pending_start'].includes(j.status) && !j.isArchived).length,
    in_progress:    clientJobs.filter(j => j.status === 'in_progress'    && !j.isArchived).length,
    completed:      clientJobs.filter(j => j.status === 'completed').length,
    history:        clientJobs.filter(j => j.isArchived && j.status !== 'completed').length,
  };

  const freelancerCounts = {
    awaiting_start: freelancerJobs.filter(j => ['accepted', 'pending_start'].includes(j.status) && !j.isArchived).length,
    in_progress:    freelancerJobs.filter(j => j.status === 'in_progress' && !j.isArchived).length,
    proposals:      proposalJobs.length,
    service_orders: serviceOrders.filter(s => !['completed', 'cancelled'].includes(s.order.status)).length,
    completed:      freelancerJobs.filter(j => j.status === 'completed').length,
    history:        freelancerJobs.filter(j => j.isArchived && j.status !== 'completed').length,
  };

  const counts = isClientView ? clientCounts : freelancerCounts;

  const filteredJobs = tab === 'proposals'
    ? proposalJobs
    : tab === 'service_orders'
      ? []
      : tab === 'history'
        ? displayJobs.filter(j => j.isArchived && j.status !== 'completed')
        : tab === 'completed'
          ? displayJobs.filter(j => j.status === 'completed')
          : tab === 'awaiting_start'
            ? displayJobs.filter(j => ['accepted', 'pending_start'].includes(j.status) && !j.isArchived)
            : displayJobs.filter(j => j.status === tab && !j.isArchived);

  const hasContent = isClientView
    ? (clientJobs.length > 0)
    : (freelancerJobs.length > 0 || proposalJobs.length > 0 || serviceOrders.length > 0);

  const hasBothRoles = clientJobs.length > 0 && (freelancerJobs.length > 0 || proposalJobs.length > 0);

  const clientStats = [
    { label: 'Open Jobs',      value: clientCounts.open,           color: '#f59e0b', tab: 'open' },
    { label: 'Awaiting Start', value: clientCounts.awaiting_start, color: '#8b5cf6', tab: 'awaiting_start' },
    { label: 'In Progress',    value: clientCounts.in_progress,    color: '#2563eb', tab: 'in_progress' },
    { label: 'Completed',      value: clientCounts.completed,      color: '#10b981', tab: 'completed' },
    ...(clientCounts.history > 0
      ? [{ label: 'History', value: clientCounts.history, color: '#6b7280', tab: 'history' }]
      : []),
  ];

  const freelancerStats = [
    { label: 'Accepted',        value: freelancerCounts.awaiting_start, color: '#8b5cf6', tab: 'awaiting_start' },
    { label: 'Active Work',     value: freelancerCounts.in_progress,    color: '#2563eb', tab: 'in_progress' },
    { label: 'Proposals Sent',  value: freelancerCounts.proposals,       color: '#7c3aed', tab: 'proposals' },
    { label: 'Service Orders',  value: freelancerCounts.service_orders,  color: '#f59e0b', tab: 'service_orders' },
    ...(freelancerCounts.history > 0
      ? [{ label: 'History', value: freelancerCounts.history, color: '#6b7280', tab: 'history' }]
      : []),
  ];

  const activeStats = isClientView ? clientStats : freelancerStats;

  if (loading) return <div className="pm-container"><div className="pm-loading">Loading projects…</div></div>;

  return (
    <>
    <div className="pm-container">
      <SEO title="My Projects" path="/projects" noIndex={true} />
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

      {hasBothRoles && (
        <div className="pm-role-toggle">
          <button className={`pm-role-btn ${isClientView ? 'active' : ''}`} onClick={() => setViewMode('client')}>
            📋 Jobs I Posted
            {clientCounts.open > 0 && <span className="pm-role-badge">{clientCounts.open}</span>}
          </button>
          <button className={`pm-role-btn ${!isClientView ? 'active' : ''}`} onClick={() => setViewMode('freelancer')}>
            💼 My Work
            {freelancerCounts.in_progress > 0 && <span className="pm-role-badge">{freelancerCounts.in_progress}</span>}
          </button>
        </div>
      )}

      {isClientView && pendingProposalsCount > 0 && (
        <div className="pm-attention-banner">
          🔔 <strong>{pendingProposalsCount} proposal{pendingProposalsCount !== 1 ? 's' : ''}</strong> waiting for your review
          — click any job below to see applicants.
        </div>
      )}

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

      <div className="pm-tabs">
        {activeTabs
          .filter(t => t.key !== 'history' || counts.history > 0)
          .map(t => (
            <button key={t.key} className={`pm-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
              {counts[t.key] > 0 && <span className="tab-count">{counts[t.key]}</span>}
            </button>
          ))}
      </div>

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
          {tab === 'awaiting_start' && isClientView && (
            <>
              <p><strong>No jobs awaiting start</strong></p>
              <p>When a freelancer signals they're ready to start, it'll appear here for your approval.</p>
            </>
          )}
          {tab === 'awaiting_start' && !isClientView && (
            <>
              <p><strong>No accepted jobs yet</strong></p>
              <p>When a client accepts your proposal, you'll see it here. Hit "Start Job" to begin.</p>
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
          {(tab === 'history') && (
            <>
              <p><strong>No archived jobs</strong></p>
              <p>Jobs that expired past their deadline or were auto-archived will appear here.</p>
            </>
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
              onFundMilestone={handleFundMilestone}
              onReleaseMilestone={handleReleaseMilestone}
              onProposeMilestones={setMsModalJob}
              onStartJob={handleStartJob}
              onBeginJob={handleBeginJob}
              onRefresh={fetchJobs}
              onTip={setTipJob}
            />
          ))}
        </div>
      )}
    </div>

      {msModalJob && (
        <MilestoneChangeModal job={msModalJob} onClose={() => setMsModalJob(null)} onSent={fetchJobs} />
      )}

      {tipJob && (
        <TipModal job={tipJob} onClose={() => setTipJob(null)} onSuccess={fetchJobs} />
      )}

      {milestoneFunding && (
        <EscrowModal
          preloadedSecret={milestoneFunding.clientSecret}
          job={{ _id: milestoneFunding.jobId, title: milestoneFunding.milestoneTitle || 'Milestone' }}
          amount={milestoneFunding.amount}
          title={`Fund Milestone: ${milestoneFunding.milestoneTitle || ''}`}
          onClose={() => setMilestoneFunding(null)}
          onPaid={handleMilestonePaid}
        />
      )}
    </>
  );
};

export default ProjectManagement;
