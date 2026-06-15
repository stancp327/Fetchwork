import React from 'react';
import { getCategoryLabel } from '../../../utils/categories';
import { SESSION_DURATIONS, BILLING_CYCLES, LOCATION_TYPES } from './constants';

const getPricingMode = (scheduleType) => {
  switch (scheduleType) {
    case 'DYNAMIC_PRIVATE':  return 'private_session';
    case 'FIXED_RECURRING':  return 'class_or_recurring';
    case 'FIXED_ONE_TIME':   return 'event_ticket';
    case 'REQUEST_BASED':    return 'quote_based';
    default:                 return 'deliverable';
  }
};

const TYPE_LABELS = {
  deliverable:        '📦 One-Time Delivery',
  private_session:    '📅 Bookable Sessions',
  class_or_recurring: '🔁 Recurring Class or Group',
  event_ticket:       '🎫 One-Time Event',
  quote_based:        '💬 Custom / Request-Based',
};

const PRICE_LABEL = {
  deliverable:        'Price',
  private_session:    'Session Rate',
  class_or_recurring: 'Drop-in Rate',
  event_ticket:       'Ticket Price',
  quote_based:        'Starting Price',
};

const TIER_LABELS = {
  deliverable:        { basic: 'Basic Package',  standard: 'Standard Package', premium: 'Premium Package' },
  private_session:    { basic: 'Single Session', standard: 'Session Pack',     premium: 'Session Pack' },
  class_or_recurring: { basic: 'Drop-in Rate' },
  event_ticket:       { basic: 'General Admission' },
  quote_based:        { basic: 'Starting Price' },
};

const StepReview = ({ data }) => {
  const pricingMode = getPricingMode(data.scheduleType);
  const isDeliverable = pricingMode === 'deliverable';
  const isMultiTier = pricingMode === 'deliverable' || pricingMode === 'private_session';
  const labels = TIER_LABELS[pricingMode] || TIER_LABELS.deliverable;

  const billingLabel = BILLING_CYCLES.find(b => b.value === data.recurringBillingCycle)?.label || 'Per Session';
  const durationLabel = SESSION_DURATIONS.find(d => d.value === Number(data.recurringSessionDuration))?.label || '1 hour';
  const locationLabel = LOCATION_TYPES.find(l => l.value === data.recurringLocationType)?.label || '—';

  const formatPrice = (price, mode = pricingMode) => {
    if (mode === 'quote_based') {
      return price > 0 ? `$${price}` : 'Contact for pricing';
    }
    if (!price && price !== 0) return '—';
    const suffix = (mode === 'private_session' || mode === 'class_or_recurring') ? '/session' : '';
    return `$${price}${suffix}`;
  };

  const capacitySummary = () => {
    if (pricingMode === 'private_session') {
      return data.capacityType === 'GROUP'
        ? `Format: Group (up to ${data.maxCapacity || '?'})`
        : 'Format: Individual';
    }
    if (pricingMode === 'class_or_recurring') {
      return `Capacity: ${data.maxCapacity || data.bookingMaxPerSlot || '?'} seats per session`;
    }
    if (pricingMode === 'event_ticket') {
      return `Capacity: ${data.maxCapacity || data.bookingMaxPerSlot || '?'} tickets`;
    }
    if (pricingMode === 'quote_based') {
      return '📬 No calendar required';
    }
    return null;
  };

  const capacity = capacitySummary();

  return (
    <div className="wizard-step-content">
      <h2>Review &amp; Publish</h2>
      <p className="wizard-tip">Double-check everything before publishing. You can edit anytime after.</p>

      <div className="review-sections">
        <div className="review-section">
          <h4>Details</h4>
          <div className="review-row"><span>Type:</span><span>{TYPE_LABELS[pricingMode]}</span></div>
          <div className="review-row"><span>Title:</span><span>{data.title || '—'}</span></div>
          <div className="review-row"><span>Category:</span><span>{data.category ? getCategoryLabel(data.category) : '—'}</span></div>
          <div className="review-row"><span>Description:</span><span>{data.description?.substring(0, 200) || '—'}{data.description?.length > 200 ? '...' : ''}</span></div>
          {capacity && <div className="review-row review-capacity"><span>Capacity:</span><span>{capacity}</span></div>}
        </div>

        {pricingMode === 'private_session' && (
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
          <h4>{labels.basic}</h4>
          <div className="review-row"><span>Title:</span><span>{data.basicTitle || '—'}</span></div>
          <div className="review-row"><span>{PRICE_LABEL[pricingMode]}:</span><span>{formatPrice(data.basicPrice)}</span></div>
          {isDeliverable && <div className="review-row"><span>Delivery:</span><span>{data.basicDeliveryTime ? `${data.basicDeliveryTime} days` : '—'}</span></div>}
          {isDeliverable && <div className="review-row"><span>Revisions:</span><span>{data.basicRevisions}</span></div>}
          {pricingMode === 'private_session' && data.recurringBillingCycle !== 'per_session' && data.basicSessionsIncluded && (
            <div className="review-row"><span>Sessions included:</span><span>{data.basicSessionsIncluded}</span></div>
          )}
        </div>

        {isMultiTier && data.standardEnabled && data.standardTitle && (
          <div className="review-section">
            <h4>{labels.standard}</h4>
            <div className="review-row"><span>Title:</span><span>{data.standardTitle}</span></div>
            <div className="review-row"><span>Price:</span><span>{formatPrice(data.standardPrice)}</span></div>
            {isDeliverable && <div className="review-row"><span>Delivery:</span><span>{data.standardDeliveryTime ? `${data.standardDeliveryTime} days` : '—'}</span></div>}
            {isDeliverable && <div className="review-row"><span>Revisions:</span><span>{data.standardRevisions}</span></div>}
          </div>
        )}

        {isMultiTier && data.premiumEnabled && data.premiumTitle && (
          <div className="review-section">
            <h4>{labels.premium}</h4>
            <div className="review-row"><span>Title:</span><span>{data.premiumTitle}</span></div>
            <div className="review-row"><span>Price:</span><span>{formatPrice(data.premiumPrice)}</span></div>
            {isDeliverable && <div className="review-row"><span>Delivery:</span><span>{data.premiumDeliveryTime ? `${data.premiumDeliveryTime} days` : '—'}</span></div>}
            {isDeliverable && <div className="review-row"><span>Revisions:</span><span>{data.premiumRevisions}</span></div>}
          </div>
        )}

        {data.requirements && (
          <div className="review-section">
            <h4>{pricingMode === 'quote_based' ? 'Before We Start' : 'Requirements'}</h4>
            <p style={{ color: '#4b5563', fontSize: '0.9rem' }}>{data.requirements}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StepReview;
