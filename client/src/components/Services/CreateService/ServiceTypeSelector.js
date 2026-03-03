import React from 'react';

const ServiceTypeSelector = ({ value, onChange, hasFeature = () => true }) => (
  <div className="service-type-selector">
    <label className="wiz-field-label-standalone">What kind of service is this? *</label>
    <div className="service-type-cards">
      <button
        type="button"
        className={`service-type-card ${value === 'one_time' ? 'selected' : ''}`}
        onClick={() => onChange('serviceType', 'one_time')}
      >
        <span className="svc-type-icon">📦</span>
        <div>
          <strong>One-Time Delivery</strong>
          <p>Logo design, website build, video editing, writing...</p>
        </div>
        <span className="svc-type-check">{value === 'one_time' ? '✓' : ''}</span>
      </button>
      <button
        type="button"
        className={`service-type-card ${value === 'recurring' ? 'selected' : ''} ${!hasFeature('recurring_services') ? 'locked' : ''}`}
        onClick={() => hasFeature('recurring_services') ? onChange('serviceType', 'recurring') : null}
        title={!hasFeature('recurring_services') ? 'Requires Plus or Pro plan' : ''}
      >
        <span className="svc-type-icon">🔄</span>
        <div>
          <strong>Recurring Sessions {!hasFeature('recurring_services') ? '🔒' : ''}</strong>
          <p>Tutoring, personal training, coaching, music lessons...</p>
        </div>
        <span className="svc-type-check">{value === 'recurring' ? '✓' : ''}</span>
      </button>
      <button
        type="button"
        className={`service-type-card ${value === 'class' ? 'selected' : ''}`}
        onClick={() => onChange('serviceType', 'class')}
      >
        <span className="svc-type-icon">📚</span>
        <div>
          <strong>Class / Workshop</strong>
          <p>Cooking classes, fitness groups, art workshops, tech bootcamps...</p>
        </div>
        <span className="svc-type-check">{value === 'class' ? '✓' : ''}</span>
      </button>
    </div>
  </div>
);

export default ServiceTypeSelector;
