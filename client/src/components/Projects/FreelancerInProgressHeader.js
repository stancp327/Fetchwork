import React from 'react';
import { Link } from 'react-router-dom';
import { fmt } from './helpers';

const FreelancerInProgressHeader = ({ job }) => {
  const cl = job.client || {};
  const name = cl.firstName ? `${cl.firstName} ${cl.lastName || ''}`.trim() : 'Client';
  const initials = (cl.firstName?.[0] || '') + (cl.lastName?.[0] || '');
  const rating = cl.rating ? Number(cl.rating).toFixed(1) : null;
  const escrow = job.escrowAmount || 0;
  const milestones = job.milestones || [];
  const msSecured  = milestones.reduce((s, m) => s + (m.escrowAmount || 0), 0);
  const totalSecured = escrow + msSecured;

  const deadline = job.deadline ? new Date(job.deadline) : null;
  const daysLeft = deadline
    ? Math.ceil((deadline - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const deadlineUrgent = daysLeft !== null && daysLeft <= 3;

  return (
    <div className="pm-fl-job-header">
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

export default FreelancerInProgressHeader;
