import React from 'react';

const PRICING_LABELS = {
  deliverable: {
    title: prefix => prefix === 'basic' ? 'e.g. Starter Package' : prefix === 'standard' ? 'e.g. Standard Package' : 'e.g. Premium Package',
    desc: "Describe what's included in this package...",
    priceLabel: 'Price ($)',
    priceMin: 5,
    pricePlaceholder: '25',
    showDelivery: true,
    showRevisions: true,
    showSessions: false,
  },
  private_session: {
    title: prefix => prefix === 'basic' ? 'e.g. Single Session' : prefix === 'standard' ? 'e.g. 4-Session Pack' : 'e.g. 8-Session Pack',
    desc: 'e.g. 60-min session, personalized plan, session notes...',
    priceLabel: 'Price per Session ($)',
    priceMin: 0,
    pricePlaceholder: '60',
    showDelivery: false,
    showRevisions: false,
    showSessions: (prefix) => prefix !== 'basic', // Standard/Premium show sessionsIncluded
  },
  class_or_recurring: {
    title: () => 'e.g. Drop-in Rate',
    desc: 'What participants can expect each session...',
    priceLabel: 'Drop-in Price ($)',
    priceMin: 0,
    pricePlaceholder: '20',
    showDelivery: false,
    showRevisions: false,
    showSessions: false,
    descOptional: true,
  },
  event_ticket: {
    title: () => 'e.g. General Admission',
    desc: 'What attendees will experience...',
    priceLabel: 'Ticket Price ($)',
    priceMin: 0,
    pricePlaceholder: '30',
    showDelivery: false,
    showRevisions: false,
    showSessions: false,
    descOptional: true,
  },
  quote_based: {
    title: () => 'e.g. Starting Price',
    desc: 'Describe typical scope and what this estimate covers...',
    priceLabel: 'Starting Price ($)',
    priceMin: 0,
    pricePlaceholder: '50',
    showDelivery: false,
    showRevisions: false,
    showSessions: false,
    descOptional: true,
  },
};

const PackageTierForm = ({ prefix, label, data, onChange, errors, required, badge, isRecurring, pricingMode }) => {
  // Determine mode: use pricingMode if provided, fall back to isRecurring for backward compat
  const mode = pricingMode || (isRecurring ? 'private_session' : 'deliverable');
  const cfg = PRICING_LABELS[mode] || PRICING_LABELS.deliverable;

  const showSessions = typeof cfg.showSessions === 'function' ? cfg.showSessions(prefix) : cfg.showSessions;

  return (
    <div className={`pricing-card pricing-card-${prefix}`}>
      <div className="pkg-card-header">
        <h3>{label} {badge && <span className="pkg-badge">{badge}</span>}</h3>
      </div>
      <div className="wiz-field">
        <label>
          {mode === 'deliverable' ? 'Package Title' : mode === 'quote_based' ? 'Price Label' : 'Title'}
          {required && !cfg.descOptional && ' *'}
        </label>
        <input
          type="text"
          value={data[`${prefix}Title`]}
          onChange={e => onChange(`${prefix}Title`, e.target.value)}
          placeholder={typeof cfg.title === 'function' ? cfg.title(prefix) : cfg.title}
        />
        {errors[`${prefix}Title`] && <span className="wiz-error">{errors[`${prefix}Title`]}</span>}
      </div>
      <div className="wiz-field">
        <label>
          {mode === 'deliverable' ? "What's Included" : 'Description'}
          {required && !cfg.descOptional && ' *'}
          {cfg.descOptional && ' (optional)'}
        </label>
        <textarea
          rows={3}
          value={data[`${prefix}Description`]}
          onChange={e => onChange(`${prefix}Description`, e.target.value)}
          placeholder={cfg.desc}
        />
        {errors[`${prefix}Description`] && <span className="wiz-error">{errors[`${prefix}Description`]}</span>}
      </div>

      <div className={`wiz-row ${cfg.showDelivery ? 'wiz-row-3' : ''}`}>
        <div className="wiz-field">
          <label>{cfg.priceLabel} {required && '*'}</label>
          <input
            type="number"
            value={data[`${prefix}Price`]}
            onChange={e => onChange(`${prefix}Price`, e.target.value)}
            placeholder={cfg.pricePlaceholder}
            min={cfg.priceMin}
            step="0.01"
          />
          {cfg.priceMin === 0 && <p className="wiz-hint">$0 = free</p>}
          {errors[`${prefix}Price`] && <span className="wiz-error">{errors[`${prefix}Price`]}</span>}
        </div>

        {cfg.showDelivery && (
          <div className="wiz-field">
            <label>Delivery (days) {required && '*'}</label>
            <input
              type="number"
              value={data[`${prefix}DeliveryTime`]}
              onChange={e => onChange(`${prefix}DeliveryTime`, e.target.value)}
              placeholder="3"
              min="1"
            />
            {errors[`${prefix}DeliveryTime`] && <span className="wiz-error">{errors[`${prefix}DeliveryTime`]}</span>}
          </div>
        )}

        {cfg.showRevisions && (
          <div className="wiz-field">
            <label>Revisions</label>
            <input
              type="number"
              value={data[`${prefix}Revisions`]}
              onChange={e => onChange(`${prefix}Revisions`, e.target.value)}
              min="0"
              max="20"
            />
          </div>
        )}

        {showSessions && (
          <div className="wiz-field">
            <label>Sessions Included</label>
            <input
              type="number"
              value={data[`${prefix}SessionsIncluded`] || ''}
              onChange={e => onChange(`${prefix}SessionsIncluded`, e.target.value)}
              placeholder={prefix === 'standard' ? 'e.g. 4' : 'e.g. 8'}
              min="1"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PackageTierForm;
