import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import './IntakeFormBuilder.css';

const FIELD_TYPES = [
  { value: 'text',     label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'select',   label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'number',   label: 'Number' },
];

function newField() {
  return {
    id:       crypto.randomUUID(),
    label:    '',
    type:     'text',
    required: false,
    options:  [],
  };
}

const IntakeFormBuilder = () => {
  const navigate = useNavigate();

  const [formName,  setFormName]   = useState('Pre-Session Questionnaire');
  const [fields,    setFields]     = useState([newField()]);
  const [saving,    setSaving]     = useState(false);
  const [msg,       setMsg]        = useState({ text: '', ok: true });
  const [existing,  setExisting]   = useState([]);
  const [editingId, setEditingId]  = useState(null);
  const [dragIdx,   setDragIdx]    = useState(null);

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg({ text: '', ok: true }), 4000); };

  useEffect(() => {
    apiRequest('/api/intake-forms/templates/me')
      .then(d => setExisting(d.templates || []))
      .catch(() => {});
  }, []);

  const loadTemplate = (t) => {
    setEditingId(t.id);
    setFormName(t.name);
    setFields(Array.isArray(t.fieldsJson) ? t.fieldsJson : [newField()]);
  };

  const handleAddField = () => setFields(prev => [...prev, newField()]);

  const handleRemoveField = (idx) => setFields(prev => prev.filter((_, i) => i !== idx));

  const handleFieldChange = (idx, key, value) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: value } : f));
  };

  const handleOptionChange = (idx, optIdx, value) => {
    setFields(prev => prev.map((f, i) => {
      if (i !== idx) return f;
      const options = [...(f.options || [])];
      options[optIdx] = value;
      return { ...f, options };
    }));
  };

  const handleAddOption = (idx) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, options: [...(f.options || []), ''] } : f));
  };

  const handleRemoveOption = (idx, optIdx) => {
    setFields(prev => prev.map((f, i) => {
      if (i !== idx) return f;
      return { ...f, options: f.options.filter((_, j) => j !== optIdx) };
    }));
  };

  // Drag to reorder
  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver  = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setFields(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(dragIdx, 1);
      arr.splice(idx, 0, moved);
      return arr;
    });
    setDragIdx(idx);
  };
  const handleDragEnd   = () => setDragIdx(null);

  const handleSave = async (e) => {
    e.preventDefault();
    const valid = fields.every(f => f.label.trim());
    if (!valid) { flash('All fields must have a label', false); return; }

    setSaving(true);
    try {
      const payload = { name: formName, fieldsJson: fields };
      if (editingId) {
        const t = existing.find(x => x.id === editingId);
        if (t?.serviceId) payload.serviceId = t.serviceId;
      }
      const data = await apiRequest('/api/intake-forms', { method: 'POST', body: JSON.stringify(payload) });
      flash('Form saved!');
      // Refresh list
      const updated = await apiRequest('/api/intake-forms/templates/me');
      setExisting(updated.templates || []);
      setEditingId(data.template?.id || null);
    } catch (err) {
      flash(err.message, false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this form?')) return;
    try {
      await apiRequest(`/api/intake-forms/${id}`, { method: 'DELETE' });
      flash('Form deactivated');
      setExisting(prev => prev.map(t => t.id === id ? { ...t, isActive: false } : t));
      if (editingId === id) { setEditingId(null); setFields([newField()]); setFormName('Pre-Session Questionnaire'); }
    } catch (err) {
      flash(err.message, false);
    }
  };

  return (
    <div className="ifb-page">
      <SEO title="Intake Form Builder | Fetchwork" path="/intake-forms/builder" noIndex />
      <div className="ifb-header">
        <Link to="/bookings" className="ifb-back">← My Bookings</Link>
        <h1 className="ifb-title">Intake Form Builder</h1>
      </div>

      {/* Existing templates */}
      {existing.length > 0 && (
        <div className="ifb-existing">
          <h2 className="ifb-sub">Your Forms</h2>
          {existing.map(t => (
            <div key={t.id} className={`ifb-existing-item ${!t.isActive ? 'inactive' : ''}`}>
              <span className="ifb-existing-name">{t.name}</span>
              <span className="ifb-existing-meta">
                {t.serviceId ? `Service: ${t.serviceId.slice(0, 8)}…` : 'All services'}
                {!t.isActive && ' · Inactive'}
              </span>
              <div className="ifb-existing-actions">
                <button className="ifb-btn-link" onClick={() => loadTemplate(t)}>Edit</button>
                {t.isActive && (
                  <button className="ifb-btn-link danger" onClick={() => handleDeactivate(t.id)}>Deactivate</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {msg.text && (
        <div className={`ifb-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>
      )}

      {/* Builder */}
      <form onSubmit={handleSave} className="ifb-form">
        <label className="ifb-label">
          Form Name
          <input
            className="ifb-input"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            required
          />
        </label>

        <div className="ifb-fields">
          {fields.map((field, idx) => (
            <div
              key={field.id}
              className="ifb-field-card"
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
            >
              <div className="ifb-field-header">
                <span className="ifb-drag-handle" title="Drag to reorder">⣿</span>
                <span className="ifb-field-num">Field {idx + 1}</span>
                <button type="button" className="ifb-field-remove" onClick={() => handleRemoveField(idx)} title="Remove field">✕</button>
              </div>

              <div className="ifb-field-row">
                <label className="ifb-label ifb-label-grow">
                  Label
                  <input
                    className="ifb-input"
                    value={field.label}
                    onChange={e => handleFieldChange(idx, 'label', e.target.value)}
                    placeholder="e.g. What are your goals?"
                    required
                  />
                </label>
                <label className="ifb-label">
                  Type
                  <select
                    className="ifb-input"
                    value={field.type}
                    onChange={e => handleFieldChange(idx, 'type', e.target.value)}
                  >
                    {FIELD_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="ifb-checkbox-row">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={e => handleFieldChange(idx, 'required', e.target.checked)}
                />
                Required
              </label>

              {field.type === 'select' && (
                <div className="ifb-options">
                  <span className="ifb-options-label">Options</span>
                  {(field.options || []).map((opt, optIdx) => (
                    <div key={optIdx} className="ifb-option-row">
                      <input
                        className="ifb-input"
                        value={opt}
                        onChange={e => handleOptionChange(idx, optIdx, e.target.value)}
                        placeholder={`Option ${optIdx + 1}`}
                      />
                      <button type="button" className="ifb-opt-remove" onClick={() => handleRemoveOption(idx, optIdx)}>✕</button>
                    </div>
                  ))}
                  <button type="button" className="ifb-btn-link" onClick={() => handleAddOption(idx)}>+ Add option</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <button type="button" className="ifb-add-field" onClick={handleAddField}>+ Add field</button>

        <div className="ifb-form-actions">
          <button type="submit" className="ifb-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Form'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default IntakeFormBuilder;
