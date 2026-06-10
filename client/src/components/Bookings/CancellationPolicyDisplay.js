import React from 'react';
import './CancellationPolicyDisplay.css';

const POLICY_LABELS = {
  flexible: 'Flexible',
  moderate: 'Moderate',
  strict:   'Strict',
  custom:   'Custom',
};

const POLICY_SUMMARY = {
  flexible: 'Full refund up to 2 hours before · 50% refund after that',
  moderate: 'Full refund up to 24 hours before · 50% refund up to 12 hours before · No refund after',
  strict:   'Full refund up to 48 hours before · 50% refund up to 24 hours before · No refund after',
};

function ruleToText(rule) {
  if (rule.refundPercent === 0) return 'No refund within this window';
  const refund = rule.refundPercent === 100 ? 'Full refund' : `${rule.refundPercent}% refund`;
  return `${refund} if cancelled ${rule.hoursBeforeStart}+ hours before`;
}

const CancellationPolicyDisplay = ({ policy, compact = false }) => {
  if (!policy) return null;

  const type    = policy.type || 'moderate';
  const label   = POLICY_LABELS[type] || type;
  const summary = POLICY_SUMMARY[type];
  const rules   = policy.rulesJson;

  if (compact) {
    return (
      <div className="cpd cpd-compact">
        <span className={`cpd-badge cpd-badge-${type}`}>{label} Policy</span>
        {summary && <p className="cpd-summary">{summary}</p>}
      </div>
    );
  }

  return (
    <div className="cpd">
      <div className="cpd-header">
        <span className={`cpd-badge cpd-badge-${type}`}>{label} Cancellation Policy</span>
      </div>
      {summary && type !== 'custom' ? (
        <p className="cpd-summary">{summary}</p>
      ) : Array.isArray(rules) && rules.length > 0 ? (
        <ul className="cpd-rules">
          {rules.map((r, i) => (
            <li key={i} className="cpd-rule">
              <span className={`cpd-refund ${r.refundPercent === 0 ? 'cpd-refund-none' : 'cpd-refund-partial'}`}>
                {r.refundPercent === 100 ? 'Full' : r.refundPercent === 0 ? 'None' : `${r.refundPercent}%`}
              </span>
              <span className="cpd-rule-text">{ruleToText(r)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default CancellationPolicyDisplay;
