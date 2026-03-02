import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeatures } from '../../hooks/useFeatures';
import { apiRequest } from '../../utils/api';
import CategoryCombobox from '../common/CategoryCombobox';
import { getCategoryLabel } from '../../utils/categories';
import UpgradePrompt from '../Billing/UpgradePrompt';
import SEO from '../common/SEO';
import IntakeFormEditor from './IntakeFormEditor';
import './CreateService.css';

const STEPS = ['Details', 'Pricing', 'Media', 'Requirements', 'Review'];

const SESSION_DURATIONS = [
  { value: 30,  label: '30 minutes' },
  { value: 45,  label: '45 minutes' },
  { value: 60,  label: '1 hour' },
  { value: 90,  label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

const BILLING_CYCLES = [
  { value: 'per_session', label: 'Per Session' },
  { value: 'weekly',      label: 'Weekly Package' },
  { value: 'monthly',     label: 'Monthly Package' },
];

const LOCATION_TYPES = [
  { value: 'online',    label: '💻 Online Only' },
  { value: 'in_person', label: '📍 In-Person Only' },
  { value: 'both',      label: '🔀 Online & In-Person' },
];

// ── Stepper ─────────────────────────────────────────────────────
const Stepper = ({ steps, current, onStepClick }) => (
  <div className="wizard-stepper">
    {steps.map((step, i) => (
      <button
        key={step}
        className={`step ${i === current ? 'active' : ''} ${i < current ? 'done' : ''}`}
        onClick={() => i <= current && onStepClick(i)}
        disabled={i > current}
      >
        <span className="step-num">{i < current ? '✓' : i + 1}</span>
        <span className="step-label">{step}</span>
      </button>
    ))}
  </div>
);

// ── Live Preview ────────────────────────────────────────────────
const LivePreview = ({ data }) => {
  const isRecurring = data.serviceType === 'recurring';
  const billingLabel = BILLING_CYCLES.find(b => b.value === data.recurringBillingCycle)?.label || 'Per Session';
  const durationLabel = SESSION_DURATIONS.find(d => d.value === Number(data.recurringSessionDuration))?.label || '1 hour';

  return (
    <div className="wizard-preview">
      <h3 className="preview-heading">Live Preview</h3>
      <div className="preview-card">
        <div className="preview-card-img">
          {data.imagePreview ? (
            <img src={data.imagePreview} alt="" />
          ) : (
            <div className="preview-placeholder">📷 Service Image</div>
          )}
        </div>
        <div className="preview-card-body">
          <div className="preview-badges">
            {isRecurring && <span className="preview-badge-recurring">🔄 Recurring</span>}
            {data.category && <span className="preview-tag">{getCategoryLabel(data.category)}</span>}
          </div>
          <h4>{data.title || 'Your Service Title'}</h4>
          <p className="preview-desc">
            {data.description?.substring(0, 120) || 'Service description will appear here...'}
            {data.description?.length > 120 ? '...' : ''}
          </p>
        </div>
        {data.basicPrice && (
          <div className="preview-card-footer">
            <span className="preview-price">
              {isRecurring
                ? `$${data.basicPrice} / ${data.recurringBillingCycle === 'per_session' ? 'session' : data.recurringBillingCycle === 'weekly' ? 'week' : 'month'}`
                : `Starting at $${data.basicPrice}`}
            </span>
            {isRecurring ? (
              <span className="preview-delivery">⏱ {durationLabel}</span>
            ) : (
              data.basicDeliveryTime && <span className="preview-delivery">📦 {data.basicDeliveryTime} day{data.basicDeliveryTime > 1 ? 's' : ''}</span>
            )}
          </div>
        )}
      </div>

      {/* Package or Session Summary */}
      {data.basicTitle && (
        <div className="preview-package">
          <h4>{isRecurring ? 'Session Details' : 'Basic Package'}</h4>
          <div className="preview-pkg-row"><span>Title:</span><span>{data.basicTitle}</span></div>
          {data.basicPrice && <div className="preview-pkg-row"><span>Price:</span><span>${data.basicPrice}{isRecurring ? ` / ${data.recurringBillingCycle === 'per_session' ? 'session' : data.recurringBillingCycle === 'weekly' ? 'wk' : 'mo'}` : ''}</span></div>}
          {isRecurring ? (
            <>
              <div className="preview-pkg-row"><span>Duration:</span><span>{durationLabel}</span></div>
              <div className="preview-pkg-row"><span>Billing:</span><span>{billingLabel}</span></div>
              {data.recurringLocationType && <div className="preview-pkg-row"><span>Format:</span><span>{LOCATION_TYPES.find(l => l.value === data.recurringLocationType)?.label || '—'}</span></div>}
              {data.recurringTrialEnabled && data.recurringTrialPrice && <div className="preview-pkg-row"><span>Trial Session:</span><span>${data.recurringTrialPrice}</span></div>}
            </>
          ) : (
            <>
              {data.basicDeliveryTime && <div className="preview-pkg-row"><span>Delivery:</span><span>{data.basicDeliveryTime} days</span></div>}
              <div className="preview-pkg-row"><span>Revisions:</span><span>{data.basicRevisions || 0}</span></div>
            </>
          )}
        </div>
      )}

      {data.skills && (
        <div className="preview-skills">
          {data.skills.split(',').filter(Boolean).map((s, i) => (
            <span key={i} className="preview-skill-tag">{s.trim()}</span>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Service Type Selector ───────────────────────────────────────
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

// ── Step Components ─────────────────────────────────────────────
const StepDetails = ({ data, onChange, errors, hasFeature = () => true }) => (
  <div className="wizard-step-content">
    <h2>Service Details</h2>
    <p className="wizard-tip">💡 A clear, descriptive title helps clients find your service.</p>

    <ServiceTypeSelector value={data.serviceType} onChange={onChange} hasFeature={hasFeature} />

    <div className="wiz-field" style={{ marginTop: '1.5rem' }}>
      <label>Service Title *</label>
      <input
        type="text" value={data.title} maxLength={100}
        onChange={e => onChange('title', e.target.value)}
        placeholder={
          data.serviceType === 'recurring'
            ? 'e.g. 1-on-1 Math Tutoring Sessions (All Grades)'
            : 'e.g. I will create a professional website for your business'
        }
      />
      <div className="wiz-field-footer">
        <span className="wiz-error">{errors.title}</span>
        <span className="wiz-count">{data.title.length}/100</span>
      </div>
    </div>

    <div className="wiz-field">
      <label>Description *</label>
      <textarea
        value={data.description} maxLength={3000} rows={6}
        onChange={e => onChange('description', e.target.value)}
        placeholder={
          data.serviceType === 'recurring'
            ? 'Describe your sessions — your background, what you cover, your teaching style, expected outcomes...'
            : 'Describe your service in detail — what you offer, your process, what makes you different...'
        }
      />
      <div className="wiz-field-footer">
        <span className="wiz-error">{errors.description}</span>
        <span className="wiz-count">{data.description.length}/3000</span>
      </div>
    </div>

    <div className="wiz-row">
      <div className="wiz-field">
        <label>Category *</label>
        <CategoryCombobox
          value={data.category}
          onChange={v => onChange('category', v)}
          required
        />
        {errors.category && <span className="wiz-error">{errors.category}</span>}
      </div>
      <div className="wiz-field">
        <label>Subcategory</label>
        <input type="text" value={data.subcategory} onChange={e => onChange('subcategory', e.target.value)}
          placeholder={data.serviceType === 'recurring' ? 'e.g. SAT Prep, HIIT, Life Coaching' : 'e.g. React, WordPress'} />
      </div>
    </div>

    <div className="wiz-field">
      <label>Tags / Skills</label>
      <input type="text" value={data.skills} onChange={e => onChange('skills', e.target.value)}
        placeholder={data.serviceType === 'recurring' ? 'e.g. Algebra, Calculus, Test Prep (comma separated)' : 'React, Node.js, MongoDB (comma separated)'} />
    </div>
  </div>
);

// ── Recurring Session Settings ──────────────────────────────────
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

// ── Package Tier Form ───────────────────────────────────────────
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

// ── Bundle Editor ───────────────────────────────────────────────
const EMPTY_BUNDLE = { name: '', sessions: '', price: '', expiresInDays: '' };

const BundleEditor = ({ bundles, onChange }) => {
  const [draft, setDraft] = React.useState(EMPTY_BUNDLE);
  const [draftErr, setDraftErr] = React.useState({});

  const updateDraft = (k, v) => {
    setDraft(prev => ({ ...prev, [k]: v }));
    if (draftErr[k]) setDraftErr(prev => ({ ...prev, [k]: '' }));
  };

  const addBundle = () => {
    const e = {};
    if (!draft.name.trim())                             e.name     = 'Required';
    if (!draft.sessions || parseInt(draft.sessions) < 2) e.sessions = 'Min 2 sessions';
    if (!draft.price    || parseFloat(draft.price)   < 5) e.price    = 'Min $5';
    if (Object.keys(e).length) { setDraftErr(e); return; }
    onChange([...bundles, {
      name:          draft.name.trim(),
      sessions:      parseInt(draft.sessions),
      price:         parseFloat(draft.price),
      expiresInDays: draft.expiresInDays ? parseInt(draft.expiresInDays) : null,
      active:        true,
    }]);
    setDraft(EMPTY_BUNDLE);
    setDraftErr({});
  };

  const removeBundle = idx => onChange(bundles.filter((_, i) => i !== idx));

  return (
    <div className="bundle-editor">
      <h4>📦 Session Bundles <span className="pkg-add-hint">— optional prepaid packages (e.g. 3 sessions for $80)</span></h4>

      {bundles.length > 0 && (
        <div className="bundle-list">
          {bundles.map((b, i) => (
            <div key={i} className="bundle-chip">
              <span className="bundle-chip-name">{b.name}</span>
              <span className="bundle-chip-detail">{b.sessions} sessions · ${b.price}</span>
              {b.expiresInDays && <span className="bundle-chip-expiry">⏱ {b.expiresInDays}d</span>}
              <button type="button" className="bundle-chip-remove" onClick={() => removeBundle(i)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="bundle-draft">
        <div className="bundle-draft-row">
          <div className="wiz-field">
            <label>Bundle name</label>
            <input type="text" value={draft.name} onChange={e => updateDraft('name', e.target.value)}
              placeholder='e.g. "3-session pack"' />
            {draftErr.name && <span className="wiz-error">{draftErr.name}</span>}
          </div>
          <div className="wiz-field" style={{ maxWidth: 100 }}>
            <label># Sessions</label>
            <input type="number" min="2" max="100" value={draft.sessions}
              onChange={e => updateDraft('sessions', e.target.value)} placeholder="3" />
            {draftErr.sessions && <span className="wiz-error">{draftErr.sessions}</span>}
          </div>
          <div className="wiz-field" style={{ maxWidth: 110 }}>
            <label>Total price</label>
            <input type="number" min="5" step="0.01" value={draft.price}
              onChange={e => updateDraft('price', e.target.value)} placeholder="$80" />
            {draftErr.price && <span className="wiz-error">{draftErr.price}</span>}
          </div>
          <div className="wiz-field" style={{ maxWidth: 120 }}>
            <label>Expires (days)</label>
            <input type="number" min="7" value={draft.expiresInDays}
              onChange={e => updateDraft('expiresInDays', e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <button type="button" className="pkg-add-btn" style={{ marginTop: 8 }} onClick={addBundle}>
          + Add Bundle
        </button>
      </div>
    </div>
  );
};

// ── Fees-Included Toggle ─────────────────────────────────────────
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

const StepPricing = ({ data, onChange, errors, hasFeature = () => true }) => {
  const canRecurring = hasFeature('recurring_services');
  const canBundles   = hasFeature('bundle_creation');
  const isRecurring  = data.serviceType === 'recurring';

  return (
    <div className="wizard-step-content">
      <h2>Pricing &amp; Packages</h2>
      <p className="wizard-tip">
        {isRecurring
          ? '💡 Set your session or package rate. You can offer Basic, Standard, and Premium tiers — e.g. single session, 4-pack, 8-pack.'
          : '💡 The Basic package is required. Standard and Premium are optional but help you earn more by offering tiers.'}
      </p>

      {isRecurring && <RecurringSessionSettings data={data} onChange={onChange} errors={errors} />}

      {data.serviceType === 'class' && (
        <div className="wiz-section">
          <h3>📚 Class Details</h3>
          <div className="wiz-grid-2">
            <div className="wiz-field">
              <label>Location</label>
              <select value={data.classLocationType || 'both'} onChange={e => onChange('classLocationType', e.target.value)}>
                <option value="in_person">In Person</option>
                <option value="online">Online</option>
                <option value="both">Both (Hybrid)</option>
              </select>
            </div>
            <div className="wiz-field">
              <label>Max Students</label>
              <input type="number" min="1" max="100" value={data.classMaxStudents || 10} onChange={e => onChange('classMaxStudents', parseInt(e.target.value) || 10)} />
            </div>
            <div className="wiz-field">
              <label>Skill Level</label>
              <select value={data.classSkillLevel || 'all_levels'} onChange={e => onChange('classSkillLevel', e.target.value)}>
                <option value="all_levels">All Levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div className="wiz-field">
              <label>Age Group</label>
              <select value={data.classAgeGroup || 'all_ages'} onChange={e => onChange('classAgeGroup', e.target.value)}>
                <option value="all_ages">All Ages</option>
                <option value="kids">Kids</option>
                <option value="teens">Teens</option>
                <option value="adults">Adults</option>
              </select>
            </div>
          </div>
          <div className="wiz-field">
            <label className="wiz-checkbox">
              <input type="checkbox" checked={data.classMaterialsIncluded || false} onChange={e => onChange('classMaterialsIncluded', e.target.checked)} />
              Materials included in price
            </label>
          </div>
          {data.classMaterialsIncluded && (
            <div className="wiz-field">
              <label>What's included?</label>
              <input type="text" value={data.classMaterialsNote || ''} onChange={e => onChange('classMaterialsNote', e.target.value)} placeholder="e.g. All ingredients provided, art supplies included" />
            </div>
          )}
          <div className="wiz-field">
            <label className="wiz-checkbox">
              <input type="checkbox" checked={data.classRecurring || false} onChange={e => onChange('classRecurring', e.target.checked)} />
              This is a recurring class series
            </label>
          </div>
          {data.classRecurring && (
            <div className="wiz-field">
              <label>Total sessions in series</label>
              <input type="number" min="2" max="52" value={data.classTotalSessions || 4} onChange={e => onChange('classTotalSessions', parseInt(e.target.value) || 4)} />
            </div>
          )}
        </div>
      )}

      <PackageTierForm
        prefix="basic" label={isRecurring ? 'Basic Tier' : 'Basic Package'} badge="Required"
        data={data} onChange={onChange} errors={errors} required isRecurring={isRecurring}
      />

      {/* Standard toggle */}
      {!data.standardEnabled ? (
        <button type="button" className="pkg-add-btn" onClick={() => onChange('standardEnabled', true)}>
          ✨ Add {isRecurring ? 'Standard Tier' : 'Standard Package'} <span className="pkg-add-hint">— {isRecurring ? 'e.g. a multi-session pack at a discount' : 'offer more features at a higher price'}</span>
        </button>
      ) : (
        <div style={{ position: 'relative' }}>
          <PackageTierForm
            prefix="standard" label={isRecurring ? 'Standard Tier' : 'Standard Package'} badge="Optional"
            data={data} onChange={onChange} errors={errors} isRecurring={isRecurring}
          />
          <button type="button" className="pkg-remove-btn" onClick={() => onChange('standardEnabled', false)}>Remove</button>
        </div>
      )}

      {/* Premium toggle — only show if standard is enabled */}
      {data.standardEnabled && (!data.premiumEnabled ? (
        <button type="button" className="pkg-add-btn" onClick={() => onChange('premiumEnabled', true)}>
          🌟 Add {isRecurring ? 'Premium Tier' : 'Premium Package'} <span className="pkg-add-hint">— {isRecurring ? 'your best value bundle' : 'your best offer, highest price'}</span>
        </button>
      ) : (
        <div style={{ position: 'relative' }}>
          <PackageTierForm
            prefix="premium" label={isRecurring ? 'Premium Tier' : 'Premium Package'} badge="Optional"
            data={data} onChange={onChange} errors={errors} isRecurring={isRecurring}
          />
          <button type="button" className="pkg-remove-btn" onClick={() => onChange('premiumEnabled', false)}>Remove</button>
        </div>
      ))}

      {/* Session bundles — Plus/Pro only */}
      {canBundles ? (
        <BundleEditor bundles={data.bundles} onChange={v => onChange('bundles', v)} />
      ) : (
        <div className="feature-gate-notice">
          📦 <strong>Session Bundles</strong> — available on Plus and Pro plans.{' '}
          <a href="/pricing">Upgrade to unlock</a>
        </div>
      )}

      {/* Fees-included toggle */}
      <FeesIncludedToggle value={data.feesIncluded} onChange={onChange} />

      {/* Intake form editor */}
      {hasFeature('intake_forms') ? (
        <IntakeFormEditor
          fields={data.intakeFields || []}
          enabled={data.intakeEnabled || false}
          onToggle={v => onChange('intakeEnabled', v)}
          onChange={v => onChange('intakeFields', v)}
        />
      ) : (
        <div className="feature-gate-notice">
          📋 <strong>Client Intake Forms</strong> — ask custom questions when clients order.{' '}
          <a href="/pricing">Upgrade to unlock</a>
        </div>
      )}

      {/* Deposit editor */}
      {hasFeature('deposits') ? (
        <div className="pro-feature-block">
          <div className="pfb-header">
            <div><h3 className="pfb-title">💰 Require Deposit</h3><p className="pfb-desc">Collect partial payment upfront</p></div>
            <label className="ife-toggle">
              <input type="checkbox" checked={data.depositEnabled || false} onChange={e => onChange('depositEnabled', e.target.checked)} />
              <span className="ife-toggle-slider" />
            </label>
          </div>
          {data.depositEnabled && (
            <div className="pfb-controls">
              <div className="pfb-row">
                <select value={data.depositType || 'percentage'} onChange={e => onChange('depositType', e.target.value)} className="pfb-select">
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
                <div className="pfb-input-wrap">
                  <span className="pfb-input-prefix">{(data.depositType || 'percentage') === 'percentage' ? '%' : '$'}</span>
                  <input type="number" value={data.depositAmount || 25} onChange={e => onChange('depositAmount', Number(e.target.value))} className="pfb-input" min={1} />
                </div>
              </div>
              <label className="pfb-check"><input type="checkbox" checked={data.depositRefundable !== false} onChange={e => onChange('depositRefundable', e.target.checked)} /> Refundable if cancelled</label>
            </div>
          )}
        </div>
      ) : (
        <div className="feature-gate-notice">💰 <strong>Deposits</strong> — require partial upfront payment. <a href="/pricing">Pro plan</a></div>
      )}

      {/* Travel fee editor */}
      {hasFeature('travel_fees') ? (
        <div className="pro-feature-block">
          <div className="pfb-header">
            <div><h3 className="pfb-title">🚗 Travel Fee</h3><p className="pfb-desc">Charge extra for in-person travel</p></div>
            <label className="ife-toggle">
              <input type="checkbox" checked={data.travelFeeEnabled || false} onChange={e => onChange('travelFeeEnabled', e.target.checked)} />
              <span className="ife-toggle-slider" />
            </label>
          </div>
          {data.travelFeeEnabled && (
            <div className="pfb-controls">
              <div className="pfb-row">
                <select value={data.travelFeeType || 'flat'} onChange={e => onChange('travelFeeType', e.target.value)} className="pfb-select">
                  <option value="flat">Flat Fee</option>
                  <option value="per_mile">Per Mile</option>
                </select>
                <div className="pfb-input-wrap">
                  <span className="pfb-input-prefix">$</span>
                  <input type="number" value={data.travelFeeAmount || 0} onChange={e => onChange('travelFeeAmount', Number(e.target.value))} className="pfb-input" min={0} step={0.5} />
                </div>
              </div>
              <div className="pfb-row">
                <label className="pfb-label-sm">Free within</label>
                <div className="pfb-input-wrap">
                  <input type="number" value={data.travelFreeMiles || 0} onChange={e => onChange('travelFreeMiles', Number(e.target.value))} className="pfb-input" min={0} />
                  <span className="pfb-input-suffix">miles</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="feature-gate-notice">🚗 <strong>Travel Fee</strong> — charge for in-person travel. <a href="/pricing">Pro plan</a></div>
      )}

      {/* Capacity controls */}
      {hasFeature('capacity_controls') ? (
        <div className="pro-feature-block">
          <div className="pfb-header">
            <div><h3 className="pfb-title">📊 Capacity Controls</h3><p className="pfb-desc">Limit how many clients you take</p></div>
            <label className="ife-toggle">
              <input type="checkbox" checked={data.capacityEnabled || false} onChange={e => onChange('capacityEnabled', e.target.checked)} />
              <span className="ife-toggle-slider" />
            </label>
          </div>
          {data.capacityEnabled && (
            <div className="pfb-controls">
              <div className="pfb-row">
                <label className="pfb-label-sm">Max per day</label>
                <input type="number" value={data.capacityMaxDay || ''} onChange={e => onChange('capacityMaxDay', e.target.value ? Number(e.target.value) : null)} className="pfb-input" min={1} placeholder="∞" />
              </div>
              <div className="pfb-row">
                <label className="pfb-label-sm">Max per week</label>
                <input type="number" value={data.capacityMaxWeek || ''} onChange={e => onChange('capacityMaxWeek', e.target.value ? Number(e.target.value) : null)} className="pfb-input" min={1} placeholder="∞" />
              </div>
              <div className="pfb-row">
                <label className="pfb-label-sm">Max concurrent</label>
                <input type="number" value={data.capacityMaxConcurrent || ''} onChange={e => onChange('capacityMaxConcurrent', e.target.value ? Number(e.target.value) : null)} className="pfb-input" min={1} placeholder="∞" />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="feature-gate-notice">📊 <strong>Capacity Controls</strong> — limit clients per day/week. <a href="/pricing">Upgrade to unlock</a></div>
      )}
    </div>
  );
};

const StepMedia = ({ data, onChange }) => (
  <div className="wizard-step-content">
    <h2>Media</h2>
    <p className="wizard-tip">💡 Services with images get 3x more views.</p>
    <div className="media-upload-area">
      <div className="media-dropzone">
        <span className="media-icon">📁</span>
        <p>Drag &amp; drop images here or click to browse</p>
        <p className="media-hint">PNG, JPG, GIF up to 5MB. Recommended: 1280x720px</p>
        <input
          type="file" accept="image/*" className="media-file-input"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = () => onChange('imagePreview', reader.result);
              reader.readAsDataURL(file);
            }
          }}
        />
      </div>
      {data.imagePreview && (
        <div className="media-preview">
          <img src={data.imagePreview} alt="Preview" />
          <button className="media-remove" onClick={() => onChange('imagePreview', '')}>×</button>
        </div>
      )}
    </div>
  </div>
);

const StepRequirements = ({ data, onChange }) => {
  const isRecurring = data.serviceType === 'recurring';
  return (
    <div className="wizard-step-content">
      <h2>{isRecurring ? 'Before We Start' : 'Requirements'}</h2>
      <p className="wizard-tip">
        {isRecurring
          ? '💡 Let clients know what to prepare before their first session — any materials, goals, or info you need.'
          : '💡 Clear requirements help set expectations and avoid revisions.'}
      </p>
      <div className="wiz-field">
        <label>{isRecurring ? 'What should clients bring or prepare?' : 'What do you need from the buyer?'}</label>
        <textarea
          rows={5} value={data.requirements} maxLength={1000}
          onChange={e => onChange('requirements', e.target.value)}
          placeholder={
            isRecurring
              ? 'e.g. Current grade level, recent test scores, specific topics to focus on, any learning goals...'
              : 'e.g. Brand guidelines, logo files, content text, reference websites...'
          }
        />
        <div className="wiz-field-footer">
          <span />
          <span className="wiz-count">{data.requirements.length}/1000</span>
        </div>
      </div>
    </div>
  );
};

const StepReview = ({ data }) => {
  const isRecurring = data.serviceType === 'recurring';
  const billingLabel = BILLING_CYCLES.find(b => b.value === data.recurringBillingCycle)?.label || 'Per Session';
  const durationLabel = SESSION_DURATIONS.find(d => d.value === Number(data.recurringSessionDuration))?.label || '1 hour';
  const locationLabel = LOCATION_TYPES.find(l => l.value === data.recurringLocationType)?.label || '—';

  return (
    <div className="wizard-step-content">
      <h2>Review &amp; Publish</h2>
      <p className="wizard-tip">Double-check everything before publishing. You can edit anytime after.</p>

      <div className="review-sections">
        <div className="review-section">
          <h4>Details</h4>
          <div className="review-row"><span>Type:</span><span>{isRecurring ? '🔄 Recurring Sessions' : '📦 One-Time Delivery'}</span></div>
          <div className="review-row"><span>Title:</span><span>{data.title || '—'}</span></div>
          <div className="review-row"><span>Category:</span><span>{data.category ? getCategoryLabel(data.category) : '—'}</span></div>
          <div className="review-row"><span>Description:</span><span>{data.description?.substring(0, 200) || '—'}{data.description?.length > 200 ? '...' : ''}</span></div>
        </div>

        {isRecurring && (
          <div className="review-section">
            <h4>Session Settings</h4>
            <div className="review-row"><span>Duration:</span><span>{durationLabel}</span></div>
            <div className="review-row"><span>Billing:</span><span>{billingLabel}</span></div>
            <div className="review-row"><span>Format:</span><span>{locationLabel}</span></div>
            {data.recurringBillingCycle !== 'per_session' && (
              <div className="review-row"><span>Sessions per {data.recurringBillingCycle === 'weekly' ? 'week' : 'month'}:</span><span>{data.recurringSessionsPerCycle || '—'}</span></div>
            )}
            {data.recurringTrialEnabled && (
              <div className="review-row"><span>Trial Session:</span><span>${data.recurringTrialPrice || '—'}</span></div>
            )}
          </div>
        )}

        <div className="review-section">
          <h4>Basic {isRecurring ? 'Tier' : 'Package'}</h4>
          <div className="review-row"><span>Title:</span><span>{data.basicTitle || '—'}</span></div>
          <div className="review-row"><span>Price:</span><span>{data.basicPrice ? `$${data.basicPrice}` : '—'}</span></div>
          {!isRecurring && <div className="review-row"><span>Delivery:</span><span>{data.basicDeliveryTime ? `${data.basicDeliveryTime} days` : '—'}</span></div>}
          {!isRecurring && <div className="review-row"><span>Revisions:</span><span>{data.basicRevisions}</span></div>}
          {isRecurring && data.recurringBillingCycle !== 'per_session' && data.basicSessionsIncluded && (
            <div className="review-row"><span>Sessions included:</span><span>{data.basicSessionsIncluded}</span></div>
          )}
        </div>

        {data.standardEnabled && data.standardTitle && (
          <div className="review-section">
            <h4>Standard {isRecurring ? 'Tier' : 'Package'}</h4>
            <div className="review-row"><span>Title:</span><span>{data.standardTitle}</span></div>
            <div className="review-row"><span>Price:</span><span>{data.standardPrice ? `$${data.standardPrice}` : '—'}</span></div>
            {!isRecurring && <div className="review-row"><span>Delivery:</span><span>{data.standardDeliveryTime ? `${data.standardDeliveryTime} days` : '—'}</span></div>}
            {!isRecurring && <div className="review-row"><span>Revisions:</span><span>{data.standardRevisions}</span></div>}
          </div>
        )}
        {data.premiumEnabled && data.premiumTitle && (
          <div className="review-section">
            <h4>Premium {isRecurring ? 'Tier' : 'Package'}</h4>
            <div className="review-row"><span>Title:</span><span>{data.premiumTitle}</span></div>
            <div className="review-row"><span>Price:</span><span>{data.premiumPrice ? `$${data.premiumPrice}` : '—'}</span></div>
            {!isRecurring && <div className="review-row"><span>Delivery:</span><span>{data.premiumDeliveryTime ? `${data.premiumDeliveryTime} days` : '—'}</span></div>}
            {!isRecurring && <div className="review-row"><span>Revisions:</span><span>{data.premiumRevisions}</span></div>}
          </div>
        )}

        {data.requirements && (
          <div className="review-section">
            <h4>{isRecurring ? 'Before We Start' : 'Requirements'}</h4>
            <p style={{ color: '#4b5563', fontSize: '0.9rem' }}>{data.requirements}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Wizard ─────────────────────────────────────────────────
const CreateService = () => {
  const navigate = useNavigate();
  const { hasFeature } = useFeatures();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  const [showPreview, setShowPreview] = useState(true);
  const [upgradeLimit, setUpgradeLimit] = useState(null);
  const [data, setData] = useState({
    // type
    serviceType: 'one_time',
    // details
    title: '', description: '', category: '', subcategory: '', skills: '',
    requirements: '', imagePreview: '',
    // recurring settings
    recurringSessionDuration: 60,
    recurringBillingCycle: 'per_session',
    recurringSessionsPerCycle: 1,
    recurringLocationType: 'online',
    recurringTrialEnabled: false,
    recurringTrialPrice: '',
    // class settings
    classLocationType: 'both',
    classMaxStudents: 10,
    classSkillLevel: 'all_levels',
    classAgeGroup: 'all_ages',
    classMaterialsIncluded: false,
    classMaterialsNote: '',
    classRecurring: false,
    classTotalSessions: 4,
    // one-time packages
    basicTitle: '', basicDescription: '', basicPrice: '', basicDeliveryTime: '', basicRevisions: 1,
    basicSessionsIncluded: '',
    standardEnabled: false,
    standardTitle: '', standardDescription: '', standardPrice: '', standardDeliveryTime: '', standardRevisions: 2,
    standardSessionsIncluded: '',
    premiumEnabled: false,
    premiumTitle: '',  premiumDescription: '',  premiumPrice: '',  premiumDeliveryTime: '',  premiumRevisions: 3,
    premiumSessionsIncluded: '',
    // bundles + fees
    bundles: [],
    feesIncluded: false,
    // intake form
    intakeEnabled: false,
    intakeFields: [],
    // deposit
    depositEnabled: false,
    depositType: 'percentage',
    depositAmount: 25,
    depositRefundable: true,
    // travel fee
    travelFeeEnabled: false,
    travelFeeType: 'flat',
    travelFeeAmount: 0,
    travelFreeMiles: 0,
    // capacity
    capacityEnabled: false,
    capacityMaxDay: null,
    capacityMaxWeek: null,
    capacityMaxConcurrent: null,
  });

  const update = (key, value) => {
    setData(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const isRecurring = data.serviceType === 'recurring';

  const validateStep = () => {
    const e = {};
    if (step === 0) {
      if (!data.title.trim()) e.title = 'Required';
      if (!data.description.trim()) e.description = 'Required';
      if (!data.category) e.category = 'Required';
    }
    if (step === 1) {
      if (!data.basicTitle.trim()) e.basicTitle = 'Required';
      if (!data.basicDescription.trim()) e.basicDescription = 'Required';
      if (isRecurring) {
        if (!data.basicPrice || parseFloat(data.basicPrice) < 1) e.basicPrice = 'Min $1';
        if (data.recurringTrialEnabled && (!data.recurringTrialPrice || parseFloat(data.recurringTrialPrice) < 1)) {
          e.recurringTrialPrice = 'Enter trial price';
        }
      } else {
        if (!data.basicPrice || parseFloat(data.basicPrice) < 5) e.basicPrice = 'Min $5';
        if (!data.basicDeliveryTime || parseInt(data.basicDeliveryTime) < 1) e.basicDeliveryTime = 'Min 1 day';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep(prev => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => setStep(prev => Math.max(prev - 1, 0));

  const handlePublish = async () => {
    setLoading(true);
    setError(null);
    try {
      const buildPkg = (prefix, required) => {
        const title = data[`${prefix}Title`]?.trim();
        const desc  = data[`${prefix}Description`]?.trim();
        const price = parseFloat(data[`${prefix}Price`]);
        if (!required && (!title || isNaN(price))) return undefined;
        return {
          title,
          description: desc,
          price,
          deliveryTime: isRecurring ? 1 : parseInt(data[`${prefix}DeliveryTime`]) || 1,
          revisions: isRecurring ? 0 : parseInt(data[`${prefix}Revisions`]) || 0,
          ...(isRecurring && data.recurringBillingCycle !== 'per_session'
            ? { sessionsIncluded: parseInt(data[`${prefix}SessionsIncluded`]) || undefined }
            : {}),
        };
      };

      const serviceData = {
        title: data.title.trim(),
        description: data.description.trim(),
        category: data.category,
        subcategory: data.subcategory.trim() || undefined,
        skills: data.skills.split(',').map(s => s.trim()).filter(Boolean),
        requirements: data.requirements.trim(),
        serviceType: data.serviceType,
        ...(isRecurring ? {
          recurring: {
            sessionDuration:    Number(data.recurringSessionDuration),
            billingCycle:       data.recurringBillingCycle,
            sessionsPerCycle:   data.recurringBillingCycle !== 'per_session' ? parseInt(data.recurringSessionsPerCycle) || 1 : undefined,
            locationType:       data.recurringLocationType,
            trialEnabled:       data.recurringTrialEnabled,
            trialPrice:         data.recurringTrialEnabled ? parseFloat(data.recurringTrialPrice) : undefined,
          }
        } : {}),
        ...(data.serviceType === 'class' ? {
          classDetails: {
            locationType:      data.classLocationType,
            maxStudents:       parseInt(data.classMaxStudents) || 10,
            skillLevel:        data.classSkillLevel,
            ageGroup:          data.classAgeGroup,
            materialsIncluded: data.classMaterialsIncluded,
            materialsNote:     data.classMaterialsNote || undefined,
            recurring:         data.classRecurring,
            totalSessions:     data.classRecurring ? parseInt(data.classTotalSessions) || 4 : undefined,
          }
        } : {}),
        pricing: {
          basic: buildPkg('basic', true),
          ...(data.standardEnabled ? { standard: buildPkg('standard', false) } : {}),
          ...(data.premiumEnabled  ? { premium:  buildPkg('premium', false)  } : {}),
        },
      };

      serviceData.feesIncluded = data.feesIncluded;
      if (data.bundles?.length > 0) serviceData.bundles = data.bundles;
      if (data.intakeEnabled && data.intakeFields?.length > 0) {
        serviceData.intakeForm = { enabled: true, fields: data.intakeFields };
      }
      if (data.depositEnabled) {
        serviceData.deposit = { enabled: true, type: data.depositType, amount: data.depositAmount, refundable: data.depositRefundable };
      }
      if (data.travelFeeEnabled) {
        serviceData.travelFee = { enabled: true, type: data.travelFeeType, amount: data.travelFeeAmount, freeWithinMiles: data.travelFreeMiles };
      }
      if (data.capacityEnabled) {
        serviceData.capacity = { enabled: true, maxPerDay: data.capacityMaxDay, maxPerWeek: data.capacityMaxWeek, maxConcurrent: data.capacityMaxConcurrent };
      }

      await apiRequest('/api/services', { method: 'POST', body: JSON.stringify(serviceData) });
      navigate('/browse-services');
    } catch (err) {
      if (err.status === 401 || err.message?.includes('401') || err.message?.includes('session')) {
        navigate('/login');
      } else if (err.data?.reason === 'service_limit') {
        setUpgradeLimit({ reason: 'service_limit', limit: err.data.limit });
      } else {
        setError(err.message || 'Failed to create service');
      }
    } finally {
      setLoading(false);
    }
  };

  const stepContent = [
    <StepDetails data={data} onChange={update} errors={errors} hasFeature={hasFeature} />,
    <StepPricing data={data} onChange={update} errors={errors} hasFeature={hasFeature} />,
    <StepMedia data={data} onChange={update} />,
    <StepRequirements data={data} onChange={update} />,
    <StepReview data={data} />,
  ];

  return (
    <div className="wizard-container">
      <SEO title="Create Service" path="/services/create" noIndex={true} />
      {/* Header */}
      <div className="wizard-header">
        <div>
          <h1>Create a Service</h1>
          <p>Offer your skills to clients with a professional listing</p>
        </div>
        <button
          className={`preview-toggle ${showPreview ? 'active' : ''}`}
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? '👁️ Hide Preview' : '👁️ Show Preview'}
        </button>
      </div>

      {/* Stepper */}
      <Stepper steps={STEPS} current={step} onStepClick={setStep} />

      {/* Content */}
      <div className={`wizard-body ${showPreview ? 'with-preview' : ''}`}>
        <div className="wizard-form-panel">
          {stepContent[step]}
          {error && <div className="wizard-error">⚠️ {error}</div>}
          {upgradeLimit && (
            <UpgradePrompt
              inline
              reason={upgradeLimit.reason}
              limit={upgradeLimit.limit}
              onDismiss={() => setUpgradeLimit(null)}
            />
          )}
        </div>

        {showPreview && (
          <div className="wizard-preview-panel">
            <LivePreview data={data} />
          </div>
        )}
      </div>

      {/* Sticky Actions */}
      <div className="wizard-actions">
        <button className="wiz-btn secondary" onClick={() => navigate('/dashboard')}>Cancel</button>
        <div className="wizard-actions-right">
          {step > 0 && <button className="wiz-btn secondary" onClick={handleBack}>← Back</button>}
          {step < STEPS.length - 1 ? (
            <button className="wiz-btn primary" onClick={handleNext}>Continue →</button>
          ) : (
            <button className="wiz-btn publish" onClick={handlePublish} disabled={loading}>
              {loading ? 'Publishing...' : '🚀 Publish Service'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateService;
