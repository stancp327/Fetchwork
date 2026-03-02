import React from 'react';
import { Link } from 'react-router-dom';
import { fmt } from './helpers';

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
      <div className="pm-hired-row">
        <div className="pm-hired-label">Hired</div>
        <div className="pm-hired-info">
          <div className="pm-hired-avatar">
            {fl.profilePicture
              ? <img src={fl.profilePicture} alt={name} />
              : <span className="pm-hired-initials">{initials || '?'}</span>}
          </div>
          <div className="pm-hired-details">
            <Link to={`/freelancers/${fl._id}`} className="pm-hired-name" onClick={e => e.stopPropagation()}>
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

export default ClientJobHeader;
