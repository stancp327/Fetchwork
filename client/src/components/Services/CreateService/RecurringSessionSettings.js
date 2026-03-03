import React from 'react';
import { SESSION_DURATIONS, BILLING_CYCLES, LOCATION_TYPES } from './constants';

const RecurringSessionSettings = ({ data, onChange, errors }) => (
  <div className="recurring-settings-card">
    <div className="recurring-settings-header">
      <span>🔄</span>
      <div>
        <h3>Session Settings</h3>
        <p>Define how your recurring sessions work</p>
      </div>
    </div>

    <div className="wiz-row">
      <div className="wiz-field">
        <label>Session Duration *</label>
        <select value={data.recurringSessionDuration} onChange={e => onChange('recurringSessionDuration', Number(e.target.value))}>
          {SESSION_DURATIONS.map(d => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        {errors.recurringSessionDuration && <span className="wiz-error">{errors.recurringSessionDuration}</span>}
      </div>
      <div className="wiz-field">
        <label>Billing Cycle *</label>
        <select value={data.recurringBillingCycle} onChange={e => onChange('recurringBillingCycle', e.target.value)}>
          {BILLING_CYCLES.map(b => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
      </div>
    </div>

    <div className="wiz-row">
      <div className="wiz-field">
        <label>Format *</label>
        <select value={data.recurringLocationType} onChange={e => onChange('recurringLocationType', e.target.value)}>
          {LOCATION_TYPES.map(l => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>
      {data.recurringBillingCycle !== 'per_session' && (
        <div className="wiz-field">
          <label>Sessions per {data.recurringBillingCycle === 'weekly' ? 'Week' : 'Month'}</label>
          <input
            type="number" min="1" max="30"
            value={data.recurringSessionsPerCycle}
            onChange={e => onChange('recurringSessionsPerCycle', e.target.value)}
            placeholder="e.g. 3"
          />
        </div>
      )}
    </div>

    {/* Trial session toggle */}
    <div className="trial-session-row">
      <div className="trial-toggle-wrapper">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={data.recurringTrialEnabled}
            onChange={e => onChange('recurringTrialEnabled', e.target.checked)}
          />
          <span className="toggle-slider" />
        </label>
        <div>
          <strong>Offer trial session</strong>
          <p>Discounted first session to attract new clients</p>
        </div>
      </div>
      {data.recurringTrialEnabled && (
        <div className="wiz-field trial-price-field">
          <label>Trial Price ($) *</label>
          <input
            type="number" min="1" step="0.01"
            value={data.recurringTrialPrice}
            onChange={e => onChange('recurringTrialPrice', e.target.value)}
            placeholder="e.g. 25"
          />
          {errors.recurringTrialPrice && <span className="wiz-error">{errors.recurringTrialPrice}</span>}
        </div>
      )}
    </div>
  </div>
);

export default RecurringSessionSettings;
