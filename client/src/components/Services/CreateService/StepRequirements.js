import React from 'react';

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

export default StepRequirements;
