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
    serviceLocation: 'remote',
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

      serviceData.serviceLocation = data.serviceLocation || 'remote';

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
