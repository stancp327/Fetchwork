import React from 'react';

const FIELD_TYPES = [
  { value: 'text',     label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'select',   label: 'Dropdown' },
  { value: 'checkbox', label: 'Yes/No Checkbox' },
  { value: 'number',   label: 'Number' },
  { value: 'date',     label: 'Date' },
];

const IntakeFormEditor = ({ fields = [], onChange, enabled, onToggle }) => {

  const addField = () => {
    onChange([...fields, { label: '', type: 'text', placeholder: '', required: false, options: [] }]);
  };

  const removeField = (index) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const updateField = (index, key, value) => {
    onChange(fields.map((f, i) => i === index ? { ...f, [key]: value } : f));
  };

  const updateOption = (fieldIdx, optIdx, value) => {
    const updated = [...fields];
    updated[fieldIdx].options[optIdx] = value;
    onChange(updated);
  };

  const addOption = (fieldIdx) => {
    const updated = [...fields];
    updated[fieldIdx].options = [...(updated[fieldIdx].options || []), ''];
    onChange(updated);
  };

  const removeOption = (fieldIdx, optIdx) => {
    const updated = [...fields];
    updated[fieldIdx].options = updated[fieldIdx].options.filter((_, i) => i !== optIdx);
    onChange(updated);
  };

  return (
    <div className="ife-root">
      <div className="ife-header">
        <div className="ife-header-text">
          <h3 className="ife-title">📋 Client Intake Form</h3>
          <p className="ife-desc">Add custom questions clients must answer when ordering your service</p>
        </div>
        <label className="ife-toggle">
          <input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)} />
          <span className="ife-toggle-slider" />
        </label>
      </div>

      {enabled && (
        <div className="ife-fields">
          {fields.length === 0 && (
            <p className="ife-empty">No fields yet. Add a question below.</p>
          )}

          {fields.map((field, i) => (
            <div key={i} className="ife-field-card">
              <div className="ife-field-row">
                <input
                  className="ife-field-label"
                  value={field.label}
                  onChange={e => updateField(i, 'label', e.target.value)}
                  placeholder="Question (e.g. What's your dog's breed?)"
                />
                <select
                  className="ife-field-type"
                  value={field.type}
                  onChange={e => updateField(i, 'type', e.target.value)}
                >
                  {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div className="ife-field-row">
                <input
                  className="ife-field-placeholder"
                  value={field.placeholder}
                  onChange={e => updateField(i, 'placeholder', e.target.value)}
                  placeholder="Placeholder text (optional)"
                />
                <label className="ife-required-check">
                  <input type="checkbox" checked={field.required} onChange={e => updateField(i, 'required', e.target.checked)} />
                  Required
                </label>
                <button className="ife-rm-field" onClick={() => removeField(i)} title="Remove field">✕</button>
              </div>

              {/* Options for select type */}
              {field.type === 'select' && (
                <div className="ife-options">
                  {(field.options || []).map((opt, oi) => (
                    <div key={oi} className="ife-option-row">
                      <input
                        value={opt}
                        onChange={e => updateOption(i, oi, e.target.value)}
                        placeholder={`Option ${oi + 1}`}
                        className="ife-option-input"
                      />
                      <button className="ife-rm-option" onClick={() => removeOption(i, oi)}>✕</button>
                    </div>
                  ))}
                  <button className="ife-add-option" onClick={() => addOption(i)}>+ Add Option</button>
                </div>
              )}
            </div>
          ))}

          <button className="ife-add-field" onClick={addField}>
            + Add Question
          </button>
        </div>
      )}
    </div>
  );
};

export default IntakeFormEditor;
