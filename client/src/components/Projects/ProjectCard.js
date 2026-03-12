import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { categoryLabelMap } from '../../utils/categories';
import { STATUS_LABELS, fmt, timeAgo } from './helpers';
import MilestoneRow from './MilestoneRow';
import QuickUpdate from './QuickUpdate';
import ApplicantPreview from './ApplicantPreview';
import ClientJobHeader from './ClientJobHeader';
import FreelancerInProgressHeader from './FreelancerInProgressHeader';

const ProjectCard = ({ job, onAcceptProposal, onComplete, onMilestoneUpdate, onFundMilestone, onReleaseMilestone, onProposeMilestones, onStartJob, onBeginJob, onRefresh, onTip }) => {
  const navigate = useNavigate();
  const [boosted, setBoosted]     = React.useState(!!job.isBoosted && job.boostExpiresAt && new Date(job.boostExpiresAt) > new Date());
  const [boosting, setBoosting]   = React.useState(false);
  const [boostCredits, setBoostCredits] = React.useState(null);

  React.useEffect(() => {
    apiRequest('/api/boosts/credits').then(c => setBoostCredits(c)).catch(() => {});
  }, []);

  const handleBoost = async () => {
    setBoosting(true);
    try {
      const hasCredits = boostCredits && boostCredits.remaining > 0;
      const res = await apiRequest(`/api/boosts/job/${job._id}`, {
        method: 'POST',
        body: JSON.stringify({ plan: '7day', useCredit: hasCredits }),
      });
      if (res.boosted) {
        setBoosted(true);
        setBoostCredits(prev => prev ? { ...prev, remaining: res.creditsRemaining, used: prev.used + 1 } : prev);
      } else {
        window.location.href = `/boost-checkout?secret=${res.clientSecret}&amount=${res.amount}&type=job&id=${job._id}`;
      }
    } catch (err) {
      alert(err.message || 'Failed to create boost');
    } finally {
      setBoosting(false);
    }
  };

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

  const isArchived = !!job.isArchived;

  const milestones = job.milestones || [];
  const msDone  = milestones.filter(m => m.status === 'completed' || m.status === 'approved').length;
  const msTotal = milestones.length;
  const msPct   = msTotal > 0 ? Math.round((msDone / msTotal) * 100) : null;
  const allMsDone = msTotal > 0 && msDone === msTotal;

  const escrow   = job.escrowAmount || 0;
  const totalPaid = job.totalPaid || 0;

  // Pending-start inline milestone editor (client only)
  const [pendingMilestones, setPendingMilestones] = useState(
    milestones.length > 0
      ? milestones.map(m => ({ title: m.title, amount: m.amount, description: m.description || '' }))
      : [{ title: '', amount: '' }]
  );
  const addPendingMs = () => setPendingMilestones(prev => [...prev, { title: '', amount: '' }]);
  const removePendingMs = (i) => setPendingMilestones(prev => prev.filter((_, idx) => idx !== i));
  const updatePendingMs = (i, field, val) =>
    setPendingMilestones(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));

  // Countdown for pending_start
  const pendingStartAt = job.pendingStartAt ? new Date(job.pendingStartAt) : null;
  const hoursLeft = pendingStartAt
    ? Math.max(0, Math.round((pendingStartAt.getTime() + 24 * 3600 * 1000 - Date.now()) / 3600000))
    : null;

  return (
    <div className={`pm-project-card ${isFreelancer ? 'freelancer-card' : ''} ${isArchived ? 'pm-archived' : ''}`}>
      {/* Header */}
      <div className="pm-project-header">
        <div className="pm-project-title-row">
          <button
            className="pm-project-title"
            onClick={() => {
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
          {isArchived && (
            <span className="pm-archived-badge" title={`Archived: ${job.archiveReason?.replace('_', ' ') || ''}`}>
              📦 Archived
            </span>
          )}
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

      {/* Client in-progress header */}
      {isClient && status === 'in_progress' && <ClientJobHeader job={job} />}

      {/* Freelancer in-progress header */}
      {isFreelancer && status === 'in_progress' && <FreelancerInProgressHeader job={job} />}

      {/* Milestones */}
      {(msTotal > 0 || (isClient && status === 'in_progress')) && (status === 'in_progress' || status === 'completed') && (
        <div className="pm-milestones-section">
          <div className="pm-ms-header">
            <span className="pm-ms-heading">Milestones</span>
            {msTotal > 0 && <span className="pm-ms-count">{msDone}/{msTotal}</span>}
            {msPct !== null && (
              <div className="pm-ms-progress">
                <div className="pm-ms-progress-fill" style={{ width: `${msPct}%` }} />
              </div>
            )}
            {isClient && status === 'in_progress' && onProposeMilestones && (
              <button
                className="pm-ms-propose-btn"
                onClick={e => { e.stopPropagation(); onProposeMilestones(job); }}
                title="Propose new or updated milestones"
              >
                {msTotal === 0 ? '+ Add Milestones' : '✏️ Edit'}
              </button>
            )}
          </div>
          {msTotal === 0 && isClient && (
            <div className="pm-ms-empty-hint">
              No milestones yet — click "+ Add Milestones" to propose them to the freelancer.
            </div>
          )}
          {milestones.map((m, i) => (
            <MilestoneRow
              key={m._id || i}
              milestone={m}
              index={i}
              isFreelancer={isFreelancer}
              isClient={isClient}
              isArchived={isArchived}
              onUpdate={(idx, s) => onMilestoneUpdate(job._id, idx, s)}
              onFund={isClient && onFundMilestone ? (idx) => onFundMilestone(job._id, idx) : null}
              onRelease={isClient && onReleaseMilestone ? (idx) => onReleaseMilestone(job._id, idx) : null}
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

      {/* Applicant preview (client only, open jobs) */}
      {isClient && status === 'open' && (
        <ApplicantPreview proposals={job.proposals || []} jobId={job._id} />
      )}

      {/* Accepted: freelancer ready to start */}
      {isFreelancer && status === 'accepted' && (
        <div className="pm-pending-start-box freelancer">
          <div className="pm-pending-start-icon">🎉</div>
          <div>
            <strong>Proposal accepted!</strong>
            <p className="pm-pending-start-hint">Click "Start Job" when you're ready. The client will have 24 hours to review milestones and approve.</p>
          </div>
          <button className="pm-btn-start-job" onClick={() => onStartJob && onStartJob(job._id)}>
            🚀 Start Job
          </button>
        </div>
      )}

      {/* Pending start: client approves */}
      {isClient && status === 'pending_start' && (
        <div className="pm-pending-start-box client">
          <div className="pm-pending-start-header">
            <span className="pm-pending-start-icon">⏳</span>
            <div>
              <strong>Freelancer is ready to start</strong>
              {hoursLeft !== null && (
                <span className="pm-pending-start-countdown">
                  {hoursLeft > 0 ? ` — ${hoursLeft}h left to approve` : ' — Auto-starting soon'}
                </span>
              )}
            </div>
          </div>
          <p className="pm-pending-start-hint">Review or add milestones below, then approve to kick off the work.</p>

          <div className="pm-pending-ms-editor">
            <div className="pm-pending-ms-label">Milestones <span className="pm-pending-ms-optional">(optional)</span></div>
            {pendingMilestones.map((m, i) => (
              <div key={i} className="pm-pending-ms-row">
                <input
                  className="pm-pending-ms-title"
                  placeholder="Milestone title"
                  value={m.title}
                  onChange={e => updatePendingMs(i, 'title', e.target.value)}
                />
                <input
                  className="pm-pending-ms-amount"
                  type="number"
                  placeholder="$"
                  min="0"
                  value={m.amount}
                  onChange={e => updatePendingMs(i, 'amount', e.target.value)}
                />
                {pendingMilestones.length > 1 && (
                  <button className="pm-pending-ms-remove" onClick={() => removePendingMs(i)}>✕</button>
                )}
              </div>
            ))}
            <button className="pm-pending-ms-add" onClick={addPendingMs}>+ Add milestone</button>
          </div>

          <button
            className="pm-btn-begin-job"
            onClick={() => {
              const validMilestones = pendingMilestones.filter(m => m.title.trim());
              onBeginJob && onBeginJob(job._id, validMilestones.length > 0 ? validMilestones : []);
            }}
          >
            ✅ Approve & Start Job
          </button>
        </div>
      )}

      {/* Pending start: freelancer waiting */}
      {isFreelancer && status === 'pending_start' && (
        <div className="pm-pending-start-box freelancer waiting">
          <span className="pm-pending-start-icon">⏳</span>
          <div>
            <strong>Waiting for client approval</strong>
            {hoursLeft !== null && (
              <p className="pm-pending-start-hint">
                {hoursLeft > 0
                  ? `Client has ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''} to approve or add milestones.`
                  : 'Auto-approving shortly — job will begin very soon.'}
              </p>
            )}
          </div>
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
        {isFreelancer && status === 'in_progress' && (msTotal === 0 || allMsDone) && (
          <button className="pm-btn-complete" onClick={() => onComplete(job._id)}>
            ✓ Mark Job Complete
          </button>
        )}
        {isFreelancer && status === 'in_progress' && msTotal > 0 && !allMsDone && (
          <span className="pm-ms-remaining-hint">
            {msTotal - msDone} milestone{msTotal - msDone !== 1 ? 's' : ''} remaining
          </span>
        )}
        {isClient && status === 'in_progress' && (
          <button className="pm-btn-complete client" onClick={() => onComplete(job._id)}>
            {job.escrowAmount > 0 ? '✓ Approve & Release Payment' : '✓ Mark Job Complete'}
          </button>
        )}
        {isClient && status === 'open' && !isArchived && (
          <button
            className={`pm-btn-feature ${boosted ? 'active' : ''}`}
            onClick={() => boosted ? null : handleBoost('7day')}
            disabled={boosting || boosted}
            title={boosted ? `Boosted until ${new Date(job.boostExpiresAt).toLocaleDateString()}` : 'Boost this job for more visibility'}
          >
            {boosting ? '…' : boosted ? '🚀 Boosted' : boostCredits?.remaining > 0 ? `🚀 Boost Job (${boostCredits.remaining} free)` : '🚀 Boost Job — $4.99'}
          </button>
        )}
        {isClient && status === 'completed' && onTip && (
          <button className="pm-btn-tip" onClick={() => onTip(job)}>
            🎁 Send Tip
          </button>
        )}
        {job.recurring?.enabled && (
          <span className="pm-badge-recurring" title={`Recurring ${job.recurring.interval}`}>♻️ Recurring</span>
        )}
      </div>

      <div className="pm-project-footer">
        <span>Updated {timeAgo(job.updatedAt || job.createdAt)}</span>
      </div>
    </div>
  );
};

export default ProjectCard;

