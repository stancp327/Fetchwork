import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import { useFeatures } from '../../hooks/useFeatures';
import SEO from '../common/SEO';
import './JobProposals.css';

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

const FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'pending',  label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
];

// ── Single proposal card ─────────────────────────────────────────
const ProposalCard = ({ proposal, jobId, jobStatus, onAccept, onDecline }) => {
  const [acting, setActing] = useState(false);
  const fl = proposal.freelancer || {};
  const initials = `${(fl.firstName || '?')[0]}${(fl.lastName || '')[0] || ''}`.toUpperCase();
  const isPending  = proposal.status === 'pending';
  const isAccepted = proposal.status === 'accepted';

  const doAccept = async () => {
    if (!window.confirm(`Accept proposal from ${fl.firstName}? This will hire them for the job.`)) return;
    setActing(true);
    try { await onAccept(proposal._id); }
    finally { setActing(false); }
  };

  const doDecline = async () => {
    setActing(true);
    try { await onDecline(proposal._id); }
    finally { setActing(false); }
  };

  return (
    <div className={`jp-proposal-card ${proposal.status}`}>
      {/* Freelancer identity */}
      <div className="jp-freelancer-row">
        <div className="jp-avatar">
          {fl.profilePhoto
            ? <img src={fl.profilePhoto} alt={fl.firstName} />
            : initials}
        </div>
        <div className="jp-freelancer-info">
          <p className="jp-freelancer-name">
            {fl.firstName} {fl.lastName}
          </p>
          <div className="jp-freelancer-meta">
            {fl.rating > 0 && (
              <span className="jp-rating">⭐ {fl.rating.toFixed(1)}</span>
            )}
            {fl.jobsCompleted > 0 && (
              <span>{fl.jobsCompleted} job{fl.jobsCompleted !== 1 ? 's' : ''} completed</span>
            )}
            {fl.location?.city && (
              <span>📍 {fl.location.city}{fl.location.state ? `, ${fl.location.state}` : ''}</span>
            )}
          </div>
        </div>
        <span className={`jp-status-badge ${proposal.status}`}>{proposal.status}</span>
      </div>

      {/* Bid summary */}
      <div className="jp-bid-row">
        <div className="jp-bid-item highlight">
          <div>Bid</div>
          <strong>{fmt(proposal.proposedBudget)}</strong>
        </div>
        <div className="jp-bid-item">
          <div>Timeline</div>
          <strong>{proposal.proposedDuration?.replace(/_/g, ' ') || '—'}</strong>
        </div>
        {proposal.milestones?.length > 0 && (
          <div className="jp-bid-item">
            <div>Milestones</div>
            <strong>{proposal.milestones.length}</strong>
          </div>
        )}
        <div className="jp-bid-item">
          <div>Submitted</div>
          <strong>{new Date(proposal.submittedAt || proposal.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong>
        </div>
      </div>

      {/* Cover letter */}
      {proposal.coverLetter && (
        <>
          <div className="jp-cover-label">Cover Letter</div>
          <div className="jp-cover-text">{proposal.coverLetter}</div>
        </>
      )}

      {/* Milestone breakdown */}
      {proposal.milestones?.length > 0 && (
        <div className="jp-milestones-preview">
          <div className="jp-cover-label">Proposed Milestones</div>
          {proposal.milestones.map((ms, i) => (
            <div key={i} className="jp-ms-row">
              <span className="jp-ms-title">{ms.title || `Milestone ${i + 1}`}</span>
              <span className="jp-ms-amount">{fmt(ms.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="jp-actions">
        {isPending && jobStatus === 'open' && (
          <>
            <button className="jp-btn-accept" disabled={acting} onClick={doAccept}>
              {acting ? 'Accepting…' : '✓ Accept Proposal'}
            </button>
            <button
              className="jp-btn-profile"
              style={{ color: '#dc2626', borderColor: '#fca5a5' }}
              disabled={acting}
              onClick={doDecline}
            >
              ✕ Decline
            </button>
          </>
        )}

        <Link
          to={`/freelancers/${fl._id}`}
          className="jp-btn-profile"
        >
          👤 View Profile
        </Link>

        <Link
          to={`/messages?userId=${fl._id}&jobId=${jobId}`}
          className="jp-btn-message"
        >
          💬 Message
        </Link>

        {isAccepted && (
          <span className="jp-accepted-note">✅ Hired — job is in progress</span>
        )}
      </div>
    </div>
  );
};

// ── Main page ────────────────────────────────────────────────────
const JobProposals = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { hasFeature } = useFeatures();
  const navigate = useNavigate();
  const canCompare = hasFeature('proposal_comparison');

  const [job,     setJob]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [filter,  setFilter]  = useState('all');
  const [acting,  setActing]  = useState(false);
  const [compareIds, setCompareIds] = useState([]);
  const [showCompare, setShowCompare] = useState(false);

  const fetchJob = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/jobs/${id}`);
      setJob(data.job || data);
    } catch (err) {
      setError(err.message || 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchJob(); }, [fetchJob]);

  // Guard: only the job owner should see this page
  useEffect(() => {
    if (!loading && job) {
      const userId = user?._id || user?.id || user?.userId;
      const clientId = job.client?._id || job.client;
      if (String(clientId) !== String(userId)) {
        navigate(`/jobs/${id}`, { replace: true });
      }
    }
  }, [loading, job, user, id, navigate]);

  const handleAccept = async (proposalId) => {
    setActing(true);
    try {
      await apiRequest(`/api/jobs/${id}/proposals/${proposalId}/accept`, { method: 'POST' });
      await fetchJob();
    } catch (err) {
      alert(err.message || 'Failed to accept proposal');
    } finally { setActing(false); }
  };

  const handleDecline = async (proposalId) => {
    try {
      await apiRequest(`/api/jobs/${id}/proposals/${proposalId}/decline`, { method: 'POST' });
      await fetchJob();
    } catch (err) {
      alert(err.message || 'Failed to decline proposal');
    }
  };

  if (loading) return (
    <div className="jp-container">
      <SEO title="Job Proposals" noIndex={true} />
      <div className="jp-loading">Loading proposals…</div>
    </div>
  );

  if (error) return (
    <div className="jp-container">
      <SEO title="Job Proposals" noIndex={true} />
      <Link to="/projects?view=client" className="jp-back">← Back to My Jobs</Link>
      <div className="jp-empty">
        <div className="empty-icon">⚠️</div>
        <p>{error}</p>
      </div>
    </div>
  );

  if (!job) return null;

  const proposals   = job.proposals || [];
  const filtered    = filter === 'all' ? proposals : proposals.filter(p => p.status === filter);
  const counts      = {
    all:      proposals.length,
    pending:  proposals.filter(p => p.status === 'pending').length,
    accepted: proposals.filter(p => p.status === 'accepted').length,
    declined: proposals.filter(p => p.status === 'declined').length,
  };
  const budget = job.budget || {};
  const budgetStr = budget.min != null
    ? `${fmt(budget.min)}${budget.max && budget.max !== budget.min ? `–${fmt(budget.max)}` : ''}`
    : '—';

  return (
    <div className="jp-container">
      <SEO title="Job Proposals" noIndex={true} />
      {/* Back */}
      <Link to="/projects?view=client" className="jp-back">← Back to My Jobs</Link>

      {/* Header */}
      <div className="jp-header">
        <h1>{job.title}</h1>
        <div className="jp-header-meta">
          <span className={`jp-header-badge ${job.status}`}>{job.status?.replace('_', ' ')}</span>
          <span>💰 Budget: {budgetStr}</span>
          <span>📨 {proposals.length} proposal{proposals.length !== 1 ? 's' : ''}</span>
          {counts.pending > 0 && (
            <span style={{ color: '#ef4444', fontWeight: 600 }}>
              🔔 {counts.pending} pending review
            </span>
          )}
        </div>
      </div>

      {/* Filter */}
      {proposals.length > 0 && (
        <div className="jp-filter-bar">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              className={`jp-filter-btn ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}{counts[key] > 0 ? ` (${counts[key]})` : ''}
            </button>
          ))}
        </div>
      )}

      {/* Compare button */}
      {canCompare && proposals.length >= 2 && (
        <div className="jp-compare-bar">
          {!showCompare ? (
            <button className="jp-compare-toggle" onClick={() => setShowCompare(true)}>
              📊 Compare Proposals
            </button>
          ) : (
            <>
              <span className="jp-compare-hint">Select 2–4 proposals to compare</span>
              <button className="jp-compare-toggle" onClick={() => { setShowCompare(false); setCompareIds([]); }}>
                ✕ Cancel Compare
              </button>
            </>
          )}
        </div>
      )}

      {/* Comparison table */}
      {showCompare && compareIds.length >= 2 && (
        <div className="jp-compare-table-wrap">
          <div className="jp-compare-table">
            <div className="jp-ct-header">
              <div className="jp-ct-label" />
              {compareIds.map(pid => {
                const p = proposals.find(x => x._id === pid);
                return (
                  <div key={pid} className="jp-ct-cell">
                    <strong>{p?.freelancer?.firstName} {p?.freelancer?.lastName}</strong>
                  </div>
                );
              })}
            </div>
            {[
              { label: 'Price', render: p => `$${p.price || p.amount || '—'}` },
              { label: 'Delivery', render: p => p.deliveryTime ? `${p.deliveryTime} days` : '—' },
              { label: 'Rating', render: p => p.freelancer?.rating ? `${p.freelancer.rating.toFixed(1)} ⭐` : '—' },
              { label: 'Response Time', render: p => p.freelancer?.avgResponseTime ? `${Math.round(p.freelancer.avgResponseTime)}m` : '—' },
              { label: 'Status', render: p => p.status },
            ].map(row => (
              <div key={row.label} className="jp-ct-row">
                <div className="jp-ct-label">{row.label}</div>
                {compareIds.map(pid => {
                  const p = proposals.find(x => x._id === pid);
                  return <div key={pid} className="jp-ct-cell">{p ? row.render(p) : '—'}</div>;
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proposals */}
      {proposals.length === 0 ? (
        <div className="jp-empty">
          <div className="empty-icon">📭</div>
          <p>No proposals yet</p>
          <p style={{ fontSize: '0.85rem' }}>
            Share your job listing to attract freelancers.
          </p>
          <Link to={`/jobs/${id}`} className="jp-btn-profile" style={{ marginTop: '1rem', justifyContent: 'center' }}>
            View Job Listing →
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="jp-empty">
          <div className="empty-icon">🔍</div>
          <p>No {filter} proposals</p>
        </div>
      ) : (
        filtered.map(proposal => (
          <div key={proposal._id} className={`jp-proposal-wrap ${showCompare ? 'compare-mode' : ''}`}>
            {showCompare && (
              <label className="jp-compare-check">
                <input
                  type="checkbox"
                  checked={compareIds.includes(proposal._id)}
                  onChange={e => {
                    if (e.target.checked && compareIds.length < 4) setCompareIds(prev => [...prev, proposal._id]);
                    else setCompareIds(prev => prev.filter(x => x !== proposal._id));
                  }}
                  disabled={!compareIds.includes(proposal._id) && compareIds.length >= 4}
                />
              </label>
            )}
            <ProposalCard
              proposal={proposal}
              jobId={id}
              jobStatus={job.status}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          </div>
        ))
      )}
    </div>
  );
};

export default JobProposals;

