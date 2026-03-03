import React from 'react';

const PackageTierForm = ({ prefix, label, data, onChange, errors, required, badge, isRecurring }) => {
  const billingCycle = data.recurringBillingCycle;
  const priceLabel = isRecurring
    ? billingCycle === 'per_session' ? 'Price per Session ($)'
      : billingCycle === 'weekly'    ? 'Weekly Rate ($)'
      : 'Monthly Rate ($)'
    : `Price ($)`;

  return (
    <div className={`pricing-card pricing-card-${prefix}`}>
      <div className="pkg-card-header">
        <h3>{label} {badge && <span className="pkg-badge">{badge}</span>}</h3>
      </div>
      <div className="wiz-field">
        <label>Package Title {required && '*'}</label>
        <input
          type="text"
          value={data[`${prefix}Title`]}
          onChange={e => onChange(`${prefix}Title`, e.target.value)}
          placeholder={
            isRecurring
              ? prefix === 'basic' ? 'e.g. Starter Session' : prefix === 'standard' ? 'e.g. Regular Plan' : 'e.g. Intensive Plan'
              : prefix === 'basic' ? 'e.g. Starter Package' : prefix === 'standard' ? 'e.g. Standard Package' : 'e.g. Premium Package'
          }
        />
        {errors[`${prefix}Title`] && <span className="wiz-error">{errors[`${prefix}Title`]}</span>}
      </div>
      <div className="wiz-field">
        <label>What's Included {required && '*'}</label>
        <textarea
          rows={3}
          value={data[`${prefix}Description`]}
          onChange={e => onChange(`${prefix}Description`, e.target.value)}
          placeholder={
            isRecurring
              ? 'e.g. 60-min session, personalized study plan, session notes sent after each class...'
              : 'Describe what\'s included in this package...'
          }
        />
        {errors[`${prefix}Description`] && <span className="wiz-error">{errors[`${prefix}Description`]}</span>}
      </div>

      {isRecurring ? (
        <div className="wiz-row">
          <div className="wiz-field">
            <label>{priceLabel} {required && '*'}</label>
            <input type="number" value={data[`${prefix}Price`]} onChange={e => onChange(`${prefix}Price`, e.target.value)} placeholder="60" min="1" step="0.01" />
            {errors[`${prefix}Price`] && <span className="wiz-error">{errors[`${prefix}Price`]}</span>}
          </div>
          {billingCycle !== 'per_session' && (
            <div className="wiz-field">
              <label>Sessions Included</label>
              <input type="number" value={data[`${prefix}SessionsIncluded`] || ''} onChange={e => onChange(`${prefix}SessionsIncluded`, e.target.value)} placeholder={billingCycle === 'weekly' ? 'e.g. 2' : 'e.g. 8'} min="1" />
            </div>
          )}
        </div>
      ) : (
        <div className="wiz-row wiz-row-3">
          <div className="wiz-field">
            <label>Price ($) {required && '*'}</label>
            <input type="number" value={data[`${prefix}Price`]} onChange={e => onChange(`${prefix}Price`, e.target.value)} placeholder="25" min="5" step="0.01" />
            {errors[`${prefix}Price`] && <span className="wiz-error">{errors[`${prefix}Price`]}</span>}
          </div>
          <div className="wiz-field">
            <label>Delivery (days) {required && '*'}</label>
            <input type="number" value={data[`${prefix}DeliveryTime`]} onChange={e => onChange(`${prefix}DeliveryTime`, e.target.value)} placeholder="3" min="1" />
            {errors[`${prefix}DeliveryTime`] && <span className="wiz-error">{errors[`${prefix}DeliveryTime`]}</span>}
          </div>
          <div className="wiz-field">
            <label>Revisions</label>
            <input type="number" value={data[`${prefix}Revisions`]} onChange={e => onChange(`${prefix}Revisions`, e.target.value)} min="0" max="20" />
          </div>
        </div>
      )}
    </div>
  );
};

export default PackageTierForm;
