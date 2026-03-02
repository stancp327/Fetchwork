import React from 'react';
import { Link } from 'react-router-dom';
import { fmt } from './helpers';

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

export default ApplicantPreview;
