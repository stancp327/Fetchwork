import React from 'react';
import { getCategoryLabel } from '../../../utils/categories';
import { SESSION_DURATIONS, BILLING_CYCLES } from './constants';

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

export default StepReview;
