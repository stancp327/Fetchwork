import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import CategoryCombobox from '../common/CategoryCombobox';
import { getCategoryLabel } from '../../utils/categories';
import UpgradePrompt from '../Billing/UpgradePrompt';
import SEO from '../common/SEO';
import './CreateService.css';

const STEPS = ['Details', 'Pricing', 'Media', 'Requirements', 'Review'];

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
const LivePreview = ({ data }) => (
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
        <h4>{data.title || 'Your Service Title'}</h4>
        <p className="preview-desc">
          {data.description?.substring(0, 120) || 'Service description will appear here...'}
          {data.description?.length > 120 ? '...' : ''}
        </p>
        {data.category && (
          <span className="preview-tag">{getCategoryLabel(data.category)}</span>
        )}
      </div>
      {data.basicPrice && (
        <div className="preview-card-footer">
          <span className="preview-price">Starting at ${data.basicPrice}</span>
          {data.basicDeliveryTime && <span className="preview-delivery">📦 {data.basicDeliveryTime} day{data.basicDeliveryTime > 1 ? 's' : ''}</span>}
        </div>
      )}
    </div>

    {/* Package Summary */}
    {data.basicTitle && (
      <div className="preview-package">
        <h4>Basic Package</h4>
        <div className="preview-pkg-row"><span>Title:</span><span>{data.basicTitle}</span></div>
        {data.basicPrice && <div className="preview-pkg-row"><span>Price:</span><span>${data.basicPrice}</span></div>}
        {data.basicDeliveryTime && <div className="preview-pkg-row"><span>Delivery:</span><span>{data.basicDeliveryTime} days</span></div>}
        <div className="preview-pkg-row"><span>Revisions:</span><span>{data.basicRevisions || 0}</span></div>
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

// ── Step Components ─────────────────────────────────────────────
const StepDetails = ({ data, onChange, errors }) => (
  <div className="wizard-step-content">
    <h2>Service Details</h2>
    <p className="wizard-tip">💡 A clear, descriptive title helps clients find your service.</p>

    <div className="wiz-field">
      <label>Service Title *</label>
      <input
        type="text" value={data.title} maxLength={100}
        onChange={e => onChange('title', e.target.value)}
        placeholder="e.g. I will create a professional website for your business"
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
        placeholder="Describe your service in detail — what you offer, your process, what makes you different..."
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
        <input type="text" value={data.subcategory} onChange={e => onChange('subcategory', e.target.value)} placeholder="e.g. React, WordPress" />
      </div>
    </div>

    <div className="wiz-field">
      <label>Tags / Skills</label>
      <input type="text" value={data.skills} onChange={e => onChange('skills', e.target.value)} placeholder="React, Node.js, MongoDB (comma separated)" />
    </div>
  </div>
);

const PackageTierForm = ({ prefix, label, data, onChange, errors, required, badge }) => (
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
        placeholder={prefix === 'basic' ? 'e.g. Starter Package' : prefix === 'standard' ? 'e.g. Standard Package' : 'e.g. Premium Package'}
      />
      {errors[`${prefix}Title`] && <span className="wiz-error">{errors[`${prefix}Title`]}</span>}
    </div>
    <div className="wiz-field">
      <label>What's Included {required && '*'}</label>
      <textarea
        rows={3}
        value={data[`${prefix}Description`]}
        onChange={e => onChange(`${prefix}Description`, e.target.value)}
        placeholder="Describe what's included in this package..."
      />
      {errors[`${prefix}Description`] && <span className="wiz-error">{errors[`${prefix}Description`]}</span>}
    </div>
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
  </div>
);

const StepPricing = ({ data, onChange, errors }) => (
  <div className="wizard-step-content">
    <h2>Pricing &amp; Packages</h2>
    <p className="wizard-tip">💡 The Basic package is required. Standard and Premium are optional but help you earn more by offering tiers.</p>

    <PackageTierForm
      prefix="basic" label="Basic Package" badge="Required"
      data={data} onChange={onChange} errors={errors} required
    />

    {/* Standard toggle */}
    {!data.standardEnabled ? (
      <button type="button" className="pkg-add-btn" onClick={() => onChange('standardEnabled', true)}>
        ✨ Add Standard Package <span className="pkg-add-hint">— offer more features at a higher price</span>
      </button>
    ) : (
      <div style={{ position: 'relative' }}>
        <PackageTierForm
          prefix="standard" label="Standard Package" badge="Optional"
          data={data} onChange={onChange} errors={errors}
        />
        <button type="button" className="pkg-remove-btn" onClick={() => { onChange('standardEnabled', false); }}>
          Remove
        </button>
      </div>
    )}

    {/* Premium toggle — only show if standard is enabled */}
    {data.standardEnabled && (!data.premiumEnabled ? (
      <button type="button" className="pkg-add-btn" onClick={() => onChange('premiumEnabled', true)}>
        🌟 Add Premium Package <span className="pkg-add-hint">— your best offer, highest price</span>
      </button>
    ) : (
      <div style={{ position: 'relative' }}>
        <PackageTierForm
          prefix="premium" label="Premium Package" badge="Optional"
          data={data} onChange={onChange} errors={errors}
        />
        <button type="button" className="pkg-remove-btn" onClick={() => onChange('premiumEnabled', false)}>
          Remove
        </button>
      </div>
    ))}
  </div>
);

const StepMedia = ({ data, onChange }) => (
  <div className="wizard-step-content">
    <h2>Media</h2>
    <p className="wizard-tip">💡 Services with images get 3x more views.</p>
    <div className="media-upload-area">
      <div className="media-dropzone">
        <span className="media-icon">📁</span>
        <p>Drag & drop images here or click to browse</p>
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

const StepRequirements = ({ data, onChange }) => (
  <div className="wizard-step-content">
    <h2>Requirements</h2>
    <p className="wizard-tip">💡 Clear requirements help set expectations and avoid revisions.</p>
    <div className="wiz-field">
      <label>What do you need from the buyer?</label>
      <textarea
        rows={5} value={data.requirements} maxLength={1000}
        onChange={e => onChange('requirements', e.target.value)}
        placeholder="e.g. Brand guidelines, logo files, content text, reference websites..."
      />
      <div className="wiz-field-footer">
        <span />
        <span className="wiz-count">{data.requirements.length}/1000</span>
      </div>
    </div>
  </div>
);

const StepReview = ({ data }) => (
  <div className="wizard-step-content">
    <h2>Review & Publish</h2>
    <p className="wizard-tip">Double-check everything before publishing. You can edit anytime after.</p>

    <div className="review-sections">
      <div className="review-section">
        <h4>Details</h4>
        <div className="review-row"><span>Title:</span><span>{data.title || '—'}</span></div>
        <div className="review-row"><span>Category:</span><span>{data.category ? getCategoryLabel(data.category) : '—'}</span></div>
        <div className="review-row"><span>Description:</span><span>{data.description?.substring(0, 200) || '—'}{data.description?.length > 200 ? '...' : ''}</span></div>
      </div>
      <div className="review-section">
        <h4>Basic Package</h4>
        <div className="review-row"><span>Title:</span><span>{data.basicTitle || '—'}</span></div>
        <div className="review-row"><span>Price:</span><span>{data.basicPrice ? `$${data.basicPrice}` : '—'}</span></div>
        <div className="review-row"><span>Delivery:</span><span>{data.basicDeliveryTime ? `${data.basicDeliveryTime} days` : '—'}</span></div>
        <div className="review-row"><span>Revisions:</span><span>{data.basicRevisions}</span></div>
      </div>
      {data.standardEnabled && data.standardTitle && (
        <div className="review-section">
          <h4>Standard Package</h4>
          <div className="review-row"><span>Title:</span><span>{data.standardTitle}</span></div>
          <div className="review-row"><span>Price:</span><span>{data.standardPrice ? `$${data.standardPrice}` : '—'}</span></div>
          <div className="review-row"><span>Delivery:</span><span>{data.standardDeliveryTime ? `${data.standardDeliveryTime} days` : '—'}</span></div>
          <div className="review-row"><span>Revisions:</span><span>{data.standardRevisions}</span></div>
        </div>
      )}
      {data.premiumEnabled && data.premiumTitle && (
        <div className="review-section">
          <h4>Premium Package</h4>
          <div className="review-row"><span>Title:</span><span>{data.premiumTitle}</span></div>
          <div className="review-row"><span>Price:</span><span>{data.premiumPrice ? `$${data.premiumPrice}` : '—'}</span></div>
          <div className="review-row"><span>Delivery:</span><span>{data.premiumDeliveryTime ? `${data.premiumDeliveryTime} days` : '—'}</span></div>
          <div className="review-row"><span>Revisions:</span><span>{data.premiumRevisions}</span></div>
        </div>
      )}
      {data.requirements && (
        <div className="review-section">
          <h4>Requirements</h4>
          <p style={{ color: '#4b5563', fontSize: '0.9rem' }}>{data.requirements}</p>
        </div>
      )}
    </div>
  </div>
);

// ── Main Wizard ─────────────────────────────────────────────────
const CreateService = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  const [showPreview, setShowPreview] = useState(true);
  const [upgradeLimit, setUpgradeLimit] = useState(null);
  const [data, setData] = useState({
    title: '', description: '', category: '', subcategory: '', skills: '',
    requirements: '', imagePreview: '',
    basicTitle: '', basicDescription: '', basicPrice: '', basicDeliveryTime: '', basicRevisions: 1,
    standardEnabled: false, standardTitle: '', standardDescription: '', standardPrice: '', standardDeliveryTime: '', standardRevisions: 2,
    premiumEnabled: false,  premiumTitle: '',  premiumDescription: '',  premiumPrice: '',  premiumDeliveryTime: '',  premiumRevisions: 3,
  });

  const update = (key, value) => {
    setData(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }));
  };

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
      if (!data.basicPrice || parseFloat(data.basicPrice) < 5) e.basicPrice = 'Min $5';
      if (!data.basicDeliveryTime || parseInt(data.basicDeliveryTime) < 1) e.basicDeliveryTime = 'Min 1 day';
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
      const serviceData = {
        title: data.title.trim(),
        description: data.description.trim(),
        category: data.category,
        subcategory: data.subcategory.trim() || undefined,
        skills: data.skills.split(',').map(s => s.trim()).filter(Boolean),
        requirements: data.requirements.trim(),
        pricing: {
          basic: {
            title:        data.basicTitle.trim(),
            description:  data.basicDescription.trim(),
            price:        parseFloat(data.basicPrice),
            deliveryTime: parseInt(data.basicDeliveryTime),
            revisions:    parseInt(data.basicRevisions),
          },
          ...(data.standardEnabled && data.standardTitle ? {
            standard: {
              title:        data.standardTitle.trim(),
              description:  data.standardDescription.trim(),
              price:        parseFloat(data.standardPrice),
              deliveryTime: parseInt(data.standardDeliveryTime),
              revisions:    parseInt(data.standardRevisions),
            }
          } : {}),
          ...(data.premiumEnabled && data.premiumTitle ? {
            premium: {
              title:        data.premiumTitle.trim(),
              description:  data.premiumDescription.trim(),
              price:        parseFloat(data.premiumPrice),
              deliveryTime: parseInt(data.premiumDeliveryTime),
              revisions:    parseInt(data.premiumRevisions),
            }
          } : {}),
        }
      };

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
    <StepDetails data={data} onChange={update} errors={errors} />,
    <StepPricing data={data} onChange={update} errors={errors} />,
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

