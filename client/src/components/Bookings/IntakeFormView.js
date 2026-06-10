import React from 'react';
import './IntakeFormView.css';

const IntakeFormView = ({ template, response }) => {
  if (!template || !response) return null;

  const fields     = Array.isArray(template.fieldsJson) ? template.fieldsJson : [];
  const answers    = response.responsesJson || {};
  const submittedAt = response.submittedAt
    ? new Date(response.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="ifv-wrap">
      <div className="ifv-header">
        <h2 className="ifv-title">{template.name || 'Intake Form'}</h2>
        {submittedAt && <span className="ifv-date">Submitted {submittedAt}</span>}
      </div>

      <div className="ifv-responses">
        {fields.map(field => {
          const answer = answers[field.id];
          const displayValue = answer === true ? 'Yes'
            : answer === false ? 'No'
            : answer != null && answer !== '' ? String(answer)
            : <span className="ifv-empty">No response</span>;

          return (
            <div key={field.id} className="ifv-item">
              <span className="ifv-label">{field.label}</span>
              <span className="ifv-value">{displayValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IntakeFormView;
