import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeatures } from '../../hooks/useFeatures';
import { apiRequest } from '../../utils/api';
import UpgradePrompt from '../Billing/UpgradePrompt';
import SEO from '../common/SEO';
import './CreateService.css';

import { STEPS } from './CreateService/constants';
import Stepper from './CreateService/Stepper';
import LivePreview from './CreateService/LivePreview';
import StepDetails from './CreateService/StepDetails';
import StepPricing from './CreateService/StepPricing';
import StepBooking from './CreateService/StepBooking';
import StepMedia from './CreateService/StepMedia';
import StepRequirements from './CreateService/StepRequirements';
import StepReview from './CreateService/StepReview';

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
    scheduleType: '',
    serviceLocation: 'remote',
    serviceLocationAddress: '',
    serviceLocationNotes: '',
    // details
    title: '', description: '', category: '', subcategory: '', skills: '',
    requirements: '', imagePreview: '', gallery: [],
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
    // scheduling mode (set in ServiceTypeSelector, used by StepBooking + StepPricing)
    capacityType: 'ONE_ON_ONE',
    maxCapacity: 1,
    // fixed-session schedule fields
    fixedDays: [],
    fixedStartTime: '',
    fixedDuration: 60,
    fixedEventDate: '',
    fixedGenerationWeeks: 8,
    // booking (DYNAMIC_PRIVATE mode)
    bookingEnabled: false,
    bookingSlotDuration: 60,
    bookingMaxPerSlot: 1,
    bookingBuffer: 0,
    bookingMinNotice: 1,
    bookingMaxAdvance: 60,
  });

  const update = (key, value) => {
    setData(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }));
  };

  // Derive pricing mode from scheduleType
  const pricingMode = (() => {
    switch (data.scheduleType) {
      case 'DYNAMIC_PRIVATE':  return 'private_session';
      case 'FIXED_RECURRING':  return 'class_or_recurring';
      case 'FIXED_ONE_TIME':   return 'event_ticket';
      case 'REQUEST_BASED':    return 'quote_based';
      default:                 return 'deliverable';
    }
  })();

  const validateStep = () => {
    const e = {};
    if (step === 0) {
      if (!data.title.trim()) e.title = 'Required';
      if (!data.description.trim()) e.description = 'Required';
      if (!data.category) e.category = 'Required';
      if ((data.serviceLocation === 'at_freelancer' || data.serviceLocation === 'flexible') && !data.serviceLocationAddress.trim()) {
        e.serviceLocationAddress = 'Enter your location so clients know where to go';
      }
    }
    if (step === 1) {
      if (pricingMode === 'deliverable') {
        if (!data.basicTitle.trim()) e.basicTitle = 'Required';
        if (!data.basicDescription.trim()) e.basicDescription = 'Required';
        if (!data.basicPrice || parseFloat(data.basicPrice) < 5) e.basicPrice = 'Min $5';
        if (!data.basicDeliveryTime || parseInt(data.basicDeliveryTime) < 1) e.basicDeliveryTime = 'Min 1 day';
      } else if (pricingMode === 'private_session') {
        if (!data.basicTitle.trim()) e.basicTitle = 'Required';
        if (!data.basicDescription.trim()) e.basicDescription = 'Required';
        if (data.basicPrice === '' || data.basicPrice === undefined || parseFloat(data.basicPrice) < 0) e.basicPrice = 'Required';
        if (data.standardEnabled && (!data.standardSessionsIncluded || parseInt(data.standardSessionsIncluded) < 1)) {
          e.standardSessionsIncluded = 'Required for session pack';
        }
        if (data.premiumEnabled && (!data.premiumSessionsIncluded || parseInt(data.premiumSessionsIncluded) < 1)) {
          e.premiumSessionsIncluded = 'Required for session pack';
        }
      } else {
        // class_or_recurring, event_ticket, quote_based: just need price >= 0
        if (data.basicPrice === '' || data.basicPrice === undefined || parseFloat(data.basicPrice) < 0) e.basicPrice = 'Required';
      }
    }
    if (step === 2) {
      if (data.scheduleType === 'FIXED_RECURRING') {
        if (!(data.fixedDays || []).length) e.fixedDays = 'Select at least one day';
        if (!data.fixedStartTime) e.fixedStartTime = 'Required';
      }
      if (data.scheduleType === 'FIXED_ONE_TIME') {
        if (!data.fixedEventDate) e.fixedEventDate = 'Required';
        if (!data.fixedStartTime) e.fixedStartTime = 'Required';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const isStepValid = () => {
    switch (step) {
      case 0: // Service Details
        const needsAddress = data.serviceLocation === 'at_freelancer' || data.serviceLocation === 'flexible';
        return data.title.trim() !== '' && 
               data.description.trim() !== '' && 
               data.category !== '' &&
               (!needsAddress || data.serviceLocationAddress.trim() !== '');
      case 1: // Pricing & Packages
        if (pricingMode === 'deliverable') {
          return data.basicTitle.trim() !== '' && 
                 data.basicDescription.trim() !== '' && 
                 data.basicPrice && parseFloat(data.basicPrice) >= 5 &&
                 data.basicDeliveryTime && parseInt(data.basicDeliveryTime) >= 1;
        }
        if (pricingMode === 'private_session') {
          return data.basicTitle.trim() !== '' && 
                 data.basicDescription.trim() !== '' && 
                 data.basicPrice !== '' && data.basicPrice !== undefined && parseFloat(data.basicPrice) >= 0;
        }
        // class_or_recurring, event_ticket, quote_based: just price >= 0
        return data.basicPrice !== '' && data.basicPrice !== undefined && parseFloat(data.basicPrice) >= 0;
      case 2: // Booking - validate based on scheduleType
        if (data.scheduleType === 'FIXED_RECURRING') {
          return (data.fixedDays || []).length > 0 && !!data.fixedStartTime;
        }
        if (data.scheduleType === 'FIXED_ONE_TIME') {
          return !!data.fixedEventDate && !!data.fixedStartTime;
        }
        if (data.scheduleType === 'DYNAMIC_PRIVATE') {
          return !!(data.bookingSlotDuration || 60); // always has default
        }
        return true; // REQUEST_BASED + deliverable: no required fields
      case 3: // Media - no required fields
        return true;
      case 4: // Requirements - no required fields
        return true;
      case 5: // Review - always valid for Continue
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!validateStep()) return;
    // Auto-populate basic package title/description from service title/description
    // so users don't have to type the same thing twice (step 0 → step 1)
    if (step === 0) {
      if (!data.basicTitle?.trim() && data.title?.trim()) update('basicTitle', data.title.trim());
      if (!data.basicDescription?.trim() && data.description?.trim()) update('basicDescription', data.description.trim());
    }
    setStep(prev => Math.min(prev + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setStep(prev => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePublish = async () => {
    setLoading(true);
    setError(null);
    try {
      const buildPkg = (prefix, required) => {
        const title = data[`${prefix}Title`]?.trim();
        const desc  = data[`${prefix}Description`]?.trim();
        const price = parseFloat(data[`${prefix}Price`]);
        if (!required && (!title || isNaN(price))) return undefined;
        const isDeliverable = pricingMode === 'deliverable';
        return {
          title: title || (isDeliverable ? '' : 'Session'),
          description: desc || '',
          price: isNaN(price) ? 0 : price,
          deliveryTime: isDeliverable ? (parseInt(data[`${prefix}DeliveryTime`]) || 1) : 1,
          revisions: isDeliverable ? (parseInt(data[`${prefix}Revisions`]) || 0) : 0,
          ...(pricingMode === 'private_session' && prefix !== 'basic'
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
        ...(data.serviceType === 'recurring' ? {
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
        const validFields = data.intakeFields.filter(f => f.label?.trim());
        if (validFields.length > 0) {
          serviceData.intakeForm = { enabled: true, fields: validFields };
        }
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

      serviceData.serviceLocation = {
        mode: data.serviceLocation || 'remote',
        address: data.serviceLocationAddress || '',
        notes: data.serviceLocationNotes || '',
      };

      // Scheduling mode (Gate 6B)
      if (data.scheduleType) {
        serviceData.scheduleType = data.scheduleType;
        serviceData.capacityType = data.capacityType || 'ONE_ON_ONE';
        serviceData.maxCapacity = data.maxCapacity || 1;
      }

      // DYNAMIC_PRIVATE: existing slot-based booking settings
      if (data.bookingEnabled && data.scheduleType === 'DYNAMIC_PRIVATE') {
        serviceData.availability = {
          enabled: true,
          slotDuration: data.bookingSlotDuration || 60,
          maxPerSlot: data.bookingMaxPerSlot || 1,
          bufferTime: data.bookingBuffer || 0,
          maxAdvanceDays: data.bookingMaxAdvance || 60,
        };
        serviceData.bookingMinNotice = data.bookingMinNotice ?? 1;
      }

      // FIXED_RECURRING / FIXED_ONE_TIME: send schedule data for template creation
      if (data.scheduleType === 'FIXED_RECURRING' || data.scheduleType === 'FIXED_ONE_TIME') {
        serviceData.fixedSchedule = {
          days: data.fixedDays || [],
          startTime: data.fixedStartTime || '',
          duration: data.fixedDuration || 60,
          eventDate: data.fixedEventDate || '',
          generationWeeks: data.fixedGenerationWeeks || 8,
        };
      }

      // Include uploaded gallery images
      if (data.gallery && data.gallery.length > 0) {
        serviceData.gallery = data.gallery.map(({ url, caption, type }) => ({ url, caption, type }));
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
    <StepBooking data={data} onChange={update} />,
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
            <button 
              className="wiz-btn primary" 
              onClick={handleNext}
              disabled={!isStepValid()}>
              Continue →
            </button>
          ) : (
            <button 
              className="wiz-btn publish" 
              onClick={handlePublish} 
              disabled={loading || !isStepValid()}>
              {loading ? 'Publishing...' : '🚀 Publish Service'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateService;
