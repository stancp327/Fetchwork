import React from 'react';
import { BILLING_CYCLES, SESSION_DURATIONS } from './constants';

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

export default LivePreview;
