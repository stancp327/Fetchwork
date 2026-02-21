import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import './CreateService.css';

const STEPS = ['Details', 'Pricing', 'Media', 'Requirements', 'Review'];

const CATEGORIES = [
  { value: '', label: 'Select a category' },
  { value: 'web_development', label: 'Web Development' },
  { value: 'mobile_development', label: 'Mobile Development' },
  { value: 'design', label: 'Design' },
  { value: 'writing', label: 'Writing' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'data_entry', label: 'Data Entry' },
  { value: 'customer_service', label: 'Customer Service' },
  { value: 'translation', label: 'Translation' },
  { value: 'video_editing', label: 'Video Editing' },
  { value: 'photography', label: 'Photography' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'other', label: 'Other' },
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
          <span className="preview-tag">{CATEGORIES.find(c => c.value === data.category)?.label || data.category}</span>
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
        <select value={data.category} onChange={e => onChange('category', e.target.value)}>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
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

const StepPricing = ({ data, onChange, errors }) => (
  <div className="wizard-step-content">
    <h2>Pricing</h2>
    <p className="wizard-tip">💡 Start with a basic package. You can add more tiers later.</p>

    <div className="pricing-card">
      <h3>Basic Package</h3>
      <div className="wiz-field">
        <label>Package Title *</label>
        <input type="text" value={data.basicTitle} onChange={e => onChange('basicTitle', e.target.value)} placeholder="e.g. Starter Website" />
        {errors.basicTitle && <span className="wiz-error">{errors.basicTitle}</span>}
      </div>
      <div className="wiz-field">
        <label>What's Included *</label>
        <textarea rows={3} value={data.basicDescription} onChange={e => onChange('basicDescription', e.target.value)} placeholder="Describe what's included in this package..." />
        {errors.basicDescription && <span className="wiz-error">{errors.basicDescription}</span>}
      </div>
      <div className="wiz-row wiz-row-3">
        <div className="wiz-field">
          <label>Price ($) *</label>
          <input type="number" value={data.basicPrice} onChange={e => onChange('basicPrice', e.target.value)} placeholder="25" min="5" step="0.01" />
          {errors.basicPrice && <span className="wiz-error">{errors.basicPrice}</span>}
        </div>
        <div className="wiz-field">
          <label>Delivery (days) *</label>
          <input type="number" value={data.basicDeliveryTime} onChange={e => onChange('basicDeliveryTime', e.target.value)} placeholder="3" min="1" />
          {errors.basicDeliveryTime && <span className="wiz-error">{errors.basicDeliveryTime}</span>}
        </div>
        <div className="wiz-field">
          <label>Revisions</label>
          <input type="number" value={data.basicRevisions} onChange={e => onChange('basicRevisions', e.target.value)} min="0" max="10" />
        </div>
      </div>
    </div>
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
        <div className="review-row"><span>Category:</span><span>{CATEGORIES.find(c => c.value === data.category)?.label || '—'}</span></div>
        <div className="review-row"><span>Description:</span><span>{data.description?.substring(0, 200) || '—'}{data.description?.length > 200 ? '...' : ''}</span></div>
      </div>
      <div className="review-section">
        <h4>Basic Package</h4>
        <div className="review-row"><span>Title:</span><span>{data.basicTitle || '—'}</span></div>
        <div className="review-row"><span>Price:</span><span>{data.basicPrice ? `$${data.basicPrice}` : '—'}</span></div>
        <div className="review-row"><span>Delivery:</span><span>{data.basicDeliveryTime ? `${data.basicDeliveryTime} days` : '—'}</span></div>
        <div className="review-row"><span>Revisions:</span><span>{data.basicRevisions}</span></div>
      </div>
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
  const [data, setData] = useState({
    title: '', description: '', category: '', subcategory: '', skills: '',
    requirements: '', basicTitle: '', basicDescription: '', basicPrice: '',
    basicDeliveryTime: '', basicRevisions: 1, imagePreview: ''
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
            title: data.basicTitle.trim(),
            description: data.basicDescription.trim(),
            price: parseFloat(data.basicPrice),
            deliveryTime: parseInt(data.basicDeliveryTime),
            revisions: parseInt(data.basicRevisions)
          }
        }
      };

      await apiRequest('/api/services', { method: 'POST', body: JSON.stringify(serviceData) });
      navigate('/browse-services');
    } catch (err) {
      if (err.message?.includes('401') || err.message?.includes('session')) {
        navigate('/login');
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
