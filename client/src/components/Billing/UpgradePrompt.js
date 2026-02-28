import React from 'react';
import { Link } from 'react-router-dom';
import './UpgradePrompt.css';

/**
 * UpgradePrompt — shown when a user hits a plan limit or gated feature.
 *
 * Props:
 *   reason      — 'job_limit' | 'service_limit' | 'feature_gated' | 'wallet' | custom
 *   message     — override the default message
 *   limit       — the numeric limit they hit (optional)
 *   feature     — feature slug (for feature_gated reason)
 *   onDismiss   — callback to close/dismiss
 *   inline      — if true, renders as inline banner (no modal overlay)
 */

const DEFAULT_MESSAGES = {
  job_limit:     (limit) => `You've reached your limit of ${limit} active job post${limit === 1 ? '' : 's'} on your current plan.`,
  service_limit: (limit) => `You've reached your limit of ${limit} service listing${limit === 1 ? '' : 's'} on your current plan.`,
  feature_gated: () => 'This feature is available on Plus and Pro plans.',
  wallet:        () => 'The wallet is available on Plus and Pro plans.',
  default:       () => 'This feature requires a higher plan.',
};

const UpgradePrompt = ({ reason = 'default', message, limit, feature, onDismiss, inline = false }) => {
  const resolvedMsg = message
    || (DEFAULT_MESSAGES[reason] ? DEFAULT_MESSAGES[reason](limit) : DEFAULT_MESSAGES.default());

  const content = (
    <div className={`upgrade-prompt ${inline ? 'upgrade-prompt-inline' : 'upgrade-prompt-modal-body'}`}>
      <div className="upgrade-prompt-icon">🚀</div>
      <div className="upgrade-prompt-text">
        <strong>Upgrade to unlock this</strong>
        <p>{resolvedMsg}</p>
      </div>
      <div className="upgrade-prompt-actions">
        <Link to="/pricing" className="upgrade-prompt-cta">
          See plans →
        </Link>
        {onDismiss && (
          <button className="upgrade-prompt-dismiss" onClick={onDismiss}>
            Not now
          </button>
        )}
      </div>
    </div>
  );

  if (inline) return content;

  return (
    <div className="upgrade-prompt-overlay" onClick={onDismiss}>
      <div className="upgrade-prompt-card" onClick={e => e.stopPropagation()}>
        {onDismiss && (
          <button className="upgrade-prompt-close" onClick={onDismiss} aria-label="Close">✕</button>
        )}
        {content}
      </div>
    </div>
  );
};

export default UpgradePrompt;
