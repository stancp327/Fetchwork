import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import { apiRequest } from '../../utils/api';
import { categoryLabelMap } from '../../utils/categories';
import EscrowModal from '../Payments/EscrowModal';
import TipModal from '../Payments/TipModal';
import SEO from '../common/SEO';
import './ProjectManagement.css';

// ── Helpers ─────────────────────────────────────────────────────
const STATUS_LABELS = {
  draft: 'Draft', open: 'Open',
  accepted: 'Accepted', pending_start: 'Awaiting Start',
  in_progress: 'In Progress',
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
const MilestoneRow = ({ milestone, index, isFreelancer, isClient, isArchived, onUpdate, onFund, onRelease }) => {
  const [acting, setActing] = useState(false);
  const meta    = MILESTONE_STATUS_META[milestone.status] || MILESTONE_STATUS_META.pending;
  const done    = milestone.status === 'completed' || milestone.status === 'approved';
  const funded  = (milestone.escrowAmount || 0) > 0;
  const released = !!milestone.releasedAt;

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
          {/* Payment indicator */}
          {isClient && (
            <span className={`pm-ms-pay-tag ${released ? 'released' : funded ? 'funded' : 'unfunded'}`}>
              {released ? '✅ Released' : funded ? `🔒 ${fmt(milestone.escrowAmount)} secured` : '💳 Not funded'}
            </span>
          )}
        </div>
      </div>
      <div className="pm-ms-right">
        <span className="pm-ms-amount">{fmt(milestone.amount)}</span>
        <span className="pm-ms-badge" style={{ color: meta.color, background: meta.bg }}>
          {meta.label}
        </span>

        {/* All milestone actions are disabled on archived jobs */}
        {!isArchived && (<>
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

        {/* Client: fund unfunded milestones */}
        {isClient && !funded && !released && milestone.status !== 'approved' && onFund && (
          <button className="pm-ms-action fund" disabled={acting} onClick={() => onFund(index)}
            title="Secure payment for this milestone">
            💳 Fund
          </button>
        )}

        {/* Client: approve/revise when freelancer marks done */}
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

        {/* Client: release payment after approval */}
        {isClient && funded && !released && (milestone.status === 'completed' || milestone.status === 'approved') && onRelease && (
          <button className="pm-ms-action release" disabled={acting} onClick={() => onRelease(index)}>
            💸 Release
          </button>
        )}
        </>)}
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

// ── Applicant Preview (open job client view) ───────────────────
const ApplicantPreview = ({ proposals = [], jobId }) => {
  const pending  = proposals.filter(p => p.status === 'pending');
  const total    = proposals.length;
  const topThree = pending.slice(0, 3);

  if (total === 0) return (
    <div className="pm-no-proposals">
      No proposals yet — share your job link to attract freelancers.
    </div>
  );

  return (
    <div className="pm-applicants-section">
      <div className="pm-applicants-header">
        <span className="pm-applicants-label">
          {pending.length > 0
            ? <><strong>{pending.length}</strong> {pending.length === 1 ? 'applicant' : 'applicants'} waiting for review</>
            : <>{total} proposal{total !== 1 ? 's' : ''} received</>}
        </span>
      </div>

      <div className="pm-applicants-list">
        {topThree.map((p, i) => {
          const fl = p.freelancer || {};
          const name = fl.firstName ? `${fl.firstName} ${fl.lastName || ''}`.trim() : 'Freelancer';
          const initials = (fl.firstName?.[0] || '') + (fl.lastName?.[0] || '');
          const rating = fl.rating ? Number(fl.rating).toFixed(1) : null;

          return (
            <div key={p._id || i} className="pm-applicant-card">
              <div className="pm-applicant-avatar">
                {fl.profilePicture
                  ? <img src={fl.profilePicture} alt={name} />
                  : <span className="pm-applicant-initials">{initials || '?'}</span>}
              </div>
              <div className="pm-applicant-info">
                <Link
                  to={`/freelancers/${fl._id}`}
                  className="pm-applicant-name"
                  onClick={e => e.stopPropagation()}
                >
                  {name}
                </Link>
                <div className="pm-applicant-meta">
                  {rating && <span>⭐ {rating}</span>}
                  {fl.totalJobs > 0 && <span>{fl.totalJobs} jobs done</span>}
                </div>
              </div>
              <div className="pm-applicant-bid">
                <span className="pm-applicant-amount">{fmt(p.proposedBudget)}</span>
                {p.proposedDuration && (
                  <span className="pm-applicant-duration">
                    {p.proposedDuration.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pending.length > 3 && (
        <div className="pm-applicants-overflow">
          +{pending.length - 3} more applicant{pending.length - 3 !== 1 ? 's' : ''}
        </div>
      )}

      <Link to={`/jobs/${jobId}/proposals`} className="pm-btn-review-all">
        Review All {total} Proposal{total !== 1 ? 's' : ''} →
      </Link>
    </div>
  );
};

// ── Milestone Change Modal (client proposes new milestones) ────
const MilestoneChangeModal = ({ job, onClose, onSent }) => {
  // Only pre-fill editable milestones — funded/completed ones are locked on the server
  const existing = (job.milestones || [])
    .filter(m => m.status !== 'completed' && m.status !== 'approved' && !(m.escrowAmount > 0))
    .map(m => ({
      title:       m.title || '',
      description: m.description || '',
      amount:      m.amount || '',
      dueDate:     m.dueDate ? new Date(m.dueDate).toISOString().substring(0, 10) : '',
    }));

  const lockedCount = (job.milestones || []).filter(
    m => m.status === 'completed' || m.status === 'approved' || m.escrowAmount > 0
  ).length;

  const [milestones, setMilestones] = useState(
    existing.length > 0 ? existing : [{ title: '', description: '', amount: '', dueDate: '' }]
  );
  const [note,    setNote]    = useState('');
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState('');

  const updateMs = (i, field, value) => {
    setMilestones(ms => ms.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  };

  const addMs = () => setMilestones(ms => [...ms, { title: '', description: '', amount: '', dueDate: '' }]);
  const removeMs = (i) => setMilestones(ms => ms.filter((_, idx) => idx !== i));

  const total = milestones.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);

  const submit = async () => {
    const valid = milestones.filter(m => m.title.trim() && parseFloat(m.amount) > 0);
    if (valid.length === 0) { setError('Add at least one milestone with a title and amount.'); return; }
    setSending(true);
    setError('');
    try {
      await apiRequest(`/api/jobs/${job._id}/milestones/request`, {
        method: 'POST',
        body: JSON.stringify({
          proposedMilestones: valid.map(m => ({
            title:       m.title.trim(),
            description: m.description.trim(),
            amount:      parseFloat(m.amount),
            dueDate:     m.dueDate || undefined,
          })),
          note: note.trim(),
        }),
      });
      if (onSent) onSent();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to send milestone proposal');
    } finally { setSending(false); }
  };

  return (
    <div className="pm-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="pm-modal">
        <div className="pm-modal-header">
          <h3>Propose Milestone Changes</h3>
          <button className="pm-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="pm-modal-body">
          <p className="pm-modal-hint">
            The freelancer will receive this proposal in Messages and can accept or decline.
            {lockedCount > 0
              ? ` ${lockedCount} milestone${lockedCount !== 1 ? 's' : ''} already funded or completed — those are locked and will be kept.`
              : ' Proposing new milestones replaces any pending ones.'}
          </p>

          <div className="pm-ms-editor">
            {milestones.map((m, i) => (
              <div key={i} className="pm-ms-editor-row">
                <div className="pm-ms-editor-num">#{i + 1}</div>
                <div className="pm-ms-editor-fields">
                  <input
                    type="text"
                    placeholder="Milestone title"
                    value={m.title}
                    onChange={e => updateMs(i, 'title', e.target.value)}
                    className="pm-ms-input"
                  />
                  <div className="pm-ms-editor-row2">
                    <input
                      type="number"
                      placeholder="Amount ($)"
                      value={m.amount}
                      min="1"
                      onChange={e => updateMs(i, 'amount', e.target.value)}
                      className="pm-ms-input pm-ms-amount-input"
                    />
                    <input
                      type="date"
                      value={m.dueDate}
                      onChange={e => updateMs(i, 'dueDate', e.target.value)}
                      className="pm-ms-input pm-ms-date-input"
                    />
                    {milestones.length > 1 && (
                      <button className="pm-ms-remove" onClick={() => removeMs(i)} title="Remove">✕</button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={m.description}
                    onChange={e => updateMs(i, 'description', e.target.value)}
                    className="pm-ms-input pm-ms-desc-input"
                  />
                </div>
              </div>
            ))}

            <button className="pm-ms-add-btn" onClick={addMs}>+ Add Milestone</button>

            {total > 0 && (
              <div className="pm-ms-total-row">
                <span>Total</span>
                <strong>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)}
                </strong>
              </div>
            )}
          </div>

          <div className="pm-ms-note-section">
            <label className="pm-ms-note-label">Note to freelancer (optional)</label>
            <textarea
              rows={2}
              placeholder="Explain why you're proposing these changes…"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="pm-ms-note-input"
            />
          </div>

          {error && <div className="pm-modal-error">{error}</div>}
        </div>

        <div className="pm-modal-footer">
          <button className="pm-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="pm-modal-submit" disabled={sending} onClick={submit}>
            {sending ? 'Sending…' : 'Send Proposal →'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Client In-Progress Header ───────────────────────────────────
const ClientJobHeader = ({ job }) => {
  const fl = job.freelancer || {};
  const name = fl.firstName ? `${fl.firstName} ${fl.lastName || ''}`.trim() : 'Freelancer';
  const initials = (fl.firstName?.[0] || '') + (fl.lastName?.[0] || '');
  const rating = fl.rating ? Number(fl.rating).toFixed(1) : null;
  const milestones = job.milestones || [];
  const msTotal = milestones.length;
  const msDone  = milestones.filter(m => m.status === 'approved' || m.status === 'completed').length;
  const totalSecured  = milestones.reduce((s, m) => s + (m.escrowAmount || 0), job.escrowAmount || 0);
  const totalReleased = milestones.reduce((s, m) => s + (m.releasedAt ? (m.escrowAmount || 0) : 0), 0);

  return (
    <div className="pm-client-job-header">
      {/* Hired freelancer */}
      <div className="pm-hired-row">
        <div className="pm-hired-label">Hired</div>
        <div className="pm-hired-info">
          <div className="pm-hired-avatar">
            {fl.profilePicture
              ? <img src={fl.profilePicture} alt={name} />
              : <span className="pm-hired-initials">{initials || '?'}</span>}
          </div>
          <div className="pm-hired-details">
            <Link
              to={`/freelancers/${fl._id}`}
              className="pm-hired-name"
              onClick={e => e.stopPropagation()}
            >
              {name}
            </Link>
            <div className="pm-hired-meta">
              {rating && <span>⭐ {rating}</span>}
              {fl.totalJobs > 0 && <span>{fl.totalJobs} jobs done</span>}
            </div>
          </div>
        </div>
        <Link to="/messages" className="pm-hired-msg-btn" onClick={e => e.stopPropagation()}>
          💬 Message
        </Link>
      </div>

      {/* Payment summary */}
      {(totalSecured > 0 || totalReleased > 0 || msTotal > 0) && (
        <div className="pm-payment-summary">
          {msTotal > 0 && (
            <div className="pm-pay-sum-item">
              <span className="pm-pay-sum-label">Milestones</span>
              <span className="pm-pay-sum-val">{msDone}/{msTotal} done</span>
            </div>
          )}
          {totalSecured > 0 && (
            <div className="pm-pay-sum-item">
              <span className="pm-pay-sum-label">🔒 Secured</span>
              <span className="pm-pay-sum-val green">{fmt(totalSecured)}</span>
            </div>
          )}
          {totalReleased > 0 && (
            <div className="pm-pay-sum-item">
              <span className="pm-pay-sum-label">💸 Released</span>
              <span className="pm-pay-sum-val blue">{fmt(totalReleased)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Freelancer In-Progress Header ──────────────────────────────
const FreelancerInProgressHeader = ({ job }) => {
  const cl = job.client || {};
  const name = cl.firstName ? `${cl.firstName} ${cl.lastName || ''}`.trim() : 'Client';
  const initials = (cl.firstName?.[0] || '') + (cl.lastName?.[0] || '');
  const rating = cl.rating ? Number(cl.rating).toFixed(1) : null;
  const escrow = job.escrowAmount || 0;
  const milestones = job.milestones || [];
  const msSecured  = milestones.reduce((s, m) => s + (m.escrowAmount || 0), 0);
  const totalSecured = escrow + msSecured;

  // Deadline
  const deadline = job.deadline ? new Date(job.deadline) : null;
  const daysLeft = deadline
    ? Math.ceil((deadline - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const deadlineUrgent = daysLeft !== null && daysLeft <= 3;

  return (
    <div className="pm-fl-job-header">
      {/* Client row */}
      <div className="pm-fl-client-row">
        <div className="pm-fl-client-label">Working for</div>
        <div className="pm-fl-client-info">
          <div className="pm-fl-client-avatar">
            {cl.profilePicture
              ? <img src={cl.profilePicture} alt={name} />
              : <span className="pm-fl-client-initials">{initials || '?'}</span>}
          </div>
          <div className="pm-fl-client-details">
            <span className="pm-fl-client-name">{name}</span>
            {rating && (
              <div className="pm-fl-client-meta">
                <span>⭐ {rating}</span>
              </div>
            )}
          </div>
        </div>
        <Link to="/messages" className="pm-fl-msg-btn" onClick={e => e.stopPropagation()}>
          💬 Message
        </Link>
      </div>

      {/* Payment + deadline strip */}
      <div className="pm-fl-status-strip">
        <div className="pm-fl-status-item">
          {totalSecured > 0
            ? <><span className="pm-fl-status-icon funded">🔒</span><span className="pm-fl-status-text funded">{fmt(totalSecured)} secured</span></>
            : <><span className="pm-fl-status-icon">⏳</span><span className="pm-fl-status-text muted">No payment secured yet</span></>
          }
        </div>
        {deadline && (
          <div className="pm-fl-status-item">
            <span className={`pm-fl-deadline ${deadlineUrgent ? 'urgent' : ''}`}>
              {deadlineUrgent ? '⚠️' : '📅'} {daysLeft <= 0 ? 'Overdue' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Project Card ────────────────────────────────────────────────
const ProjectCard = ({ job, onAcceptProposal, onComplete, onMilestoneUpdate, onFundMilestone, onReleaseMilestone, onProposeMilestones, onStartJob, onBeginJob, onRefresh, onTip }) => {
  const navigate = useNavigate();
  const [featured, setFeatured]   = React.useState(!!job.isFeatured);
  const [featuring, setFeaturing] = React.useState(false);

  const handleFeatureToggle = async () => {
    setFeaturing(true);
    try {
      const res = await apiRequest(`/api/jobs/${job._id}/feature`, { method: 'POST' });
      setFeatured(res.isFeatured);
    } catch (err) {
      if (err.data?.upgradeRequired) {
        alert('Featured placement requires a Pro plan. Upgrade at /pricing.');
      } else {
        alert(err.message || 'Failed to update');
      }
    } finally {
      setFeaturing(false);
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

  // ── Pending-start inline milestone editor (client only) ──
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

      {/* Client in-progress: freelancer info + payment summary */}
      {isClient && status === 'in_progress' && (
        <ClientJobHeader job={job} />
      )}

      {/* Freelancer in-progress: client info + payment/deadline header */}
      {isFreelancer && status === 'in_progress' && (
        <FreelancerInProgressHeader job={job} />
      )}

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

      {/* ── Accepted: freelancer ready to start ────────────── */}
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

      {/* ── Pending start: client approves, may add milestones ── */}
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

          {/* Inline milestone editor */}
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

      {/* ── Pending start: freelancer waiting ───────────────── */}
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
            className={`pm-btn-feature ${featured ? 'active' : ''}`}
            onClick={handleFeatureToggle}
            disabled={featuring}
            title={featured ? 'Remove featured placement' : 'Feature this job (Pro)'}
          >
            {featuring ? '…' : featured ? '⭐ Featured' : '☆ Feature Job'}
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
  { key: 'open',           label: 'Open Jobs' },       // posted, collecting proposals
  { key: 'awaiting_start', label: 'Awaiting Start' },  // freelancer accepted, start approval window
  { key: 'in_progress',    label: 'In Progress' },     // hired, work underway
  { key: 'completed',      label: 'Completed' },
  { key: 'history',        label: 'History' },         // all archived (completed + past-deadline)
];

const FREELANCER_TABS = [
  { key: 'awaiting_start', label: 'Accepted' },       // proposal accepted, pending start
  { key: 'in_progress',    label: 'Active Work' },    // jobs I'm working on
  { key: 'proposals',      label: 'Proposals Sent' },
  { key: 'service_orders', label: 'Service Orders' },
  { key: 'completed',      label: 'Completed' },
  { key: 'history',        label: 'History' },        // all archived jobs
];

// ── Main ─────────────────────────────────────────────────────────
const ProjectManagement = () => {
  const { user } = useAuth();
  const { currentRole, switchRole } = useRole();
  const [searchParams, setSearchParams] = useSearchParams();

  // Role split
  const [clientJobs,     setClientJobs]     = useState([]);
  const [freelancerJobs, setFreelancerJobs] = useState([]);
  const [proposalJobs,   setProposalJobs]   = useState([]);
  const [serviceOrders,  setServiceOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // viewMode — URL param takes priority for deep-linking, syncs to RoleContext
  const rawView = searchParams.get('view');
  const viewMode = rawView === 'freelancer' ? 'freelancer'
    : rawView === 'client' ? 'client'
    : currentRole; // fall back to global role if no URL param
  const setViewMode = (v) => {
    switchRole(v);              // persist globally
    setSearchParams({ view: v });
    setTab(v === 'client' ? 'open' : 'in_progress');
  };

  const [tab, setTab] = useState(viewMode === 'client' ? 'open' : 'in_progress');

  // Sync global role changes (e.g. nav toggle) to the local tab
  // Only fires when there is NO URL param — URL param takes priority
  useEffect(() => {
    if (rawView) return; // URL param is in charge, leave tab alone
    setTab(currentRole === 'client' ? 'open' : 'in_progress');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRole]);

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

  // ── Start Job (freelancer: accepted → pending_start) ───────
  const handleStartJob = async (jobId) => {
    if (!window.confirm('Signal to the client that you\'re ready to start?\nThey\'ll have 24 hours to review milestones and approve.')) return;
    try {
      await apiRequest(`/api/jobs/${jobId}/start`, { method: 'POST' });
      fetchJobs();
    } catch (err) { setError(err.message || 'Failed to start job'); }
  };

  // ── Begin Job (client: pending_start → in_progress) ────────
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

  // ── Milestone change modal ─────────────────────────────────
  const [msModalJob, setMsModalJob] = useState(null);
  const [tipJob,     setTipJob]     = useState(null);

  // ── Milestone fund / release ────────────────────────────────
  const [milestoneFunding, setMilestoneFunding] = useState(null);

  const handleFundMilestone = async (jobId, index) => {
    try {
      const res = await apiRequest(`/api/jobs/${jobId}/milestones/${index}/fund`, { method: 'POST' });
      // res = { clientSecret, paymentIntentId, milestoneIndex, milestoneTitle, amount }
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

  // Note: completeJob() immediately sets isArchived=true on completed jobs.
  // So "completed" tab intentionally shows status=completed regardless of isArchived.
  // "history" tab shows non-completed archived jobs (past_deadline, etc.).
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
        ? displayJobs.filter(j => j.isArchived && j.status !== 'completed')  // past-deadline / stale archived
        : tab === 'completed'
          ? displayJobs.filter(j => j.status === 'completed')                // completed (always archived, show regardless)
          : tab === 'awaiting_start'
            ? displayJobs.filter(j => ['accepted', 'pending_start'].includes(j.status) && !j.isArchived)
            : displayJobs.filter(j => j.status === tab && !j.isArchived);    // active tabs hide archived

  const hasContent = isClientView
    ? (clientJobs.length > 0)
    : (freelancerJobs.length > 0 || proposalJobs.length > 0 || serviceOrders.length > 0);

  const hasBothRoles = clientJobs.length > 0 && (freelancerJobs.length > 0 || proposalJobs.length > 0);

  // ── Stat definitions per view ─────────────────────────────────
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
        {activeTabs
          // Only show History tab if there are actually archived jobs
          .filter(t => t.key !== 'history' || counts.history > 0)
          .map(t => (
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

      {/* Milestone change proposal modal */}
      {msModalJob && (
        <MilestoneChangeModal
          job={msModalJob}
          onClose={() => setMsModalJob(null)}
          onSent={fetchJobs}
        />
      )}

      {tipJob && (
        <TipModal
          job={tipJob}
          onClose={() => setTipJob(null)}
          onSuccess={fetchJobs}
        />
      )}

      {/* Milestone funding modal */}
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

