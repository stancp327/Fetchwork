import React from 'react';
import CategoryCombobox from '../../common/CategoryCombobox';
import ServiceTypeSelector from './ServiceTypeSelector';

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

export default StepDetails;
