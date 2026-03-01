import React from 'react';

/**
 * IntakeFormFill — renders intake form fields for a client to fill out.
 * Props: fields (from service.intakeForm.fields), values (object), onChange (key, value)
 */
const IntakeFormFill = ({ fields = [], values = {}, onChange }) => {
  if (!fields.length) return null;

  return (
    <div className="iff-root">
      <h4 className="iff-title">📋 Service Intake</h4>
      <p className="iff-desc">Please answer these questions from the freelancer</p>

      {fields.map((field, i) => {
        const key = `intake_${i}`;
        const val = values[key] || '';

        return (
          <div key={i} className="iff-field">
            <label className="iff-label">
              {field.label}
              {field.required && <span className="iff-required"> *</span>}
            </label>

            {field.type === 'text' && (
              <input
                type="text"
                className="iff-input"
                value={val}
                onChange={e => onChange(key, e.target.value)}
                placeholder={field.placeholder}
              />
            )}

            {field.type === 'textarea' && (
              <textarea
                className="iff-textarea"
                value={val}
                onChange={e => onChange(key, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
              />
            )}

            {field.type === 'select' && (
              <select
                className="iff-select"
                value={val}
                onChange={e => onChange(key, e.target.value)}
              >
                <option value="">{field.placeholder || '— Select —'}</option>
                {(field.options || []).map((opt, oi) => (
                  <option key={oi} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            {field.type === 'checkbox' && (
              <label className="iff-checkbox">
                <input
                  type="checkbox"
                  checked={val === true || val === 'true'}
                  onChange={e => onChange(key, e.target.checked)}
                />
                {field.placeholder || 'Yes'}
              </label>
            )}

            {field.type === 'number' && (
              <input
                type="number"
                className="iff-input"
                value={val}
                onChange={e => onChange(key, e.target.value)}
                placeholder={field.placeholder}
              />
            )}

            {field.type === 'date' && (
              <input
                type="date"
                className="iff-input"
                value={val}
                onChange={e => onChange(key, e.target.value)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default IntakeFormFill;
