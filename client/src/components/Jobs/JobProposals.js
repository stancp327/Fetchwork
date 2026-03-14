import React, { useState, useEffect, useCallback, useRef } from 'react';
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
const ProposalCard = ({ proposal, jobId, jobStatus, onAccept, onDecline, ranking, onCheckFlag, flagResult, flagLoading }) => {
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

  const scoreColor = ranking?.score >= 8 ? '#16a34a' : ranking?.score >= 5 ? '#ca8a04' : ranking?.score ? '#dc2626' : null;

  return (
    <div className={`jp-proposal-card ${proposal.status}`}>
      {/* AI Score badge */}
      {ranking && (
        <div className="jp-ai-rank-badge" style={{ background: scoreColor, color: '#fff' }}>
          <span className="jp-ai-rank-score">{ranking.score}/10</span>
          <span className="jp-ai-rank-label">AI Score</span>
        </div>
      )}
      {ranking?.strengths && (
        <div className="jp-ai-rank-detail">
          <span className="jp-ai-rank-strengths">Strengths: {ranking.strengths}</span>
          {ranking.concerns && <span className="jp-ai-rank-concerns">Concerns: {ranking.concerns}</span>}
        </div>
      )}

      {/* Freelancer identity */}
      <div className="jp-freelancer-row">
        <Link to={`/freelancers/${fl._id}`} style={{ textDecoration: 'none', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <div className="jp-avatar">
            {fl.profilePhoto
              ? <img src={fl.profilePhoto} alt={fl.firstName} />
              : initials}
          </div>
        </Link>
        <div className="jp-freelancer-info">
          <p className="jp-freelancer-name">
            <Link to={`/freelancers/${fl._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              {fl.firstName} {fl.lastName}
            </Link>
            {proposal.team && (
              <span className="jp-team-badge" title="Submitted as a team">🏢 Team bid</span>
            )}
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

        <button
          className="jp-ai-flag-btn"
          disabled={flagLoading}
          onClick={() => onCheckFlag(proposal)}
        >
          {flagLoading ? '🚩 Checking…' : '🚩 Check'}
        </button>

        {isAccepted && (
          <span className="jp-accepted-note">✅ Hired — job is in progress</span>
        )}
      </div>

      {/* Red flag result */}
      {flagResult && (
        <div className={`jp-ai-flag-result ${flagResult.flagged ? 'flagged' : 'clean'}`}>
          {flagResult.flagged ? (
            <>
              <span className="jp-ai-flag-severity" data-severity={flagResult.severity}>⚠️ {flagResult.severity} risk</span>
              <p className="jp-ai-flag-summary">{flagResult.summary}</p>
              <ul className="jp-ai-flag-list">
                {flagResult.flags?.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </>
          ) : (
            <span className="jp-ai-flag-clean">✅ No red flags detected</span>
          )}
        </div>
      )}
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
  const [aiSummary, setAiSummary] = useState('');
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [rankings, setRankings] = useState({});
  const [rankLoading, setRankLoading] = useState(false);
  const [flagResults, setFlagResults] = useState({});
  const [flagLoadingId, setFlagLoadingId] = useState(null);

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

  const handleAiSummary = async () => {
    if (aiSummary) { setShowAiSummary(s => !s); return; }
    setAiSummaryLoading(true);
    setShowAiSummary(true);
    try {
      const data = await apiRequest(`/api/ai/summarize-proposals/${id}`, { method: 'POST' });
      setAiSummary(data.summary || 'No summary available.');
    } catch (err) {
      if (err.status === 403) {
        setAiSummary('✨ AI Proposal Summarizer is a Plus+ feature. Upgrade to instantly summarize all proposals.');
      } else {
        setAiSummary('Could not generate summary — try again shortly.');
      }
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const handleAiRank = async () => {
    setRankLoading(true);
    try {
      const data = await apiRequest(`/api/ai/rank-proposals/${id}`, { method: 'POST' });
      const map = {};
      (data.rankings || []).forEach(r => { map[r.proposalId] = r; });
      setRankings(map);
    } catch (err) {
      if (err.status === 403) alert('AI Proposal Ranking is a Plus+ feature.');
      else alert('Could not rank proposals — try again shortly.');
    } finally { setRankLoading(false); }
  };

  const handleCheckFlag = async (proposal) => {
    const pid = proposal._id;
    setFlagLoadingId(pid);
    try {
      const data = await apiRequest('/api/ai/detect-proposal-redflag', {
        method: 'POST',
        body: JSON.stringify({
          proposalId: pid,
          coverLetter: proposal.coverLetter,
          proposedBudget: proposal.proposedBudget,
          freelancerName: `${proposal.freelancer?.firstName || ''} ${proposal.freelancer?.lastName || ''}`.trim(),
          jobBudget: job?.budget?.max || job?.budget?.min || 0,
        }),
      });
      setFlagResults(prev => ({ ...prev, [pid]: data }));
    } catch (err) {
      if (err.status === 403) alert('Red Flag Detection is a Plus+ feature.');
    } finally { setFlagLoadingId(null); }
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
  const hasRankings = Object.keys(rankings).length > 0;
  const sorted      = hasRankings
    ? [...proposals].sort((a, b) => (rankings[b._id]?.score || 0) - (rankings[a._id]?.score || 0))
    : proposals;
  const filtered    = filter === 'all' ? sorted : sorted.filter(p => p.status === filter);
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

      {/* AI Proposal Summarizer + Ranker */}
      {proposals.length >= 2 && (
        <div className="jp-ai-summary-wrap">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="jp-ai-summarize-btn" onClick={handleAiSummary} disabled={aiSummaryLoading}>
              {aiSummaryLoading ? '✨ Summarizing…' : showAiSummary ? '✨ Hide AI Summary' : `✨ AI Summary (${proposals.length} proposals)`}
            </button>
            <button className="jp-ai-rank-btn" onClick={handleAiRank} disabled={rankLoading}>
              {rankLoading ? '✨ Ranking…' : '✨ AI Rank All'}
            </button>
          </div>
          {showAiSummary && (
            <div className="jp-ai-summary-panel">
              {aiSummaryLoading
                ? <div className="jp-ai-summary-loading">Analyzing proposals…</div>
                : <pre className="jp-ai-summary-text">{aiSummary}</pre>
              }
            </div>
          )}
        </div>
      )}

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
              ranking={rankings[proposal._id]}
              onCheckFlag={handleCheckFlag}
              flagResult={flagResults[proposal._id]}
              flagLoading={flagLoadingId === proposal._id}
            />
          </div>
        ))
      )}
    </div>
  );
};

export default JobProposals;

