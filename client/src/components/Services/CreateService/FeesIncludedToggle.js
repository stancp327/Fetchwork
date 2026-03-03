import React from 'react';

const FeesIncludedToggle = ({ value, onChange }) => (
  <div className="fees-toggle-card">
    <div className="fees-toggle-info">
      <strong>Pricing display</strong>
      <p>
        {value
          ? '✅ Fees included — clients pay exactly your listed price. Platform fees are deducted from your payout.'
          : '➕ Fees added on top — clients pay your price + a small platform fee at checkout.'}
      </p>
    </div>
    <label className="toggle-switch">
      <input type="checkbox" checked={value} onChange={e => onChange('feesIncluded', e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  </div>
);

export default FeesIncludedToggle;
