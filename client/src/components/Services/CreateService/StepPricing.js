import React from 'react';
import RecurringSessionSettings from './RecurringSessionSettings';
import PackageTierForm from './PackageTierForm';
import BundleEditor from './BundleEditor';
import FeesIncludedToggle from './FeesIncludedToggle';
import IntakeFormEditor from '../IntakeFormEditor';

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

export default StepPricing;
