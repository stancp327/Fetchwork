import React, { useState } from 'react';
import { MILESTONE_STATUS_META, fmt } from './helpers';

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

        {!isArchived && (<>
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
        {isClient && !funded && !released && milestone.status !== 'approved' && onFund && (
          <button className="pm-ms-action fund" disabled={acting} onClick={() => onFund(index)}
            title="Secure payment for this milestone">
            💳 Fund
          </button>
        )}
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

export default MilestoneRow;
