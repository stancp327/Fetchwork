import React, { useState } from 'react';
import { apiRequest } from '../../utils/api';
import './IntakeFormFill.css';

const IntakeFormFill = ({ template, bookingId, onSubmitted }) => {
  const fields = Array.isArray(template?.fieldsJson) ? template.fieldsJson : [];
  const [values,    setValues]    = useState({});
  const [errors,    setErrors]    = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [serverErr,  setServerErr]  = useState('');

  const handleChange = (id, value) => {
    setValues(prev => ({ ...prev, [id]: value }));
    if (errors[id]) setErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const validate = () => {
    const errs = {};
    fields.forEach(f => {
      if (f.required) {
        const v = values[f.id];
        if (v === undefined || v === '' || v === null || (Array.isArray(v) && v.length === 0)) {
          errs[f.id] = 'This field is required';
        }
      }
    });
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    setServerErr('');
    try {
      await apiRequest(`/api/intake-forms/${template.id}/respond`, {
        method: 'POST',
        body:   JSON.stringify({ bookingId, responses: values }),
      });
      setDone(true);
      onSubmitted?.();
    } catch (err) {
      setServerErr(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="iff-done">
        <span className="iff-done-icon">✅</span>
        <p>Intake form submitted. Your provider can now review your responses.</p>
      </div>
    );
  }

  return (
    <div className="iff-wrap">
      <h2 className="iff-title">{template?.name || 'Pre-Session Form'}</h2>
      <p className="iff-sub">Please complete this form before your session.</p>

      {serverErr && <div className="iff-server-err">{serverErr}</div>}

      <form onSubmit={handleSubmit} className="iff-form" noValidate>
        {fields.map(field => (
          <div key={field.id} className="iff-field">
            <label className="iff-label" htmlFor={`iff-${field.id}`}>
              {field.label}
              {field.required && <span className="iff-required"> *</span>}
            </label>

            {field.type === 'text' && (
              <input
                id={`iff-${field.id}`}
                className={`iff-input ${errors[field.id] ? 'err' : ''}`}
                value={values[field.id] || ''}
                onChange={e => handleChange(field.id, e.target.value)}
              />
            )}

            {field.type === 'textarea' && (
              <textarea
                id={`iff-${field.id}`}
                className={`iff-textarea ${errors[field.id] ? 'err' : ''}`}
                value={values[field.id] || ''}
                onChange={e => handleChange(field.id, e.target.value)}
                rows={4}
              />
            )}

            {field.type === 'number' && (
              <input
                id={`iff-${field.id}`}
                type="number"
                className={`iff-input ${errors[field.id] ? 'err' : ''}`}
                value={values[field.id] ?? ''}
                onChange={e => handleChange(field.id, e.target.value)}
              />
            )}

            {field.type === 'select' && (
              <select
                id={`iff-${field.id}`}
                className={`iff-input ${errors[field.id] ? 'err' : ''}`}
                value={values[field.id] || ''}
                onChange={e => handleChange(field.id, e.target.value)}
              >
                <option value="">Select an option…</option>
                {(field.options || []).map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            {field.type === 'checkbox' && (
              <label className="iff-checkbox-label">
                <input
                  id={`iff-${field.id}`}
                  type="checkbox"
                  checked={!!values[field.id]}
                  onChange={e => handleChange(field.id, e.target.checked)}
                />
                {field.label}
              </label>
            )}

            {errors[field.id] && (
              <span className="iff-err-msg">{errors[field.id]}</span>
            )}
          </div>
        ))}

        <button type="submit" className="iff-btn" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Form'}
        </button>
      </form>
    </div>
  );
};

export default IntakeFormFill;
