import React, { useState } from 'react';
import { apiRequest } from '../../utils/api';
import './DualControlPanel.css';

const DUAL_CONTROL_INFO = [
  'Payouts above the approval threshold',
  'Spend control changes',
  'Role changes for team members',
  'Removing team members',
];

export default function DualControlPanel({ team, currentUserRole, onTeamUpdated }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isOwnerOrAdmin = currentUserRole === 'owner' || currentUserRole === 'admin';
  const dualControlEnabled = team?.approvalThresholds?.requireDualControl || false;

  const toggleDualControl = async () => {
    if (!isOwnerOrAdmin) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await apiRequest(`/api/teams/${team._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          approvalThresholds: {
            ...team.approvalThresholds,
            requireDualControl: !dualControlEnabled,
          },
        }),
      });
      setSuccess(dualControlEnabled ? 'Dual control disabled' : 'Dual control enabled');
      if (onTeamUpdated) onTeamUpdated(res.team || res);
    } catch (err) {
      setError(err.message || 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dcp-root">
      <h3 className="dcp-title">Dual-Control Approval</h3>
      <p className="dcp-description">
        When enabled, sensitive actions require approval from <strong>two separate approvers</strong> before they take effect.
        The person who initiated the request cannot approve their own action.
      </p>

      {error && <div className="dcp-error">{error}</div>}
      {success && <div className="dcp-success">{success}</div>}

      <div className="dcp-toggle-row">
        <label className="dcp-toggle-label">
          <span className="dcp-toggle-text">Require dual approval for sensitive actions</span>
          <button
            type="button"
            role="switch"
            aria-checked={dualControlEnabled}
            className={`dcp-switch ${dualControlEnabled ? 'dcp-switch--on' : ''}`}
            onClick={toggleDualControl}
            disabled={!isOwnerOrAdmin || saving}
          >
            <span className="dcp-switch-knob" />
          </button>
        </label>
      </div>

      {dualControlEnabled && (
        <div className="dcp-info-box">
          <h4 className="dcp-info-title">Actions requiring 2 approvers:</h4>
          <ul className="dcp-info-list">
            {DUAL_CONTROL_INFO.map((item, i) => (
              <li key={i} className="dcp-info-item">{item}</li>
            ))}
          </ul>
        </div>
      )}

      {!isOwnerOrAdmin && (
        <p className="dcp-note">Only team owners and admins can change this setting.</p>
      )}
    </div>
  );
}

/**
 * Approval progress indicator for use inside TeamApprovalQueue cards.
 * Shows 0/2, 1/2, or 2/2 approval progress when dual control is active.
 */
export function DualApprovalProgress({ approval }) {
  const required = approval?.requiredApprovals || 1;
  if (required < 2) return null;

  const current = approval?.currentApprovals || 0;
  const complete = current >= required;
  const isSelfRequest = approval?.isSelfRequest;

  return (
    <div className="dcp-progress">
      <div className="dcp-progress-bar">
        <div
          className={`dcp-progress-fill ${complete ? 'dcp-progress-fill--complete' : ''}`}
          style={{ width: `${(current / required) * 100}%` }}
        />
      </div>
      <span className="dcp-progress-label">{current}/{required} approvers</span>
      {isSelfRequest && (
        <span className="dcp-self-warning">You cannot approve your own request</span>
      )}
    </div>
  );
}
